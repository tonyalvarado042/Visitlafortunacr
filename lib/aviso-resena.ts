import 'server-only';
import { randomBytes } from 'node:crypto';
import { servicio, hayClaveDeServicio } from '@/lib/supabase-servidor';
import { destinoActual } from '@/lib/destino';
import { correoResenaNueva } from '@/lib/correo/cartas';
import { esIdioma, type Idioma } from '@/lib/idiomas';

/*
 * Avisarle al negocio que le publicaron una reseña.
 *
 * Se dispara al PUBLICAR y no al escribir: hay moderación de por medio, y
 * avisar de algo que todavía puede rechazarse es peor que no avisar.
 *
 * A cada dueño le toca su propio enlace de un solo uso. Si son dos socios,
 * son dos tokens — pero el primero que conteste quema los dos, para que el
 * segundo no le pise la respuesta al primero (lo resuelve la función
 * `responder_con_token` en la base).
 *
 * Nada de esto revienta la moderación si falla: el correo es un extra, y una
 * reseña publicada sigue publicada aunque Resend esté caído.
 */

/** Siete días. Lo bastante para quien mira el correo el lunes. */
const DIAS = 7;

export async function avisarResenaPublicada(resenaId: string): Promise<void> {
  if (!hayClaveDeServicio()) return;

  const db = servicio();

  const { data: resena } = await db
    .from('dst_resena')
    .select('id, negocio_id, calificacion, titulo, cuerpo, idioma, estado, respuesta_negocio, viajero:dst_viajero!fk_dst_resena_viajero(nombre), negocio:dst_negocio(nombre)')
    .eq('id', resenaId)
    .maybeSingle();

  /* Solo publicadas, y solo si todavía no tiene respuesta: republicar una
     reseña vieja no tiene por qué volver a sonarle el teléfono a nadie. */
  if (!resena || resena.estado !== 'publicada' || resena.respuesta_negocio) return;

  const uno = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);
  const negocio = uno(resena.negocio as { nombre: string } | { nombre: string }[] | null)?.nombre ?? '';
  const autor = uno(resena.viajero as { nombre: string } | { nombre: string }[] | null)?.nombre ?? 'Anónimo';

  /* Los dueños de ESE negocio que quieren el aviso y no se dieron de baja. */
  const { data: enlaces } = await db
    .from('dst_negocio_comerciante')
    .select('comerciante:dst_comerciante(id, nombre, email, avisar_resenas, baja, token_baja)')
    .eq('negocio_id', resena.negocio_id);

  const duenos = (enlaces ?? [])
    .map((e) => uno(e.comerciante as never) as {
      id: string; nombre: string | null; email: string | null;
      avisar_resenas: boolean; baja: boolean; token_baja: string | null;
    } | null)
    .filter((c): c is NonNullable<typeof c> => !!c && !!c.email && c.avisar_resenas && !c.baja);

  if (!duenos.length) return;

  const destino = await destinoActual();
  const idioma: Idioma = esIdioma(resena.idioma) ? (resena.idioma as Idioma) : 'es';
  const expira = new Date(Date.now() + DIAS * 24 * 3600_000).toISOString();

  for (const dueno of duenos) {
    /* 32 bytes de verdad aleatorios. Un token adivinable es una puerta
       abierta a escribir en nombre de un negocio ajeno. */
    const token = randomBytes(32).toString('base64url');

    const { error } = await db.from('dst_resena_acceso').insert({
      token, resena_id: resena.id, comerciante_id: dueno.id, expira_en: expira,
    });
    if (error) { console.error('token de resena:', error.message); continue; }

    const envio = await correoResenaNueva({
      destino,
      idioma,
      para: dueno.email!,
      negocio,
      calificacion: Number(resena.calificacion),
      titulo: resena.titulo,
      cuerpo: resena.cuerpo ?? '',
      autor,
      enlace: `https://${destino.dominio}/negocio/responder/${token}`,
      tokenBaja: dueno.token_baja,
    });
    if (!envio.ok) console.error('aviso de resena:', envio.error);
  }
}
