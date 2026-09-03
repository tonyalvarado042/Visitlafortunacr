import Link from 'next/link';
import { notFound } from 'next/navigation';
import { contextoPanel } from '@/lib/admin/contexto';
import { dinero, etapa, ETAPAS, fecha, relativo, soloFecha, TEMPERATURA, TIPO_SOLICITUD } from '@/lib/admin/formato';
import { Cabecera, Etiqueta, Vacio } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { agregarNota, asignarResponsable, completarTarea, crearReserva, crearTarea, editarSolicitud, moverEtapa } from '../acciones';
import { PanelIA } from './PanelIA';

export const dynamic = 'force-dynamic';

const uno = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? x[0] ?? null : x ?? null);

export default async function PaginaLead({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { destino, db, usuario } = await contextoPanel('leads');

  const { data: s } = await db
    .from('dst_solicitud')
    .select('*, viajero:dst_viajero(*), negocio:dst_negocio(nombre), tour:dst_tour(nombre), itinerario:dst_itinerario(id, titulo, babosa, idioma, dias, total_usd)')
    .eq('id', id).eq('destino_id', destino.id)
    .maybeSingle();
  if (!s) notFound();

  const v = uno(s.viajero) as Record<string, string | number | boolean | string[] | null> & { id: string } | null;
  const plan = uno(s.itinerario) as { id: string; titulo: string; babosa: string; idioma: string; dias: number; total_usd: number | null } | null;

  const [{ data: mensajes }, { data: tareas }, { data: historial }, { data: envios }, { data: ejecuciones }, { data: equipo }, { data: conversaciones }, { data: reservas }] = await Promise.all([
    v ? db.from('dst_mensaje').select('id, canal, direccion, autor, asunto, cuerpo, automatico, plantilla, estado_envio, error_envio, enviado_en, usuario_id, conversacion_id').eq('viajero_id', v.id).order('enviado_en', { ascending: false }).limit(80) : Promise.resolve({ data: [] }),
    db.from('dst_tarea').select('id, titulo, prioridad, vence_el, esta_hecha, responsable_id').or(`solicitud_id.eq.${id}${v ? `,viajero_id.eq.${v.id}` : ''}`).order('esta_hecha').order('vence_el').limit(20),
    db.from('dst_etapa_historial').select('de_etapa, a_etapa, actor, motivo, creado_en, usuario_id').eq('solicitud_id', id).order('creado_en'),
    db.from('dst_automatizacion_envio').select('id, estado, intento, programado_para, ejecutado_en, resultado, borrador, automatizacion:dst_automatizacion(nombre, accion)').eq('solicitud_id', id).order('programado_para', { ascending: false }).limit(15),
    db.from('dst_agente_ejecucion').select('id, clave_agente, modelo, costo_usd, duracion_ms, motivo_parada, error, herramientas_usadas, creado_en').eq('solicitud_id', id).order('creado_en', { ascending: false }).limit(10),
    db.from('dst_usuario').select('id, nombre').eq('esta_activo', true).order('nombre'),
    v ? db.from('dst_conversacion').select('id, canal, estado, atendida_por, ultimo_mensaje_en, resumen_ia').eq('viajero_id', v.id).order('ultimo_mensaje_en', { ascending: false }) : Promise.resolve({ data: [] }),
    v ? db.from('dst_reserva').select('id, codigo, estado, total_usd, estado_pago, creado_en').eq('viajero_id', v.id).order('creado_en', { ascending: false }) : Promise.resolve({ data: [] }),
  ]);

  const nombreUsuario = (uid: string | null) => equipo?.find((u) => u.id === uid)?.nombre ?? null;
  const e = etapa(s.etapa);
  const temp = s.temperatura ? TEMPERATURA[s.temperatura] : null;
  const nombre = (v?.nombre as string) || (v?.email as string) || (v?.whatsapp as string) || 'Sin nombre';
  const hoy = new Date().toISOString().slice(0, 10);
  const urlPlan = plan ? `https://${destino.dominio}/${plan.idioma}/plan/${plan.babosa}` : null;

  return (
    <>
      <Cabecera
        titulo={nombre}
        migas={[{ ruta: '/admin/leads', nombre: 'Leads' }]}
        sub={<>{TIPO_SOLICITUD[s.tipo] ?? s.tipo} · <Etiqueta color={e.color}>{e.nombre}</Etiqueta> · creado {relativo(s.creado_en)}{s.responsable_id ? ` · ${nombreUsuario(s.responsable_id)}` : ' · sin responsable'}</>}
      >
        {v?.whatsapp ? <a className="boton secundario" href={`https://wa.me/${String(v.whatsapp).replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp ↗</a> : null}
        {v?.email ? <a className="boton secundario" href={`mailto:${v.email}`}>Correo</a> : null}
        {v ? <Link className="boton secundario" href={`/admin/viajeros/${v.id}`}>Ficha del viajero</Link> : null}
        {urlPlan ? <a className="boton" href={urlPlan} target="_blank" rel="noreferrer">Ver plan ↗</a> : null}
      </Cabecera>

      <div className="lado">
        <div>
          {s.mensaje && <div className="tarjeta"><h2>Lo que pidió</h2><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{s.mensaje}</p>{(s.negocio || s.tour) && <p className="gris" style={{ margin: '8px 0 0', color: '#8B8B87' }}>Sobre: {uno(s.negocio as { nombre: string }[] | null)?.nombre ?? uno(s.tour as { nombre: string }[] | null)?.nombre}</p>}</div>}

          <div className="tarjeta">
            <h2>Puntaje de la IA</h2>
            {s.puntaje_ia == null ? <Vacio texto="Todavía no está puntuado. La automatización lo hace al entrar, o puntualo ahora." /> : (
              <div className="dos">
                <div>
                  <div className="puntaje" style={{ color: temp?.color }}>{s.puntaje_ia}<small>/100 · {temp?.nombre}</small></div>
                  <p style={{ margin: '6px 0 0' }}>{s.motivo_puntaje}</p>
                  <p className="gris" style={{ margin: '6px 0 0', color: '#8B8B87', fontSize: 12.5 }}>puntuado {relativo(s.puntuada_en)}</p>
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>Siguiente acción</div>
                  <p style={{ margin: '4px 0' }}>{s.siguiente_accion ?? '—'}</p>
                  <p className="gris" style={{ margin: 0, color: '#8B8B87', fontSize: 12.5 }}>{s.siguiente_accion_el ? `para ${fecha(s.siguiente_accion_el, destino.zona_horaria)}` : ''}</p>
                  {s.resumen_ia && <p style={{ margin: '10px 0 0', fontStyle: 'italic' }}>{s.resumen_ia}</p>}
                </div>
              </div>
            )}
          </div>

          <PanelIA id={id} tieneWhatsapp={!!v?.whatsapp} tieneEmail={!!v?.email} esItinerario={!!plan} />

          <div className="tarjeta">
            <h2>Actividad <small>{mensajes?.length ?? 0} mensajes</small></h2>
            {!mensajes?.length ? <Vacio texto="Todavía no hay mensajes con este viajero." /> : (
              <div className="chat">
                {[...mensajes].reverse().map((m) => {
                  const clase = m.canal === 'nota_interna' ? 'sistema nota-interna' : m.autor === 'viajero' ? 'viajero' : m.autor === 'equipo' ? 'equipo' : m.autor === 'ia' ? 'ia' : 'sistema';
                  const quien = m.canal === 'nota_interna' ? `Nota interna · ${nombreUsuario(m.usuario_id) ?? 'equipo'}` : m.autor === 'viajero' ? 'Viajero' : m.autor === 'ia' ? 'IA' : m.autor === 'equipo' ? (nombreUsuario(m.usuario_id) ?? 'Equipo') : `Sistema${m.plantilla ? ` · ${m.plantilla}` : ''}`;
                  return (
                    <div className={`msg ${clase}`} key={m.id}>
                      <div className="quien">{quien} · {m.canal} · {fecha(m.enviado_en, destino.zona_horaria)}{m.estado_envio === 'pendiente' ? <i> · PENDIENTE DE ENVÍO MANUAL</i> : m.estado_envio === 'fallido' ? <i> · falló</i> : ''}</div>
                      {m.asunto && <div style={{ fontWeight: 700 }}>{m.asunto}</div>}
                      {m.cuerpo}
                      {m.error_envio && <div className="gris" style={{ color: '#B42318', fontSize: 12 }}>{m.error_envio}</div>}
                    </div>
                  );
                })}
              </div>
            )}
            <form action={agregarNota} style={{ marginTop: 14 }}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="viajero_id" value={v?.id ?? ''} />
              <div className="campo"><label>Nota interna (no la ve el viajero)</label><textarea name="cuerpo" required style={{ minHeight: 60 }} /></div>
              <div className="pie-formulario"><BotonAccion clase="boton secundario chico">Guardar nota</BotonAccion></div>
            </form>
          </div>

          {(ejecuciones?.length ?? 0) > 0 && (
            <div className="tarjeta">
              <h2>Lo que hizo la IA con este lead</h2>
              <table className="tabla">
                <thead><tr><th>Cuándo</th><th>Agente</th><th>Modelo</th><th>Herramientas</th><th className="num">Costo</th><th>Resultado</th></tr></thead>
                <tbody>
                  {ejecuciones!.map((x) => (
                    <tr key={x.id}>
                      <td className="gris">{fecha(x.creado_en, destino.zona_horaria)}</td>
                      <td>{x.clave_agente}</td>
                      <td className="gris">{x.modelo}</td>
                      <td className="gris">{(x.herramientas_usadas as string[] | null)?.join(', ') || '—'}</td>
                      <td className="num">{dinero(x.costo_usd)}</td>
                      <td>{x.error ? <span style={{ color: '#B42318' }}>{x.error}</span> : x.motivo_parada ?? 'ok'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <div className="tarjeta">
            <h2>Etapa</h2>
            <form action={moverEtapa} className="campos" style={{ gridTemplateColumns: '1fr' }}>
              <input type="hidden" name="id" value={id} />
              <div className="campo"><select name="etapa" defaultValue={s.etapa}>{ETAPAS.map((x) => <option key={x.valor} value={x.valor}>{x.nombre}</option>)}</select></div>
              <div className="campo"><input type="text" name="motivo" placeholder="Motivo (obligatorio si se pierde)" defaultValue={s.motivo_perdida ?? ''} /></div>
              <BotonAccion clase="boton chico">Mover</BotonAccion>
            </form>
            <form action={asignarResponsable} className="campos" style={{ gridTemplateColumns: '1fr auto', marginTop: 12 }}>
              <input type="hidden" name="id" value={id} />
              <div className="campo"><select name="responsable_id" defaultValue={s.responsable_id ?? ''}><option value="">Sin responsable</option>{equipo?.map((u) => <option key={u.id} value={u.id}>{u.nombre}{u.id === usuario.id ? ' (yo)' : ''}</option>)}</select></div>
              <BotonAccion clase="boton secundario chico">Asignar</BotonAccion>
            </form>
            <form action={editarSolicitud} className="campos" style={{ marginTop: 12 }}>
              <input type="hidden" name="id" value={id} />
              <div className="campo"><label>Valor estimado USD</label><input type="number" step="1" name="valor_estimado_usd" defaultValue={s.valor_estimado_usd ?? ''} /></div>
              <div className="campo"><label>Probabilidad %</label><input type="number" min={0} max={100} name="probabilidad" defaultValue={s.probabilidad ?? ''} /></div>
              <div className="campo"><label>Cierre estimado</label><input type="date" name="cierra_estimado_el" defaultValue={s.cierra_estimado_el ?? ''} /></div>
              <div className="campo"><label>Siguiente acción (fecha)</label><input type="date" name="siguiente_accion_el" defaultValue={s.siguiente_accion_el ? String(s.siguiente_accion_el).slice(0, 10) : ''} /></div>
              <div className="campo ancho"><label>Siguiente acción</label><input type="text" name="siguiente_accion" defaultValue={s.siguiente_accion ?? ''} /></div>
              <div className="campo ancho"><BotonAccion clase="boton secundario chico">Guardar</BotonAccion></div>
            </form>
          </div>

          <div className="tarjeta">
            <h2>Viajero {v ? <Link className="derecha" href={`/admin/viajeros/${v.id}`}>Editar →</Link> : null}</h2>
            {!v ? <Vacio texto="Sin viajero." /> : (
              <dl className="detalle-lista">
                <dt>Contacto</dt><dd>{v.email ?? '—'}<br />{v.whatsapp ?? ''}</dd>
                <dt>Idioma / país</dt><dd>{v.idioma ?? '—'} · {v.pais_iso ?? '—'}</dd>
                <dt>Fechas</dt><dd>{soloFecha(v.llega_el as string)} → {soloFecha(v.sale_el as string)}</dd>
                <dt>Personas</dt><dd>{v.personas ?? '—'}{v.ninos ? ` (${v.ninos} niños)` : ''} · {v.tipo_viajero ?? '—'}</dd>
                <dt>Presupuesto</dt><dd>{v.presupuesto ?? '—'}{v.presupuesto_usd ? ` · ${dinero(v.presupuesto_usd as number)}` : ''}</dd>
                <dt>Intereses</dt><dd>{(v.intereses as string[] | null)?.join(', ') || '—'}</dd>
                <dt>Origen</dt><dd>{v.origen ?? '—'}{v.utm_fuente ? ` · ${v.utm_fuente}/${v.utm_medio ?? ''}` : ''}</dd>
                {v.no_molestar ? <><dt>Aviso</dt><dd><Etiqueta color="#B42318">No molestar</Etiqueta></dd></> : null}
                {v.notas ? <><dt>Notas</dt><dd>{v.notas}</dd></> : null}
              </dl>
            )}
          </div>

          <div className="tarjeta">
            <h2>Plan</h2>
            {plan ? <><strong>{plan.titulo}</strong><div className="gris" style={{ color: '#8B8B87', fontSize: 12.5 }}>{plan.dias} días{plan.total_usd ? ` · ≈ ${dinero(plan.total_usd)} por persona` : ''}</div><a href={urlPlan!} target="_blank" rel="noreferrer">{urlPlan}</a></> : <Vacio texto="Sin plan todavía. Usá “Armar un plan”." />}
          </div>

          <div className="tarjeta">
            <h2>Tareas</h2>
            {!tareas?.length ? <p className="gris" style={{ color: '#8B8B87', margin: '0 0 10px' }}>Sin tareas.</p> : (
              <table className="tabla" style={{ marginBottom: 10 }}>
                <tbody>{tareas.map((t) => (
                  <tr key={t.id} style={{ opacity: t.esta_hecha ? .5 : 1 }}>
                    <td>{t.titulo}<div className="gris">{t.prioridad} · {t.vence_el ?? '—'} · {nombreUsuario(t.responsable_id) ?? '—'}</div></td>
                    <td><form action={completarTarea}><input type="hidden" name="id" value={id} /><input type="hidden" name="tarea_id" value={t.id} />{t.esta_hecha && <input type="hidden" name="deshacer" value="1" />}<BotonAccion clase="boton secundario chico">{t.esta_hecha ? 'Reabrir' : 'Hecha'}</BotonAccion></form></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
            <form action={crearTarea} className="campos" style={{ gridTemplateColumns: '1fr' }}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="viajero_id" value={v?.id ?? ''} />
              <div className="campo"><input type="text" name="titulo" placeholder="Nueva tarea…" required /></div>
              <div className="campos" style={{ gridTemplateColumns: '1fr 1fr auto' }}>
                <div className="campo"><input type="date" name="vence_el" defaultValue={hoy} /></div>
                <div className="campo"><select name="prioridad" defaultValue="media"><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></div>
                <BotonAccion clase="boton secundario chico">Crear</BotonAccion>
              </div>
            </form>
          </div>

          {(conversaciones?.length ?? 0) > 0 && (
            <div className="tarjeta">
              <h2>Conversaciones</h2>
              {conversaciones!.map((c) => (
                <div key={c.id} style={{ marginBottom: 8 }}>
                  <Link className="fuerte" href={`/admin/conversaciones/${c.id}`}>{c.canal} · {c.estado}</Link> <span className="gris" style={{ color: '#8B8B87', fontSize: 12.5 }}>{c.atendida_por} · {relativo(c.ultimo_mensaje_en)}</span>
                  {c.resumen_ia && <div className="gris" style={{ fontSize: 12.5, color: '#555' }}>{c.resumen_ia}</div>}
                </div>
              ))}
            </div>
          )}

          <div className="tarjeta">
            <h2>Seguimientos automáticos</h2>
            {!envios?.length ? <Vacio texto="Ninguno programado todavía." /> : (
              <table className="tabla">
                <tbody>{envios.map((x) => {
                  const a = uno(x.automatizacion as { nombre: string; accion: string }[] | null);
                  return (
                    <tr key={x.id}>
                      <td>{a?.nombre ?? '—'}<div className="gris">{x.estado} · {fecha(x.programado_para, destino.zona_horaria)}{x.resultado ? ` · ${x.resultado}` : ''}</div>{x.estado === 'pendiente_aprobacion' && <Link href="/admin/ia/aprobaciones">aprobar →</Link>}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            )}
          </div>

          <div className="tarjeta">
            <h2>Reservas</h2>
            {reservas?.length ? reservas.map((r) => (
              <div key={r.id} style={{ marginBottom: 6 }}><Link className="fuerte" href={`/admin/reservas/${r.id}`}>{r.codigo}</Link> · {r.estado} · {dinero(r.total_usd)} · {r.estado_pago}</div>
            )) : null}
            {v && s.etapa !== 'perdido' && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>Crear reserva desde este lead</summary>
                <form action={crearReserva} className="campos" style={{ marginTop: 10 }}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="viajero_id" value={v.id} />
                  <div className="campo ancho"><label>Qué se reserva</label><input type="text" name="descripcion" placeholder="Tour X para 2 adultos" required /></div>
                  <div className="campo"><label>Fecha</label><input type="date" name="para_el" defaultValue={(v.llega_el as string) ?? ''} /></div>
                  <div className="campo"><label>Adultos</label><input type="number" name="adultos" min={0} defaultValue={(v.personas as number) ?? 2} /></div>
                  <div className="campo"><label>Niños</label><input type="number" name="ninos" min={0} defaultValue={(v.ninos as number) ?? 0} /></div>
                  <div className="campo"><label>Total USD</label><input type="number" name="total_usd" step="0.01" required /></div>
                  <div className="campo"><label>Comisión USD</label><input type="number" name="comision_usd" step="0.01" placeholder={`auto ${destino.comision_por_defecto ?? 0}%`} /></div>
                  <div className="campo"><label>Titular</label><input type="text" name="nombre_titular" defaultValue={(v.nombre as string) ?? ''} /></div>
                  <input type="hidden" name="email_titular" value={(v.email as string) ?? ''} />
                  <input type="hidden" name="whatsapp_titular" value={(v.whatsapp as string) ?? ''} />
                  <div className="campo ancho"><BotonAccion clase="boton chico">Crear reserva y marcar reservado</BotonAccion></div>
                </form>
              </details>
            )}
          </div>

          <div className="tarjeta">
            <h2>Historial de etapa</h2>
            <div className="linea-tiempo">
              {historial?.map((h, i) => (
                <div className="evento" key={i}><strong>{etapa(h.a_etapa).nombre}</strong>{h.de_etapa ? <span className="gris"> desde {etapa(h.de_etapa).nombre}</span> : ''}{h.motivo ? ` · ${h.motivo}` : ''}<div className="cuando">{fecha(h.creado_en, destino.zona_horaria)} · {nombreUsuario(h.usuario_id) ?? h.actor ?? '—'}</div></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
