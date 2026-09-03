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
    es_destacado: texto(datos, 'es_destacado') === '1',
    estado: ['borrador', 'pendiente', 'publicado', 'archivado'].includes(estado) ? estado : antes.estado,
    publicado_en: estado === 'publicado' && !antes.publicado_en ? new Date().toISOString() : antes.publicado_en,
  }).eq('id', id);
  if (error) console.error('editarTour:', error.message);
  revalidatePath(`/admin/tours/${id}`);
  revalidatePath('/admin/tours');
}
