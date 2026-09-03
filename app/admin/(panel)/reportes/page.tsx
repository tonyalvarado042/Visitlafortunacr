import { contextoPanel } from '@/lib/admin/contexto';
import { dinero, etapa, numero } from '@/lib/admin/formato';
import { Barras, Cabecera, Kpi, Vacio } from '@/componentes/admin/ui';

export const dynamic = 'force-dynamic';

type Reporte = {
  periodo: { desde: string; hasta: string };
  total_leads: number;
  embudo: { etapa: string; total: number }[];
  por_tipo: { tipo: string; total: number }[];
  por_origen: { origen: string; total: number; reservados: number }[];
  por_fuente: { fuente: string; medio: string | null; campana: string | null; total: number }[];
  por_idioma: { idioma: string; total: number }[];
  por_pais: { pais: string; total: number }[];
  por_dia: { dia: string; total: number }[];
  por_vendedor: { usuario_id: string; nombre: string; leads: number; reservados: number; valor_usd: number }[];
  temperatura: { temperatura: string; total: number }[];
  ingresos_por_mes: { mes: string; reservas: number; ventas_usd: number; comision_usd: number }[];
  ia_por_mes: { mes: string; ejecuciones: number; costo_usd: number; tokens: number }[];
  ia_por_agente: { agente: string; ejecuciones: number; costo_usd: number; errores: number }[];
  conversaciones: { total: number; por_ia: number; escaladas: number; calificacion_promedio: number | null; sentimiento_negativo: number };
  tiempo_en_etapa_horas: { etapa: string; horas: number }[];
};

