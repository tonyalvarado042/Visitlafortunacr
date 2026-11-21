'use server';

import { revalidatePath } from 'next/cache';
import { contextoPanel } from '@/lib/admin/contexto';
import { babosaDe } from '@/lib/admin/babosa';
import { anotarFallo } from '@/lib/admin/aviso';

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
  /* ⚠️ SE DICE QUE NACE SIN TRADUCIR. No se puede traducir sola —no hay
     traductor conectado y no se inventan textos—, pero callarlo es como se
     llegó a tener cuatro categorías en español dentro del sitio en inglés
     sin que nadie lo notara. */
  const otros = destino.idiomas.filter((i) => i !== destino.idioma_principal);
  return { ok: `«${nombre}» creada y enganchada. Ya se puede elegir en negocios y tours.` +
    (otros.length ? ` Nace sin traducir: en ${otros.join(' y ')} va a decir «${nombre}» hasta que la traduzcas.` : '') };
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
    /* Antes era un `console.error` y un `return`: el boton se apretaba, no
       pasaba nada y la pantalla quedaba igual. El registro del servidor lo
       sabia; Tony no. */
    await anotarFallo('soltarCategoria',
      `Esa categoria tiene ${negocios ?? 0} negocios y ${tours ?? 0} tours adentro. ` +
      'Moverlos a otra categoria primero, o esconderla en vez de soltarla.');
    return;
  }

  await db.from('dst_destino_categoria')
    .delete().eq('destino_id', destino.id).eq('categoria_id', id);
  refrescar();
}


/* ==========================================================================
   EDITAR Y TRADUCIR UNA CATEGORIA

   Hasta el 21 de noviembre de 2026 no se podia ninguna de las dos cosas.
   Tony: «no veo traducciones, error total porque todo esta traducido, ni
   boton para editar categorias en la seccion categorias». Las dos eran
   ciertas: `crearCategoria` no escribia NI UNA fila en `dst_traduccion` ni
   en `dst_ruta`, asi que toda categoria creada desde el panel salia en
   ingles y portugues con el nombre y la direccion en espanol. Y el nombre,
   la direccion y la seccion no se podian tocar despues.
   ========================================================================== */

/**
 * Deja `babosa` como la direccion VIGENTE de esta categoria en este idioma,
 * y jubila la que estaba.
 *
 * ⚠️ JUBILAR NO ES BORRAR, y esa es toda la gracia. La fila vieja se queda
 * con `es_vigente = false`, y el listado publico la usa para mandar un 301 a
 * la nueva. Borrandola, cada enlace compartido y cada resultado de Google
 * que apuntara a la direccion vieja daria 404 — que para Google es «esta
 * pagina ya no existe», no «se mudo», y la posicion se pierde.
 *
 * Devuelve el motivo si no se pudo, nunca lanza.
 */
async function fijarRuta(
  db: Awaited<ReturnType<typeof contextoPanel>>['db'],
  destinoId: string, categoriaId: string, idioma: string, babosa: string,
): Promise<string | null> {
  /* ⚠️ `uq_dst_ruta` es (destino, entidad, idioma, babosa) — SIN entidad_id.
     O sea: dos categorias no pueden compartir direccion en el mismo idioma,
     que es lo correcto porque una direccion lleva a un solo lado. Pero
     significa que un upsert a secas le ROBARIA la direccion a la otra
     categoria cambiandole el `entidad_id`, incluida una jubilada que todavia
     esta redirigiendo. Por eso se mira antes y se dice que no. */
  const { data: choca } = await db.from('dst_ruta')
    .select('entidad_id, es_vigente')
    .eq('destino_id', destinoId).eq('entidad', 'categoria')
    .eq('idioma', idioma).eq('babosa', babosa).maybeSingle();

  if (choca && choca.entidad_id !== categoriaId) {
    return `la direccion «${babosa}» en ${idioma} ya es de otra categoria` +
      (choca.es_vigente ? '' : ' (jubilada, todavia redirigiendo)');
  }

  /* Primero se jubilan TODAS las de este idioma, despues se enciende la que
     toca. En ese orden: al reves, el `update` apagaria la recien puesta. */
  const { error: eApagar } = await db.from('dst_ruta')
    .update({ es_vigente: false })
    .eq('destino_id', destinoId).eq('entidad', 'categoria')
    .eq('entidad_id', categoriaId).eq('idioma', idioma);
  if (eApagar) return eApagar.message;

  const { error: ePoner } = await db.from('dst_ruta').upsert({
    destino_id: destinoId, entidad: 'categoria', entidad_id: categoriaId,
    idioma, babosa, es_vigente: true,
  }, { onConflict: 'destino_id,entidad,idioma,babosa' });
  return ePoner ? ePoner.message : null;
}

/**
 * El nombre, la direccion y la seccion de la categoria EN EL CATALOGO.
 *
 * Son globales: cambian para todos los destinos que la usen. Hoy hay uno,
 * pero el dia que haya dos, renombrar «Cataratas» aca la renombra en los
 * dos. Lo que es por destino es `nombre_local`, y esta en el otro formulario.
 */
