'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { contextoPanel } from '@/lib/admin/contexto';
import { babosaDe } from '@/lib/admin/babosa';

const esUuid = (v: unknown) => /^[0-9a-f-]{36}$/i.test(String(v ?? ''));
const texto = (d: FormData, k: string) => String(d.get(k) ?? '').trim();
const numero = (d: FormData, k: string) => { const v = texto(d, k); return v === '' ? null : Number(v); };

export async function crearTour(datos: FormData) {
  const { db, destino } = await contextoPanel('tours');
  const nombre = texto(datos, 'nombre');
  if (!nombre) return;
  let babosa = babosaDe(nombre) || 'tour';
  const { data: repetido } = await db.from('dst_tour').select('id').eq('destino_id', destino.id).eq('babosa', babosa).maybeSingle();
  if (repetido) babosa = `${babosa}-${Math.random().toString(36).slice(2, 6)}`;
  const { data, error } = await db.from('dst_tour').insert({
    destino_id: destino.id, nombre, babosa,
    negocio_id: esUuid(texto(datos, 'negocio_id')) ? texto(datos, 'negocio_id') : null,
    categoria_id: esUuid(texto(datos, 'categoria_id')) ? texto(datos, 'categoria_id') : null,
    precio_adulto_usd: numero(datos, 'precio_adulto_usd') ?? 0,
    comision_pct: numero(datos, 'comision_pct') ?? destino.comision_por_defecto ?? null,
    estado: 'borrador',
  }).select('id').single();
  if (error || !data) { console.error('crearTour:', error?.message); return; }
  revalidatePath('/admin/tours');
  redirect(`/admin/tours/${data.id}`);
}

export async function editarTour(datos: FormData) {
  const { db, destino } = await contextoPanel('tours');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;
  const { data: antes } = await db.from('dst_tour').select('estado, publicado_en').eq('id', id).eq('destino_id', destino.id).maybeSingle();
  if (!antes) return;
  const estado = texto(datos, 'estado');
  const { error } = await db.from('dst_tour').update({
    nombre: texto(datos, 'nombre') || undefined,
    negocio_id: esUuid(texto(datos, 'negocio_id')) ? texto(datos, 'negocio_id') : null,
    categoria_id: esUuid(texto(datos, 'categoria_id')) ? texto(datos, 'categoria_id') : null,
    /* El contrato es lo que vuelve vendible la tour. Si el formulario no trae
       el campo —porque la tour todavia no tiene operador y el selector no se
       dibujo— se deja como estaba: `undefined` no toca la columna, y un null
       ahi le quitaria la venta a una tour por no haber mostrado un campo. */
    contrato_id: datos.has('contrato_id')
      ? (esUuid(texto(datos, 'contrato_id')) ? texto(datos, 'contrato_id') : null)
      : undefined,
    resumen: texto(datos, 'resumen') || null,
    descripcion: texto(datos, 'descripcion') || null,
    incluye: texto(datos, 'incluye') || null,
    no_incluye: texto(datos, 'no_incluye') || null,
    que_llevar: texto(datos, 'que_llevar') || null,
    duracion_horas: numero(datos, 'duracion_horas'),
    hora_inicio: texto(datos, 'hora_inicio') || null,
    dificultad: texto(datos, 'dificultad') || null,
    edad_minima: numero(datos, 'edad_minima'),
    cupo_maximo: numero(datos, 'cupo_maximo'),
    recoge_en_hotel: texto(datos, 'recoge_en_hotel') === '1',
    idiomas_guia: texto(datos, 'idiomas_guia').split(',').map((i) => i.trim().toLowerCase()).filter(Boolean),
    precio_adulto_usd: numero(datos, 'precio_adulto_usd') ?? 0,
    precio_nino_usd: numero(datos, 'precio_nino_usd'),
    precio_neto_usd: numero(datos, 'precio_neto_usd'),
    comision_pct: numero(datos, 'comision_pct'),
    cancelacion_libre_horas: numero(datos, 'cancelacion_libre_horas'),
    imagen_url: texto(datos, 'imagen_url') || null,
    precio_nota: texto(datos, 'precio_nota') || null,
    /* El video del tour. Hasta noviembre de 2026 solo los negocios tenian uno;
       la pagina del tour ahora lo muestra con el mismo componente. */
    video_url: texto(datos, 'video_url') || null,
    video_portada_url: texto(datos, 'video_portada_url') || null,
    es_destacado: texto(datos, 'es_destacado') === '1',
    estado: ['borrador', 'pendiente', 'publicado', 'archivado'].includes(estado) ? estado : antes.estado,
    publicado_en: estado === 'publicado' && !antes.publicado_en ? new Date().toISOString() : antes.publicado_en,
  }).eq('id', id);
  if (error) console.error('editarTour:', error.message);
  revalidatePath(`/admin/tours/${id}`);
  revalidatePath('/admin/tours');
}

