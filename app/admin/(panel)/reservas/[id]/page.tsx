import Link from 'next/link';
import { notFound } from 'next/navigation';
import { contextoPanel } from '@/lib/admin/contexto';
import { dinero, ESTADO_RESERVA, fecha } from '@/lib/admin/formato';
import { Cabecera, Etiqueta, Vacio } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { agregarLinea, cambiarEstado, editarReserva, eliminarLinea, registrarPago } from '../acciones';

export const dynamic = 'force-dynamic';

const uno = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? x[0] ?? null : x ?? null);

export default async function PaginaReserva({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { destino, db } = await contextoPanel('reservas');

  const { data: r } = await db
    .from('dst_reserva')
    .select('*, viajero:dst_viajero(id, nombre, email, whatsapp, llega_el, sale_el), solicitud:dst_solicitud(id, tipo)')
    .eq('id', id).eq('destino_id', destino.id)
    .maybeSingle();
  if (!r) notFound();

  const [{ data: lineas }, { data: pagos }, { data: tours }] = await Promise.all([
    db.from('dst_reserva_linea').select('id, descripcion, para_el, adultos, ninos, noches, precio_unitario_usd, cantidad, total_usd, neto_usd, comision_usd').eq('reserva_id', id).order('creado_en'),
    db.from('dst_pago').select('id, concepto, monto_usd, metodo, referencia, pagado_el, estado').eq('reserva_id', id).order('creado_en'),
    db.from('dst_tour').select('id, nombre, precio_adulto_usd, precio_neto_usd').eq('destino_id', destino.id).eq('estado', 'publicado').order('nombre'),
  ]);

  const v = uno(r.viajero) as { id: string; nombre: string | null; email: string | null; whatsapp: string | null; llega_el: string | null; sale_el: string | null } | null;
  const s = uno(r.solicitud) as { id: string; tipo: string } | null;
  const e = ESTADO_RESERVA[r.estado] ?? { nombre: r.estado, color: '#9CA3AF' };
  const saldo = Number(r.total_usd) - Number(r.pagado_usd);

  return (
    <>
      <Cabecera titulo={`Reserva ${r.codigo}`} migas={[{ ruta: '/admin/reservas', nombre: 'Reservas' }]} sub={<><Etiqueta color={e.color}>{e.nombre}</Etiqueta> · pago {r.estado_pago} · creada {fecha(r.creado_en, destino.zona_horaria)}</>}>
        {v && <Link className="boton secundario" href={`/admin/viajeros/${v.id}`}>Viajero</Link>}
        {s && <Link className="boton secundario" href={`/admin/leads/${s.id}`}>Lead</Link>}
      </Cabecera>

      <div className="kpis">
        <div className="kpi"><div className="valor">{dinero(r.total_usd)}</div><div className="titulo">Total</div><div className="nota">subtotal {dinero(r.subtotal_usd)} · descuento {dinero(r.descuento_usd)}</div></div>
        <div className="kpi"><div className="valor">{dinero(r.pagado_usd)}</div><div className="titulo">Pagado</div><div className="nota">saldo {dinero(saldo)}</div></div>
        <div className={`kpi ${Number(r.comision_usd) > 0 ? 'bien' : ''}`}><div className="valor">{dinero(r.comision_usd)}</div><div className="titulo">Comisión</div></div>
      </div>

      <div className="lado">
        <div>
          <div className="tarjeta">
            <h2>Qué incluye</h2>
            {!lineas?.length ? <Vacio texto="Sin líneas. Agregá el tour, el hotel o el traslado." /> : (
              <table className="tabla">
                <thead><tr><th>Descripción</th><th>Fecha</th><th>Pax</th><th className="num">Precio</th><th className="num">Total</th><th className="num">Comisión</th><th></th></tr></thead>
                <tbody>{lineas.map((l) => (
                  <tr key={l.id}>
                    <td>{l.descripcion}</td><td>{l.para_el ?? '—'}</td><td>{l.adultos ?? 0}{l.ninos ? ` + ${l.ninos}` : ''}{l.noches ? ` · ${l.noches} noches` : ''}</td>
                    <td className="num">{dinero(l.precio_unitario_usd)} × {l.cantidad}</td><td className="num">{dinero(l.total_usd)}</td><td className="num">{dinero(l.comision_usd)}</td>
                    <td><form action={eliminarLinea}><input type="hidden" name="id" value={id} /><input type="hidden" name="linea_id" value={l.id} /><BotonAccion clase="boton peligro chico" confirmar="¿Quitar esta línea?">×</BotonAccion></form></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>Agregar línea</summary>
              <form action={agregarLinea} className="campos" style={{ marginTop: 10 }}>
                <input type="hidden" name="id" value={id} />
                <div className="campo ancho"><label>Descripción</label><input name="descripcion" required /></div>
                <div className="campo"><label>Tour del catálogo (opcional)</label><select name="tour_id" defaultValue=""><option value="">—</option>{tours?.map((t) => <option key={t.id} value={t.id}>{t.nombre} · {dinero(t.precio_adulto_usd)}</option>)}</select></div>
                <div className="campo"><label>Fecha</label><input type="date" name="para_el" defaultValue={v?.llega_el ?? ''} /></div>
                <div className="campo"><label>Adultos</label><input type="number" name="adultos" min={0} defaultValue={2} /></div>
                <div className="campo"><label>Niños</label><input type="number" name="ninos" min={0} defaultValue={0} /></div>
                <div className="campo"><label>Noches</label><input type="number" name="noches" min={0} /></div>
                <div className="campo"><label>Precio unitario USD</label><input type="number" step="0.01" name="precio_unitario_usd" required /></div>
                <div className="campo"><label>Cantidad</label><input type="number" name="cantidad" min={1} defaultValue={1} /></div>
                <div className="campo"><label>Neto al proveedor USD</label><input type="number" step="0.01" name="neto_usd" /></div>
                <div className="campo"><label>Comisión USD</label><input type="number" step="0.01" name="comision_usd" placeholder={`auto ${destino.comision_por_defecto ?? 0}%`} /></div>
                <div className="campo ancho"><BotonAccion clase="boton chico">Agregar</BotonAccion></div>
              </form>
            </details>
          </div>

          <div className="tarjeta">
            <h2>Pagos</h2>
            {!pagos?.length ? <Vacio texto="Sin pagos registrados." /> : (
              <table className="tabla">
                <thead><tr><th>Concepto</th><th>Método</th><th>Referencia</th><th>Fecha</th><th className="num">Monto</th></tr></thead>
                <tbody>{pagos.map((p) => <tr key={p.id}><td>{p.concepto}</td><td>{p.metodo ?? '—'}</td><td className="gris">{p.referencia ?? '—'}</td><td>{p.pagado_el ?? '—'}</td><td className="num">{dinero(p.monto_usd)}</td></tr>)}</tbody>
              </table>
            )}
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>Registrar pago</summary>
              <form action={registrarPago} className="campos" style={{ marginTop: 10 }}>
                <input type="hidden" name="id" value={id} />
                <div className="campo"><label>Concepto</label><input name="concepto" defaultValue={saldo > 0 && Number(r.pagado_usd) === 0 ? 'Depósito' : 'Saldo'} /></div>
                <div className="campo"><label>Monto USD</label><input type="number" step="0.01" name="monto_usd" defaultValue={saldo > 0 ? saldo.toFixed(2) : ''} required /></div>
                <div className="campo"><label>Método</label><select name="metodo" defaultValue="transferencia"><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta</option><option value="efectivo">Efectivo</option><option value="sinpe">SINPE</option><option value="paypal">PayPal</option><option value="otro">Otro</option></select></div>
                <div className="campo"><label>Referencia</label><input name="referencia" /></div>
                <div className="campo"><label>Fecha</label><input type="date" name="pagado_el" defaultValue={new Date().toISOString().slice(0, 10)} /></div>
                <div className="campo ancho"><BotonAccion clase="boton chico verde">Registrar</BotonAccion></div>
              </form>
            </details>
          </div>
        </div>

        <div>
          <div className="tarjeta">
            <h2>Estado</h2>
            <form action={cambiarEstado} className="campos" style={{ gridTemplateColumns: '1fr' }}>
              <input type="hidden" name="id" value={id} />
              <div className="campo"><select name="estado" defaultValue={r.estado}>{Object.entries(ESTADO_RESERVA).map(([k, x]) => <option key={k} value={k}>{x.nombre}</option>)}</select></div>
              <div className="campo"><input type="text" name="motivo" placeholder="Motivo (si se cancela)" defaultValue={r.motivo_cancelacion ?? ''} /></div>
              <BotonAccion clase="boton chico">Cambiar</BotonAccion>
            </form>
            {r.confirmada_en && <p className="gris" style={{ color: '#8B8B87', fontSize: 12.5, margin: '10px 0 0' }}>Confirmada {fecha(r.confirmada_en, destino.zona_horaria)}</p>}
            {r.cancelada_en && <p className="gris" style={{ color: '#8B8B87', fontSize: 12.5, margin: '10px 0 0' }}>Cancelada {fecha(r.cancelada_en, destino.zona_horaria)}: {r.motivo_cancelacion}</p>}
          </div>

          <div className="tarjeta">
            <h2>Titular y notas</h2>
            <form action={editarReserva} className="campos" style={{ gridTemplateColumns: '1fr' }}>
              <input type="hidden" name="id" value={id} />
              <div className="campo"><label>Titular</label><input name="nombre_titular" defaultValue={r.nombre_titular ?? v?.nombre ?? ''} /></div>
              <div className="campo"><label>Correo</label><input type="email" name="email_titular" defaultValue={r.email_titular ?? v?.email ?? ''} /></div>
              <div className="campo"><label>WhatsApp</label><input name="whatsapp_titular" defaultValue={r.whatsapp_titular ?? v?.whatsapp ?? ''} /></div>
              <div className="campo"><label>Descuento USD</label><input type="number" step="0.01" name="descuento_usd" defaultValue={r.descuento_usd ?? 0} /></div>
              <div className="campo"><label>Notas para el viajero</label><textarea name="notas" defaultValue={r.notas ?? ''} style={{ minHeight: 60 }} /></div>
              <div className="campo"><label>Notas internas</label><textarea name="notas_internas" defaultValue={r.notas_internas ?? ''} style={{ minHeight: 60 }} /></div>
              <BotonAccion clase="boton secundario chico">Guardar</BotonAccion>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
