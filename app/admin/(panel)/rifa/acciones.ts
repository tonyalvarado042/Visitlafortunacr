'use server';

import { revalidatePath } from 'next/cache';
import { contextoPanel } from '@/lib/admin/contexto';

export type Estado = { ok?: string | null; error?: string | null };

const texto = (d: FormData, k: string) => String(d.get(k) ?? '').trim();
const numero = (d: FormData, k: string) => { const v = texto(d, k); return v === '' ? null : Number(v); };
const entero = (d: FormData, k: string, pordefecto: number) => {
  const v = numero(d, k);
  return v == null || !Number.isFinite(v) ? pordefecto : Math.round(v);
};
const esSi = (d: FormData, k: string) => texto(d, k) === '1';

/**
 * Guarda la rifa.
 *
 * Mismo criterio que en Ajustes: un formulario por grupo, y cada uno escribe
 * solo lo suyo. Una casilla sin marcar no viaja en el FormData, así que una
 * acción que escriba toda la fila apaga cosas que el otro formulario tenía
 * encendidas. Ver `editarDestino`.
 */
export async function guardarRifa(datos: FormData) {
  const { db, destino, usuario } = await contextoPanel('ajustes');
  if (usuario.rol !== 'admin') return;

  const grupo = texto(datos, 'grupo');
  let campos: Record<string, unknown>;

  if (grupo === 'premio') {
    campos = {
      titulo: texto(datos, 'titulo') || undefined,
      gancho: texto(datos, 'gancho') || null,
      premio_titulo: texto(datos, 'premio_titulo') || null,
      premio_usd: numero(datos, 'premio_usd'),
      premio_nota: texto(datos, 'premio_nota') || null,
      /* Uno por linea. Se limpian los vacios: una linea en blanco de mas
         pintaria un renglon con un visto bueno y nada al lado. */
      incluye: texto(datos, 'incluye').split('\n').map((l) => l.trim()).filter(Boolean),
      /* La fecha puede quedar vacía a propósito: mientras no haya día, la
         página muestra el texto ("Abril 2027") y no inventa un número. */
      fecha_sorteo: texto(datos, 'fecha_sorteo') || null,
      cuando_texto: texto(datos, 'cuando_texto') || null,
      ganadores: Math.min(50, Math.max(1, entero(datos, 'ganadores', 1))),
      en_vivo: esSi(datos, 'en_vivo'),
      enlace_vivo: /^https?:\/\/\S+$/i.test(texto(datos, 'enlace_vivo'))
        ? texto(datos, 'enlace_vivo')
        : null,
      imagen_url: texto(datos, 'imagen_url') || null,
    };
  } else if (grupo === 'bases') {
    campos = { bases_html: texto(datos, 'bases_html') || null };
  } else if (grupo === 'aviso') {
    campos = {
      esta_activo: esSi(datos, 'esta_activo'),
      aviso_activo: esSi(datos, 'aviso_activo'),
      segundos_para_abrir: Math.min(600, Math.max(0, entero(datos, 'segundos_para_abrir', 10))),
      al_intentar_salir: esSi(datos, 'al_intentar_salir'),
      dias_para_repreguntar: Math.min(365, Math.max(1, entero(datos, 'dias_para_repreguntar', 30))),
      pide_whatsapp: esSi(datos, 'pide_whatsapp'),
      whatsapp_obligatorio: esSi(datos, 'whatsapp_obligatorio'),
    };
  } else if (grupo === 'cierre') {
    /* Cerrar el sorteo es lo único de aquí que no se deshace solo: deja de
       aceptar participantes. Por eso va en su propio formulario y pide el
       nombre del ganador, que es lo que uno escribe cuando de verdad
       terminó. */
    const cerrar = esSi(datos, 'cerrar');
    campos = {
      cerrado_en: cerrar ? new Date().toISOString() : null,
      ganador_nombre: texto(datos, 'ganador_nombre') || null,
      ganador_nota: texto(datos, 'ganador_nota') || null,
    };
  } else {
    console.error('guardarRifa: formulario sin grupo');
    return;
  }

  const { error } = await db
    .from('dst_sorteo')
    .update({ ...campos, actualizado_en: new Date().toISOString() })
    .eq('destino_id', destino.id);

  if (error) console.error('guardarRifa:', error.message);
  revalidatePath('/admin/rifa');
  revalidatePath('/', 'layout');
}
