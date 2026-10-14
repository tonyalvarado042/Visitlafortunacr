'use server';

import { revalidatePath } from 'next/cache';
import { contextoPanel } from '@/lib/admin/contexto';

export type Estado = { ok?: string | null; error?: string | null };

const texto = (d: FormData, k: string) => String(d.get(k) ?? '').trim();
const numero = (d: FormData, k: string) => { const v = texto(d, k); return v === '' ? null : Number(v); };
const esSi = (d: FormData, k: string) => texto(d, k) === '1';
const esUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
const babosear = (v: string) =>
  v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
   .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

function refrescar() {
  revalidatePath('/admin/operadores');
  /* La ficha pública cambia de forma apenas se toca esto: un contrato que se
     apaga saca el widget de la ficha. */
  revalidatePath('/', 'layout');
}

/**
 * El segundo interruptor: este negocio vende por aquí o no.
 *
 * Vive junto a los contratos y no en la ficha del negocio a propósito: es una
 * decisión comercial, no de contenido. Quien edita fotos y horarios no es
 * quien decide con quién hay acuerdo.
 */
export async function cambiarOperador(datos: FormData) {
  const { db, destino, usuario } = await contextoPanel('operadores');
  if (usuario.rol !== 'admin') return;
  const id = texto(datos, 'negocio_id');
  if (!esUuid(id)) return;
  await db.from('dst_negocio')
    .update({ vende_por_aqui: esSi(datos, 'vende') })
    .eq('id', id).eq('destino_id', destino.id);
  refrescar();
}

export async function crearContrato(_previo: Estado, datos: FormData): Promise<Estado> {
  const { db, destino, usuario } = await contextoPanel('operadores');
  if (usuario.rol !== 'admin') return { error: 'Solo un administrador.' };
  const negocio = texto(datos, 'negocio_id');
  const nombre = texto(datos, 'nombre');
  if (!esUuid(negocio)) return { error: 'Elegí un negocio.' };
  if (!nombre) return { error: 'Ponele nombre al contrato.' };

  const { error } = await db.from('dst_contrato').insert({
    destino_id: destino.id,
    negocio_id: negocio,
    nombre,
    /* Nace en el modo más conservador: cobra el operador, a solicitud y con
       confirmación manual. Es lo único que se puede sostener sin contrato
       firmado, sin tarifa verificada y sin pasarela. Subir de ahí es una
       decisión, no el estado por defecto. */
    modo_cobro: 'operador_cobra',
    modo_disponibilidad: 'a_solicitud',
    modo_confirmacion: 'manual',
    esta_activo: false,
  });
  if (error) return { error: error.message };
  refrescar();
  return { ok: 'Contrato creado. Nace apagado: llenalo y encendelo.' };
}

export async function guardarContrato(datos: FormData) {
  const { db, destino, usuario } = await contextoPanel('operadores');
  if (usuario.rol !== 'admin') return;
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;

  const { error } = await db.from('dst_contrato').update({
    nombre: texto(datos, 'nombre') || undefined,
    modo_cobro: texto(datos, 'modo_cobro'),
    modo_disponibilidad: texto(datos, 'modo_disponibilidad'),
    modo_confirmacion: texto(datos, 'modo_confirmacion'),
    comision_tipo: texto(datos, 'comision_tipo'),
    comision_valor: numero(datos, 'comision_valor'),
    comision_base: texto(datos, 'comision_base'),
    frecuencia_liquidacion: texto(datos, 'frecuencia_liquidacion'),
    emite_voucher_propio: esSi(datos, 'emite_voucher_propio'),
    politica_cancelacion: texto(datos, 'politica_cancelacion') || null,
    vigencia_desde: texto(datos, 'vigencia_desde') || null,
    vigencia_hasta: texto(datos, 'vigencia_hasta') || null,
    /* Dos formas válidas: un enlace de afuera (Drive, Dropbox) o la RUTA de un
       archivo del bucket privado `contratos`. Lo segundo es lo normal desde
       que hay botón de subir; lo primero quedó para lo que ya estaba cargado
       en otro lado. Cualquier otra cosa se descarta. */
    documento_url: (() => {
      const v = texto(datos, 'documento_url');
      if (/^https?:\/\/\S+$/i.test(v)) return v;
      if (/^[a-z0-9][a-z0-9/_.-]{3,250}$/i.test(v) && !v.includes('..')) return v;
      return null;
    })(),
    notas: texto(datos, 'notas') || null,
    esta_activo: esSi(datos, 'esta_activo'),
    actualizado_en: new Date().toISOString(),
  }).eq('id', id).eq('destino_id', destino.id);

  /* El check de la base rechaza encender "plataforma cobra" sin comisión,
     política ni vigencia. Ese error se traga aquí: la página lo vuelve a
     mostrar apagado, que es lo correcto. */
  if (error) console.error('guardarContrato:', error.message);
  refrescar();
}

