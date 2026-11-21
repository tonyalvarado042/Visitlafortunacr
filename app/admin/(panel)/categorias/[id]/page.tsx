import Link from 'next/link';
import { notFound } from 'next/navigation';
import { contextoPanel } from '@/lib/admin/contexto';
import { Aviso, Cabecera, Etiqueta } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { NOMBRE_PROPIO } from '@/lib/idiomas';
import { guardarCategoria } from '../acciones';
import { EditarCategoria, TraducirCategoria } from './Formularios';

export const dynamic = 'force-dynamic';

const SECCIONES: Record<string, string> = {
  que_hacer: 'Qué hacer',
  tours: 'Tours',
  donde_dormir: 'Dónde dormir',
  comer_beber: 'Comer y beber',
  explorar: 'Explorar',
  transporte: 'Transporte',
};

/*
 * La ficha de una categoría.
 *
 * Nace el 21 de noviembre de 2026, porque Tony miró la pantalla de
 * Categorías y dijo: «no veo traducciones, error total porque todo está
 * traducido, ni botón para editar categorías en la sección categorías».
 *
 * La lista sigue teniendo la edición rápida —nombre local, orden, si se ve—,
 * que es lo que uno cambia de pasada. Lo que necesita pensarse —el nombre
 * del catálogo, la dirección, la sección y los otros idiomas— vive acá, con
 * espacio para explicar qué hace cada cosa.
 */
