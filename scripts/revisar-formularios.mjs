#!/usr/bin/env node
/*
 * Revisa que no haya FORMULARIOS ANIDADOS en todo el sitio.
 *
 * POR QUE EXISTE ESTE ARCHIVO: HTML no permite un <form> dentro de otro. El
 * navegador se come los de adentro al parsear, y los botones que quedan
 * huérfanos pasan a pertenecer al formulario de AFUERA. El resultado es un
 * botón que se ve, se hace clic, y NO HACE NADA — sin error, sin aviso, y la
 * pantalla recargándose como si todo estuviera bien.
 *
 * Pasó tres veces el 6 de noviembre de 2026: «Borrar definitivamente» en la
 * ficha de un negocio guardaba el negocio en vez de borrarlo, y los cuatro
 * botones de la galería de un tour —subir, mover, portada, borrar— no hacían
 * absolutamente nada. Tony los encontró antes que yo las dos veces.
 *
 * ⚠️ LO QUE UN grep NO VE, y es la mitad del problema: un COMPONENTE puede
 * traer su propio <form> adentro. `<PedirRevision />` dentro de un <form> es
 * exactamente el mismo bug, y en el archivo no se ve ni un `<form`. Por eso
 * este script primero averigua qué componentes renderizan formularios y
 * después los busca usados dentro de uno.
 *
 * Corre con:  npm run revisar:formularios
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const RAIZ = process.cwd();
const CARPETAS = ['app', 'componentes'];

/** Todos los .tsx, recursivo. */
function archivos(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) {
      if (n === 'node_modules' || n === '.next') continue;
      archivos(p, acc);
    } else if (n.endsWith('.tsx')) acc.push(p);
  }
  return acc;
}

/**
 * Deja el archivo sin COMENTARIOS, conservando los saltos de línea para que
 * los números sigan sirviendo.
 *
 * Hace falta porque la palabra `<form>` aparece muchas veces dentro de
 * comentarios que explican justamente esta regla; sin limpiarlos, cascada de
 * falsos positivos.
 *
 * ⚠️ NO SE BORRAN LOS TEXTOS, y la primera versión sí lo hacía — con una
 * expresión para plantillas (`` `...` ``) que NO excluía saltos de línea. Con
 * un backtick impar en el archivo, esa expresión se tragaba regiones enteras
 * incluyendo formularios de verdad, y el script daba VERDE estando ciego.
 * Un verificador que no ve es peor que ninguno, porque da permiso.
 *
 * Que quede un `<form` dentro de un texto es raro y, si pasa, el falso
 * positivo se ve y se arregla. Lo otro no se ve.
 *
 * El comentario de línea se borra solo cuando las dos barras NO vienen
 * después de dos puntos: `https://…` dentro de un texto no es un comentario,
 * y tratarlo como tal borraba el resto de la línea.
 */
function limpiar(txt) {
  const blanco = (m) => m.replace(/[^\n]/g, ' ');
  return txt
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, blanco)       // comentarios JSX
    .replace(/\/\*[\s\S]*?\*\//g, blanco)           // comentarios de bloque
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, antes) => antes + blanco(m.slice(antes.length)));
}

/** Los nombres que exporta un archivo. */
function exportados(txt) {
  const nombres = new Set();
  for (const m of txt.matchAll(/export\s+(?:async\s+)?function\s+([A-Z][A-Za-z0-9_]*)/g)) nombres.add(m[1]);
  for (const m of txt.matchAll(/export\s+const\s+([A-Z][A-Za-z0-9_]*)/g)) nombres.add(m[1]);
  return nombres;
}

const lista = CARPETAS.flatMap((c) => archivos(join(RAIZ, c)));

/* 1. Qué componentes traen un <form> adentro. */
const conForm = new Map(); // nombre -> archivo
for (const f of lista) {
  const limpio = limpiar(readFileSync(f, 'utf8'));
  if (!/<form[\s>]/.test(limpio)) continue;
  for (const n of exportados(limpio)) conForm.set(n, relative(RAIZ, f));
}

/* 2. Buscar anidamientos: <form> dentro de <form>, y componente-con-form
      dentro de <form>. */
const fallos = [];

for (const f of lista) {
  const ruta = relative(RAIZ, f).split(sep).join('/');
  const bruto = readFileSync(f, 'utf8');
  const limpio = limpiar(bruto);

  /* Qué componentes-con-form importa ESTE archivo. Se mira el import para no
     confundir dos componentes distintos que se llamen igual en carpetas
     distintas. */
  const importados = new Map(); // nombre local -> archivo de origen
  for (const m of limpio.matchAll(/import\s*\{([^}]+)\}\s*from/g)) {
    for (const parte of m[1].split(',')) {
      /* ⚠️ Con alias son DOS nombres distintos y hay que usar cada uno donde
         toca: el ORIGINAL es el que está en la lista de componentes con
         formulario, y el LOCAL es el que aparece en el JSX. La primera
         versión se quedaba con el local para las dos cosas y no encontraba
         nada — `import { TraerFotos as Trampa }` pasaba limpio. */
      const trozos = parte.trim().split(/\s+as\s+/);
      const original = trozos[0].trim();
      const local = trozos[trozos.length - 1].trim();
      if (conForm.has(original)) importados.set(local, conForm.get(original));
    }
  }
  /* Un `import X from` por defecto, con alias implícito. */
  for (const m of limpio.matchAll(/import\s+([A-Z][A-Za-z0-9_]*)\s+from\s+['"]([^'"]+)['"]/g)) {
    if (conForm.has(m[1])) importados.set(m[1], conForm.get(m[1]));
  }

  const lineas = limpio.split('\n');
  let nivel = 0;
  let abiertoEn = 0;

  for (let i = 0; i < lineas.length; i++) {
    const nro = i + 1;
    /* Se recorren las marcas EN ORDEN dentro de la línea: en una sola línea
       puede abrirse y cerrarse un formulario. */
    const marcas = [...lineas[i].matchAll(/<form[\s>]|<\/form>|<([A-Z][A-Za-z0-9_]*)[\s/>]/g)];
    for (const m of marcas) {
      const t = m[0];
      if (t === '</form>') { nivel = Math.max(0, nivel - 1); continue; }
      if (t.startsWith('<form')) {
        if (nivel > 0) {
          fallos.push(`${ruta}:${nro}  <form> dentro del <form> abierto en la línea ${abiertoEn}`);
        }
        abiertoEn = nro;
        nivel++;
        continue;
      }
      /* Un componente. Solo molesta si trae un <form> adentro Y estamos
         dentro de otro. */
      const nombre = m[1];
      if (nivel > 0 && importados.has(nombre)) {
        fallos.push(
          `${ruta}:${nro}  <${nombre} /> trae su propio <form> (${importados.get(nombre)}) ` +
          `y está dentro del <form> abierto en la línea ${abiertoEn}`
        );
      }
    }
  }
}

if (fallos.length) {
  console.error('\n❌ FORMULARIOS ANIDADOS — esos botones NO van a hacer nada:\n');
  for (const f of fallos) console.error('   ' + f);
  console.error(
    '\n   HTML no permite <form> dentro de <form>. El navegador se come los de\n' +
    '   adentro y los botones terminan mandando el formulario de afuera.\n' +
    '   Sacá el bloque FUERA del formulario grande.\n'
  );
  process.exit(1);
}

console.log(`✅ ${lista.length} archivos revisados · ${conForm.size} componentes traen <form> · ningún anidamiento`);
