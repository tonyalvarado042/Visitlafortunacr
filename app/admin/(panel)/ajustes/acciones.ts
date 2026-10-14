'use server';

import { revalidatePath } from 'next/cache';
import { contextoPanel } from '@/lib/admin/contexto';

export type Estado = { ok?: string | null; error?: string | null };

const esUuid = (v: unknown) => /^[0-9a-f-]{36}$/i.test(String(v ?? ''));
const texto = (d: FormData, k: string) => String(d.get(k) ?? '').trim();
const numero = (d: FormData, k: string) => { const v = texto(d, k); return v === '' ? null : Number(v); };
const color = (d: FormData, k: string) => (/^#[0-9a-f]{6}$/i.test(texto(d, k)) ? texto(d, k).toUpperCase() : undefined);

/**
 * Guarda una parte de la fila del destino.
 *
 * Ajustes tiene TRES formularios que llaman a esta misma accion, y una casilla
 * sin marcar NO viaja en el FormData: es indistinguible de un campo que ese
 * formulario no tiene. Sin el grupo, guardar la oferta premium APAGABA el sitio
 * — esta_activo pasaba a false por ausencia — y guardar el destino borraba el
 * precio del premium. Cada formulario declara lo que le toca, y solo eso se
 * escribe: el que no manda un campo no lo pisa.
 */
export async function editarDestino(datos: FormData) {
  const { db, destino, usuario } = await contextoPanel('ajustes');
  if (usuario.rol !== 'admin') return;

  const grupo = texto(datos, 'grupo');
  let campos: Record<string, unknown>;

  if (grupo === 'premium') {
    /* La oferta premium. El precio cambia seguido y es suyo: se edita aca y
       no en el codigo, para no desplegar por bajar $100. */
    campos = {
      premium_activo: texto(datos, 'premium_activo') === '1',
      premium_titulo: texto(datos, 'premium_titulo') || null,
      premium_gancho: texto(datos, 'premium_gancho') || null,
      premium_precio_usd: numero(datos, 'premium_precio_usd'),
      premium_precio_antes: numero(datos, 'premium_precio_antes'),
      premium_cupos: numero(datos, 'premium_cupos'),
      premium_ejemplo_babosa: texto(datos, 'premium_ejemplo_babosa') || null,
      premium_incluye: texto(datos, 'premium_incluye')
        .split('\n').map((l) => l.trim()).filter(Boolean),
    };
  } else if (grupo === 'menu') {
    /* El destacado del mega menu viaja como "tipo:babosa" en UN solo campo.
       Dos selectores separados se pueden desincronizar — tipo 'negocio' con la
       babosa de una experiencia — y eso no da error: deja el menu sin tarjeta
       y nadie entiende por que. Asi no hay combinacion imposible que guardar. */
    const [tipo, ...resto] = texto(datos, 'menu_destacado').split(':');
    const babosa = resto.join(':').toLowerCase().replace(/[^a-z0-9-]/g, '');
    const vale = ['experiencia', 'negocio'].includes(tipo) && babosa !== '';
    campos = {
      menu_destacado_tipo: vale ? tipo : 'ninguno',
      menu_destacado_babosa: vale ? babosa : null,
    };
  } else if (grupo === 'reservas') {
    /* El interruptor maestro del motor de reservas, y el candado de la
       pasarela. Van en su propio grupo porque encender uno no puede
       encender el otro por accidente: el primero muestra el modulo, el
       segundo habilita cobrarle a una persona. */
    campos = {
      reservas_activas: texto(datos, 'reservas_activas') === '1',
      descuento_lanzamiento_pct: numero(datos, 'descuento_lanzamiento_pct'),
      descuento_lanzamiento_hasta: texto(datos, 'descuento_lanzamiento_hasta') || null,
      pasarela_lista: texto(datos, 'pasarela_lista') === '1',
      /* El tipo de cambio de las tarifas en colones. Si se deja vacío, las
         tarifas nacionales NO se muestran: sin tipo de cambio no se inventa un
         precio. Se guarda la fecha para saber qué tan viejo está. */
      tipo_cambio_crc: numero(datos, 'tipo_cambio_crc'),
      tipo_cambio_piso: numero(datos, 'tipo_cambio_piso') ?? 550,
      tipo_cambio_en: numero(datos, 'tipo_cambio_crc') != null ? new Date().toISOString() : null,
    };
  } else if (grupo === 'destino') {
    const whatsapp = texto(datos, 'whatsapp').replace(/[\s\-().]/g, '');
    campos = {
      nombre: texto(datos, 'nombre') || undefined,
      nombre_largo: texto(datos, 'nombre_largo') || null,
      region: texto(datos, 'region') || null,
      lema: texto(datos, 'lema') || null,
      marca_nombre: texto(datos, 'marca_nombre') || undefined,
      marca_sigla: texto(datos, 'marca_sigla') || null,
      whatsapp: whatsapp ? (whatsapp.startsWith('+') ? whatsapp : `+${whatsapp}`) : null,
      email_contacto: texto(datos, 'email_contacto').toLowerCase() || null,
      comision_por_defecto: numero(datos, 'comision_por_defecto'),
      color_tinta: color(datos, 'color_tinta'),
      color_acento: color(datos, 'color_acento'),
      color_naturaleza: color(datos, 'color_naturaleza'),
      color_gris: color(datos, 'color_gris'),
      logo_url: texto(datos, 'logo_url') || null,
      video_portada_url: texto(datos, 'video_portada_url') || null,
      imagen_portada_url: texto(datos, 'imagen_portada_url') || null,
      pie_credito_texto: texto(datos, 'pie_credito_texto') || null,
      /* Solo http y https. Este enlace lo ve TODO el publico en cada pagina, asi
         que un javascript: aqui seria un agujero abierto de par en par. Lo que no
         pase el filtro se guarda vacio y el pie muestra el texto sin enlace. */
      pie_credito_url: /^https?:\/\/\S+$/i.test(texto(datos, 'pie_credito_url'))
        ? texto(datos, 'pie_credito_url')
        : null,
      chat_activo: texto(datos, 'chat_activo') === '1',
      /* El tema pinta TODO el sitio publico. Lo que no sea uno de los dos se
         cae a claro en vez de guardarse: la base tiene un check y rebotaria
         sin explicacion. */
      tema: texto(datos, 'tema') === 'oscuro' ? 'oscuro' : 'claro',
      barra_oscura: texto(datos, 'barra_oscura') === '1',
      contacto_bloqueado: texto(datos, 'contacto_bloqueado') === '1',
      combina_automatico: texto(datos, 'combina_automatico') === '1',
      esta_activo: texto(datos, 'esta_activo') === '1',
    };
  } else {
    /* Un formulario sin grupo no se guarda a medias: se cae a la vista. */
    console.error('editarDestino: formulario sin grupo');
    return;
  }

  const { error } = await db.from('dst_destino').update(campos).eq('id', destino.id);
  if (error) console.error('editarDestino:', error.message);
  revalidatePath('/admin', 'layout');
}

export async function guardarCanal(datos: FormData) {
  const { db, destino, usuario } = await contextoPanel('ajustes');
  if (usuario.rol !== 'admin') return;
  const id = texto(datos, 'id');
  const tipo = texto(datos, 'tipo');
  const proveedor = texto(datos, 'proveedor');
  if (!['whatsapp', 'email', 'web'].includes(tipo) || !['meta', 'resend', 'smtp', 'web', 'manual'].includes(proveedor)) return;
  const fila = {
    destino_id: destino.id, tipo, proveedor,
    identificador: texto(datos, 'identificador') || null,
    nombre_visible: texto(datos, 'nombre_visible') || null,
    variable_secreto: texto(datos, 'variable_secreto').replace(/[^A-Z0-9_]/g, '') || null,
    esta_activo: texto(datos, 'esta_activo') === '1',
  };
  const { error } = esUuid(id)
    ? await db.from('dst_canal').update(fila).eq('id', id).eq('destino_id', destino.id)
    : await db.from('dst_canal').upsert(fila, { onConflict: 'destino_id,tipo,proveedor' });
  if (error) console.error('guardarCanal:', error.message);
  revalidatePath('/admin/ajustes');
}

export async function eliminarCanal(datos: FormData) {
  const { db, destino, usuario } = await contextoPanel('ajustes');
  if (usuario.rol !== 'admin') return;
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;
  await db.from('dst_canal').delete().eq('id', id).eq('destino_id', destino.id);
  revalidatePath('/admin/ajustes');
}

/** El "un clic": crea un destino nuevo con sus categorías, agentes, plantillas y automatizaciones. */
export async function lanzarDestino(_previo: Estado, datos: FormData): Promise<Estado> {
  const { db, usuario } = await contextoPanel('ajustes');
  if (usuario.rol !== 'admin') return { error: 'Solo un administrador puede lanzar destinos.' };
  const babosa = texto(datos, 'babosa').toLowerCase().replace(/[^a-z0-9-]/g, '');
  const nombre = texto(datos, 'nombre');
  const dominio = texto(datos, 'dominio').toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!babosa || !nombre || !dominio.includes('.')) return { error: 'Babosa, nombre y dominio son obligatorios.' };
  const idiomas = datos.getAll('idiomas').map(String).filter((i) => ['es', 'en', 'pt', 'fr', 'de'].includes(i));
  const { data, error } = await db.rpc('lanzar_destino', {
    p_babosa: babosa,
    p_nombre: nombre,
    p_dominio: dominio,
    p_pais_iso: (texto(datos, 'pais_iso') || 'CR').toUpperCase().slice(0, 2),
    p_pais_nombre: texto(datos, 'pais_nombre') || 'Costa Rica',
    p_zona_horaria: texto(datos, 'zona_horaria') || 'America/Costa_Rica',
    p_marca_nombre: texto(datos, 'marca_nombre') || `Visit ${nombre}`,
    p_marca_sigla: texto(datos, 'marca_sigla') || null,
    p_moneda_iso: (texto(datos, 'moneda_iso') || 'CRC').toUpperCase().slice(0, 3),
    p_nombre_largo: texto(datos, 'nombre_largo') || null,
    p_region: texto(datos, 'region') || null,
    p_lema_es: texto(datos, 'lema_es') || null,
    p_lema_en: texto(datos, 'lema_en') || null,
    p_idiomas: idiomas.length ? idiomas : ['es', 'en'],
  });
  if (error) return { error: error.message };
  revalidatePath('/admin', 'layout');
  return { ok: `Destino creado (${String(data).slice(0, 8)}…). Nace apagado: cargá contenido, elegilo arriba a la izquierda y encendelo desde Ajustes.` };
}