export default async function PaginaReportes({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  const f = await searchParams;
  const { destino, db } = await contextoPanel('reportes');
  const hasta = f.hasta && /^\d{4}-\d{2}-\d{2}$/.test(f.hasta) ? f.hasta : new Date().toISOString().slice(0, 10);
  const desde = f.desde && /^\d{4}-\d{2}-\d{2}$/.test(f.desde) ? f.desde : new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const { data } = await db.rpc('reporte', { p_destino_id: destino.id, p_desde: desde, p_hasta: hasta });
  const r = data as Reporte | null;
  if (!r) return <Vacio texto="No se pudo leer el reporte." />;

  const reservados = r.embudo.find((e) => e.etapa === 'reservado')?.total ?? 0;
  const tasa = r.total_leads ? Math.round((reservados / r.total_leads) * 1000) / 10 : 0;
  const ventas = r.ingresos_por_mes.reduce((a, m) => a + Number(m.ventas_usd ?? 0), 0);
  const comision = r.ingresos_por_mes.reduce((a, m) => a + Number(m.comision_usd ?? 0), 0);
  const costoIA = r.ia_por_agente.reduce((a, x) => a + Number(x.costo_usd ?? 0), 0);
  const maxDia = Math.max(...r.por_dia.map((d) => d.total), 1);

  return (
    <>
      <Cabecera titulo="Reportes" sub={`${destino.nombre} · del ${desde} al ${hasta}`}>
        <form action="/admin/reportes" method="get" className="acciones-fila">
          <input type="date" name="desde" defaultValue={desde} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #D8D8D3', fontFamily: 'inherit' }} />
          <input type="date" name="hasta" defaultValue={hasta} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #D8D8D3', fontFamily: 'inherit' }} />
          <button className="boton secundario" type="submit">Ver</button>
        </form>
      </Cabecera>

      <div className="kpis">
        <Kpi titulo="Leads" valor={numero(r.total_leads)} nota={`${numero(reservados)} reservados`} />
        <Kpi titulo="Tasa de cierre" valor={`${tasa}%`} nota="leads creados en el período" />
        <Kpi titulo="Ventas (12 meses)" valor={dinero(ventas)} nota={`${dinero(comision)} de comisión`} />
        <Kpi titulo="Costo IA (período)" valor={dinero(costoIA)} nota={ventas ? `${Math.round((costoIA / Math.max(comision, 1)) * 100)}% de la comisión` : 'sin ventas todavía'} />
        <Kpi titulo="Conversaciones" valor={numero(r.conversaciones.total)} nota={`${numero(r.conversaciones.por_ia)} por IA · ${numero(r.conversaciones.escaladas)} escaladas`} />
        <Kpi titulo="Calidad de la IA" valor={r.conversaciones.calificacion_promedio != null ? `${r.conversaciones.calificacion_promedio}★` : '—'} nota={`${numero(r.conversaciones.sentimiento_negativo)} con sentimiento negativo`} />
      </div>

      <div className="tres">
        <div className="tarjeta"><h2>Embudo</h2><Barras filas={r.embudo.map((e) => ({ nombre: etapa(e.etapa).nombre, valor: e.total, color: etapa(e.etapa).color }))} /></div>
        <div className="tarjeta"><h2>Temperatura (IA)</h2>{r.temperatura.length ? <Barras filas={r.temperatura.map((t) => ({ nombre: t.temperatura, valor: t.total, color: t.temperatura === 'caliente' ? '#FF6A00' : t.temperatura === 'tibio' ? '#F59E0B' : '#60A5FA' }))} /> : <Vacio texto="Sin puntuar." />}</div>
        <div className="tarjeta"><h2>Tipo de solicitud</h2>{r.por_tipo.length ? <Barras filas={r.por_tipo.map((t) => ({ nombre: t.tipo, valor: t.total }))} /> : <Vacio texto="—" />}</div>
      </div>

      <div className="tarjeta">
        <h2>Leads por día</h2>
        {!r.por_dia.length ? <Vacio texto="Sin leads en el período." /> : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 }}>
            {r.por_dia.map((d) => <div key={d.dia} title={`${d.dia}: ${d.total}`} style={{ flex: 1, background: 'var(--verde)', height: `${Math.max((d.total / maxDia) * 100, 4)}%`, borderRadius: 3 }} />)}
          </div>
        )}
      </div>

      <div className="dos">
        <div className="tarjeta desliza">
          <h2>De dónde vienen</h2>
          {!r.por_origen.length ? <Vacio texto="—" /> : (
            <table className="tabla"><thead><tr><th>Origen</th><th className="num">Leads</th><th className="num">Reservados</th><th className="num">Cierre</th></tr></thead>
              <tbody>{r.por_origen.map((o) => <tr key={o.origen}><td>{o.origen}</td><td className="num">{o.total}</td><td className="num">{o.reservados}</td><td className="num">{o.total ? Math.round((o.reservados / o.total) * 100) : 0}%</td></tr>)}</tbody></table>
          )}
          {r.por_fuente.length > 0 && (
            <table className="tabla" style={{ marginTop: 14 }}><thead><tr><th>Fuente (UTM)</th><th>Medio</th><th>Campaña</th><th className="num">Leads</th></tr></thead>
              <tbody>{r.por_fuente.map((x, i) => <tr key={i}><td>{x.fuente}</td><td className="gris">{x.medio ?? '—'}</td><td className="gris">{x.campana ?? '—'}</td><td className="num">{x.total}</td></tr>)}</tbody></table>
          )}
        </div>
        <div>
          <div className="tarjeta"><h2>Idioma</h2>{r.por_idioma.length ? <Barras filas={r.por_idioma.map((i) => ({ nombre: i.idioma ?? '—', valor: i.total }))} /> : <Vacio texto="—" />}</div>
          <div className="tarjeta"><h2>País</h2>{r.por_pais.length ? <Barras filas={r.por_pais.map((p) => ({ nombre: p.pais, valor: p.total }))} /> : <Vacio texto="—" />}</div>
        </div>
      </div>

      <div className="dos">
        <div className="tarjeta desliza">
          <h2>Por vendedor</h2>
          {!r.por_vendedor.length ? <Vacio texto="Nadie tiene leads asignados en el período." /> : (
            <table className="tabla"><thead><tr><th>Persona</th><th className="num">Leads</th><th className="num">Reservados</th><th className="num">Cierre</th><th className="num">Valor</th></tr></thead>
              <tbody>{r.por_vendedor.map((v) => <tr key={v.usuario_id}><td>{v.nombre}</td><td className="num">{v.leads}</td><td className="num">{v.reservados}</td><td className="num">{v.leads ? Math.round((v.reservados / v.leads) * 100) : 0}%</td><td className="num">{dinero(v.valor_usd)}</td></tr>)}</tbody></table>
          )}
        </div>
        <div className="tarjeta desliza">
          <h2>Tiempo en cada etapa</h2>
          {!r.tiempo_en_etapa_horas.length ? <Vacio texto="Todavía no hay cambios de etapa." /> : (
            <table className="tabla"><tbody>{r.tiempo_en_etapa_horas.map((t) => <tr key={t.etapa}><td>{etapa(t.etapa).nombre}</td><td className="num">{t.horas < 48 ? `${t.horas} h` : `${Math.round(t.horas / 24)} d`}</td></tr>)}</tbody></table>
          )}
        </div>
      </div>

      <div className="dos">
        <div className="tarjeta desliza">
          <h2>Ingresos por mes</h2>
          {!r.ingresos_por_mes.length ? <Vacio texto="Sin reservas confirmadas todavía." /> : (
            <table className="tabla"><thead><tr><th>Mes</th><th className="num">Reservas</th><th className="num">Ventas</th><th className="num">Comisión</th></tr></thead>
              <tbody>{r.ingresos_por_mes.map((m) => <tr key={m.mes}><td>{m.mes}</td><td className="num">{m.reservas}</td><td className="num">{dinero(m.ventas_usd)}</td><td className="num">{dinero(m.comision_usd)}</td></tr>)}</tbody></table>
          )}
        </div>
        <div className="tarjeta desliza">
          <h2>Costo de la IA</h2>
          {!r.ia_por_mes.length ? <Vacio texto="La IA todavía no ha corrido." /> : (
            <>
              <table className="tabla"><thead><tr><th>Mes</th><th className="num">Ejecuciones</th><th className="num">Tokens</th><th className="num">Costo</th></tr></thead>
                <tbody>{r.ia_por_mes.map((m) => <tr key={m.mes}><td>{m.mes}</td><td className="num">{numero(m.ejecuciones)}</td><td className="num">{numero(m.tokens)}</td><td className="num">{dinero(m.costo_usd)}</td></tr>)}</tbody></table>
              <table className="tabla" style={{ marginTop: 14 }}><thead><tr><th>Agente (período)</th><th className="num">Ejecuciones</th><th className="num">Errores</th><th className="num">Costo</th></tr></thead>
                <tbody>{r.ia_por_agente.map((a) => <tr key={a.agente}><td>{a.agente}</td><td className="num">{numero(a.ejecuciones)}</td><td className="num">{numero(a.errores)}</td><td className="num">{dinero(a.costo_usd)}</td></tr>)}</tbody></table>
            </>
          )}
        </div>
      </div>
    </>
  );
}
