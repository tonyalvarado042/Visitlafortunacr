'use server';

import { revalidatePath } from 'next/cache';
import { contextoPanel } from '@/lib/admin/contexto';
import { babosaDe } from '@/lib/admin/babosa';

export type Estado = { ok?: string | null; error?: string | null };

const esUuid = (v: unknown) => /^[0-9a-f-]{36}$/i.test(String(v ?? ''));
const texto = (d: FormData, k: string) => String(d.get(k) ?? '').trim();

/* Las mismas seis que acepta el check de `dst_categoria`. Repetidas acá a
   propósito: si alguien manda otra, se rechaza antes de llegar a la base y el
   panel puede decir cuál en vez de mostrar un error de Postgres. */
const SECCIONES = ['que_hacer', 'tours', 'donde_dormir', 'comer_beber', 'explorar', 'transporte'];

function refrescar() {
  /* El panel Y el sitio público: una categoría nueva, o una que se esconde,
     cambia el menú de TODAS las páginas. Sin esto se guarda bien y el sitio
     sigue mostrando lo de antes hasta que caduque el caché, que es justo el
     tipo de cosa que hace dudar de si el botón funcionó. */
  revalidatePath('/admin/categorias');
  revalidatePath('/admin', 'layout');
  revalidatePath('/[idioma]', 'layout');
}

/**
 * Crea una categoría NUEVA y la engancha a este destino.
 *
 * ⚠️ Las categorías son GLOBALES (`dst_categoria`), compartidas por todos los
 * destinos; lo que es por destino es el enganche (`dst_destino_categoria`),
 * con su orden, su nombre local y si se ve. Por eso crear una categoría son
 * DOS pasos, y por eso existe `engancharCategoria` aparte: la que ya existe
 * no se duplica, se engancha.
 */
export async function crearCategoria(_previo: Estado, datos: FormData): Promise<Estado> {
  const { db, destino, usuario } = await contextoPanel('categorias');
  if (usuario.rol !== 'admin') return { error: 'Solo un administrador puede crear categorías.' };

  const nombre = texto(datos, 'nombre');
  const seccion = texto(datos, 'seccion');
  if (!nombre) return { error: 'Falta el nombre.' };
  if (!SECCIONES.includes(seccion)) return { error: 'Esa sección no existe.' };

  const babosa = babosaDe(nombre);
  if (!babosa) return { error: 'De ese nombre no sale una dirección usable. Probá con letras.' };

  /* La babosa es única en TODA la tabla, no por destino. Si ya existe, lo que
     corresponde es engancharla, no crear otra con un sufijo: dos categorías
     «Cataratas» serían dos listados partiendo el mismo contenido. */
  const { data: yaExiste } = await db.from('dst_categoria')
    .select('id, nombre').eq('babosa', babosa).maybeSingle();
  if (yaExiste) {
    return { error: `Ya existe una categoría con esa dirección («${yaExiste.nombre}»). Engancharla desde la lista de abajo en vez de crear otra.` };
  }

  const { data: creada, error } = await db.from('dst_categoria')
    .insert({ nombre, babosa, seccion })
    .select('id').single();
  if (error) return { error: error.message };

  /* El orden: al final de su sección, para no empujar lo que ya estaba. */
  const { data: ultimas } = await db.from('dst_destino_categoria')
    .select('orden').eq('destino_id', destino.id).order('orden', { ascending: false }).limit(1);
  const orden = (ultimas?.[0]?.orden ?? 0) + 1;

  const { error: eEnganche } = await db.from('dst_destino_categoria')
    .insert({ destino_id: destino.id, categoria_id: creada.id, orden, es_visible: true });
  if (eEnganche) return { error: eEnganche.message };

  refrescar();
  return { ok: `«${nombre}» creada y enganchada. Ya se puede elegir en negocios y tours.` };
}

/** Engancha a este destino una categoría que YA existe en el catálogo. */
export async function engancharCategoria(datos: FormData) {
  const { db, destino, usuario } = await contextoPanel('categorias');
  if (usuario.rol !== 'admin') return;
  const id = texto(datos, 'categoria_id');
  if (!esUuid(id)) return;

  const { data: ultimas } = await db.from('dst_destino_categoria')
    .select('orden').eq('destino_id', destino.id).order('orden', { ascending: false }).limit(1);

  await db.from('dst_destino_categoria').upsert({
    destino_id: destino.id,
    categoria_id: id,
    orden: (ultimas?.[0]?.orden ?? 0) + 1,
    es_visible: true,
  }, { onConflict: 'destino_id,categoria_id' });
  refrescar();
}

/** El nombre local, el orden y si se ve. */
export async function guardarCategoria(datos: FormData) {
  const { db, destino, usuario } = await contextoPanel('categorias');
  if (usuario.rol !== 'admin') return;
  const id = texto(datos, 'categoria_id');
  if (!esUuid(id)) return;

  const orden = Number(texto(datos, 'orden'));
  await db.from('dst_destino_categoria').update({
    /* Vacío = se usa el nombre del catálogo. Guardar '' en vez de null haría
       que la categoría se quedara SIN nombre en el menú. */
    nombre_local: texto(datos, 'nombre_local') || null,
    orden: Number.isFinite(orden) ? orden : 0,
    es_visible: texto(datos, 'es_visible') === '1',
  }).eq('destino_id', destino.id).eq('categoria_id', id);
  refrescar();
}

/**
 * Suelta la categoría de este destino. NO la borra del catálogo.
 *
 * Y se niega si tiene contenido: desenganchar una categoría con negocios o
 * tours adentro los deja fuera del directorio sin tocarlos ni avisar, y
 * después nadie entiende por qué «desaparecieron».
 */
export async function soltarCategoria(datos: FormData) {
  const { db, destino, usuario } = await contextoPanel('categorias');
  if (usuario.rol !== 'admin') return;
  const id = texto(datos, 'categoria_id');
  if (!esUuid(id)) return;

  const [{ count: negocios }, { count: tours }] = await Promise.all([
    db.from('dst_negocio').select('id', { count: 'exact', head: true })
      .eq('destino_id', destino.id).eq('categoria_id', id).neq('estado_publicacion', 'archivado'),
    db.from('dst_tour').select('id', { count: 'exact', head: true })
      .eq('destino_id', destino.id).eq('categoria_id', id),
  ]);
  if ((negocios ?? 0) + (tours ?? 0) > 0) {
    console.error('soltarCategoria: tiene contenido, no se suelta');
    return;
  }

  await db.from('dst_destino_categoria')
    .delete().eq('destino_id', destino.id).eq('categoria_id', id);
  refrescar();
}
