import 'server-only';
import { servicio } from '@/lib/supabase-servidor';
import { buscarPlaceId, detalleDeLugar, hayClaveDePlaces } from './google';

export { hayClaveDePlaces } from './google';

/*
 * Traer las opiniones de afuera sin que nadie las pegue a mano en Supabase.
 *
 * Una sola función hace el trabajo y la llaman tres bocas: el botón de la
 * ficha en el panel, el botón de "traer todas" del listado y el cron diario.
 * Escribe con la clave de servicio, como el resto del backend: esto no lo
 * dispara el sitio público.
 *
 * Qué deja en la base, por negocio:
 *   - dst_negocio.google_place_id, si estaba vacío (Google permite guardarlo
 *     para siempre; es la única parte de su respuesta que no vence).
 *   - dst_negocio.latitud/longitud, sitio_web, telefono y direccion, solo si
 *     faltaban. Lo que ya escribió una persona no se pisa.
 *   - dst_resena_externa: la nota y el conteo, con enlace a la ficha original.
 *   - dst_resena_externa_extracto: hasta cinco reseñas con autor y enlace.
 *
 * Cada pasada reemplaza los extractos anteriores en vez de acumularlos: lo que
 * se muestra tiene que ser lo que Google muestra hoy, no un archivo histórico
 * que sus términos no permiten guardar.
 */

/** 30 días: el máximo que los términos de Google permiten cachear su contenido. */
const DIAS_DE_VIDA = 30;

export type ResultadoNegocio = {
  negocio_id: string;
  nombre: string;
  ok: boolean;
  place_id?: string | null;
  calificacion?: number | null;
  total_resenas?: number | null;
  extractos?: number;
  motivo?: string;
};

type FilaNegocio = {
  id: string;
  nombre: string;
  direccion: string | null;
  sitio_web: string | null;
  telefono: string | null;
  latitud: number | null;
  longitud: number | null;
  google_place_id: string | null;
  destino: { nombre: string; latitud: number | null; longitud: number | null; idioma_principal: string }
         | { nombre: string; latitud: number | null; longitud: number | null; idioma_principal: string }[]
         | null;
};

const uno = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);

async function refrescarFila(fila: FilaNegocio): Promise<ResultadoNegocio> {
  const db = servicio();
  const destino = uno(fila.destino);
  const idioma = destino?.idioma_principal ?? 'es';
  const base: ResultadoNegocio = { negocio_id: fila.id, nombre: fila.nombre, ok: false };

  // 1. El place_id. Si no lo tenemos, se busca por nombre y dirección.
  let placeId = fila.google_place_id;
  if (!placeId) {
    placeId = await buscarPlaceId({
      nombre: fila.nombre,
      direccion: fila.direccion,
      cerca_de: destino?.nombre,
      latitud: fila.latitud ?? destino?.latitud ?? null,
      longitud: fila.longitud ?? destino?.longitud ?? null,
      idioma,
    });
    if (!placeId) return { ...base, motivo: 'Google no encontró este lugar.' };

    // El place_id es único en la tabla: si ya lo tiene otro negocio, son la
    // misma ficha duplicada y eso lo arregla una persona, no este proceso.
    const { error } = await db.from('dst_negocio').update({ google_place_id: placeId }).eq('id', fila.id);
    if (error) return { ...base, motivo: `Ese place_id ya está en otro negocio (${error.message}).` };
  }

  // 2. La ficha de Google.
  const lugar = await detalleDeLugar(placeId, idioma);

  // 3. Contacto y coordenadas, SOLO lo que falte. Lo que escribió una persona
  // no se pisa: Google se equivoca, y una ficha corregida a mano vale más que
  // el dato de vuelta.
  const faltantes: Record<string, unknown> = {};
  if (fila.latitud == null && lugar.latitud != null) faltantes.latitud = lugar.latitud;
  if (fila.longitud == null && lugar.longitud != null) faltantes.longitud = lugar.longitud;
  if (!fila.sitio_web && lugar.sitio_web) faltantes.sitio_web = lugar.sitio_web;
  if (!fila.telefono && lugar.telefono) faltantes.telefono = lugar.telefono;
  if (!fila.direccion && lugar.direccion) faltantes.direccion = lugar.direccion;
  if (Object.keys(faltantes).length) {
    await db.from('dst_negocio').update(faltantes).eq('id', fila.id);
  }

  // 4. La nota agregada. Una fila por negocio y plataforma.
  const ahora = new Date();
  const expira = new Date(ahora.getTime() + DIAS_DE_VIDA * 24 * 60 * 60 * 1000);
  const { data: agregado, error: falloAgregado } = await db
    .from('dst_resena_externa')
    .upsert(
      {
        negocio_id: fila.id,
        plataforma: 'google',
        calificacion: lugar.calificacion,
        total_resenas: lugar.total_resenas,
        url_fuente: lugar.url_fuente,
        obtenida_en: ahora.toISOString(),
        expira_en: expira.toISOString(),
      },
      { onConflict: 'negocio_id,plataforma' }
    )
    .select('id')
    .single();

  if (falloAgregado || !agregado) {
    return { ...base, place_id: placeId, motivo: falloAgregado?.message ?? 'No se pudo guardar la nota.' };
  }

  // 5. Los extractos: fuera los viejos, dentro los de hoy.
  await db.from('dst_resena_externa_extracto').delete().eq('resena_externa_id', agregado.id);
  if (lugar.extractos.length) {
    const { error } = await db.from('dst_resena_externa_extracto').insert(
      lugar.extractos.map((e) => ({ ...e, resena_externa_id: agregado.id }))
    );
    if (error) return { ...base, place_id: placeId, motivo: error.message };
  }

  return {
    negocio_id: fila.id,
    nombre: fila.nombre,
    ok: true,
    place_id: placeId,
    calificacion: lugar.calificacion,
    total_resenas: lugar.total_resenas,
    extractos: lugar.extractos.length,
  };
}

