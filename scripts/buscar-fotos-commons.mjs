/*
 * Busca en Wikimedia Commons fotos con licencia libre para ilustrar las
 * categorías del directorio, y deja el resultado en
 * datos/investigacion/fotos-commons.json para revisarlo ANTES de bajar nada.
 *
 *   node scripts/buscar-fotos-commons.mjs            (busca y escribe el JSON)
 *   node scripts/buscar-fotos-commons.mjs --bajar    (además baja los archivos)
 *
 * Por qué Commons y no una búsqueda de imágenes cualquiera: su API devuelve la
 * licencia y el autor de cada archivo, que es lo único que permite llenar
 * `dst_negocio_foto.credito` con algo cierto. Una foto bajada de un blog no
 * trae eso, y ponerle un crédito inventado no la vuelve usable.
 *
 * Solo se aceptan las licencias de LIBRES: dominio público, CC0, CC BY y
 * CC BY-SA. Las NC ("non commercial") quedan fuera a propósito: esto es un
 * sitio comercial.
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';

const BAJAR = process.argv.includes('--bajar');
const SALIDA = 'datos/investigacion/fotos-commons.json';
const DESTINO_ARCHIVOS = 'fotos-entrada/_commons';

// Licencias que permiten uso comercial. El resto se descarta.
const LIBRES = [/^cc0/i, /^public domain/i, /^pd/i, /^cc by \d/i, /^cc by-sa/i];
const esLibre = (lic) => !!lic && LIBRES.some((r) => r.test(lic.trim())) && !/nc/i.test(lic.replace(/^cc by-nc.*/i, 'NC'));

const ANCHO = 1600;
const MIN_ANCHO = 1400;   // por debajo de esto se ve mal en una tarjeta grande

/* Cuántas fotos hacen falta por categoría. NO es un número fijo: es cuántos
   negocios tiene esa categoría en La Fortuna. Con tres por categoría, los seis
   resorts salían con la MISMA imagen uno al lado del otro en la retícula, y
   eso se ve peor que no tener foto. El tope de 14 es donde Commons se seca. */
const NECESITA = {
  'cocina-internacional': 14, 'hoteles': 12, 'aguas-termales': 10, 'comida-tipica': 10,
  'resorts': 6, 'lodges': 6, 'vida-silvestre': 5,
  'canopy': 3, 'cafe-y-chocolate': 3, 'hospedaje-lujo': 3,
  'canyoning': 2, 'tours-aventura': 2, 'hostales': 2, 'cataratas': 2,
  'volcan': 2, 'atracciones': 2,
  'rafting': 1, 'shuttles': 1, 'alquiler-de-autos': 1, 'saludable': 1,
  'puentes-colgantes': 1, 'parques-nacionales': 1, 'bares': 1,
};
const cuantas = (categoria) => NECESITA[categoria] ?? 3;

/* Términos de búsqueda por categoría. Sesgados a Costa Rica donde Commons
   tiene material; donde no lo tiene, al concepto genérico. */