/* ---------------------------------------------------------------------------
 * Cupones.
 *
 * El código se guarda en MAYÚSCULAS y se compara en mayúsculas: quien lo
 * escribe en el teléfono lo va a escribir como le salga, y un cupón que no
 * funciona por una minúscula es una venta perdida y un correo de reclamo.
 * ------------------------------------------------------------------------ */

export async function crearCupon(datos: FormData) {
  const { db, destino, usuario } = await contextoPanel('ajustes');
  if (usuario.rol !== 'admin') return;

  const codigo = texto(datos, 'codigo').toUpperCase().replace(/\s+/g, '');
  const valor = numero(datos, 'valor');
  const tipo = texto(datos, 'tipo_descuento') === 'monto' ? 'monto' : 'porcentaje';
  if (codigo.length < 3 || valor === null || valor <= 0) return;
  if (tipo === 'porcentaje' && valor > 100) return;

  const { error } = await db.from('dst_cupon').insert({
    destino_id: destino.id,
    codigo,
    descripcion: texto(datos, 'descripcion') || null,
    tipo_descuento: tipo,
    valor,
    minimo_usd: numero(datos, 'minimo_usd'),
    vale_desde: texto(datos, 'vale_desde') || null,
    vale_hasta: texto(datos, 'vale_hasta') || null,
    usos_maximos: numero(datos, 'usos_maximos'),
  });
  // 23505 es la unique del código: ya existe, y eso no es un error que contar.
  if (error && error.code !== '23505') console.error('crearCupon:', error.message);
  revalidatePath('/admin/ajustes');
}

