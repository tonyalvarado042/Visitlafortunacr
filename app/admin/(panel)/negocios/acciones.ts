'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { contextoPanel } from '@/lib/admin/contexto';
import { babosaDe } from '@/lib/admin/babosa';

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
