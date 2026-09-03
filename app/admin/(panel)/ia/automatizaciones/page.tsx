import Link from 'next/link';
import { contextoPanel } from '@/lib/admin/contexto';
import { ACCION, DISPARADOR, fecha } from '@/lib/admin/formato';
import { Cabecera, Etiqueta, Vacio } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { alternarAutomatizacion } from '../acciones';

export const dynamic = 'force-dynamic';

const ESTADO: Record<string, string> = { programado: '#3B82F6', pendiente_aprobacion: '#F59E0B', hecho: '#66BB2E', omitido: '#9CA3AF', fallido: '#EF4444', cancelado: '#6B7280' };

export default async function PaginaAutomatizaciones() {
  const { destino, db } = await contextoPanel('ia');
  const [{ data: reglas }, { data: envios }] = await Promise.all([
    db.from('dst_automatizacion').select('*').eq('destino_id', destino.id).order('orden'),
    db.from('dst_automatizacion_envio').select('id, estado, intento, programado_para, ejecutado_en, resultado, solicitud_id, automatizacion:dst_automatizacion(nombre), viajero:dst_viajero(nombre)').eq('destino_id', destino.id).order('creado_en', { ascending: false }).limit(40),
  ]);
  const uno = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);

  return (
    <>
      <Cabecera titulo="Automatizaciones" migas={[{ ruta: '/admin/ia', nombre: 'Inteligencia' }]} sub="Cuando pasa X, se hace Y. El cron las revisa cada hora; nunca escribe entre 21:00 y 8:00 del destino." />
      <div className="tarjeta desliza">
        {!reglas?.length ? <Vacio texto="Sin reglas." /> : (
          <table className="tabla">
            <thead><tr><th>Regla</th><th>Cuándo</th><th>Qué hace</th><th>Condiciones</th><th>Aprueba</th><th>Activa</th></tr></thead>
            <tbody>{reglas.map((a) => (
              <tr key={a.id} style={{ opacity: a.esta_activa ? 1 : .55 }}>
                <td><Link className="fuerte" href={`/admin/ia/automatizaciones/${a.id}`}>{a.nombre}</Link><div className="gris">{a.descripcion}</div></td>
                <td>{DISPARADOR[a.disparador] ?? a.disparador}{Number(a.retraso_horas) > 0 ? <div className="gris">+{a.retraso_horas} h</div> : null}</td>
                <td>{ACCION[a.accion] ?? a.accion}<div className="gris">{Object.entries(a.parametros as Record<string, unknown>).map(([k, v]) => `${k}: ${v}`).join(' · ')}</div></td>
                <td className="gris">{Object.entries(a.condiciones as Record<string, unknown>).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join('/') : v}`).join(' · ') || '—'}<div>máx. {a.maximo_por_solicitud} por lead</div></td>
                <td>{a.requiere_aprobacion ? <Etiqueta color="#F59E0B">persona</Etiqueta> : <Etiqueta suave>automático</Etiqueta>}</td>
                <td><form action={alternarAutomatizacion}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="activa" value={a.esta_activa ? '0' : '1'} /><BotonAccion clase={`boton chico ${a.esta_activa ? 'secundario' : 'verde'}`}>{a.esta_activa ? 'Apagar' : 'Encender'}</BotonAccion></form></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      <div className="tarjeta desliza">
        <h2>Últimos envíos programados</h2>
        {!envios?.length ? <Vacio texto="El motor todavía no programó nada: aparece en cuanto haya leads." /> : (
          <table className="tabla">
            <thead><tr><th>Regla</th><th>Viajero</th><th>Estado</th><th>Programado</th><th>Ejecutado</th><th>Resultado</th></tr></thead>
            <tbody>{envios.map((e) => {
              const a = uno(e.automatizacion) as { nombre: string } | null;
              const v = uno(e.viajero) as { nombre: string | null } | null;
              return (
                <tr key={e.id}>
                  <td>{a?.nombre} <span className="gris">#{e.intento}</span></td>
                  <td>{e.solicitud_id ? <Link href={`/admin/leads/${e.solicitud_id}`}>{v?.nombre ?? 'lead'}</Link> : v?.nombre ?? '—'}</td>
                  <td><Etiqueta color={ESTADO[e.estado]}>{e.estado}</Etiqueta></td>
                  <td className="gris">{fecha(e.programado_para, destino.zona_horaria)}</td>
                  <td className="gris">{e.ejecutado_en ? fecha(e.ejecutado_en, destino.zona_horaria) : '—'}</td>
                  <td className="gris">{e.resultado ?? ''}</td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>
    </>
  );
}
