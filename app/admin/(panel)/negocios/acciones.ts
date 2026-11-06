'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { contextoPanel } from '@/lib/admin/contexto';
import { babosaDe } from '@/lib/admin/babosa';
import { refrescarExternasDeNegocio, refrescarExternasPendientes } from '@/lib/externas';

const esUuid = (v: unknown) => /^[0-9a-f-]{36}$/i.test(String(v ?? ''));
const texto = (d: FormData, k: string) => String(d.get(k) ?? '').trim();
const numero = (d: FormData, k: string) => { const v = texto(d, k); return v === '' ? null : Number(v); };
const marca = (d: FormData, k: string) => texto(d, k) === '1';

function refrescar(id?: string) {
  if (id) revalidatePath(`/admin/negocios/${id}`);
  revalidatePath('/admin/negocios');
}

export async function crearNegocio(datos: FormData) {
  const { db, destino } = await contextoPanel('negocios');
  const nombre = texto(datos, 'nombre');
  const categoriaId = texto(datos, 'categoria_id');
  if (!nombre || !esUuid(categoriaId)) return;
  let babosa = babosaDe(nombre) || 'negocio';
  const { data: repetido } = await db.from('dst_negocio').select('id').eq('destino_id', destino.id).eq('babosa', babosa).maybeSingle();
  if (repetido) babosa = `${babosa}-${Math.random().toString(36).slice(2, 6)}`;

  const { data, error } = await db.from('dst_negocio').insert({
    destino_id: destino.id, categoria_id: categoriaId, nombre, babosa,
    estado_publicacion: 'borrador', estado_verificacion: 'pendiente', fuente_dato: 'equipo',
  }).select('id').single();
  if (error || !data) return;

  // Cada idioma del destino apunta a la misma babosa hasta que alguien la traduzca.
  await db.from('dst_ruta').insert(destino.idiomas.map((idioma) => ({ destino_id: destino.id, entidad: 'negocio', entidad_id: data.id, idioma, babosa })));
  refrescar();
  redirect(`/admin/negocios/${data.id}`);
}

export async function editarNegocio(datos: FormData) {
  const { db, destino } = await contextoPanel('negocios');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;
  const { data: antes } = await db.from('dst_negocio').select('estado_publicacion, publicado_en, estado_verificacion, verificado_en').eq('id', id).eq('destino_id', destino.id).maybeSingle();
  if (!antes) return;

  const publicacion = texto(datos, 'estado_publicacion');
  const verificacion = texto(datos, 'estado_verificacion');
  const membresia = texto(datos, 'membresia');
  const telefono = (k: string) => { const v = texto(datos, k).replace(/[\s\-().]/g, ''); return v ? (v.startsWith('+') ? v : `+${v}`) : null; };

  const { error } = await db.from('dst_negocio').update({
    nombre: texto(datos, 'nombre') || undefined,
    categoria_id: esUuid(texto(datos, 'categoria_id')) ? texto(datos, 'categoria_id') : undefined,
    resumen: texto(datos, 'resumen') || null,
    descripcion: texto(datos, 'descripcion') || null,
    email: texto(datos, 'email').toLowerCase() || null,
    telefono: telefono('telefono'),
    telefono_whatsapp: telefono('telefono_whatsapp'),
    sitio_web: texto(datos, 'sitio_web') || null,
    /* La base tiene un check: si no parece una URL de esa red, revienta al
       guardar en vez de dejar un enlace roto en la ficha publica. */
    facebook_url: texto(datos, 'facebook_url') || null,
    instagram_url: texto(datos, 'instagram_url') || null,
    direccion: texto(datos, 'direccion') || null,
    como_llegar: texto(datos, 'como_llegar') || null,
    latitud: numero(datos, 'latitud'),
    longitud: numero(datos, 'longitud'),
    rango_precio: ['economico', 'moderado', 'alto', 'lujo'].includes(texto(datos, 'rango_precio')) ? texto(datos, 'rango_precio') : null,
    precio_desde_usd: numero(datos, 'precio_desde_usd'),
    membresia: ['gratis', 'pro', 'destacado'].includes(membresia) ? membresia : 'gratis',
    membresia_hasta: membresia !== 'gratis' ? (texto(datos, 'membresia_hasta') || new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10)) : null,
    comision_pct: numero(datos, 'comision_pct'),
    contacto_comercial: texto(datos, 'contacto_comercial') || null,
    email_reservas: texto(datos, 'email_reservas').toLowerCase() || null,
    notas_internas: texto(datos, 'notas_internas') || null,
    google_place_id: texto(datos, 'google_place_id') || null,
    logo_url: texto(datos, 'logo_url') || null,
    estado_publicacion: ['borrador', 'pendiente', 'publicado', 'archivado'].includes(publicacion) ? publicacion : antes.estado_publicacion,
    publicado_en: publicacion === 'publicado' && !antes.publicado_en ? new Date().toISOString() : antes.publicado_en,
    estado_verificacion: ['pendiente', 'parcial', 'verificado', 'reclamado'].includes(verificacion) ? verificacion : antes.estado_verificacion,
    verificado_en: verificacion === 'verificado' && antes.estado_verificacion !== 'verificado' ? new Date().toISOString() : antes.verificado_en,
    es_destacado: marca(datos, 'es_destacado'),
    es_casa: marca(datos, 'es_casa'),
    es_operador: marca(datos, 'es_operador'),
    esta_cerrado: marca(datos, 'esta_cerrado'),
  }).eq('id', id);
  if (error) console.error('editarNegocio:', error.message);
  refrescar(id);
}

