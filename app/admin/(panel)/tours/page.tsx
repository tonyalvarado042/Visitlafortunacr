import { SECCIONES_DE_TOUR } from '@/lib/comercio';
import Link from 'next/link';
import { contextoPanel } from '@/lib/admin/contexto';
import { dinero } from '@/lib/admin/formato';
import { Aviso, Cabecera, Etiqueta, Vacio } from '@/componentes/admin/ui';
import { porQueNoSeVende } from '@/lib/se-vende';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { crearTour } from './acciones';

export const dynamic = 'force-dynamic';

const COLOR: Record<string, string> = { borrador: '#9CA3AF', pendiente: '#F59E0B', publicado: '#66BB2E', archivado: '#6B7280' };

/*
 * La lista de tours, filtrable por operador.
 *
 * El filtro no es un adorno: un operador con doce tours es lo normal, y sin
 * poder aislarlas no hay forma de revisar las suyas ni de ver cuáles le
 * quedaron en borrador. La ficha del operador enlaza directo acá.
 */
export default async function PaginaTours({
  searchParams,
}: {
  searchParams: Promise<{ operador?: string; fallo?: string }>;
}) {
  const { operador, fallo } = await searchParams;
  const { destino, db } = await contextoPanel('tours');
  const [{ data: tours }, { data: operadores }, { data: categorias }] = await Promise.all([
    (operador
      ? db.from('dst_tour').select('id, nombre, estado, es_destacado, duracion_horas, precio_adulto_usd, precio_neto_usd, comision_pct, total_reservas, contrato_id, negocio:dst_negocio(nombre, estado_publicacion, esta_cerrado, vende_por_aqui), contrato:dst_contrato(esta_activo, vigencia_desde, vigencia_hasta)').eq('destino_id', destino.id).eq('negocio_id', operador).order('nombre')
      : db.from('dst_tour').select('id, nombre, estado, es_destacado, duracion_horas, precio_adulto_usd, precio_neto_usd, comision_pct, total_reservas, contrato_id, negocio:dst_negocio(nombre, estado_publicacion, esta_cerrado, vende_por_aqui), contrato:dst_contrato(esta_activo, vigencia_desde, vigencia_hasta)').eq('destino_id', destino.id).order('nombre')
    ),
    db.from('dst_negocio').select('id, nombre').eq('destino_id', destino.id).neq('estado_publicacion', 'archivado').order('nombre'),
    db.from('dst_destino_categoria').select('orden, categoria:dst_categoria(id, nombre, seccion)').eq('destino_id', destino.id).eq('es_visible', true).order('orden'),
  ]);
  const uno = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);
  const elOperador = operador ? (operadores ?? []).find((o) => o.id === operador) ?? null : null;
  const cats = (categorias ?? []).map((c) => uno(c.categoria) as { id: string; nombre: string; seccion: string } | null).filter((c): c is { id: string; nombre: string; seccion: string } => !!c && SECCIONES_DE_TOUR.includes(c.seccion));

  /* Las publicadas que no se venden, para el aviso de arriba. Se calcula con
     la misma función que la columna: una sola regla. */
  const sinVender = (tours ?? [])
    .filter((t) => t.estado === 'publicado')
    .map((t) => {
      const n = uno(t.negocio) as { estado_publicacion: string; esta_cerrado: boolean; vende_por_aqui: boolean } | null;
      const c = uno(t.contrato) as { esta_activo: boolean; vigencia_desde: string | null; vigencia_hasta: string | null } | null;
      const v = porQueNoSeVende({
        reservas_activas: destino.reservas_activas,
        estado: t.estado,
        negocio_id: n ? 'hay' : null,
        negocio_estado: n?.estado_publicacion ?? null,
        negocio_cerrado: n?.esta_cerrado ?? null,
        vende_por_aqui: n?.vende_por_aqui ?? null,
        contrato_id: t.contrato_id ?? null,
        contrato_activo: c?.esta_activo ?? null,
        vigencia_desde: c?.vigencia_desde ?? null,
        vigencia_hasta: c?.vigencia_hasta ?? null,
        precio_adulto_usd: t.precio_adulto_usd,
      });
      return { id: t.id, nombre: t.nombre, rotulo: v.rotulo, se_vende: v.se_vende };
    })
    .filter((x) => !x.se_vende);

  return (
    <>
      {fallo && (
        <Aviso tipo="mal">
          {fallo}
        </Aviso>
      )}
      <Cabecera
        titulo={elOperador ? `Tours de ${elOperador.nombre}` : 'Tours'}
        sub={`${tours?.length ?? 0} tours · ${tours?.filter((t) => t.estado === 'publicado').length ?? 0} publicados · ${sinVender.length} publicadas que NO se pueden reservar`}
      />
      {/* ⚠️ ESTO ES LO QUE FALTABA EL 20 DE NOVIEMBRE DE 2026.
          Hanging Bridges estaba publicada, con foto y con precio, y no se
          podía reservar porque no tenía contrato amarrado. El panel decía
          «publicado» —que es cierto— y nada más. Había que entrar a la tour y
          bajar hasta el desplegable del contrato para enterarse.
          Una tour publicada que no se puede reservar es plata parada: la
          gente la ve, la quiere, y no hay botón. */}
      {sinVender.length > 0 && (
        <Aviso tipo="mal">
          <strong>{sinVender.length} {sinVender.length === 1 ? 'tour publicada no se puede reservar' : 'tours publicadas no se pueden reservar'}.</strong>{' '}
          Están a la vista en el sitio y no tienen botón de reserva:{' '}
          {sinVender.map((x, i) => (
            <span key={x.id}>
              {i > 0 && ' · '}
              <Link href={`/admin/tours/${x.id}`}>{x.nombre}</Link> ({x.rotulo})
            </span>
          ))}
        </Aviso>
      )}

      {/* Filtrar por operador. Es un <form> con GET y nada de JavaScript: el
          filtro queda en la dirección, así que se puede guardar y compartir. */}
      <div className="tarjeta" style={{ marginBottom: 16 }}>
        <form className="campos" style={{ gridTemplateColumns: '1fr auto', alignItems: 'end' }}>
          <div className="campo">
            <label htmlFor="f-op">Operador</label>
            <select id="f-op" name="operador" defaultValue={operador ?? ''}>
              <option value="">Todos los operadores</option>
              {operadores?.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
          </div>
          <div className="campo">
            <button className="boton" type="submit">Filtrar</button>
          </div>
        </form>
        {elOperador && (
          <p className="gris" style={{ fontSize: 13, margin: '12px 0 0' }}>
            Viendo solo las de <strong>{elOperador.nombre}</strong>.{' '}
            <Link href="/admin/tours">Ver todas</Link>
          </p>
        )}
      </div>

      <div className="lado">
        <div className="tarjeta desliza">
          {!tours?.length ? <Vacio texto={elOperador ? `${elOperador.nombre} todavía no tiene tours. Creale la primera acá al lado.` : 'Todavía no hay tours. El primero es el que la IA va a poder ofrecer y el planificador va a poder poner en un itinerario.'} /> : (
            <table className="tabla">
              <thead><tr><th>Tour</th><th>Operador</th><th>Estado</th><th>¿Se puede reservar?</th><th className="num">Horas</th><th className="num">Adulto</th><th className="num">Neto</th><th className="num">Comisión</th><th className="num">Reservas</th></tr></thead>
              <tbody>{tours.map((t) => {
                const n = uno(t.negocio) as { nombre: string; estado_publicacion: string; esta_cerrado: boolean; vende_por_aqui: boolean } | null;
                const c = uno(t.contrato) as { esta_activo: boolean; vigencia_desde: string | null; vigencia_hasta: string | null } | null;
                /* ⚠️ La MISMA función que usa la ficha de la tour. Una sola
                   regla: si la lista dijera una cosa y la ficha otra, no se
                   sabría a cuál creerle. Ver `lib/se-vende.ts`. */
                const v = porQueNoSeVende({
                  reservas_activas: destino.reservas_activas,
                  estado: t.estado,
                  negocio_id: n ? 'hay' : null,
                  negocio_estado: n?.estado_publicacion ?? null,
                  negocio_cerrado: n?.esta_cerrado ?? null,
                  vende_por_aqui: n?.vende_por_aqui ?? null,
                  contrato_id: t.contrato_id ?? null,
                  contrato_activo: c?.esta_activo ?? null,
                  vigencia_desde: c?.vigencia_desde ?? null,
                  vigencia_hasta: c?.vigencia_hasta ?? null,
                  precio_adulto_usd: t.precio_adulto_usd,
                });
                return (
                  <tr key={t.id}>
                    <td><Link className="fuerte" href={`/admin/tours/${t.id}`}>{t.nombre}</Link>{t.es_destacado && <> <Etiqueta color="#FF6A00">destacado</Etiqueta></>}</td>
                    <td>{n?.nombre ?? '—'}</td>
                    <td><Etiqueta color={COLOR[t.estado]}>{t.estado}</Etiqueta></td>
                    {/* Lo grave es la tour PUBLICADA que no se puede reservar:
                        está a la vista de todo el mundo y no hay botón. La que
                        todavía es borrador no es un problema, es un borrador. */}
                    <td title={v.arreglo ?? ''}>
                      {v.se_vende
                        ? <Etiqueta color="#66BB2E">sí</Etiqueta>
                        : t.estado === 'publicado'
                          ? <Etiqueta color="#C0392B">{v.rotulo}</Etiqueta>
                          : <Etiqueta suave>{v.rotulo}</Etiqueta>}
                    </td>
                    <td className="num">{t.duracion_horas ?? '—'}</td>
                    <td className="num">{dinero(t.precio_adulto_usd)}</td>
                    <td className="num">{dinero(t.precio_neto_usd)}</td>
                    <td className="num">{t.comision_pct != null ? `${t.comision_pct}%` : '—'}</td>
                    <td className="num">{t.total_reservas}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          )}
        </div>
        <div className="tarjeta">
          <h2>Nuevo tour</h2>
          <form action={crearTour} className="campos" style={{ gridTemplateColumns: '1fr' }}>
            <div className="campo"><label>Nombre</label><input name="nombre" required /></div>
            <div className="campo"><label>Operador</label><select name="negocio_id" defaultValue={operador ?? ''}><option value="">—</option>{operadores?.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select></div>
            <div className="campo"><label>Categoría</label><select name="categoria_id" defaultValue=""><option value="">—</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
            <div className="campo"><label>Precio adulto USD</label><input type="number" step="0.01" name="precio_adulto_usd" /></div>
            <div className="campo"><label>Comisión %</label><input type="number" step="0.5" name="comision_pct" defaultValue={destino.comision_por_defecto ?? ''} /></div>
            <BotonAccion>Crear como borrador</BotonAccion>
          </form>
        </div>
      </div>
    </>
  );
}
