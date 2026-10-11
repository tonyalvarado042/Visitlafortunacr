'use server';

import { revalidatePath } from 'next/cache';
import { contextoPanel } from '@/lib/admin/contexto';
import { servicio } from '@/lib/supabase-servidor';
import { correrCadenas } from '@/lib/cadenas';

export type Estado = { ok?: string | null; error?: string | null };

const texto = (d: FormData, k: string) => String(d.get(k) ?? '').trim();
const esUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

/** Prender o apagar una cadena. */
export async function cambiarCadena(datos: FormData) {
  const { db, destino, usuario } = await contextoPanel('cadenas');
  if (usuario.rol !== 'admin') return;
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;

  await db.from('dst_cadena')
    .update({ esta_activa: texto(datos, 'activa') === '1', actualizado_en: new Date().toISOString() })
    .eq('id', id).eq('destino_id', destino.id);
  revalidatePath('/admin/cadenas');
}

/** Editar un paso: el asunto, el cuerpo, los días. */
export async function guardarPaso(datos: FormData) {
  const { db, usuario } = await contextoPanel('cadenas');
  if (usuario.rol !== 'admin') return;
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;

  const dias = Number(texto(datos, 'dias_desde_alta'));
  await db.from('dst_cadena_paso').update({
    dias_desde_alta: Number.isFinite(dias) ? Math.min(365, Math.max(0, Math.round(dias))) : 0,
    asunto_es: texto(datos, 'asunto_es') || undefined,
    cuerpo_es: texto(datos, 'cuerpo_es') || undefined,
    asunto_en: texto(datos, 'asunto_en') || null,
    cuerpo_en: texto(datos, 'cuerpo_en') || null,
    boton_texto_es: texto(datos, 'boton_texto_es') || null,
    boton_texto_en: texto(datos, 'boton_texto_en') || null,
    boton_ruta: texto(datos, 'boton_ruta') || null,
    esta_activo: texto(datos, 'esta_activo') === '1',
  }).eq('id', id);
  revalidatePath('/admin/cadenas');
}

/**
 * Ver qué saldría, sin mandar nada.
 *
 * Llama al MISMO recorrido que el cron, solo que sin enviar. Una prueba que
 * mire otra consulta que el envío no prueba nada — es la lección de las
 * cadenas del CRM.
 */
export async function verQueSaldria(_previo: Estado, _datos: FormData): Promise<Estado> {
  const { destino, usuario } = await contextoPanel('cadenas');
  if (usuario.rol !== 'admin') return { error: 'Solo un administrador.' };

  try {
    const fila = await filaDelDestino(destino.id);
    const r = await correrCadenas(fila, { soloPrueba: true, limite: 50 });
    if (r.pendientes === 0) {
      return { ok: `No saldría ningún correo ahora mismo. ${r.barridos > 0 ? `Se inscribieron ${r.barridos}.` : ''}`.trim() };
    }
    return { ok: `Saldrían ${r.pendientes} correos:\n${r.detalles.join('\n')}` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/** Mandar ahora, de verdad, sin esperar al reloj. */
export async function mandarAhora(_previo: Estado, _datos: FormData): Promise<Estado> {
  const { destino, usuario } = await contextoPanel('cadenas');
  if (usuario.rol !== 'admin') return { error: 'Solo un administrador.' };

  try {
    const fila = await filaDelDestino(destino.id);
    const r = await correrCadenas(fila, { limite: 50 });
    revalidatePath('/admin/cadenas');
    if (r.pendientes === 0) return { ok: 'No había nada que mandar.' };
    return {
      ok: `Enviados ${r.enviados} de ${r.pendientes}.${r.fallidos ? ` Fallaron ${r.fallidos}: ${r.detalles.join(' · ')}` : ''}`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/* El destino completo: `contextoPanel` trae solo unas columnas, y el correo
   necesita la marca, el logo y los colores para armar la plantilla. */
async function filaDelDestino(id: string) {
  const { data, error } = await servicio().from('dst_destino').select('*').eq('id', id).single();
  if (error || !data) throw new Error('No se pudo leer el destino.');
  return data as never;
}
