/*
 * Direcciones de correo: leerlas, y decidir si una nos pertenece.
 *
 * ⚠️ ESTE ARCHIVO NO IMPORTA NADA, A PROPÓSITO.
 *
 * Vivía dentro de `entrante.ts`, que arranca con `import 'server-only'` — y
 * eso lo vuelve imposible de importar desde un script, porque ese paquete solo
 * existe dentro del empaquetado de Next. Resultado: la única parte del correo
 * entrante que se puede probar sin base de datos y sin MX era, justamente, la
 * que no se podía probar.
 *
 * Acá se prueba: `npm run entrante:probar`.
 */

/** La dirección pelada: «Hannah <a@b.com>» → «a@b.com». */
export function soloDireccion(crudo: string): string {
  const entre = crudo.match(/<([^>]+)>/);
  return (entre ? entre[1] : crudo).trim().toLowerCase();
}

/*
 * Lo que el viajero escribió, sin la conversación anterior pegada abajo.
 *
 * Cuando alguien da «Responder», el cliente de correo cita TODO el hilo. Sin
 * esto, cada respuesta guardaría el historial completo otra vez, el panel se
 * vuelve ilegible y la IA lee el correo viejo como si fuera nuevo —y contesta
 * lo que ya contestó—.
 *
 * Se corta en la primera marca de cita. No es perfecto: ningún recorte de
 * citas lo es, cada cliente inventa la suya. Por eso el cuerpo COMPLETO se
 * guarda igual en los metadatos del mensaje: si algún día un recorte se come
 * algo que importaba, está ahí para recuperarlo.
 */
const MARCAS_DE_CITA = [
  /^\s*On .+ wrote:\s*$/im,
  /^\s*El .+ escribió:\s*$/im,
  /^\s*-----\s*Original Message\s*-----\s*$/im,
  /^\s*_{10,}\s*$/m,
  /^\s*De:\s.+$/im,
  /^\s*From:\s.+$/im,
];

export function soloLoNuevo(cuerpo: string): string {
  let corte = cuerpo.length;
  for (const marca of MARCAS_DE_CITA) {
    const encontrado = cuerpo.match(marca);
    if (encontrado?.index !== undefined && encontrado.index < corte) corte = encontrado.index;
  }
  const limpio = cuerpo.slice(0, corte)
    /* Las líneas que empiezan con «>» son cita en cualquier cliente. */
    .split('\n').filter((l) => !/^\s*>/.test(l)).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  /* Si el recorte dejó vacío, vale más el cuerpo entero que nada. */
  return limpio || cuerpo.trim();
}

/**
 * Recibe un correo y lo mete en la conversación del viajero.
 *
 * No lanza nunca: un correo que no se puede procesar no puede tumbar al
 * Worker ni hacer que el proveedor lo reintente en bucle. Devuelve el motivo.
 */
/*
 * ⚠️ UNA DIRECCION DE VERDAD, ANTES DE METERLA EN UNA CONSULTA.
 *
 * `.or()` de PostgREST se arma con comas y parentesis, y la direccion de
 * destino la elige quien escribe. Sin este filtro, un «x@a.com),algo.eq.y»
 * podria cerrar el filtro y abrir otro. Se exige minusculas porque
 * `recibirCorreo` ya baja todo antes de llamar.
 */
export function direccionSana(para: string): boolean {
  return /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(para);
}

/*
 * Los dominios con los que una direccion puede reclamar un destino.
 *
 * ⚠️ POR QUE UN SUBDOMINIO TIENE QUE VALER: el correo entrante va a llegar a
 * `correo.visitlafortunacr.com`, NO al dominio pelado, porque el apex ya
 * recibe correo por SiteGround y no se puede tocar. Sin esto, la respuesta de
 * un viajero no encontraba destino y se perdia con una linea en los
 * registros — el agujero mas caro del sistema, el que este archivo existe
 * para tapar.
 *
 * Se recortan etiquetas por la izquierda y cada resto se compara ENTERO
 * contra `dst_destino.dominio`. Por eso:
 *   correo.visitlafortunacr.com   -> [correo.visitlafortunacr.com, visitlafortunacr.com, com]  ✅ engancha
 *   visitlafortunacr.com.ajeno.com -> [..., com.ajeno.com, ajeno.com, com]                     ❌ no engancha
 *   mal-visitlafortunacr.com      -> [mal-visitlafortunacr.com, com]                           ❌ no engancha
 */
export function dominiosPosibles(para: string): string[] {
  /* Segura SOLA, no porque quien la llama se acordo de preguntar primero.
     Sin esta linea, 'x@a.com,dominio.eq.visitlafortunacr.com' devolvia
     'visitlafortunacr.com' entre los posibles —al partir por puntos ese
     pedazo aparece igual— y habria enganchado nuestro destino. Hoy no hace
     dano porque recibirCorreo corta antes, pero eso es una trampa puesta
     para el proximo que la use. La agarro scripts/probar-correo-entrante.mts. */
  if (!direccionSana(para)) return [];
  const partes = (para.split('@')[1] ?? '').split('.').filter(Boolean);
  const dominios: string[] = [];
  while (partes.length >= 2) { dominios.push(partes.join('.')); partes.shift(); }
  return dominios;
}
