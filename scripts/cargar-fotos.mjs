/*
 * Sube las fotos de los negocios a Supabase Storage y escribe sus filas en
 * dst_negocio_foto.
 *
 *   node --env-file=.env.local scripts/cargar-fotos.mjs            (en seco)
 *   node --env-file=.env.local scripts/cargar-fotos.mjs --aplicar
 *   node --env-file=.env.local scripts/cargar-fotos.mjs --aplicar --borrar-antes
 *
 * Lee UNA sola carpeta, una subcarpeta por negocio con el nombre de su babosa:
 *
 *   fotos/termales-los-laureles/1.jpg
 *   fotos/termales-los-laureles/2.jpg
 *   fotos/don-juan-coffee-chocolate-tour/1.jpg
 *
 * La primera en orden alfabetico es la portada, la que sale en la tarjeta; por
 * eso conviene numerarlas. Se redimensionan a 1600 px y pasan a webp al subir.
 *
 * Se puede correr las veces que haga falta: la ruta en Storage es determinista,
 * asi que una foto ya subida se reconoce por su URL y no se duplica.
 * --borrar-antes vacia lo que haya de esos negocios y vuelve a subir.
 *
 * Necesita SUPABASE_SECRET_KEY. Crea el bucket si no existe. No hace DDL: las
 * columnas de credito las crea la migracion 22.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const APLICAR = process.argv.includes('--aplicar');
const BORRAR_ANTES = process.argv.includes('--borrar-antes');

const BUCKET = 'negocios';
const ENTRADA = 'fotos';
const ANCHO_MAX = 1600;
const CALIDAD = 82;
const EXT = /\.(jpe?g|png|webp|avif)$/i;

const url = 'https://eulkufetcymallfbpone.supabase.co';
const clave = process.env.SUPABASE_SECRET_KEY?.trim();
const db = createClient(url, clave, { db: { schema: 'destinos' }, auth: { persistSession: false } });
const cliente = createClient(url, clave, { auth: { persistSession: false } });
const storage = cliente.storage.from(BUCKET);

/* ------------------------------------------------------------------ base -- */

if (!existsSync(ENTRADA)) {
  console.error(`No existe la carpeta ${ENTRADA}/. Pone ahi una subcarpeta por negocio, con el nombre de su babosa.`);
  process.exit(1);
}

const { data: destino, error: eDestino } = await db.from('dst_destino').select('id, babosa').eq('babosa', 'la-fortuna').single();
if (eDestino) { console.error('No se pudo leer el destino:', eDestino.message); process.exit(1); }

const { data: negocios, error: eNeg } = await db
  .from('dst_negocio').select('id, babosa, nombre').eq('destino_id', destino.id);
if (eNeg) { console.error('No se pudieron leer los negocios:', eNeg.message); process.exit(1); }
const porBabosa = Object.fromEntries(negocios.map((n) => [n.babosa, n]));

// La migracion 22 tiene que estar aplicada: sin sus columnas no hay donde
// guardar el origen, y subir las imagenes primero dejaria el bucket sucio.
const { error: eCol } = await db.from('dst_negocio_foto').select('id, licencia, fuente_url, es_generica').limit(1);
if (eCol) {
  console.error('Falta la migracion 22 (columnas licencia, fuente_url, es_generica):', eCol.message);
  console.error('Se pega en el SQL Editor: supabase/plataforma/22_fotos_de_negocio.sql');
  process.exit(1);
}

/* --------------------------------------------------------------- planear -- */

const urlPublica = (ruta) => `${url}/storage/v1/object/public/${BUCKET}/${ruta}`;
const planeadas = [];
const avisos = [];

