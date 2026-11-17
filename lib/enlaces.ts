/*
 * Los campos que la BASE rechaza, revisados ANTES de mandárselos.
 *
 * ⚠️ POR QUÉ EXISTE ESTE ARCHIVO. Tony, 10 de noviembre de 2026: llenó la
 * ficha de Bike & Bed entera —credenciales, resumen, descripción—, le dio
 * «Guardar todo», y la base rechazó TODO el UPDATE por un solo campo: el
 * Facebook no empezaba con https://. La pantalla lo mandó de vuelta y lo
 * escrito se perdió.
 *
 * Un `check` de Postgres es todo-o-nada: una columna mal escrita tira la fila
 * completa. Así que el filtro tiene que estar de este lado, donde todavía se
 * puede ARREGLAR lo arreglable y DECIR lo que no.
 *
 * Las expresiones de acá abajo son las mismas que tiene la base. Si alguna
 * cambia allá, cambia acá — si no, esto deja pasar algo que el UPDATE va a
 * rebotar igual, y volvemos al principio.
 */

export type Revisado = { valor: string | null; error?: undefined } | { valor?: undefined; error: string };

/* Las de la base, al pie de la letra (`\d+_fichas.sql`):
     facebook_url  ~* ^https?://([a-z0-9-]+\.)?(facebook\.com|fb\.com|fb\.me)/.+
     instagram_url ~* ^https?://([a-z0-9-]+\.)?instagram\.com/.+               */
const REDES = {
  facebook: {
    nombre: 'Facebook',
    patron: /^https?:\/\/([a-z0-9-]+\.)?(facebook\.com|fb\.com|fb\.me)\/.+/i,
    /* La misma direccion SIN exigir el perfil. Separa dos avisos distintos:
       «pusiste medio enlace» y «pusiste otra cosa». */
    patronSitio: /^https?:\/\/([a-z0-9-]+\.)?(facebook\.com|fb\.com|fb\.me)\/?$/i,
    deUsuario: (u: string) => `https://www.facebook.com/${u}`,
    ejemplo: 'https://www.facebook.com/bikeandbedarenal',
  },
  instagram: {
    nombre: 'Instagram',
    patron: /^https?:\/\/([a-z0-9-]+\.)?instagram\.com\/.+/i,
    patronSitio: /^https?:\/\/([a-z0-9-]+\.)?instagram\.com\/?$/i,
    deUsuario: (u: string) => `https://www.instagram.com/${u}`,
    ejemplo: 'https://www.instagram.com/bikeandbedarenal',
  },
} as const;

/**
 * El enlace de una red social: arregla lo que se puede, explica lo que no.
 *
 * Lo que entra bien y sale bien, sin molestar a nadie:
 *   @bikeandbed                  -> https://www.facebook.com/bikeandbed
 *   bikeandbed                   -> https://www.facebook.com/bikeandbed
 *   facebook.com/bikeandbed      -> https://facebook.com/bikeandbed
 *   www.facebook.com/bikeandbed  -> https://www.facebook.com/bikeandbed
 *
 * Lo que NO se adivina, y por eso se pregunta en vez de inventar:
 *   un enlace de otra red pegado en el campo equivocado
 *   https://facebook.com   (sin el perfil: eso no lleva a ninguna parte)
 */
export function enlaceDeRed(crudo: string, cual: keyof typeof REDES): Revisado {
  const red = REDES[cual];
  const limpio = crudo.trim().replace(/\s+/g, '');
  if (!limpio) return { valor: null };

  /* Un @usuario, o un nombre suelto sin puntos ni barras: es el usuario, no
     una dirección. Se arma la dirección entera. */
  if (/^@?[A-Za-z0-9._-]+$/.test(limpio) && !limpio.includes('.')) {
    return { valor: red.deUsuario(limpio.replace(/^@/, '')) };
  }

  /* Sin protocolo la base rebota, y es el error más común de todos: la gente
     copia la barra de direcciones del navegador, que ya no lo muestra. */
  const conProtocolo = /^https?:\/\//i.test(limpio) ? limpio : `https://${limpio}`;

  if (red.patron.test(conProtocolo)) return { valor: conProtocolo };

  /* El caso cruel: la dirección ES de la red, pero no lleva a ningún perfil.
     Guardarla pondría un enlace muerto en la ficha pública. */
  if (red.patronSitio.test(conProtocolo)) {
    return { error: `El ${red.nombre} va hasta el perfil, no solo el sitio. Así: ${red.ejemplo}` };
  }

  return { error: `Esto no parece un ${red.nombre}: «${crudo.trim()}». Tiene que ser así: ${red.ejemplo}` };
}

/**
 * El sitio web. La base solo pide `^https?://`, pero un «https://asdf» pasa
 * ese check y deja un enlace roto en la ficha, así que acá se pide además que
 * tenga un dominio de verdad.
 */
export function sitioWeb(crudo: string): Revisado {
  const limpio = crudo.trim().replace(/\s+/g, '');
  if (!limpio) return { valor: null };
  const conProtocolo = /^https?:\/\//i.test(limpio) ? limpio : `https://${limpio}`;
  if (!/^https?:\/\/[^/\s]+\.[a-z]{2,}(\/|$|\?|#)/i.test(conProtocolo)) {
    return { error: `Esto no parece una dirección web: «${crudo.trim()}». Así: https://bikeandbedarenal.com` };
  }
  return { valor: conProtocolo };
}

/** Base: `^[^@[:space:]]+@[^@[:space:]]+\.[a-zA-Z]{2,}$` */
export function correo(crudo: string): Revisado {
  const limpio = crudo.trim().toLowerCase().replace(/\s+/g, '');
  if (!limpio) return { valor: null };
  if (!/^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/.test(limpio)) {
    return { error: `Ese correo no se puede guardar: «${crudo.trim()}». Le falta algo — revisá la arroba y el punto.` };
  }
  return { valor: limpio };
}

/**
 * Base: `^\+[1-9][0-9]{6,14}$` — el formato internacional, sin espacios.
 *
 * Los ocho dígitos ticos SIN código de país pasan ese check por casualidad y
 * quedan guardados como un número que no existe en ninguna parte. Por eso se
 * revisa aparte y se sugiere el +506 en vez de ponerlo solo: el negocio puede
 * ser de otro país y un prefijo inventado es peor que un campo vacío.
 */
export function telefono(crudo: string, comoSeLlama: string): Revisado {
  const limpio = crudo.trim().replace(/[\s\-().]/g, '');
  if (!limpio) return { valor: null };
  const conMas = limpio.startsWith('+') ? limpio : `+${limpio}`;
  if (/^\+[24678]\d{7}$/.test(conMas)) {
    return { error: `El ${comoSeLlama} «${crudo.trim()}» parece de Costa Rica sin el código. ¿Será +506 ${limpio}?` };
  }
  if (!/^\+[1-9][0-9]{6,14}$/.test(conMas)) {
    return { error: `Ese ${comoSeLlama} no se puede guardar: «${crudo.trim()}». Va con código de país, así: +506 2479 1234` };
  }
  return { valor: conMas };
}
