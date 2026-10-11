import 'server-only';
import { servicio } from '@/lib/supabase-servidor';
import { enviarCorreo } from '@/lib/correo/enviar';
import type { Destino } from '@/lib/destino';
import type { Idioma } from '@/lib/idiomas';

/*
 * Las cadenas de nutrición.
 *
 * El motor de dst_automatizacion ya existía y sabe repetir un mensaje hasta
 * que alguien conteste. Esto es lo otro: paso 1 → paso 2 → paso 3, cada uno
 * distinto, para gente que no abrió ninguna solicitud — quien se apuntó a la
 * rifa, quien desbloqueó el teléfono de un negocio, el dueño que no pagó.
 *
 * Lo que decide QUÉ sale está en la base (`cadenas_pendientes`). Aquí solo
 * se arma el correo y se manda. Eso es a propósito: el botón "ver qué
 * saldría" del panel llama a la MISMA consulta que el cron. Si la prueba
 * mirara otra cosa que el envío, no probaría nada.
 *
 * ⚠️ Los días de cada paso se cuentan desde que la persona se inscribió, no
 * desde el correo anterior. En el CRM de Tony esa confusión hizo que una
 * cadena escrita 2·4·7·11·16 corriera en 40 días.
 */

export type Pendiente = {
  inscrito_id: string;
  paso_id: string;
  cadena_clave: string;
  cadena_nombre: string;
  orden: number;
  dias_desde_alta: number;
  idioma: Idioma;
  para: string;
  nombre: string | null;
  asunto_es: string;
  cuerpo_es: string;
  asunto_en: string | null;
  cuerpo_en: string | null;
  boton_texto_es: string | null;
  boton_texto_en: string | null;
  boton_ruta: string | null;
  token_baja: string;
  es_comerciante: boolean;
};

export type Resumen = {
  barridos: number;
  pendientes: number;
  enviados: number;
  fallidos: number;
  detalles: string[];
};

/** El texto del paso en el idioma de la persona, con respaldo al español. */
function enSuIdioma(p: Pendiente) {
  /* Solo hay español e inglés escritos. Un francés recibe el español antes
     que nada: mejor un correo que entiende a medias que ninguno. El día que
     se traduzcan los pasos, esto no cambia. */
  const ingles = p.idioma === 'en' && p.asunto_en && p.cuerpo_en;
  return {
    asunto: ingles ? p.asunto_en! : p.asunto_es,
    cuerpo: ingles ? p.cuerpo_en! : p.cuerpo_es,
    botonTexto: ingles ? (p.boton_texto_en ?? p.boton_texto_es) : p.boton_texto_es,
    idioma: (ingles ? 'en' : 'es') as Idioma,
  };
}

/**
 * El saludo.
 *
 * Si no hay nombre NO sale "Hola ," ni una coma suelta: se omite el saludo
 * entero. Es el mismo detalle que Tony corrigió en el CRM.
 */
function saludo(nombre: string | null, idioma: Idioma): string[] {
  const limpio = nombre?.trim().split(/\s+/)[0];
  if (!limpio) return [];
  return [idioma === 'en' ? `Hi ${limpio},` : `Hola ${limpio},`];
}

/** La dirección del botón: ruta del paso + idioma de la persona. */
function urlDelBoton(p: Pendiente, destino: Destino, idioma: Idioma): string {
  const ruta = (p.boton_ruta ?? '').trim();
  const base = `https://${destino.dominio}`;
  if (!ruta) return `${base}/${idioma}`;
  if (ruta.startsWith('#')) return `${base}/${idioma}${ruta}`;
  /* El panel del comerciante vive fuera de /<idioma>/: es /negocio. */
  if (ruta.startsWith('/negocio')) return `${base}${ruta}`;
  return `${base}/${idioma}${ruta}`;
}

/** Lo que saldría, sin mandar nada. Es lo que mira el botón de prueba. */
export async function cadenasPendientes(destino: Destino, limite = 50): Promise<Pendiente[]> {
  const { data, error } = await servicio().rpc('cadenas_pendientes', {
    p_destino_id: destino.id,
    p_limite: limite,
  });
  if (error) throw new Error(`cadenas_pendientes: ${error.message}`);
  return (data ?? []) as Pendiente[];
}

/** Inscribe a los que toca y saca a los que ya no corresponden. */
export async function barrerCadenas(destino: Destino): Promise<number> {
  const { data, error } = await servicio().rpc('barrer_cadenas', { p_destino_id: destino.id });
  if (error) throw new Error(`barrer_cadenas: ${error.message}`);
  return (data as number | null) ?? 0;
}

/**
 * Correr las cadenas de un destino.
 *
 * `soloPrueba` hace exactamente el mismo recorrido pero sin mandar: devuelve
 * a quién y qué le tocaría. Es el "ver qué saldría" del panel.
 */
export async function correrCadenas(
  destino: Destino,
  opciones: { limite?: number; soloPrueba?: boolean } = {},
): Promise<Resumen> {
  const db = servicio();
  const resumen: Resumen = { barridos: 0, pendientes: 0, enviados: 0, fallidos: 0, detalles: [] };

  resumen.barridos = await barrerCadenas(destino);

  const pendientes = await cadenasPendientes(destino, opciones.limite ?? 50);
  resumen.pendientes = pendientes.length;

  for (const p of pendientes) {
    const { asunto, cuerpo, botonTexto, idioma } = enSuIdioma(p);
    const parrafos = [...saludo(p.nombre, idioma), ...cuerpo.split('\n\n').map((x) => x.trim()).filter(Boolean)];

    if (opciones.soloPrueba) {
      resumen.detalles.push(`${p.cadena_clave} paso ${p.orden} → ${p.para} · ${asunto}`);
      continue;
    }

    const envio = await enviarCorreo({
      destino,
      idioma,
      para: p.para,
      asunto,
      motivo: `cadena:${p.cadena_clave}:${p.orden}`,
      titulo: asunto,
      parrafos,
      boton: botonTexto ? { texto: botonTexto, url: urlDelBoton(p, destino, idioma) } : undefined,
      /* El testigo es lo que convierte esto en nutrición y no en spam: todo
         correo de cadena lleva su puerta de salida. */
      tokenBaja: p.token_baja,
    });

    /* Se anota SIEMPRE, salga o no. Un fallo no adelanta el paso: la base lo
       vuelve a ofrecer en seis horas, hasta tres intentos, y después se
       rinde. Sin ese límite un fallo de Resend mandaría el mismo correo cada
       hora; sin el reintento, un minuto de red le borraría ese correo a esa
       persona para siempre y en silencio. */
    const { error } = await db.rpc('anotar_envio_de_cadena', {
      p_inscrito: p.inscrito_id,
      p_paso: p.paso_id,
      p_estado: envio.ok ? 'enviado' : 'fallido',
      p_para: p.para,
      p_asunto: asunto,
      p_error: envio.error ?? null,
    });
    if (error) resumen.detalles.push(`anotar ${p.inscrito_id}: ${error.message}`);

    if (envio.ok) resumen.enviados += 1;
    else {
      resumen.fallidos += 1;
      resumen.detalles.push(`${p.para}: ${envio.error ?? 'sin motivo'}`);
    }
  }

  return resumen;
}
