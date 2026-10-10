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
  titulo: string;
  parrafos: string[];
  boton?: Boton;
  datos?: { rotulo: string; valor: string }[];
  nota?: string;
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

export async function enviarCorreo(carta: Carta): Promise<Envio> {
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(carta.para)) {
    return { ok: false, error: 'Dirección de correo inválida.' };
  }

  const llave = await secreto(LLAVE);
  if (!llave) {
    return { ok: false, error: `Falta ${LLAVE}. Ingresala en Ajustes → Llaves.` };
  }

  const remitente = await remitenteDe(carta.destino);
  if ('error' in remitente) return { ok: false, error: remitente.error };

  const { html, texto } = armarCorreo({
    destino: carta.destino,
    idioma: carta.idioma,
    titulo: carta.titulo,
    parrafos: carta.parrafos,
    boton: carta.boton,
    datos: carta.datos,
    nota: carta.nota,
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
      /* El motivo al registro, nunca al visitante: Resend contesta cosas como
         "domain not verified" que no le dicen nada a quien se registró. */
      console.error('Resend:', respuesta.status, cuerpo.message);
      return { ok: false, error: cuerpo.message ?? `HTTP ${respuesta.status}` };
    }
    return { ok: true, id: cuerpo.id };
  } catch (fallo) {
    const error = fallo instanceof Error ? fallo.message : String(fallo);
    console.error('Resend:', error);
    return { ok: false, error };
  }
}

/** ¿Se puede mandar correo ahora mismo? Para que el panel lo diga sin probar. */
export async function hayCorreo(): Promise<boolean> {
  return Boolean(await secreto(LLAVE));
}
