/*
 * Tapar el contacto de una ficha, como hace encuentra24.
 *
 * La idea: la ficha se ve entera —fotos, descripción, horario, reseñas— pero
 * el teléfono y el sitio van a medias. Para verlos, la persona dice quién es.
 * A cambio, el negocio se entera de que alguien preguntó por él y queda el
 * lead.
 *
 * La regla que no se puede romper: **lo tapado nunca viaja al navegador**.
 * Si el teléfono completo sale en el HTML y encima se le pone una nube con
 * CSS, cualquiera lo lee con ver-código y el muro es decorado. Por eso estas
 * funciones corren en el servidor y lo que se manda es solo la pista.
 */

/**
 * Un teléfono a medias: se deja ver el país y el principio, se tapan los
 * últimos cuatro. Alcanza para que se vea real y no alcanza para marcarlo.
 */
export function telefonoTapado(telefono: string | null): string | null {
  if (!telefono) return null;
  const digitos = telefono.replace(/\D/g, '');
  if (digitos.length < 6) return '•••• ••••';

  /* El código de país va aparte. Agrupando todo junto sale "+5062 479 ••••",
     que a un tico le parece un número mal escrito; separado sale
     "+506 2479 ••••", que se lee como un teléfono de verdad. */
  const conMas = telefono.trim().startsWith('+');
  const pais = conMas ? digitos.slice(0, 3) : '';
  const local = conMas ? digitos.slice(3) : digitos;

  if (local.length <= 4) return `${conMas ? `+${pais} ` : ''}••••`;

  const visibles = local.slice(0, local.length - 4).replace(/(\d{4})(?=\d)/g, '$1 ');
  return `${conMas ? `+${pais} ` : ''}${visibles} ••••`;
}

/** El dominio a medias: se ve que existe y de qué tipo es, no cuál. */
export function sitioTapado(sitio: string | null): string | null {
  if (!sitio) return null;
  const limpio = sitio.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '');
  const punto = limpio.lastIndexOf('.');
  if (punto <= 0) return '•••••••••';

  const nombre = limpio.slice(0, punto);
  const cola = limpio.slice(punto); // .com, .cr…
  return `${nombre.slice(0, 2)}${'•'.repeat(Math.max(nombre.length - 2, 3))}${cola}`;
}

/** El correo a medias. Se deja el dominio: dice si es serio sin darlo. */
export function correoTapado(correo: string | null): string | null {
  if (!correo) return null;
  const arroba = correo.indexOf('@');
  if (arroba <= 0) return null;
  const usuario = correo.slice(0, arroba);
  return `${usuario.slice(0, 1)}${'•'.repeat(Math.max(usuario.length - 1, 3))}${correo.slice(arroba)}`;
}

export type ContactoReal = {
  telefono: string | null;
  telefono_whatsapp: string | null;
  sitio_web: string | null;
  email: string | null;
};

export type ContactoTapado = {
  telefono: string | null;
  whatsapp: string | null;
  sitio: string | null;
  email: string | null;
  /** Cuántas vías de contacto hay. Si es 0, no hay nada que desbloquear. */
  cuantas: number;
};

export function taparContacto(c: ContactoReal): ContactoTapado {
  const cuantas = [c.telefono, c.telefono_whatsapp, c.sitio_web, c.email]
    .filter(Boolean).length;
  return {
    telefono: telefonoTapado(c.telefono),
    whatsapp: telefonoTapado(c.telefono_whatsapp),
    sitio: sitioTapado(c.sitio_web),
    email: correoTapado(c.email),
    cuantas,
  };
}
