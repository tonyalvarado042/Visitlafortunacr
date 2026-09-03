'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { contextoPanel } from '@/lib/admin/contexto';
import { hayClaveDeIA } from '@/lib/ia/cliente';
import { hayClaveDeServicio } from '@/lib/supabase-servidor';
import { redactarGuia } from '@/lib/ia/redactor';
import { babosaDe } from '@/lib/admin/babosa';

export type Estado = { error?: string | null };

const esUuid = (v: unknown) => /^[0-9a-f-]{36}$/i.test(String(v ?? ''));
const texto = (d: FormData, k: string) => String(d.get(k) ?? '').trim();
const numero = (d: FormData, k: string) => { const v = texto(d, k); return v === '' ? null : Number(v); };
const TIPOS = ['guia', 'itinerario', 'comparativa', 'como_llegar', 'lista'] as const;
type Tipo = (typeof TIPOS)[number];

export async function crearGuia(datos: FormData) {
  const { db, destino, usuario } = await contextoPanel('guias');
  const titulo = texto(datos, 'titulo');
  if (!titulo) return;
  const tipo = (TIPOS as readonly string[]).includes(texto(datos, 'tipo')) ? texto(datos, 'tipo') : 'guia';
  const { data, error } = await db.from('dst_guia').insert({
    destino_id: destino.id, autor_id: usuario.id, titulo, babosa: `${babosaDe(titulo) || 'guia'}-${Math.random().toString(36).slice(2, 6)}`,
    entradilla: '', cuerpo: '', tipo, estado: 'borrador',
  }).select('id').single();
  if (error || !data) { console.error('crearGuia:', error?.message); return; }
  revalidatePath('/admin/guias');
  redirect(`/admin/guias/${data.id}`);
}

export async function editarGuia(datos: FormData) {
  const { db, destino } = await contextoPanel('guias');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;
  const { data: antes } = await db.from('dst_guia').select('estado, publicado_en, babosa').eq('id', id).eq('destino_id', destino.id).maybeSingle();
  if (!antes) return;
  const estado = texto(datos, 'estado');
  const babosa = babosaDe(texto(datos, 'babosa')) || antes.babosa;
  const { error } = await db.from('dst_guia').update({
    titulo: texto(datos, 'titulo') || undefined,
    babosa,
    entradilla: texto(datos, 'entradilla'),
    cuerpo: texto(datos, 'cuerpo'),
    tipo: (TIPOS as readonly string[]).includes(texto(datos, 'tipo')) ? texto(datos, 'tipo') : undefined,
    dias: numero(datos, 'dias'),
    publico: ['pareja', 'familia', 'amigos', 'solo', 'grupo', 'negocios'].includes(texto(datos, 'publico')) ? texto(datos, 'publico') : null,
    imagen_url: texto(datos, 'imagen_url') || null,
    meta_titulo: texto(datos, 'meta_titulo') || null,
    meta_desc: texto(datos, 'meta_desc') || null,
    estado: ['borrador', 'pendiente', 'publicado', 'archivado'].includes(estado) ? estado : antes.estado,
    publicado_en: estado === 'publicado' && !antes.publicado_en ? new Date().toISOString() : antes.publicado_en,
  }).eq('id', id);
  if (error) console.error('editarGuia:', error.message);
  revalidatePath(`/admin/guias/${id}`);
  revalidatePath('/admin/guias');
}

export async function redactarGuiaIA(_previo: Estado, datos: FormData): Promise<Estado> {
  const { destino, usuario } = await contextoPanel('guias');
  if (!hayClaveDeServicio()) return { error: 'Falta SUPABASE_SECRET_KEY en el entorno.' };
  if (!hayClaveDeIA()) return { error: 'Falta ANTHROPIC_API_KEY en el entorno.' };
  const tema = texto(datos, 'tema');
  if (!tema) return { error: 'Escribí el tema.' };
  const tipo = ((TIPOS as readonly string[]).includes(texto(datos, 'tipo')) ? texto(datos, 'tipo') : 'guia') as Tipo;
  let id: string;
  try {
    const r = await redactarGuia({
      destino_id: destino.id, tema, tipo,
      idioma: destino.idiomas.includes(texto(datos, 'idioma')) ? texto(datos, 'idioma') : destino.idioma_principal,
      publico: texto(datos, 'publico') || null, indicaciones: texto(datos, 'indicaciones') || null,
    }, { origen: 'panel', solicitado_por: usuario.id });
    id = r.id;
  } catch (fallo) {
    return { error: fallo instanceof Error ? fallo.message : 'No se pudo redactar.' };
  }
  revalidatePath('/admin/guias');
  redirect(`/admin/guias/${id}`);
}
