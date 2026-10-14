import Link from 'next/link';
import { contextoPanel } from '@/lib/admin/contexto';
import { Aviso, Cabecera, Etiqueta, Vacio } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import {
  cambiarOperador, guardarContrato, guardarProducto, guardarTarifa, borrarTarifa,
  guardarComplemento,
} from './acciones';
import { DocumentoContrato } from './DocumentoContrato';
import { NuevoContrato, NuevoProducto } from './Nuevos';

export const dynamic = 'force-dynamic';

/* Cómo se escribe el precio de una tarifa: en colones si es de nacionales, en
   dólares si no. Un solo lugar, para que la tabla y el resumen no se separen. */
function plataDeTarifa(t: Tarifa): string {
  if (t.precio_publico_crc != null) {
    return `₡${Math.round(t.precio_publico_crc).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  }
  return t.precio_publico_usd != null ? `$${t.precio_publico_usd}` : 'sin precio';
}

type Tarifa = {
  id: string; nombre: string; precio_publico_usd: number | null; precio_neto_usd: number | null;
  /* Una tarifa de nacionales se guarda en COLONES y los dólares quedan en
     null: el precio en colones es el que manda. Sin esto, el resumen imprimía
     «Adulto nacional $null». */
  precio_publico_crc: number | null; precio_neto_crc: number | null;
  residencia: 'todos' | 'nacional';
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
type Negocio = {
  id: string; nombre: string; babosa: string; vende_por_aqui: boolean;
  estado_publicacion: string; es_operador: boolean;
  categoria: { babosa: string } | { babosa: string }[] | null;
};
type Complemento = {
  id: string; negocio_id: string; nombre: string; descripcion: string | null;
  precio_publico_usd: number; precio_neto_usd: number | null;
  solo_adultos: boolean; horas_antelacion: number;
  maximo_por_reserva: number | null; esta_activo: boolean;
};

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

  const [{ data: d }, { data: neg }, { data: tur }, { data: con }, { data: comp }] = await Promise.all([
    db.from('dst_destino').select('reservas_activas, pasarela_lista, email_contacto').eq('id', destino.id).single(),
    db.from('dst_negocio')
      .select('id, nombre, babosa, vende_por_aqui, estado_publicacion, es_operador, categoria:dst_categoria(babosa)')
      .eq('destino_id', destino.id).eq('estado_publicacion', 'publicado')
      .order('nombre'),
    db.from('dst_tour').select('id, negocio_id, estado').eq('destino_id', destino.id),
    db.from('dst_contrato')
      .select('*, productos:dst_producto(*, tarifas:dst_tarifa(*))')
      .eq('destino_id', destino.id).order('creado_en'),
    db.from('dst_complemento').select('*').eq('destino_id', destino.id).order('orden'),
  ]);

  const negocios = (neg ?? []) as Negocio[];
  const contratos = (con ?? []) as Contrato[];

  /* La dirección pública de un negocio. Devuelve null cuando NO hay nada que
     mirar: sin publicar todavía no existe, y un OPERADOR no tiene ficha —
     lo suyo son sus tours. Un enlace que lleva a un 404 es peor que ninguno. */
  const urlPublica = (n: Negocio | undefined): string | null => {
    if (!n || n.estado_publicacion !== 'publicado' || n.es_operador) return null;
    const cat = Array.isArray(n.categoria) ? n.categoria[0] : n.categoria;
    if (!cat?.babosa) return null;
    return `https://${destino.dominio}/${destino.idioma_principal}/${cat.babosa}/${n.babosa}`;
  };
  const complementos = (comp ?? []) as Complemento[];
  /* Las tours de cada operador, contadas una sola vez acá. Un operador con
     doce tours es lo normal; lo que importa de un vistazo es cuántas están
     PUBLICADAS, porque una en borrador no la ofrece nadie. */
  const tours = (tur ?? []) as { id: string; negocio_id: string | null; estado: string }[];
  const toursDe = (id: string) => {
    const suyas = tours.filter((t) => t.negocio_id === id);
    return { total: suyas.length, publicadas: suyas.filter((t) => t.estado === 'publicado').length };
  };
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
          <thead><tr><th>Negocio</th><th>Contratos</th><th>Tours</th><th>Vende</th></tr></thead>
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
                      {(() => {
                        const { total, publicadas } = toursDe(n.id);
                        return total === 0 ? (
                          <Link className="gris" href={`/admin/tours?operador=${n.id}`}>agregar</Link>
                        ) : (
                          <Link href={`/admin/tours?operador=${n.id}`}>
                            {publicadas} publicada{publicadas === 1 ? '' : 's'}
                            {total > publicadas && <span className="gris"> de {total}</span>}
                          </Link>
                        );
                      })()}
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
        const cuantosProductos = c.productos?.length ?? 0;
        const cuantasTarifas = (c.productos ?? [])
          .reduce((n2, p) => n2 + (p.tarifas ?? []).filter((t) => t.verificada).length, 0);
        return (
          /* El contrato va PLEGADO. Antes se abrían todos a la vez, con doce
             campos cada uno, y había que bajar media pantalla para llegar a
             los productos — que es a lo que uno viene casi siempre. Abierto
             queda el que de verdad falta configurar. */
          <details className="tarjeta contrato-ficha" key={c.id}
                   open={c.modo_cobro === 'plataforma_cobra' && !listoParaCobrar}>
            <summary className="contrato-cabeza">
              <span className="contrato-titulo">
                <strong>{n?.nombre ?? '—'}</strong>
                <span className="gris">{c.nombre}</span>
              </span>
              <span className="contrato-datos">
                <span>{cuantosProductos} producto{cuantosProductos === 1 ? '' : 's'}</span>
                <span>{cuantasTarifas} tarifa{cuantasTarifas === 1 ? '' : 's'} verificada{cuantasTarifas === 1 ? '' : 's'}</span>
                <span>
                  {c.comision_valor != null
                    ? `${c.comision_tipo === 'porcentaje' ? `${c.comision_valor}%` : `$${c.comision_valor}`}`
                    : <em className="gris">sin comisión</em>}
                </span>
                <Etiqueta color={c.esta_activo ? '#66BB2E' : '#9CA3AF'}>
                  {c.esta_activo ? 'activo' : 'apagado'}
                </Etiqueta>
              </span>
            </summary>

            {/* Ver cómo quedó, sin tener que buscar la ficha a mano. Si no hay
                nada publicado todavía, se dice en vez de dar un enlace roto. */}
            {urlPublica(n) ? (
              <p className="ver-online">
                <a href={`${urlPublica(n)}#reservar`} target="_blank" rel="noreferrer">
                  Ver la ficha en el sitio ↗
                </a>
                <span className="gris">Abre en la tarjeta de reservar.</span>
              </p>
            ) : (
              <p className="ver-online">
                <span className="gris">
                  {n?.es_operador
                    ? 'Es un operador: no tiene ficha propia, lo que sale en el sitio son sus tours.'
                    : 'Todavía no está publicado, así que no hay ficha que mirar.'}
                </span>
              </p>
            )}

            {c.modo_cobro === 'plataforma_cobra' && !listoParaCobrar && (
              <Aviso tipo="mal">
                Para cobrar nosotros hacen falta <strong>comisión, política de cancelación
                y vigencia desde</strong>. Sin eso la base no deja encenderlo.
              </Aviso>
            )}

            <form action={guardarContrato} className="campos">
              <input type="hidden" name="id" value={c.id} />
              <div className="campo ancho"><label>Nombre del contrato</label>
                <input name="nombre" defaultValue={c.nombre} disabled={!esAdmin} />
                <small>Para distinguirlo de otros con el mismo negocio. Ej.: «Piloto Paradise».</small></div>

              {/* ---- Cómo se vende ---- */}
              <h4 className="contrato-seccion">Cómo se vende</h4>
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

              {/* ---- La plata ---- */}
              <h4 className="contrato-seccion">La plata</h4>
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

              {/* ---- Vigencia y papeles ---- */}
              <h4 className="contrato-seccion">Vigencia y papeles</h4>
              <div className="campo"><label>Vigencia desde</label>
                <input name="vigencia_desde" type="date" defaultValue={c.vigencia_desde ?? ''} disabled={!esAdmin} /></div>
              <div className="campo"><label>Hasta <small>vacío = sin fin</small></label>
                <input name="vigencia_hasta" type="date" defaultValue={c.vigencia_hasta ?? ''} disabled={!esAdmin} /></div>

              <div className="campo ancho"><label>Política de cancelación</label>
                <textarea name="politica_cancelacion" rows={3}
                          defaultValue={c.politica_cancelacion ?? ''} disabled={!esAdmin} />
                <small>Se le muestra a quien reserva. Si no está, no se puede cobrar.</small></div>
              <DocumentoContrato contratoId={c.id} negocioBabosa={n?.babosa ?? 'sin-negocio'}
                                 valor={c.documento_url} puedeEditar={esAdmin} />
              <div className="campo ancho"><label>Notas internas</label>
                <textarea name="notas" rows={2} defaultValue={c.notas ?? ''} disabled={!esAdmin} /></div>

              {/* ---- Interruptores ---- */}
              <h4 className="contrato-seccion">Interruptores</h4>
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
                        .map((t) => `${t.nombre} ${plataDeTarifa(t)}`).join(' · ')
                    : <span className="gris">sin tarifa verificada</span>}
                  {!p.esta_activo && ' · (apagado)'}
                </summary>

                {/* Un producto no tiene dirección propia: vive dentro de la
                    tarjeta de reservar de la ficha. Por eso el enlace es a la
                    ficha con `#reservar`, que es donde de verdad se ve. */}
                {urlPublica(n) && p.esta_activo && (
                  <p className="ver-online">
                    <a href={`${urlPublica(n)}#reservar`} target="_blank" rel="noreferrer">
                      Ver este producto en el sitio ↗
                    </a>
                    <span className="gris">
                      Sale en la tarjeta de reservar, junto con los otros pases del negocio.
                    </span>
                  </p>
                )}

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
                  <thead><tr><th>Nombre</th><th>Para</th><th>Quién</th><th className="num">Público</th><th className="num">Neto</th><th>Verif.</th><th>Fuente</th><th></th></tr></thead>
                  <tbody>
                    {(p.tarifas ?? []).map((t) => (
                      <tr key={t.id}>
                        <td colSpan={8} style={{ padding: 0 }}>
                          <form action={guardarTarifa} style={{ display: 'grid', gridTemplateColumns: '1.1fr .7fr .9fr .7fr .7fr .5fr 1.1fr auto auto', gap: 8, alignItems: 'center', padding: 10 }}>
                            <input type="hidden" name="id" value={t.id} />
                            <input type="hidden" name="esta_activa" value="1" />
                            <input name="nombre" defaultValue={t.nombre} disabled={!esAdmin} className="mini" />
                            <select name="es_para" defaultValue={t.es_para} disabled={!esAdmin} className="mini">
                              <option value="adulto">Adulto</option>
                              <option value="nino">Niño</option>
                              <option value="senior">Senior</option>
                              <option value="general">General</option>
                            </select>
                            <select name="residencia" defaultValue={t.residencia} disabled={!esAdmin} className="mini"
                                    title="«Nacional» es para quien vive en Costa Rica, con cédula o DIMEX. Esa tarifa se cobra en colones.">
                              <option value="todos">Cualquiera · $</option>
                              <option value="nacional">Nacional/residente · ₡</option>
                            </select>
                            {/* Los campos cambian de moneda según la residencia: una tarifa
                                nacional se guarda en COLONES y la de extranjeros en dólares.
                                Mostrar los cuatro dejaría dos precios compitiendo. */}
                            {t.residencia === 'nacional' ? (
                              <>
                                <input name="precio_publico_crc" type="number" step="1" min={0}
                                       defaultValue={t.precio_publico_crc ?? ''} disabled={!esAdmin} className="mini"
                                       title="Precio al público EN COLONES." />
                                <input name="precio_neto_crc" type="number" step="1" min={0}
                                       defaultValue={t.precio_neto_crc ?? ''} disabled={!esAdmin} className="mini"
                                       title="Lo que le queda al operador, en colones. No sale al público." />
                              </>
                            ) : (
                              <>
                                <input name="precio_publico_usd" type="number" step="0.01" min={0}
                                       defaultValue={t.precio_publico_usd ?? ''} disabled={!esAdmin} className="mini"
                                       title="Precio al público en dólares." />
                                <input name="precio_neto_usd" type="number" step="0.01" min={0}
                                       defaultValue={t.precio_neto_usd ?? ''} disabled={!esAdmin} className="mini"
                                       title="Lo que le queda al operador. No sale al público." />
                              </>
                            )}
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

            {/* ---- Complementos ----
                Cuelgan del NEGOCIO y no del contrato: el mismo upgrade se
                añade a cualquiera de sus pases. Salen acá porque es donde uno
                está mirando ese negocio. */}
            <h3 style={{ marginTop: 26, fontSize: 15 }}>
              Complementos{' '}
              <small className="gris">se suman a un pase, nunca se venden solos</small>
            </h3>
            {(complementos ?? []).filter((x) => x.negocio_id === c.negocio_id).map((x) => (
              <details key={x.id} className="complemento-ficha">
                <summary>
                  <strong>{x.nombre}</strong>
                  {' · '}<b>+${x.precio_publico_usd}</b>
                  {x.solo_adultos && <span className="gris"> · solo adultos</span>}
                  {x.horas_antelacion > 0 && <span className="gris"> · {x.horas_antelacion} h antes</span>}
                  {!x.esta_activo && <span className="gris"> · (apagado)</span>}
                </summary>
                <form action={guardarComplemento} className="campos" style={{ marginTop: 12 }}>
                  <input type="hidden" name="id" value={x.id} />
                  <div className="campo ancho"><label>Nombre</label>
                    <input name="nombre" defaultValue={x.nombre} disabled={!esAdmin} />
                    <small>Como lo ve quien reserva. Ej.: «Wellness Upgrade».</small></div>
                  <div className="campo ancho"><label>Qué es</label>
                    <textarea name="descripcion" rows={2} defaultValue={x.descripcion ?? ''} disabled={!esAdmin} />
                    <small>Una línea que explique qué incluye. Sale en la tarjeta de reserva.</small></div>
                  <div className="campo"><label>Precio al público USD</label>
                    <input name="precio_publico_usd" type="number" step="0.01" min={0}
                           defaultValue={x.precio_publico_usd} disabled={!esAdmin} />
                    <small>Por persona. Se cobra en dólares aunque el pase vaya en colones.</small></div>
                  <div className="campo"><label>Neto al operador USD</label>
                    <input name="precio_neto_usd" type="number" step="0.01" min={0}
                           defaultValue={x.precio_neto_usd ?? ''} disabled={!esAdmin} />
                    <small>Lo que se le paga. <strong>Sin esto tu comisión sale en cero.</strong></small></div>
                  <div className="campo"><label>Horas de antelación</label>
                    <input name="horas_antelacion" type="number" min={0} max={720}
                           defaultValue={x.horas_antelacion} disabled={!esAdmin} />
                    <small>Cuántas horas antes hay que pedirlo. Se mide contra el momento de reservar, no contra el día. 0 = sin mínimo.</small></div>
                  <div className="campo"><label>Máximo por reserva</label>
                    <input name="maximo_por_reserva" type="number" min={1} max={99}
                           defaultValue={x.maximo_por_reserva ?? ''} disabled={!esAdmin} placeholder="sin tope" />
                    <small>Vacío = tantos como personas haya.</small></div>
                  <div className="campo ancho"><label>
                    <input type="checkbox" name="solo_adultos" value="1"
                           defaultChecked={x.solo_adultos} disabled={!esAdmin} /> Solo para adultos</label>
                    <small>Con esto marcado, nadie puede pedir más complementos que adultos tenga la reserva.</small></div>
                  <div className="campo ancho"><label>
                    <input type="checkbox" name="esta_activo" value="1"
                           defaultChecked={x.esta_activo} disabled={!esAdmin} />
                    {' '}<strong>Activo</strong></label>
                    <small>Apagado desaparece de la tarjeta de reserva al instante.</small></div>
                  {esAdmin && <BotonAccion>Guardar el complemento</BotonAccion>}
                </form>
              </details>
            ))}
            {esAdmin && (
              <details className="complemento-ficha">
                <summary>+ Nuevo complemento</summary>
                <form action={guardarComplemento} className="campos" style={{ marginTop: 12 }}>
                  <input type="hidden" name="negocio_id" value={c.negocio_id} />
                  <input type="hidden" name="esta_activo" value="1" />
                  <div className="campo ancho"><label>Nombre</label>
                    <input name="nombre" required placeholder="Wellness Upgrade" /></div>
                  <div className="campo"><label>Precio al público USD</label>
                    <input name="precio_publico_usd" type="number" step="0.01" min={0} required /></div>
                  <div className="campo"><label>Neto al operador USD</label>
                    <input name="precio_neto_usd" type="number" step="0.01" min={0} /></div>
                  <div className="campo"><BotonAccion clase="boton chico">Crear</BotonAccion></div>
                </form>
              </details>
            )}
          </details>
        );
      })}
    </>
  );
}