/*
 * Publicar de un clic. Antes habia que abrir el negocio, bajar por todo el
 * formulario de edicion, encontrar el desplegable `estado_publicacion`,
 * cambiarlo y guardar. Cinco negocios llevaban semanas esperando por eso.
 *
 * NO toca `estado_verificacion` a proposito: publicar es decir "esta ficha
 * sirve para el sitio"; verificar es decir "comprobamos que este señor es el
 * dueño". Son dos cosas y juntarlas haria que publicar afirme algo que nadie
 * comprobo. Quien quiera verificar lo hace aparte, en el formulario.
 *
 * Tampoco bloquea si falta la descripcion o las fotos: la pantalla lo avisa
 * ANTES, y a veces se publica igual a proposito (paso con Jalapas). La
 * decision es de quien aprueba, no del codigo.
 */
export async function publicarNegocio(datos: FormData) {
  const { db, destino } = await contextoPanel('negocios');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;

  const { data: antes } = await db.from('dst_negocio')
    .select('estado_publicacion, publicado_en')
    .eq('id', id).eq('destino_id', destino.id).maybeSingle();
  if (!antes || antes.estado_publicacion === 'publicado') return;

  const { error } = await db.from('dst_negocio').update({
    estado_publicacion: 'publicado',
    /* Si ya estuvo publicado antes se respeta la fecha vieja: `publicado_en`
       es "desde cuando existe para Google", no "cuando lo toque yo". */
    publicado_en: antes.publicado_en ?? new Date().toISOString(),
  }).eq('id', id).eq('destino_id', destino.id);

  if (error) console.error('publicarNegocio:', error.message);
  refrescar(id);
}

/**
 * Le pide al duenno que complete la ficha: la descripcion, las fotos, o las dos.
 *
 * EL AGUJERO QUE TAPA: hasta hoy el duenno recibia UN correo en toda su vida
 * —el de «recibimos tu negocio»— y despues nada. Si no completaba, nadie se lo
 * decia nunca. Publicar tampoco mandaba nada: `publicarNegocio` solo cambia el
 * estado. Asi quedo Dreamlike Adventures: inscrito, sin descripcion y sin una
 * sola foto, y nunca se le pidio.
 *
 * ⚠️ NO MANDA NADA SOLO. Lo dispara alguien del equipo desde la pantalla del
 * negocio. Un recordatorio automatico habria que pensarlo aparte y decidirlo,
 * no colarlo aca.
 *
 * Calcula lo que falta en el MOMENTO del envio y no confia en lo que diga la
 * pantalla: entre que se pinto y que se toco el boton, el duenno pudo haber
 * subido las fotos. Pedirle lo que ya hizo es la forma mas rapida de que el
 * proximo correo no se abra.
 */
