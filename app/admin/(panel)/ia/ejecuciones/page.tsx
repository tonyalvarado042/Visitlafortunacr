import Link from 'next/link';
import { contextoPanel } from '@/lib/admin/contexto';
import { dinero, fecha, numero } from '@/lib/admin/formato';
import { Cabecera, Kpi, Vacio } from '@/componentes/admin/ui';

export const dynamic = 'force-dynamic';

export default async function PaginaEjecuciones({ searchParams }: { searchParams: Promise<{ agente?: string; error?: string }> }) {
  const f = await searchParams;
  const { destino, db } = await contextoPanel('ia');
  let consulta = db.from('dst_agente_ejecucion').select('id, clave_agente, modelo, esfuerzo, origen, entrada_tokens, salida_tokens, cache_lectura_tokens, cache_escritura_tokens, costo_usd, duracion_ms, iteraciones, herramientas_usadas, motivo_parada, resultado, error, conversacion_id, solicitud_id, creado_en').eq('destino_id', destino.id).order('creado_en', { ascending: false }).limit(150);
  if (f.agente) consulta = consulta.eq('clave_agente', f.agente);
  if (f.error === '1') consulta = consulta.not('error', 'is', null);
  const { data } = await consulta;
  const costo = (data ?? []).reduce((a, x) => a + Number(x.costo_usd ?? 0), 0);
  const tokens = (data ?? []).reduce((a, x) => a + x.entrada_tokens + x.salida_tokens + x.cache_lectura_tokens + x.cache_escritura_tokens, 0);
  const cache = (data ?? []).reduce((a, x) => a + x.cache_lectura_tokens, 0);

  return (
    <>
      <Cabecera titulo="Bitácora de la IA" migas={[{ ruta: '/admin/ia', nombre: 'Inteligencia' }]} sub="Cada llamada al modelo: qué agente, cuántos tokens, cuánto costó, qué herramientas usó y si falló." />
      <div className="filtros">
        <Link href="/admin/ia/ejecuciones" className={!f.agente && !f.error ? 'activo' : ''}>Todas</Link>
        {['concierge', 'planificador', 'seguimiento', 'analista', 'redactor'].map((a) => <Link key={a} href={`/admin/ia/ejecuciones?agente=${a}`} className={f.agente === a ? 'activo' : ''}>{a}</Link>)}
        <Link href="/admin/ia/ejecuciones?error=1" className={f.error === '1' ? 'activo' : ''}>Con error</Link>
      </div>
      <div className="kpis">
        <Kpi titulo="Costo (estas filas)" valor={dinero(costo)} nota={`${numero(data?.length ?? 0)} ejecuciones`} />
        <Kpi titulo="Tokens" valor={numero(tokens)} nota={`${tokens ? Math.round((cache / tokens) * 100) : 0}% servidos desde caché`} />
      </div>
      <div className="tarjeta desliza">
        {!data?.length ? <Vacio texto="La IA todavía no ha corrido." /> : (
          <table className="tabla">
            <thead><tr><th>Cuándo</th><th>Agente</th><th>Origen</th><th>Modelo</th><th className="num">Entrada</th><th className="num">Salida</th><th className="num">Costo</th><th className="num">Tiempo</th><th>Herramientas</th><th>Resultado</th></tr></thead>
            <tbody>{data.map((x) => (
              <tr key={x.id}>
                <td className="gris">{fecha(x.creado_en, destino.zona_horaria)}</td>
                <td><strong>{x.clave_agente}</strong></td>
                <td>{x.origen}</td>
                <td className="gris">{x.modelo}<div>{x.esfuerzo}</div></td>
                <td className="num">{numero(x.entrada_tokens)}{x.cache_lectura_tokens ? <div className="gris">+{numero(x.cache_lectura_tokens)} caché</div> : null}</td>
                <td className="num">{numero(x.salida_tokens)}</td>
                <td className="num">{dinero(x.costo_usd)}</td>
                <td className="num">{x.duracion_ms ? `${Math.round(x.duracion_ms / 100) / 10}s` : '—'}<div className="gris">{x.iteraciones} it.</div></td>
                <td className="gris">{(x.herramientas_usadas as string[] | null)?.join(', ') || '—'}</td>
                <td>{x.error ? <span style={{ color: '#B42318' }}>{x.error}</span> : <span className="gris">{x.motivo_parada ?? 'ok'}{x.resultado ? ` · ${JSON.stringify(x.resultado).slice(0, 80)}` : ''}</span>}{x.conversacion_id && <div><Link href={`/admin/conversaciones/${x.conversacion_id}`}>conversación</Link></div>}{x.solicitud_id && <div><Link href={`/admin/leads/${x.solicitud_id}`}>lead</Link></div>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </>
  );
}
