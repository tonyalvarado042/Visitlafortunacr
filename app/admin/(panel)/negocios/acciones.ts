'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { contextoPanel } from '@/lib/admin/contexto';
import { babosaDe } from '@/lib/admin/babosa';
import { refrescarExternasDeNegocio, refrescarExternasPendientes } from '@/lib/externas';

const esUuid = (v: unknown) => /^[0-9a-f-]{36}$/i.test(String(v ?? ''));
const texto = (d: FormData, k: string) => String(d.get(k) ?? '').trim();
const numero = (d: FormData, k: string) => { const v = texto(d, k); return v === '' ? null : Number(v); };
const marca = (d: FormData, k: string) => texto(d, k) === '1';

function refrescar(id?: string) {
  if (id) revalidatePath(`/admin/negocios/${id}`);
  revalidatePath('/admin/negocios');
}

export async function crearNegocio(datos: FormData) {
  const { db, destino } = await contextoPanel('negocios');
  const nombre = texto(datos, 'nombre');
  const categoriaId = texto(datos, 'categoria_id');
  if (!nombre || !esUuid(categoriaId)) return;
  let babosa = babosaDe(nombre) || 'negocio';
  const { data: repetido } = await db.from('dst_negocio').select('id').eq('destino_id', destino.id).eq('babosa', babosa).maybeSingle();
  if (repetido) babosa = `${babosa}-${Math.random().toString(36).slice(2, 6)}`;

  const { data, error } = await db.from('dst_negocio').insert({
    destino_id: destino.id, categoria_id: categoriaId, nombre, babosa,
    estado_publicacion: 'borrador', estado_verificacion: 'pendiente', fuente_dato: 'equipo',
  }).select('id').single();
  if (error || !data) return;

  // Cada idioma del destino apunta a la misma babosa hasta que alguien la traduzca.
  await db.from('dst_ruta').insert(destino.idiomas.map((idioma) => ({ destino_id: destino.id, entidad: 'negocio', entidad_id: data.id, idioma, babosa })));
  refrescar();
  redirect(`/admin/negocios/${data.id}`);
}

export async function editarNegocio(datos: FormData) {
  const { db, destino } = await contextoPanel('negocios');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;
  const { data: antes } = await db.from('dst_negocio').select('estado_publicacion, publicado_en, estado_verificacion, verificado_en').eq('id', id).eq('destino_id', destino.id).maybeSingle();
  if (!antes) return;

  const publicacion = texto(datos, 'estado_publicacion');
  const verificacion = texto(datos, 'estado_verificacion');
  const membresia = texto(datos, 'membresia');
  const telefono = (k: string) => { const v = texto(datos, k).replace(/[\s\-().]/g, ''); return v ? (v.startsWith('+') ? v : `+${v}`) : null; };

  const { error } = await db.from('dst_negocio').update({
    nombre: texto(datos, 'nombre') || undefined,
    categoria_id: esUuid(texto(datos, 'categoria_id')) ? texto(datos, 'categoria_id') : undefined,
    resumen: texto(datos, 'resumen') || null,
    descripcion: texto(datos, 'descripcion') || null,
    email: texto(datos, 'email').toLowerCase() || null,
    telefono: telefono('telefono'),
    telefono_whatsapp: telefono('telefono_whatsapp'),
    sitio_web: texto(datos, 'sitio_web') || null,
    direccion: texto(datos, 'direccion') || null,
    como_llegar: texto(datos, 'como_llegar') || null,
    latitud: numero(datos, 'latitud'),
    longitud: numero(datos, 'longitud'),
    rango_precio: ['economico', 'moderado', 'alto', 'lujo'].includes(texto(datos, 'rango_precio')) ? texto(datos, 'rango_precio') : null,
    precio_desde_usd: numero(datos, 'precio_desde_usd'),
    membresia: ['gratis', 'pro', 'destacado'].includes(membresia) ? membresia : 'gratis',
    membresia_hasta: membresia !== 'gratis' ? (texto(datos, 'membresia_hasta') || new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10)) : null,
    comision_pct: numero(datos, 'comision_pct'),
    contacto_comercial: texto(datos, 'contacto_comercial') || null,
    email_reservas: texto(datos, 'email_reservas').toLowerCase() || null,
    notas_internas: texto(datos, 'notas_internas') || null,
    google_place_id: texto(datos, 'google_place_id') || null,
    logo_url: texto(datos, 'logo_url') || null,
    estado_publicacion: ['borrador', 'pendiente', 'publicado', 'archivado'].includes(publicacion) ? publicacion : antes.estado_publicacion,
    publicado_en: publicacion === 'publicado' && !antes.publicado_en ? new Date().toISOString() : antes.publicado_en,
    estado_verificacion: ['pendiente', 'parcial', 'verificado', 'reclamado'].includes(verificacion) ? verificacion : antes.estado_verificacion,
    verificado_en: verificacion === 'verificado' && antes.estado_verificacion !== 'verificado' ? new Date().toISOString() : antes.verificado_en,
    es_destacado: marca(datos, 'es_destacado'),
    es_casa: marca(datos, 'es_casa'),
    esta_cerrado: marca(datos, 'esta_cerrado'),
  }).eq('id', id);
  if (error) console.error('editarNegocio:', error.message);
  refrescar(id);
}