for (const entrada of readdirSync(ENTRADA)) {
  if (entrada.startsWith('.') || entrada.startsWith('_')) continue;
  const carpeta = `${ENTRADA}/${entrada}`;
  if (!statSync(carpeta).isDirectory()) continue;

  const negocio = porBabosa[entrada];
  if (!negocio) { avisos.push(`carpeta "${entrada}" no corresponde a ningun negocio; se salta`); continue; }

  const archivos = readdirSync(carpeta).filter((a) => EXT.test(a)).sort();
  if (!archivos.length) { avisos.push(`carpeta "${entrada}" no tiene imagenes`); continue; }

  archivos.forEach((archivo, i) => {
    const base = archivo.replace(EXT, '').toLowerCase().replace(/[^a-z0-9]+/g, '-') || `foto-${i + 1}`;
    const rutaRemota = `${destino.babosa}/${negocio.babosa}/${base}.webp`;
    planeadas.push({
      negocio, rutaLocal: `${carpeta}/${archivo}`, rutaRemota,
      fila: {
        negocio_id: negocio.id, url: urlPublica(rutaRemota), orden: i,
        es_portada: i === 0, es_generica: false,
        texto_alternativo_es: `${negocio.nombre}, La Fortuna`,
        texto_alternativo_en: `${negocio.nombre}, La Fortuna`,
      },
    });
  });
}

const negociosTocados = new Set(planeadas.map((p) => p.negocio.id));
console.log(`${planeadas.length} fotos en ${ENTRADA}/ · ${negociosTocados.size} de ${negocios.length} negocios`);
for (const a of avisos) console.log(`  aviso: ${a}`);

if (!planeadas.length) process.exit(0);

if (!APLICAR) {
  console.log('\nEn seco. Con --aplicar se suben y se escriben las filas.');
  for (const p of planeadas.slice(0, 5)) console.log(`  ${p.negocio.nombre} <- ${p.rutaLocal}`);
  process.exit(0);
}

/* --------------------------------------------------------------- aplicar -- */

// El bucket puede no existir: se crea publico, con tope y solo imagenes.
const { data: buckets } = await cliente.storage.listBuckets();
if (!buckets?.some((b) => b.name === BUCKET)) {
  const { error } = await cliente.storage.createBucket(BUCKET, {
    public: true, fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ['image/webp', 'image/jpeg', 'image/png', 'image/avif'],
  });
  if (error) { console.error(`ERROR creando el bucket: ${error.message}`); process.exit(1); }
  console.log(`bucket "${BUCKET}" creado`);
}

if (BORRAR_ANTES) {
  const ids = [...negociosTocados];
  const { data: viejas } = await db.from('dst_negocio_foto').select('id, url').in('negocio_id', ids);
  if (viejas?.length) {
    const marca = `/object/public/${BUCKET}/`;
    const rutas = viejas.map((f) => f.url.slice(f.url.indexOf(marca) + marca.length)).filter(Boolean);
    for (let i = 0; i < rutas.length; i += 100) await storage.remove(rutas.slice(i, i + 100));
    await db.from('dst_negocio_foto').delete().in('negocio_id', ids);
    console.log(`--borrar-antes: ${viejas.length} fotos anteriores eliminadas`);
  }
}

const { data: yaEstan } = await db.from('dst_negocio_foto').select('url');
const existentes = new Set((yaEstan ?? []).map((f) => f.url));

let subidas = 0, fallos = 0, bytes = 0;
for (const p of planeadas) {
  if (existentes.has(p.fila.url)) continue;
  try {
    const webp = await sharp(readFileSync(p.rutaLocal))
      .rotate()                                            // respeta el EXIF de la camara
      .resize({ width: ANCHO_MAX, withoutEnlargement: true })
      .webp({ quality: CALIDAD })
      .toBuffer();
    const { error: eSubida } = await storage.upload(p.rutaRemota, webp, { contentType: 'image/webp', upsert: true });
    if (eSubida) throw new Error(eSubida.message);
    bytes += webp.length;

    const { error } = await db.from('dst_negocio_foto').insert(p.fila);
    if (error) { console.log(`  ${p.negocio.babosa}: ERROR fila -> ${error.message}`); fallos++; continue; }
    subidas++;
    if (subidas % 20 === 0) console.log(`  ${subidas}...`);
  } catch (e) {
    console.log(`  ${p.negocio.babosa}: ERROR -> ${e.message}`);
    fallos++;
  }
}

console.log(`\nAplicado: ${subidas} fotos subidas (${(bytes / 1024 / 1024).toFixed(1)} MB en webp), ${fallos} fallos`);