export async function pedirCompletarFicha(datos: FormData) {
  const { db, destino } = await contextoPanel('negocios');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;

  const { data: n } = await db.from('dst_negocio')
    .select('id, nombre, email, descripcion')
    .eq('id', id).eq('destino_id', destino.id).maybeSingle();
  if (!n?.email) return;

  const { count } = await db.from('dst_negocio_foto')
    .select('id', { count: 'exact', head: true }).eq('negocio_id', id);

  const faltaDescripcion = !String(n.descripcion ?? '').trim();
  const faltanFotos = !count;
  /* Si no falta nada, no se manda: un correo que dice «te falta» cuando no
     falta nada quema la confianza del duenno en todos los que vengan. */
  if (!faltaDescripcion && !faltanFotos) return;

  /* El correo necesita la fila ENTERA del destino —marca, dominio, colores de
     la plantilla, el remitente—, y `contextoPanel` solo devuelve el resumen que
     usa el panel. `destinoActual()` la trae completa, igual que hace
     lib/aviso-resena.ts.
     ⚠️ La resuelve por el Host de la peticion, no por el destino elegido en el
     panel. Hoy da lo mismo —hay un solo destino y el panel se sirve desde su
     propio dominio— pero el dia que haya dos, alguien parado en el panel de
     Monteverde con el navegador en visitlafortunacr.com mandaria un correo con
     la marca equivocada. Por eso se comprueba y, si no calzan, no se manda. */
  const { destinoActual } = await import('@/lib/destino');
  const completo = await destinoActual();
  if (completo.id !== destino.id) {
    console.error('pedirCompletarFicha: el destino del panel y el del dominio no calzan; no se manda.');
    return;
  }

  const { correoFaltaCompletarFicha } = await import('@/lib/correo/cartas');
  const envio = await correoFaltaCompletarFicha({
    destino: completo,
    /* Va en el idioma principal porque NO SE SABE el del duenno: `dst_negocio`
       no guarda ninguno. El correo de bienvenida usa el idioma de la pagina
       donde se inscribio, y ese dato se pierde ahi mismo. Inventarle un idioma
       seria peor que el castellano, que en La Fortuna acierta casi siempre.
       Si algun dia se guarda al inscribirse, este es el lugar donde se usa. */
    idioma: completo.idioma_principal,
    para: n.email,
    negocioId: n.id,
    nombreNegocio: n.nombre,
    faltaDescripcion,
    faltanFotos,
  });

  /* La fecha se anota SOLO si el correo salio. Anotarla igual haria que la
     pantalla dijera «ya se le pidio» de algo que nunca llego, y entonces
     nadie volveria a pedirlo. El error queda en la bitacora de `dst_correo`. */
  if (envio.ok) {
    await db.from('dst_negocio')
      .update({ completar_pedido_en: new Date().toISOString() })
      .eq('id', id).eq('destino_id', destino.id);
  } else {
    console.error('pedirCompletarFicha:', envio.error);
  }
  refrescar(id);
}

/** Publicar y, en el mismo gesto, pedirle lo que falte. */
export async function publicarYPedirFicha(datos: FormData) {
  await publicarNegocio(datos);
  await pedirCompletarFicha(datos);
}

export async function traducirCampo(datos: FormData) {
  const { db } = await contextoPanel('negocios');
  const entidad = texto(datos, 'entidad');
  const entidadId = texto(datos, 'entidad_id');
  const campo = texto(datos, 'campo');
  const idioma = texto(datos, 'idioma');
  const valor = texto(datos, 'texto');
  /* 'razon' y 'combina' son hijas de un negocio: su panel es el del negocio y
     no tienen página propia, así que la vuelta se dice aparte. */
  const volverA = texto(datos, 'volver_a');
  if (!esUuid(entidadId) || !['negocio', 'tour', 'guia', 'razon', 'combina'].includes(entidad) || !campo || !idioma) return;
  if (!valor) {
    await db.from('dst_traduccion').delete().eq('entidad', entidad).eq('entidad_id', entidadId).eq('campo', campo).eq('idioma', idioma);
  } else {
    await db.from('dst_traduccion').upsert(
      { entidad, entidad_id: entidadId, campo, idioma, texto: valor,
          /* 'humano' y no 'equipo': la columna solo admite humano|maquina|
             importado. Con 'equipo' esto reventaba contra el check en CADA
             guardado, y por eso no habia una sola traduccion hecha a mano
             desde el panel. */
          origen: 'humano', esta_revisada: true },
      { onConflict: 'entidad,entidad_id,campo,idioma' }
    );
  }
  if (volverA && esUuid(volverA)) {
    revalidatePath(`/admin/negocios/${volverA}`);
  } else {
    revalidatePath(`/admin/${entidad === 'negocio' ? 'negocios' : entidad === 'tour' ? 'tours' : 'guias'}/${entidadId}`);
  }
}

/* ---- Fotos ---- */

