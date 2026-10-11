import Link from 'next/link';
import { contextoPanel } from '@/lib/admin/contexto';
import { relativo } from '@/lib/admin/formato';
import { Cabecera, Etiqueta, Vacio } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { crearGuia, tituloDeLaColumna } from './acciones';
import { Columna, type PiezaAdmin } from './Columna';
import { NuevaGuiaIA } from './NuevaGuiaIA';

export const dynamic = 'force-dynamic';

const COLOR: Record<string, string> = { borrador: '#9CA3AF', pendiente: '#F59E0B', publicado: '#66BB2E', archivado: '#6B7280' };

export default async function PaginaGuias() {
  const { destino, db } = await contextoPanel('guias');
  const { data } = await db.from('dst_guia').select('id, titulo, tipo, estado, dias, publico, total_vistas, actualizado_en, publicado_en, autor:dst_usuario(nombre)').eq('destino_id', destino.id).order('actualizado_en', { ascending: false });
  const uno = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);

  /* Lo que hace falta para la columna de la derecha del blog: lo que ya esta
     puesto, y las tres listas para elegir que agregar. */
  const [{ data: piezas }, { data: negocios }, { data: experiencias }] = await Promise.all([
    db.from('dst_lateral')
      .select('id, tipo, esta_activo, orden, titulo, url, negocio:dst_negocio(nombre), experiencia:dst_itinerario(titulo), guia:dst_guia(titulo)')
      .eq('destino_id', destino.id).order('orden'),
    db.from('dst_negocio').select('id, nombre')
      .eq('destino_id', destino.id).eq('estado_publicacion', 'publicado').order('nombre'),
    db.from('dst_itinerario').select('id, titulo')
      .eq('destino_id', destino.id).eq('es_publico', true).order('titulo'),
  ]);

  return (
    <>
      <Cabecera titulo="Guías" sub={`${data?.length ?? 0} piezas · ${data?.filter((g) => g.estado === 'publicado').length ?? 0} publicadas`} />
      <div className="lado">
        <div className="tarjeta desliza">
          {!data?.length ? <Vacio texto="Todavía no hay guías. Pedile a la IA el primer borrador con el catálogo real, y después lo revisás." /> : (
            <table className="tabla">
              <thead><tr><th>Título</th><th>Tipo</th><th>Estado</th><th className="num">Vistas</th><th>Autor</th><th>Actualizada</th></tr></thead>
              <tbody>{data.map((g) => {
                const a = uno(g.autor) as { nombre: string } | null;
                return (
                  <tr key={g.id}>
                    <td><Link className="fuerte" href={`/admin/guias/${g.id}`}>{g.titulo}</Link>{g.publico ? <div className="gris">para {g.publico}</div> : null}</td>
                    <td>{g.tipo}{g.dias ? ` · ${g.dias} días` : ''}</td>
                    <td><Etiqueta color={COLOR[g.estado]}>{g.estado}</Etiqueta></td>
                    <td className="num">{g.total_vistas}</td>
                    <td>{a?.nombre ?? 'IA'}</td>
                    <td className="gris">{relativo(g.actualizado_en)}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          )}
        </div>
        <div>
          <div className="tarjeta">
            <h2>Nueva guía con IA</h2>
            <NuevaGuiaIA idiomas={destino.idiomas} principal={destino.idioma_principal} />
          </div>
          {/* La columna de la derecha del blog. Se arma una vez y sale en
              TODOS los articulos: es el area de widgets del blog, y es lo
              que se le puede vender a un negocio premium. */}
          <div className="tarjeta">
            <h2>Columna del blog <small>sale en todos los artículos</small></h2>
            <form action={tituloDeLaColumna} className="campos" style={{ gridTemplateColumns: '1fr', marginBottom: 14 }}>
              <div className="campo">
                <label htmlFor="lat-tit">Título del bloque</label>
                <input id="lat-tit" name="lateral_titulo" defaultValue={destino.lateral_titulo ?? ''}
                       placeholder="También te puede servir" />
              </div>
              <BotonAccion clase="boton chico secundario">Guardar el título</BotonAccion>
            </form>
            <Columna
              piezas={((piezas ?? []) as unknown[]).map((p) => {
                const x = p as Record<string, unknown>;
                return { ...x, negocio: uno(x.negocio as never), experiencia: uno(x.experiencia as never), guia: uno(x.guia as never) } as PiezaAdmin;
              })}
              negocios={negocios ?? []}
              experiencias={experiencias ?? []}
              guias={(data ?? []).filter((g) => g.estado === 'publicado').map((g) => ({ id: g.id, titulo: g.titulo }))}
            />
          </div>

          <div className="tarjeta">
            <h2>Nueva guía en blanco</h2>
            <form action={crearGuia} className="campos" style={{ gridTemplateColumns: '1fr' }}>
              <div className="campo"><input name="titulo" placeholder="Título" required /></div>
              <div className="campo"><select name="tipo" defaultValue="guia"><option value="guia">Guía</option><option value="itinerario">Itinerario</option><option value="comparativa">Comparativa</option><option value="como_llegar">Cómo llegar</option><option value="lista">Lista</option></select></div>
              <BotonAccion clase="boton secundario">Crear</BotonAccion>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
