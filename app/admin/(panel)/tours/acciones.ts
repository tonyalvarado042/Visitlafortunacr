'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { contextoPanel } from '@/lib/admin/contexto';
import { babosaDe } from '@/lib/admin/babosa';
import { MINIMO_FOTOS_TOUR } from '@/lib/comercio';

const esUuid = (v: unknown) => /^[0-9a-f-]{36}$/i.test(String(v ?? ''));
const texto = (d: FormData, k: string) => String(d.get(k) ?? '').trim();
const numero = (d: FormData, k: string) => { const v = texto(d, k); return v === '' ? null : Number(v); };

export async function crearTour(datos: FormData) {
  const { db, destino } = await contextoPanel('tours');
  const nombre = texto(datos, 'nombre');
  if (!nombre) return;
  let babosa = babosaDe(nombre) || 'tour';
  const { data: repetido } = await db.from('dst_tour').select('id').eq('destino_id', destino.id).eq('babosa', babosa).maybeSingle();
  if (repetido) babosa = `${babosa}-${Math.random().toString(36).slice(2, 6)}`;
  const { data, error } = await db.from('dst_tour').insert({
    destino_id: destino.id, nombre, babosa,
    negocio_id: esUuid(texto(datos, 'negocio_id')) ? texto(datos, 'negocio_id') : null,
    categoria_id: esUuid(texto(datos, 'categoria_id')) ? texto(datos, 'categoria_id') : null,
    precio_adulto_usd: numero(datos, 'precio_adulto_usd') ?? 0,
    comision_pct: numero(datos, 'comision_pct') ?? destino.comision_por_defecto ?? null,
    estado: 'borrador',
  }).select('id').single();
  if (error || !data) { console.error('crearTour:', error?.message); return; }
  revalidatePath('/admin/tours');
  redirect(`/admin/tours/${data.id}`);
}

export async function editarTour(datos: FormData) {
  const { db, destino } = await contextoPanel('tours');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;
  const { data: antes } = await db.from('dst_tour').select('estado, publicado_en').eq('id', id).eq('destino_id', destino.id).maybeSingle();
  if (!antes) return;
  const estado = texto(datos, 'estado');
  const { error } = await db.from('dst_tour').update({
    nombre: texto(datos, 'nombre') || undefined,
    negocio_id: esUuid(texto(datos, 'negocio_id')) ? texto(datos, 'negocio_id') : null,
    categoria_id: esUuid(texto(datos, 'categoria_id')) ? texto(datos, 'categoria_id') : null,
    /* El contrato es lo que vuelve vendible la tour. Si el formulario no trae
       el campo —porque la tour todavia no tiene operador y el selector no se
       dibujo— se deja como estaba: `undefined` no toca la columna, y un null
       ahi le quitaria la venta a una tour por no haber mostrado un campo. */
    contrato_id: datos.has('contrato_id')
      ? (esUuid(texto(datos, 'contrato_id')) ? texto(datos, 'contrato_id') : null)
      : undefined,
    resumen: texto(datos, 'resumen') || null,
    descripcion: texto(datos, 'descripcion') || null,
    incluye: texto(datos, 'incluye') || null,
    no_incluye: texto(datos, 'no_incluye') || null,
    que_llevar: texto(datos, 'que_llevar') || null,
    duracion_horas: numero(datos, 'duracion_horas'),
    hora_inicio: texto(datos, 'hora_inicio') || null,
    dificultad: texto(datos, 'dificultad') || null,
    edad_minima: numero(datos, 'edad_minima'),
    cupo_maximo: numero(datos, 'cupo_maximo'),
    recoge_en_hotel: texto(datos, 'recoge_en_hotel') === '1',
    idiomas_guia: texto(datos, 'idiomas_guia').split(',').map((i) => i.trim().toLowerCase()).filter(Boolean),
    precio_adulto_usd: numero(datos, 'precio_adulto_usd') ?? 0,
    precio_nino_usd: numero(datos, 'precio_nino_usd'),
    precio_neto_usd: numero(datos, 'precio_neto_usd'),
    comision_pct: numero(datos, 'comision_pct'),
    cancelacion_libre_horas: numero(datos, 'cancelacion_libre_horas'),
    imagen_url: texto(datos, 'imagen_url') || null,
    precio_nota: texto(datos, 'precio_nota') || null,
    /* El video del tour. Hasta noviembre de 2026 solo los negocios tenian uno;
       la pagina del tour ahora lo muestra con el mismo componente. */
    video_url: texto(datos, 'video_url') || null,
    video_portada_url: texto(datos, 'video_portada_url') || null,
    es_destacado: texto(datos, 'es_destacado') === '1',
    estado: ['borrador', 'pendiente', 'publicado', 'archivado'].includes(estado) ? estado : antes.estado,
    publicado_en: estado === 'publicado' && !antes.publicado_en ? new Date().toISOString() : antes.publicado_en,
  }).eq('id', id);
  if (error) console.error('editarTour:', error.message);
  revalidatePath(`/admin/tours/${id}`);
  revalidatePath('/admin/tours');
}