const BUCKET = 'negocios';
const ANCHO_MAX = 1600;

/**
 * Sube una foto a Storage y la anota en dst_negocio_foto.
 *
 * Va con la sesión del usuario, no con la clave de servicio: las políticas de
 * la migración 22 miran el primer segmento de la ruta —la babosa del destino—
 * y con eso deciden si esta persona puede escribir ahí. Por eso la ruta es
 * <destino>/<negocio>/<archivo> y no al revés.
 *
 * Se redimensiona y se pasa a webp antes de subir: el bucket corta en 10 MB y
 * una foto de teléfono los pasa sin esfuerzo.
 */
/*
 * Sube UNA O VARIAS fotos de un saque.
 *
 * Antes leia `datos.get('archivo')` —la primera y nada mas— y el input no
 * tenia `multiple`: habia que repetir todo el formulario por cada foto,
 * incluido el credito y la licencia. Con ocho fotos eran ocho vueltas.
 *
 * Los datos de autoria se piden UNA vez y se aplican a toda la tanda, que es
 * como se sube en la vida real: un lote sale de la misma fuente.
 *
 * Y NO se corta en la primera que falle. Si la numero 3 esta rota, las otras
 * siete entran igual y se anota cual fallo. Cortar en seco dejaba al que subia
 * sin saber cuales habian pasado.
 */
