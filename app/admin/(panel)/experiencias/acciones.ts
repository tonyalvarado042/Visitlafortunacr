'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { contextoPanel } from '@/lib/admin/contexto';

export type Estado = { ok?: string | null; error?: string | null };

const texto = (d: FormData, k: string) => String(d.get(k) ?? '').trim();
const numero = (d: FormData, k: string) => { const v = texto(d, k); return v === '' ? null : Number(v); };
const esUuid = (v: unknown) => /^[0-9a-f-]{36}$/i.test(String(v ?? ''));

/** Una lista escrita de a una por línea. Las vacías se van. */
function lineas(d: FormData, k: string): string[] {
  return texto(d, k).split('\n').map((l) => l.trim()).filter(Boolean);
}

/** El nombre en la dirección: sin tildes, sin espacios, sin sorpresas. */
function babosear(valor: string): string {
  return valor
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Crear o guardar una experiencia.
 *
 * El cuerpo se guarda en HTML tal cual se escribe. Es HTML de confianza: solo
 * entra por acá, y acá solo entra el equipo. El sitio le pasa htmlDeConfianza
 * antes de pintarlo, que es un cinturón de más y no un saneador de verdad.
 */
export async function guardarExperiencia(_previo: Estado, datos: FormData): Promise<Estado> {
  const { db, destino, usuario } = await contextoPanel('experiencias');
  if (!['admin', 'editor'].includes(usuario.rol)) {
    return { error: 'No tenés permiso para editar experiencias.' };
  }

  const id = texto(datos, 'id');
  const titulo = texto(datos, 'titulo');
  if (!titulo) return { error: 'La experiencia necesita un título.' };

  const babosa = babosear(texto(datos, 'babosa') || titulo);
  if (!babosa) return { error: 'El título no deja armar una dirección. Escribí una a mano.' };

  const dias = numero(datos, 'dias');
  if (!dias || dias < 1) return { error: '¿Cuántos días dura?' };

  const fila = {
    destino_id: destino.id,
    titulo,
    babosa,
    subtitulo: texto(datos, 'subtitulo') || null,
    resumen: texto(datos, 'resumen') || null,
    cuerpo_html: String(datos.get('cuerpo_html') ?? '').trim() || null,
    dias,
    noches: numero(datos, 'noches'),
    personas: numero(datos, 'personas'),
    precio_desde_usd: numero(datos, 'precio_desde_usd'),
    imagen_url: texto(datos, 'imagen_url') || null,
    zonas: texto(datos, 'zonas').split(',').map((z) => z.trim()).filter(Boolean),
    incluye: lineas(datos, 'incluye'),
    no_incluye: lineas(datos, 'no_incluye'),
    orden: numero(datos, 'orden') ?? 0,
    es_publico: texto(datos, 'es_publico') === '1',
    /* Esto es lo que la separa de los planes que la IA arma para un viajero:
       sin 'equipo' no la muestra el sitio, por más pública que esté. */
    generado_por: 'equipo',
    idioma: destino.idioma_principal,
  };

  if (esUuid(id)) {
    const { error } = await db.from('dst_itinerario')
      .update(fila).eq('id', id).eq('destino_id', destino.id);
    if (error) return { error: error.message };
    revalidatePath('/admin/experiencias');
    revalidatePath(`/admin/experiencias/${id}`);
    return { ok: 'Guardada.' };
  }

  const { data, error } = await db.from('dst_itinerario')
    .insert(fila).select('id').single();
  if (error) return { error: error.message };

  revalidatePath('/admin/experiencias');
  redirect(`/admin/experiencias/${(data as { id: string }).id}`);
}

export async function borrarExperiencia(datos: FormData) {
  const { db, destino, usuario } = await contextoPanel('experiencias');
  if (usuario.rol !== 'admin') return;

  const id = texto(datos, 'id');
  if (!esUuid(id)) return;

  /* Solo las del equipo: un plan que la IA armó para un viajero no se borra
     desde acá ni por equivocación. */
  await db.from('dst_itinerario').delete()
    .eq('id', id).eq('destino_id', destino.id).eq('generado_por', 'equipo');

  revalidatePath('/admin/experiencias');
  redirect('/admin/experiencias');
}
