'use server';

import { contextoPanel } from '@/lib/admin/contexto';

/*
 * Subir UNA imagen del destino y devolver su direccion.
 *
 * Para todo lo que es del destino y no de un negocio: la imagen de la rifa,
 * el logo, el emblema, portadas de video. Lo de los negocios tiene su propia
 * via en negocios/acciones.ts, con su carpeta y sus politicas.
 *
 * Va con la SESION del usuario, no con la clave de servicio: las politicas de
 * Storage miran el primer segmento de la ruta —la babosa del destino— y con
 * eso deciden si esta persona puede escribir ahi. Por eso la ruta es
 * <destino>/<carpeta>/<archivo> y no al reves.
 *
 * Existe por una regla de Tony, y la regla es correcta: un campo que pide una
 * imagen y solo acepta una direccion le pasa el trabajo al usuario —subir el
 * archivo a otra parte, copiar la url, pegarla—. Si pide una imagen, lleva su
 * boton.
 */

export type ResultadoSubida = { url?: string; error?: string };

/** Lo que el bucket aguanta de verdad; mas grande es un archivo, no una foto. */
const TOPE = 12 * 1024 * 1024;
const ANCHO_MAX = 1800;
const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];

/** Solo letras, numeros y guiones: lo demas se va. */
const CARPETAS = ['rifa', 'marca', 'portadas', 'experiencias', 'guias'] as const;

export async function subirImagen(
  _previo: ResultadoSubida,
  datos: FormData,
): Promise<ResultadoSubida> {
  const { db, destino } = await contextoPanel();

  const carpeta = String(datos.get('carpeta') ?? '').trim();
  if (!(CARPETAS as readonly string[]).includes(carpeta)) {
    return { error: 'Carpeta desconocida.' };
  }

  const archivo = datos.get('archivo');
  if (!(archivo instanceof File) || !archivo.size) return { error: 'No viniste con ningún archivo.' };
  if (archivo.size > TOPE) return { error: 'Pesa más de 12 MB.' };
  if (!TIPOS.includes(archivo.type)) return { error: `Eso no es una imagen (${archivo.type || 'sin tipo'}).` };

  let webp: Buffer;
  try {
    const sharp = (await import('sharp')).default;
    webp = await sharp(Buffer.from(await archivo.arrayBuffer()))
      .rotate()
      .resize({ width: ANCHO_MAX, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch (e) {
    console.error('subirImagen: no se pudo procesar', e);
    return { error: 'No se pudo leer la imagen. ¿Está completa?' };
  }

  const base = archivo.name.replace(/\.[^.]+$/, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'imagen';
  const ruta = `${destino.babosa}/${carpeta}/${base}-${Date.now().toString(36)}.webp`;

  const { error } = await db.storage.from('marca')
    .upload(ruta, webp, { contentType: 'image/webp' });
  if (error) {
    console.error('subirImagen:', error.message);
    return { error: `No se pudo subir: ${error.message}` };
  }

  const { data } = db.storage.from('marca').getPublicUrl(ruta);
  return { url: data.publicUrl };
}
