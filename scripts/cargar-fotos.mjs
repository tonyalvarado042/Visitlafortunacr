/*
 * Sube fotos al bucket "negocios" de Supabase Storage y escribe sus filas en
 * dst_negocio_foto, con el credito que exige cada licencia.
 *
 *   node --env-file=.env.local scripts/cargar-fotos.mjs            (en seco)
 *   node --env-file=.env.local scripts/cargar-fotos.mjs --aplicar
 *   node --env-file=.env.local scripts/cargar-fotos.mjs --aplicar --solo-propias
 *   node --env-file=.env.local scripts/cargar-fotos.mjs --aplicar --solo-genericas
 *
 * Toma de dos sitios distintos, y la diferencia entre ellos es la que importa:
 *
 *   1. fotos-entrada/<babosa>/1.jpg, 2.jpg...  -> fotos REALES de ese negocio.
 *      La 1 es la portada. Van con es_generica = false.
 *
 *   2. fotos-entrada/_commons/<categoria>-N.jpg -> fotos de Wikimedia Commons
 *      que ilustran una categoria, no un negocio. Van con es_generica = true
 *      y se reparten entre todos los negocios de esa categoria, rotando para
 *      que catorce restaurantes no muestren la misma imagen. Su licencia y su
 *      autor salen de datos/investigacion/fotos-commons.json.
 *
 * Se puede correr las veces que haga falta: la ruta en Storage es
 * determinista, asi que una foto ya subida se reconoce por su URL y no se
 * duplica.
 *
 * Necesita SUPABASE_SECRET_KEY. No hace DDL: las columnas de credito las crea
 * la migracion 22, y sin ella este script se planta antes de escribir nada.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const APLICAR = process.argv.includes('--aplicar');
const SOLO_PROPIAS = process.argv.includes('--solo-propias');
const SOLO_GENERICAS = process.argv.includes('--solo-genericas');
/* Borra las genericas ya cargadas (filas y archivos) antes de volver a
   repartir. Hace falta cuando cambia cuantas fotos hay por categoria: el
   reparto es `i % fotos.length`, asi que con mas fotos a cada negocio le toca
   otra, y sin limpiar antes se le acumulan dos. Nunca toca las propias. */
const REHACER = process.argv.includes('--rehacer-genericas');

const BUCKET = 'negocios';
const ENTRADA = 'fotos-entrada';
const COMMONS_DIR = `${ENTRADA}/_commons`;
const COMMONS_JSON = 'datos/investigacion/fotos-commons.json';
const CREDITOS_PROPIOS = `${ENTRADA}/creditos.json`;
const INFORME_SITIOS = 'datos/investigacion/fotos-de-sitios.json';

const ANCHO_MAX = 1600;
const CALIDAD = 82;
const EXT = /\.(jpe?g|png|webp|avif)$/i;

const db = createClient('https://eulkufetcymallfbpone.supabase.co', process.env.SUPABASE_SECRET_KEY?.trim(), {
  db: { schema: 'destinos' }, auth: { persistSession: false },
});
const storage = createClient('https://eulkufetcymallfbpone.supabase.co', process.env.SUPABASE_SECRET_KEY?.trim(), {
  auth: { persistSession: false },
}).storage.from(BUCKET);

/* ------------------------------------------------------------------ base -- */

const { data: destino, error: eDestino } = await db.from('dst_destino').select('id, babosa').eq('babosa', 'la-fortuna').single();
if (eDestino) { console.error('No se pudo leer el destino:', eDestino.message); process.exit(1); }

const { data: negocios, error: eNeg } = await db
  .from('dst_negocio').select('id, babosa, nombre, categoria_id').eq('destino_id', destino.id);
if (eNeg) { console.error('No se pudieron leer los negocios:', eNeg.message); process.exit(1); }

const { data: categorias } = await db.from('dst_categoria').select('id, babosa, nombre');
const categoriaDe = Object.fromEntries(categorias.map((c) => [c.id, c]));
const porBabosa = Object.fromEntries(negocios.map((n) => [n.babosa, n]));

