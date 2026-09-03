import Link from 'next/link';
import { contextoPanel } from '@/lib/admin/contexto';
import { dinero, etapa, ETAPAS, relativo, TEMPERATURA, TIPO_SOLICITUD, truncar } from '@/lib/admin/formato';
import { Cabecera, Etiqueta, Vacio } from '@/componentes/admin/ui';

export const dynamic = 'force-dynamic';

type Busqueda = Promise<{ vista?: string; etapa?: string; mios?: string; temperatura?: string; tipo?: string; q?: string }>;

type Fila = {
  id: string; tipo: string; etapa: string; puntaje_ia: number | null; temperatura: string | null; siguiente_accion: string | null;
  siguiente_accion_el: string | null; valor_estimado_usd: number | null; responsable_id: string | null; creado_en: string;
  ultimo_contacto_en: string | null; ultimo_contacto_de: string | null; primera_respuesta_en: string | null;
  viajero: { id: string; nombre: string | null; email: string | null; whatsapp: string | null; llega_el: string | null; personas: number | null; pais_iso: string | null; idioma: string | null } | null;
};

export default async function PaginaLeads({ searchParams }: { searchParams: Promise<Awaited<Busqueda>> }) {
  const filtros = await searchParams;
  const { usuario, destino, db } = await contextoPanel('leads');
  const vista = filtros.vista === 'tabla' ? 'tabla' : 'tablero';

  let consulta = db
    .from('dst_solicitud')
    .select('id, tipo, etapa, puntaje_ia, temperatura, siguiente_accion, siguiente_accion_el, valor_estimado_usd, responsable_id, creado_en, ultimo_contacto_en, ultimo_contacto_de, primera_respuesta_en, viajero:dst_viajero!inner(id, nombre, email, whatsapp, llega_el, personas, pais_iso, idioma)')
    .eq('destino_id', destino.id)
    .order('creado_en', { ascending: false })
    .limit(300);
  if (filtros.etapa && ETAPAS.some((e) => e.valor === filtros.etapa)) consulta = consulta.eq('etapa', filtros.etapa);
  else if (vista === 'tablero') consulta = consulta.not('etapa', 'in', '("perdido")');
  if (filtros.mios === '1') consulta = consulta.eq('responsable_id', usuario.id);
  if (filtros.temperatura && TEMPERATURA[filtros.temperatura]) consulta = consulta.eq('temperatura', filtros.temperatura);
  if (filtros.tipo && TIPO_SOLICITUD[filtros.tipo]) consulta = consulta.eq('tipo', filtros.tipo);
  if (filtros.q) {
    const q = filtros.q.replace(/[,()%*]/g, ' ').trim();
    if (q) consulta = consulta.or(`nombre.ilike.%${q}%,email.ilike.%${q}%,whatsapp.ilike.%${q}%`, { referencedTable: 'dst_viajero' });
  }
  const { data } = await consulta;
  const filas = ((data ?? []) as unknown[]).map((f) => {
    const x = f as Fila & { viajero: Fila['viajero'] | Fila['viajero'][] };
    return { ...x, viajero: Array.isArray(x.viajero) ? x.viajero[0] ?? null : x.viajero } as Fila;
  });

  const { data: equipo } = await db.from('dst_usuario').select('id, nombre').eq('esta_activo', true);
  const nombreDe = (id: string | null) => equipo?.find((u) => u.id === id)?.nombre ?? null;

  const enlace = (cambios: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filtros, ...cambios })) if (v) p.set(k, v);
    const s = p.toString();
    return `/admin/leads${s ? `?${s}` : ''}`;
  };

  const nombre = (f: Fila) => f.viajero?.nombre || f.viajero?.email || f.viajero?.whatsapp || 'Sin nombre';

  return (
    <>
      <Cabecera titulo="Leads" sub={`${filas.length} solicitudes · ${destino.nombre}`}>
        <Link href={enlace({ vista: undefined })} className={`boton ${vista === 'tablero' ? '' : 'secundario'}`}>Tablero</Link>
        <Link href={enlace({ vista: 'tabla' })} className={`boton ${vista === 'tabla' ? '' : 'secundario'}`}>Tabla</Link>
      </Cabecera>

      <div className="filtros">
        <form action="/admin/leads" method="get">
          {vista === 'tabla' && <input type="hidden" name="vista" value="tabla" />}
          <input type="search" name="q" placeholder="Buscar nombre, correo o WhatsApp" defaultValue={filtros.q ?? ''} />
        </form>
        <Link href={enlace({ mios: filtros.mios === '1' ? undefined : '1' })} className={filtros.mios === '1' ? 'activo' : ''}>Míos</Link>
        {Object.entries(TEMPERATURA).map(([k, v]) => (
          <Link key={k} href={enlace({ temperatura: filtros.temperatura === k ? undefined : k })} className={filtros.temperatura === k ? 'activo' : ''}>{v.nombre}</Link>
        ))}
        {Object.entries(TIPO_SOLICITUD).map(([k, v]) => (
          <Link key={k} href={enlace({ tipo: filtros.tipo === k ? undefined : k })} className={filtros.tipo === k ? 'activo' : ''}>{v}</Link>
        ))}
        {vista === 'tabla' && ETAPAS.map((e) => (
          <Link key={e.valor} href={enlace({ etapa: filtros.etapa === e.valor ? undefined : e.valor })} className={filtros.etapa === e.valor ? 'activo' : ''}>{e.nombre}</Link>
        ))}
      </div>

      {vista === 'tablero' ? (
        <div className="kanban">
          {ETAPAS.filter((e) => e.valor !== 'perdido').map((e) => {
            const columna = filas.filter((f) => f.etapa === e.valor);
            const valor = columna.reduce((acc, f) => acc + Number(f.valor_estimado_usd ?? 0), 0);
            return (
              <div className="columna" key={e.valor}>
                <h3><span style={{ color: e.color, fontWeight: 800 }}>{e.nombre}</span><span>{columna.length}{valor ? ` · ${dinero(valor)}` : ''}</span></h3>
                {columna.map((f) => {
                  const temp = f.temperatura ? TEMPERATURA[f.temperatura] : null;
                  return (
                    <Link href={`/admin/leads/${f.id}`} className="ficha" key={f.id}>
                      <div className="nombre">{nombre(f)} {f.puntaje_ia != null && <span style={{ color: temp?.color ?? '#333', float: 'right' }}>{f.puntaje_ia}</span>}</div>
                      <div className="meta">{TIPO_SOLICITUD[f.tipo] ?? f.tipo}{f.viajero?.llega_el ? ` · llega ${f.viajero.llega_el}` : ''}{f.viajero?.personas ? ` · ${f.viajero.personas} pax` : ''}{f.valor_estimado_usd ? ` · ${dinero(f.valor_estimado_usd)}` : ''}</div>
                      {f.siguiente_accion && <div className="accion">→ {truncar(f.siguiente_accion, 80)}</div>}
                      <div className="meta">{relativo(f.creado_en)}{f.responsable_id ? ` · ${nombreDe(f.responsable_id) ?? ''}` : ' · sin responsable'}{!f.primera_respuesta_en ? ' · sin responder' : ''}</div>
                    </Link>
                  );
                })}
                {!columna.length && <div className="vacio" style={{ padding: 14 }}>—</div>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="tarjeta desliza">
          {!filas.length ? <Vacio texto="No hay leads con esos filtros." /> : (
            <table className="tabla">
              <thead><tr><th>Viajero</th><th>Tipo</th><th>Etapa</th><th>Puntaje</th><th>Valor</th><th>Llega</th><th>Último contacto</th><th>Responsable</th><th>Creado</th></tr></thead>
              <tbody>
                {filas.map((f) => {
                  const e = etapa(f.etapa);
                  const temp = f.temperatura ? TEMPERATURA[f.temperatura] : null;
                  return (
                    <tr key={f.id}>
                      <td><Link className="fuerte" href={`/admin/leads/${f.id}`}>{nombre(f)}</Link><div className="gris">{f.viajero?.email ?? f.viajero?.whatsapp ?? ''}{f.viajero?.pais_iso ? ` · ${f.viajero.pais_iso}` : ''}{f.viajero?.idioma ? ` · ${f.viajero.idioma}` : ''}</div></td>
                      <td>{TIPO_SOLICITUD[f.tipo] ?? f.tipo}</td>
                      <td><Etiqueta color={e.color}>{e.nombre}</Etiqueta></td>
                      <td className="num">{f.puntaje_ia == null ? <span className="gris">—</span> : <span style={{ fontWeight: 800, color: temp?.color }}>{f.puntaje_ia}</span>}</td>
                      <td className="num">{dinero(f.valor_estimado_usd)}</td>
                      <td>{f.viajero?.llega_el ?? '—'}</td>
                      <td className="gris">{f.ultimo_contacto_en ? `${relativo(f.ultimo_contacto_en)} (${f.ultimo_contacto_de})` : 'nunca'}</td>
                      <td>{nombreDe(f.responsable_id) ?? <span className="gris">—</span>}</td>
                      <td className="gris">{relativo(f.creado_en)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
