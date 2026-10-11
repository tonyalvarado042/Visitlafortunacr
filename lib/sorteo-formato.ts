/*
 * Formato del sorteo. Vive aparte de lib/sorteo.ts a proposito: el aviso es
 * un componente de cliente, y si importara de alli se llevaria el cliente de
 * Supabase —y la URL del proyecto— al navegador.
 */

/**
 * El premio en plata.
 *
 * A mano y no con `style: 'currency'`: en espanol, Intl escribe los dolares
 * como "1000 US$", con el simbolo detras. En Costa Rica eso no lo escribe
 * nadie. El numero lleva la separacion de miles del idioma y el simbolo va
 * adelante, que es como se lee de este lado.
 */
export function premioEnPlata(monto: number | null | undefined, idioma: string): string | null {
  if (monto == null) return null;
  const numero = new Intl.NumberFormat(localeSeguro(idioma), {
    minimumFractionDigits: 0,
    maximumFractionDigits: monto % 1 === 0 ? 0 : 2,
    /* 'always': en espanol, Intl no separa los miles por debajo de diez mil,
       asi que 1000 salia como "1000" pelado. Correcto para un numero suelto; para un
       precio se lee como mil pesos de algo. */
    useGrouping: 'always',
  }).format(monto);
  return `$${numero}`;
}

/**
 * Un idioma que Intl acepte, siempre.
 *
 * `Intl` revienta con RangeError ante cualquier cosa que no parezca un
 * idioma: cadena vacia, con punto, con coma o con espacio. Y aca llega lo que
 * venga en la direccion, porque `/[idioma]` casa con cualquier segmento.
 *
 * Eso tiraba un 500 EN LA PORTADA cada vez que un navegador o un robot pedia
 * `/apple-touch-icon.png`: el middleware deja pasar todo lo que tenga punto,
 * la ruta casa con `/[idioma]`, y `BandaSorteo` formateaba el premio con
 * idioma = "apple-touch-icon.png". El layout si valida, pero en App Router la
 * pagina y el layout se pintan EN PARALELO: la pagina reventaba antes de que
 * el notFound() del layout llegara.
 *
 * Formatear no es el lugar donde se decide si una direccion existe. Eso lo
 * hace la pagina, con un 404. Aca solo no se rompe.
 */
function localeSeguro(idioma: string): string {
  try {
    Intl.getCanonicalLocales(idioma);
    return idioma;
  } catch {
    return 'es';
  }
}

/** Cuando se sortea, en palabras: el dia exacto si lo hay, el texto si no. */
export function cuandoSeSortea(
  fecha: string | null, texto: string | null, idioma: string,
): string | null {
  if (fecha) {
    /* Mediodia UTC a proposito. Una fecha suelta "2027-04-18" la toma el
       navegador como medianoche UTC, y en Costa Rica (UTC-6) eso se pinta
       como el 17: el sorteo se correria un dia entero. */
    return new Date(`${fecha}T12:00:00Z`).toLocaleDateString(localeSeguro(idioma), {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    });
  }
  return texto;
}

/**
 * Convierte los `[Falta: X]` de las bases en una linea honesta para el
 * publico: "Por definir: X".
 *
 * El marcador sirve en el panel —es la lista de lo que falta y lo que
 * dispara el aviso de "antes de encenderla"— pero en la pagina, tal cual,
 * se lee como un error del programador.
 *
 * NO se esconden. Una rifa que dice en voz alta que el dia exacto todavia
 * no esta decidido da mas confianza que una que se queda callada y despues
 * aparece con una condicion que nadie vio.
 */
export function marcarPendientes(html: string): string {
  return html.replace(
    /<p>\s*\[Falta:\s*([\s\S]*?)\]\s*<\/p>/gi,
    (_todo, texto: string) =>
      `<p class="rifa-por-definir"><strong>Por definir:</strong> ${String(texto).trim()}</p>`,
  );
}
