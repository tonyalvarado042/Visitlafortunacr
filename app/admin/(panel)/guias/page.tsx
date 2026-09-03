import Link from 'next/link';
import { contextoPanel } from '@/lib/admin/contexto';
import { relativo } from '@/lib/admin/formato';
import { Cabecera, Etiqueta, Vacio } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { crearGuia } from './acciones';
import { NuevaGuiaIA } from './NuevaGuiaIA';

export const dynamic = 'force-dynamic';

const COLOR: Record<string, string> = { borrador: '#9CA3AF', pendiente: '#F59E0B', publicado: '#66BB2E', archivado: '#6B7280' };

export default async function PaginaGuias() {
  const { destino, db } = await contextoPanel('guias');
  const { data } = await db.from('dst_guia').select('id, titulo, tipo, estado, dias, publico, total_vistas, actualizado_en, publicado_en, autor:dst_usuario(nombre)').eq('destino_id', destino.id).order('actualizado_en', { ascending: false });
  const uno = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);

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