/* ---- Las fotos del tour ---------------------------------------------------
 *
 * Calco de las de `negocios/acciones.ts`, a propósito. Un tour tenía UNA foto
 * (`dst_tour.imagen_url`) y nada más, cuando el tour es justo lo que se vende
 * —y lo único que publica un operador—. Quien está decidiendo si paga $99 por
 * una clase de cocina quiere ver más de una.
 *
 * Suben con la sesión del usuario y no con la clave de servicio: la política
 * de storage mira el PRIMER segmento de la ruta —la babosa del destino— y con
 * eso decide. Por eso la ruta es <destino>/<negocio>/tours/<archivo>, la misma
 * carpeta donde ya subía el dueño desde su portal.
 */

const BUCKET_TOURS = 'negocios';
const ANCHO_MAX_TOUR = 1600;

/**
 * El tour, si es de este destino. Devuelve también la babosa del operador,
 * que es la que arma la carpeta donde van las fotos.
 */
async function tourConOperador(
  db: Awaited<ReturnType<typeof contextoPanel>>['db'],
  destinoId: string,
  tourId: string,
) {
  const { data: t } = await db.from('dst_tour')
    .select('id, nombre, negocio_id').eq('id', tourId).eq('destino_id', destinoId).maybeSingle();
  if (!t?.negocio_id) return null;
  const { data: n } = await db.from('dst_negocio')
    .select('babosa').eq('id', t.negocio_id).maybeSingle();
  if (!n?.babosa) return null;
  return { id: t.id as string, nombre: t.nombre as string, operadorBabosa: n.babosa as string };
}

function refrescarTour(id: string) {
  revalidatePath(`/admin/tours/${id}`);
  revalidatePath('/admin/tours');
}