/*
 * Prender o apagar. NO se borra: un cupón usado está enganchado a reservas por
 * `dst_reserva.cupon_id`, y borrarlo dejaría esas reservas sin saber por qué
 * cobraron de menos.
 */
export async function prenderCupon(datos: FormData) {
  const { db, destino, usuario } = await contextoPanel('ajustes');
  if (usuario.rol !== 'admin') return;
  const id = texto(datos, 'cupon_id');
  const prender = texto(datos, 'prender') === '1';
  if (!esUuid(id)) return;

  const { error } = await db.from('dst_cupon')
    .update({ esta_activo: prender }).eq('id', id).eq('destino_id', destino.id);
  if (error) console.error('prenderCupon:', error.message);
  revalidatePath('/admin/ajustes');
}

/*
 * Elegir cuál cupón se le ofrece a quien está por irse sin reservar.
 *
 * Solo UNO por destino, y la base lo exige con un índice único. Por eso acá se
 * apagan todos antes de prender el elegido: sin eso, marcar un segundo cupón
 * reventaría con un error de llave duplicada que no le dice nada a nadie.
 *
 * Dos ventanas peleando por la misma salida es, además, la forma más rápida de
 * que la gente cierre las dos.
 */
export async function cuponDeSalida(datos: FormData) {
  const { db, destino, usuario } = await contextoPanel('ajustes');
  if (usuario.rol !== 'admin') return;

  const id = String(datos.get('cupon_id') ?? '');
  const prender = String(datos.get('prender') ?? '') === '1';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;

  /* Siempre se apagan todos primero: así «prender» y «cambiar de cupón» son la
     misma operación y no hay estado intermedio con dos marcados. */
  const { error: eApagar } = await db.from('dst_cupon')
    .update({ mostrar_al_salir: false })
    .eq('destino_id', destino.id)
    .eq('mostrar_al_salir', true);
  if (eApagar) { console.error('cuponDeSalida, al apagar:', eApagar.message); return; }

  if (prender) {
    const { error } = await db.from('dst_cupon')
      .update({ mostrar_al_salir: true })
      .eq('id', id).eq('destino_id', destino.id);
    if (error) console.error('cuponDeSalida:', error.message);
  }
  revalidatePath('/admin/ajustes');
}

/** El gancho: la frase que encabeza la ventana. */
export async function guardarGanchoCupon(datos: FormData) {
  const { db, destino, usuario } = await contextoPanel('ajustes');
  if (usuario.rol !== 'admin') return;
  const id = String(datos.get('cupon_id') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;

  const { error } = await db.from('dst_cupon')
    .update({ gancho: String(datos.get('gancho') ?? '').trim() || null })
    .eq('id', id).eq('destino_id', destino.id);
  if (error) console.error('guardarGanchoCupon:', error.message);
  revalidatePath('/admin/ajustes');
}
