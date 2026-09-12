import 'server-only';

/*
 * Google Places API (New). Es la única fuente que entrega TEXTO de reseñas con
 * licencia para mostrarlo: hasta cinco por lugar, con el nombre del autor, su
 * foto, su enlace y el enlace al original. A cambio exige tres cosas, y las
 * tres están resueltas aquí o en la base:
 *
 *   1. Atribuir: el autor y el enlace a la reseña original se guardan y se
 *      muestran (dst_resena_externa_extracto).
 *   2. No modificar el texto: se guarda tal cual viene, sin recortar.
 *   3. No cachear indefinidamente: `expira_en` a 30 días, y la política de
 *      lectura del sitio filtra por esa fecha. Vencido es invisible, aunque
 *      nadie se acuerde de borrarlo. El único dato que Google deja guardar
 *      para siempre es el place_id, y por eso vive en dst_negocio.
 *
 * Tripadvisor y Booking NO entran por aquí. Tripadvisor tiene su propia API de
 * contenido (hay que pedir acceso y mostrar su logo) y Booking no publica
 * reseñas fuera de su programa de afiliados. Raspar sus páginas es lo que la
 * regla 4 del cerebro prohíbe, así que mientras no haya acuerdo, de esas dos
 * solo se puede mostrar la nota y el enlace cargados a mano.
 */

const BASE = 'https://places.googleapis.com/v1';

export function hayClaveDePlaces(): boolean {
  const clave = process.env.GOOGLE_PLACES_API_KEY?.trim();
  return !!clave && clave.length >= 20 && !clave.includes('...');
}

function clave(): string {
  const valor = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!valor) throw new Error('Falta GOOGLE_PLACES_API_KEY en el entorno.');
  return valor;
}

export type ExtractoExterno = {
  autor_nombre: string;
  autor_avatar_url: string | null;
  autor_url: string | null;
  calificacion: number | null;
  texto: string;
  publicada_en: string | null;
  url_original: string;
};

export type LugarGoogle = {
  place_id: string;
  nombre: string | null;
  sitio_web: string | null;
  telefono: string | null;
  direccion: string | null;
  calificacion: number | null;
  total_resenas: number | null;
  url_fuente: string;
  latitud: number | null;
  longitud: number | null;
  extractos: ExtractoExterno[];
};

type RespuestaLugar = {
  id?: string;
  displayName?: { text?: string };
  websiteUri?: string;
  internationalPhoneNumber?: string;
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  location?: { latitude?: number; longitude?: number };
  reviews?: {
    rating?: number;
    text?: { text?: string };
    originalText?: { text?: string };
    publishTime?: string;
    googleMapsUri?: string;
    authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
  }[];
};

async function pedir<T>(url: string, campos: string, init?: RequestInit): Promise<T> {
  const respuesta = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': clave(),
      'X-Goog-FieldMask': campos,
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '');
    throw new Error(`Google Places respondió ${respuesta.status}: ${detalle.slice(0, 300)}`);
  }
  return (await respuesta.json()) as T;
}

/**
 * Encuentra el place_id de un negocio por nombre y dirección. Se sesga por la
 * ubicación del destino: hay una "Catarata La Fortuna" en varios países, y sin
 * el sesgo se trae la de otro.
 */
export async function buscarPlaceId(consulta: {
  nombre: string;
  direccion?: string | null;
  cerca_de?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  idioma?: string;
}): Promise<string | null> {
  const texto = [consulta.nombre, consulta.direccion, consulta.cerca_de].filter(Boolean).join(', ');
  const cuerpo: Record<string, unknown> = {
    textQuery: texto,
    languageCode: consulta.idioma ?? 'es',
    maxResultCount: 1,
  };

  if (consulta.latitud != null && consulta.longitud != null) {
    cuerpo.locationBias = {
      circle: {
        center: { latitude: consulta.latitud, longitude: consulta.longitud },
        radius: 30000, // 30 km: el destino y sus alrededores, no la provincia.
      },
    };
  }

  const datos = await pedir<{ places?: { id?: string }[] }>(
    `${BASE}/places:searchText`,
    'places.id,places.displayName,places.formattedAddress',
    { method: 'POST', body: JSON.stringify(cuerpo) }
  );

  return datos.places?.[0]?.id ?? null;
}

function normalizarTelefono(valor: string | undefined): string | null {
  if (!valor) return null;
  const limpio = valor.replace(/[^\d+]/g, '');
  return /^\+[1-9]\d{6,14}$/.test(limpio) ? limpio : null;
}

/** La ficha del lugar con su nota, su conteo y sus hasta cinco reseñas. */
export async function detalleDeLugar(placeId: string, idioma = 'es'): Promise<LugarGoogle> {
  const campos = [
    'id', 'displayName', 'rating', 'userRatingCount', 'googleMapsUri', 'location',
    'websiteUri', 'internationalPhoneNumber', 'formattedAddress', 'reviews',
  ].join(',');

  const lugar = await pedir<RespuestaLugar>(
    `${BASE}/places/${encodeURIComponent(placeId)}?languageCode=${encodeURIComponent(idioma)}`,
    campos
  );

  const url = lugar.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${placeId}`;

  const extractos: ExtractoExterno[] = (lugar.reviews ?? [])
    .map((r) => ({
      autor_nombre: r.authorAttribution?.displayName?.trim() || 'Google',
      autor_avatar_url: r.authorAttribution?.photoUri ?? null,
      autor_url: r.authorAttribution?.uri ?? null,
      calificacion: typeof r.rating === 'number' ? Math.round(r.rating) : null,
      // Sin tocar: los términos de Google prohíben editar el texto de una
      // reseña. Si no cabe en la ficha, se recorta al mostrar, no al guardar.
      texto: (r.text?.text ?? r.originalText?.text ?? '').trim(),
      publicada_en: r.publishTime ?? null,
      url_original: r.googleMapsUri ?? url,
    }))
    .filter((e) => e.texto.length > 0);

  return {
    place_id: lugar.id ?? placeId,
    nombre: lugar.displayName?.text ?? null,
    sitio_web: lugar.websiteUri?.startsWith('http') ? lugar.websiteUri : null,
    // E.164 sin espacios: la restriccion de dst_negocio.telefono no acepta
    // "+506 2479 9515", y un update que falla se lleva por delante el resto.
    telefono: normalizarTelefono(lugar.internationalPhoneNumber),
    direccion: lugar.formattedAddress ?? null,
    calificacion: typeof lugar.rating === 'number' ? Math.round(lugar.rating * 10) / 10 : null,
    total_resenas: typeof lugar.userRatingCount === 'number' ? lugar.userRatingCount : null,
    url_fuente: url,
    latitud: lugar.location?.latitude ?? null,
    longitud: lugar.location?.longitude ?? null,
    extractos,
  };
}
