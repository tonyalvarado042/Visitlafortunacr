import Link from 'next/link';
import { contextoPanel } from '@/lib/admin/contexto';
import { fecha, soloFecha } from '@/lib/admin/formato';
import { Cabecera, Etiqueta, Vacio } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { cambiarModeracion, ocultarResena, publicarResena, rechazarResena, responderResena } from './acciones';

export const dynamic = 'force-dynamic';

/*
 * Moderar las reseñas propias. Son las únicas que cuentan para el promedio y
 * para el marcado de la ficha, así que esta pantalla es la que decide qué
 * nota lleva cada negocio.
 */

type Fila = {
  id: string;
  calificacion: number;
  titulo: string | null;
  cuerpo: string;
  idioma: string;
  estado: 'pendiente' | 'publicada' | 'oculta' | 'rechazada';
  visitado_el: string | null;
  creado_en: string;
  motivo_rechazo: string | null;
  respuesta_negocio: string | null;
  negocio: { id: string; nombre: string } | { id: string; nombre: string }[] | null;
  viajero: { nombre: string | null; email: string | null } | { nombre: string | null; email: string | null }[] | null;
};

const uno = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);
const COLOR: Record<string, string> = {
  pendiente: '#F59E0B', publicada: '#66BB2E', oculta: '#9CA3AF', rechazada: '#EF4444',
};

function Volcanes({ nota }: { nota: number }) {
  return (
    <span title={`${nota} de 5`} style={{ color: 'var(--naranja)', letterSpacing: 1 }}>
      {'▲'.repeat(nota)}<span style={{ color: '#D8D8D3' }}>{'▲'.repeat(5 - nota)}</span>
    </span>
  );
}

