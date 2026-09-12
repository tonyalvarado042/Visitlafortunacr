/*
 * Limpia las candidatas bajadas: saca duplicados y descarta gráficos.
 *
 *   node scripts/limpiar-candidatas.mjs           (dice qué haría)
 *   node scripts/limpiar-candidatas.mjs --aplicar
 *
 * Dos cosas que el recolector no puede hacer bien y aquí sí, porque aquí ya
 * está el archivo bajado:
 *
 * 1. DUPLICADOS. El hash de bytes no sirve: el mismo original servido en dos
 *    tamaños o con otro recorte da bytes distintos y se cuela dos veces. Aquí
 *    se compara un "hash perceptual" (la imagen reducida a 8x8 en gris, cada
 *    celda por encima o por debajo del promedio). Dos fotos que se ven iguales
 *    dan hashes casi iguales aunque pesen distinto.
 *
 * 2. GRÁFICOS. Logos, recortes sobre fondo negro y dibujos pasan el filtro de
 *    tamaño del recolector — a Ecotermales le bajó tres veces su logo. Se
 *    detectan por dos señales juntas: muy pocos colores distintos (un logo
 *    tiene planos de color, una foto tiene ruido) y un borde casi uniforme
 *    (el recorte sobre negro).
 *
 * Nada de esto decide si la foto es DEL NEGOCIO: eso sigue siendo a ojo.
 * Esto solo saca lo que no hace falta ni mirar.
 */
import { readdirSync, existsSync, unlinkSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const APLICAR = process.argv.includes('--aplicar');
const RAIZ = '.fotos';
const DISTANCIA_DUPLICADO = 5;   // de 64 bits; por debajo de esto es la misma foto
const COLORES_MINIMOS = 2800;    // menos variedad que esto huele a gráfico
const UNIFORMIDAD_BORDE = 6;     // desviación del marco; casi 0 es recorte sobre fondo plano

/** Hash perceptual de 64 bits: 8x8 en gris, cada celda contra el promedio. */
async function huella(ruta) {
  const datos = await sharp(readFileSync(ruta)).greyscale().resize(8, 8, { fit: 'fill' }).raw().toBuffer();
  const promedio = datos.reduce((a, b) => a + b, 0) / datos.length;
  return Array.from(datos).map((v) => (v > promedio ? 1 : 0));
}

const distancia = (a, b) => a.reduce((n, v, i) => n + (v === b[i] ? 0 : 1), 0);

/** Señales de que es un gráfico y no una fotografía. */
async function esGrafico(ruta) {
  const img = sharp(readFileSync(ruta));
  const { width, height } = await img.metadata();
  const chico = await img.clone().resize(64, 64, { fit: 'fill' }).raw().toBuffer();

  const vistos = new Set();
  for (let i = 0; i < chico.length; i += 3) vistos.add(`${chico[i] >> 3},${chico[i + 1] >> 3},${chico[i + 2] >> 3}`);

  // El marco exterior: en un recorte sobre negro es todo el mismo color.
  const borde = [];
  for (let x = 0; x < 64; x += 1) {
    for (const y of [0, 63]) { const p = (y * 64 + x) * 3; borde.push((chico[p] + chico[p + 1] + chico[p + 2]) / 3); }
  }
  const mediaBorde = borde.reduce((a, b) => a + b, 0) / borde.length;
  const desvio = Math.sqrt(borde.reduce((a, b) => a + (b - mediaBorde) ** 2, 0) / borde.length);

  return {
    grafico: vistos.size < COLORES_MINIMOS && desvio < UNIFORMIDAD_BORDE,
    colores: vistos.size, desvio: Math.round(desvio), width, height,
  };
}

const carpetas = readdirSync(RAIZ, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_')).map((d) => d.name).sort();

let dup = 0, gra = 0, quedan = 0;
const vaciados = [];

for (const babosa of carpetas) {
  const dir = `${RAIZ}/${babosa}`;
  const archivos = readdirSync(dir).filter((f) => /\.jpg$/i.test(f)).sort();
  const huellas = [];
  const borrar = [];

  for (const archivo of archivos) {
    const ruta = `${dir}/${archivo}`;
    const g = await esGrafico(ruta);
    if (g.grafico) { borrar.push([archivo, `grafico (${g.colores} colores, borde ${g.desvio})`]); gra += 1; continue; }
    const h = await huella(ruta);
    const igual = huellas.find((x) => distancia(x.h, h) <= DISTANCIA_DUPLICADO);
    if (igual) { borrar.push([archivo, `duplicada de ${igual.archivo}`]); dup += 1; continue; }
    huellas.push({ archivo, h });
  }

  if (borrar.length) {
    console.log(`${babosa}:`);
    for (const [archivo, motivo] of borrar) {
      console.log(`   - ${archivo}  ${motivo}`);
      if (APLICAR) unlinkSync(`${dir}/${archivo}`);
    }
  }
  const restan = archivos.length - borrar.length;
  quedan += restan;
  if (!restan) vaciados.push(babosa);
}

console.log(`\n${dup} duplicadas · ${gra} gráficos · quedan ${quedan} candidatas`);
if (vaciados.length) console.log(`\nSE QUEDARON SIN NINGUNA (hay que buscarles foto aparte):\n  ${vaciados.join('\n  ')}`);
if (!APLICAR) console.log('\nEn seco. Para borrarlas: --aplicar');
else writeFileSync(`${RAIZ}/_vaciados.json`, JSON.stringify(vaciados, null, 2));