/* ---- Las fotos del tour ---------------------------------------------------
 *
 * Calco de las de `negocios/acciones.ts`, a propósito. Un tour tenía UNA foto
 * (`dst_tour.imagen_url`) y nada más, cuando el tour es justo lo que se vende
 * —y lo único que publica un operador—. Quien está decidiendo si paga $99 por
 * una clase de cocina quiere ver más de una.
 *
 * Suben con la sesión del usuario y no con la clave de servicio: la política
 * de storage mira el PRIMER segmento de la ruta —la babosa del destino— y con
 * eso decide. Por eso la ruta es <destino>/<negocio>/tours/<archivo>, la misma
 * carpeta donde ya subía el dueño desde su portal.
 */

const BUCKET_TOURS = 'negocios';
const ANCHO_MAX_TOUR = 1600;

/**
 * El tour, si es de este destino. Devuelve también la babosa del operador,
 * que es la que arma la carpeta donde van las fotos.
 */
async function tourConOperador(
  db: Awaited<ReturnType<typeof contextoPanel>>['db'],
  destinoId: string,
  tourId: string,
) {
  const { data: t } = await db.from('dst_tour')
    .select('id, nombre, negocio_id').eq('id', tourId).eq('destino_id', destinoId).maybeSingle();
  if (!t?.negocio_id) return null;
  const { data: n } = await db.from('dst_negocio')
    .select('babosa').eq('id', t.negocio_id).maybeSingle();
  if (!n?.babosa) return null;
  return { id: t.id as string, nombre: t.nombre as string, operadorBabosa: n.babosa as string };
}

function refrescarTour(id: string) {
  revalidatePath(`/admin/tours/${id}`);
  revalidatePath('/admin/tours');
}

