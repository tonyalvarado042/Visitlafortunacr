/*
 * Arma hojas de contacto con las candidatas bajadas de los sitios, para
 * revisarlas a ojo de una sentada en vez de abrir 300 archivos.
 *
 *   node scripts/armar-contactos.mjs
 *
 * Cada hoja lleva hasta 12 miniaturas con su número y la babosa del negocio
 * escritos encima. De ahí sale la lista de aprobadas para
 * fotos-entrada/_sitios/elegidas.json, que es lo que lee el cargador.
 *
 * Hay dos cosas que ningún filtro automático decide bien y por eso existe este
 * paso: si en la foto sale gente, y si la foto es de verdad de ese lugar y no
 * del logo, del mapa o de un plato de stock que el negocio puso en su web.
 */
import { mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import sharp from 'sharp';

const ORIGEN = 'fotos-entrada/_sitios';
const SALIDA = 'fotos-entrada/_contactos';
const COLUMNAS = 4;
const FILAS = 3;
const CELDA = 420;
const PIE = 34;          // franja negra para el rótulo
const POR_HOJA = COLUMNAS * FILAS;

if (!existsSync(ORIGEN)) { console.error(`No existe ${ORIGEN}. Corré antes traer-fotos-del-sitio.mjs`); process.exit(1); }

const fichas = [];
for (const babosa of readdirSync(ORIGEN)) {
  const carpeta = `${ORIGEN}/${babosa}`;
  let archivos;
  try { archivos = readdirSync(carpeta).filter((a) => /\.(jpe?g|png|webp)$/i.test(a)).sort(); } catch { continue; }
  for (const archivo of archivos) fichas.push({ babosa, archivo, ruta: `${carpeta}/${archivo}` });
}
if (!fichas.length) { console.error('No hay candidatas que revisar.'); process.exit(1); }

const rotulo = (texto) => Buffer.from(
  `<svg width="${CELDA}" height="${PIE}">
     <rect width="100%" height="100%" fill="#0B0B0B"/>
     <text x="8" y="23" font-family="monospace" font-size="17" fill="#FFFFFF">${
       texto.replace(/[<>&]/g, '')
     }</text>
   </svg>`
);

mkdirSync(SALIDA, { recursive: true });
const hojas = Math.ceil(fichas.length / POR_HOJA);

for (let h = 0; h < hojas; h++) {
  const lote = fichas.slice(h * POR_HOJA, (h + 1) * POR_HOJA);
  const capas = [];

  for (const [i, f] of lote.entries()) {
    const x = (i % COLUMNAS) * CELDA;
    const y = Math.floor(i / COLUMNAS) * (CELDA + PIE);
    try {
      const mini = await sharp(f.ruta).resize(CELDA, CELDA, { fit: 'cover' }).jpeg({ quality: 78 }).toBuffer();
      capas.push({ input: mini, left: x, top: y });
    } catch { /* archivo roto: queda el hueco negro, que también informa */ }
    // El número de celda es lo que después se escribe en elegidas.json.
    capas.push({ input: rotulo(`${i + 1}. ${f.babosa} / ${f.archivo}`), left: x, top: y + CELDA });
  }

  const salida = `${SALIDA}/hoja-${String(h + 1).padStart(2, '0')}.jpg`;
  await sharp({
    create: {
      width: COLUMNAS * CELDA,
      height: FILAS * (CELDA + PIE),
      channels: 3,
      background: { r: 11, g: 11, b: 11 },
    },
  }).composite(capas).jpeg({ quality: 76 }).toFile(salida);
  console.log(`${salida}  (${lote.length} imágenes)`);
}

// El índice, para poder pasar de "hoja 3, celda 7" a un archivo concreto.
writeFileSync(`${SALIDA}/indice.json`, JSON.stringify(
  fichas.map((f, i) => ({ hoja: Math.floor(i / POR_HOJA) + 1, celda: (i % POR_HOJA) + 1, ...f })), null, 2) + '\n', 'utf8');

console.log(`\n${fichas.length} candidatas en ${hojas} hojas · índice en ${SALIDA}/indice.json`);
