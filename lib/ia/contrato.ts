import 'server-only';
import { servicio } from '@/lib/supabase-servidor';
import { agenteDe, ejecutar } from './cliente';

/*
 * Leer un contrato o tarifario y proponer los términos que el viajero tiene
 * que saber antes de reservar.
 *
 * LO QUE ESTO NO ES: un extractor que llena campos solo. Lo que sale de acá es
 * una PROPUESTA que una persona aprueba. Una política de cancelación inventada
 * dentro de un correo de confirmación es una promesa comercial que el operador
 * nunca hizo, y la descubre el cliente el día que quiere cancelar — cuando ya
 * no hay forma de arreglarlo con una disculpa.
 *
 * Por eso cada término viaja con su CITA TEXTUAL del documento. Quien aprueba
 * compara la cita contra el PDF sin tener que leerlo entero, y si la IA se
 * inventó algo no hay cita que mostrar: el campo sale vacío y se nota.
 *
 * Y por eso se le pide explícitamente que deje vacío lo que no encuentre. El
 * modo de fallo que importa no es que no encuentre la política de cancelación
 * —eso se ve— sino que escriba una plausible que nadie firmó.
 */

export type TerminoLeido = {
  /** Lo que diría el correo, redactado para quien reserva. */
  texto: string;
  /** La frase TEXTUAL del documento de donde salió. Sin esto no se aprueba. */
  cita: string;
};

export type TerminosDeContrato = {
  politica_cancelacion: TerminoLeido | null;
  condiciones_pago: TerminoLeido | null;
  que_llevar: TerminoLeido | null;
  /* Datos duros que conviene confirmar contra lo que ya está cargado. */
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  razon_social: string | null;
  cedula_juridica: string | null;
  /* Lo que la IA vio y no supo dónde poner, o que contradice algo. Es lo
     primero que hay que leer: acá aparecen las sorpresas. */
  avisos: string[];
};

const INSTRUCCIONES = `Sos un asistente que lee contratos y tarifarios de operadores turísticos de Costa Rica para VisitLaFortunaCR.

Tu trabajo es EXTRAER, nunca redactar de memoria ni completar lo que falte.

REGLAS QUE NO SE NEGOCIAN:

1. Cada término que devolvás lleva una CITA TEXTUAL del documento, copiada
   carácter por carácter. Si no podés citar, el campo va en null.
2. Si el documento no dice nada de un campo, ese campo va en null. NUNCA
   escribas una política plausible: vale mil veces más un null que una
   condición que nadie firmó.
3. El texto que redactás va dirigido a quien reserva, en español de Costa Rica,
   claro y corto. No inventes plazos, montos ni porcentajes que no estén.
4. Si el documento se contradice, o dice algo que al equipo le conviene saber
   (prepago obligatorio, tarifas que vencen, requisitos de documentos), ponelo
   en "avisos".

Devolvé SOLO un objeto JSON con esta forma, sin texto alrededor:

{
  "politica_cancelacion": { "texto": "...", "cita": "..." } | null,
  "condiciones_pago":     { "texto": "...", "cita": "..." } | null,
  "que_llevar":           { "texto": "...", "cita": "..." } | null,
  "vigencia_desde": "AAAA-MM-DD" | null,
  "vigencia_hasta": "AAAA-MM-DD" | null,
  "razon_social": "..." | null,
  "cedula_juridica": "..." | null,
  "avisos": ["..."]
}`;

/** Lo que el modelo puede leer. Un .docx o un .xlsx no se le mandan. */
const LEGIBLES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

