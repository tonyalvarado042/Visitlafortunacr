/*
 * Arma una hoja de contacto por negocio con sus candidatas numeradas, para
 * poder revisarlas de un vistazo en vez de abrir 250 archivos.
 *
 *   node scripts/armar-contactos.mjs
 *
 * Lee `.fotos/<babosa>/NN.jpg` y escribe `.fotos/_contactos/<babosa>.jpg`.
 *
 * La revisión es a ojo y no hay forma de evitarlo: lo que hay que decidir es
 * si la foto retrata A ESE NEGOCIO, y eso no es una propiedad que se pueda
 * consultar. Las portadas traen logos, mapas, fotos de stock del banner y, más
 * de una vez, una foto de otro país que al dueño le gustó.
 */
import { mkdirSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const RAIZ = '.fotos';
const SALIDA = `${RAIZ}/_contactos`;
const CELDA = 420;
const COLUMNAS = 4;

if (!existsSync(RAIZ)) { console.error(`No existe ${RAIZ}/. Corré antes traer-fotos-del-sitio.mjs`); process.exit(1); }
mkdirSync(SALIDA, { recursive: true });

const carpetas = readdirSync(RAIZ, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
  .map((d) => d.name)
  .sort();

let hechas = 0;
for (const babosa of carpetas) {
  const archivos = readdirSync(`${RAIZ}/${babosa}`).filter((f) => /\.jpg$/i.test(f)).sort();
  if (!archivos.length) continue;

  const filas = Math.ceil(archivos.length / COLUMNAS);
  const ancho = CELDA * Math.min(COLUMNAS, archivos.length);
  const alto = CELDA * filas;

  const piezas = [];
  for (const [i, archivo] of archivos.entries()) {
    const x = (i % COLUMNAS) * CELDA;
    const y = Math.floor(i / COLUMNAS) * CELDA;
    try {
      const miniatura = await sharp(`${RAIZ}/${babosa}/${archivo}`)
        .resize(CELDA, CELDA, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer();
      piezas.push({ input: miniatura, left: x, top: y });
      // El número va encima, grande y con fondo, porque es lo que después se
      // escribe en la lista de elegidas.
      const etiqueta = Buffer.from(
        `<svg width="${CELDA}" height="70">
           <rect x="0" y="0" width="86" height="70" fill="#000" opacity="0.78"/>
           <text x="16" y="50" font-family="sans-serif" font-size="46" font-weight="bold" fill="#fff">${archivo.replace('.jpg', '')}</text>
         </svg>`
      );
      piezas.push({ input: etiqueta, left: x, top: y });
    } catch { /* archivo roto, se omite de la hoja */ }
  }

  await sharp({ create: { width: ancho, height: alto, channels: 3, background: '#1a1a1a' } })
    .composite(piezas).jpeg({ quality: 78 }).toFile(`${SALIDA}/${babosa}.jpg`);
  hechas += 1;
}

writeFileSync(`${SALIDA}/_lista.json`, JSON.stringify(carpetas, null, 2));
console.log(`${hechas} hojas de contacto en ${SALIDA}/`);
