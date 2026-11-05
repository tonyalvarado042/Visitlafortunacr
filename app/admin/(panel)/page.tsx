import Link from 'next/link';
import { contextoPanel } from '@/lib/admin/contexto';
import { dinero, etapa, fecha, numero, relativo, TEMPERATURA, truncar } from '@/lib/admin/formato';
import { Cabecera, Etiqueta, Kpi, Vacio } from '@/componentes/admin/ui';

export const dynamic = 'force-dynamic';

type Tablero = {
  leads_hoy: number; leads_7d: number; leads_30d: number; leads_30d_previos: number;
  por_etapa: { etapa: string; total: number; valor_usd: number }[];
  valor_pipeline_usd: number; calientes: number; sin_responder: number;
  conversaciones_abiertas: number; esperando_equipo: number; escaladas: number; requieren_revision: number;
  tareas_vencidas: number; tareas_hoy: number;
  reservas_mes: { total: number; ventas_usd: number; comision_usd: number };
  ia_mes: { ejecuciones: number; costo_usd: number; errores: number };
  primera_respuesta_min: number | null; tasa_cierre_90d: number | null;
  seguimientos_pendientes: { programados: number; por_aprobar: number };
};

export default async function PaginaTablero() {
  const { usuario, destino, db } = await contextoPanel('tablero');

  const [{ data: tablero }, { data: calientes }, { data: esperando }, { data: tareas }, { data: pendientesManual }, { data: porAprobar }] = await Promise.all([
    db.rpc('tablero', { p_destino_id: destino.id }),
    db.from('dst_solicitud')
      .select('id, tipo, etapa, puntaje_ia, temperatura, siguiente_accion, siguiente_accion_el, valor_estimado_usd, creado_en, viajero:dst_viajero(nombre, email, whatsapp, llega_el)')
      .eq('destino_id', destino.id).not('etapa', 'in', '("reservado","perdido")')
      .order('puntaje_ia', { ascending: false, nullsFirst: false }).order('creado_en', { ascending: false }).limit(6),
    db.from('dst_conversacion')
      .select('id, canal, estado, atendida_por, requiere_revision, motivo_revision, ultimo_mensaje_en, resumen_ia, viajero:dst_viajero(nombre)')
      .eq('destino_id', destino.id).in('estado', ['esperando_equipo', 'escalada'])
      .order('ultimo_mensaje_en', { ascending: true }).limit(6),
    db.from('dst_tarea')
      .select('id, titulo, prioridad, vence_el, responsable_id, viajero_id, solicitud_id, viajero:dst_viajero(nombre)')
      .eq('destino_id', destino.id).eq('esta_hecha', false)
      .lte('vence_el', new Date().toISOString().slice(0, 10)).order('vence_el').limit(8),
    db.from('dst_mensaje').select('id', { count: 'exact', head: true }).eq('destino_id', destino.id).eq('estado_envio', 'pendiente'),
    /* Los que estan esperando que alguien los apruebe. Se traen el nombre y si
       el dueño ya aviso, porque el aviso de abajo necesita distinguirlos: un
       dueño que aviso lleva esperando de verdad; uno que no, quiza ni termino
       de cargar. */
    db.from('dst_negocio')
      .select('id, nombre, revision_pedida_en, creado_en')
      .eq('destino_id', destino.id).eq('estado_publicacion', 'pendiente')
      .order('revision_pedida_en', { ascending: true, nullsFirst: false })
      .order('creado_en').limit(20),
  ]);

  const t = (tablero ?? null) as Tablero | null;
  const uno = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);
  const variacion = t && t.leads_30d_previos > 0 ? Math.round(((t.leads_30d - t.leads_30d_previos) / t.leads_30d_previos) * 100) : null;
  const pendientesEnvio = pendientesManual === null ? 0 : (pendientesManual as unknown as { count?: number })?.count ?? 0;

  const avisaron = (porAprobar ?? []).filter((x) => x.revision_pedida_en).length;

  return (
    <>
      {!!porAprobar?.length && (
        /* Antes no habia NADA que dijera que estos existian: habia cinco
           esperando, uno desde hacia 26 dias, y para enterarse habia que
           acordarse de ir a filtrar la lista de negocios a mano. */
        <div className="aviso-panel">
          <strong>
            {porAprobar.length === 1
              ? 'Hay 1 negocio esperando aprobación'
              : `Hay ${porAprobar.length} negocios esperando aprobación`}
            {avisaron > 0 && ` · ${avisaron} ya avisaron que terminaron`}
          </strong>
          <span>{porAprobar.slice(0, 4).map((x) => x.nombre).join(' · ')}{porAprobar.length > 4 ? ' …' : ''}</span>
          <Link href="/admin/negocios?estado=pendiente" className="boton chico">Revisarlos</Link>
        </div>
      )}

      <Cabecera titulo={`Hola, ${usuario.nombre.split(' ')[0]}`} sub={`${destino.nombre} · ${fecha(new Date().toISOString(), destino.zona_horaria)}`}>
        <Link href="/admin/leads" className="boton secundario">Ver leads</Link>
        <Link href="/admin/ia/aprobaciones" className="boton">Por aprobar {t ? `(${t.seguimientos_pendientes.por_aprobar})` : ''}</Link>
      </Cabecera>

      {!t ? <Vacio texto="No se pudo leer el tablero." /> : (
        <>
          <div className="kpis">
            <Kpi titulo="Leads hoy" valor={numero(t.leads_hoy)} nota={`${numero(t.leads_7d)} en 7 días`} />
            <Kpi titulo="Leads 30 días" valor={numero(t.leads_30d)} nota={variacion === null ? 'sin período anterior' : `${variacion >= 0 ? '+' : ''}${variacion}% vs. anteriores`} tono={variacion !== null && variacion < 0 ? 'alerta' : undefined} />
            <Kpi titulo="Valor en pipeline" valor={dinero(t.valor_pipeline_usd)} nota={`${numero(t.calientes)} calientes`} />
            <Kpi titulo="Sin responder" valor={numero(t.sin_responder)} nota="leads sin primera respuesta" tono={t.sin_responder > 0 ? 'alerta' : 'bien'} />
            <Kpi titulo="Esperando equipo" valor={numero(t.esperando_equipo)} nota={`${numero(t.escaladas)} escaladas · ${numero(t.requieren_revision)} por revisar`} tono={t.escaladas > 0 ? 'alerta' : undefined} />
            <Kpi titulo="Tareas" valor={numero(t.tareas_vencidas + t.tareas_hoy)} nota={`${numero(t.tareas_vencidas)} vencidas · ${numero(t.tareas_hoy)} hoy`} tono={t.tareas_vencidas > 0 ? 'alerta' : undefined} />
            <Kpi titulo="Reservas del mes" valor={numero(t.reservas_mes.total)} nota={`${dinero(t.reservas_mes.ventas_usd)} ventas · ${dinero(t.reservas_mes.comision_usd)} comisión`} />
            <Kpi titulo="IA este mes" valor={dinero(t.ia_mes.costo_usd)} nota={`${numero(t.ia_mes.ejecuciones)} ejecuciones · ${numero(t.ia_mes.errores)} errores`} />
            <Kpi titulo="Primera respuesta" valor={t.primera_respuesta_min == null ? '—' : `${Math.round(t.primera_respuesta_min)} min`} nota="promedio 30 días" />
            <Kpi titulo="Tasa de cierre" valor={t.tasa_cierre_90d == null ? '—' : `${t.tasa_cierre_90d}%`} nota="leads de 90 días" />
          </div>

          <div className="dos">
            <div className="tarjeta">
              <h2>Leads que piden atención <Link className="derecha" href="/admin/leads">Todos →</Link></h2>
              {!calientes?.length ? <Vacio texto="Todavía no hay leads. Cuando el sitio capture uno, aparece aquí puntuado por la IA." /> : (
                <table className="tabla">
                  <thead><tr><th>Viajero</th><th>Etapa</th><th>Puntaje</th><th>Siguiente acción</th></tr></thead>
                  <tbody>
                    {calientes.map((s) => {
                      const v = uno(s.viajero) as { nombre: string | null; email: string | null; whatsapp: string | null; llega_el: string | null } | null;
                      const e = etapa(s.etapa);
                      const temp = s.temperatura ? TEMPERATURA[s.temperatura] : null;
                      return (
                        <tr key={s.id}>
                          <td><Link className="fuerte" href={`/admin/leads/${s.id}`}>{v?.nombre || v?.email || v?.whatsapp || 'Sin nombre'}</Link><div className="gris">{v?.llega_el ? `llega ${v.llega_el}` : relativo(s.creado_en)}</div></td>
                          <td><Etiqueta color={e.color}>{e.nombre}</Etiqueta></td>
                          <td>{s.puntaje_ia == null ? <span className="gris">sin puntuar</span> : <span style={{ fontWeight: 800, color: temp?.color }}>{s.puntaje_ia}</span>}</td>
                          <td>{truncar(s.siguiente_accion, 70) || <span className="gris">—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="tarjeta">
              <h2>Conversaciones esperando una persona <Link className="derecha" href="/admin/conversaciones?estado=esperando_equipo">Todas →</Link></h2>
              {!esperando?.length ? <Vacio texto="Nadie espera. La IA está atendiendo." /> : (
                <table className="tabla">
                  <thead><tr><th>Viajero</th><th>Canal</th><th>Estado</th><th>Espera</th></tr></thead>
                  <tbody>
                    {esperando.map((c) => {
                      const v = uno(c.viajero) as { nombre: string | null } | null;
                      return (
                        <tr key={c.id}>
                          <td><Link className="fuerte" href={`/admin/conversaciones/${c.id}`}>{v?.nombre || 'Visitante'}</Link>{c.motivo_revision ? <div className="gris">{truncar(c.motivo_revision, 60)}</div> : null}</td>
                          <td>{c.canal}</td>
                          <td><Etiqueta color={c.estado === 'escalada' ? '#EF4444' : '#F59E0B'}>{c.estado === 'escalada' ? 'Escalada' : 'Esperando'}</Etiqueta></td>
                          <td className="gris">{relativo(c.ultimo_mensaje_en)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="dos">
            <div className="tarjeta">
              <h2>Tareas de hoy y vencidas <Link className="derecha" href="/admin/tareas">Todas →</Link></h2>
              {!tareas?.length ? <Vacio texto="Sin tareas pendientes para hoy." /> : (
                <table className="tabla">
                  <tbody>
                    {tareas.map((tarea) => {
                      const v = uno(tarea.viajero) as { nombre: string | null } | null;
                      return (
                        <tr key={tarea.id}>
                          <td><span className="fuerte">{tarea.titulo}</span>{v?.nombre ? <div className="gris">{v.nombre}</div> : null}</td>
                          <td><Etiqueta suave>{tarea.prioridad}</Etiqueta></td>
                          <td className="gris">{tarea.vence_el}</td>
                          <td>{tarea.solicitud_id ? <Link href={`/admin/leads/${tarea.solicitud_id}`}>abrir</Link> : null}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="tarjeta">
              <h2>Embudo (90 días)</h2>
              <div className="barras">
                {t.por_etapa.map((f) => {
                  const e = etapa(f.etapa);
                  const maximo = Math.max(...t.por_etapa.map((x) => x.total), 1);
                  return (
                    <div className="fila" key={f.etapa}>
                      <span>{e.nombre}</span>
                      <div className="barra-progreso"><i style={{ width: `${Math.round((f.total / maximo) * 100)}%`, background: e.color }} /></div>
                      <span className="num">{f.total}</span>
                    </div>
                  );
                })}
              </div>
              <p className="gris" style={{ marginTop: 12, fontSize: 12.5, color: '#8B8B87' }}>
                Seguimientos programados: {t.seguimientos_pendientes.programados} · por aprobar: {t.seguimientos_pendientes.por_aprobar}
                {pendientesEnvio > 0 ? <> · <Link href="/admin/ia/aprobaciones">{pendientesEnvio} mensajes por enviar a mano</Link></> : null}
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
