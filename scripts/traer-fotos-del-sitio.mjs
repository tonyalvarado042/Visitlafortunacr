/*
 * Baja imágenes candidatas desde el SITIO WEB DE CADA NEGOCIO, para que la
 * tarjeta muestre algo que de verdad corresponde a ese lugar mientras no haya
 * GOOGLE_PLACES_API_KEY.
 *
 *   node --env-file=.env.local scripts/traer-fotos-del-sitio.mjs
 *   node --env-file=.env.local scripts/traer-fotos-del-sitio.mjs --negocio don-rufino
 *
 * Deja los candidatos en fotos-entrada/_sitios/<babosa>/ y un informe en
 * datos/investigacion/fotos-de-sitios.json. NO sube nada: la elección final
 * pasa por una revisión a ojo (contactos con armar-contactos.mjs), porque hay
 * dos cosas que ningún filtro decide bien —si sale gente y si la foto de
 * verdad es del lugar—.
 *
 * Por qué de su propio sitio y no de un buscador de imágenes: es la fuente más
 * defendible que hay sin la API de Google. La `og:image` existe justamente para
 * que otros sitios la muestren al enlazar, y un negocio de un directorio gana
 * con que se le muestre su propia foto. No sustituye a un permiso, y por eso
 * queda anotado de dónde salió cada una y esto es temporal (ver regla 11).
 */
import { mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const SOLO = process.argv.includes('--negocio') ? process.argv[process.argv.indexOf('--negocio') + 1] : null;
const SALIDA = 'fotos-entrada/_sitios';
const INFORME = 'datos/investigacion/fotos-de-sitios.json';

const POR_NEGOCIO = 6;      // candidatos a bajar; la elección es después
const MIN_LADO = 600;       // por debajo no sirve ni para una tarjeta
const MIN_RELACION = 1.1;   // apaisada: la tarjeta recorta a lo ancho

/* Nombres que casi siempre son lo que NO queremos. Es un filtro barato que
   descarta la mayoría antes de gastar una descarga; lo que se cuele lo agarra
   la revisión a ojo. */
const RUIDO = /logo|icon|favicon|sprite|placeholder|avatar|banner-?ad|badge|boton|button|arrow|flecha|whatsapp|facebook|instagram|tripadvisor|footer|header-?bg|pattern|texture|loading|spinner|pixel|1x1|blank/i;
const GENTE = /team|staff|equipo|personal|nosotros|about-?us|guest|cliente|persona|people|portrait|retrato|familia|group|grupo|wedding|boda|novi/i;

const db = createClient('https://eulkufetcymallfbpone.supabase.co', process.env.SUPABASE_SECRET_KEY?.trim(), {
  db: { schema: 'destinos' }, auth: { persistSession: false },
});

const { data: destino } = await db.from('dst_destino').select('id').eq('babosa', 'la-fortuna').single();
let { data: negocios } = await db.from('dst_negocio')
  .select('babosa, nombre, sitio_web').eq('destino_id', destino.id).not('sitio_web', 'is', null).order('nombre');
if (SOLO) negocios = negocios.filter((n) => n.babosa === SOLO);

const cabeceras = { 'User-Agent': 'Mozilla/5.0 (compatible; VisitLaFortunaCR/1.0; +https://visitlafortunacr.com)' };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Junta candidatas de la portada: og:image, luego <img>, luego fondos CSS. */
function candidatasDe(html, base) {
  const urls = [];
  const meter = (u) => {
    if (!u) return;
    try {
      const abs = new URL(u.replace(/&amp;/g, '&').trim(), base).href;
      if (!/^https?:/i.test(abs)) return;
      if (!/\.(jpe?g|png|webp|avif)(\?|$)/i.test(abs)) return;
      if (RUIDO.test(abs)) return;
      if (!urls.includes(abs)) urls.push(abs);
    } catch { /* URL rota, se ignora */ }
  };

  // La og:image primero: es la que el negocio eligió para que se le muestre.
  for (const re of [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/gi,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/gi,
  ]) for (const m of html.matchAll(re)) meter(m[1]);

  // Después las del cuerpo. srcset primero, que suele traer la grande.
  for (const m of html.matchAll(/<img[^>]+>/gi)) {
    const tag = m[0];
    const srcset = tag.match(/srcset=["']([^"']+)["']/i);
    if (srcset) {
      const mayor = srcset[1].split(',').map((p) => p.trim().split(/\s+/)[0]).filter(Boolean).pop();
      meter(mayor);
    }
    for (const attr of ['data-src', 'data-lazy-src', 'data-original', 'src']) {
      const v = tag.match(new RegExp(`${attr}=["']([^"']+)["']`, 'i'));
      if (v) meter(v[1]);
    }
  }
  for (const m of html.matchAll(/background-image\s*:\s*url\((["']?)([^"')]+)\1\)/gi)) meter(m[2]);
  return urls;
}

mkdirSync(SALIDA, { recursive: true });
const informe = {};
let conFoto = 0, sinNada = 0;

for (const negocio of negocios) {
  const carpeta = `${SALIDA}/${negocio.babosa}`;
  if (existsSync(carpeta) && readdirSync(carpeta).length) {
    console.log(`${negocio.babosa.padEnd(34)} (ya estaba)`);
    conFoto++;
    continue;
  }

  let html;
  try {
    const res = await fetch(negocio.sitio_web, { headers: cabeceras, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    if (!res.ok) { console.log(`${negocio.babosa.padEnd(34)} http ${res.status}`); informe[negocio.babosa] = { error: `http ${res.status}` }; sinNada++; continue; }
    html = await res.text();
  } catch (e) {
    console.log(`${negocio.babosa.padEnd(34)} ${e.name === 'TimeoutError' ? 'sin respuesta' : e.message.slice(0, 40)}`);
    informe[negocio.babosa] = { error: e.message.slice(0, 80) };
    sinNada++;
    continue;
  }

  const candidatas = candidatasDe(html, negocio.sitio_web);
  const guardadas = [];
  for (const url of candidatas) {
    if (guardadas.length >= POR_NEGOCIO) break;
    try {
      const r = await fetch(url, { headers: cabeceras, signal: AbortSignal.timeout(20000) });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      const meta = await sharp(buf).metadata();
      if (!meta.width || meta.width < MIN_LADO) continue;
      if (meta.width / meta.height < MIN_RELACION) continue;   // vertical, no sirve
      mkdirSync(carpeta, { recursive: true });
      const nombre = `${String(guardadas.length + 1).padStart(2, '0')}${GENTE.test(url) ? '-ojo' : ''}.jpg`;
      // Se guarda ya reducida: no hace falta HD para una tarjeta, y así el
      // archivo local pesa poco y la revisión a ojo es rápida.
      await writeFile(`${carpeta}/${nombre}`, await sharp(buf).resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer());
      guardadas.push({ archivo: nombre, origen: url, ancho: meta.width, alto: meta.height });
    } catch { /* imagen rota o bloqueada; se pasa a la siguiente */ }
  }

  informe[negocio.babosa] = { nombre: negocio.nombre, sitio_web: negocio.sitio_web, candidatas: guardadas };
  console.log(`${negocio.babosa.padEnd(34)} ${guardadas.length} de ${candidatas.length} candidatas`);
  if (guardadas.length) conFoto++; else sinNada++;
  await dormir(600);   // no se atropella al servidor de nadie
}

mkdirSync('datos/investigacion', { recursive: true });
writeFileSync(INFORME, JSON.stringify({
  _lee_esto: 'Imagenes candidatas bajadas del sitio web de cada negocio, para que la ficha muestre algo que corresponde mientras no haya GOOGLE_PLACES_API_KEY. Cada una guarda de que URL salio. NO estan aprobadas: la eleccion final es a ojo, porque si sale gente y si la foto es del lugar no lo decide un filtro. Ver regla 11 del CLAUDE.md: esto es temporal.',
  generado_en: new Date().toISOString().slice(0, 10),
  negocios: informe,
}, null, 2) + '\n', 'utf8');

console.log(`\n${conFoto} negocios con candidatas · ${sinNada} sin nada`);
console.log(`informe en ${INFORME} · archivos en ${SALIDA}/`);