export async function subirFoto(datos: FormData) {
  const { db, destino } = await contextoPanel('negocios');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;

  const archivos = datos.getAll('archivo').filter((a): a is File => a instanceof File && a.size > 0);
  if (!archivos.length) return;

  const { data: negocio } = await db.from('dst_negocio')
    .select('id, babosa, nombre').eq('id', id).eq('destino_id', destino.id).maybeSingle();
  if (!negocio) return;

  // Una foto que no es propia tiene que decir de quién es y bajo qué licencia:
  // es lo que exige el check de la migración 22, y la razón por la que existe.
  const credito = texto(datos, 'credito') || null;
  const licencia = texto(datos, 'licencia') || null;
  const fuente = texto(datos, 'fuente_url') || null;
  if (fuente && (!credito || !licencia)) return;

  const alternativo = texto(datos, 'texto_alternativo') || negocio.nombre;

  /* El contador arranca del total que YA hay y sube con cada una: si no, las
     de la misma tanda nacerian todas con el mismo `orden` y la galeria las
     mostraria en cualquier lado. */
  const { count } = await db.from('dst_negocio_foto')
    .select('id', { count: 'exact', head: true }).eq('negocio_id', id);
  let siguiente = count ?? 0;

  const sharp = (await import('sharp')).default;
  const fallaron: string[] = [];

  for (const archivo of archivos) {
    try {
      const webp = await sharp(Buffer.from(await archivo.arrayBuffer()))
        .rotate()
        .resize({ width: ANCHO_MAX, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();

      const base = archivo.name.replace(/\.[^.]+$/, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').slice(0, 60) || 'foto';
      const ruta = `${destino.babosa}/${negocio.babosa}/${base}-${Date.now().toString(36)}-${siguiente}.webp`;

      const { error: eSubida } = await db.storage.from(BUCKET)
        .upload(ruta, webp, { contentType: 'image/webp' });
      if (eSubida) throw new Error(eSubida.message);

      const { data: publica } = db.storage.from(BUCKET).getPublicUrl(ruta);
      const { error } = await db.from('dst_negocio_foto').insert({
        negocio_id: id,
        url: publica.publicUrl,
        orden: siguiente,
        // La primera foto real que entra manda; las genéricas nunca son portada.
        es_portada: siguiente === 0,
        es_generica: false,
        credito, licencia, fuente_url: fuente,
        texto_alternativo_es: alternativo,
        texto_alternativo_en: alternativo,
      });
      if (error) throw new Error(error.message);

      siguiente += 1;
    } catch (fallo) {
      fallaron.push(archivo.name);
      console.error('subirFoto:', archivo.name, fallo instanceof Error ? fallo.message : fallo);
    }
  }

  if (fallaron.length) console.error(`subirFoto: no entraron ${fallaron.length} de ${archivos.length}:`, fallaron.join(', '));
  refrescar(id);
}

/**
 * Traer varias fotos de golpe desde la web del propio negocio.
 *
 * La hermana de `subirFoto`, para cuando las fotos no están en el disco de
 * nadie sino en el sitio del operador. Hace lo mismo —redimensiona, pasa a
 * webp, sube y anota— pero en vez de un archivo recibe una lista de
 * direcciones y las baja el servidor.
 *
 * Va con la sesión del usuario, igual que `subirFoto`: no hace falta ninguna
 * clave de servicio. Las políticas de Storage miran el primer segmento de la
 * ruta —la babosa del destino— y con eso deciden.
 *
 * A diferencia de `subirFoto`, esta DEVUELVE qué pasó con cada dirección. Con
 * veinte fotos, una acción que se traga los errores en silencio deja a
 * cualquiera creyendo que subieron veinte cuando subieron doce.
 */
export type ResultadoTraer = {
  ok?: string;
  error?: string;
  detalle?: { url: string; estado: string }[];
};

/* Un lote a la vez. Veinte fotos de 3 MB son sesenta segundos largos de
   funcion, y Vercel corta. Si hay mas, se hacen dos viajes. */
const TOPE_LOTE = 20;

export async function traerFotos(
  _previo: ResultadoTraer,
  datos: FormData,
): Promise<ResultadoTraer> {
  const { db, destino } = await contextoPanel('negocios');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return { error: 'Falta el negocio.' };

  const { data: negocio } = await db.from('dst_negocio')
    .select('id, babosa, nombre').eq('id', id).eq('destino_id', destino.id).maybeSingle();
  if (!negocio) return { error: 'Ese negocio no es de este destino.' };

  const credito = texto(datos, 'credito') || null;
  const licencia = texto(datos, 'licencia') || null;
  const alterno = texto(datos, 'texto_alternativo') || negocio.nombre;

  const direcciones = [...new Set(
    texto(datos, 'direcciones').split(/[\s,]+/).map((x) => x.trim()).filter(Boolean),
  )];
  if (!direcciones.length) return { error: 'No viene ninguna dirección.' };
  if (direcciones.length > TOPE_LOTE) {
    return { error: `De a ${TOPE_LOTE} como mucho. Vinieron ${direcciones.length}.` };
  }
  /* La foto viene de otro sitio, así que SIEMPRE lleva fuente_url — y el
     check de la base exige autor y licencia junto a ella. Se avisa acá y no
     después, que es cuando el insert falla sin explicación. */
  if (!credito || !licencia) {
    return { error: 'Como vienen de otro sitio, el autor y la licencia son obligatorios.' };
  }

  const { traerImagen, nombreDeUrl } = await import('@/lib/admin/traer-imagen');
  const sharp = (await import('sharp')).default;

  const { count } = await db.from('dst_negocio_foto')
    .select('id', { count: 'exact', head: true }).eq('negocio_id', id);
  let orden = count ?? 0;

  const detalle: { url: string; estado: string }[] = [];
  let entraron = 0;

  for (const direccion of direcciones) {
    const bajada = await traerImagen(direccion);
    if (!bajada.ok) { detalle.push({ url: direccion, estado: bajada.porque }); continue; }

    let webp: Buffer;
    try {
      webp = await sharp(bajada.buffer).rotate()
        .resize({ width: ANCHO_MAX, withoutEnlargement: true })
        .webp({ quality: 82 }).toBuffer();
    } catch {
      detalle.push({ url: direccion, estado: 'No se pudo leer la imagen.' });
      continue;
    }

    const ruta = `${destino.babosa}/${negocio.babosa}/${nombreDeUrl(direccion)}-${Date.now().toString(36)}-${orden}.webp`;
    const { error: eSubida } = await db.storage.from(BUCKET)
      .upload(ruta, webp, { contentType: 'image/webp' });
    if (eSubida) { detalle.push({ url: direccion, estado: `Storage: ${eSubida.message}` }); continue; }

    const { data: publica } = db.storage.from(BUCKET).getPublicUrl(ruta);
    const { error } = await db.from('dst_negocio_foto').insert({
      negocio_id: id,
      url: publica.publicUrl,
      orden,
      /* Solo manda portada si el negocio no tenía ni una. */
      es_portada: orden === 0,
      es_generica: false,
      credito, licencia, fuente_url: direccion,
      texto_alternativo_es: alterno,
      texto_alternativo_en: alterno,
    });
    if (error) {
      /* La fila no entró, así que el archivo que acaba de subir no lo apunta
         nadie. Se borra: un bucket con huérfanos no se limpia solo. */
      await db.storage.from(BUCKET).remove([ruta]);
      detalle.push({ url: direccion, estado: `Base: ${error.message}` });
      continue;
    }

    detalle.push({ url: direccion, estado: 'ok' });
    entraron++;
    orden++;
  }

  refrescar(id);
  return {
    ok: `Entraron ${entraron} de ${direcciones.length}.`,
    ...(entraron < direcciones.length ? { error: 'Algunas no entraron. Mirá el detalle.' } : {}),
    detalle,
  };
}

/** Marca una foto como la portada. El índice único parcial deja solo una. */
export async function marcarPortada(datos: FormData) {
  const { db, destino } = await contextoPanel('negocios');
  const id = texto(datos, 'id');
  const fotoId = texto(datos, 'foto_id');
  if (!esUuid(id) || !esUuid(fotoId)) return;

  const { data: negocio } = await db.from('dst_negocio')
    .select('id').eq('id', id).eq('destino_id', destino.id).maybeSingle();
  if (!negocio) return;

  // Primero se apaga la anterior: uq_dst_foto_portada no deja dos a la vez.
  await db.from('dst_negocio_foto').update({ es_portada: false }).eq('negocio_id', id).eq('es_portada', true);
  const { error } = await db.from('dst_negocio_foto').update({ es_portada: true }).eq('id', fotoId).eq('negocio_id', id);
  if (error) console.error('marcarPortada:', error.message);
  refrescar(id);
}

/** Borra la fila y el archivo. Si queda huérfano el archivo, el bucket engorda solo. */
/*
 * Mover una foto en la galeria. Mismo truco que moverRazon: el id y el paso
 * viajan JUNTOS en el valor del boton, porque un boton manda un solo par
 * nombre/valor y un campo `paso` suelto valdria lo mismo para subir que para
 * bajar.
 *
 * La columna `orden` existia desde siempre pero NADIE la movia desde el panel:
 * el orden de la galeria era el de subida y no habia forma de cambiarlo sin
 * borrar y volver a subir.
 *
 * Se ordena dentro del mismo grupo `es_generica`, que es como las lista la
 * pagina (`.order('es_generica').order('orden')`): mezclar una propia con una
 * generica al moverla seria una sorpresa.
 */
export async function moverFoto(datos: FormData) {
  const { db, destino } = await contextoPanel('negocios');
  const id = texto(datos, 'id');
  const [fotoId, pasoTexto] = texto(datos, 'foto_mover').split('|');
  const paso = Number(pasoTexto);
  if (!esUuid(id) || !esUuid(fotoId) || (paso !== 1 && paso !== -1)) return;
  if (!(await negocioDelDestino(db, destino.id, id))) return;

  const { data: todas } = await db.from('dst_negocio_foto')
    .select('id, orden, es_generica').eq('negocio_id', id)
    .order('es_generica').order('orden');
  const lista = todas ?? [];

  const i = lista.findIndex((f) => f.id === fotoId);
  if (i < 0) return;
  const j = i + paso;
  if (j < 0 || j >= lista.length) return;
  // No se salta entre propias y genericas.
  if (lista[i].es_generica !== lista[j].es_generica) return;

  /* Se reescriben los dos ordenes y no se intercambian: si dos filas quedaron
     con el mismo `orden` —y pueden, nada lo impide— intercambiar no mueve nada
     y el boton parece roto. */
  await db.from('dst_negocio_foto').update({ orden: j }).eq('id', lista[i].id).eq('negocio_id', id);
  await db.from('dst_negocio_foto').update({ orden: i }).eq('id', lista[j].id).eq('negocio_id', id);
  refrescar(id);
}

export async function borrarFoto(datos: FormData) {
  const { db, destino } = await contextoPanel('negocios');
  const id = texto(datos, 'id');
  const fotoId = texto(datos, 'foto_id');
  if (!esUuid(id) || !esUuid(fotoId)) return;

  const { data: negocio } = await db.from('dst_negocio')
    .select('id').eq('id', id).eq('destino_id', destino.id).maybeSingle();
  if (!negocio) return;

  const { data: foto } = await db.from('dst_negocio_foto')
    .select('id, url').eq('id', fotoId).eq('negocio_id', id).maybeSingle();
  if (!foto) return;

  const marca = `/object/public/${BUCKET}/`;
  const corte = foto.url.indexOf(marca);
  if (corte !== -1) await db.storage.from(BUCKET).remove([foto.url.slice(corte + marca.length)]);

  const { error } = await db.from('dst_negocio_foto').delete().eq('id', fotoId).eq('negocio_id', id);
  if (error) console.error('borrarFoto:', error.message);
  refrescar(id);
}

/* ---- Opiniones de afuera ---- */

/**
 * Trae de Google la nota, el conteo y hasta cinco reseñas con texto de UN
 * negocio. No se pegan a mano en Supabase: se piden a la API oficial, que es
 * la única que da licencia para mostrar ese texto, y vencen a los 30 días.
 */
export async function traerOpiniones(datos: FormData) {
  await contextoPanel('negocios');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;
  const resultado = await refrescarExternasDeNegocio(id);
  if (!resultado.ok) console.error('traerOpiniones:', resultado.motivo);
  refrescar(id);
}

/**
 * Los que no tienen nada y los que vencen en tres días. Con tope: cada
 * negocio es una llamada facturada a Google.
 */
export async function traerOpinionesDeTodos(datos: FormData) {
  const { destino } = await contextoPanel('negocios');
  const limite = Number(texto(datos, 'limite')) || 25;
  const resumen = await refrescarExternasPendientes({ destino_id: destino.id, limite });
  console.log(`traerOpinionesDeTodos: ${resumen.ok} ok, ${resumen.fallos} fallos`);
  refrescar();
}

/*
 * Subir o bajar una cita de otra plataforma de las tres que salen en la ficha.
 *
 * Es un ORDEN, no un filtro. Lo que no sube sigue en Google, y la ficha publica
 * el promedio real, el conteo real y el enlace a verlas todas — eso está escrito
 * en PruebaSocial.tsx y es lo que separa destacar de esconder.
 *
 * Se comprueba que la cita sea de un negocio de ESTE destino antes de tocarla:
 * el id viene del navegador y el navegador se edita.
 */
export async function destacarExtracto(datos: FormData) {
  const { db, destino } = await contextoPanel('negocios');
  const id = texto(datos, 'id');
  const extractoId = texto(datos, 'extracto_id');
  if (!esUuid(id) || !esUuid(extractoId)) return;

  const { data: fila } = await db
    .from('dst_resena_externa_extracto')
    .select('id, destacado, externa:dst_resena_externa(negocio_id, negocio:dst_negocio(destino_id))')
    .eq('id', extractoId)
    .maybeSingle();

  const uno = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);
  const externa = uno(fila?.externa as never) as { negocio_id: string; negocio: unknown } | null;
  const negocio = externa ? uno(externa.negocio as never) as { destino_id: string } | null : null;
  if (!fila || !externa || externa.negocio_id !== id || negocio?.destino_id !== destino.id) return;

  const { error } = await db
    .from('dst_resena_externa_extracto')
    .update({ destacado: !fila.destacado })
    .eq('id', extractoId);
  if (error) console.error('destacarExtracto:', error.message);
  refrescar(id);
}

/* ---------------------------------------------------------------------------
 * Las tres razones para elegir un negocio.
 *
 * Son el bloque que más convence de la ficha, y el único que pide escribir
 * contenido a mano por negocio. Por eso no se rellenan solas ni se heredan de
 * la descripción: si nadie las escribió, el bloque no sale.
 * ------------------------------------------------------------------------ */

/** Que el negocio sea de ESTE destino. El id viene del navegador. */
async function negocioDelDestino(db: Awaited<ReturnType<typeof contextoPanel>>['db'], destinoId: string, id: string) {
  const { data } = await db.from('dst_negocio')
    .select('id').eq('id', id).eq('destino_id', destinoId).maybeSingle();
  return !!data;
}

export async function agregarRazon(datos: FormData) {
  const { db, destino } = await contextoPanel('negocios');
  const id = texto(datos, 'id');
  const titulo = texto(datos, 'razon_titulo');
  if (!esUuid(id) || titulo.length < 2) return;
  if (!(await negocioDelDestino(db, destino.id, id))) return;

  /* Tres y no más: la ficha muestra tres, y dejar cargar seis para después
     esconder tres es una trampa para quien las escribe. */
  const { count } = await db.from('dst_negocio_razon')
    .select('id', { count: 'exact', head: true }).eq('negocio_id', id);
  if ((count ?? 0) >= 3) return;

  const { error } = await db.from('dst_negocio_razon').insert({
    negocio_id: id,
    titulo: titulo.slice(0, 90),
    texto: texto(datos, 'razon_texto').slice(0, 240) || null,
    foto_url: texto(datos, 'razon_foto_url') || null,
    orden: count ?? 0,
  });
  if (error) console.error('agregarRazon:', error.message);
  refrescar(id);
}

export async function borrarRazon(datos: FormData) {
  const { db, destino } = await contextoPanel('negocios');
  const id = texto(datos, 'id');
  const razonId = texto(datos, 'razon_id');
  if (!esUuid(id) || !esUuid(razonId)) return;
  if (!(await negocioDelDestino(db, destino.id, id))) return;

  // `negocio_id` en el where tambien: sin eso, un id de otro negocio borraria.
  const { error } = await db.from('dst_negocio_razon')
    .delete().eq('id', razonId).eq('negocio_id', id);
  if (error) console.error('borrarRazon:', error.message);
  refrescar(id);
}

export async function moverRazon(datos: FormData) {
  const { db, destino } = await contextoPanel('negocios');
  const id = texto(datos, 'id');
  /* El id y el paso viajan JUNTOS en el valor del botón: un botón manda un
     solo par nombre/valor, así que un campo `paso` suelto en el formulario
     valdría lo mismo para subir que para bajar — y el de subir bajaría. */
  const [razonId, pasoTexto] = texto(datos, 'razon_mover').split('|');
  const paso = Number(pasoTexto);
  if (!esUuid(id) || !esUuid(razonId) || (paso !== 1 && paso !== -1)) return;
  if (!(await negocioDelDestino(db, destino.id, id))) return;

  const { data: todas } = await db.from('dst_negocio_razon')
    .select('id, orden').eq('negocio_id', id).order('orden');
  const lista = todas ?? [];
  const i = lista.findIndex((r) => r.id === razonId);
  const j = i + paso;
  if (i < 0 || j < 0 || j >= lista.length) return;

  /* Se reescriben los dos órdenes y no se intercambian los ids: si dos filas
     quedaron con el mismo `orden` —y pueden, no hay restricción que lo impida—
     intercambiar no mueve nada y el botón parece roto. */
  await db.from('dst_negocio_razon').update({ orden: j }).eq('id', lista[i].id).eq('negocio_id', id);
  await db.from('dst_negocio_razon').update({ orden: i }).eq('id', lista[j].id).eq('negocio_id', id);
  refrescar(id);
}

/* ---------------------------------------------------------------------------
 * Con qué se combina un negocio.
 *
 * Lo elige el equipo a mano y no se calcula por categoría: eso recomendaría al
 * competidor de al lado, que es lo contrario de lo que el negocio espera.
 * ------------------------------------------------------------------------ */

export async function agregarCombina(datos: FormData) {
  const { db, destino } = await contextoPanel('negocios');
  const id = texto(datos, 'id');
  const otroId = texto(datos, 'combina_id');
  if (!esUuid(id) || !esUuid(otroId) || id === otroId) return;

  /* Los DOS tienen que ser de este destino. El de la izquierda porque es el
     que se edita; el de la derecha porque si no, se podría enganchar la ficha
     de otro destino desde un formulario tocado a mano. */
  const { data: dos } = await db.from('dst_negocio')
    .select('id').eq('destino_id', destino.id).in('id', [id, otroId]);
  if ((dos?.length ?? 0) !== 2) return;

  const { count } = await db.from('dst_negocio_combina')
    .select('id', { count: 'exact', head: true }).eq('negocio_id', id);
  if ((count ?? 0) >= 6) return;

  const { error } = await db.from('dst_negocio_combina').insert({
    negocio_id: id,
    combina_id: otroId,
    motivo: texto(datos, 'combina_motivo').slice(0, 90) || null,
    orden: count ?? 0,
  });
  // 23505 es la unique: ya estaba puesto, y eso no es un error que reportar.
  if (error && error.code !== '23505') console.error('agregarCombina:', error.message);
  refrescar(id);
}

export async function borrarCombina(datos: FormData) {
  const { db, destino } = await contextoPanel('negocios');
  const id = texto(datos, 'id');
  const filaId = texto(datos, 'combina_fila');
  if (!esUuid(id) || !esUuid(filaId)) return;
  if (!(await negocioDelDestino(db, destino.id, id))) return;

  const { error } = await db.from('dst_negocio_combina')
    .delete().eq('id', filaId).eq('negocio_id', id);
  if (error) console.error('borrarCombina:', error.message);
  refrescar(id);
}
