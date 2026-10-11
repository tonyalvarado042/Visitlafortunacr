import Link from 'next/link';
import { contextoPanel } from '@/lib/admin/contexto';
import { Aviso, Cabecera, Etiqueta, Vacio } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import {
  cambiarOperador, guardarContrato, guardarProducto, guardarTarifa, borrarTarifa,
} from './acciones';
import { NuevoContrato, NuevoProducto } from './Nuevos';

export const dynamic = 'force-dynamic';

type Tarifa = {
  id: string; nombre: string; precio_publico_usd: number | null; precio_neto_usd: number | null;
  es_para: string; verificada: boolean; fuente: string | null;
  vigencia_desde: string | null; vigencia_hasta: string | null; esta_activa: boolean;
};
type Producto = {
  id: string; babosa: string; nombre: string; resumen: string | null;
  incluye: string[]; no_incluye: string[]; edad_minima: number | null;
  admite_ninos: boolean; horas_antelacion: number; esta_activo: boolean;
  tarifas: Tarifa[];
};
type Contrato = {
  id: string; negocio_id: string; nombre: string;
  modo_cobro: string; modo_disponibilidad: string; modo_confirmacion: string;
  comision_tipo: string; comision_valor: number | null; comision_base: string;
  frecuencia_liquidacion: string; emite_voucher_propio: boolean;
  politica_cancelacion: string | null; vigencia_desde: string | null; vigencia_hasta: string | null;
  documento_url: string | null; notas: string | null; esta_activo: boolean;
  productos: Producto[];
};
type Negocio = { id: string; nombre: string; babosa: string; vende_por_aqui: boolean };

const MODO_COBRO = [
  ['operador_cobra', 'Cobra el operador'],
  ['plataforma_cobra', 'Cobramos nosotros'],
];
const MODO_DISPO = [
  ['a_solicitud', 'A solicitud (preguntamos)'],
  ['cupo_asignado', 'Cupo asignado (nos dan lugares)'],
  ['api_operador', 'API del operador'],
];
const MODO_CONF = [
  ['manual', 'Manual (confirma una persona)'],
  ['instantanea', 'Instantánea'],
];

