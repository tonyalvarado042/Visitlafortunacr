'use client';

/*
 * Preparar una foto en el NAVEGADOR antes de subirla.
 *
 * Vive aparte porque lo usan dos pantallas: la galería del negocio y la foto
 * de una tour. Tenerlo dos veces garantiza que el día que se cambie la
 * calidad o el ancho, una de las dos se quede atrás.
 */

const ANCHO_MAX = 1600;
const CALIDAD = 0.82;
/* El tope del bucket. Es generoso a propósito: una foto de iPhone pasa los
   4 MB sin esfuerzo, y rechazarla sería perder la ficha de un negocio por
   algo que el navegador puede arreglar solo. Lo que termina guardado pesa
   ~200 KB venga de 2 MB o de 9. */
export const TOPE_BYTES = 10 * 1024 * 1024;

export const ACEPTA = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';

/**
 * Encoger y pasar a WebP ANTES de subir.
 *
 * Primero en el navegador, con un canvas: así lo que viaja son ~200 KB en vez
 * de 6 MB, que en el 3G de La Fortuna es la diferencia entre que funcione y
 * que no.
 *
 * Si el navegador no sabe leer el archivo —HEIC en Chrome y Firefox, que es
 * el formato con el que fotografía un iPhone— esa foto sola se manda al
 * servidor, donde sharp sí la lee.
 */
export async function aWebp(archivo: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
    const escala = Math.min(1, ANCHO_MAX / bitmap.width);
    const ancho = Math.round(bitmap.width * escala);
    const alto = Math.round(bitmap.height * escala);

    const lienzo = document.createElement('canvas');
    lienzo.width = ancho;
    lienzo.height = alto;
    const pincel = lienzo.getContext('2d');
    if (!pincel) throw new Error('sin canvas');
    pincel.drawImage(bitmap, 0, 0, ancho, alto);
    bitmap.close();

    const blob = await new Promise<Blob | null>((listo) =>
      lienzo.toBlob(listo, 'image/webp', CALIDAD),
    );
    if (blob) return blob;
  } catch {
    // Todavía no es un error: cae al servidor.
  }

  const cuerpo = new FormData();
  cuerpo.append('archivo', archivo);
  const respuesta = await fetch('/api/foto/webp', { method: 'POST', body: cuerpo });
  if (!respuesta.ok) {
    const dicho = await respuesta.json().catch(() => ({}));
    throw new Error(dicho.error ?? 'No pudimos leer esa foto.');
  }
  return await respuesta.blob();
}

/** El nombre del archivo, limpio: la base solo acepta letras, números y guiones. */
export function nombreLimpio(original: string): string {
  const base = original
    .replace(/\.[^.]+$/, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return `${base || 'foto'}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