// La migracion 22 tiene que estar aplicada: sin sus columnas no hay credito
// que guardar, y subir las imagenes primero dejaria el bucket sucio.
const { error: eCol } = await db.from('dst_negocio_foto').select('id, licencia, fuente_url, es_generica').limit(1);
if (eCol) {
  console.error('Falta la migracion 22 (columnas licencia, fuente_url, es_generica):', eCol.message);
  console.error('Se pega en el SQL Editor: supabase/plataforma/22_fotos_de_negocio.sql');
  process.exit(1);
}

if (REHACER) {
  const { data: viejas } = await db.from('dst_negocio_foto').select('id, url').eq('es_generica', true);
  console.log(`--rehacer-genericas: ${viejas?.length ?? 0} genericas por borrar`);
  if (APLICAR && viejas?.length) {
    const marca = `/object/public/${BUCKET}/`;
    const rutas = viejas.map((f) => f.url.slice(f.url.indexOf(marca) + marca.length)).filter(Boolean);
    // De a 100: Storage no acepta listas sin fin.
    for (let i = 0; i < rutas.length; i += 100) await storage.remove(rutas.slice(i, i + 100));
    const { error } = await db.from('dst_negocio_foto').delete().eq('es_generica', true);
    console.log(error ? `  ERROR borrando: ${error.message}` : `  borradas ${viejas.length}`);
  }
}

const { data: yaEstan } = await db.from('dst_negocio_foto').select('id, negocio_id, url');
const urlsExistentes = new Set((yaEstan ?? []).map((f) => f.url));

/* -------------------------------------------------------------- utiles --- */

const urlPublica = (ruta) => `https://eulkufetcymallfbpone.supabase.co/storage/v1/object/public/${BUCKET}/${ruta}`;

async function subir(rutaLocal, rutaRemota) {
  const original = readFileSync(rutaLocal);
  const webp = await sharp(original)
    .rotate()                                             // respeta el EXIF de la camara
    .resize({ width: ANCHO_MAX, withoutEnlargement: true })
    .webp({ quality: CALIDAD })
    .toBuffer();
  const { error } = await storage.upload(rutaRemota, webp, { contentType: 'image/webp', upsert: true });
  if (error) throw new Error(error.message);
  return { bytes: webp.length, original: original.length };
}

const planeadas = [];   // { negocio, rutaLocal, rutaRemota, url, fila }
const avisos = [];

/* -------------------------------------------- 1. las propias de cada ficha - */

const creditosPropios = existsSync(CREDITOS_PROPIOS) ? JSON.parse(readFileSync(CREDITOS_PROPIOS, 'utf8')) : {};

