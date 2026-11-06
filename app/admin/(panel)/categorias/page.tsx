import Link from 'next/link';
import { contextoPanel } from '@/lib/admin/contexto';
import { Aviso, Cabecera, Etiqueta, Vacio } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { guardarCategoria, engancharCategoria, soltarCategoria } from './acciones';
import { NuevaCategoria } from './NuevaCategoria';

export const dynamic = 'force-dynamic';

const SECCIONES: Record<string, string> = {
  que_hacer: 'Qué hacer',
  tours: 'Tours',
  donde_dormir: 'Dónde dormir',
  comer_beber: 'Comer y beber',
  explorar: 'Explorar',
  transporte: 'Transporte',
};

type Fila = {
  categoria_id: string;
  nombre: string;
  babosa: string;
  seccion: string;
  orden: number;
  nombre_local: string | null;
  es_visible: boolean;
  negocios: number;
  tours: number;
};

export default async function PaginaCategorias() {
  const { destino, db, usuario } = await contextoPanel('categorias');
  const esAdmin = usuario.rol === 'admin';

  const [{ data: enganchadas }, { data: todas }, { data: negocios }, { data: tours }] = await Promise.all([
    db.from('dst_destino_categoria')
      .select('categoria_id, orden, nombre_local, es_visible, categoria:dst_categoria(id, nombre, babosa, seccion)')
      .eq('destino_id', destino.id).order('orden'),
    db.from('dst_categoria').select('id, nombre, babosa, seccion').order('seccion').order('nombre'),
    /* Se cuenta acá y no con un RPC porque son dos listas chicas: traerlas y
       contar en memoria evita una función más que mantener. */
    db.from('dst_negocio').select('categoria_id')
      .eq('destino_id', destino.id).neq('estado_publicacion', 'archivado'),
    db.from('dst_tour').select('categoria_id').eq('destino_id', destino.id),
  ]);

  const uno = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);
  const cuenta = (lista: { categoria_id: string | null }[] | null, id: string) =>
    (lista ?? []).filter((x) => x.categoria_id === id).length;

  const filas: Fila[] = (enganchadas ?? []).map((e) => {
    const c = uno(e.categoria) as { id: string; nombre: string; babosa: string; seccion: string };
    return {
      categoria_id: c.id,
      nombre: c.nombre,
      babosa: c.babosa,
      seccion: c.seccion,
      orden: e.orden,
      nombre_local: e.nombre_local,
      es_visible: e.es_visible,
      negocios: cuenta(negocios, c.id),
      tours: cuenta(tours, c.id),
    };
  });

  const yaEstan = new Set(filas.map((f) => f.categoria_id));
  const sueltas = (todas ?? []).filter((c) => !yaEstan.has(c.id));

  const porSeccion = Object.keys(SECCIONES)
    .map((s) => ({ seccion: s, filas: filas.filter((f) => f.seccion === s) }))
    .filter((g) => g.filas.length > 0);

  return (
    <>
      <Cabecera
        titulo="Categorías"
        sub={`${filas.length} en ${destino.nombre} · ${filas.filter((f) => !f.es_visible).length} escondidas`}
      />

      {!esAdmin && <Aviso tipo="info">Solo un administrador puede tocar las categorías.</Aviso>}

      <Aviso tipo="info">
        <strong>Una categoría escondida no borra nada, pero deja su contenido fuera del directorio.</strong>
        {' '}Los negocios y los tours que estén adentro siguen existiendo y sus fichas siguen
        abriendo — solo que nadie llega a ellas navegando. Y una categoría <strong>sin
        contenido tampoco sale en el menú</strong>, aunque esté visible: el sitio no muestra
        listados vacíos.
      </Aviso>

      <NuevaCategoria />

      {porSeccion.map((g) => (
        <div className="tarjeta" key={g.seccion}>
          <h2>{SECCIONES[g.seccion]} <small>{g.filas.length}</small></h2>
          <table className="tabla">
            <thead>
              <tr>
                <th>Categoría</th><th>Dirección</th><th className="num">Negocios</th>
                <th className="num">Tours</th><th className="num">Orden</th><th>Se ve</th><th></th>
              </tr>
            </thead>
            <tbody>
              {g.filas.map((f) => (
                <tr key={f.categoria_id}>
                  <td>
                    <strong>{f.nombre_local || f.nombre}</strong>
                    {f.nombre_local && <> <Etiqueta suave>catálogo: {f.nombre}</Etiqueta></>}
                  </td>
                  <td><code style={{ fontSize: 12 }}>/{f.babosa}</code></td>
                  <td className="num">{f.negocios || <span className="gris">—</span>}</td>
                  {/* Los tours cuentan IGUAL que los negocios: una categoría
                      que solo tiene tours es una categoría con contenido. */}
                  <td className="num">{f.tours || <span className="gris">—</span>}</td>
                  <td className="num">{f.orden}</td>
                  <td>{f.es_visible ? <Etiqueta suave>sí</Etiqueta> : <Etiqueta color="alerta">no</Etiqueta>}</td>
                  <td>
                    <form action={guardarCategoria} className="categoria-fila">
                      <input type="hidden" name="categoria_id" value={f.categoria_id} />
                      <input name="nombre_local" defaultValue={f.nombre_local ?? ''}
                             placeholder={f.nombre} aria-label="Nombre en este destino"
                             disabled={!esAdmin} />
                      <input type="number" name="orden" defaultValue={f.orden}
                             aria-label="Orden" disabled={!esAdmin} />
                      <label><input type="checkbox" name="es_visible" value="1"
                                    defaultChecked={f.es_visible} disabled={!esAdmin} /> Se ve</label>
                      <BotonAccion clase="boton tenue">Guardar</BotonAccion>
                    </form>
                    {/* Soltar solo si está vacía. Con contenido adentro, el
                        botón ni sale: la acción lo rechaza igual, pero
                        ofrecerlo sería ofrecer algo que no va a pasar. */}
                    {esAdmin && f.negocios + f.tours === 0 && (
                      <form action={soltarCategoria} style={{ marginTop: 6 }}>
                        <input type="hidden" name="categoria_id" value={f.categoria_id} />
                        <BotonAccion clase="boton tenue"
                                     confirmar={`Se suelta «${f.nombre}» de ${destino.nombre}. No se borra del catálogo: se puede volver a enganchar.`}>
                          Soltar
                        </BotonAccion>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* Las que existen en el catálogo y este destino no usa. Enganchar una
          es mejor que crear otra con el mismo nombre: dos categorías iguales
          parten el mismo contenido en dos listados. */}
      <div className="tarjeta">
        <h2>Del catálogo, sin enganchar <small>{sueltas.length}</small></h2>
        {!sueltas.length ? (
          <Vacio texto="Este destino usa todas las categorías del catálogo." />
        ) : (
          <table className="tabla">
            <tbody>
              {sueltas.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.nombre}</strong></td>
                  <td>{SECCIONES[c.seccion] ?? c.seccion}</td>
                  <td><code style={{ fontSize: 12 }}>/{c.babosa}</code></td>
                  <td>
                    <form action={engancharCategoria}>
                      <input type="hidden" name="categoria_id" value={c.id} />
                      <BotonAccion clase="boton tenue" >Enganchar</BotonAccion>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="gris" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
        La dirección de una categoría se traduce aparte, en <code>dst_ruta</code>. Una
        categoría nueva sale con la misma dirección en los tres idiomas hasta que se le
        cargue la traducción — funciona igual, solo que en inglés dirá lo mismo que en
        español. <Link href="/admin/negocios">Ver los negocios</Link> ·{' '}
        <Link href="/admin/tours">ver los tours</Link>.
      </p>
    </>
  );
}
