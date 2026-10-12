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
  } else if (grupo === 'cartel') {
    /* Su propio grupo y no 'premio', aunque viva en la misma tarjeta: el
       formulario del cartel NO trae los demas campos del premio, y una
       accion compartida escribe TODO lo que recibe — lo que no viene se
       guarda vacio. Eso ya apago el sitio una vez, guardando la oferta
       premium desde un formulario que no traia `esta_activo`. */
    campos = { cartel_url: texto(datos, 'cartel_url') || null };
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

/**
 * Guardar una traducción del sorteo.
 *
 * Hermana de `traducirCampo` de negocios, pero para el sorteo, que no estaba
 * en su lista de entidades. Sirve para cualquier campo traducible — y desde
 * hoy `imagen_url` es uno: el cartel de la rifa en inglés no es el mismo
 * archivo que el de español.
 *
 * Vacío BORRA la fila en vez de guardar una cadena vacía. Si no, un idioma
 * "traducido a nada" taparía el del idioma principal con un hueco, que es
 * peor que no traducirlo.
 */
export async function traducirSorteo(datos: FormData) {
  const { db, destino } = await contextoPanel('rifa');
  const campo = texto(datos, 'campo');
  const idioma = texto(datos, 'idioma');
  const valor = texto(datos, 'texto');
  if (!campo || !idioma) return;

  /* El sorteo del destino, no uno cualquiera: el id viene del formulario y
     sin esta comprobación se podría traducir el sorteo de otro destino. */
  const { data: sorteo } = await db.from('dst_sorteo')
    .select('id').eq('id', texto(datos, 'sorteo_id')).eq('destino_id', destino.id).maybeSingle();
  if (!sorteo) return;

  if (!valor) {
    await db.from('dst_traduccion').delete()
      .eq('entidad', 'sorteo').eq('entidad_id', sorteo.id).eq('campo', campo).eq('idioma', idioma);
  } else {
    await db.from('dst_traduccion').upsert(
      { entidad: 'sorteo', entidad_id: sorteo.id, campo, idioma, texto: valor,
        /* 'humano' y no 'equipo': la columna solo admite humano|maquina|
           importado, y con 'equipo' esto revienta contra el check. */
        origen: 'humano', esta_revisada: true },
      { onConflict: 'entidad,entidad_id,campo,idioma' },
    );
  }
  revalidatePath('/admin/rifa');
}
