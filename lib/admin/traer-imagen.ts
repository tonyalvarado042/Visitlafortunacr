import 'server-only';

/*
 * Bajar una imagen de una direccion web, para el traedor de fotos del panel.
 *
 * Esto es una peticion que hace EL SERVIDOR a una direccion que escribe una
 * persona. Aunque esa persona sea del equipo, el servidor esta adentro de la
 * red y puede alcanzar cosas que el navegador no: el metadatos de la nube, un
 * servicio interno, la propia base. Por eso lo que entra se revisa antes de
 * pedirlo, y no despues.
 */

/** Direcciones que el servidor no pide nunca, por mas que se las escriban. */
const PROHIBIDO = [
  /^localhost$/i,
  /^127\./, /^0\./, /^10\./, /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,            // metadatos de AWS, GCP y Azure
  /^\[?::1\]?$/, /^\[?fc/i, /^\[?fd/i, /^\[?fe80/i,
  /\.internal$/i, /\.local$/i,
];

const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
/** 25 MB. Una foto de camara no los pasa; un archivo que si los pasa, no es una foto. */
const TOPE = 25 * 1024 * 1024;

export type Bajada =
  | { ok: true; buffer: Buffer; tipo: string }
  | { ok: false; porque: string };

export async function traerImagen(direccion: string): Promise<Bajada> {
  let url: URL;
  try {
    url = new URL(direccion);
  } catch {
    return { ok: false, porque: 'No parece una dirección.' };
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, porque: 'Solo http y https.' };
  }
  if (PROHIBIDO.some((r) => r.test(url.hostname))) {
    return { ok: false, porque: 'Esa dirección es de la red interna.' };
  }

  let r: Response;
  try {
    /* `redirect: 'manual'` no sirve: hay sitios que no dan la imagen sin
       seguir un salto. Se sigue, pero el destino se vuelve a revisar — un
       redirect a 169.254.169.254 es la forma clasica de saltarse la lista. */
    r = await fetch(url.href, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; VisitLaFortunaCR/1.0)',
        accept: 'image/*',
      },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    return { ok: false, porque: e instanceof Error && e.name === 'TimeoutError' ? 'Tardó demasiado.' : 'No se pudo alcanzar.' };
  }

  try {
    const final = new URL(r.url);
    if (PROHIBIDO.some((x) => x.test(final.hostname))) {
      return { ok: false, porque: 'Redirigía a la red interna.' };
    }
  } catch { /* si no se puede leer la final, manda la revisada de arriba */ }

  if (!r.ok) return { ok: false, porque: `El sitio respondió ${r.status}.` };

  const tipo = (r.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!TIPOS.includes(tipo)) return { ok: false, porque: `No es una imagen (${tipo || 'sin tipo'}).` };

  const largo = Number(r.headers.get('content-length') ?? 0);
  if (largo > TOPE) return { ok: false, porque: 'Pesa más de 25 MB.' };

  const buffer = Buffer.from(await r.arrayBuffer());
  /* Se vuelve a medir: content-length puede venir mentido o no venir. */
  if (buffer.length > TOPE) return { ok: false, porque: 'Pesa más de 25 MB.' };
  if (buffer.length < 1024) return { ok: false, porque: 'Llegó vacía.' };

  return { ok: true, buffer, tipo };
}

/** Un nombre de archivo decente sacado de la direccion. */
export function nombreDeUrl(direccion: string): string {
  try {
    const ultimo = decodeURIComponent(new URL(direccion).pathname.split('/').pop() ?? '');
    return ultimo.replace(/\.[^.]+$/, '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'foto';
  } catch {
    return 'foto';
  }
}
