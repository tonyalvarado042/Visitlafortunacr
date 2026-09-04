import { contextoPanel } from '@/lib/admin/contexto';
import { Aviso, Cabecera, Etiqueta, Vacio } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { editarDestino, eliminarCanal, guardarCanal } from './acciones';
import { LanzarDestino } from './LanzarDestino';

export const dynamic = 'force-dynamic';

const VARIABLES: { nombre: string; para: string }[] = [
  { nombre: 'ANTHROPIC_API_KEY', para: 'Toda la IA (Claude).' },
  { nombre: 'SUPABASE_SECRET_KEY', para: 'La IA, los webhooks y el cron escriben en la base (también vale SUPABASE_SERVICE_ROLE_KEY).' },
  { nombre: 'CRON_SECRET', para: 'Protege /api/cron/automatizaciones y /api/ia/planificar.' },
  { nombre: 'WHATSAPP_TOKEN', para: 'Enviar por WhatsApp Cloud API (o la variable que diga el canal).' },
  { nombre: 'WHATSAPP_PHONE_NUMBER_ID', para: 'Número de WhatsApp si no está en el canal.' },
  { nombre: 'WHATSAPP_VERIFY_TOKEN', para: 'Verificación del webhook de Meta.' },
  { nombre: 'WHATSAPP_APP_SECRET', para: 'Firma de los webhooks de Meta (recomendado).' },
  { nombre: 'RESEND_API_KEY', para: 'Enviar correos.' },
  { nombre: 'EMAIL_REMITENTE', para: 'Remitente de correo si no está en el canal.' },
];

