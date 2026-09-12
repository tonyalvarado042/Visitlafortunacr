/*
 * Baja fotos candidatas del sitio web de cada negocio.
 *
 *   node scripts/traer-fotos-del-sitio.mjs                 (todos los que falten)
 *   node scripts/traer-fotos-del-sitio.mjs --solo babosa   (uno solo, para probar)
 *
 * Lee `.negocios.json` (lo genera el paso anterior desde la base) y deja las
 * candidatas en `.fotos/<babosa>/`. NO sube nada y NO escribe en la base: eso
 * es `cargar-fotos.mjs`, y en medio va una revisión a ojo.
 *
 * Por qué en medio va una persona mirando: el problema de este trabajo no es
 * bajar imágenes, es que la imagen sea DEL NEGOCIO. Una portada trae el logo,
 * el mapa, la foto de stock del banner y a veces una foto de otro país que al
 * dueño le pareció linda. Ningún filtro automático distingue eso; el filtro de
 * aquí abajo solo saca la basura evidente para que la revisión sea corta.
 *
 * Es reanudable: un negocio que ya tiene carpeta con archivos se salta.
 */
import { mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const SALIDA = '.fotos';
const MAX_POR_NEGOCIO = 8;
const ANCHO_MINIMO = 600;       // menos que esto es miniatura, icono o logo
const RELACION_MAXIMA = 2.8;    // más ancho que esto es un banner o una tira
const ESPERA_MS = 12000;

const soloIdx = process.argv.indexOf('--solo');
const SOLO = soloIdx > -1 ? process.argv[soloIdx + 1] : null;
const REINTENTAR = process.argv.includes('--reintentar');

const AGENTE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/*
 * Nombres que delatan que la imagen no retrata al negocio.
 *
 * OJO CON CÓMO SE COMPARA, que aquí hubo un error caro: la primera versión era
 * una sola expresión regular contra la URL entera, y `star` coincidía dentro de
 * "co-STAR-ica". Eso bloqueó EN SILENCIO todas las imágenes de cualquier
 * dominio *costarica*.com — The Springs perdió sus 122 fotos y parecía que el
 * sitio no tenía ninguna. Por eso ahora se compara por PALABRAS del nombre de
 * archivo y su carpeta, partiendo por - _ . y /, y no por subcadena.
 *
 * `banner` tampoco está: en media web el "banner" o el "slider" de la portada
 * es justamente la foto grande y buena del lugar (Don Rufino tenía ahí las
 * suyas). Lo que se descarta es el adorno, no lo grande.
 */
const PALABRAS_BASURA = new Set([
  'logo', 'logos', 'icon', 'icons', 'favicon', 'sprite', 'placeholder', 'avatar',
  'badge', 'boton', 'button', 'arrow', 'flecha', 'whatsapp', 'facebook', 'fb',
  'instagram', 'ig', 'twitter', 'tiktok', 'youtube', 'tripadvisor', 'booking',
  'pixel', 'spacer', 'pattern', 'texture', 'loader', 'spinner', 'cart',
  'estrella', 'stars', 'rating', 'flag', 'bandera', 'qr', 'cert', 'sello',
  'watermark', 'marca', 'plugin', 'plugins', 'theme', 'themes', 'ui', 'svg',
]);

function esBasura(url) {
  let ruta;
  try { ruta = new URL(url).pathname; } catch { return true; }
  // Solo el archivo y su carpeta: el resto del path es del sitio, no de la foto.
  const trozo = ruta.split('/').filter(Boolean).slice(-2).join('/');
  const palabras = trozo.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (palabras.some((p) => PALABRAS_BASURA.has(p))) return true;
  // Miniaturas de WordPress y similares: nombre-150x150.jpg
  if (/-\d{1,3}x\d{1,3}\./.test(trozo)) return true;
  return false;
}

async function bajar(url, ms = ESPERA_MS) {
  const corte = AbortSignal.timeout(ms);
  return fetch(url, { signal: corte, redirect: 'follow', headers: { 'user-agent': AGENTE, accept: '*/*' } });
}

/*
 * De dónde salen las imágenes de una página, en orden de calidad esperada.
 *
 * Ojo: mirar solo <img> y og:image deja fuera media web moderna. Trece sitios
 * dieron CERO candidatas en la primera pasada —The Springs, Desafío, Don
 * Rufino— y ninguno tenía la web vacía: usaban fondos CSS, <picture> o galerías
 * en otra página. Cada bloque de aquí abajo nació de uno de esos casos.
 */
function imagenesDe(html, base) {
  const urls = [];
  const meter = (u) => {
    if (!u) return;
    try {
      const abs = new URL(u.trim().split(/\s+/)[0].replace(/&amp;/g, '&'), base).href;
      if (/^https?:/.test(abs) && !urls.includes(abs)) urls.push(abs);
    } catch { /* URL basura en el HTML, se ignora */ }
  };

  // La og:image va primera a propósito: es la que el negocio eligió para que
  // otros sitios la muestren al enlazarlo, así que suele ser la buena.
  for (const re of [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/gi,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/gi,
  ]) for (const m of html.matchAll(re)) meter(m[1]);

  for (const m of html.matchAll(/<img[^>]+>/gi)) {
    const tag = m[0];
    const src = tag.match(/\ssrc=["']([^"']+)["']/i)?.[1];
    const lazy = tag.match(/\sdata-(?:src|lazy-src|original|bg|image)=["']([^"']+)["']/i)?.[1];
    const set = tag.match(/\s(?:data-)?srcset=["']([^"']+)["']/i)?.[1];
    // Del srcset se toma la última, que es la de mayor resolución.
    if (set) meter(set.split(',').pop());
    meter(lazy || src);
  }

  // <picture><source srcset>: lo usan los sitios que sirven webp con respaldo.
  for (const m of html.matchAll(/<source[^>]+srcset=["']([^"']+)["']/gi)) meter(m[1].split(',').pop());

  // Fondos CSS, en atributo style y en <style>. Aquí estaban las de los hoteles
  // con portada a pantalla completa, que no usan <img> en absoluto.
  for (const m of html.matchAll(/url\(\s*["']?([^"')]+\.(?:jpe?g|png|webp|avif)[^"')]*)["']?\s*\)/gi)) meter(m[1]);

  // JSON-LD y estado embebido: "image":"..." o "image":["...","..."].
  for (const m of html.matchAll(/"(?:image|contentUrl|thumbnailUrl|url)"\s*:\s*"([^"]+\.(?:jpe?g|png|webp)[^"]*)"/gi)) meter(m[1]);

  // Último recurso: cualquier URL absoluta que termine en imagen, esté donde
  // esté en el HTML. Hace falta para los sitios que pintan la galería desde su
  // propia API en otro host (La Choza de Laurel sirve desde railway.app) y que
  // por eso no aparecen en ninguno de los patrones de arriba.
  for (const m of html.matchAll(/https?:\/\/[^"'\s)\\]+\.(?:jpe?g|png|webp|avif)(?:\?[^"'\s)\\]*)?/gi)) meter(m[0]);

  return urls.filter((u) => !esBasura(u) && /\.(jpe?g|png|webp|avif)(\?|$)/i.test(u));
}

/** Enlaces internos que suelen llevar a las fotos buenas. */
function paginasDeFotos(html, base) {
  const paginas = [];
  const interesa = /galer|gallery|foto|photo|habitacion|room|suite|nosotros|about|instalacion|servicio|tour|menu/i;
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi)) {
    if (!interesa.test(m[1])) continue;
    try {
      const abs = new URL(m[1], base);
      if (abs.hostname !== new URL(base).hostname) continue;
      if (!paginas.includes(abs.href)) paginas.push(abs.href);
    } catch { /* href raro */ }
  }
  return paginas.slice(0, 3);
}

const negocios = JSON.parse(readFileSync('.negocios.json', 'utf8'))
  .filter((n) => n.sitio_web)
  .filter((n) => !SOLO || n.babosa === SOLO);

mkdirSync(SALIDA, { recursive: true });
const informe = [];

for (const [i, negocio] of negocios.entries()) {
  const carpeta = `${SALIDA}/${negocio.babosa}`;
  // Una carpeta con solo _origen.json es un intento que no dio nada: con
  // --reintentar se vuelve a probar, que es lo que hay que hacer después de
  // mejorar el extractor.
  const yaTiene = existsSync(carpeta) && readdirSync(carpeta).some((f) => /\.jpg$/i.test(f));
  if (yaTiene || (existsSync(carpeta) && !REINTENTAR)) {
    console.log(`[${i + 1}/${negocios.length}] ${negocio.babosa}: ya ${yaTiene ? 'tiene' : 'se intentó'}, se salta`);
    continue;
  }

  let html;
  try {
    const r = await bajar(negocio.sitio_web);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    html = await r.text();
  } catch (e) {
    console.log(`[${i + 1}/${negocios.length}] ${negocio.babosa}: NO ABRE (${e.message})`);
    informe.push({ babosa: negocio.babosa, sitio: negocio.sitio_web, error: e.message, bajadas: 0 });
    continue;
  }

  let candidatas = imagenesDe(html, negocio.sitio_web);

  // Si la portada no da para elegir, se entra a la galería. No se hace siempre
  // porque son más peticiones por negocio y la portada suele bastar.
  if (candidatas.length < 4) {
    for (const pagina of paginasDeFotos(html, negocio.sitio_web)) {
      try {
        const r = await bajar(pagina);
        if (!r.ok) continue;
        const mas = imagenesDe(await r.text(), pagina);
        candidatas = [...new Set([...candidatas, ...mas])];
        if (candidatas.length >= MAX_POR_NEGOCIO * 2) break;
      } catch { /* subpágina caída */ }
    }
  }

  mkdirSync(carpeta, { recursive: true });

  let guardadas = 0;
  const huellas = new Set();
  const origenes = [];

  for (const url of candidatas) {
    if (guardadas >= MAX_POR_NEGOCIO) break;
    try {
      const r = await bajar(url, 15000);
      if (!r.ok) continue;
      const bytes = Buffer.from(await r.arrayBuffer());
      if (bytes.length < 15000) continue; // menos de 15 kB no es una foto de verdad

      const meta = await sharp(bytes).metadata();
      if (!meta.width || meta.width < ANCHO_MINIMO) continue;
      const relacion = meta.width / (meta.height || 1);
      if (relacion > RELACION_MAXIMA || relacion < 1 / RELACION_MAXIMA) continue;

      const huella = createHash('md5').update(bytes).digest('hex');
      if (huellas.has(huella)) continue;
      huellas.add(huella);

      guardadas += 1;
      writeFileSync(`${carpeta}/${String(guardadas).padStart(2, '0')}.jpg`, bytes);
      origenes.push({ archivo: `${String(guardadas).padStart(2, '0')}.jpg`, url, ancho: meta.width, alto: meta.height });
    } catch { /* imagen rota o formato que sharp no lee */ }
  }

  writeFileSync(`${carpeta}/_origen.json`, JSON.stringify({ negocio: negocio.nombre, sitio: negocio.sitio_web, origenes }, null, 2));
  console.log(`[${i + 1}/${negocios.length}] ${negocio.babosa}: ${guardadas} candidatas de ${candidatas.length} vistas`);
  informe.push({ babosa: negocio.babosa, sitio: negocio.sitio_web, bajadas: guardadas, vistas: candidatas.length });
}

writeFileSync(`${SALIDA}/_informe.json`, JSON.stringify(informe, null, 2));
const conAlgo = informe.filter((r) => r.bajadas > 0).length;
console.log(`\n${conAlgo} de ${informe.length} sitios dieron al menos una candidata.`);
console.log(`Sin nada: ${informe.filter((r) => !r.bajadas).map((r) => r.babosa).join(', ') || 'ninguno'}`);
