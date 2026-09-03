import Link from 'next/link';
import { notFound } from 'next/navigation';
import { contextoPanel } from '@/lib/admin/contexto';
import { dinero, ESTADO_CONVERSACION, fecha, relativo } from '@/lib/admin/formato';
import { Cabecera, Etiqueta, Vacio } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { cerrar, devolver, marcarRevision, notaInterna, revisar, tomar } from '../acciones';
import { Responder } from './Responder';

export const dynamic = 'force-dynamic';

const uno = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? x[0] ?? null : x ?? null);

export default async function PaginaConversacion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { destino, db } = await contextoPanel('conversaciones');

  const { data: c } = await db
    .from('dst_conversacion')
    .select('*, viajero:dst_viajero(id, nombre, email, whatsapp, idioma, llega_el, personas, no_molestar), solicitud:dst_solicitud(id, tipo, etapa, puntaje_ia), agente:dst_agente(nombre, modelo), responsable:dst_usuario!dst_conversacion_responsable_id_fkey(nombre)')
    .eq('id', id).eq('destino_id', destino.id)
    .maybeSingle();
  if (!c) notFound();

  const [{ data: mensajes }, { data: ejecuciones }, { data: equipo }] = await Promise.all([
    db.from('dst_mensaje').select('id, canal, autor, direccion, cuerpo, asunto, automatico, plantilla, estado_envio, error_envio, enviado_en, usuario_id, ejecucion_id').eq('conversacion_id', id).order('enviado_en').limit(200),
    db.from('dst_agente_ejecucion').select('id, clave_agente, modelo, entrada_tokens, salida_tokens, cache_lectura_tokens, costo_usd, duracion_ms, iteraciones, herramientas_usadas, motivo_parada, error, creado_en').eq('conversacion_id', id).order('creado_en', { ascending: false }).limit(30),
    db.from('dst_usuario').select('id, nombre'),
  ]);

  const v = uno(c.viajero) as { id: string; nombre: string | null; email: string | null; whatsapp: string | null; idioma: string | null; llega_el: string | null; personas: number | null; no_molestar: boolean } | null;
  const s = uno(c.solicitud) as { id: string; tipo: string; etapa: string; puntaje_ia: number | null } | null;
  const agente = uno(c.agente) as { nombre: string; modelo: string } | null;
  const responsable = uno(c.responsable) as { nombre: string } | null;
  const est = ESTADO_CONVERSACION[c.estado] ?? { nombre: c.estado, color: '#9CA3AF' };
  const nombreUsuario = (uid: string | null) => equipo?.find((u) => u.id === uid)?.nombre ?? null;
  const analisis = (c.metadatos as { analisis?: { calidad?: number; mejoras?: string[]; analizada_en?: string } } | null)?.analisis;
  const costo = (ejecuciones ?? []).reduce((acc, x) => acc + Number(x.costo_usd ?? 0), 0);

  return (
    <>
      <Cabecera
        titulo={v?.nombre || v?.email || v?.whatsapp || 'Visitante anónimo'}
        migas={[{ ruta: '/admin/conversaciones', nombre: 'Conversaciones' }]}
        sub={<>{c.canal} · <Etiqueta color={est.color}>{est.nombre}</Etiqueta> · atiende {c.atendida_por === 'ia' ? (agente?.nombre ?? 'la IA') : (responsable?.nombre ?? 'una persona')} · {c.total_mensajes} mensajes · {c.idioma}</>}
      >
        {c.atendida_por === 'ia'
          ? <form action={tomar}><input type="hidden" name="id" value={id} /><BotonAccion clase="boton">Tomar la conversación</BotonAccion></form>
          : <form action={devolver}><input type="hidden" name="id" value={id} /><BotonAccion clase="boton secundario">Devolver a la IA</BotonAccion></form>}
        {c.estado !== 'cerrada' && <form action={cerrar}><input type="hidden" name="id" value={id} /><BotonAccion clase="boton secundario" confirmar="¿Cerrar esta conversación?">Cerrar</BotonAccion></form>}
        {v && <Link className="boton secundario" href={`/admin/viajeros/${v.id}`}>Viajero</Link>}
        {s && <Link className="boton secundario" href={`/admin/leads/${s.id}`}>Lead</Link>}
      </Cabecera>

      {c.requiere_revision && (
        <div className="aviso mal">Requiere revisión{c.motivo_revision ? `: ${c.motivo_revision}` : ''}.
          <form action={marcarRevision} style={{ display: 'inline', marginLeft: 10 }}><input type="hidden" name="id" value={id} /><input type="hidden" name="valor" value="0" /><BotonAccion clase="boton chico secundario">Ya la vi</BotonAccion></form>
        </div>
      )}

      <div className="lado">
        <div>
          <div className="tarjeta">
            <h2>Hilo</h2>
            {!mensajes?.length ? <Vacio texto="Sin mensajes." /> : (
              <div className="chat">
                {mensajes.map((m) => {
                  const clase = m.canal === 'nota_interna' ? 'sistema nota-interna' : m.autor === 'viajero' ? 'viajero' : m.autor === 'equipo' ? 'equipo' : m.autor === 'ia' ? 'ia' : 'sistema';
                  const quien = m.canal === 'nota_interna' ? `Nota interna · ${nombreUsuario(m.usuario_id) ?? 'equipo'}` : m.autor === 'viajero' ? 'Viajero' : m.autor === 'ia' ? (agente?.nombre ?? 'IA') : m.autor === 'equipo' ? (nombreUsuario(m.usuario_id) ?? 'Equipo') : `Sistema${m.plantilla ? ` · ${m.plantilla}` : ''}`;
                  return (
                    <div className={`msg ${clase}`} key={m.id}>
                      <div className="quien">{quien} · {fecha(m.enviado_en, destino.zona_horaria)}{m.estado_envio === 'pendiente' ? <i> · PENDIENTE DE ENVÍO MANUAL</i> : m.estado_envio === 'fallido' ? <i> · falló</i> : m.estado_envio === 'leido' ? ' · leído' : ''}</div>
                      {m.asunto && <div style={{ fontWeight: 700 }}>{m.asunto}</div>}
                      {m.cuerpo}
                      {m.error_envio && <div style={{ color: '#B42318', fontSize: 12 }}>{m.error_envio}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Responder id={id} canal={c.canal} />

          <div className="tarjeta">
            <h2>Nota interna</h2>
            <form action={notaInterna}>
              <input type="hidden" name="id" value={id} />
              <div className="campo"><textarea name="cuerpo" required style={{ minHeight: 60 }} placeholder="Solo la ve el equipo. La IA la lee como contexto." /></div>
              <div className="pie-formulario"><BotonAccion clase="boton secundario chico">Guardar nota</BotonAccion></div>
            </form>
          </div>
        </div>

        <div>
          <div className="tarjeta">
            <h2>Lo que la IA entendió</h2>
            {!c.resumen_ia ? <Vacio texto="Sin análisis todavía. El cron analiza cada hilo con movimiento; también podés pedirlo con “Analizar”." /> : (
              <>
                <p style={{ margin: '0 0 8px' }}>{c.resumen_ia}</p>
                <div className="acciones-fila">
                  {c.sentimiento && <Etiqueta color={c.sentimiento === 'positivo' ? '#66BB2E' : c.sentimiento === 'negativo' ? '#EF4444' : '#9CA3AF'}>{c.sentimiento}</Etiqueta>}
                  {c.intencion && <Etiqueta suave>{c.intencion}</Etiqueta>}
                  {analisis?.calidad != null && <Etiqueta suave>calidad {analisis.calidad}/5</Etiqueta>}
                </div>
                {analisis?.mejoras?.length ? <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 13 }}>{analisis.mejoras.map((m, i) => <li key={i}>{m}</li>)}</ul> : null}
              </>
            )}
          </div>

          <div className="tarjeta">
            <h2>Revisión humana</h2>
            {c.revisada_en && <p className="gris" style={{ color: '#8B8B87', margin: '0 0 8px', fontSize: 12.5 }}>Revisada {relativo(c.revisada_en)} por {nombreUsuario(c.revisada_por) ?? '—'}: {'★'.repeat(c.calificacion_revision ?? 0)}{c.nota_revision ? ` · ${c.nota_revision}` : ''}</p>}
            <form action={revisar}>
              <input type="hidden" name="id" value={id} />
              <div className="acciones-fila" style={{ marginBottom: 8 }}>
                {[1, 2, 3, 4, 5].map((n) => <label key={n} style={{ fontSize: 13 }}><input type="radio" name="calificacion" value={n} defaultChecked={c.calificacion_revision === n} required /> {n}</label>)}
              </div>
              <div className="campo"><input type="text" name="nota" placeholder="Qué estuvo bien o mal (alimenta la mejora del agente)" defaultValue={c.nota_revision ?? ''} /></div>
              <div className="pie-formulario"><BotonAccion clase="boton secundario chico">Calificar</BotonAccion></div>
            </form>
          </div>

          <div className="tarjeta">
            <h2>Viajero</h2>
            {!v ? <Vacio texto="Anónimo: la IA pide el contacto cuando toca." /> : (
              <dl className="detalle-lista">
                <dt>Contacto</dt><dd>{v.email ?? '—'}<br />{v.whatsapp ?? ''}</dd>
                <dt>Fechas</dt><dd>{v.llega_el ?? '—'}{v.personas ? ` · ${v.personas} pax` : ''}</dd>
                {s && <><dt>Lead</dt><dd><Link href={`/admin/leads/${s.id}`}>{s.tipo} · {s.etapa}{s.puntaje_ia != null ? ` · ${s.puntaje_ia}` : ''}</Link></dd></>}
                {v.no_molestar && <><dt>Aviso</dt><dd><Etiqueta color="#B42318">No molestar</Etiqueta></dd></>}
              </dl>
            )}
          </div>

          <div className="tarjeta">
            <h2>Ejecuciones de IA <small>{dinero(costo)} en este hilo</small></h2>
            {!ejecuciones?.length ? <Vacio texto="La IA no ha corrido aquí." /> : (
              <table className="tabla">
                <tbody>{ejecuciones.map((x) => (
                  <tr key={x.id}>
                    <td>
                      <strong>{x.clave_agente}</strong> <span className="gris">{x.modelo} · {x.iteraciones} it. · {x.duracion_ms ? `${Math.round(x.duracion_ms / 100) / 10}s` : ''}</span>
                      <div className="gris">{fecha(x.creado_en, destino.zona_horaria)} · {x.entrada_tokens + x.cache_lectura_tokens} entrada · {x.salida_tokens} salida · {dinero(x.costo_usd)}</div>
                      {(x.herramientas_usadas as string[] | null)?.length ? <div className="gris">herramientas: {(x.herramientas_usadas as string[]).join(', ')}</div> : null}
                      {x.error ? <div style={{ color: '#B42318', fontSize: 12 }}>{x.error}</div> : x.motivo_parada === 'refusal' ? <div style={{ color: '#B42318', fontSize: 12 }}>rechazo del modelo</div> : null}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
