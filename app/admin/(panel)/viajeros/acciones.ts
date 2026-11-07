'use server';

import { revalidatePath } from 'next/cache';
import { contextoPanel } from '@/lib/admin/contexto';

const esUuid = (v: unknown) => /^[0-9a-f-]{36}$/i.test(String(v ?? ''));
const texto = (d: FormData, k: string) => String(d.get(k) ?? '').trim();
const numero = (d: FormData, k: string) => { const v = texto(d, k); return v === '' ? null : Number(v); };

export async function editarViajero(datos: FormData) {
  const { db } = await contextoPanel('viajeros');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;
  const whatsapp = texto(datos, 'whatsapp').replace(/[\s\-().]/g, '');
  const cambios = {
    nombre: texto(datos, 'nombre') || null,
    apellidos: texto(datos, 'apellidos') || null,
    email: texto(datos, 'email').toLowerCase() || null,
    whatsapp: whatsapp ? (whatsapp.startsWith('+') ? whatsapp : `+${whatsapp}`) : null,
    pais_iso: texto(datos, 'pais_iso').toUpperCase().slice(0, 2) || null,
    idioma: texto(datos, 'idioma') || null,
    llega_el: texto(datos, 'llega_el') || null,
    sale_el: texto(datos, 'sale_el') || null,
    personas: numero(datos, 'personas'),
    ninos: numero(datos, 'ninos'),
    tipo_viajero: texto(datos, 'tipo_viajero') || null,
    presupuesto: texto(datos, 'presupuesto') || null,
    presupuesto_usd: numero(datos, 'presupuesto_usd'),
    notas: texto(datos, 'notas') || null,
    no_molestar: texto(datos, 'no_molestar') === '1',
    acepta_marketing: texto(datos, 'acepta_marketing') === '1',
  };
  await db.from('dst_viajero').update(cambios).eq('id', id);
  await guardarEtiquetas(db, id, datos.getAll('etiqueta').map(String).filter(esUuid));
  revalidatePath(`/admin/viajeros/${id}`);
  revalidatePath('/admin/viajeros');
  revalidatePath('/admin/leads');
}

/* Los GRUPOS que esta pantalla administra. Los otros cinco
   (servicio/ambiente/accesibilidad/publico/pago) son atributos de un NEGOCIO y
   no tienen nada que hacer en una persona — pero sobre todo: este arreglo es
   el que limita el `delete` de abajo. Sin el, guardar la ficha de un viajero
   borraria cualquier etiqueta que alguien le hubiera puesto desde otro lado. */
const GRUPOS_DE_PERSONA = ['interes', 'momento', 'mano'] as const;

/**
 * Deja las etiquetas de la persona EXACTAMENTE como quedaron en la pantalla.
 *
 * ⚠️ `dst_viajero.intereses` ya NO se escribe desde acá, y eso es a propósito.
 * La verdad es esta tabla, y la columna la mantiene al día el disparador
 * `refrescar_intereses_del_viajero` — que además conserva los intereses de
 * texto libre que escribe la IA y que esta pantalla no muestra como casilla.
 * Si acá se siguiera escribiendo la columna, el campo vacío la borraría junto
 * con ese texto libre. Ver `supabase/plataforma/33_etiquetas_de_personas.sql`.
 */
async function guardarEtiquetas(
  db: Awaited<ReturnType<typeof contextoPanel>>['db'], viajeroId: string, elegidas: string[],
) {
  const { data: vocabulario, error: falloElVocabulario } = await db
    .from('dst_etiqueta').select('id').in('grupo', GRUPOS_DE_PERSONA);

  /* Si no se puede leer el vocabulario NO se borra nada. Un `delete` con una
     lista vacía de ids permitidos se llevaría etiquetas que nadie pidió quitar,
     y eso no se nota hasta que falta gente en un segmento. */
  if (falloElVocabulario || !vocabulario) {
    console.error('guardarEtiquetas: no se pudo leer el vocabulario, no se toca nada:',
      falloElVocabulario?.message);
    return;
  }

  const permitidas = new Set(vocabulario.map((e) => e.id as string));
  const quedan = elegidas.filter((id) => permitidas.has(id));
  const aBorrar = [...permitidas].filter((id) => !quedan.includes(id));

  if (aBorrar.length) {
    const { error } = await db.from('dst_viajero_etiqueta')
      .delete().eq('viajero_id', viajeroId).in('etiqueta_id', aBorrar);
    if (error) console.error('guardarEtiquetas: no se pudieron quitar etiquetas:', error.message);
  }

  if (quedan.length) {
    const { error } = await db.from('dst_viajero_etiqueta').upsert(
      quedan.map((etiqueta_id) => ({ viajero_id: viajeroId, etiqueta_id, puesta_por: 'equipo' })),
      { onConflict: 'viajero_id,etiqueta_id', ignoreDuplicates: true },
    );
    if (error) console.error('guardarEtiquetas: no se pudieron poner etiquetas:', error.message);
  }
}
