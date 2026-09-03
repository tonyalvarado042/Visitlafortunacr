'use server';

import { revalidatePath } from 'next/cache';
import { contextoPanel } from '@/lib/admin/contexto';

const esUuid = (v: unknown) => /^[0-9a-f-]{36}$/i.test(String(v ?? ''));
const texto = (d: FormData, k: string) => String(d.get(k) ?? '').trim();
const numero = (d: FormData, k: string) => { const v = texto(d, k); return v === '' ? null : Number(v); };

const ESTADOS = ['solicitada', 'confirmada', 'pagada', 'completada', 'cancelada', 'no_show'];

function refrescar(id: string) {
  revalidatePath(`/admin/reservas/${id}`);
  revalidatePath('/admin/reservas');
  revalidatePath('/admin');
}

/** Totales de la reserva a partir de sus líneas y sus pagos. */
async function recalcular(db: Awaited<ReturnType<typeof contextoPanel>>['db'], reservaId: string) {
  const [{ data: lineas }, { data: pagos }, { data: reserva }] = await Promise.all([
    db.from('dst_reserva_linea').select('total_usd, comision_usd').eq('reserva_id', reservaId),
    db.from('dst_pago').select('monto_usd, estado').eq('reserva_id', reservaId),
    db.from('dst_reserva').select('descuento_usd').eq('id', reservaId).single(),
  ]);
  const subtotal = (lineas ?? []).reduce((a, l) => a + Number(l.total_usd ?? 0), 0);
  const comision = (lineas ?? []).reduce((a, l) => a + Number(l.comision_usd ?? 0), 0);
  const pagado = (pagos ?? []).filter((p) => p.estado === 'pagado').reduce((a, p) => a + Number(p.monto_usd ?? 0), 0);
  const total = Math.max(subtotal - Number(reserva?.descuento_usd ?? 0), 0);
  await db.from('dst_reserva').update({
    subtotal_usd: subtotal, total_usd: total, comision_usd: comision, pagado_usd: pagado,
    estado_pago: pagado <= 0 ? 'pendiente' : pagado >= total ? 'pagado' : 'parcial',
  }).eq('id', reservaId);
}

export async function cambiarEstado(datos: FormData) {
  const { db } = await contextoPanel('reservas');
  const id = texto(datos, 'id');
  const estado = texto(datos, 'estado');
  if (!esUuid(id) || !ESTADOS.includes(estado)) return;
  const ahora = new Date().toISOString();
  await db.from('dst_reserva').update({
    estado,
    ...(estado === 'confirmada' ? { confirmada_en: ahora } : {}),
    ...(estado === 'cancelada' ? { cancelada_en: ahora, motivo_cancelacion: texto(datos, 'motivo') || 'sin motivo' } : {}),
  }).eq('id', id);
  refrescar(id);
}

export async function editarReserva(datos: FormData) {
  const { db } = await contextoPanel('reservas');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;
  await db.from('dst_reserva').update({
    nombre_titular: texto(datos, 'nombre_titular') || null,
    email_titular: texto(datos, 'email_titular') || null,
    whatsapp_titular: texto(datos, 'whatsapp_titular') || null,
    notas: texto(datos, 'notas') || null,
    notas_internas: texto(datos, 'notas_internas') || null,
    descuento_usd: numero(datos, 'descuento_usd') ?? 0,
  }).eq('id', id);
  await recalcular(db, id);
  refrescar(id);
}

export async function agregarLinea(datos: FormData) {
  const { db, destino } = await contextoPanel('reservas');
  const id = texto(datos, 'id');
  const descripcion = texto(datos, 'descripcion');
  if (!esUuid(id) || !descripcion) return;
  const precio = numero(datos, 'precio_unitario_usd') ?? 0;
  const cantidad = Math.max(numero(datos, 'cantidad') ?? 1, 1);
  const total = Math.round(precio * cantidad * 100) / 100;
  const neto = numero(datos, 'neto_usd');
  const comision = numero(datos, 'comision_usd') ?? (neto != null ? Math.round((total - neto) * 100) / 100 : Math.round(total * ((destino.comision_por_defecto ?? 0) / 100) * 100) / 100);
  await db.from('dst_reserva_linea').insert({
    reserva_id: id, descripcion: descripcion.slice(0, 200), para_el: texto(datos, 'para_el') || null,
    adultos: numero(datos, 'adultos'), ninos: numero(datos, 'ninos'), noches: numero(datos, 'noches'),
    tour_id: esUuid(texto(datos, 'tour_id')) ? texto(datos, 'tour_id') : null,
    negocio_id: esUuid(texto(datos, 'negocio_id')) ? texto(datos, 'negocio_id') : null,
    precio_unitario_usd: precio, cantidad, total_usd: total, neto_usd: neto, comision_usd: comision,
  });
  await recalcular(db, id);
  refrescar(id);
}

export async function eliminarLinea(datos: FormData) {
  const { db } = await contextoPanel('reservas');
  const id = texto(datos, 'id');
  const lineaId = texto(datos, 'linea_id');
  if (!esUuid(id) || !esUuid(lineaId)) return;
  await db.from('dst_reserva_linea').delete().eq('id', lineaId).eq('reserva_id', id);
  await recalcular(db, id);
  refrescar(id);
}

export async function registrarPago(datos: FormData) {
  const { db, usuario } = await contextoPanel('reservas');
  const id = texto(datos, 'id');
  const monto = numero(datos, 'monto_usd');
  if (!esUuid(id) || !monto || monto <= 0) return;
  await db.from('dst_pago').insert({
    reserva_id: id, concepto: texto(datos, 'concepto') || 'Pago', monto_usd: monto,
    metodo: texto(datos, 'metodo') || null, referencia: texto(datos, 'referencia') || null,
    pagado_el: texto(datos, 'pagado_el') || new Date().toISOString().slice(0, 10),
    estado: 'pagado', registrado_por: usuario.id,
  });
  await recalcular(db, id);
  refrescar(id);
}