export default async function PaginaOperadores() {
  const { destino, db, usuario } = await contextoPanel('operadores');
  const esAdmin = usuario.rol === 'admin';

  const [{ data: d }, { data: neg }, { data: con }] = await Promise.all([
    db.from('dst_destino').select('reservas_activas, pasarela_lista, email_contacto').eq('id', destino.id).single(),
    db.from('dst_negocio')
      .select('id, nombre, babosa, vende_por_aqui')
      .eq('destino_id', destino.id).eq('estado_publicacion', 'publicado')
      .order('nombre'),
    db.from('dst_contrato')
      .select('*, productos:dst_producto(*, tarifas:dst_tarifa(*))')
      .eq('destino_id', destino.id).order('creado_en'),
  ]);

  const negocios = (neg ?? []) as Negocio[];
  const contratos = (con ?? []) as Contrato[];
  const porNegocio = new Map(negocios.map((n) => [n.id, n]));
  const ajustes = d as { reservas_activas: boolean; email_contacto: string | null } | null;
  const modulo = ajustes?.reservas_activas ?? false;
  const buzon = ajustes?.email_contacto?.trim();

  return (
    <>
      <Cabecera
        titulo="Operadores"
        sub={`${negocios.filter((n) => n.vende_por_aqui).length} venden por aquí · ${contratos.filter((c) => c.esta_activo).length} contratos activos`}
      />

      {!esAdmin && <Aviso tipo="info">Solo un administrador puede tocar los contratos.</Aviso>}

      {!modulo && (
        <Aviso tipo="mal">
          El <strong>motor de reservas está apagado</strong> en{' '}
          <Link href="/admin/ajustes">Ajustes</Link>. Podés dejar todo listo aquí,
          pero nadie va a ver un widget hasta que lo enciendas.
        </Aviso>
      )}

      {!buzon && (
        <Aviso tipo="mal">
          <strong>Falta el correo de contacto del destino.</strong> Cuando alguien
          pide una reserva se le avisa al equipo por correo — y sin ese buzón{' '}
          <strong>ese aviso no llega a ninguna parte</strong>. Ponelo en{' '}
          <Link href="/admin/ajustes">Ajustes → Destino → Correo de contacto</Link>.
        </Aviso>
      )}

      <Aviso tipo="info">
        <strong>Hacen falta los tres a la vez:</strong> el motor encendido en Ajustes,
        el negocio con «vende por aquí», y un contrato activo. Si falta uno, la ficha
        es un directorio normal.
      </Aviso>

      {/* ---- Quién vende ---- */}
      <div className="tarjeta desliza">
        <h2>Quién vende por aquí <small>el segundo interruptor</small></h2>
        <p className="gris" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 0 }}>
          Es una decisión <strong>comercial</strong>, no de contenido: quién firmó.
          Apagar esto saca el widget de esa ficha al instante, sin tocar el contrato.
        </p>
        <table className="tabla">
          <thead><tr><th>Negocio</th><th>Contratos</th><th>Vende</th></tr></thead>
          <tbody>
            {negocios.filter((n) => n.vende_por_aqui || contratos.some((c) => c.negocio_id === n.id))
              .map((n) => {
                const suyos = contratos.filter((c) => c.negocio_id === n.id);
                return (
                  <tr key={n.id}>
                    <td className="fuerte">{n.nombre}</td>
                    <td className="gris">
                      {suyos.length === 0 ? 'ninguno'
                        : `${suyos.filter((c) => c.esta_activo).length} activo(s) de ${suyos.length}`}
                    </td>
                    <td>
                      <form action={cambiarOperador}>
                        <input type="hidden" name="negocio_id" value={n.id} />
                        <input type="hidden" name="vende" value={n.vende_por_aqui ? '0' : '1'} />
                        <Etiqueta color={n.vende_por_aqui ? '#66BB2E' : '#9CA3AF'}>
                          {n.vende_por_aqui ? 'sí' : 'no'}
                        </Etiqueta>
                        {esAdmin && (
                          <BotonAccion clase={n.vende_por_aqui ? 'boton peligro chico' : 'boton chico'}>
                            {n.vende_por_aqui ? 'Apagar' : 'Encender'}
                          </BotonAccion>
                        )}
                      </form>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        {esAdmin && <NuevoContrato negocios={negocios} />}
      </div>

      {/* ---- Los contratos ---- */}
      {contratos.length === 0 ? (
        <Vacio texto="Todavía no hay contratos. Creá uno arriba." />
      ) : contratos.map((c) => {
        const n = porNegocio.get(c.negocio_id);
        const listoParaCobrar = c.comision_valor != null && c.politica_cancelacion && c.vigencia_desde;
        return (
          <div className="tarjeta" key={c.id}>
            <h2>
              {n?.nombre ?? '—'} · {c.nombre}{' '}
              <small>
                <Etiqueta color={c.esta_activo ? '#66BB2E' : '#9CA3AF'}>
                  {c.esta_activo ? 'activo' : 'apagado'}
                </Etiqueta>
              </small>
            </h2>

            {c.modo_cobro === 'plataforma_cobra' && !listoParaCobrar && (
              <Aviso tipo="mal">
                Para cobrar nosotros hacen falta <strong>comisión, política de cancelación
                y vigencia desde</strong>. Sin eso la base no deja encenderlo.
              </Aviso>
            )}

            <form action={guardarContrato} className="campos">
              <input type="hidden" name="id" value={c.id} />
              <div className="campo ancho"><label>Nombre del contrato</label>
                <input name="nombre" defaultValue={c.nombre} disabled={!esAdmin} /></div>

              <div className="campo"><label>Quién cobra</label>
                <select name="modo_cobro" defaultValue={c.modo_cobro} disabled={!esAdmin}>
                  {MODO_COBRO.map(([v, n2]) => <option key={v} value={v}>{n2}</option>)}
                </select>
                <small>Sin pasarela probada, «cobramos nosotros» igual pide la reserva en vez de cobrarla.</small></div>
              <div className="campo"><label>Disponibilidad</label>
                <select name="modo_disponibilidad" defaultValue={c.modo_disponibilidad} disabled={!esAdmin}>
                  {MODO_DISPO.map(([v, n2]) => <option key={v} value={v}>{n2}</option>)}
                </select></div>
              <div className="campo"><label>Confirmación</label>
                <select name="modo_confirmacion" defaultValue={c.modo_confirmacion} disabled={!esAdmin}>
                  {MODO_CONF.map(([v, n2]) => <option key={v} value={v}>{n2}</option>)}
                </select></div>

              <div className="campo"><label>Comisión</label>
                <input name="comision_valor" type="number" step="0.5" min={0}
                       defaultValue={c.comision_valor ?? ''} disabled={!esAdmin} /></div>
              <div className="campo"><label>Tipo</label>
                <select name="comision_tipo" defaultValue={c.comision_tipo} disabled={!esAdmin}>
                  <option value="porcentaje">% del total</option>
                  <option value="fijo">Monto fijo (USD)</option>
                </select></div>
              <div className="campo"><label>Sobre qué base</label>
                <select name="comision_base" defaultValue={c.comision_base} disabled={!esAdmin}>
                  <option value="bruto">El bruto</option>
                  <option value="neto_de_impuestos">Neto de impuestos</option>
                  <option value="tarifa_neta_pactada">Tarifa neta pactada</option>
                </select>
                <small>Lo que más se discute después. Dejalo escrito en el contrato.</small></div>
              <div className="campo"><label>Liquidación</label>
                <select name="frecuencia_liquidacion" defaultValue={c.frecuencia_liquidacion} disabled={!esAdmin}>
                  <option value="semanal">Semanal</option>
                  <option value="quincenal">Quincenal</option>
                  <option value="mensual">Mensual</option>
                </select></div>

              <div className="campo"><label>Vigencia desde</label>
                <input name="vigencia_desde" type="date" defaultValue={c.vigencia_desde ?? ''} disabled={!esAdmin} /></div>
              <div className="campo"><label>Hasta <small>vacío = sin fin</small></label>
                <input name="vigencia_hasta" type="date" defaultValue={c.vigencia_hasta ?? ''} disabled={!esAdmin} /></div>

              <div className="campo ancho"><label>Política de cancelación</label>
                <textarea name="politica_cancelacion" rows={3}
                          defaultValue={c.politica_cancelacion ?? ''} disabled={!esAdmin} />
                <small>Se le muestra a quien reserva. Si no está, no se puede cobrar.</small></div>
              <div className="campo ancho"><label>Enlace al contrato firmado</label>
                <input name="documento_url" placeholder="https://…"
                       defaultValue={c.documento_url ?? ''} disabled={!esAdmin} /></div>
              <div className="campo ancho"><label>Notas internas</label>
                <textarea name="notas" rows={2} defaultValue={c.notas ?? ''} disabled={!esAdmin} /></div>

              <div className="campo ancho"><label>
                <input type="checkbox" name="emite_voucher_propio" value="1"
                       defaultChecked={c.emite_voucher_propio} disabled={!esAdmin} />
                {' '}El operador acepta NUESTRO voucher</label>
                <small>Si no, hay que mostrar el ticket que emita él.</small></div>
              <div className="campo ancho"><label>
                <input type="checkbox" name="esta_activo" value="1"
                       defaultChecked={c.esta_activo} disabled={!esAdmin} />
                {' '}<strong>Contrato activo</strong></label></div>

              {esAdmin && <BotonAccion>Guardar el contrato</BotonAccion>}
            </form>

            {/* ---- Productos del contrato ---- */}
            <h3 style={{ marginTop: 26, fontSize: 15 }}>
              Productos <small className="gris">{c.productos?.length ?? 0}</small>
            </h3>

            {(c.productos ?? []).map((p) => (
              <details key={p.id} style={{ borderTop: '1px solid #E6E6E2', padding: '10px 0' }}>
                <summary style={{ cursor: 'pointer', fontSize: 14 }}>
                  <strong>{p.nombre}</strong>
                  {' · '}
                  {(p.tarifas ?? []).filter((t) => t.verificada).length > 0
                    ? (p.tarifas ?? []).filter((t) => t.verificada)
                        .map((t) => `${t.nombre} $${t.precio_publico_usd}`).join(' · ')
                    : <span className="gris">sin tarifa verificada</span>}
                  {!p.esta_activo && ' · (apagado)'}
                </summary>

                <form action={guardarProducto} className="campos" style={{ marginTop: 12 }}>
                  <input type="hidden" name="id" value={p.id} />
                  <div className="campo ancho"><label>Nombre</label>
                    <input name="nombre" defaultValue={p.nombre} disabled={!esAdmin} /></div>
                  <div className="campo ancho"><label>Resumen</label>
                    <textarea name="resumen" rows={2} defaultValue={p.resumen ?? ''} disabled={!esAdmin} /></div>
                  <div className="campo ancho"><label>Qué incluye <small>uno por línea</small></label>
                    <textarea name="incluye" rows={4} defaultValue={(p.incluye ?? []).join('\n')} disabled={!esAdmin} /></div>
                  <div className="campo ancho"><label>Qué NO incluye <small>uno por línea</small></label>
                    <textarea name="no_incluye" rows={3} defaultValue={(p.no_incluye ?? []).join('\n')} disabled={!esAdmin} /></div>
                  <div className="campo"><label>Edad mínima</label>
                    <input name="edad_minima" type="number" min={0} max={99}
                           defaultValue={p.edad_minima ?? ''} disabled={!esAdmin} /></div>
                  <div className="campo"><label>Horas de antelación</label>
                    <input name="horas_antelacion" type="number" min={0} max={720}
                           defaultValue={p.horas_antelacion} disabled={!esAdmin} />
                    <small>El formulario no deja elegir fechas antes de eso.</small></div>
                  <div className="campo ancho"><label>
                    <input type="checkbox" name="admite_ninos" value="1"
                           defaultChecked={p.admite_ninos} disabled={!esAdmin} /> Admite niños</label></div>
                  <div className="campo ancho"><label>
                    <input type="checkbox" name="esta_activo" value="1"
                           defaultChecked={p.esta_activo} disabled={!esAdmin} />
                    {' '}<strong>Producto activo</strong></label></div>
                  {esAdmin && <BotonAccion>Guardar el producto</BotonAccion>}
                </form>

                {/* ---- Tarifas ---- */}
                <h4 style={{ marginTop: 18, fontSize: 13.5 }}>Tarifas</h4>
                <p className="gris" style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 0 }}>
                  <strong>«Verificada» es lo que saca el precio a la calle.</strong> Marcala
                  solo cuando el número venga del operador, no de una página ni de memoria.
                </p>
                <table className="tabla">
                  <thead><tr><th>Nombre</th><th>Para</th><th className="num">Público</th><th className="num">Neto</th><th>Verificada</th><th>Fuente</th><th></th></tr></thead>
                  <tbody>
                    {(p.tarifas ?? []).map((t) => (
                      <tr key={t.id}>
                        <td colSpan={7} style={{ padding: 0 }}>
                          <form action={guardarTarifa} style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr .7fr .7fr .6fr 1.3fr auto auto', gap: 8, alignItems: 'center', padding: 10 }}>
                            <input type="hidden" name="id" value={t.id} />
                            <input type="hidden" name="esta_activa" value="1" />
                            <input name="nombre" defaultValue={t.nombre} disabled={!esAdmin} className="mini" />
                            <select name="es_para" defaultValue={t.es_para} disabled={!esAdmin} className="mini">
                              <option value="adulto">Adulto</option>
                              <option value="nino">Niño</option>
                              <option value="senior">Senior</option>
                              <option value="general">General</option>
                            </select>
                            <input name="precio_publico_usd" type="number" step="0.01" min={0}
                                   defaultValue={t.precio_publico_usd ?? ''} disabled={!esAdmin} className="mini" />
                            <input name="precio_neto_usd" type="number" step="0.01" min={0}
                                   defaultValue={t.precio_neto_usd ?? ''} disabled={!esAdmin} className="mini"
                                   title="Lo que le queda al operador. No sale al público." />
                            <label style={{ fontSize: 12 }}>
                              <input type="checkbox" name="verificada" value="1"
                                     defaultChecked={t.verificada} disabled={!esAdmin} /> sí
                            </label>
                            <input name="fuente" defaultValue={t.fuente ?? ''} disabled={!esAdmin}
                                   placeholder="de dónde salió" className="mini" />
                            {esAdmin ? <BotonAccion clase="boton secundario chico">Guardar</BotonAccion> : <span />}
                            {esAdmin
                              ? <button type="submit" formAction={borrarTarifa} className="boton peligro chico">×</button>
                              : <span />}
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {esAdmin && (
                  <form action={guardarTarifa} className="campos" style={{ marginTop: 10 }}>
                    <input type="hidden" name="producto_id" value={p.id} />
                    <input type="hidden" name="esta_activa" value="1" />
                    <div className="campo"><label>Nueva tarifa</label>
                      <input name="nombre" placeholder="Adulto" /></div>
                    <div className="campo"><label>Para</label>
                      <select name="es_para">
                        <option value="adulto">Adulto</option>
                        <option value="nino">Niño</option>
                        <option value="senior">Senior</option>
                        <option value="general">General</option>
                      </select></div>
                    <div className="campo"><label>Precio público</label>
                      <input name="precio_publico_usd" type="number" step="0.01" min={0} /></div>
                    <div className="campo"><label>Fuente</label>
                      <input name="fuente" placeholder="Tarifario de Don Juan, 11-oct" /></div>
                    <BotonAccion clase="boton secundario">Agregar tarifa</BotonAccion>
                  </form>
                )}
              </details>
            ))}

            {esAdmin && <NuevoProducto contratoId={c.id} negocioId={c.negocio_id} />}
          </div>
        );
      })}
    </>
  );
}