export async function crearProducto(_previo: Estado, datos: FormData): Promise<Estado> {
  const { db, destino, usuario } = await contextoPanel('operadores');
  if (usuario.rol !== 'admin') return { error: 'Solo un administrador.' };
  const contrato = texto(datos, 'contrato_id');
  const negocio = texto(datos, 'negocio_id');
  const nombre = texto(datos, 'nombre');
  if (!esUuid(contrato) || !esUuid(negocio)) return { error: 'Falta el contrato.' };
  if (!nombre) return { error: 'Ponele nombre al producto.' };

  const { error } = await db.from('dst_producto').insert({
    destino_id: destino.id,
    negocio_id: negocio,
    contrato_id: contrato,
    babosa: babosear(nombre),
    nombre,
    esta_activo: false,
  });
  if (error) return { error: error.message };
  refrescar();
  return { ok: 'Producto creado. Ponele tarifa y encendelo.' };
}

export async function guardarProducto(datos: FormData) {
  const { db, usuario } = await contextoPanel('operadores');
  if (usuario.rol !== 'admin') return;
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;
  const antelacion = numero(datos, 'horas_antelacion');

  const { error } = await db.from('dst_producto').update({
    nombre: texto(datos, 'nombre') || undefined,
    resumen: texto(datos, 'resumen') || null,
    incluye: texto(datos, 'incluye').split('\n').map((l) => l.trim()).filter(Boolean),
    no_incluye: texto(datos, 'no_incluye').split('\n').map((l) => l.trim()).filter(Boolean),
    edad_minima: numero(datos, 'edad_minima'),
    admite_ninos: esSi(datos, 'admite_ninos'),
    horas_antelacion: antelacion == null ? 24 : Math.min(720, Math.max(0, Math.round(antelacion))),
    esta_activo: esSi(datos, 'esta_activo'),
    actualizado_en: new Date().toISOString(),
  }).eq('id', id);
  if (error) console.error('guardarProducto:', error.message);
  refrescar();
}

/**
 * Una tarifa.
 *
 * `verificada` es la que decide si el precio sale a la calle. Se marca solo
 * cuando el número viene del operador, no de una página ni de memoria: un
 * precio de oído en una ficha pública es una promesa que no podemos cumplir.
 * Por eso el formulario pide la fuente al lado.
 */
export async function guardarTarifa(datos: FormData) {
  const { db, usuario } = await contextoPanel('operadores');
  if (usuario.rol !== 'admin') return;
  const id = texto(datos, 'id');
  const producto = texto(datos, 'producto_id');
  /* Una tarifa de NACIONALES se guarda en colones y deja los dólares en null;
     una normal al revés. Mandar las dos monedas dejaría dos precios
     compitiendo, y la base lo rechaza con un check — mejor decidirlo acá y que
     el formulario no pueda armar algo imposible. */
  const esNacional = texto(datos, 'residencia') === 'nacional';
  const fila = {
    nombre: texto(datos, 'nombre') || 'General',
    residencia: esNacional ? 'nacional' : 'todos',
    precio_publico_usd: esNacional ? null : numero(datos, 'precio_publico_usd'),
    precio_neto_usd: esNacional ? null : numero(datos, 'precio_neto_usd'),
    precio_publico_crc: esNacional ? numero(datos, 'precio_publico_crc') : null,
    precio_neto_crc: esNacional ? numero(datos, 'precio_neto_crc') : null,
    moneda: esNacional ? 'CRC' : 'USD',
    es_para: texto(datos, 'es_para') || 'general',
    verificada: esSi(datos, 'verificada'),
    fuente: texto(datos, 'fuente') || null,
    vigencia_desde: texto(datos, 'vigencia_desde') || null,
    vigencia_hasta: texto(datos, 'vigencia_hasta') || null,
    esta_activa: esSi(datos, 'esta_activa'),
  };

  const { error } = esUuid(id)
    ? await db.from('dst_tarifa').update(fila).eq('id', id)
    : esUuid(producto)
      ? await db.from('dst_tarifa').insert({ ...fila, producto_id: producto })
      : { error: null };
  if (error) console.error('guardarTarifa:', error.message);
  refrescar();
}