const BUSQUEDAS = {
  'aguas-termales':      ['Tabacon hot springs', 'hot spring pool Costa Rica', 'thermal pool jungle', 'hot spring bathing', 'thermal bath outdoor', 'onsen outdoor rock pool', 'natural hot spring river'],
  'volcan':              ['Arenal Volcano', 'Arenal Volcano Costa Rica', 'volcano eruption night', 'stratovolcano landscape'],
  'parques-nacionales':  ['Arenal Volcano National Park', 'rainforest trail Costa Rica'],
  'cataratas':           ['La Fortuna Waterfall', 'Catarata Rio Fortuna', 'waterfall Costa Rica rainforest'],
  'puentes-colgantes':   ['hanging bridge rainforest Costa Rica', 'canopy bridge jungle'],
  'canopy':              ['zip line Costa Rica', 'canopy tour zipline rainforest'],
  'canyoning':           ['canyoning waterfall rappel', 'rappelling waterfall'],
  'rafting':             ['whitewater rafting Costa Rica', 'rafting river rapids'],
  'vida-silvestre':      ['sloth Costa Rica', 'toucan Costa Rica', 'red eyed tree frog Costa Rica', 'howler monkey Costa Rica', 'hummingbird Costa Rica', 'morpho butterfly'],
  'cafe-y-chocolate':    ['coffee plantation Costa Rica', 'cacao pods Costa Rica', 'coffee cherries harvest'],
  'hoteles':             ['hotel pool tropical Costa Rica', 'tropical resort pool palm', 'hotel room interior double bed', 'hotel lobby tropical', 'hotel balcony garden view', 'hotel breakfast terrace', 'guesthouse tropical garden', 'hotel facade tropical'],
  'resorts':             ['resort infinity pool tropical', 'tropical resort garden pool', 'resort poolside loungers', 'spa massage room', 'resort restaurant terrace', 'palm garden resort'],
  // Commons es un archivo documental, no un banco de fotos de folleto: los
  // terminos de agencia ("luxury villa infinity pool") no devuelven nada.
  'lodges':              ['ecolodge', 'bungalow tropical', 'cabin forest lodge', 'jungle lodge veranda', 'wooden cabin rainforest', 'treehouse lodge'],
  'hospedaje-lujo':      ['hotel suite interior', 'swimming pool hotel garden', 'hotel terrace view'],
  'hostales':            ['hostel dormitory bunk', 'backpacker hostel common room'],
  'comida-tipica':       ['casado Costa Rican food', 'gallo pinto', 'Costa Rican cuisine plate', 'ceviche dish', 'patacones plantain', 'tamal food', 'arroz con pollo', 'black bean soup', 'fried yuca'],
  'cocina-internacional':['restaurant table food plating', 'grilled steak plate restaurant', 'wood fired pizza', 'sushi platter', 'pasta dish restaurant', 'seafood platter restaurant', 'burger plate restaurant', 'lomo saltado', 'grilled fish plate', 'restaurant dining room interior', 'chef plating dish', 'tacos plate', 'paella', 'barbecue ribs plate'],
  'saludable':           ['salad bowl healthy food', 'vegetarian plate fresh'],
  'bares':               ['cocktail bar counter', 'cocktails tropical bar'],
  'atracciones':         ['Arenal lake Costa Rica', 'Lake Arenal'],
  'tours-aventura':      ['ATV tour jungle', 'adventure tour rainforest group'],
  'shuttles':            ['minivan shuttle van', 'tourist van transport'],
  'alquiler-de-autos':   ['4x4 SUV dirt road', 'rental car road trip'],
};

