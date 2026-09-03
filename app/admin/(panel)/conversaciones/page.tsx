import Link from 'next/link';
import { contextoPanel } from '@/lib/admin/contexto';
import { ESTADO_CONVERSACION, relativo, truncar } from '@/lib/admin/formato';
import { Cabecera, Etiqueta, Vacio } from '@/componentes/admin/ui';

export const dynamic = 'force-dynamic';

type Busqueda = { estado?: string; atendida?: string; revision?: string; canal?: string; q?: string };

export default async function PaginaConversaciones({ searchParams }: { searchParams: Promise<Busqueda> }) {
  const f = await searchParams;
  const { destino, db } = await contextoPanel('conversaciones');

  let consulta = db
    .from('dst_conversacion')
    .select('id, canal, estado, atendida_por, requiere_revision, motivo_revision, sentimiento, intencion, resumen_ia, calificacion_revision, total_mensajes, ultimo_mensaje_en, ultimo_mensaje_de, creado_en, viajero:dst_viajero(nombre, email, whatsapp, idioma)')
    .eq('destino_id', destino.id)
    .order('ultimo_mensaje_en', { ascending: false, nullsFirst: false })
    .limit(200);
  if (f.estado && ESTADO_CONVERSACION[f.estado]) consulta = consulta.eq('estado', f.estado);
  else if (f.estado !== 'todas') consulta = consulta.neq('estado', 'cerrada');
  if (f.atendida === 'ia' || f.atendida === 'humano') consulta = consulta.eq('atendida_por', f.atendida);
  if (f.revision === '1') consulta = consulta.eq('requiere_revision', true);
  if (f.canal) consulta = consulta.eq('canal', f.canal);
  const { data } = await consulta;

  const enlace = (cambios: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...f, ...cambios })) if (v) p.set(k, v);
    const s = p.toString();
    return `/admin/conversaciones${s ? `?${s}` : ''}`;
  };
  const uno = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);
  const colorSentimiento: Record<string, string> = { positivo: '#66BB2E', neutral: '#9CA3AF', negativo: '#EF4444' };

  return (
    <>
      <Cabecera titulo="Conversaciones" sub={`${data?.length ?? 0} hilos · ${destino.nombre}`} />
      <div className="filtros">
        <Link href={enlace({ estado: undefined })} className={!f.estado ? 'activo' : ''}>Abiertas</Link>
        {Object.entries(ESTADO_CONVERSACION).map(([k, v]) => <Link key={k} href={enlace({ estado: f.estado === k ? undefined : k })} className={f.estado === k ? 'activo' : ''}>{v.nombre}</Link>)}
        <Link href={enlace({ estado: 'todas' })} className={f.estado === 'todas' ? 'activo' : ''}>Todas</Link>
        <span style={{ width: 10 }} />
        <Link href={enlace({ revision: f.revision === '1' ? undefined : '1' })} className={f.revision === '1' ? 'activo' : ''}>Por revisar</Link>
        <Link href={enlace({ atendida: f.atendida === 'ia' ? undefined : 'ia' })} className={f.atendida === 'ia' ? 'activo' : ''}>Atiende IA</Link>
        <Link href={enlace({ atendida: f.atendida === 'humano' ? undefined : 'humano' })} className={f.atendida === 'humano' ? 'activo' : ''}>Atiende persona</Link>
        {['web', 'whatsapp', 'email'].map((c) => <Link key={c} href={enlace({ canal: f.canal === c ? undefined : c })} className={f.canal === c ? 'activo' : ''}>{c}</Link>)}
      </div>

      <div className="tarjeta desliza">
        {!data?.length ? <Vacio texto="No hay conversaciones con esos filtros. Cuando alguien escriba por el chat del sitio o por WhatsApp, aparece aquí." /> : (
          <table className="tabla">
            <thead><tr><th>Viajero</th><th>Canal</th><th>Estado</th><th>Atiende</th><th>Resumen de la IA</th><th>Msjs</th><th>Último</th><th>Revisión</th></tr></thead>
            <tbody>
              {data.map((c) => {
                const v = uno(c.viajero) as { nombre: string | null; email: string | null; whatsapp: string | null; idioma: string | null } | null;
                const est = ESTADO_CONVERSACION[c.estado] ?? { nombre: c.estado, color: '#9CA3AF' };
                return (
                  <tr key={c.id}>
                    <td><Link className="fuerte" href={`/admin/conversaciones/${c.id}`}>{v?.nombre || v?.email || v?.whatsapp || 'Visitante anónimo'}</Link><div className="gris">{v?.idioma ?? ''}{c.intencion ? ` · ${c.intencion}` : ''}</div></td>
                    <td>{c.canal}</td>
                    <td><Etiqueta color={est.color}>{est.nombre}</Etiqueta></td>
                    <td>{c.atendida_por === 'ia' ? <Etiqueta suave>IA</Etiqueta> : <Etiqueta color="#0B0B0B">Persona</Etiqueta>}</td>
                    <td>{c.sentimiento && <span className="punto" style={{ background: colorSentimiento[c.sentimiento] }} />}{truncar(c.resumen_ia, 110) || <span className="gris">sin analizar</span>}</td>
                    <td className="num">{c.total_mensajes}</td>
                    <td className="gris">{relativo(c.ultimo_mensaje_en)}{c.ultimo_mensaje_de ? ` · ${c.ultimo_mensaje_de}` : ''}</td>
                    <td>{c.requiere_revision ? <Etiqueta color="#EF4444">Revisar</Etiqueta> : c.calificacion_revision ? <span>{'★'.repeat(c.calificacion_revision)}</span> : <span className="gris">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
