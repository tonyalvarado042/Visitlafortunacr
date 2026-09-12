/*
 * Comprueba qué candidatos a negocio existen de verdad y baja sus fotos.
 *
 *   node scripts/explorar-candidatos.mjs
 *
 * Lee `datos/investigacion/candidatos-negocios.json`, prueba los dominios de
 * cada uno y se queda con el primero que pase DOS filtros:
 *
 *   1. el <title> habla de ese negocio, y
 *   2. la página menciona La Fortuna, Arenal o Costa Rica.
 *
 * Los dos hacen falta. Solo el primero deja pasar cadenas con el mismo nombre
 * en otro país; solo el segundo deja pasar cualquier empresa tica. Aun así la
 * palabra final la tiene la revisión a ojo de las fotos.
 *
 * Deja las candidatas en `.fotos/<babosa>/`, igual que el recolector de
 * sitios, así que sigue el mismo camino: limpiar, hoja de contacto, elegir.
 * NO escribe en la base: insertar los negocios es otro paso.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import sharp from 'sharp';

const SALIDA = '.fotos';
const MAX = 8;
const ANCHO_MINIMO = 600;
const AGENTE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const LOCAL = /(la\s*fortuna|arenal|costa\s*rica|\+506)/i;

const PALABRAS_BASURA = new Set(['logo', 'logos', 'icon', 'icons', 'favicon', 'sprite', 'placeholder',
  'avatar', 'badge', 'boton', 'button', 'arrow', 'whatsapp', 'facebook', 'instagram', 'twitter',
  'tiktok', 'youtube', 'tripadvisor', 'booking', 'pixel', 'spacer', 'pattern', 'texture', 'loader',
  'spinner', 'cart', 'stars', 'rating', 'flag', 'qr', 'cert', 'watermark', 'plugin', 'plugins',
  'theme', 'themes', 'ui', 'svg']);

const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

function esBasura(url) {
  let ruta; try { ruta = new URL(url).pathname; } catch { return true; }
  const trozo = ruta.split('/').filter(Boolean).slice(-2).join('/');
  if (trozo.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).some((p) => PALABRAS_BASURA.has(p))) return true;
  return /-\d{1,3}x\d{1,3}\./.test(trozo);
}

function imagenesDe(html, base) {
  const urls = [];
  const meter = (u) => {
    if (!u) return;
    try {
      const abs = new URL(u.trim().split(/\s+/)[0].replace(/&amp;/g, '&'), base).href;
      if (/^https?:/.test(abs) && !urls.includes(abs)) urls.push(abs);
    } catch { /* URL basura */ }
  };
  for (const m of html.matchAll(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi)) meter(m[1]);
  for (const m of html.matchAll(/<img[^>]+>/gi)) {
    const t = m[0];
    const set = t.match(/\s(?:data-)?srcset=["']([^"']+)["']/i)?.[1];
    if (set) meter(set.split(',').pop());
    meter(t.match(/\sdata-(?:src|lazy-src|original)=["']([^"']+)["']/i)?.[1] || t.match(/\ssrc=["']([^"']+)["']/i)?.[1]);
  }
  for (const m of html.matchAll(/<source[^>]+srcset=["']([^"']+)["']/gi)) meter(m[1].split(',').pop());
  for (const m of html.matchAll(/url\(\s*["']?([^"')]+\.(?:jpe?g|png|webp|avif)[^"')]*)["']?\s*\)/gi)) meter(m[1]);
  for (const m of html.matchAll(/https?:\/\/[^"'\s)\\]+\.(?:jpe?g|png|webp|avif)(?:\?[^"'\s)\\]*)?/gi)) meter(m[0]);
  return urls.filter((u) => !esBasura(u) && /\.(jpe?g|png|webp|avif)(\?|$)/i.test(u));
}

const bajar = (u, ms = 15000) => fetch(u, {
  headers: { 'user-agent': AGENTE }, redirect: 'follow', signal: AbortSignal.timeout(ms),
});

const { candidatos } = JSON.parse(readFileSync('datos/investigacion/candidatos-negocios.json', 'utf8'));
mkdirSync(SALIDA, { recursive: true });
const hallados = {};

for (const [i, c] of candidatos.entries()) {
  if (existsSync(`${SALIDA}/${c.babosa}`) && readdirSync(`${SALIDA}/${c.babosa}`).some((f) => /\.jpg$/i.test(f))) {
    console.log(`[${i + 1}/${candidatos.length}] ${c.babosa}: ya tiene`);
    continue;
  }

  let sitio = null; let html = null; let titulo = '';
  const fuertes = sinTildes(c.nombre).toLowerCase().split(/[^a-z0-9]+/).filter((p) => p.length > 3);

  for (const url of c.dominios) {
    try {
      const r = await bajar(url);
      if (!r.ok) continue;
      const cuerpo = await r.text();
      const t = (cuerpo.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').trim();
      const tl = sinTildes(t).toLowerCase();
      if (!fuertes.some((p) => tl.includes(p))) continue;
      if (!LOCAL.test(sinTildes(cuerpo).toLowerCase())) continue;
      sitio = r.url; html = cuerpo; titulo = t; break;
    } catch { /* no resuelve */ }
  }

  if (!sitio) { console.log(`[${i + 1}/${candidatos.length}] ${c.babosa}: — no se encontró`); continue; }

  const carpeta = `${SALIDA}/${c.babosa}`;
  mkdirSync(carpeta, { recursive: true });
  let guardadas = 0;
  const origenes = [];

  for (const url of imagenesDe(html, sitio)) {
    if (guardadas >= MAX) break;
    try {
      const r = await bajar(url);
      if (!r.ok) continue;
      const bytes = Buffer.from(await r.arrayBuffer());
      if (bytes.length < 15000) continue;
      const meta = await sharp(bytes).metadata();
      if (!meta.width || meta.width < ANCHO_MINIMO) continue;
      const rel = meta.width / (meta.height || 1);
      if (rel > 2.8 || rel < 1 / 2.8) continue;
      guardadas += 1;
      const archivo = `${String(guardadas).padStart(2, '0')}.jpg`;
      writeFileSync(`${carpeta}/${archivo}`, bytes);
      origenes.push({ archivo, url, ancho: meta.width, alto: meta.height });
    } catch { /* imagen rota */ }
  }

  writeFileSync(`${carpeta}/_origen.json`, JSON.stringify({ negocio: c.nombre, sitio, titulo, origenes }, null, 2));
  hallados[c.babosa] = { nombre: c.nombre, categoria: c.categoria, sitio_web: sitio, titulo, fotos: guardadas };
  console.log(`[${i + 1}/${candidatos.length}] ${c.babosa}: ${guardadas} fotos · ${sitio}`);
  console.log(`      "${titulo.slice(0, 80)}"`);
}

writeFileSync('.candidatos-hallados.json', JSON.stringify(hallados, null, 2));
const conFoto = Object.values(hallados).filter((h) => h.fotos > 0).length;
console.log(`\n${Object.keys(hallados).length} sitios verificados · ${conFoto} con al menos una foto`);
