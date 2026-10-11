import Link from 'next/link';
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
  { nombre: 'RESEND_API_KEY', para: 'Correo por la API de Resend (exige un dominio verificado).' },
  { nombre: 'SMTP_HOST', para: 'Correo por SMTP: Brevo, Mailjet, SendGrid, SES, Gmail, el del hosting.' },
  { nombre: 'SMTP_PUERTO', para: 'Puerto SMTP: 587 con TLS, 465 cifrado desde el inicio.' },
  { nombre: 'SMTP_USUARIO', para: 'Usuario SMTP.' },
  { nombre: 'SMTP_CLAVE', para: 'Contraseña SMTP.' },
  { nombre: 'EMAIL_REMITENTE', para: 'Remitente de correo si no está en el canal.' },
];

export default async function PaginaAjustes() {
  const { destino, db, usuario } = await contextoPanel('ajustes');
  const esAdmin = usuario.rol === 'admin';
  /* Las candidatas al destacado del menu. Se ofrecen en una lista y no en un
     campo de texto: una babosa mal escrita no da error, simplemente deja el
     menu sin tarjeta — y eso se descubre semanas despues. */
  const [{ data: d }, { data: canales }, { data: experiencias }, { data: destacables }] = await Promise.all([
    db.from('dst_destino').select('*').eq('id', destino.id).single(),
    db.from('dst_canal').select('*').eq('destino_id', destino.id).order('tipo'),
    db.from('dst_itinerario').select('babosa, titulo')
      .eq('destino_id', destino.id).eq('generado_por', 'equipo').eq('es_publico', true)
      .order('orden'),
    db.from('dst_negocio').select('babosa, nombre, es_destacado')
      .eq('destino_id', destino.id).eq('estado_publicacion', 'publicado')
      .order('es_destacado', { ascending: false }).order('nombre'),
  ]);
  if (!d) return <Vacio texto="Sin destino." />;
  const presente = (n: string) => !!process.env[n]?.trim() || (n === 'SUPABASE_SECRET_KEY' && !!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());

  return (
    <>
      <Cabecera titulo="Ajustes" sub={`${d.nombre} · ${d.dominio} · ${d.esta_activo ? 'encendido' : 'apagado'}`} />
      {!esAdmin && <Aviso tipo="info">Solo un administrador puede cambiar los ajustes.</Aviso>}

      <form action={editarDestino}>
        <input type="hidden" name="grupo" value="destino" />
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
                <div className="campo"><label><input type="checkbox" name="contacto_bloqueado" value="1" defaultChecked={d.contacto_bloqueado} disabled={!esAdmin} /> Tapar el teléfono hasta que dejen sus datos</label>
                  <small>Como encuentra24: la ficha se ve, el contacto no. Apagado, el directorio deja de generar leads.</small>
                </div>
                <div className="campo"><label><input type="checkbox" name="chat_activo" value="1" defaultChecked={d.chat_activo} disabled={!esAdmin} /> Burbuja de chat en el sitio</label>
                  <small>Apagada, la burbuja no se pinta y el chat deja de atender. Lo que ya estaba conversado no se borra.</small>
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
                <div className="campo"><label>Pie: crédito</label><input name="pie_credito_texto" defaultValue={d.pie_credito_texto ?? ''} placeholder="Desarrollado por LIDERAX10.COM" disabled={!esAdmin} /><span className="gris" style={{ fontSize: 11.5 }}>Vacío: no se muestra nada en el pie.</span></div>
                <div className="campo"><label>Pie: enlace del crédito</label><input type="url" name="pie_credito_url" defaultValue={d.pie_credito_url ?? ''} placeholder="https://liderax10.com" disabled={!esAdmin} /><span className="gris" style={{ fontSize: 11.5 }}>Solo http o https. Vacío: el crédito se ve sin enlace.</span></div>
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
              <p className="gris" style={{ color: '#8B8B87', fontSize: 12.5 }}>
                Solo <code style={{ fontSize: 11.5 }}>SUPABASE_SECRET_KEY</code> tiene que vivir en Vercel:
                es la que abre la base, así que no puede guardarse dentro de lo que ella misma abre.
                Las demás van en Llaves, acá al lado.
              </p>
            </div>

            <div className="tarjeta">
              <h2>Llaves <small>se ingresan, no se consultan</small></h2>
              <p className="gris" style={{ fontSize: 13, lineHeight: 1.6 }}>
                Resend, Anthropic, Google Places y la clave del cron. Quedan cifradas
                en la bóveda y el panel <strong>no las puede leer</strong> — ni vos.
                Cambiarlas no obliga a redesplegar.
              </p>
              <Link className="boton" href="/admin/ajustes/llaves" style={{ marginTop: 12 }}>
                Administrar llaves
              </Link>
            </div>
          </div>
        </div>
      </form>

      <div className="tarjeta">
        <h2>Menú del sitio <small>qué va en la columna destacada</small></h2>
        <p className="gris" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 0 }}>
          El menú de <strong>Qué hacer</strong> abre un panel con todas las
          categorías y, a la derecha, una tarjeta con foto. Ese espacio se ve en{' '}
          <strong>todas las páginas</strong> del sitio: es el lugar más visto que
          hay para empujar algo. Si lo que elegís se despublica, la columna
          desaparece sola — nunca queda un enlace roto en el menú.
        </p>

        <form action={editarDestino} className="campos">
          <input type="hidden" name="grupo" value="menu" />
          <div className="campo ancho">
            <label htmlFor="md">Qué destacar</label>
            <select id="md" name="menu_destacado" disabled={!esAdmin}
                    defaultValue={d.menu_destacado_tipo === 'ninguno' || !d.menu_destacado_babosa
                      ? 'ninguno'
                      : `${d.menu_destacado_tipo}:${d.menu_destacado_babosa}`}>
              <option value="ninguno">Nada — el panel va sin tarjeta</option>
              {!!experiencias?.length && (
                <optgroup label="Experiencias">
                  {experiencias.map((e) => (
                    <option key={e.babosa} value={`experiencia:${e.babosa}`}>{e.titulo}</option>
                  ))}
                </optgroup>
              )}
              {!!destacables?.length && (
                <optgroup label="Negocios">
                  {destacables.map((n) => (
                    <option key={n.babosa} value={`negocio:${n.babosa}`}>
                      {n.nombre}{n.es_destacado ? ' · destacado' : ''}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <small>
              Solo salen las experiencias publicadas y los negocios publicados.
              {d.menu_destacado_tipo !== 'ninguno' && d.menu_destacado_babosa
                ? ` Hoy sale: ${d.menu_destacado_tipo} «${d.menu_destacado_babosa}».`
                : ' Hoy el panel va sin tarjeta.'}
            </small>
          </div>
          {esAdmin && <BotonAccion>Guardar el menú</BotonAccion>}
        </form>
      </div>

      <div className="tarjeta">
        <h2>Oferta premium <small>video + historias + mes destacado</small></h2>
        <p className="gris" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 0 }}>
          Se muestra en <code style={{ fontSize: 11.5 }}>/premium</code>, al pie de
          Sumá tu negocio y en el correo de bienvenida. Los cupos que quedan se
          <strong> cuentan</strong> (negocios que ya no son gratis): una escasez
          inventada se nota y cuesta más confianza de la que gana.
        </p>

        <form action={editarDestino} className="campos">
          <input type="hidden" name="grupo" value="premium" />
          <div className="campo"><label><input type="checkbox" name="premium_activo" value="1" defaultChecked={d.premium_activo} disabled={!esAdmin} /> Mostrar la oferta</label></div>
          <div className="campo"><label htmlFor="pt">Título</label><input id="pt" name="premium_titulo" defaultValue={d.premium_titulo ?? ''} disabled={!esAdmin} /></div>
          <div className="campo" style={{ gridColumn: '1 / -1' }}><label htmlFor="pg">Gancho</label><textarea id="pg" name="premium_gancho" rows={2} defaultValue={d.premium_gancho ?? ''} disabled={!esAdmin} /></div>
          <div className="campo"><label htmlFor="pp">Precio hoy (USD)</label><input id="pp" name="premium_precio_usd" type="number" min={0} step="1" defaultValue={d.premium_precio_usd ?? ''} disabled={!esAdmin} /></div>
          <div className="campo"><label htmlFor="pa">Precio normal (tachado)</label><input id="pa" name="premium_precio_antes" type="number" min={0} step="1" defaultValue={d.premium_precio_antes ?? ''} disabled={!esAdmin} /><small>Si es mayor que el de hoy, sale tachado al lado.</small></div>
          <div className="campo"><label htmlFor="pc">Cupos a ese precio</label><input id="pc" name="premium_cupos" type="number" min={0} max={999} defaultValue={d.premium_cupos ?? ''} disabled={!esAdmin} /><small>Al llenarse, el sitio deja de hablar de lanzamiento y muestra el precio normal.</small></div>
          <div className="campo"><label htmlFor="pe">Ficha de ejemplo</label><input id="pe" name="premium_ejemplo_babosa" defaultValue={d.premium_ejemplo_babosa ?? ''} placeholder="outback" disabled={!esAdmin} /><small>La babosa del negocio que ya tiene video. Se muestra en /premium.</small></div>
          <div className="campo" style={{ gridColumn: '1 / -1' }}><label htmlFor="pi">Qué incluye <small>uno por línea</small></label><textarea id="pi" name="premium_incluye" rows={5} defaultValue={(d.premium_incluye ?? []).join('\n')} disabled={!esAdmin} /></div>
          {esAdmin && <BotonAccion>Guardar la oferta</BotonAccion>}
        </form>
      </div>

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
              <div className="campo"><label>Proveedor</label><select name="proveedor" defaultValue="meta"><option value="meta">Meta (WhatsApp Cloud API)</option><option value="resend">Resend (correo por API)</option><option value="smtp">SMTP (Brevo, Mailjet, SendGrid, SES, Gmail…)</option><option value="manual">Manual (el equipo manda a mano)</option></select></div>
              <div className="campo"><label>Identificador</label><input name="identificador" placeholder="phone_number_id o remitente" /></div>
              <div className="campo"><label>Nombre visible</label><input name="nombre_visible" defaultValue={d.marca_nombre} /></div>
              <div className="campo"><label>Variable del secreto</label><input name="variable_secreto" placeholder="WHATSAPP_TOKEN" /></div>
              <div className="campo"><label><input type="checkbox" name="esta_activo" value="1" defaultChecked /> Activo</label></div>
              <div className="campo ancho"><BotonAccion clase="boton chico">Agregar</BotonAccion></div>
            </form>
          </details>
        )}
        <p className="gris" style={{ color: '#8B8B87', fontSize: 12.5, marginTop: 10 }}>
          Webhook de WhatsApp para Meta: <code>https://{d.dominio}/api/webhooks/whatsapp</code> con el token de WHATSAPP_VERIFY_TOKEN.
        </p>
        <p className="gris" style={{ color: '#8B8B87', fontSize: 12.5 }}>
          Para el correo hay dos caminos. <strong>Resend</strong> es una sola clave, pero no deja escribirle a nadie
          hasta verificar un dominio propio. <strong>SMTP</strong> sirve con cualquier proveedor y con el correo que ya
          tengas: poné el servidor en SMTP_HOST, SMTP_PUERTO, SMTP_USUARIO y SMTP_CLAVE, y en el canal el remitente.
          Cambiar de proveedor después es cambiar esas variables, no el código.
        </p>
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
