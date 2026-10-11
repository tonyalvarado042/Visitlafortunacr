import 'server-only';
import { secreto } from '@/lib/secretos';
import { servicio } from '@/lib/supabase-servidor';
import type { Destino } from '@/lib/destino';
import type { Idioma } from '@/lib/idiomas';
import { armarCorreo, type Boton } from './plantilla';

/*
 * Mandar correo. Siempre por Resend, siempre con HTML.
 *
 * La llave sale de la bóveda (se ingresa en el panel), no de una variable de
 * entorno: rotarla no debería obligar a redesplegar el sitio.
 *
 * El remitente sale de dst_canal del destino. Si el canal no está o la llave
 * falta, esto NO revienta la operación que lo llamó: devuelve el motivo y lo
 * deja escrito en el registro. Que no salga un correo no puede tumbar un
 * registro de negocio.
 */

export type Envio = { ok: boolean; id?: string; error?: string };

type Carta = {
  destino: Destino;
  idioma: Idioma;
  para: string;
  asunto: string;
  /** Qué lo disparó, para la bitácora: negocio_recibido, consulta_recibida… */
  motivo?: string;
  titulo: string;
  parrafos: string[];
  boton?: Boton;
  datos?: { rotulo: string; valor: string }[];
  nota?: string;
  /** El testigo de baja. Solo los correos de cadena lo llevan. */
  tokenBaja?: string | null;
  /** Adónde contestan si le dan "responder". */
  responder_a?: string;
};

const LLAVE = 'RESEND_API_KEY';

async function remitenteDe(destino: Destino): Promise<{ de: string } | { error: string }> {
  const { data } = await servicio()
    .from('dst_canal')
    .select('identificador, nombre_visible')
    .eq('destino_id', destino.id)
    .eq('tipo', 'email')
    .eq('esta_activo', true)
    .order('proveedor')
    .limit(1)
    .maybeSingle();

  const correo = (data?.identificador as string | undefined)?.trim()
    ?? process.env.EMAIL_REMITENTE?.trim();
  if (!correo) {
    return { error: 'No hay remitente: configurá el canal de correo en Ajustes.' };
  }

  const nombre = (data?.nombre_visible as string | undefined)?.trim() || destino.marca_nombre;
  /* El nombre va entre comillas porque una coma en la marca parte la cabecera
     en dos destinatarios y Resend lo rechaza. */
  return { de: `"${nombre.replace(/"/g, '')}" <${correo}>` };
}

/* La bitácora no puede tumbar el envío: si falla anotar, se anota el fallo de
   anotar y se sigue. */
async function anotar(
  carta: Carta, estado: 'enviado' | 'fallido', id?: string, error?: string,
): Promise<void> {
  try {
    await servicio().from('dst_correo').insert({
      destino_id: carta.destino.id,
      para: carta.para,
      asunto: carta.asunto,
      motivo: carta.motivo ?? null,
      estado,
      id_externo: id ?? null,
      error: error ?? null,
    });
  } catch (fallo) {
    console.error('bitácora de correo:', fallo instanceof Error ? fallo.message : fallo);
  }
}

export async function enviarCorreo(carta: Carta): Promise<Envio> {
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(carta.para)) {
    return { ok: false, error: 'Dirección de correo inválida.' };
  }

  const llave = await secreto(LLAVE);
  if (!llave) {
    const error = `Falta ${LLAVE}. Ingresala en Ajustes → Llaves.`;
    await anotar(carta, 'fallido', undefined, error);
    return { ok: false, error };
  }

  const remitente = await remitenteDe(carta.destino);
  if ('error' in remitente) {
    await anotar(carta, 'fallido', undefined, remitente.error);
    return { ok: false, error: remitente.error };
  }

  const { html, texto } = armarCorreo({
    destino: carta.destino,
    idioma: carta.idioma,
    titulo: carta.titulo,
    parrafos: carta.parrafos,
    boton: carta.boton,
    datos: carta.datos,
    nota: carta.nota,
    tokenBaja: carta.tokenBaja,
  });

  try {
    const respuesta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${llave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: remitente.de,
        to: [carta.para],
        subject: carta.asunto,
        html,
        text: texto,
        ...(carta.responder_a ? { reply_to: carta.responder_a } : {}),
      }),
    });

    const cuerpo = (await respuesta.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!respuesta.ok) {
      /* El motivo a la bitácora, nunca al visitante: Resend contesta cosas
         como "domain not verified" que no le dicen nada a quien se registró. */
      const error = cuerpo.message ?? `HTTP ${respuesta.status}`;
      console.error('Resend:', respuesta.status, error);
      await anotar(carta, 'fallido', undefined, error);
      return { ok: false, error };
    }
    await anotar(carta, 'enviado', cuerpo.id);
    return { ok: true, id: cuerpo.id };
  } catch (fallo) {
    const error = fallo instanceof Error ? fallo.message : String(fallo);
    console.error('Resend:', error);
    await anotar(carta, 'fallido', undefined, error);
    return { ok: false, error };
  }
}

/** ¿Se puede mandar correo ahora mismo? Para que el panel lo diga sin probar. */
export async function hayCorreo(): Promise<boolean> {
  return Boolean(await secreto(LLAVE));
}
