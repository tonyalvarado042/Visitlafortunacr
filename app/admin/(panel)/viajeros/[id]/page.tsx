import Link from 'next/link';
import { notFound } from 'next/navigation';
import { contextoPanel } from '@/lib/admin/contexto';
import { dinero, etapa, fecha, relativo, TIPO_SOLICITUD } from '@/lib/admin/formato';
import { Cabecera, Etiqueta, Vacio } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { editarViajero } from '../acciones';

export const dynamic = 'force-dynamic';

type Ficha = {
  viajero: Record<string, string | number | boolean | string[] | null> & { id: string };
  solicitudes: { id: string; tipo: string; etapa: string; puntaje_ia: number | null; valor_estimado_usd: number | null; creado_en: string; siguiente_accion: string | null }[];
  reservas: { id: string; codigo: string; estado: string; total_usd: number; estado_pago: string; creado_en: string }[];
  conversaciones: { id: string; canal: string; estado: string; atendida_por: string; resumen_ia: string | null; ultimo_mensaje_en: string | null }[];
  itinerarios: { id: string; titulo: string; babosa: string; dias: number; idioma: string; creado_en: string }[];
  tareas: { id: string; titulo: string; vence_el: string | null; prioridad: string }[];
  mensajes: { id: string; canal: string; direccion: string; autor: string; cuerpo: string; enviado_en: string; asunto: string | null }[];
};

