import Link from 'next/link';
import { notFound } from 'next/navigation';
import { contextoPanel } from '@/lib/admin/contexto';
import { dinero, etapa, fecha, relativo, TIPO_SOLICITUD } from '@/lib/admin/formato';
import { Cabecera, Etiqueta, Vacio } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { editarViajero } from '../acciones';
import { NOMBRE_PROPIO, type Idioma } from '@/lib/idiomas';

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

  /* Las etiquetas de la persona. Se leen acá y no dentro de `contexto_viajero`
     porque esa función la comparten varias pantallas y esto solo lo usa esta.
     El vocabulario viene de la base, no de una lista en el código: así una
     etiqueta nueva aparece sola, sin desplegar nada. */
  const [{ data: vocabulario }, { data: puestas }] = await Promise.all([
    db.from('dst_etiqueta').select('id, grupo, babosa, nombre')
      .in('grupo', ['interes', 'momento', 'mano']).order('grupo').order('babosa'),
    db.from('dst_viajero_etiqueta').select('etiqueta_id').eq('viajero_id', id),
  ]);
  const yaPuestas = new Set((puestas ?? []).map((e) => e.etiqueta_id as string));
  const porGrupo = (grupo: string) =>
    (vocabulario ?? []).filter((e) => e.grupo === grupo) as
      { id: string; grupo: string; babosa: string; nombre: string }[];

  /* Los intereses que la IA sacó de una conversación y que NO son parte del
     vocabulario: "pesca", "fotografía". No tienen casilla y no se pueden
     editar acá, pero se MUESTRAN. Esconderlos sería peor que no tenerlos: se
     usan para redactar, y alguien tiene que poder ver con qué está hablando
     la IA. Ver el disparador refrescar_intereses_del_viajero. */
  const deLaIA = ((v.intereses as string[]) ?? [])
    .filter((i) => !(vocabulario ?? []).some((e) => e.grupo === 'interes' && e.babosa === i));

  const TITULO_GRUPO: Record<string, string> = {
    interes: 'Qué le gusta',
    momento: 'Dónde va en su viaje',
    mano: 'Etiquetas tuyas',
  };
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
              {/* Los idiomas del destino, no los cinco que existen en el codigo. Si
                  en Ajustes se apagaron el aleman y el frances, ofrecerlos aca
                  es ofrecer algo que el sitio ya no sirve. El que el viajero
                  tenga guardado se respeta aunque se haya apagado: cambiarselo
                  por lo bajo seria peor. */}
              <div className="campo"><label>Idioma</label><select name="idioma" defaultValue={(v.idioma as string) ?? destino.idioma_principal}>{[...new Set([...(destino.idiomas ?? []), (v.idioma as string) ?? destino.idioma_principal])].map((i) => <option key={i} value={i}>{NOMBRE_PROPIO[i as Idioma] ?? i}</option>)}</select></div>
              <div className="campo"><label>Llega</label><input type="date" name="llega_el" defaultValue={(v.llega_el as string) ?? ''} /></div>
              <div className="campo"><label>Se va</label><input type="date" name="sale_el" defaultValue={(v.sale_el as string) ?? ''} /></div>
              <div className="campo"><label>Personas</label><input type="number" name="personas" min={1} defaultValue={(v.personas as number) ?? ''} /></div>
              <div className="campo"><label>Niños</label><input type="number" name="ninos" min={0} defaultValue={(v.ninos as number) ?? ''} /></div>
              <div className="campo"><label>Viaja</label><select name="tipo_viajero" defaultValue={(v.tipo_viajero as string) ?? ''}><option value="">—</option>{['pareja', 'familia', 'amigos', 'solo', 'grupo', 'negocios'].map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
              <div className="campo"><label>Presupuesto</label><select name="presupuesto" defaultValue={(v.presupuesto as string) ?? ''}><option value="">—</option>{['economico', 'medio', 'alto', 'lujo'].map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
              <div className="campo"><label>Presupuesto USD</label><input type="number" name="presupuesto_usd" defaultValue={(v.presupuesto_usd as number) ?? ''} /></div>
              {['interes', 'momento', 'mano'].map((grupo) => porGrupo(grupo).length ? (
                <div className="campo ancho" key={grupo}>
                  <label>{TITULO_GRUPO[grupo]}</label>
                  <div className="etiquetas-casillas">
                    {porGrupo(grupo).map((e) => (
                      <label key={e.id} className="etiqueta-casilla">
                        <input type="checkbox" name="etiqueta" value={e.id}
                               defaultChecked={yaPuestas.has(e.id)} />
                        <span>{e.nombre}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null)}
              {deLaIA.length ? (
                <div className="campo ancho">
                  <label>Lo que sacó la IA de la conversación</label>
                  <p className="gris" style={{ margin: 0, fontSize: 12.5 }}>
                    {deLaIA.join(' · ')}
                    <br />
                    <span style={{ fontSize: 11.5 }}>
                      No está en el vocabulario, así que no entra a ningún envío por sí solo.
                      Si vale, márcalo arriba.
                    </span>
                  </p>
                </div>
              ) : null}
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