export async function traducirCampo(datos: FormData) {
  const { db } = await contextoPanel('negocios');
  const entidad = texto(datos, 'entidad');
  const entidadId = texto(datos, 'entidad_id');
  const campo = texto(datos, 'campo');
  const idioma = texto(datos, 'idioma');
  const valor = texto(datos, 'texto');
  if (!esUuid(entidadId) || !['negocio', 'tour', 'guia'].includes(entidad) || !campo || !idioma) return;
  if (!valor) {
    await db.from('dst_traduccion').delete().eq('entidad', entidad).eq('entidad_id', entidadId).eq('campo', campo).eq('idioma', idioma);
  } else {
    await db.from('dst_traduccion').upsert(
      { entidad, entidad_id: entidadId, campo, idioma, texto: valor, origen: 'equipo', esta_revisada: true },
      { onConflict: 'entidad,entidad_id,campo,idioma' }
    );
  }
  revalidatePath(`/admin/${entidad === 'negocio' ? 'negocios' : entidad === 'tour' ? 'tours' : 'guias'}/${entidadId}`);
}

/* ---- Fotos ---- */

const BUCKET = 'negocios';
const ANCHO_MAX = 1600;

/**
 * Sube una foto a Storage y la anota en dst_negocio_foto.
 *
 * Va con la sesión del usuario, no con la clave de servicio: las políticas de
 * la migración 22 miran el primer segmento de la ruta —la babosa del destino—
 * y con eso deciden si esta persona puede escribir ahí. Por eso la ruta es
 * <destino>/<negocio>/<archivo> y no al revés.
 *
 * Se redimensiona y se pasa a webp antes de subir: el bucket corta en 10 MB y
 * una foto de teléfono los pasa sin esfuerzo.
 */