/** Sube UNA O VARIAS de un saque. No se corta en la primera que falle. */
export async function subirFotoTour(datos: FormData) {
  const { db, destino } = await contextoPanel('tours');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;

  const archivos = datos.getAll('archivo').filter((a): a is File => a instanceof File && a.size > 0);
  if (!archivos.length) return;

  const t = await tourConOperador(db, destino.id, id);
  /* Sin operador no hay carpeta donde ponerlas: la ruta se arma con su babosa.
     La pantalla ya lo dice y no ofrece el botón, pero un formulario se puede
     mandar a mano. */
  if (!t) return;

  const credito = texto(datos, 'credito') || null;
  const licencia = texto(datos, 'licencia') || null;
  const fuente = texto(datos, 'fuente_url') || null;
  /* Una foto ajena tiene que decir de quién es y bajo qué licencia. */
  if (fuente && (!credito || !licencia)) return;

  const alternativo = texto(datos, 'texto_alternativo') || t.nombre;

  /* El contador arranca del total que YA hay: si no, las de la misma tanda
     nacerían todas con el mismo `orden` y la galería las mostraría en
     cualquier lado. */
  const { count } = await db.from('dst_tour_foto')
    .select('id', { count: 'exact', head: true }).eq('tour_id', id);
  let siguiente = count ?? 0;

  const sharp = (await import('sharp')).default;

  for (const archivo of archivos) {
    try {
      const webp = await sharp(Buffer.from(await archivo.arrayBuffer()))
        .rotate()
        .resize({ width: ANCHO_MAX_TOUR, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();

      const base = archivo.name.replace(/\.[^.]+$/, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').slice(0, 60) || 'foto';
      const ruta = `${destino.babosa}/${t.operadorBabosa}/tours/${base}-${Date.now().toString(36)}-${siguiente}.webp`;

      const { error: eSubida } = await db.storage.from(BUCKET_TOURS)
        .upload(ruta, webp, { contentType: 'image/webp' });
      if (eSubida) throw new Error(eSubida.message);

      const { data: publica } = db.storage.from(BUCKET_TOURS).getPublicUrl(ruta);
      const { error } = await db.from('dst_tour_foto').insert({
        tour_id: id,
        url: publica.publicUrl,
        orden: siguiente,
        es_portada: siguiente === 0,
        credito, licencia, fuente_url: fuente,
        texto_alternativo_es: alternativo,
        texto_alternativo_en: alternativo,
      });
      if (error) throw new Error(error.message);

      siguiente += 1;
    } catch (fallo) {
      /* La que falle no se lleva a las demás. */
      console.error('subirFotoTour:', archivo.name, fallo instanceof Error ? fallo.message : fallo);
    }
  }

  refrescarTour(id);
}

export async function marcarPortadaTour(datos: FormData) {
  const { db, destino } = await contextoPanel('tours');
  const id = texto(datos, 'id');
  const fotoId = texto(datos, 'foto_id');
  if (!esUuid(id) || !esUuid(fotoId)) return;
  if (!(await tourConOperador(db, destino.id, id))) return;

  /* Primero se apaga la anterior: `uq_dst_tour_foto_portada` no deja dos. */
  await db.from('dst_tour_foto').update({ es_portada: false }).eq('tour_id', id).eq('es_portada', true);
  const { error } = await db.from('dst_tour_foto').update({ es_portada: true }).eq('id', fotoId).eq('tour_id', id);
  if (error) console.error('marcarPortadaTour:', error.message);
  refrescarTour(id);
}

export async function moverFotoTour(datos: FormData) {
  const { db, destino } = await contextoPanel('tours');
  const id = texto(datos, 'id');
  /* El id y el paso viajan JUNTOS en el value del botón: un botón manda un
     solo par nombre/valor, así que un campo `paso` suelto valdría lo mismo
     para subir que para bajar. */
  const [fotoId, pasoTexto] = texto(datos, 'foto_mover').split('|');
  const paso = Number(pasoTexto);
  if (!esUuid(id) || !esUuid(fotoId) || (paso !== 1 && paso !== -1)) return;
  if (!(await tourConOperador(db, destino.id, id))) return;

  const { data: todas } = await db.from('dst_tour_foto')
    .select('id, orden').eq('tour_id', id).order('orden');
  const lista = todas ?? [];
  const i = lista.findIndex((f) => f.id === fotoId);
  if (i < 0) return;
  const j = i + paso;
  if (j < 0 || j >= lista.length) return;

  /* Se reescriben los dos órdenes y no se intercambian: si dos filas quedaron
     con el mismo `orden` —y pueden— intercambiar no mueve nada y el botón
     parece roto. */
  await db.from('dst_tour_foto').update({ orden: j }).eq('id', lista[i].id).eq('tour_id', id);
  await db.from('dst_tour_foto').update({ orden: i }).eq('id', lista[j].id).eq('tour_id', id);
  refrescarTour(id);
}

export async function borrarFotoTour(datos: FormData) {
  const { db, destino } = await contextoPanel('tours');
  const id = texto(datos, 'id');
  const fotoId = texto(datos, 'foto_id');
  if (!esUuid(id) || !esUuid(fotoId)) return;
  if (!(await tourConOperador(db, destino.id, id))) return;

  const { data: foto } = await db.from('dst_tour_foto')
    .select('id, url').eq('id', fotoId).eq('tour_id', id).maybeSingle();
  if (!foto) return;

  /* Se borra también del almacén. Dejarla ahí es pagar por una foto que ya
     nadie muestra, y a los seis meses nadie sabe cuáles sobran. */
  const marca = `/object/public/${BUCKET_TOURS}/`;
  const corte = (foto.url as string).indexOf(marca);
  if (corte !== -1) await db.storage.from(BUCKET_TOURS).remove([(foto.url as string).slice(corte + marca.length)]);

  const { error } = await db.from('dst_tour_foto').delete().eq('id', fotoId).eq('tour_id', id);
  if (error) console.error('borrarFotoTour:', error.message);
  refrescarTour(id);
}

/**
 * Le pide al operador que complete ESTE tour: fotos, descripción, precio.
 *
 * Lo pidió Tony así: *«un botón donde solicitar más info, fotos del tour al
 * operador… pero el link lo debe llevar a la página de administración del
 * tour o de una vez a subir fotos»*. Por eso el correo apunta a
 * `/negocio/<negocio>/tours/<tour>` y no a la raíz de su cuenta: mandarlo a
 * buscar cuál de sus cuatro tours es, es como se pierde a alguien que estaba
 * dispuesto a hacerlo.
 *
 * ⚠️ NO MANDA NADA SOLO. Lo dispara alguien del equipo desde la pantalla del
 * tour.
 *
 * Calcula lo que falta EN EL MOMENTO del envío y no confía en lo que diga la
 * pantalla: entre que se pintó y que se tocó el botón, el operador pudo haber
 * subido las fotos. Pedirle lo que ya hizo es la forma más rápida de que el
 * próximo correo no se abra.
 */
export async function pedirCompletarTour(datos: FormData) {
  const { db, destino } = await contextoPanel('tours');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;

  const { data: t } = await db.from('dst_tour')
    .select('id, nombre, negocio_id, descripcion, precio_adulto_usd')
    .eq('id', id).eq('destino_id', destino.id).maybeSingle();
  if (!t?.negocio_id) return;

  const { data: n } = await db.from('dst_negocio')
    .select('id, email').eq('id', t.negocio_id).maybeSingle();
  /* Sin correo no hay a quién escribirle. La pantalla ya no ofrece el botón
     en ese caso, pero un formulario se puede mandar a mano. */
  if (!n?.email) return;

  const { count: fotos } = await db.from('dst_tour_foto')
    .select('id', { count: 'exact', head: true }).eq('tour_id', id);

  /* ⚠️ No es «cero fotos», es «menos de las que necesita». Lo tenía en cero y
     Tony lo cachó: los dos tours de Jacamar están publicados con UNA foto
     cada uno, y con el chequeo en cero el sistema decía «no falta nada» y no
     ofrecía pedírselas. Una foto no es una galería. */
  const cuantasFotos = fotos ?? 0;
  const faltanFotos = cuantasFotos < MINIMO_FOTOS_TOUR;
  const faltaDescripcion = !String(t.descripcion ?? '').trim();
  const faltaPrecio = !(Number(t.precio_adulto_usd) > 0);
  /* Si no falta nada, no se manda: un correo que dice «te falta» cuando no
     falta nada quema la confianza del operador en todos los que vengan. */
  if (!faltanFotos && !faltaDescripcion && !faltaPrecio) return;

  /* El correo necesita la fila ENTERA del destino y `contextoPanel` solo da
     el resumen del panel. Se comprueba que sea el mismo: `destinoActual()`
     resuelve por el Host, y el día que haya dos destinos alguien parado en el
     panel de uno con el navegador en el dominio del otro mandaría el correo
     con la marca equivocada. */
  const { destinoActual } = await import('@/lib/destino');
  const completo = await destinoActual();
  if (completo.id !== destino.id) {
    console.error('pedirCompletarTour: el destino del panel y el del dominio no calzan; no se manda.');
    return;
  }

  const { correoFaltaCompletarTour } = await import('@/lib/correo/cartas');
  const envio = await correoFaltaCompletarTour({
    destino: completo,
    /* En el idioma principal: `dst_negocio` no guarda el idioma del dueño
       (ver la nota en negocios/acciones.ts). */
    idioma: completo.idioma_principal,
    para: n.email,
    negocioId: t.negocio_id,
    tourId: t.id,
    nombreTour: t.nombre,
    faltanFotos,
    /* Cuántas tiene, no solo si faltan: con eso el correo pide «más fotos» a
       quien ya subió una y «fotos» a quien no subió ninguna. Decirle «subí
       fotos» a alguien que ya puso una suena a que no miramos. */
    cuantasFotos,
    minimoFotos: MINIMO_FOTOS_TOUR,
    faltaDescripcion,
    faltaPrecio,
  });

  /* La fecha se anota SOLO si el correo salió. Anotarla igual haría que la
     pantalla dijera «ya se le pidió» de algo que nunca llegó, y entonces
     nadie volvería a pedirlo. El error queda en la bitácora de `dst_correo`. */
  if (envio.ok) {
    await db.from('dst_tour')
      .update({ completar_pedido_en: new Date().toISOString() })
      .eq('id', id).eq('destino_id', destino.id);
  } else {
    console.error('pedirCompletarTour:', envio.error);
  }
  refrescarTour(id);
}

/**
 * Le pide al operador que REVISE lo que ya está publicado y confirme las
 * tarifas: rack, neta y comisión.
 *
 * Lo pidió Tony así: *«a la par de ese botón otro al operador para que revise
 * la información pública además el tema de comisión tarifa rack y neta etc»*.
 *
 * El otro botón pide lo que FALTA. Este sirve cuando no falta nada: que mire
 * los números antes de que entre la primera reserva. Un operador que descubre
 * la comisión cuando le llega la liquidación se enoja con razón, y ese enojo
 * cuesta más que la comisión.
 *
 * ⚠️ NO MANDA NADA SOLO. Lo dispara alguien del equipo desde la pantalla del
 * tour.
 */
export async function pedirRevisionDeTour(datos: FormData) {
  const { db, destino } = await contextoPanel('tours');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;

  const { data: t } = await db.from('dst_tour')
    .select('id, nombre, negocio_id, estado, duracion_horas, precio_adulto_usd, precio_neto_usd, comision_pct')
    .eq('id', id).eq('destino_id', destino.id).maybeSingle();
  if (!t?.negocio_id) return;

  const { data: n } = await db.from('dst_negocio')
    .select('id, email').eq('id', t.negocio_id).maybeSingle();
  if (!n?.email) return;

  /* ⚠️ LAS TRES CIFRAS TIENEN QUE CUADRAR ANTES DE MANDARLAS.
     El correo le muestra rack, neto y comisión juntos. Si el neto no es el
     rack menos la comisión, el operador recibe tres números que se
     contradicen y lo que iba a dar confianza la quita. Hoy cuadran los seis
     tours; el día que alguien toque un precio y se olvide del otro campo,
     esto frena el correo en vez de mandar la contradicción.
     Medio punto de tolerancia porque los netos están redondeados a centavos
     (99.44 − 74.58 = 24.86, que es 25.0% justo, pero no todos caen tan
     redondo). La pantalla muestra el mismo aviso para que no sea un botón
     que no hace nada. */
  const rack = Number(t.precio_adulto_usd);
  const neto = t.precio_neto_usd != null ? Number(t.precio_neto_usd) : null;
  const comision = t.comision_pct != null ? Number(t.comision_pct) : null;
  if (rack > 0 && neto != null && comision != null) {
    const implicita = ((rack - neto) / rack) * 100;
    if (Math.abs(implicita - comision) > 0.5) {
      console.error(
        `pedirRevisionDeTour: no se manda, las cifras de «${t.nombre}» no cuadran — ` +
        `rack ${rack} menos neto ${neto} da ${implicita.toFixed(1)}% y el tour dice ${comision}%.`,
      );
      return;
    }
  }

  /* El correo necesita la fila ENTERA del destino; `contextoPanel` solo da el
     resumen. Misma comprobación que en `pedirCompletarTour`: el día que haya
     dos destinos, alguien en el panel de uno con el navegador en el dominio
     del otro mandaría el correo con la marca equivocada. */
  const { destinoActual } = await import('@/lib/destino');
  const completo = await destinoActual();
  if (completo.id !== destino.id) {
    console.error('pedirRevisionDeTour: el destino del panel y el del dominio no calzan; no se manda.');
    return;
  }

  const { correoRevisarTour } = await import('@/lib/correo/cartas');
  const envio = await correoRevisarTour({
    destino: completo,
    /* En el idioma principal: `dst_negocio` no guarda el idioma del dueño
       (ver la nota en negocios/acciones.ts). */
    idioma: completo.idioma_principal,
    para: n.email,
    negocioId: t.negocio_id,
    tourId: t.id,
    nombreTour: t.nombre,
    publicado: t.estado === 'publicado',
    duracionHoras: t.duracion_horas != null ? Number(t.duracion_horas) : null,
    rackUsd: rack > 0 ? rack : null,
    netoUsd: neto,
    comisionPct: comision,
  });

  /* La fecha se anota SOLO si el correo salió: si se anotara igual, la
     pantalla diría «ya se le pidió» de algo que nunca llegó y nadie volvería
     a pedirlo. El error queda en la bitácora de `dst_correo`. */
  if (envio.ok) {
    await db.from('dst_tour')
      .update({ revisar_pedido_en: new Date().toISOString() })
      .eq('id', id).eq('destino_id', destino.id);
  } else {
    console.error('pedirRevisionDeTour:', envio.error);
  }
  refrescarTour(id);
}
