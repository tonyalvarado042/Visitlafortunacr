import { NextRequest, NextResponse } from 'next/server';
import { sesion } from '@/lib/supabase-sesion';

export const runtime = 'nodejs';

/*
 * Convertir UNA foto a WebP, para las que el navegador no sabe leer.
 *
 * El camino normal es el otro: el navegador encoge la foto en un canvas y la
 * sube derecho a Storage, sin tocar el servidor. Pero Chrome y Firefox no
 * decodifican HEIC —el formato con el que fotografía un iPhone— y acá eso no
 * es un caso raro: medio mundo sube desde el teléfono. Para esas, sharp sí
 * sabe leerlas, así que esta ruta es la red de seguridad.
 *
 * Solo convierte y devuelve. No sube ni anota nada: lo que entra por acá
 * vuelve al navegador y sigue el mismo camino que todas las demás.
 */

const ANCHO_MAX = 1600;
/* Vercel corta todo cuerpo de petición en 4.5 MB, así que un tope mayor sería
   mentira: el error llegaría de la plataforma y sin explicación. */
const TOPE = 4 * 1024 * 1024;

export async function POST(peticion: NextRequest) {
  /* Con sesión y nada más. Sin esto, esto es un convertidor de imágenes
     gratis para cualquiera que lo encuentre, pagado con el CPU de Tony. */
  const db = await sesion();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Entrá a tu cuenta primero.' }, { status: 401 });

  let archivo: unknown;
  try {
    archivo = (await peticion.formData()).get('archivo');
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el archivo.' }, { status: 400 });
  }

  if (!(archivo instanceof File) || !archivo.size) {
    return NextResponse.json({ error: 'No vino ninguna foto.' }, { status: 400 });
  }
  if (archivo.size > TOPE) {
    return NextResponse.json(
      { error: 'Esa foto pesa más de 4 MB y tu navegador no la puede encoger solo. Guardala como JPG y volvé a intentar.' },
      { status: 413 },
    );
  }

  try {
    const sharp = (await import('sharp')).default;
    const webp = await sharp(Buffer.from(await archivo.arrayBuffer()))
      // rotate() sin argumentos endereza según el EXIF. Sin esto, las fotos
      // verticales de teléfono salen acostadas.
      .rotate()
      .resize({ width: ANCHO_MAX, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    return new NextResponse(new Uint8Array(webp), {
      headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'no-store' },
    });
  } catch (fallo) {
    console.error('convertir foto:', fallo instanceof Error ? fallo.message : fallo);
    return NextResponse.json(
      { error: 'No pudimos leer esa foto. Probá con un JPG o un PNG.' },
      { status: 415 },
    );
  }
}