export async function borrarTarifa(datos: FormData) {
  const { db, usuario } = await contextoPanel('operadores');
  if (usuario.rol !== 'admin') return;
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;
  await db.from('dst_tarifa').delete().eq('id', id);
  refrescar();
}

/*
 * El contrato firmado y el tarifario viven en un bucket PRIVADO: traen IBANs y
 * las tarifas netas negociadas. Por eso no hay url pública que guardar — lo
 * que se guarda es la RUTA, y para mirarlo se pide una url firmada que caduca.
 *
 * Diez minutos alcanzan para abrirlo y no para que el enlace sirva reenviado.
 */
export async function verElContrato(ruta: string): Promise<{ url?: string; error?: string }> {
  const { db, usuario } = await contextoPanel('operadores');
  if (usuario.rol !== 'admin') return { error: 'Solo un administrador.' };
  if (!ruta || ruta.startsWith('http')) return { error: 'Esa no es una ruta del archivero.' };

  const { data, error } = await db.storage.from('contratos').createSignedUrl(ruta, 600);
  if (error || !data) return { error: error?.message ?? 'No se pudo abrir.' };
  return { url: data.signedUrl };
}

/** Borrar el archivo del archivero. El campo del contrato lo limpia el formulario. */
export async function borrarElContrato(ruta: string): Promise<{ ok?: boolean; error?: string }> {
  const { db, usuario } = await contextoPanel('operadores');
  if (usuario.rol !== 'admin') return { error: 'Solo un administrador.' };
  if (!ruta || ruta.startsWith('http')) return { error: 'Esa no es una ruta del archivero.' };

  const { error } = await db.storage.from('contratos').remove([ruta]);
  if (error) return { error: error.message };
  return { ok: true };
}

/*
 * Los complementos: lo que se AÑADE a un pase y nunca se vende solo.
 *
 * El Wellness Upgrade de Paradise es el caso. Las reglas —solo adultos, horas
 * de antelación, tope por reserva— las hace cumplir `pedir_reserva`; acá solo
 * se escriben. Por eso el formulario explica qué hace cada una: un número
 * suelto en «antelación» no le dice nada a quien lo llena dentro de un año.
 */
export async function guardarComplemento(datos: FormData) {
  const { db, destino, usuario } = await contextoPanel('operadores');
  if (usuario.rol !== 'admin') return;

  const id = texto(datos, 'id');
  const negocio = texto(datos, 'negocio_id');
  const nombre = texto(datos, 'nombre');
  if (!nombre) return;

  const fila = {
    nombre,
    descripcion: texto(datos, 'descripcion') || null,
    precio_publico_usd: numero(datos, 'precio_publico_usd') ?? 0,
    precio_neto_usd: numero(datos, 'precio_neto_usd'),
    solo_adultos: esSi(datos, 'solo_adultos'),
    horas_antelacion: numero(datos, 'horas_antelacion') ?? 0,
    maximo_por_reserva: numero(datos, 'maximo_por_reserva'),
    esta_activo: esSi(datos, 'esta_activo'),
    actualizado_en: new Date().toISOString(),
  };

  const { error } = esUuid(id)
    ? await db.from('dst_complemento').update(fila).eq('id', id)
    : esUuid(negocio)
      ? await db.from('dst_complemento').insert({ ...fila, negocio_id: negocio, destino_id: destino.id })
      : { error: null };
  if (error) console.error('guardarComplemento:', error.message);
  refrescar();
}