export default async function PaginaViajero({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { destino, db } = await contextoPanel('viajeros');
  const { data } = await db.rpc('contexto_viajero', { p_viajero_id: id, p_max_mensajes: 40 });
  const ficha = data as Ficha | null;
  if (!ficha?.viajero) notFound();
  const v = ficha.viajero;
  if (v.destino_id !== destino.id) notFound();
  const nombre = [v.nombre, v.apellidos].filter(Boolean).join(' ') || (v.email as string) || (v.whatsapp as string);

  return (
    <>
      <Cabecera titulo={String(nombre)} migas={[{ ruta: '/admin/viajeros', nombre: 'Viajeros' }]} sub={<>{v.email ?? ''} {v.whatsapp ?? ''} · {v.idioma ?? '—'} · desde {relativo(v.creado_en as string)}</>}>
        {v.whatsapp ? <a className="boton secundario" href={`https://wa.me/${String(v.whatsapp).replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp ↗</a> : null}
        {v.email ? <a className="boton secundario" href={`mailto:${v.email}`}>Correo</a> : null}
      </Cabecera>

      <div className="lado">
        <div>
          {v.resumen_ia && <div className="tarjeta"><h2>Resumen de la IA</h2><p style={{ margin: 0 }}>{v.resumen_ia}</p></div>}

          <div className="tarjeta">
            <h2>Solicitudes</h2>
            {!ficha.solicitudes.length ? <Vacio texto="Sin solicitudes." /> : (
              <table className="tabla"><tbody>{ficha.solicitudes.map((s) => { const e = etapa(s.etapa); return (
                <tr key={s.id}><td><Link className="fuerte" href={`/admin/leads/${s.id}`}>{TIPO_SOLICITUD[s.tipo] ?? s.tipo}</Link><div className="gris">{relativo(s.creado_en)}{s.siguiente_accion ? ` · ${s.siguiente_accion}` : ''}</div></td><td><Etiqueta color={e.color}>{e.nombre}</Etiqueta></td><td className="num">{s.puntaje_ia ?? '—'}</td><td className="num">{dinero(s.valor_estimado_usd)}</td></tr>
              ); })}</tbody></table>
            )}
          </div>

          <div className="dos">
            <div className="tarjeta">
              <h2>Reservas</h2>
              {!ficha.reservas.length ? <Vacio texto="Ninguna." /> : ficha.reservas.map((r) => <div key={r.id}><Link className="fuerte" href={`/admin/reservas/${r.id}`}>{r.codigo}</Link> · {r.estado} · {dinero(r.total_usd)} · {r.estado_pago}</div>)}
            </div>
            <div className="tarjeta">
              <h2>Planes</h2>
              {!ficha.itinerarios.length ? <Vacio texto="Ninguno." /> : ficha.itinerarios.map((i) => <div key={i.id}><a href={`https://${destino.dominio}/${i.idioma}/plan/${i.babosa}`} target="_blank" rel="noreferrer">{i.titulo}</a> <span className="gris">{i.dias} días</span></div>)}
            </div>
          </div>

          <div className="tarjeta">
            <h2>Conversaciones</h2>
            {!ficha.conversaciones.length ? <Vacio texto="Ninguna." /> : ficha.conversaciones.map((c) => <div key={c.id} style={{ marginBottom: 6 }}><Link className="fuerte" href={`/admin/conversaciones/${c.id}`}>{c.canal} · {c.estado}</Link> <span className="gris">{c.atendida_por} · {relativo(c.ultimo_mensaje_en)}</span>{c.resumen_ia && <div className="gris">{c.resumen_ia}</div>}</div>)}
          </div>

          <div className="tarjeta">
            <h2>Mensajes recientes</h2>
            {!ficha.mensajes.length ? <Vacio texto="Ninguno." /> : (
              <div className="chat">{ficha.mensajes.map((m) => (
                <div key={m.id} className={`msg ${m.canal === 'nota_interna' ? 'sistema nota-interna' : m.autor === 'viajero' ? 'viajero' : m.autor === 'equipo' ? 'equipo' : m.autor === 'ia' ? 'ia' : 'sistema'}`}>
                  <div className="quien">{m.autor} · {m.canal} · {fecha(m.enviado_en, destino.zona_horaria)}</div>{m.asunto && <div style={{ fontWeight: 700 }}>{m.asunto}</div>}{m.cuerpo}
                </div>
              ))}</div>
            )}
          </div>
        </div>

        <div>
          <div className="tarjeta">
            <h2>Ficha</h2>
            <form action={editarViajero} className="campos">
              <input type="hidden" name="id" value={v.id} />
              <div className="campo"><label>Nombre</label><input name="nombre" defaultValue={(v.nombre as string) ?? ''} /></div>
              <div className="campo"><label>Apellidos</label><input name="apellidos" defaultValue={(v.apellidos as string) ?? ''} /></div>
              <div className="campo"><label>Correo</label><input type="email" name="email" defaultValue={(v.email as string) ?? ''} /></div>
              <div className="campo"><label>WhatsApp</label><input name="whatsapp" defaultValue={(v.whatsapp as string) ?? ''} placeholder="+506…" /></div>
              <div className="campo"><label>País (ISO)</label><input name="pais_iso" maxLength={2} defaultValue={(v.pais_iso as string) ?? ''} /></div>
              <div className="campo"><label>Idioma</label><select name="idioma" defaultValue={(v.idioma as string) ?? 'es'}>{['es', 'en', 'pt', 'fr', 'de'].map((i) => <option key={i} value={i}>{i}</option>)}</select></div>
              <div className="campo"><label>Llega</label><input type="date" name="llega_el" defaultValue={(v.llega_el as string) ?? ''} /></div>
              <div className="campo"><label>Se va</label><input type="date" name="sale_el" defaultValue={(v.sale_el as string) ?? ''} /></div>
              <div className="campo"><label>Personas</label><input type="number" name="personas" min={1} defaultValue={(v.personas as number) ?? ''} /></div>
              <div className="campo"><label>Niños</label><input type="number" name="ninos" min={0} defaultValue={(v.ninos as number) ?? ''} /></div>
              <div className="campo"><label>Viaja</label><select name="tipo_viajero" defaultValue={(v.tipo_viajero as string) ?? ''}><option value="">—</option>{['pareja', 'familia', 'amigos', 'solo', 'grupo', 'negocios'].map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
              <div className="campo"><label>Presupuesto</label><select name="presupuesto" defaultValue={(v.presupuesto as string) ?? ''}><option value="">—</option>{['economico', 'medio', 'alto', 'lujo'].map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
              <div className="campo"><label>Presupuesto USD</label><input type="number" name="presupuesto_usd" defaultValue={(v.presupuesto_usd as number) ?? ''} /></div>
              <div className="campo ancho"><label>Intereses (separados por coma)</label><input name="intereses" defaultValue={((v.intereses as string[]) ?? []).join(', ')} /></div>
              <div className="campo ancho"><label>Notas internas</label><textarea name="notas" defaultValue={(v.notas as string) ?? ''} style={{ minHeight: 70 }} /></div>
              <div className="campo ancho acciones-fila">
                <label><input type="checkbox" name="no_molestar" value="1" defaultChecked={!!v.no_molestar} /> No molestar (sin automatizaciones)</label>
                <label><input type="checkbox" name="acepta_marketing" value="1" defaultChecked={!!v.acepta_marketing} /> Acepta marketing</label>
              </div>
              <div className="campo ancho"><BotonAccion>Guardar</BotonAccion></div>
            </form>
            <dl className="detalle-lista" style={{ marginTop: 14 }}>
              <dt>Origen</dt><dd>{(v.origen as string) ?? '—'}{v.utm_fuente ? ` · ${v.utm_fuente} / ${v.utm_medio ?? ''} / ${v.utm_campana ?? ''}` : ''}</dd>
              <dt>Página</dt><dd style={{ wordBreak: 'break-all' }}>{(v.pagina_entrada as string) ?? '—'}</dd>
            </dl>
          </div>

          <div className="tarjeta">
            <h2>Tareas abiertas</h2>
            {!ficha.tareas.length ? <Vacio texto="Ninguna." /> : ficha.tareas.map((t) => <div key={t.id}>{t.titulo} <span className="gris">{t.prioridad} · {t.vence_el ?? '—'}</span></div>)}
          </div>
        </div>
      </div>
    </>
  );
}