export async function editarCategoria(_previo: Estado, datos: FormData): Promise<Estado> {
  const { db, destino, usuario } = await contextoPanel('categorias');
  if (usuario.rol !== 'admin') return { error: 'Solo un administrador puede editar categorias.' };

  const id = texto(datos, 'categoria_id');
  if (!esUuid(id)) return { error: 'No vino la categoria.' };

  const nombre = texto(datos, 'nombre');
  const seccion = texto(datos, 'seccion');
  if (!nombre) return { error: 'Falta el nombre.' };
  if (!SECCIONES.includes(seccion)) return { error: 'Esa seccion no existe.' };

  /* La direccion se puede escribir a mano; vacia, sale del nombre. */
  const babosa = babosaDe(texto(datos, 'babosa') || nombre);
  if (!babosa) return { error: 'De eso no sale una direccion usable. Proba con letras.' };

  const { data: antes } = await db.from('dst_categoria')
    .select('nombre, babosa, seccion').eq('id', id).maybeSingle();
  if (!antes) return { error: 'Esa categoria no existe.' };

  if (babosa !== antes.babosa) {
    const { data: ocupada } = await db.from('dst_categoria')
      .select('id, nombre').eq('babosa', babosa).maybeSingle();
    if (ocupada && ocupada.id !== id) {
      return { error: `La direccion «${babosa}» ya es de «${ocupada.nombre}».` };
    }
  }

  const { error } = await db.from('dst_categoria')
    .update({ nombre, babosa, seccion }).eq('id', id);
  if (error) return { error: error.message };

  /* ⚠️ LA DIRECCION VIEJA NO SE TIRA: SE JUBILA. `dst_categoria.babosa` es
     el respaldo que se sirve en los idiomas que no tienen la suya en
     `dst_ruta`. Al cambiarlo, esas direcciones dejarian de existir de golpe
     —404 para todo el que la tuviera guardada o la hubiera compartido—. Se
     deja la vieja jubilada para cada idioma que la estaba usando, y el
     listado la convierte en un 301 a la nueva. Es la diferencia entre «esta
     pagina se mudo» y «esta pagina ya no existe». */
  const avisos: string[] = [];
  if (babosa !== antes.babosa) {
    const { data: propias } = await db.from('dst_ruta')
      .select('idioma').eq('destino_id', destino.id).eq('entidad', 'categoria')
      .eq('entidad_id', id).eq('es_vigente', true);
    const conRutaPropia = new Set((propias ?? []).map((r) => String(r.idioma).trim()));

    for (const idioma of destino.idiomas) {
      if (conRutaPropia.has(idioma)) continue;  // ese idioma no servia la vieja
      const { error: eVieja } = await db.from('dst_ruta').upsert({
        destino_id: destino.id, entidad: 'categoria', entidad_id: id,
        idioma, babosa: antes.babosa, es_vigente: false,
      }, { onConflict: 'destino_id,entidad,idioma,babosa' });
      if (eVieja) avisos.push(`la direccion vieja en ${idioma} no quedo redirigiendo: ${eVieja.message}`);
    }
  }

  refrescar();
  const cambios = [
    nombre !== antes.nombre ? `nombre: «${antes.nombre}» a «${nombre}»` : null,
    babosa !== antes.babosa ? `direccion: /${antes.babosa} a /${babosa} (la vieja redirige)` : null,
    seccion !== antes.seccion ? `seccion: ${antes.seccion} a ${seccion}` : null,
  ].filter(Boolean);

  if (avisos.length) return { error: avisos.join('. ') };
  return { ok: cambios.length ? `Guardado. ${cambios.join(' · ')}.` : 'Sin cambios que guardar.' };
}

/**
 * El nombre y la direccion de la categoria en los OTROS idiomas.
 *
 * Mismo patron que «Otros idiomas» de la ficha de una tour: el original al
 * lado, para no traducir de memoria.
 *
 * Vacio = se borra la traduccion y vuelve a mostrarse el original. No se
 * guarda '' porque `texto_en` devolveria una cadena vacia y la categoria
 * saldria SIN NOMBRE en el menu de ese idioma.
 */
export async function guardarTraduccionesDeCategoria(_previo: Estado, datos: FormData): Promise<Estado> {
  const { db, destino, usuario } = await contextoPanel('categorias');
  if (usuario.rol !== 'admin') return { error: 'Solo un administrador puede traducir categorias.' };

  const id = texto(datos, 'categoria_id');
  if (!esUuid(id)) return { error: 'No vino la categoria.' };

  const otros = destino.idiomas.filter((i) => i !== destino.idioma_principal);
  const aPoner: { entidad: string; entidad_id: string; campo: string; idioma: string; texto: string }[] = [];
  const aBorrar: string[] = [];
  const problemas: string[] = [];
  let hechas = 0;

  for (const idioma of otros) {
    const nombre = texto(datos, `nombre_${idioma}`);
    if (nombre) { aPoner.push({ entidad: 'categoria', entidad_id: id, campo: 'nombre', idioma, texto: nombre }); hechas++; }
    else aBorrar.push(idioma);

    /* La direccion de ese idioma. Vacia: no se toca lo que hubiera — borrar
       una direccion vigente dejaria la categoria servida en la babosa del
       catalogo sin que nadie lo pidiera. */
    const babosaCruda = texto(datos, `babosa_${idioma}`);
    if (babosaCruda) {
      const limpia = babosaDe(babosaCruda);
      if (!limpia) { problemas.push(`la direccion en ${idioma} no sirve`); continue; }
      const motivo = await fijarRuta(db, destino.id, id, idioma, limpia);
      if (motivo) problemas.push(motivo);
    }
  }

  if (aPoner.length) {
    const { error } = await db.from('dst_traduccion')
      .upsert(aPoner, { onConflict: 'entidad,entidad_id,campo,idioma' });
    if (error) problemas.push(error.message);
  }
  for (const idioma of aBorrar) {
    await db.from('dst_traduccion').delete()
      .eq('entidad', 'categoria').eq('entidad_id', id).eq('campo', 'nombre').eq('idioma', idioma);
  }

  refrescar();
  if (problemas.length) return { error: problemas.join('. ') };
  return { ok: `Guardado: ${hechas} de ${otros.length} idiomas traducidos.` };
}
