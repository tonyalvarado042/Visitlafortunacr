import Link from 'next/link';
import { contextoPanel } from '@/lib/admin/contexto';
import { dinero, numero } from '@/lib/admin/formato';
import { Cabecera, Etiqueta, Kpi, Vacio } from '@/componentes/admin/ui';
import { CorrerAhora, ProbarConcierge } from './Herramientas';

export const dynamic = 'force-dynamic';

const DESCRIPCION: Record<string, string> = {
  concierge: 'Conversa con los viajeros por el chat del sitio, WhatsApp y correo. Busca en el conocimiento, recomienda del catálogo, captura datos y crea solicitudes; escala cuando toca.',
  planificador: 'Arma itinerarios con los negocios y tours reales del catálogo, en el idioma del viajero.',
  seguimiento: 'Puntúa cada prospecto (0-100) con una siguiente acción y redacta los mensajes de seguimiento.',
  analista: 'Resume cada conversación, detecta sentimiento e intención, y marca las que una persona debe revisar.',
  redactor: 'Escribe borradores de guías SEO con el catálogo y el conocimiento del destino.',
};

export default async function PaginaIA() {
  const { destino, db, usuario } = await contextoPanel('ia');
  const desde = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [{ data: agentes }, { data: reporte }, { count: conocimiento }, { count: automatizaciones }, { count: porAprobar }, { count: pendientesManual }, { count: ejecuciones }] = await Promise.all([
    db.from('dst_agente').select('*').eq('destino_id', destino.id).order('clave'),
    db.rpc('reporte', { p_destino_id: destino.id, p_desde: desde, p_hasta: new Date().toISOString().slice(0, 10) }),
    db.from('dst_conocimiento').select('id', { count: 'exact', head: true }).eq('destino_id', destino.id).eq('esta_activo', true),
    db.from('dst_automatizacion').select('id', { count: 'exact', head: true }).eq('destino_id', destino.id).eq('esta_activa', true),
    db.from('dst_automatizacion_envio').select('id', { count: 'exact', head: true }).eq('destino_id', destino.id).eq('estado', 'pendiente_aprobacion'),
    db.from('dst_mensaje').select('id', { count: 'exact', head: true }).eq('destino_id', destino.id).eq('estado_envio', 'pendiente'),
    db.from('dst_agente_ejecucion').select('id', { count: 'exact', head: true }).eq('destino_id', destino.id).gte('creado_en', new Date(Date.now() - 30 * 86_400_000).toISOString()),
  ]);
  const porAgente = ((reporte as { ia_por_agente?: { agente: string; ejecuciones: number; costo_usd: number; errores: number }[] } | null)?.ia_por_agente ?? []);
  const costo30 = porAgente.reduce((a, x) => a + Number(x.costo_usd ?? 0), 0);
  const concierge = agentes?.find((a) => a.clave === 'concierge');
  const orden = ['concierge', 'planificador', 'seguimiento', 'analista', 'redactor'];

  return (
    <>
      <Cabecera titulo="Inteligencia" sub={`Cinco agentes trabajando para ${destino.nombre}. Lo que hacen queda registrado con su costo.`}>
        <Link href="/admin/ia/conocimiento" className="boton secundario">Conocimiento ({numero(conocimiento ?? 0)})</Link>
        <Link href="/admin/ia/aprobaciones" className="boton">Por aprobar ({numero((porAprobar ?? 0) + (pendientesManual ?? 0))})</Link>
      </Cabecera>

      <div className="kpis">
        <Kpi titulo="Costo IA 30 días" valor={dinero(costo30)} nota={`${numero(ejecuciones ?? 0)} ejecuciones`} />
        <Kpi titulo="Conocimiento activo" valor={numero(conocimiento ?? 0)} nota={<Link href="/admin/ia/conocimiento">alimentar →</Link>} />
        <Kpi titulo="Automatizaciones" valor={numero(automatizaciones ?? 0)} nota={<Link href="/admin/ia/automatizaciones">activas →</Link>} />
        <Kpi titulo="Esperan aprobación" valor={numero(porAprobar ?? 0)} nota={`${numero(pendientesManual ?? 0)} por enviar a mano`} tono={(porAprobar ?? 0) > 0 ? 'alerta' : undefined} />
      </div>

      <div className="tarjeta">
        <h2>Agentes {usuario.rol !== 'admin' && <small>solo un administrador los edita</small>}</h2>
        {!agentes?.length ? <Vacio texto="Este destino no tiene agentes: se crean al preparar el destino." /> : (
          <table className="tabla">
            <thead><tr><th>Agente</th><th>Qué hace</th><th>Modelo</th><th>Esfuerzo</th><th className="num">30 días</th><th></th></tr></thead>
            <tbody>{[...agentes].sort((a, b) => orden.indexOf(a.clave) - orden.indexOf(b.clave)).map((a) => {
              const uso = porAgente.find((x) => x.agente === a.clave);
              return (
                <tr key={a.id}>
                  <td><strong>{a.nombre}</strong> <span className="gris">{a.clave}</span>{!a.esta_activo && <> <Etiqueta color="#B42318">apagado</Etiqueta></>}</td>
                  <td style={{ maxWidth: 420 }}>{DESCRIPCION[a.clave]}</td>
                  <td className="gris">{a.modelo}</td>
                  <td>{a.esfuerzo}</td>
                  <td className="num">{uso ? `${dinero(uso.costo_usd)} · ${uso.ejecuciones}` : '—'}{uso?.errores ? <div style={{ color: '#B42318', fontSize: 12 }}>{uso.errores} errores</div> : null}</td>
                  <td><Link href={`/admin/ia/agentes/${a.clave}`} className="boton secundario chico">Configurar</Link></td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>

      <div className="dos">
        <div className="tarjeta">
          <h2>Probar el concierge</h2>
          <ProbarConcierge idiomas={destino.idiomas} principal={destino.idioma_principal} nombre={concierge?.nombre ?? 'el concierge'} />
        </div>
        <div className="tarjeta">
          <h2>Motor de seguimiento</h2>
          <p style={{ margin: '0 0 10px' }}>El cron corre cada hora: programa lo que toca, manda plantillas, pide mensajes a la IA, puntúa leads y analiza conversaciones. Podés correrlo ahora.</p>
          <CorrerAhora />
          <div className="acciones-fila" style={{ marginTop: 14 }}>
            <Link href="/admin/ia/automatizaciones" className="boton secundario chico">Reglas</Link>
            <Link href="/admin/ia/plantillas" className="boton secundario chico">Plantillas</Link>
            <Link href="/admin/ia/ejecuciones" className="boton secundario chico">Bitácora</Link>
          </div>
        </div>
      </div>
    </>
  );
}
