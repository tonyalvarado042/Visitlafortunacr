import { notFound, permanentRedirect, redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { destinoActual, categoriasDe, categoriaEnCualquierIdioma, type Categoria, type Destino } from '@/lib/destino';
import { fichasDelDirectorio, type EnElDirectorio } from '@/lib/directorio';
import { t, lugares, type Idioma } from '@/lib/idiomas';
import { Barra } from '@/componentes/Barra';
import { Pie } from '@/componentes/Pie';
import { TarjetaNegocio } from '@/componentes/TarjetaNegocio';
import { CampoBusqueda } from '@/componentes/CampoBusqueda';
import { alternativas, rutasDeCategoria, type Alterna } from '@/lib/seo';
import {
  babosaDeSeccion, seccionPorBabosa, rutasDeSeccion, MINIMO_CATEGORIAS_PARA_PAGINA,
} from '@/lib/secciones';

export const dynamic = 'force-dynamic';

type Parametros = Promise<{ idioma: Idioma; categoria: string }>;

/*
 * UNA SOLA RUTA, DOS LISTADOS: una categoría («Restaurantes») o una SECCIÓN
 * entera («Comer y beber», con sus doce lugares y las categorías de filtro).
 *
 * ⚠️ POR QUÉ LA SECCIÓN NO TIENE SU PROPIA CARPETA. Las carpetas de Next son
 * estáticas y la babosa de la sección cambia por idioma: `/es/donde-comer` y
 * `/en/where-to-eat`. Una carpeta `donde-comer/` solo serviría en español.
 * Acá, además, el orden lo decido yo — y la categoría se busca PRIMERO, así
 * que una sección nunca puede tapar una categoría de Tony. Ver lib/secciones.
 */

/** Qué se está mirando. Lo resuelve la babosa de la dirección. */
type Vista = {
  /** El h1 y el título de la pestaña. */
  titulo: string;
  /** A qué sección pertenece, para las pastillas hermanas. */
  seccion: string;
  /** La categoría abierta, o null cuando se ven TODAS las de la sección. */
  categoriaId: string | null;
  /** Las rutas de esta misma página en cada idioma (hreflang y selector). */
  rutas: Alterna[];
};

/**
 * De la babosa de la dirección a la vista, o a donde haya que ir.
 *
 * Puede redirigir o dar 404: son las dos salidas legítimas de una dirección
 * que no corresponde a nada de este idioma.
 */
async function resolver(
  destino: Destino, idioma: Idioma, babosa: string, categorias: Categoria[],
): Promise<Vista> {
  /* 1. ¿Es una categoría? Se pregunta PRIMERO, siempre. */
  const cat = categorias.find((c) => c.babosa === babosa);
  if (cat) {
    /* Y si esa babosa ERA la de una sección, la sección se quedó sin página
       y nadie se iba a enterar. Probado a propósito poniéndole 'restaurantes'
       de babosa a comer_beber: la categoría sigue abriendo —que es lo que
       tiene que pasar— y /es/donde-comer pasa a dar 404. Callado, eso es una
       sección que desaparece del sitio sin aviso. */
    if (seccionPorBabosa(babosa, idioma)) {
      console.error(
        `La babosa «${babosa}» es de la categoría «${cat.nombre}» Y de una sección. ` +
        'Gana la categoría; la sección se quedó sin página. Cambiale la babosa en lib/secciones.ts.',
      );
    }
    return {
      titulo: cat.nombre,
      seccion: cat.seccion,
      categoriaId: cat.categoria_id,
      rutas: await rutasDeCategoria(destino.id, cat.categoria_id),
    };
  }

  /* 2. ¿Es una sección? */
  const seccion = seccionPorBabosa(babosa, idioma);
  if (seccion) {
    const conContenido = categorias.filter((c) => c.seccion === seccion && c.total > 0);
    /* Con una sola categoría con contenido, la sección mostraría exactamente
       la misma lista que esa categoría en otra dirección: dos páginas iguales
       compitiendo entre ellas. Mejor una sola, y que esta lleve allá.
       Temporal (307) a propósito: el día que se publique un lugar en otra
       categoría de la sección, esta dirección vuelve a ser una página. */
    if (conContenido.length === 1) redirect(`/${idioma}/${conContenido[0].babosa}`);
    if (conContenido.length === 0) notFound();
    return {
      titulo: t(seccion, idioma),
      seccion,
      categoriaId: null,
      rutas: rutasDeSeccion(destino, seccion),
    };
  }

  /* 3. La babosa de OTRO idioma no da 404: redirige a la de este.
   *
   * El selector de idiomas estuvo armando `/en/tours-aventura` —la babosa
   * española sobre el sitio inglés— durante quién sabe cuánto, así que esas
   * direcciones andan sueltas por ahí: compartidas, guardadas, y puede que
   * rastreadas por Google. Arreglar el selector evita que se generen MÁS;
   * esto cura las que ya existen.
   *
   * Es 308 (permanente) a propósito, al revés que el de los idiomas
   * apagados: una babosa en el idioma equivocado nunca va a ser la correcta,
   * y acá sí conviene que Google la reemplace de una. */
  const enOtroIdioma = await categoriaEnCualquierIdioma(destino, babosa);
  const aqui = enOtroIdioma ? categorias.find((c) => c.categoria_id === enOtroIdioma) : null;
  if (aqui) permanentRedirect(`/${idioma}/${aqui.babosa}`);

  /* Lo mismo para las secciones: `/en/donde-comer` -> `/en/where-to-eat`. */
  for (const otro of destino.idiomas) {
    const sec = seccionPorBabosa(babosa, otro);
    const aca = sec ? babosaDeSeccion(sec, idioma) : null;
    if (aca) permanentRedirect(`/${idioma}/${aca}`);
  }

  notFound();
}

export async function generateMetadata({ params }: { params: Parametros }): Promise<Metadata> {
  const { idioma, categoria } = await params;
  try {
    const destino = await destinoActual();
    const categorias = await categoriasDe(destino, idioma);

    const cat = categorias.find((c) => c.babosa === categoria);
    if (cat) {
      return {
        title: `${cat.nombre} · ${destino.nombre}`,
        description: `${cat.total} ${lugares(cat.total, idioma)} · ${cat.nombre} · ${destino.nombre}, ${destino.pais_nombre}`,
        alternates: alternativas(idioma, await rutasDeCategoria(destino.id, cat.categoria_id)),
      };
    }

    const seccion = seccionPorBabosa(categoria, idioma);
    if (!seccion) return {};
    const total = categorias
      .filter((c) => c.seccion === seccion)
      .reduce((suma, c) => suma + c.total, 0);
    return {
      title: `${t(seccion, idioma)} · ${destino.nombre}`,
      description: `${total} ${lugares(total, idioma)} · ${t(seccion, idioma)} · ${destino.nombre}, ${destino.pais_nombre}`,
      alternates: alternativas(idioma, rutasDeSeccion(destino, seccion)),
    };
  } catch {
    return {};
  }
}

export default async function Listado({ params }: { params: Parametros }) {
  const { idioma, categoria } = await params;
  const destino = await destinoActual();
  const categorias = await categoriasDe(destino, idioma);
  const vista = await resolver(destino, idioma, categoria, categorias);

  /* Negocios Y TOURS. Antes solo negocios, así que un tour existía en su
     ficha y en ningún otro lado — y un OPERADOR, que no tiene ficha propia,
     no aportaba nada visible al directorio. Lo encontró Tony buscando sus
     propios tours y no encontrándolos. */
  const todas = await fichasDelDirectorio(destino, idioma, categorias);

  /* ⚠️ SE PREGUNTA POR `categorias`, NO POR `categoria_id`. Desde que una
     tour puede estar en varias, `categoria_id` es solo la PRINCIPAL: filtrar
     por ella dejaría afuera del listado exactamente a las tours que alguien
     agregó a mano a esta categoría — que son las que más esperaría ver ahí.
     Lo mismo para la sección: una tour cuya principal es «Tours de aventura»
     y que además está en «Puentes colgantes» pertenece a las dos secciones. */
  const seccionDe = new Map(categorias.map((c) => [c.categoria_id, c.seccion]));
  const deLaSeccion = todas.filter((f) =>
    f.categorias.some((id) => seccionDe.get(id) === vista.seccion));

  const fichas = (vista.categoriaId
    ? todas.filter((f) => f.categorias.includes(vista.categoriaId!))
    : deLaSeccion
  ).sort((a: EnElDirectorio, b: EnElDirectorio) =>
    Number(b.es_destacado) - Number(a.es_destacado) ||
    (b.promedio_calificacion ?? 0) - (a.promedio_calificacion ?? 0)
  );

  const hermanas = categorias.filter((c) => c.seccion === vista.seccion && c.total > 0);
  const babosaSeccion = babosaDeSeccion(vista.seccion, idioma);

  /* La pastilla «Todos» — el arreglo entero cabe en estas tres líneas.
     Se cuenta la LISTA, no la suma de las pastillas: el día que un lugar
     pueda estar en varias categorías, sumarlas daría de más y «Todos 14»
     sobre doce tarjetas sería mentira. */
  const conTodos = babosaSeccion !== null && hermanas.length >= MINIMO_CATEGORIAS_PARA_PAGINA;
  const rutaTodos = `/${idioma}/${babosaSeccion}`;
  const activa = { background: 'var(--blanco)', color: 'var(--negro)', borderColor: 'var(--blanco)' };

  return (
    <>
      {/* Las rutas de ESTA página en cada idioma — las mismas que se le
          declaran a Google. Sin esto el selector armaba `/en/tours-aventura`,
          que no existe: en inglés la categoría es `adventure-tours`. */}
      <Barra destino={destino} idioma={idioma} categorias={categorias}
             rutaActual={`/${categoria}`} rutas={vista.rutas} />

      <div className="caja">
        <div className="migas">
          <Link href={`/${idioma}`}>{t('inicio', idioma)}</Link>
          <span>/</span>
          {/* Con página de sección, la categoría cuelga de ella: Inicio /
              Comer y beber / Restaurantes. Es como está armado el sitio, y es
              la segunda forma —además de la pastilla— de llegar a la lista
              completa desde adentro de un filtro. */}
          {conTodos && vista.categoriaId && (
            <>
              <Link href={rutaTodos}>{t(vista.seccion, idioma)}</Link>
              <span>/</span>
            </>
          )}
          <span style={{ color: 'var(--blanco)' }}>{vista.titulo}</span>
        </div>
      </div>

      <section style={{ paddingTop: 26 }}>
        <div className="caja">
          <h1>{vista.titulo}</h1>
          <p style={{ color: 'var(--humo)', marginTop: 14 }}>
            {fichas.length} {lugares(fichas.length, idioma)} · {destino.nombre}
          </p>

          {/* El buscador tambien aca, y no solo en la portada.
              En un directorio la mayoria NO entra por el inicio: entra por
              Google directo a una categoria. Sin esto, quien no encuentra lo
              suyo en esta lista no tiene a donde ir — y nadie vuelve al
              inicio a buscar, se va. Es el mismo componente de la portada:
              un formulario GET que navega a la portada con ?q= */}
          <div className="busqueda-categoria">
            <CampoBusqueda idioma={idioma} />
          </div>

          {hermanas.length > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 26, flexWrap: 'wrap' }}>
              {conTodos && (
                <Link href={rutaTodos} className="boton boton-linea"
                      style={vista.categoriaId === null ? activa : undefined}>
                  {t('todos', idioma)} <span style={{ opacity: .5 }}>{deLaSeccion.length}</span>
                </Link>
              )}
              {hermanas.map((c) => (
                <Link key={c.categoria_id} href={`/${idioma}/${c.babosa}`}
                      className="boton boton-linea"
                      style={c.categoria_id === vista.categoriaId ? activa : undefined}>
                  {c.nombre} <span style={{ opacity: .5 }}>{c.total}</span>
                </Link>
              ))}
            </div>
          )}

          <div className="rejilla" style={{ marginTop: 34 }}>
            {fichas.map((n) => <TarjetaNegocio key={n.id} negocio={n} idioma={idioma} />)}
          </div>

          {fichas.length === 0 && (
            <div className="vacio" style={{ marginTop: 34 }}>
              <h3>{vista.titulo}</h3>
              <p>{t('sin_lugares', idioma)}</p>
            </div>
          )}
        </div>
      </section>

      <Pie destino={destino} categorias={categorias} idioma={idioma} />
    </>
  );
}