/** Sube UNA O VARIAS de un saque. No se corta en la primera que falle. */
export async function subirFotoTour(datos: FormData) {
  const { db, destino } = await contextoPanel('tours');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;

  const archivos = datos.getAll('archivo').filter((a): a is File => a instanceof File && a.size > 0);
  if (!archivos.length) return;

  const t = await tourConOperador(db, destino.id, id);
  /* Sin operador no hay carpeta donde ponerlas: la ruta se arma con su babosa.
     La pantalla ya lo dice y no ofrece el botón, pero un formulario se puede
     mandar a mano. */
  if (!t) return;

  const credito = texto(datos, 'credito') || null;
  const licencia = texto(datos, 'licencia') || null;
  const fuente = texto(datos, 'fuente_url') || null;
  /* Una foto ajena tiene que decir de quién es y bajo qué licencia. */
  if (fuente && (!credito || !licencia)) return;

  const alternativo = texto(datos, 'texto_alternativo') || t.nombre;

  /* El contador arranca del total que YA hay: si no, las de la misma tanda
     nacerían todas con el mismo `orden` y la galería las mostraría en
     cualquier lado. */
  const { count } = await db.from('dst_tour_foto')
    .select('id', { count: 'exact', head: true }).eq('tour_id', id);
  let siguiente = count ?? 0;

  const sharp = (await import('sharp')).default;

  for (const archivo of archivos) {
    try {
      const webp = await sharp(Buffer.from(await archivo.arrayBuffer()))
        .rotate()
        .resize({ width: ANCHO_MAX_TOUR, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();

      const base = archivo.name.replace(/\.[^.]+$/, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').slice(0, 60) || 'foto';
      const ruta = `${destino.babosa}/${t.operadorBabosa}/tours/${base}-${Date.now().toString(36)}-${siguiente}.webp`;

      const { error: eSubida } = await db.storage.from(BUCKET_TOURS)
        .upload(ruta, webp, { contentType: 'image/webp' });
      if (eSubida) throw new Error(eSubida.message);

      const { data: publica } = db.storage.from(BUCKET_TOURS).getPublicUrl(ruta);
      const { error } = await db.from('dst_tour_foto').insert({
        tour_id: id,
        url: publica.publicUrl,
        orden: siguiente,
        es_portada: siguiente === 0,
        credito, licencia, fuente_url: fuente,
        texto_alternativo_es: alternativo,
        texto_alternativo_en: alternativo,
      });
      if (error) throw new Error(error.message);

      siguiente += 1;
    } catch (fallo) {
      /* La que falle no se lleva a las demás. */
      console.error('subirFotoTour:', archivo.name, fallo instanceof Error ? fallo.message : fallo);
    }
  }

  refrescarTour(id);
}

export async function marcarPortadaTour(datos: FormData) {
  const { db, destino } = await contextoPanel('tours');
  const id = texto(datos, 'id');
  const fotoId = texto(datos, 'foto_id');
  if (!esUuid(id) || !esUuid(fotoId)) return;
  if (!(await tourConOperador(db, destino.id, id))) return;

  /* Primero se apaga la anterior: `uq_dst_tour_foto_portada` no deja dos. */
  await db.from('dst_tour_foto').update({ es_portada: false }).eq('tour_id', id).eq('es_portada', true);
  const { error } = await db.from('dst_tour_foto').update({ es_portada: true }).eq('id', fotoId).eq('tour_id', id);
  if (error) console.error('marcarPortadaTour:', error.message);
  refrescarTour(id);
}

export async function moverFotoTour(datos: FormData) {
  const { db, destino } = await contextoPanel('tours');
  const id = texto(datos, 'id');
  /* El id y el paso viajan JUNTOS en el value del botón: un botón manda un
     solo par nombre/valor, así que un campo `paso` suelto valdría lo mismo
     para subir que para bajar. */
  const [fotoId, pasoTexto] = texto(datos, 'foto_mover').split('|');
  const paso = Number(pasoTexto);
  if (!esUuid(id) || !esUuid(fotoId) || (paso !== 1 && paso !== -1)) return;
  if (!(await tourConOperador(db, destino.id, id))) return;

  const { data: todas } = await db.from('dst_tour_foto')
    .select('id, orden').eq('tour_id', id).order('orden');
  const lista = todas ?? [];
  const i = lista.findIndex((f) => f.id === fotoId);
  if (i < 0) return;
  const j = i + paso;
  if (j < 0 || j >= lista.length) return;

  /* Se reescriben los dos órdenes y no se intercambian: si dos filas quedaron
     con el mismo `orden` —y pueden— intercambiar no mueve nada y el botón
     parece roto. */
  await db.from('dst_tour_foto').update({ orden: j }).eq('id', lista[i].id).eq('tour_id', id);
  await db.from('dst_tour_foto').update({ orden: i }).eq('id', lista[j].id).eq('tour_id', id);
  refrescarTour(id);
}

export async function borrarFotoTour(datos: FormData) {
  const { db, destino } = await contextoPanel('tours');
  const id = texto(datos, 'id');
  const fotoId = texto(datos, 'foto_id');
  if (!esUuid(id) || !esUuid(fotoId)) return;
  if (!(await tourConOperador(db, destino.id, id))) return;

  const { data: foto } = await db.from('dst_tour_foto')
    .select('id, url').eq('id', fotoId).eq('tour_id', id).maybeSingle();
  if (!foto) return;

  /* Se borra también del almacén. Dejarla ahí es pagar por una foto que ya
     nadie muestra, y a los seis meses nadie sabe cuáles sobran. */
  const marca = `/object/public/${BUCKET_TOURS}/`;
  const corte = (foto.url as string).indexOf(marca);
  if (corte !== -1) await db.storage.from(BUCKET_TOURS).remove([(foto.url as string).slice(corte + marca.length)]);

  const { error } = await db.from('dst_tour_foto').delete().eq('id', fotoId).eq('tour_id', id);
  if (error) console.error('borrarFotoTour:', error.message);
  refrescarTour(id);
}
