import { NextRequest, NextResponse } from 'next/server';
import { contextoPanel } from '@/lib/admin/contexto';

/*
 * Subir UNA imagen del destino desde el panel y devolver su direccion.
 *
 * Es una ruta y no una accion de servidor a proposito. La primera version era
 * una accion despachada desde el `onChange` de un campo que vive DENTRO de
 * otro formulario, y React se la tragaba sin decir nada: se elegia el archivo
 * y no pasaba absolutamente nada, ni error. Una peticion normal se puede ver
 * en la pestana de red, devuelve un codigo y falla a la vista.
 *
 * Va con la SESION del usuario, no con la clave de servicio: las politicas de
 * Storage miran el primer segmento de la ruta —la babosa del destino— y con
 * eso deciden. Por eso la ruta es <destino>/<carpeta>/<archivo>.
 */
export const runtime = 'nodejs';

/** Lo que Vercel deja pasar en el cuerpo de una peticion. */
const TOPE = 4 * 1024 * 1024;
const ANCHO_MAX = 1800;
const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
const CARPETAS = ['rifa', 'marca', 'portadas', 'experiencias', 'guias', 'razones'];

export async function POST(peticion: NextRequest) {
  /* contextoPanel redirige si no hay sesion; aqui eso seria una redireccion
     dentro de un fetch, que el navegador sigue y devuelve HTML. Se atrapa y
     se contesta con un error de verdad. */
  let db, destino;
  try {
    ({ db, destino } = await contextoPanel());
  } catch {
    return NextResponse.json({ error: 'Entrá a tu cuenta otra vez.' }, { status: 401 });
  }

  let datos: FormData;
  try {
    datos = await peticion.formData();
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el archivo.' }, { status: 400 });
  }

  const carpeta = String(datos.get('carpeta') ?? '').trim();
  if (!CARPETAS.includes(carpeta)) {
    return NextResponse.json({ error: 'Carpeta desconocida.' }, { status: 400 });
  }

  const archivo = datos.get('archivo');
  if (!(archivo instanceof File) || !archivo.size) {
    return NextResponse.json({ error: 'No vino ningún archivo.' }, { status: 400 });
  }
  if (archivo.size > TOPE) {
    return NextResponse.json(
      { error: 'Pesa más de 4 MB. Guardala más chica y volvé a intentar.' },
      { status: 413 },
    );
  }
  if (!TIPOS.includes(archivo.type)) {
    return NextResponse.json(
      { error: `Eso no es una imagen (${archivo.type || 'sin tipo'}).` },
      { status: 415 },
    );
  }

  let webp: Buffer;
  try {
    const sharp = (await import('sharp')).default;
    webp = await sharp(Buffer.from(await archivo.arrayBuffer()))
      .rotate()
      .resize({ width: ANCHO_MAX, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch (fallo) {
    console.error('subir imagen, al convertir:', fallo instanceof Error ? fallo.message : fallo);
    return NextResponse.json({ error: 'No se pudo leer la imagen.' }, { status: 415 });
  }

  const base = archivo.name.replace(/\.[^.]+$/, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'imagen';
  const ruta = `${destino.babosa}/${carpeta}/${base}-${Date.now().toString(36)}.webp`;

  const { error } = await db.storage.from('marca')
    .upload(ruta, webp, { contentType: 'image/webp' });
  if (error) {
    console.error('subir imagen, al guardar:', error.message);
    return NextResponse.json({ error: `No se pudo guardar: ${error.message}` }, { status: 500 });
  }

  const { data } = db.storage.from('marca').getPublicUrl(ruta);
  return NextResponse.json({ url: data.publicUrl });
}