export default async function PaginaAjustes() {
  const { destino, db, usuario } = await contextoPanel('ajustes');
  const esAdmin = usuario.rol === 'admin';
  const [{ data: d }, { data: canales }] = await Promise.all([
    db.from('dst_destino').select('*').eq('id', destino.id).single(),
    db.from('dst_canal').select('*').eq('destino_id', destino.id).order('tipo'),
  ]);
  if (!d) return <Vacio texto="Sin destino." />;
  const presente = (n: string) => !!process.env[n]?.trim() || (n === 'SUPABASE_SECRET_KEY' && !!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());

  return (
    <>
      <Cabecera titulo="Ajustes" sub={`${d.nombre} · ${d.dominio} · ${d.esta_activo ? 'encendido' : 'apagado'}`} />
      {!esAdmin && <Aviso tipo="info">Solo un administrador puede cambiar los ajustes.</Aviso>}

      <form action={editarDestino}>
        <div className="lado">
          <div>
            <div className="tarjeta">
              <h2>Destino</h2>
              <div className="campos">
                <div className="campo"><label>Nombre</label><input name="nombre" defaultValue={d.nombre} disabled={!esAdmin} /></div>
                <div className="campo"><label>Nombre largo</label><input name="nombre_largo" defaultValue={d.nombre_largo ?? ''} disabled={!esAdmin} /></div>
                <div className="campo"><label>Región</label><input name="region" defaultValue={d.region ?? ''} disabled={!esAdmin} /></div>
                <div className="campo"><label>Marca</label><input name="marca_nombre" defaultValue={d.marca_nombre} disabled={!esAdmin} /></div>
                <div className="campo"><label>Sigla</label><input name="marca_sigla" defaultValue={d.marca_sigla ?? ''} disabled={!esAdmin} /></div>
                <div className="campo ancho"><label>Lema ({d.idioma_principal})</label><input name="lema" defaultValue={d.lema ?? ''} disabled={!esAdmin} /></div>
                <div className="campo"><label>WhatsApp del destino</label><input name="whatsapp" defaultValue={d.whatsapp ?? ''} placeholder="+506…" disabled={!esAdmin} /></div>
                <div className="campo"><label>Correo de contacto</label><input type="email" name="email_contacto" defaultValue={d.email_contacto ?? ''} disabled={!esAdmin} /></div>
                <div className="campo"><label>Comisión por defecto %</label><input type="number" step="0.5" name="comision_por_defecto" defaultValue={d.comision_por_defecto ?? ''} disabled={!esAdmin} /></div>
                <div className="campo"><label><input type="checkbox" name="esta_activo" value="1" defaultChecked={d.esta_activo} disabled={!esAdmin} /> Sitio encendido (se sirve al público)</label></div>
                <div className="campo">
                  <label>Qué se muestra</label>
                  <select name="modo_sitio" defaultValue={d.modo_sitio ?? 'completo'} disabled={!esAdmin}>
                    <option value="completo">Plataforma completa</option>
                    <option value="teaser">Prelanzamiento (una sola pantalla)</option>
                  </select>
                </div>
                <div className="campo">
                  <label>Fecha de apertura</label>
                  <input type="date" name="lanzado_el" defaultValue={d.lanzado_el ?? ''} disabled={!esAdmin} />
                  <span className="gris" style={{ fontSize: 11.5 }}>A dónde apunta la cuenta regresiva del prelanzamiento. Vacía: dice «muy pronto», sin números.</span>
                </div>
              </div>
            </div>
            <div className="tarjeta">
              <h2>Marca <small>el sitio lee los colores de aquí; no del código</small></h2>
              <div className="campos">
                {(['color_tinta', 'color_acento', 'color_naturaleza', 'color_gris'] as const).map((c) => (
                  <div className="campo" key={c}><label>{c.replace('color_', '')}</label><div className="acciones-fila"><input type="color" name={c} defaultValue={d[c]} disabled={!esAdmin} style={{ width: 46, height: 36, padding: 2 }} /><span className="gris">{d[c]}</span></div></div>
                ))}
                <div className="campo"><label>Tipografía</label><input value={d.tipografia} disabled /></div>
                <div className="campo"><label>Logo (URL)</label><input name="logo_url" defaultValue={d.logo_url ?? ''} disabled={!esAdmin} /></div>
                <div className="campo"><label>Video de portada (URL)</label><input name="video_portada_url" defaultValue={d.video_portada_url ?? ''} disabled={!esAdmin} /></div>
                <div className="campo"><label>Imagen de portada (URL)</label><input name="imagen_portada_url" defaultValue={d.imagen_portada_url ?? ''} disabled={!esAdmin} /></div>
              </div>
              {esAdmin && <div className="pie-formulario"><BotonAccion>Guardar destino</BotonAccion></div>}
            </div>
          </div>
          <div>
            <div className="tarjeta">
              <h2>Variables de entorno <small>solo se muestra si están puestas</small></h2>
              <table className="tabla"><tbody>{VARIABLES.map((v) => (
                <tr key={v.nombre}><td><code style={{ fontSize: 12 }}>{v.nombre}</code><div className="gris">{v.para}</div></td><td>{presente(v.nombre) ? <Etiqueta color="#66BB2E">puesta</Etiqueta> : <Etiqueta color="#B42318">falta</Etiqueta>}</td></tr>
              ))}</tbody></table>
              <p className="gris" style={{ color: '#8B8B87', fontSize: 12.5 }}>Se ponen en Vercel → Settings → Environment Variables, y se vuelve a desplegar.</p>
            </div>
          </div>
        </div>
      </form>

      <div className="tarjeta desliza">
        <h2>Canales <small>por dónde habla este destino</small></h2>
        {!canales?.length ? <Vacio texto="Sin canales." /> : (
          <table className="tabla">
            <thead><tr><th>Tipo</th><th>Proveedor</th><th>Identificador</th><th>Nombre visible</th><th>Variable del secreto</th><th>Activo</th>{esAdmin && <th></th>}</tr></thead>
            <tbody>{canales.map((c) => (
              <tr key={c.id}>
                <td colSpan={esAdmin ? 7 : 6} style={{ padding: 0 }}>
                  <form action={guardarCanal} style={{ display: 'grid', gridTemplateColumns: '.7fr .7fr 1.3fr 1fr 1.2fr .6fr auto auto', gap: 8, alignItems: 'center', padding: 10 }}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="tipo" value={c.tipo} /><input type="hidden" name="proveedor" value={c.proveedor} />
                    <strong>{c.tipo}</strong><span>{c.proveedor}</span>
                    <input name="identificador" defaultValue={c.identificador ?? ''} placeholder={c.tipo === 'whatsapp' ? 'phone_number_id de Meta' : c.tipo === 'email' ? 'hola@dominio.com' : '—'} disabled={!esAdmin} style={{ border: '1px solid #E6E6E2', borderRadius: 6, padding: '6px 8px', fontFamily: 'inherit' }} />
                    <input name="nombre_visible" defaultValue={c.nombre_visible ?? ''} disabled={!esAdmin} style={{ border: '1px solid #E6E6E2', borderRadius: 6, padding: '6px 8px', fontFamily: 'inherit' }} />
                    <input name="variable_secreto" defaultValue={c.variable_secreto ?? ''} placeholder={c.tipo === 'whatsapp' ? 'WHATSAPP_TOKEN' : c.tipo === 'email' ? 'RESEND_API_KEY' : ''} disabled={!esAdmin} style={{ border: '1px solid #E6E6E2', borderRadius: 6, padding: '6px 8px', fontFamily: 'ui-monospace, monospace', fontSize: 12 }} />
                    <label><input type="checkbox" name="esta_activo" value="1" defaultChecked={c.esta_activo} disabled={!esAdmin} /> sí</label>
                    {esAdmin ? <BotonAccion clase="boton secundario chico">Guardar</BotonAccion> : <span />}
                    {esAdmin && c.tipo !== 'web' ? <button type="submit" formAction={eliminarCanal} className="boton peligro chico">×</button> : <span />}
                  </form>
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
        {esAdmin && (
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>Agregar canal</summary>
            <form action={guardarCanal} className="campos" style={{ marginTop: 10 }}>
              <div className="campo"><label>Tipo</label><select name="tipo" defaultValue="whatsapp"><option value="whatsapp">WhatsApp</option><option value="email">Correo</option></select></div>
              <div className="campo"><label>Proveedor</label><select name="proveedor" defaultValue="meta"><option value="meta">Meta (WhatsApp Cloud API)</option><option value="resend">Resend (correo)</option><option value="manual">Manual (el equipo manda a mano)</option></select></div>
              <div className="campo"><label>Identificador</label><input name="identificador" placeholder="phone_number_id o remitente" /></div>
              <div className="campo"><label>Nombre visible</label><input name="nombre_visible" defaultValue={d.marca_nombre} /></div>
              <div className="campo"><label>Variable del secreto</label><input name="variable_secreto" placeholder="WHATSAPP_TOKEN" /></div>
              <div className="campo"><label><input type="checkbox" name="esta_activo" value="1" defaultChecked /> Activo</label></div>
              <div className="campo ancho"><BotonAccion clase="boton chico">Agregar</BotonAccion></div>
            </form>
          </details>
        )}
        <p className="gris" style={{ color: '#8B8B87', fontSize: 12.5, marginTop: 10 }}>Webhook de WhatsApp para Meta: <code>https://{d.dominio}/api/webhooks/whatsapp</code> con el token de WHATSAPP_VERIFY_TOKEN.</p>
      </div>

      {esAdmin && (
        <div className="tarjeta">
          <h2>Lanzar otro destino <small>una fila, no un despliegue</small></h2>
          <p style={{ margin: '0 0 12px' }}>Crea el destino con sus categorías del catálogo global, sus cinco agentes, sus plantillas y sus automatizaciones. Después apuntás el dominio a Vercel y cargás contenido.</p>
          <LanzarDestino />
        </div>
      )}
    </>
  );
}