function tipoPorNombre(ruta: string): string {
  const ext = ruta.toLowerCase().split('.').pop() ?? '';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

export type Resultado =
  | { ok: true; terminos: TerminosDeContrato; modelo: string }
  | { ok: false; motivo: string };

/**
 * Lee el documento del contrato y propone los términos.
 *
 * El archivo vive en el bucket PRIVADO `contratos`, así que se baja con la
 * clave de servicio: nunca pasa por el navegador ni por una url pública.
 */
export async function leerContrato(
  destinoId: string, contratoId: string, ruta: string,
): Promise<Resultado> {
  if (!ruta || ruta.startsWith('http')) {
    return { ok: false, motivo: 'Solo se puede leer un archivo subido al archivero, no un enlace de afuera.' };
  }
  const tipo = tipoPorNombre(ruta);
  if (!LEGIBLES.includes(tipo)) {
    return { ok: false, motivo: 'Ese formato no se puede leer: subí el contrato en PDF o como foto.' };
  }

  const db = servicio();
  const { data: archivo, error } = await db.storage.from('contratos').download(ruta);
  if (error || !archivo) {
    return { ok: false, motivo: `No se pudo bajar el archivo: ${error?.message ?? 'no está'}` };
  }
  const bytes = Buffer.from(await archivo.arrayBuffer());
  /* Treinta megas de base64 son muchos tokens y casi siempre un escaneo sin
     comprimir. Mejor decirlo que gastar y fallar. */
  if (bytes.byteLength > 12 * 1024 * 1024) {
    return { ok: false, motivo: 'El archivo pesa más de 12 MB. Subí una versión más liviana.' };
  }

  const agente = await agenteDe(destinoId, 'analista');

  try {
    const corrida = await ejecutar(
      { agente, origen: 'panel', destino_id: destinoId },
      async ({ client, medidor }) => {
        const r = await client.messages.create({
          model: agente.modelo,
          /* Fijo y generoso: la respuesta es un JSON con citas, y cortarlo a la
             mitad deja un JSON roto que no se puede ni leer ni aprovechar. */
          max_tokens: 4000,
          system: INSTRUCCIONES,
          messages: [{
            role: 'user',
            content: [
              {
                type: tipo === 'application/pdf' ? 'document' : 'image',
                source: { type: 'base64', media_type: tipo, data: bytes.toString('base64') },
              } as never,
              {
                type: 'text',
                text: 'Leé este contrato o tarifario y devolvé el JSON. Dejá en null todo lo que el documento no diga.',
              },
            ],
          }],
        });
        medidor.sumar(r.usage);
        /* Con pensamiento adaptativo la respuesta trae bloques de varios tipos
           y solo los de texto llevan el JSON. */
        const texto = r.content
          .map((b) => (b.type === 'text' ? b.text : ''))
          .filter(Boolean)
          .join('\n');
        return texto;
      },
    );

    /* El modelo a veces envuelve el JSON en ```json. Se busca el objeto en vez
       de confiar en que venga limpio. */
    const crudo = corrida.resultado;
    const desde = crudo.indexOf('{');
    const hasta = crudo.lastIndexOf('}');
    if (desde < 0 || hasta <= desde) {
      return { ok: false, motivo: 'La IA no devolvió un JSON que se pueda leer.' };
    }

    let leido: TerminosDeContrato;
    try {
      leido = JSON.parse(crudo.slice(desde, hasta + 1)) as TerminosDeContrato;
    } catch {
      return { ok: false, motivo: 'La IA devolvió un JSON roto.' };
    }

    /* Un término sin cita no se acepta, aunque el modelo lo haya puesto: la
       cita es lo único que permite comprobarlo contra el documento, y sin ella
       es exactamente lo que esta función existe para evitar. */
    const conCita = (t: TerminoLeido | null | undefined): TerminoLeido | null =>
      t && typeof t.texto === 'string' && t.texto.trim()
        && typeof t.cita === 'string' && t.cita.trim()
        ? { texto: t.texto.trim(), cita: t.cita.trim() }
        : null;

    const terminos: TerminosDeContrato = {
      politica_cancelacion: conCita(leido.politica_cancelacion),
      condiciones_pago: conCita(leido.condiciones_pago),
      que_llevar: conCita(leido.que_llevar),
      vigencia_desde: typeof leido.vigencia_desde === 'string' ? leido.vigencia_desde : null,
      vigencia_hasta: typeof leido.vigencia_hasta === 'string' ? leido.vigencia_hasta : null,
      razon_social: typeof leido.razon_social === 'string' ? leido.razon_social : null,
      cedula_juridica: typeof leido.cedula_juridica === 'string' ? leido.cedula_juridica : null,
      avisos: Array.isArray(leido.avisos) ? leido.avisos.filter((x) => typeof x === 'string') : [],
    };

    await db.from('dst_contrato').update({
      terminos_ia: terminos,
      terminos_ia_en: new Date().toISOString(),
      terminos_ia_modelo: agente.modelo,
    }).eq('id', contratoId);

    return { ok: true, terminos, modelo: agente.modelo };
  } catch (fallo) {
    const porQue = fallo instanceof Error ? fallo.message : String(fallo);
    return { ok: false, motivo: `No se pudo leer el contrato: ${porQue}` };
  }
}
