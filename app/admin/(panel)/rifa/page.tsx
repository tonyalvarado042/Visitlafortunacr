import Link from 'next/link';
import { contextoPanel } from '@/lib/admin/contexto';
import { Aviso, Cabecera, Etiqueta, Vacio } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { guardarRifa } from './acciones';

export const dynamic = 'force-dynamic';

type Rifa = {
  id: string; babosa: string; esta_activo: boolean;
  titulo: string; gancho: string | null;
  premio_titulo: string | null; premio_usd: number | null;
  fecha_sorteo: string | null; cuando_texto: string | null;
  ganadores: number; en_vivo: boolean; enlace_vivo: string | null;
  imagen_url: string | null; bases_html: string | null;
  pide_whatsapp: boolean; whatsapp_obligatorio: boolean;
  aviso_activo: boolean; segundos_para_abrir: number;
  al_intentar_salir: boolean; dias_para_repreguntar: number;
  cerrado_en: string | null; ganador_nombre: string | null; ganador_nota: string | null;
};

type Participante = {
  nombre: string; email: string; whatsapp: string | null;
  idioma: string; origen: string; creado_en: string;
};

export default async function PaginaRifa() {
  const { destino, db, usuario } = await contextoPanel('rifa');
  const esAdmin = usuario.rol === 'admin';

  const { data: r } = await db
    .from('dst_sorteo').select('*').eq('destino_id', destino.id).maybeSingle();
  const rifa = r as Rifa | null;

  if (!rifa) {
    return (
      <>
        <Cabecera titulo="Rifa" />
        <Vacio texto="Este destino todavía no tiene rifa. Se crea desde la base." />
      </>
    );
  }

  const { data: p, count } = await db
    .from('dst_sorteo_participacion')
    .select('nombre, email, whatsapp, idioma, origen, creado_en', { count: 'exact' })
    .eq('sorteo_id', rifa.id)
    .order('creado_en', { ascending: false })
    .limit(100);
  const gente = (p ?? []) as Participante[];
  const total = count ?? 0;
  const cerrada = !!rifa.cerrado_en;

  /* Lo que falta antes de encender. Las bases a medias no se publican: lo que
     se lee aquí lo va a leer gente que deja su nombre y su correo. */
  const pendientes = [
    !rifa.bases_html || rifa.bases_html.includes('[Falta:') ? 'Las bases tienen huecos sin llenar.' : null,
    !rifa.fecha_sorteo && !rifa.cuando_texto ? 'No hay fecha ni texto de cuándo se sortea.' : null,
    !rifa.imagen_url ? 'Falta la imagen.' : null,
    rifa.en_vivo && !rifa.enlace_vivo ? 'Dice que es en vivo pero no hay enlace de la transmisión.' : null,
  ].filter(Boolean) as string[];

  return (
    <>
      <Cabecera
        titulo="Rifa"
        sub={`${total} apuntados · ${rifa.esta_activo ? 'encendida' : 'apagada'}${cerrada ? ' · cerrada' : ''}`}
      />

      {!esAdmin && <Aviso tipo="info">Solo un administrador puede tocar la rifa.</Aviso>}

      {!rifa.esta_activo && (
        <Aviso tipo="info">
          Está <strong>apagada</strong>: no sale el aviso ni existe la página.{' '}
          <Link href={`https://${destino.dominio}/${destino.idioma_principal}/${rifa.babosa}?vista=1`}
                target="_blank" rel="noopener noreferrer">
            Ver cómo queda ↗
          </Link>
        </Aviso>
      )}

      {pendientes.length > 0 && (
        <Aviso tipo="mal">
          <strong>Antes de encenderla:</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {pendientes.map((x) => <li key={x}>{x}</li>)}
          </ul>
        </Aviso>
      )}

      <div className="lado">
        <div>
          <div className="tarjeta">
            <h2>El premio <small>qué se gana y cuándo</small></h2>
            <form action={guardarRifa} className="campos">
              <input type="hidden" name="grupo" value="premio" />
              <div className="campo ancho"><label htmlFor="rt">Título</label>
                <input id="rt" name="titulo" defaultValue={rifa.titulo} disabled={!esAdmin} /></div>
              <div className="campo ancho"><label htmlFor="rg">Gancho <small>la frase del aviso</small></label>
                <textarea id="rg" name="gancho" rows={2} defaultValue={rifa.gancho ?? ''} disabled={!esAdmin} /></div>
              <div className="campo"><label htmlFor="rpt">Qué es el premio</label>
                <input id="rpt" name="premio_titulo" defaultValue={rifa.premio_titulo ?? ''} disabled={!esAdmin} /></div>
              <div className="campo"><label htmlFor="rpu">Valor (USD)</label>
                <input id="rpu" name="premio_usd" type="number" min={0} step="1"
                       defaultValue={rifa.premio_usd ?? ''} disabled={!esAdmin} /></div>
              <div className="campo"><label htmlFor="rf">Día del sorteo</label>
                <input id="rf" name="fecha_sorteo" type="date" defaultValue={rifa.fecha_sorteo ?? ''} disabled={!esAdmin} />
                <small>Dejalo vacío mientras no esté decidido: se muestra el texto de al lado.</small></div>
              <div className="campo"><label htmlFor="rct">…o el texto</label>
                <input id="rct" name="cuando_texto" placeholder="Abril 2027"
                       defaultValue={rifa.cuando_texto ?? ''} disabled={!esAdmin} /></div>
              <div className="campo"><label htmlFor="rgn">Cuántos ganan</label>
                <input id="rgn" name="ganadores" type="number" min={1} max={50}
                       defaultValue={rifa.ganadores} disabled={!esAdmin} /></div>
              <div className="campo"><label><input type="checkbox" name="en_vivo" value="1"
                       defaultChecked={rifa.en_vivo} disabled={!esAdmin} /> El sorteo es en vivo</label></div>
              <div className="campo ancho"><label htmlFor="rev">Enlace de la transmisión</label>
                <input id="rev" name="enlace_vivo" placeholder="https://…"
                       defaultValue={rifa.enlace_vivo ?? ''} disabled={!esAdmin} />
                <small>Solo http/https. Se puede poner después, cuando se sepa por dónde se transmite.</small></div>
              <div className="campo ancho"><label htmlFor="ri">Imagen</label>
                <input id="ri" name="imagen_url" defaultValue={rifa.imagen_url ?? ''} disabled={!esAdmin} />
                <small>Ruta del sitio (<code>/rifa/arenal.webp</code>) o dirección completa.</small></div>
              {esAdmin && <BotonAccion>Guardar el premio</BotonAccion>}
            </form>
          </div>

          <div className="tarjeta">
            <h2>Las bases <small>HTML libre</small></h2>
            <p className="gris" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 0 }}>
              Esto lo lee gente que va a dejar su nombre y su correo. Tiene que decir
              qué incluye el premio, cómo se avisa al ganador, hasta cuándo vale y
              quién organiza. <strong>Sin eso la rifa no se enciende.</strong>
            </p>
            <form action={guardarRifa} className="campos">
              <input type="hidden" name="grupo" value="bases" />
              <div className="campo ancho">
                <textarea name="bases_html" rows={18} defaultValue={rifa.bases_html ?? ''}
                          disabled={!esAdmin} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }} />
              </div>
              {esAdmin && <BotonAccion>Guardar las bases</BotonAccion>}
            </form>
          </div>
        </div>

        <div>
          <div className="tarjeta">
            <h2>El aviso <small>cuándo interrumpe</small></h2>
            <form action={guardarRifa} className="campos">
              <input type="hidden" name="grupo" value="aviso" />
              <div className="campo ancho"><label>
                <input type="checkbox" name="esta_activo" value="1" defaultChecked={rifa.esta_activo} disabled={!esAdmin} />
                {' '}<strong>Rifa encendida</strong> (se ve en el sitio)</label></div>
              <div className="campo ancho"><label>
                <input type="checkbox" name="aviso_activo" value="1" defaultChecked={rifa.aviso_activo} disabled={!esAdmin} />
                {' '}Mostrar el aviso emergente</label>
                <small>Apagado, la página sigue existiendo pero nadie es interrumpido.</small></div>
              <div className="campo"><label htmlFor="rs">Segundos para salir</label>
                <input id="rs" name="segundos_para_abrir" type="number" min={0} max={600}
                       defaultValue={rifa.segundos_para_abrir} disabled={!esAdmin} /></div>
              <div className="campo"><label htmlFor="rd">No repreguntar por</label>
                <input id="rd" name="dias_para_repreguntar" type="number" min={1} max={365}
                       defaultValue={rifa.dias_para_repreguntar} disabled={!esAdmin} />
                <small>Días, si lo cerró sin apuntarse.</small></div>
              <div className="campo ancho"><label>
                <input type="checkbox" name="al_intentar_salir" value="1"
                       defaultChecked={rifa.al_intentar_salir} disabled={!esAdmin} />
                {' '}También al intentar salir</label>
                <small>Solo en computadora: en teléfono no existe ese gesto.</small></div>
              <div className="campo ancho"><label>
                <input type="checkbox" name="pide_whatsapp" value="1"
                       defaultChecked={rifa.pide_whatsapp} disabled={!esAdmin} /> Pedir WhatsApp</label></div>
              <div className="campo ancho"><label>
                <input type="checkbox" name="whatsapp_obligatorio" value="1"
                       defaultChecked={rifa.whatsapp_obligatorio} disabled={!esAdmin} /> …y que sea obligatorio</label>
                <small>Obligatorio junta menos gente pero deja llegar al ganador meses después.</small></div>
              {esAdmin && <BotonAccion>Guardar el aviso</BotonAccion>}
            </form>
          </div>

          <div className="tarjeta">
            <h2>Cerrar <small>{cerrada ? 'ya está cerrada' : 'cuando ya se sorteó'}</small></h2>
            <p className="gris" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 0 }}>
              Cerrarla deja de aceptar participantes y la página pasa a mostrar quién
              ganó. La lista de apuntados no se toca.
            </p>
            <form action={guardarRifa} className="campos">
              <input type="hidden" name="grupo" value="cierre" />
              <div className="campo ancho"><label>
                <input type="checkbox" name="cerrar" value="1" defaultChecked={cerrada} disabled={!esAdmin} />
                {' '}Sorteo cerrado</label></div>
              <div className="campo ancho"><label htmlFor="rgw">Ganador</label>
                <input id="rgw" name="ganador_nombre" defaultValue={rifa.ganador_nombre ?? ''} disabled={!esAdmin} /></div>
              <div className="campo ancho"><label htmlFor="rgnota">Nota</label>
                <textarea id="rgnota" name="ganador_nota" rows={3}
                          defaultValue={rifa.ganador_nota ?? ''} disabled={!esAdmin} /></div>
              {esAdmin && <BotonAccion>Guardar el cierre</BotonAccion>}
            </form>
          </div>
        </div>
      </div>

      <div className="tarjeta desliza">
        <h2>Apuntados <small>{total}{total > 100 ? ' · se muestran los 100 últimos' : ''}</small></h2>
        {!gente.length ? <Vacio texto="Todavía no se apuntó nadie." /> : (
          <table className="tabla">
            <thead><tr><th>Nombre</th><th>Correo</th><th>WhatsApp</th><th>Idioma</th><th>Por dónde</th><th>Cuándo</th></tr></thead>
            <tbody>{gente.map((g) => (
              <tr key={g.email}>
                <td>{g.nombre}</td>
                <td>{g.email}</td>
                <td>{g.whatsapp ?? '—'}</td>
                <td>{g.idioma}</td>
                <td><Etiqueta color={g.origen === 'aviso' ? '#66BB2E' : '#9CA3AF'}>{g.origen}</Etiqueta></td>
                <td>{new Date(g.creado_en).toLocaleString('es-CR')}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </>
  );
}