const COLUMNAS =
  'id, nombre, direccion, sitio_web, telefono, latitud, longitud, google_place_id, destino:dst_destino(nombre, latitud, longitud, idioma_principal)';

/** Un negocio, ahora. Es lo que dispara el botón de la ficha en el panel. */
export async function refrescarExternasDeNegocio(negocioId: string): Promise<ResultadoNegocio> {
  if (!hayClaveDePlaces()) {
    return { negocio_id: negocioId, nombre: '', ok: false, motivo: 'Falta GOOGLE_PLACES_API_KEY en el entorno.' };
  }
  const { data, error } = await servicio().from('dst_negocio').select(COLUMNAS).eq('id', negocioId).maybeSingle();
  if (error || !data) {
    return { negocio_id: negocioId, nombre: '', ok: false, motivo: error?.message ?? 'No existe ese negocio.' };
  }
  try {
    return await refrescarFila(data as unknown as FilaNegocio);
  } catch (fallo) {
    return {
      negocio_id: negocioId,
      nombre: (data as { nombre: string }).nombre,
      ok: false,
      motivo: fallo instanceof Error ? fallo.message : 'Falló la llamada a Google.',
    };
  }
}

/**
 * Los que nunca se trajeron y los que están por vencer. Lo llama el cron y el
 * botón de "traer todas" del listado. El límite existe porque cada negocio es
 * una llamada facturada: sin tope, un clic distraído cuesta dinero.
 */
export async function refrescarExternasPendientes(opciones?: {
  destino_id?: string | null;
  limite?: number;
  dias_de_margen?: number;
}): Promise<{ intentados: number; ok: number; fallos: number; detalle: ResultadoNegocio[] }> {
  const vacio = { intentados: 0, ok: 0, fallos: 0, detalle: [] as ResultadoNegocio[] };
  if (!hayClaveDePlaces()) return vacio;

  const db = servicio();
  const limite = Math.min(Math.max(opciones?.limite ?? 25, 1), 200);
  const margen = new Date(Date.now() + (opciones?.dias_de_margen ?? 3) * 24 * 60 * 60 * 1000).toISOString();

  let consulta = db
    .from('dst_negocio')
    .select(`${COLUMNAS}, externas:dst_resena_externa(plataforma, expira_en)`)
    .eq('estado_publicacion', 'publicado')
    .eq('esta_cerrado', false);
  if (opciones?.destino_id) consulta = consulta.eq('destino_id', opciones.destino_id);

  const { data, error } = await consulta.limit(400);
  if (error || !data) return vacio;

  // Se filtra aquí y no en SQL porque "no tiene fila de Google" y "la tiene
  // pero vence pronto" son dos condiciones sobre una tabla embebida, y en
  // PostgREST eso sale más enredado que legible.
  const candidatos = (data as unknown as (FilaNegocio & { externas: { plataforma: string; expira_en: string }[] })[])
    .filter((n) => {
      const google = (n.externas ?? []).find((e) => e.plataforma === 'google');
      return !google || google.expira_en < margen;
    })
    .slice(0, limite);

  const detalle: ResultadoNegocio[] = [];
  for (const negocio of candidatos) {
    try {
      detalle.push(await refrescarFila(negocio));
    } catch (fallo) {
      detalle.push({
        negocio_id: negocio.id,
        nombre: negocio.nombre,
        ok: false,
        motivo: fallo instanceof Error ? fallo.message : 'Falló la llamada a Google.',
      });
    }
  }

  return {
    intentados: detalle.length,
    ok: detalle.filter((r) => r.ok).length,
    fallos: detalle.filter((r) => !r.ok).length,
    detalle,
  };
}
