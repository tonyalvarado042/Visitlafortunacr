/*
 * Baja candidatas de Wikimedia Commons para los LUGARES PÚBLICOS del catálogo.
 *
 *   node scripts/traer-fotos-de-lugares.mjs
 *
 * Por qué esto no repite el error de la primera vez. Commons se descartó en su
 * momento porque se usó para buscar "hoteles" y devolvía un Marriott de
 * Albuquerque: una imagen de CATEGORÍA, que no retrata al negocio del que habla
 * la ficha. Aquí es al revés — se busca un lugar con nombre propio, y una foto
 * del lago Arenal ES el lago Arenal. No hay categoría de por medio.
 *
 * Por eso la lista de abajo está escrita a mano y es corta: solo entran fichas
 * que son un sitio público, no un negocio. Un hotel nunca va aquí.
 *
 * Deja las candidatas en `.fotos/<babosa>/` como el recolector de sitios web,
 * así que sigue el mismo camino: limpiar, hoja de contacto, revisión a ojo.
 */
import { mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import sharp from 'sharp';

const SALIDA = '.fotos';
const MAX_POR_LUGAR = 8;
const ANCHO_MINIMO = 900;
const AGENTE = 'VisitLaFortunaCR/1.0 (https://visitlafortunacr.com; contacto@visitlafortunacr.com)';

// Lugar público → cómo se llama en Commons. Escrito a mano a propósito.
const LUGARES = {
  'lago-arenal': ['Lake Arenal', 'Laguna de Arenal Costa Rica'],
  'parque-nacional-volcan-arenal': ['Arenal Volcano National Park', 'Arenal Volcano'],
  'el-chollin': ['Tabacon River Costa Rica', 'Rio Tabacon'],
  'el-salto': ['El Salto La Fortuna', 'Rio Fortuna Costa Rica'],
};

async function buscar(termino) {
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', format: 'json', generator: 'search',
    gsrsearch: `filetype:bitmap ${termino}`, gsrnamespace: '6', gsrlimit: '20',
    prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '1600',
  });
  const r = await fetch(url, { headers: { 'user-agent': AGENTE }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) return [];
  const j = await r.json();
  return Object.values(j.query?.pages ?? {});
}

mkdirSync(SALIDA, { recursive: true });

for (const [babosa, terminos] of Object.entries(LUGARES)) {
  const carpeta = `${SALIDA}/${babosa}`;
  if (existsSync(carpeta) && readdirSync(carpeta).some((f) => /\.jpg$/i.test(f))) {
    console.log(`${babosa}: ya tiene, se salta`);
    continue;
  }

  const vistos = new Set();
  const origenes = [];
  let guardadas = 0;
  mkdirSync(carpeta, { recursive: true });

  for (const termino of terminos) {
    if (guardadas >= MAX_POR_LUGAR) break;
    let paginas = [];
    try { paginas = await buscar(termino); } catch { continue; }

    for (const pagina of paginas) {
      if (guardadas >= MAX_POR_LUGAR) break;
      const info = pagina.imageinfo?.[0];
      if (!info?.thumburl) continue;
      if (vistos.has(pagina.title)) continue;
      vistos.add(pagina.title);
      if ((info.width ?? 0) < ANCHO_MINIMO) continue;

      try {
        const r = await fetch(info.thumburl, { headers: { 'user-agent': AGENTE }, signal: AbortSignal.timeout(20000) });
        if (!r.ok) continue;
        const bytes = Buffer.from(await r.arrayBuffer());
        const meta = await sharp(bytes).metadata();
        const relacion = meta.width / (meta.height || 1);
        if (relacion > 2.8 || relacion < 0.5) continue;

        guardadas += 1;
        const archivo = `${String(guardadas).padStart(2, '0')}.jpg`;
        writeFileSync(`${carpeta}/${archivo}`, await sharp(bytes).jpeg({ quality: 88 }).toBuffer());
        const meta2 = pagina.imageinfo[0].extmetadata ?? {};
        origenes.push({
          archivo,
          titulo: pagina.title,
          autor: (meta2.Artist?.value ?? '').replace(/<[^>]*>/g, '').trim() || null,
          licencia: meta2.LicenseShortName?.value ?? null,
          pagina: info.descriptionurl,
        });
      } catch { /* imagen rota */ }
    }
  }

  writeFileSync(`${carpeta}/_origen.json`, JSON.stringify({ lugar: babosa, fuente: 'wikimedia commons', origenes }, null, 2));
  console.log(`${babosa}: ${guardadas} candidatas`);
}
