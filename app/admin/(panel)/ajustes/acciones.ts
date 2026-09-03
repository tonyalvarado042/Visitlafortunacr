'use server';

import { revalidatePath } from 'next/cache';
import { contextoPanel } from '@/lib/admin/contexto';

export type Estado = { ok?: string | null; error?: string | null };

const esUuid = (v: unknown) => /^[0-9a-f-]{36}$/i.test(String(v ?? ''));
const texto = (d: FormData, k: string) => String(d.get(k) ?? '').trim();
const numero = (d: FormData, k: string) => { const v = texto(d, k); return v === '' ? null : Number(v); };
const color = (d: FormData, k: string) => (/^#[0-9a-f]{6}$/i.test(texto(d, k)) ? texto(d, k).toUpperCase() : undefined);

export async function editarDestino(datos: FormData) {
  const { db, destino, usuario } = await contextoPanel('ajustes');
  if (usuario.rol !== 'admin') return;
  const whatsapp = texto(datos, 'whatsapp').replace(/[\s\-().]/g, '');
  const { error } = await db.from('dst_destino').update({
    nombre: texto(datos, 'nombre') || undefined,
    nombre_largo: texto(datos, 'nombre_largo') || null,
    region: texto(datos, 'region') || null,
    lema: texto(datos, 'lema') || null,
    marca_nombre: texto(datos, 'marca_nombre') || undefined,
    marca_sigla: texto(datos, 'marca_sigla') || null,
    whatsapp: whatsapp ? (whatsapp.startsWith('+') ? whatsapp : `+${whatsapp}`) : null,
    email_contacto: texto(datos, 'email_contacto').toLowerCase() || null,
    comision_por_defecto: numero(datos, 'comision_por_defecto'),
    color_tinta: color(datos, 'color_tinta'),
    color_acento: color(datos, 'color_acento'),
    color_naturaleza: color(datos, 'color_naturaleza'),
    color_gris: color(datos, 'color_gris'),
    logo_url: texto(datos, 'logo_url') || null,
    video_portada_url: texto(datos, 'video_portada_url') || null,
    imagen_portada_url: texto(datos, 'imagen_portada_url') || null,
    esta_activo: texto(datos, 'esta_activo') === '1',
  }).eq('id', destino.id);
  if (error) console.error('editarDestino:', error.message);
  revalidatePath('/admin', 'layout');
}

export async function guardarCanal(datos: FormData) {
  const { db, destino, usuario } = await contextoPanel('ajustes');
  if (usuario.rol !== 'admin') return;
  const id = texto(datos, 'id');
  const tipo = texto(datos, 'tipo');
  const proveedor = texto(datos, 'proveedor');
  if (!['whatsapp', 'email', 'web'].includes(tipo) || !['meta', 'resend', 'web', 'manual'].includes(proveedor)) return;
  const fila = {
    destino_id: destino.id, tipo, proveedor,
    identificador: texto(datos, 'identificador') || null,
    nombre_visible: texto(datos, 'nombre_visible') || null,
    variable_secreto: texto(datos, 'variable_secreto').replace(/[^A-Z0-9_]/g, '') || null,
    esta_activo: texto(datos, 'esta_activo') === '1',
  };
  const { error } = esUuid(id)
    ? await db.from('dst_canal').update(fila).eq('id', id).eq('destino_id', destino.id)
    : await db.from('dst_canal').upsert(fila, { onConflict: 'destino_id,tipo,proveedor' });
  if (error) console.error('guardarCanal:', error.message);
  revalidatePath('/admin/ajustes');
}

export async function eliminarCanal(datos: FormData) {
  const { db, destino, usuario } = await contextoPanel('ajustes');
  if (usuario.rol !== 'admin') return;
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;
  await db.from('dst_canal').delete().eq('id', id).eq('destino_id', destino.id);
  revalidatePath('/admin/ajustes');
}

/** El "un clic": crea un destino nuevo con sus categorías, agentes, plantillas y automatizaciones. */
export async function lanzarDestino(_previo: Estado, datos: FormData): Promise<Estado> {
  const { db, usuario } = await contextoPanel('ajustes');
  if (usuario.rol !== 'admin') return { error: 'Solo un administrador puede lanzar destinos.' };
  const babosa = texto(datos, 'babosa').toLowerCase().replace(/[^a-z0-9-]/g, '');
  const nombre = texto(datos, 'nombre');
  const dominio = texto(datos, 'dominio').toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!babosa || !nombre || !dominio.includes('.')) return { error: 'Babosa, nombre y dominio son obligatorios.' };
  const idiomas = datos.getAll('idiomas').map(String).filter((i) => ['es', 'en', 'pt', 'fr', 'de'].includes(i));
  const { data, error } = await db.rpc('lanzar_destino', {
    p_babosa: babosa,
    p_nombre: nombre,
    p_dominio: dominio,
    p_pais_iso: (texto(datos, 'pais_iso') || 'CR').toUpperCase().slice(0, 2),
    p_pais_nombre: texto(datos, 'pais_nombre') || 'Costa Rica',
    p_zona_horaria: texto(datos, 'zona_horaria') || 'America/Costa_Rica',
    p_marca_nombre: texto(datos, 'marca_nombre') || `Visit ${nombre}`,
    p_marca_sigla: texto(datos, 'marca_sigla') || null,
    p_moneda_iso: (texto(datos, 'moneda_iso') || 'CRC').toUpperCase().slice(0, 3),
    p_nombre_largo: texto(datos, 'nombre_largo') || null,
    p_region: texto(datos, 'region') || null,
    p_lema_es: texto(datos, 'lema_es') || null,
    p_lema_en: texto(datos, 'lema_en') || null,
    p_idiomas: idiomas.length ? idiomas : ['es', 'en'],
  });
  if (error) return { error: error.message };
  revalidatePath('/admin', 'layout');
  return { ok: `Destino creado (${String(data).slice(0, 8)}…). Nace apagado: cargá contenido, elegilo arriba a la izquierda y encendelo desde Ajustes.` };
}
