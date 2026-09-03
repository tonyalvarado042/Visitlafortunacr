import Link from 'next/link';
import { contextoPanel } from '@/lib/admin/contexto';
import { fecha, relativo } from '@/lib/admin/formato';
import { Cabecera, Vacio } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { descartar, marcarEnviado } from '../acciones';
import { Aprobar } from './Aprobar';

export const dynamic = 'force-dynamic';

export default async function PaginaAprobaciones() {
  const { destino, db } = await contextoPanel('ia');
  const [{ data: envios }, { data: pendientes }] = await Promise.all([
    db.from('dst_automatizacion_envio').select('id, intento, borrador, resultado, programado_para, solicitud_id, automatizacion:dst_automatizacion(nombre), viajero:dst_viajero(nombre, email, whatsapp, idioma)').eq('destino_id', destino.id).eq('estado', 'pendiente_aprobacion').order('programado_para'),
    db.from('dst_mensaje').select('id, canal, asunto, cuerpo, enviado_en, error_envio, solicitud_id, conversacion_id, viajero:dst_viajero(nombre, email, whatsapp)').eq('destino_id', destino.id).eq('estado_envio', 'pendiente').order('enviado_en').limit(50),
  ]);
  const uno = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);

  return (
    <>
      <Cabecera titulo="Aprobaciones" migas={[{ ruta: '/admin/ia', nombre: 'Inteligencia' }]} sub="Mensajes que la IA redactó y esperan a una persona, y mensajes que no se pudieron enviar porque el canal no está configurado." />

      <div className="tarjeta">
        <h2>Borradores de la IA por aprobar <small>{envios?.length ?? 0}</small></h2>
        {!envios?.length ? <Vacio texto="Nada por aprobar." /> : envios.map((e) => {
          const a = uno(e.automatizacion) as { nombre: string } | null;
          const v = uno(e.viajero) as { nombre: string | null; email: string | null; whatsapp: string | null; idioma: string | null } | null;
          return (
            <div key={e.id} style={{ borderTop: '1px solid #EEE', padding: '14px 0' }}>
              <div className="acciones-fila" style={{ marginBottom: 8 }}>
                <strong>{a?.nombre}</strong> <span className="gris">intento {e.intento} · programado {fecha(e.programado_para, destino.zona_horaria)}</span>
                <span>→ {e.solicitud_id ? <Link href={`/admin/leads/${e.solicitud_id}`}>{v?.nombre ?? v?.email ?? v?.whatsapp}</Link> : v?.nombre} <span className="gris">{v?.whatsapp ? 'WhatsApp' : 'correo'} · {v?.idioma}</span></span>
              </div>
              {e.resultado && <p className="gris" style={{ color: '#8B8B87', fontSize: 12.5, margin: '0 0 8px' }}>Por qué la IA lo escribió así: {e.resultado}</p>}
              <div className="lado" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'start' }}>
                <Aprobar id={e.id} borrador={e.borrador ?? ''} />
                <form action={descartar}><input type="hidden" name="id" value={e.id} /><BotonAccion clase="boton secundario" confirmar="¿Descartar este borrador?">Descartar</BotonAccion></form>
              </div>
            </div>
          );
        })}
      </div>

      <div className="tarjeta">
        <h2>Por enviar a mano <small>{pendientes?.length ?? 0} · el canal no está configurado o falló</small></h2>
        {!pendientes?.length ? <Vacio texto="Nada pendiente." /> : pendientes.map((m) => {
          const v = uno(m.viajero) as { nombre: string | null; email: string | null; whatsapp: string | null } | null;
          const enlace = m.canal === 'whatsapp' && v?.whatsapp ? `https://wa.me/${v.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(m.cuerpo)}` : m.canal === 'email' && v?.email ? `mailto:${v.email}?subject=${encodeURIComponent(m.asunto ?? '')}&body=${encodeURIComponent(m.cuerpo)}` : null;
          return (
            <div key={m.id} style={{ borderTop: '1px solid #EEE', padding: '12px 0' }}>
              <div className="acciones-fila" style={{ marginBottom: 6 }}>
                <strong>{v?.nombre ?? v?.email ?? v?.whatsapp ?? 'viajero'}</strong> <span className="gris">{m.canal} · {relativo(m.enviado_en)}</span>
                {m.solicitud_id && <Link href={`/admin/leads/${m.solicitud_id}`}>lead</Link>}
                {m.conversacion_id && <Link href={`/admin/conversaciones/${m.conversacion_id}`}>conversación</Link>}
              </div>
              <div className="msg ia" style={{ maxWidth: '100%', whiteSpace: 'pre-wrap', padding: '10px 13px', borderRadius: 10, background: '#F4F4F2', fontSize: 13.5 }}>{m.asunto && <strong>{m.asunto}{'\n'}</strong>}{m.cuerpo}</div>
              {m.error_envio && <div style={{ color: '#B42318', fontSize: 12, marginTop: 4 }}>{m.error_envio}</div>}
              <div className="acciones-fila" style={{ marginTop: 8 }}>
                {enlace && <a className="boton secundario chico" href={enlace} target="_blank" rel="noreferrer">Abrir en {m.canal === 'whatsapp' ? 'WhatsApp' : 'correo'} ↗</a>}
                <form action={marcarEnviado}><input type="hidden" name="mensaje_id" value={m.id} /><BotonAccion clase="boton chico">Ya lo mandé</BotonAccion></form>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