export async function subirFoto(datos: FormData) {
  const { db, destino } = await contextoPanel('negocios');
  const id = texto(datos, 'id');
  const archivo = datos.get('archivo');
  if (!esUuid(id) || !(archivo instanceof File) || !archivo.size) return;

  const { data: negocio } = await db.from('dst_negocio')
    .select('id, babosa, nombre').eq('id', id).eq('destino_id', destino.id).maybeSingle();
  if (!negocio) return;

  // Una foto que no es propia tiene que decir de quién es y bajo qué licencia:
  // es lo que exige el check de la migración 22, y la razón por la que existe.
  const credito = texto(datos, 'credito') || null;
  const licencia = texto(datos, 'licencia') || null;
  const fuente = texto(datos, 'fuente_url') || null;
  if (fuente && (!credito || !licencia)) return;

  let webp: Buffer;
  try {
    const sharp = (await import('sharp')).default;
    webp = await sharp(Buffer.from(await archivo.arrayBuffer()))
      .rotate()
      .resize({ width: ANCHO_MAX, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch (e) {
    console.error('subirFoto: no se pudo procesar la imagen', e);
    return;
  }

  const base = archivo.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60) || 'foto';
  const ruta = `${destino.babosa}/${negocio.babosa}/${base}-${Date.now().toString(36)}.webp`;

  const { error: eSubida } = await db.storage.from(BUCKET).upload(ruta, webp, { contentType: 'image/webp' });
  if (eSubida) { console.error('subirFoto:', eSubida.message); return; }

  const { data: publica } = db.storage.from(BUCKET).getPublicUrl(ruta);
  const { count } = await db.from('dst_negocio_foto')
    .select('id', { count: 'exact', head: true }).eq('negocio_id', id);

  const { error } = await db.from('dst_negocio_foto').insert({
    negocio_id: id,
    url: publica.publicUrl,
    orden: count ?? 0,
    // La primera foto real que entra manda; las genéricas nunca son portada.
    es_portada: !count,
    es_generica: false,
    credito, licencia, fuente_url: fuente,
    texto_alternativo_es: texto(datos, 'texto_alternativo') || negocio.nombre,
    texto_alternativo_en: texto(datos, 'texto_alternativo') || negocio.nombre,
  });
  if (error) console.error('subirFoto fila:', error.message);
  refrescar(id);
}

/** Marca una foto como la portada. El índice único parcial deja solo una. */
export async function marcarPortada(datos: FormData) {
  const { db, destino } = await contextoPanel('negocios');
  const id = texto(datos, 'id');
  const fotoId = texto(datos, 'foto_id');
  if (!esUuid(id) || !esUuid(fotoId)) return;

  const { data: negocio } = await db.from('dst_negocio')
    .select('id').eq('id', id).eq('destino_id', destino.id).maybeSingle();
  if (!negocio) return;

  // Primero se apaga la anterior: uq_dst_foto_portada no deja dos a la vez.
  await db.from('dst_negocio_foto').update({ es_portada: false }).eq('negocio_id', id).eq('es_portada', true);
  const { error } = await db.from('dst_negocio_foto').update({ es_portada: true }).eq('id', fotoId).eq('negocio_id', id);
  if (error) console.error('marcarPortada:', error.message);
  refrescar(id);
}

/** Borra la fila y el archivo. Si queda huérfano el archivo, el bucket engorda solo. */
export async function borrarFoto(datos: FormData) {
  const { db, destino } = await contextoPanel('negocios');
  const id = texto(datos, 'id');
  const fotoId = texto(datos, 'foto_id');
  if (!esUuid(id) || !esUuid(fotoId)) return;

  const { data: negocio } = await db.from('dst_negocio')
    .select('id').eq('id', id).eq('destino_id', destino.id).maybeSingle();
  if (!negocio) return;

  const { data: foto } = await db.from('dst_negocio_foto')
    .select('id, url').eq('id', fotoId).eq('negocio_id', id).maybeSingle();
  if (!foto) return;

  const marca = `/object/public/${BUCKET}/`;
  const corte = foto.url.indexOf(marca);
  if (corte !== -1) await db.storage.from(BUCKET).remove([foto.url.slice(corte + marca.length)]);

  const { error } = await db.from('dst_negocio_foto').delete().eq('id', fotoId).eq('negocio_id', id);
  if (error) console.error('borrarFoto:', error.message);
  refrescar(id);
}

/* ---- Opiniones de afuera ---- */

/**
 * Trae de Google la nota, el conteo y hasta cinco reseñas con texto de UN
 * negocio. No se pegan a mano en Supabase: se piden a la API oficial, que es
 * la única que da licencia para mostrar ese texto, y vencen a los 30 días.
 */
export async function traerOpiniones(datos: FormData) {
  await contextoPanel('negocios');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;
  const resultado = await refrescarExternasDeNegocio(id);
  if (!resultado.ok) console.error('traerOpiniones:', resultado.motivo);
  refrescar(id);
}

/**
 * Los que no tienen nada y los que vencen en tres días. Con tope: cada
 * negocio es una llamada facturada a Google.
 */
export async function traerOpinionesDeTodos(datos: FormData) {
  const { destino } = await contextoPanel('negocios');
  const limite = Number(texto(datos, 'limite')) || 25;
  const resumen = await refrescarExternasPendientes({ destino_id: destino.id, limite });
  console.log(`traerOpinionesDeTodos: ${resumen.ok} ok, ${resumen.fallos} fallos`);
  refrescar();
}