const api = 'https://commons.wikimedia.org/w/api.php';
const limpiar = (html) => String(html ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/* Commons corta por ritmo, y cuando lo hace NO devuelve JSON ni un código de
   error: devuelve texto plano con 200. Si eso se trata como "sin resultados",
   el script miente y dice que no hay fotos. Por eso se detecta y se reintenta. */
async function buscar(termino, intento = 0) {
  const url = `${api}?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(termino)}`
            + `&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url|extmetadata|size|user&iiurlwidth=${ANCHO}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'VisitLaFortunaCR/1.0 (directorio turistico; contacto hola@visitlafortunacr.com)' } });
  const cuerpo = await res.text();
  if (!res.ok || /too many requests/i.test(cuerpo)) {
    if (intento >= 4) { console.log(`  ! ${termino}: cortado por ritmo, me rindo`); return []; }
    const espera = 5000 * (intento + 1);
    console.log(`  · ${termino}: cortado por ritmo, espero ${espera / 1000}s`);
    await dormir(espera);
    return buscar(termino, intento + 1);
  }
  let json;
  try { json = JSON.parse(cuerpo); } catch { console.log(`  ! ${termino}: respuesta ilegible`); return []; }
  const paginas = json.query?.pages ?? {};
  return Object.values(paginas).map((p) => {
    const i = p.imageinfo?.[0];
    if (!i) return null;
    const m = i.extmetadata ?? {};
    /* Cuando el archivo dice "Own work", el autor ES quien lo subio, y
       Commons a veces no rellena Artist. Sin ese respaldo se pierden fotos
       perfectamente usables, o peor: se usan sin nombrar a nadie. */
    const propia = /own work|trabajo propio/i.test(limpiar(m.Credit?.value));
    const autor = limpiar(m.Artist?.value) || (propia && i.user ? `${i.user} (Wikimedia Commons)` : '');
    return {
      titulo: p.title,
      licencia: limpiar(m.LicenseShortName?.value),
      condiciones: limpiar(m.UsageTerms?.value),
      exige_credito: String(m.AttributionRequired?.value ?? '') === 'true',
      autor: autor.slice(0, 120),
      descripcion: limpiar(m.ImageDescription?.value).slice(0, 200),
      pagina: i.descriptionurl,
      url: i.thumburl,
      ancho: i.width,
      alto: i.height,
    };
  }).filter(Boolean);
}

/* Reanudable: lo que ya se consiguió en una corrida anterior no se vuelve a
   pedir. Con el límite de ritmo de Commons, empezar de cero cada vez es la
   forma de no terminar nunca. */
const previo = existsSync(SALIDA) ? JSON.parse(readFileSync(SALIDA, 'utf8')).categorias ?? {} : {};
const resultado = {};
const descartes = [];

for (const [categoria, terminos] of Object.entries(BUSQUEDAS)) {
  const objetivo = cuantas(categoria);
  if ((previo[categoria]?.length ?? 0) >= objetivo) {
    resultado[categoria] = previo[categoria];
    console.log(`${categoria.padEnd(22)} ${previo[categoria].length}/${objetivo}  (ya estaba)`);
    continue;
  }
  const elegidas = [...(previo[categoria] ?? [])];
  const vistos = new Set(elegidas.map((f) => f.titulo));
  for (const termino of terminos) {
    if (elegidas.length >= objetivo) break;
    await dormir(1500); // Commons pide ir despacio y tiene razón: es gratis.
    for (const f of await buscar(termino)) {
      if (elegidas.length >= objetivo) break;
      if (vistos.has(f.titulo)) continue;
      vistos.add(f.titulo);
      // Commons guarda PDF, DjVu, SVG y videos en el mismo espacio de nombres
      // que las fotos. Sin este filtro se cuela un catalogo escaneado de 1895
      // como imagen de un restaurante; paso de verdad.
      if (!/\.(jpe?g|png|webp)$/i.test(f.titulo)) { descartes.push(`${categoria}: ${f.titulo} — no es una foto`); continue; }
      if (!esLibre(f.licencia)) { descartes.push(`${categoria}: ${f.titulo} — licencia ${f.licencia || '(sin dato)'}`); continue; }
      // Una licencia que exige atribucion y no dice a quien atribuir no se
      // puede cumplir. Se descarta: es la unica salida honesta.
      if (f.exige_credito && !f.autor) { descartes.push(`${categoria}: ${f.titulo} — exige credito y no trae autor`); continue; }
      if (f.ancho < MIN_ANCHO) { descartes.push(`${categoria}: ${f.titulo} — solo ${f.ancho}px de ancho`); continue; }
      if (f.alto > f.ancho) { descartes.push(`${categoria}: ${f.titulo} — vertical, la tarjeta es apaisada`); continue; }
      elegidas.push({ ...f, termino });
    }
  }
  resultado[categoria] = elegidas;
  console.log(`${categoria.padEnd(22)} ${elegidas.length}/${objetivo}`);
}

mkdirSync('datos/investigacion', { recursive: true });
writeFileSync(SALIDA, JSON.stringify({
  _lee_esto: 'Fotos de Wikimedia Commons con licencia libre, para ilustrar las categorias del directorio mientras no haya fotos reales de cada negocio. El campo credito de dst_negocio_foto se arma con autor + licencia + enlace a la pagina del archivo, que es lo que exigen CC BY y CC BY-SA. Generado por scripts/buscar-fotos-commons.mjs.',
  generado_en: new Date().toISOString().slice(0, 10),
  categorias: resultado,
}, null, 2) + '\n', 'utf8');

const total = Object.values(resultado).reduce((n, l) => n + l.length, 0);
const vacias = Object.entries(resultado).filter(([, l]) => !l.length).map(([c]) => c);
console.log(`\n${total} fotos en ${SALIDA}`);
if (vacias.length) console.log('SIN NINGUNA:', vacias.join(', '));
console.log(`descartadas ${descartes.length} (licencia, tamano u orientacion)`);

if (BAJAR) {
  mkdirSync(DESTINO_ARCHIVOS, { recursive: true });
  let n = 0;
  for (const [categoria, fotos] of Object.entries(resultado)) {
    for (const [i, f] of fotos.entries()) {
      const ruta = `${DESTINO_ARCHIVOS}/${categoria}-${i + 1}.jpg`;
      if (existsSync(ruta)) { n++; continue; }
      const res = await fetch(f.url, { headers: { 'User-Agent': 'VisitLaFortunaCR/1.0' } });
      if (!res.ok) { console.log(`  fallo ${ruta}: http ${res.status}`); continue; }
      await writeFile(ruta, Buffer.from(await res.arrayBuffer()));
      n++;
    }
  }
  console.log(`bajadas ${n} imagenes a ${DESTINO_ARCHIVOS}/`);
}
