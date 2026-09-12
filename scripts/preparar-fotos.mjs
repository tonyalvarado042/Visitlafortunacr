/*
 * Copia a `fotos/<babosa>/` solo las candidatas que pasaron la revisión a ojo.
 *
 *   node scripts/preparar-fotos.mjs            (dice qué haría)
 *   node scripts/preparar-fotos.mjs --aplicar
 *
 * Lee `datos/investigacion/fotos-elegidas.json` —que es lo único de todo este
 * trabajo que no se regenera solo— y deja `fotos/` lista para
 * `cargar-fotos.mjs`, que es el que sube y escribe en la base.
 *
 * Renumera al copiar: la elegida primera queda como `1.jpg` y es la portada,
 * porque el cargador toma la primera en orden alfabético. Los números de
 * `.fotos/` tienen huecos (la limpieza borró duplicados y gráficos), así que
 * copiarlos tal cual dejaría el orden a merced de qué se borró.
 *
 * Se planta si una elegida no existe: eso significa que la revisión se hizo
 * sobre una hoja de contacto vieja, y subir la foto equivocada es justo lo que
 * este proceso existe para evitar.
 */
import { readFileSync, existsSync, mkdirSync, copyFileSync, rmSync, readdirSync } from 'node:fs';

// Solo subcarpetas: en `fotos/` también vive FALTAN.md, y tratarlo como carpeta
// reventaba el conteo del final.
const subcarpetas = (dir) => readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

const APLICAR = process.argv.includes('--aplicar');
const ORIGEN = '.fotos';
const DESTINO = 'fotos';
const LISTA = 'datos/investigacion/fotos-elegidas.json';

const { elegidas } = JSON.parse(readFileSync(LISTA, 'utf8'));

const faltan = [];
for (const [babosa, archivos] of Object.entries(elegidas)) {
  for (const archivo of archivos) {
    if (!existsSync(`${ORIGEN}/${babosa}/${archivo}`)) faltan.push(`${babosa}/${archivo}`);
  }
}

if (faltan.length) {
  console.error('No se copió nada. Estas elegidas no existen en .fotos/:');
  for (const f of faltan) console.error(`  - ${f}`);
  console.error('\nProbablemente la revisión se hizo sobre hojas de contacto anteriores a la limpieza.');
  console.error('Volvé a correr armar-contactos.mjs y revisá de nuevo esos negocios.');
  process.exit(1);
}

const total = Object.values(elegidas).flat().length;
console.log(`${Object.keys(elegidas).length} negocios · ${total} fotos elegidas, todas presentes.`);

if (!APLICAR) {
  for (const [babosa, archivos] of Object.entries(elegidas)) {
    console.log(`  ${babosa}: ${archivos.map((a, i) => `${a}→${i + 1}.jpg`).join(', ')}`);
  }
  console.log('\nEn seco. Para copiar: --aplicar');
  process.exit(0);
}

/*
 * Se rehacen SOLO las carpetas que este archivo administra.
 *
 * Antes esto vaciaba `fotos/` entera con un rmSync recursivo, y eso era una
 * trampa: `fotos/` es también donde una persona deja a mano las fotos que
 * consiguió por su cuenta —es el camino que describe el punto 9 del cerebro—,
 * así que la siguiente pasada del script se las llevaba por delante sin avisar.
 * Ahora una carpeta que no esté en fotos-elegidas.json no se toca.
 */
mkdirSync(DESTINO, { recursive: true });

const ajenas = subcarpetas(DESTINO).filter((c) => !elegidas[c]);
if (ajenas.length) {
  console.log(`\n${ajenas.length} carpetas puestas a mano que este script NO toca:`);
  console.log(`  ${ajenas.join(', ')}`);
}

for (const [babosa, archivos] of Object.entries(elegidas)) {
  // Solo la suya, y solo si ya existía: si una foto se quitó de la lista, no
  // puede quedar colgada y subirse igual en la próxima pasada.
  if (existsSync(`${DESTINO}/${babosa}`)) rmSync(`${DESTINO}/${babosa}`, { recursive: true });
  mkdirSync(`${DESTINO}/${babosa}`, { recursive: true });
  archivos.forEach((archivo, i) => {
    copyFileSync(`${ORIGEN}/${babosa}/${archivo}`, `${DESTINO}/${babosa}/${i + 1}.jpg`);
  });
}

const carpetas = subcarpetas(DESTINO);
const copiadas = carpetas.reduce((n, c) => n + readdirSync(`${DESTINO}/${c}`).length, 0);
console.log(`\n${carpetas.length} carpetas en ${DESTINO}/ con ${copiadas} fotos. La 1.jpg de cada una es la portada.`);
console.log('Ahora: node --env-file=.env.local scripts/cargar-fotos.mjs --aplicar');