if (!SOLO_GENERICAS && existsSync(ENTRADA)) {
  for (const entrada of readdirSync(ENTRADA)) {
    if (entrada.startsWith('_') || entrada.startsWith('.')) continue;
    const carpeta = `${ENTRADA}/${entrada}`;
    if (!statSync(carpeta).isDirectory()) continue;

    const negocio = porBabosa[entrada];
    if (!negocio) { avisos.push(`carpeta "${entrada}" no corresponde a ningun negocio; se salta`); continue; }

    const archivos = readdirSync(carpeta).filter((a) => EXT.test(a)).sort();
    if (!archivos.length) { avisos.push(`carpeta "${entrada}" no tiene imagenes`); continue; }

    const credito = creditosPropios[entrada] ?? creditosPropios._por_defecto ?? null;
    archivos.forEach((archivo, i) => {
      const base = archivo.replace(EXT, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const rutaRemota = `${destino.babosa}/${negocio.babosa}/${base}.webp`;
      planeadas.push({
        negocio, rutaLocal: `${carpeta}/${archivo}`, rutaRemota, url: urlPublica(rutaRemota),
        fila: {
          negocio_id: negocio.id, url: urlPublica(rutaRemota), orden: i,
          es_portada: i === 0, es_generica: false,
          credito: credito?.credito ?? null,
          licencia: credito?.licencia ?? null,
          fuente_url: credito?.fuente_url ?? null,
          texto_alternativo_es: `${negocio.nombre}, La Fortuna`,
          texto_alternativo_en: `${negocio.nombre}, La Fortuna`,
        },
      });
    });
  }
}

/* ----------------------- 1b. las del sitio web del propio negocio --------- */
/*
 * fotos-entrada/_sitios/<babosa>/ + _sitios/elegidas.json
 *
 * Estas SÍ son del negocio, así que van con es_generica = false y le ganan a
 * cualquier genérica. Solo se sube lo que está en elegidas.json: bajar una
 * imagen no es aprobarla, y hay dos cosas que ningún filtro decide —si sale
 * gente y si la foto es de verdad de ese lugar—. En la revisión aparecieron
 * una foto de Río de Janeiro y un tractor en un campo de colza europeo, las
 * dos en webs de negocios de La Fortuna.
 *
 * Excepción abierta de la regla 11, con fecha de cierre: cuando llegue
 * GOOGLE_PLACES_API_KEY estas se reemplazan por las licenciadas.
 */
const SITIOS_DIR = `${ENTRADA}/_sitios`;
const ELEGIDAS = `${SITIOS_DIR}/elegidas.json`;

if (!SOLO_GENERICAS && existsSync(ELEGIDAS)) {
  const { elegidas } = JSON.parse(readFileSync(ELEGIDAS, 'utf8'));
  const { data: informe } = { data: existsSync(INFORME_SITIOS) ? JSON.parse(readFileSync(INFORME_SITIOS, 'utf8')).negocios : {} };

  for (const [babosa, archivos] of Object.entries(elegidas ?? {})) {
    const negocio = porBabosa[babosa];
    if (!negocio) { avisos.push(`_sitios/${babosa} no corresponde a ningun negocio`); continue; }
    // Si ya tiene fotos propias puestas a mano, esas mandan.
    if (planeadas.some((p) => p.negocio.id === negocio.id && !p.fila.es_generica)) continue;

    archivos.forEach((archivo, i) => {
      const rutaLocal = `${SITIOS_DIR}/${babosa}/${archivo}`;
      if (!existsSync(rutaLocal)) { avisos.push(`falta ${rutaLocal}`); return; }
      const origen = informe?.[babosa]?.candidatas?.find((c) => c.archivo === archivo)?.origen ?? null;
      const base = archivo.replace(EXT, '').replace(/-ojo$/, '');
      const rutaRemota = `${destino.babosa}/${negocio.babosa}/sitio-${base}.webp`;
      planeadas.push({
        negocio, rutaLocal, rutaRemota, url: urlPublica(rutaRemota),
        fila: {
          negocio_id: negocio.id, url: urlPublica(rutaRemota), orden: i,
          es_portada: i === 0, es_generica: false,
          // El crédito es el negocio: es su foto y su web. Así se puede borrar
          // de una si alguno reclama, y se sabe de dónde salió cada una.
          credito: negocio.nombre,
          licencia: 'Del sitio web del negocio',
          fuente_url: origen ?? informe?.[babosa]?.sitio_web ?? null,
          texto_alternativo_es: `${negocio.nombre}, La Fortuna`,
          texto_alternativo_en: `${negocio.nombre}, La Fortuna`,
        },
      });
    });
  }
}

/* ------------------------------- 2. las genericas, elegidas a mano -------- */
/*
 * fotos-entrada/_categorias/<categoria>/*.jpg
 *
 * Esta es la buena, y manda sobre la de Wikimedia de mas abajo. Las de Commons
 * salieron feas por una razon de fondo: Commons es un archivo documental, no un
 * banco de fotos, y devolvia un Marriott de Albuquerque para "hoteles". Una
 * persona eligiendo en Pexels resuelve en diez minutos lo que ningun filtro
 * automatico resuelve, porque "se ve bien" no es una propiedad consultable.
 *
 * Licencia: Pexels y Unsplash permiten uso comercial sin atribucion. Se anota
 * igual de donde salieron, que no cuesta nada. Si querés nombrar al fotografo,
 * poné fotos-entrada/creditos.json con { "<categoria>": { "credito": "..." } }.
 */
const CATEGORIAS_DIR = `${ENTRADA}/_categorias`;

function fotosElegidasAMano() {
  if (!existsSync(CATEGORIAS_DIR)) return {};
  const porCat = {};
  for (const entrada of readdirSync(CATEGORIAS_DIR)) {
    const carpeta = `${CATEGORIAS_DIR}/${entrada}`;
    if (!statSync(carpeta).isDirectory()) continue;
    const archivos = readdirSync(carpeta).filter((a) => EXT.test(a)).sort();
    if (archivos.length) porCat[entrada] = archivos.map((a) => `${carpeta}/${a}`);
  }
  return porCat;
}

const aMano = fotosElegidasAMano();
const catsConocidas = new Set(categorias.map((c) => c.babosa));
for (const cat of Object.keys(aMano)) {
  if (!catsConocidas.has(cat)) avisos.push(`_categorias/${cat} no es una categoria del catalogo; se ignora`);
}

if (!SOLO_PROPIAS && (Object.keys(aMano).length || (existsSync(COMMONS_JSON) && existsSync(COMMONS_DIR)))) {
  const { categorias: fotosPorCategoria } = existsSync(COMMONS_JSON)
    ? JSON.parse(readFileSync(COMMONS_JSON, 'utf8'))
    : { categorias: {} };

  // Los negocios que YA tienen foto propia no llevan generica encima.
  const conPropia = new Set(planeadas.filter((p) => !p.fila.es_generica).map((p) => p.negocio.id));

  const porCategoria = {};
  for (const n of negocios) {
    if (conPropia.has(n.id)) continue;
    const c = categoriaDe[n.categoria_id];
    if (c) (porCategoria[c.babosa] ??= []).push(n);
  }

  for (const [catBabosa, negociosDeCat] of Object.entries(porCategoria)) {
    /* Si hay fotos elegidas a mano para esta categoria, se usan esas y punto:
       ninguna mezcla con las de Commons, que es lo que dejaria media seccion
       linda y media fea. */
    const mias = aMano[catBabosa];
    if (mias?.length) {
      negociosDeCat.forEach((negocio, i) => {
        const rutaLocal = mias[i % mias.length];
        const base = rutaLocal.split('/').pop().replace(EXT, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const rutaRemota = `${destino.babosa}/${negocio.babosa}/cat-${catBabosa}-${base}.webp`;
        const c = creditosPropios[catBabosa] ?? creditosPropios._categorias ?? null;
        planeadas.push({
          negocio, rutaLocal, rutaRemota, url: urlPublica(rutaRemota),
          fila: {
            negocio_id: negocio.id, url: urlPublica(rutaRemota), orden: 90,
            es_portada: false, es_generica: true,
            credito: c?.credito ?? null,
            licencia: c?.licencia ?? 'Pexels',
            fuente_url: c?.fuente_url ?? null,
            texto_alternativo_es: `Imagen ilustrativa de ${categoriaDe[negocio.categoria_id]?.nombre?.toLowerCase() ?? catBabosa}`,
            texto_alternativo_en: `Illustrative image of ${catBabosa.replace(/-/g, ' ')}`,
          },
        });
      });
      continue;
    }

    const fotos = fotosPorCategoria[catBabosa] ?? [];
    if (!fotos.length) { avisos.push(`categoria "${catBabosa}": ${negociosDeCat.length} negocios sin foto generica disponible`); continue; }

    negociosDeCat.forEach((negocio, i) => {
      const indice = i % fotos.length;                 // rota, para no repetir la misma en toda la seccion
      const foto = fotos[indice];
      const rutaLocal = `${COMMONS_DIR}/${catBabosa}-${indice + 1}.jpg`;
      if (!existsSync(rutaLocal)) { avisos.push(`falta el archivo ${rutaLocal} (corre buscar-fotos-commons.mjs --bajar)`); return; }

      const rutaRemota = `${destino.babosa}/${negocio.babosa}/categoria-${catBabosa}-${indice + 1}.webp`;
      /* CC BY y CC BY-SA obligan a nombrar al autor. Si Commons no dice quien
         es, la condicion no se puede cumplir y la foto no se usa: es la unica
         salida honesta. Dominio publico y CC0 no obligan a nada, asi que ahi
         alcanza con decir de donde salio. */
      const exigeCredito = /^cc by/i.test(foto.licencia ?? '') || foto.exige_credito === true;
      if (exigeCredito && !foto.autor) {
        avisos.push(`${catBabosa}-${indice + 1}: "${foto.titulo}" exige credito y no trae autor; se salta`);
        return;
      }
      planeadas.push({
        negocio, rutaLocal, rutaRemota, url: urlPublica(rutaRemota),
        fila: {
          negocio_id: negocio.id, url: urlPublica(rutaRemota), orden: 90,
          es_portada: false, es_generica: true,
          // CC0 y dominio publico no exigen nada, pero se nombra igual la
          // fuente: cuesta lo mismo y es lo correcto.
          credito: foto.autor || 'Wikimedia Commons',
          licencia: foto.licencia || null,
          fuente_url: foto.pagina || null,
          texto_alternativo_es: `Imagen ilustrativa de ${categoriaDe[negocio.categoria_id]?.nombre?.toLowerCase() ?? catBabosa}`,
          texto_alternativo_en: `Illustrative image of ${catBabosa.replace(/-/g, ' ')}`,
        },
      });
    });
  }
}

/* ------------------------------------------------------------- resumen --- */

const nuevas = planeadas.filter((p) => !urlsExistentes.has(p.url));
const propias = nuevas.filter((p) => !p.fila.es_generica).length;
const genericas = nuevas.filter((p) => p.fila.es_generica).length;
const negociosTocados = new Set(nuevas.map((p) => p.negocio.id)).size;

console.log(`${planeadas.length} fotos planeadas · ${nuevas.length} nuevas (${propias} propias, ${genericas} genericas)`);
console.log(`cubren ${negociosTocados} de ${negocios.length} negocios`);
for (const a of avisos) console.log(`  aviso: ${a}`);

// Una foto con fuente_url pero sin credito o sin licencia no pasa el check de
// la migracion 22. Se detecta aqui para no descubrirlo a mitad de la subida.
const malas = nuevas.filter((p) => p.fila.fuente_url && (!p.fila.credito || !p.fila.licencia));
if (malas.length) {
  console.error(`\n${malas.length} fotos tienen origen pero les falta credito o licencia. No se sube nada.`);
  for (const m of malas.slice(0, 5)) console.error(`  ${m.rutaRemota}`);
  process.exit(1);
}

if (!APLICAR) {
  console.log('\nEn seco. Con --aplicar se suben y se escriben las filas.');
  const muestra = nuevas.slice(0, 3);
  for (const m of muestra) console.log(`  ejemplo: ${m.negocio.nombre} <- ${m.rutaLocal}\n           ${m.fila.licencia ?? 'propia'} · ${m.fila.credito ?? 'sin credito'}`);
  process.exit(0);
}

/* ------------------------------------------------------------- aplicar --- */

let subidas = 0, fallos = 0, bytes = 0;
for (const p of nuevas) {
  try {
    const { bytes: b } = await subir(p.rutaLocal, p.rutaRemota);
    bytes += b;
    const { error } = await db.from('dst_negocio_foto').insert(p.fila);
    if (error) { console.log(`  ${p.negocio.babosa}: ERROR fila -> ${error.message}`); fallos++; continue; }
    subidas++;
    if (subidas % 20 === 0) console.log(`  ${subidas}/${nuevas.length}...`);
  } catch (e) {
    console.log(`  ${p.negocio.babosa}: ERROR subida -> ${e.message}`);
    fallos++;
  }
}

console.log(`\nAplicado: ${subidas} fotos subidas (${(bytes / 1024 / 1024).toFixed(1)} MB en webp), ${fallos} fallos`);
