import { createHmac, timingSafeEqual } from 'node:crypto';

/*
 * La firma de Svix, que es con la que firma Resend sus webhooks.
 *
 * ⚠️ ESTO VIVE APARTE A PROPÓSITO, SIN UNA SOLA DEPENDENCIA DEL PROYECTO.
 *
 * Una revisión de firma tiene dos formas de fallar y las dos son calladas:
 * rechaza todo (y no entra ningún correo, sin que nadie se entere) o acepta
 * todo (y cualquiera puede inventar un correo de un viajero, abrirle
 * conversación en el CRM y hacer que le contestemos). Ninguna de las dos avisa.
 *
 * Por eso no está dentro de la ruta: `route.ts` importa `next/server` y la
 * cadena de Supabase, y eso no se puede importar desde un script pelado. Acá,
 * sin importar nada del proyecto, `scripts/probar-firma-svix.mts` la puede
 * correr de verdad —la misma función que corre en producción— y meterle
 * firmas malas a propósito para ver que las agarra.
 *
 * Mismo motivo por el que existe `lib/correo/direcciones.ts`.
 *
 * El esquema (Svix): se firma `${id}.${timestamp}.${cuerpo}` con HMAC-SHA256.
 * La llave es el `whsec_…` SIN el prefijo, decodificado de base64. La cabecera
 * `svix-signature` trae una lista separada por espacios de `v1,<firma>`:
 * puede haber varias a la vez mientras se rota el secreto, y basta que una
 * calce.
 */

/** Cuánto se acepta de desfase de reloj. Sin ventana, una petición firmada de
 *  verdad se puede volver a mandar mañana y pasa igual. */
export const TOLERANCIA_SEGUNDOS = 5 * 60;

export type Cabeceras = {
  id: string | null;
  timestamp: string | null;
  firma: string | null;
};

export type Revision = { ok: true } | { ok: false; porque: string };

/**
 * Revisa la firma de un aviso de Svix.
 *
 * Nunca devuelve `true` por descarte: cada salida en falso dice por qué, para
 * que en los registros se pueda distinguir «me falta una cabecera» de «la
 * firma no calza», que son dos problemas muy distintos.
 *
 * @param ahora Los segundos desde la época. Es un parámetro para que la prueba
 *   pueda fijar el reloj; en producción no se pasa y usa el de verdad.
 */
export function firmaValida(
  crudo: string,
  cabeceras: Cabeceras,
  clave: string,
  ahora: number = Math.floor(Date.now() / 1000),
): Revision {
  const { id, timestamp, firma } = cabeceras;
  if (!id || !timestamp || !firma) {
    return { ok: false, porque: 'Faltan las cabeceras svix-id / svix-timestamp / svix-signature.' };
  }
  if (!clave) return { ok: false, porque: 'No hay secreto configurado.' };

  const cuando = Number(timestamp);
  if (!Number.isFinite(cuando)) return { ok: false, porque: 'El svix-timestamp no es un número.' };
  const diferencia = Math.abs(ahora - cuando);
  if (diferencia > TOLERANCIA_SEGUNDOS) {
    return { ok: false, porque: `El aviso viene de hace ${diferencia} s: fuera de la ventana.` };
  }

  const llave = Buffer.from(clave.replace(/^whsec_/, ''), 'base64');
  if (!llave.length) return { ok: false, porque: 'El secreto no es base64 utilizable.' };

  const esperada = Buffer.from(
    createHmac('sha256', llave).update(`${id}.${timestamp}.${crudo}`).digest('base64'),
  );

  for (const parte of firma.split(' ')) {
    const corte = parte.indexOf(',');
    if (corte < 0) continue;
    const version = parte.slice(0, corte);
    const valor = parte.slice(corte + 1);
    /* Solo v1. Si algún día Svix saca v2 con otro esquema, aceptar a ciegas
       cualquier versión sería aceptar una firma que no se sabe revisar. */
    if (version !== 'v1' || !valor) continue;
    const recibida = Buffer.from(valor);
    if (recibida.length === esperada.length && timingSafeEqual(recibida, esperada)) return { ok: true };
  }
  return { ok: false, porque: 'Ninguna de las firmas v1 coincide.' };
}

/**
 * Firma como firmaría Svix. Existe para la prueba: sin poder firmar bien, no
 * hay forma de saber si un rechazo es correcto o si rechaza todo.
 */
export function firmarComoSvix(crudo: string, id: string, timestamp: string, clave: string): string {
  const llave = Buffer.from(clave.replace(/^whsec_/, ''), 'base64');
  return `v1,${createHmac('sha256', llave).update(`${id}.${timestamp}.${crudo}`).digest('base64')}`;
}