export default async function FichaCategoria({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { destino, db, usuario } = await contextoPanel('categorias');
  const esAdmin = usuario.rol === 'admin';

  const { data: cat } = await db.from('dst_categoria')
    .select('id, nombre, babosa, seccion').eq('id', id).maybeSingle();
  if (!cat) notFound();

  const [{ data: enganche }, { data: traducciones }, { data: rutas }, { count: negocios }, { count: tours }] =
    await Promise.all([
      db.from('dst_destino_categoria')
        .select('orden, nombre_local, es_visible')
        .eq('destino_id', destino.id).eq('categoria_id', id).maybeSingle(),
      db.from('dst_traduccion')
        .select('idioma, texto')
        .eq('entidad', 'categoria').eq('entidad_id', id).eq('campo', 'nombre'),
      db.from('dst_ruta')
        .select('idioma, babosa, es_vigente')
        .eq('destino_id', destino.id).eq('entidad', 'categoria').eq('entidad_id', id),
      db.from('dst_negocio').select('id', { count: 'exact', head: true })
        .eq('destino_id', destino.id).eq('categoria_id', id).neq('estado_publicacion', 'archivado'),
      /* Por la tabla puente: desde que una tour puede estar en varias, contar
         `dst_tour.categoria_id` dejaría fuera a las que la tienen de
         secundaria — y son tours que SÍ salen en este listado. */
      db.from('dst_tour_categoria').select('tour_id', { count: 'exact', head: true })
        .eq('categoria_id', id),
    ]);

  const otrosIdiomas = destino.idiomas.filter((i) => i !== destino.idioma_principal);

  /* Lo cargado hoy, por idioma. Las rutas jubiladas no entran: el campo
     muestra la que se sirve, no el historial. */
  const actual: Record<string, { nombre: string; babosa: string }> = {};
  for (const i of otrosIdiomas) {
    actual[i] = {
      nombre: (traducciones ?? []).find((t) => String(t.idioma).trim() === i)?.texto ?? '',
      babosa: (rutas ?? []).find((r) => String(r.idioma).trim() === i && r.es_vigente)?.babosa ?? '',
    };
  }

  const jubiladas = (rutas ?? []).filter((r) => !r.es_vigente);
  const adentro = (negocios ?? 0) + (tours ?? 0);

  return (
    <>
      <Cabecera
        titulo={enganche?.nombre_local || cat.nombre}
        migas={[{ ruta: '/admin/categorias', nombre: 'Categorías' }]}
        sub={
          <>
            <Etiqueta suave>{SECCIONES[cat.seccion] ?? cat.seccion}</Etiqueta>{' '}
            <Etiqueta suave>/{cat.babosa}</Etiqueta>
            {' · '}{negocios ?? 0} negocios · {tours ?? 0} tours
            {!enganche?.es_visible && <> <Etiqueta color="alerta">escondida</Etiqueta></>}
          </>
        }
      />

      {!esAdmin && <Aviso tipo="info">Solo un administrador puede tocar las categorías.</Aviso>}

      {!enganche && (
        <Aviso tipo="mal">
          Esta categoría existe en el catálogo pero <strong>no está enganchada a {destino.nombre}</strong>.
          Se engancha desde <Link href="/admin/categorias">la lista</Link>.
        </Aviso>
      )}

      <EditarCategoria id={cat.id} nombre={cat.nombre} babosa={cat.babosa}
                       seccion={cat.seccion} conContenido={adentro} />

      <TraducirCategoria id={cat.id} nombre={cat.nombre} babosa={cat.babosa}
                         idiomas={otrosIdiomas}
                         nombreDeIdioma={NOMBRE_PROPIO as unknown as Record<string, string>}
                         actual={actual} />

      {enganche && (
        <form action={guardarCategoria} className="tarjeta">
          <h2>En {destino.nombre} <small>lo que vale solo para este destino</small></h2>
          <input type="hidden" name="categoria_id" value={cat.id} />

          <div className="campos">
            <div className="campo">
              <label htmlFor="fc-local">Nombre en este destino</label>
              <input id="fc-local" name="nombre_local" defaultValue={enganche.nombre_local ?? ''}
                     placeholder={cat.nombre} disabled={!esAdmin} />
              {/* ⚠️ LA TRAMPA QUE HAY QUE DECIR EN VOZ ALTA. En la base esto es
                  `coalesce(nombre_local, texto_en(...))`: el nombre local gana
                  SOBRE LA TRADUCCIÓN, en todos los idiomas. Llenarlo para
                  acomodar algo en español le apaga el inglés y el portugués a
                  esta categoría, y nada avisa. Está acá, debajo del campo,
                  porque es donde alguien lo va a leer. */}
              <small>
                <strong>Ojo: esto le gana a las traducciones de arriba, en todos los idiomas.</strong>{' '}
                Si lo llenás, la categoría se va a llamar así también en inglés y en portugués.
                Para cambiar solo el español, cambiá el nombre del catálogo.
              </small>
            </div>

            <div className="campo">
              <label htmlFor="fc-orden">Orden</label>
              <input id="fc-orden" type="number" name="orden" defaultValue={enganche.orden}
                     disabled={!esAdmin} />
              <small>De menor a mayor dentro de su sección.</small>
            </div>

            <div className="campo">
              <label htmlFor="fc-visible">Se ve</label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 500 }}>
                <input id="fc-visible" type="checkbox" name="es_visible" value="1"
                       defaultChecked={enganche.es_visible} disabled={!esAdmin}
                       style={{ width: 'auto', accentColor: 'var(--naranja)' }} />
                Mostrarla en el sitio
              </label>
              <small>
                Escondida no borra nada, pero deja sus {adentro} lugares fuera del directorio.
              </small>
            </div>
          </div>

          <div className="acciones-fila" style={{ marginTop: 12 }}>
            <BotonAccion clase="boton">Guardar</BotonAccion>
          </div>
        </form>
      )}

      {jubiladas.length > 0 && (
        <div className="tarjeta">
          <h2>Direcciones jubiladas <small>{jubiladas.length}</small></h2>
          <p className="gris" style={{ fontSize: 13, lineHeight: 1.6 }}>
            Direcciones que esta categoría tuvo antes. <strong>No dan 404</strong>: el sitio
            manda un 301 a la de ahora, así que los enlaces compartidos y lo que Google ya
            tenía indexado siguen llegando.
          </p>
          <table className="tabla">
            <tbody>
              {jubiladas.map((r) => (
                <tr key={`${r.idioma}-${r.babosa}`}>
                  <td><Etiqueta suave>{String(r.idioma).trim().toUpperCase()}</Etiqueta></td>
                  <td><code style={{ fontSize: 12 }}>/{String(r.idioma).trim()}/{r.babosa}</code></td>
                  <td className="gris">→ /{String(r.idioma).trim()}/{actual[String(r.idioma).trim()]?.babosa || cat.babosa}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