function Resena({ r, zona }: { r: Fila; zona: string }) {
  const n = uno(r.negocio);
  const v = uno(r.viajero);
  return (
    <div style={{ borderTop: '1px solid #EEE', padding: '14px 0' }}>
      <div className="acciones-fila" style={{ marginBottom: 6 }}>
        <Volcanes nota={r.calificacion} />
        <strong>{n ? <Link href={`/admin/negocios/${n.id}`}>{n.nombre}</Link> : '—'}</strong>
        <Etiqueta color={COLOR[r.estado]}>{r.estado}</Etiqueta>
        <span className="gris" style={{ color: '#8B8B87', fontSize: 12.5 }}>
          {v?.nombre ?? 'anónimo'} · {v?.email} · {r.idioma} · {fecha(r.creado_en, zona)}
          {r.visitado_el ? ` · fue el ${soloFecha(r.visitado_el)}` : ''}
        </span>
      </div>

      {r.titulo && <strong style={{ display: 'block', marginBottom: 4 }}>{r.titulo}</strong>}
      <p style={{ margin: '0 0 10px', fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{r.cuerpo}</p>
      {r.motivo_rechazo && (
        <p style={{ margin: '0 0 10px', fontSize: 12.5, color: '#B42318' }}>Rechazada: {r.motivo_rechazo}</p>
      )}

      <div className="acciones-fila">
        {r.estado !== 'publicada' && (
          <form action={publicarResena}>
            <input type="hidden" name="id" value={r.id} />
            <BotonAccion clase="boton chico">Publicar</BotonAccion>
          </form>
        )}
        {r.estado === 'publicada' && (
          <form action={ocultarResena}>
            <input type="hidden" name="id" value={r.id} />
            <BotonAccion clase="boton chico secundario" confirmar="¿Ocultarla de la ficha?">Ocultar</BotonAccion>
          </form>
        )}
        {r.estado !== 'rechazada' && (
          <form action={rechazarResena} className="acciones-fila">
            <input type="hidden" name="id" value={r.id} />
            <input name="motivo" placeholder="Motivo del rechazo" maxLength={200}
                   style={{ border: '1px solid #D8D8D3', borderRadius: 8, padding: '6px 10px', fontFamily: 'inherit', fontSize: 12.5 }} />
            <BotonAccion clase="boton chico secundario" confirmar="¿Rechazar esta reseña?">Rechazar</BotonAccion>
          </form>
        )}
      </div>

      <form action={responderResena} className="campo" style={{ marginTop: 10 }}>
        <input type="hidden" name="id" value={r.id} />
        <label>Respuesta del negocio (se publica bajo la reseña)</label>
        <textarea name="respuesta" rows={2} defaultValue={r.respuesta_negocio ?? ''} style={{ minHeight: 56 }} />
        <div style={{ marginTop: 6 }}><BotonAccion clase="boton chico secundario">Guardar respuesta</BotonAccion></div>
      </form>
    </div>
  );
}

export default async function PaginaResenas() {
  const { destino, db } = await contextoPanel('resenas');

  const [{ data: filas }, { data: ajuste }] = await Promise.all([
    db.from('dst_resena')
      .select('id, calificacion, titulo, cuerpo, idioma, estado, visitado_el, creado_en, motivo_rechazo, respuesta_negocio, negocio:dst_negocio!inner(id, nombre, destino_id), viajero:dst_viajero(nombre, email)')
      .eq('negocio.destino_id', destino.id)
      .order('creado_en', { ascending: false })
      .limit(200),
    db.from('dst_destino').select('resenas_moderadas').eq('id', destino.id).maybeSingle(),
  ]);

  const todas = (filas ?? []) as unknown as Fila[];
  const modera = !!ajuste?.resenas_moderadas;
  const por = (estado: Fila['estado']) => todas.filter((r) => r.estado === estado);
  const pendientes = por('pendiente');
  const publicadas = por('publicada');
  const guardadas = [...por('oculta'), ...por('rechazada')];

  return (
    <>
      <Cabecera
        titulo="Reseñas"
        sub="Las reseñas que dejan los viajeros en las fichas. Son las únicas que mueven el promedio del negocio y el aggregateRating que ve Google; lo de Google, Booking y Tripadvisor va aparte, citado a su fuente."
      />

      <div className="tarjeta">
        <h2>Cómo entran <small>{modera ? 'se revisan antes de publicarse' : 'se publican al enviarse'}</small></h2>
        <p style={{ fontSize: 13, color: '#555', margin: '0 0 12px', maxWidth: '76ch' }}>
          {modera
            ? 'Ahora mismo ninguna reseña se ve en el sitio hasta que alguien la publique desde aquí. Es lo correcto cuando hay volumen; con pocas visitas, significa fichas sin una sola reseña durante días.'
            : 'Ahora mismo la reseña se ve en la ficha apenas se envía, y desde aquí se oculta o se rechaza si no corresponde. Es lo razonable mientras el volumen sea bajo.'}
        </p>
        <form action={cambiarModeracion}>
          <input type="hidden" name="moderar" value={modera ? '0' : '1'} />
          <BotonAccion clase="boton chico secundario">
            {modera ? 'Publicar sin revisar' : 'Revisar antes de publicar'}
          </BotonAccion>
        </form>
      </div>

      <div className="tarjeta">
        <h2>Por revisar <small>{pendientes.length}</small></h2>
        {!pendientes.length
          ? <Vacio texto={modera ? 'Nada por revisar.' : 'Nada pendiente: este destino publica sin revisión previa.'} />
          : pendientes.map((r) => <Resena key={r.id} r={r} zona={destino.zona_horaria} />)}
      </div>

      <div className="tarjeta">
        <h2>Publicadas <small>{publicadas.length}</small></h2>
        {!publicadas.length
          ? <Vacio texto="Todavía nadie ha dejado una reseña." />
          : publicadas.map((r) => <Resena key={r.id} r={r} zona={destino.zona_horaria} />)}
      </div>

      {guardadas.length > 0 && (
        <div className="tarjeta">
          <h2>Ocultas y rechazadas <small>{guardadas.length}</small></h2>
          {guardadas.map((r) => <Resena key={r.id} r={r} zona={destino.zona_horaria} />)}
        </div>
      )}
    </>
  );
}
