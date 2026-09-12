/*
 * Carga lo que sabe el agente sobre un destino:
 * datos/investigacion/conocimiento-la-fortuna.md → dst_conocimiento.
 *
 *   node --env-file=.env.local scripts/cargar-conocimiento.mjs            (en seco)
 *   node --env-file=.env.local scripts/cargar-conocimiento.mjs --aplicar
 *
 * El archivo es markdown a propósito: lo tiene que poder leer y corregir una
 * persona que sepa de La Fortuna y no de SQL. Cada `### titulo` es una fila.
 *
 * La llave es el titulo: volver a correrlo reescribe la ficha que ya existe en
 * vez de duplicarla, asi que se puede correr las veces que haga falta.
 *
 * Todo entra esta_verificado = false, incluso lo que alguien ya haya leido en
 * el .md. La marca de verificado se pone desde /admin/ia/conocimiento, que es
 * donde queda constancia de quien la puso.
 *
 * Necesita SUPABASE_SECRET_KEY. No hace DDL: la tabla la crea la migración 11.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const APLICAR = process.argv.includes('--aplicar');
const ARCHIVO = 'datos/investigacion/conocimiento-la-fortuna.md';
const DESTINO = 'la-fortuna';

const TIPOS = ['dato', 'faq', 'politica', 'guion', 'regla', 'aviso', 'negocio', 'tour'];

const db = createClient('https://eulkufetcymallfbpone.supabase.co', process.env.SUPABASE_SECRET_KEY?.trim(), {
  db: { schema: 'destinos' }, auth: { persistSession: false },
});

// --- Leer el markdown -------------------------------------------------------
// Las vallas ``` se saltan enteras: el encabezado del archivo enseña el formato
// dentro de un bloque de código y ese ejemplo no es una ficha.

const lineas = readFileSync(ARCHIVO, 'utf8').split(/\r?\n/);
const fichas = [];
let actual = null;
let enValla = false;

const cerrar = () => {
  if (!actual) return;
  actual.contenido = actual.cuerpo.join('\n').trim();
  delete actual.cuerpo;
  fichas.push(actual);
  actual = null;
};

for (const linea of lineas) {
  if (linea.trimStart().startsWith('```')) { enValla = !enValla; continue; }
  if (enValla) continue;

  const titulo = linea.match(/^###\s+(.+?)\s*$/);
  if (titulo) { cerrar(); actual = { titulo: titulo[1], cuerpo: [] }; continue; }

  // Un encabezado de sección (# o ##) o el --- que las separa cierra la ficha.
  if (/^#{1,2}\s/.test(linea) || /^---\s*$/.test(linea)) { cerrar(); continue; }
  if (!actual) continue;

  const meta = linea.match(/^`(.+)`\s*$/);
  if (meta && !actual.cuerpo.length) {
    for (const parte of meta[1].split('·')) {
      // Solo el primer ":" separa; un título que reemplazar puede traer los suyos.
      const corte = parte.indexOf(':');
      if (corte < 0) continue;
      const clave = parte.slice(0, corte).trim();
      const valor = parte.slice(corte + 1).trim();
      if (clave === 'tipo') actual.tipo = valor;
      if (clave === 'prioridad') actual.prioridad = Number(valor);
      if (clave === 'confianza') actual.confianza = valor;
      if (clave === 'reemplaza') actual.reemplaza = valor;
      if (clave === 'para') {
        actual.para_concierge = /concierge/.test(valor ?? '');
        actual.para_planificador = /planificador/.test(valor ?? '');
      }
    }
    continue;
  }

  const etiquetas = linea.match(/^\*\*Etiquetas\*\*:\s*(.+)$/);
  if (etiquetas && !actual.cuerpo.length) {
    actual.etiquetas = etiquetas[1].split(',').map((e) => e.trim()).filter(Boolean);
    continue;
  }

  const fuente = linea.match(/^\*\*Fuente\*\*:\s*(.+)$/);
  if (fuente && !actual.cuerpo.length) { actual.fuente = fuente[1].trim(); continue; }

  if (!actual.cuerpo.length && !linea.trim()) continue; // el hueco antes del cuerpo
  actual.cuerpo.push(linea);
}
cerrar();

// --- Validar antes de tocar nada -------------------------------------------
// Se planta y no escribe nada: media carga es peor que ninguna.

const problemas = [];
for (const f of fichas) {
  const donde = `"${f.titulo}"`;
  if (!TIPOS.includes(f.tipo)) problemas.push(`${donde}: tipo "${f.tipo ?? '(falta)'}" no existe`);
  if (!Number.isInteger(f.prioridad) || f.prioridad < 0 || f.prioridad > 10) {
    problemas.push(`${donde}: prioridad "${f.prioridad ?? '(falta)'}" tiene que ser un entero de 0 a 10`);
  }
  if (!f.para_concierge && !f.para_planificador) problemas.push(`${donde}: no sirve para ningún agente`);
  if (!f.contenido) problemas.push(`${donde}: sin contenido`);
}

const repetidos = fichas.map((f) => f.titulo).filter((t, i, a) => a.indexOf(t) !== i);
for (const t of [...new Set(repetidos)]) problemas.push(`"${t}": el título está dos veces, y el título es la llave`);

console.log(`${fichas.length} fichas en ${ARCHIVO}`);
if (problemas.length) {
  console.log('\nNo se cargó nada. Hay que arreglar esto primero:');
  for (const p of problemas) console.log(`  - ${p}`);
  process.exit(1);
}

const porTipo = {};
for (const f of fichas) porTipo[f.tipo] = (porTipo[f.tipo] ?? 0) + 1;
console.log('  por tipo:', Object.entries(porTipo).map(([t, n]) => `${t} ${n}`).join(', '));
const bajas = fichas.filter((f) => f.confianza === 'baja').length;
if (bajas) console.log(`  ${bajas} con confianza baja (precios y horarios, van con la advertencia en la fuente)`);

// --- Escribir ---------------------------------------------------------------

const { data: destino, error: errDestino } = await db
  .from('dst_destino').select('id').eq('babosa', DESTINO).single();
if (errDestino) { console.error(errDestino); process.exit(1); }

const { data: existentes, error: errLeer } = await db
  .from('dst_conocimiento').select('id, titulo').eq('destino_id', destino.id);
if (errLeer) { console.error(errLeer); process.exit(1); }

// Una ficha pisa a la que ya existe con su mismo título, o a la que nombre en
// `reemplaza` cuando se le cambió el título. Sin eso, renombrar una ficha deja
// la vieja viva y el agente se queda con dos versiones del mismo dato.
const idPorTitulo = Object.fromEntries(existentes.map((f) => [f.titulo, f.id]));
for (const f of fichas) f.id = idPorTitulo[f.titulo] ?? idPorTitulo[f.reemplaza] ?? null;

const huerfanas = fichas.filter((f) => f.reemplaza && !idPorTitulo[f.reemplaza] && !idPorTitulo[f.titulo]);
for (const f of huerfanas) console.log(`  aviso: "${f.titulo}" dice reemplazar a "${f.reemplaza}", que no está en la base. Entra como nueva.`);

const nuevas = fichas.filter((f) => !f.id);
const reemplazadas = fichas.filter((f) => f.id);
const intactas = existentes.filter((f) => !fichas.some((n) => n.id === f.id));

console.log(`\n${nuevas.length} nuevas · ${reemplazadas.length} reemplazan una que ya existe · ${intactas.length} en la base que este archivo no toca`);
if (reemplazadas.length) {
  console.log('  reemplaza:', reemplazadas
    .map((f) => (f.reemplaza && f.reemplaza !== f.titulo ? `${f.reemplaza} → ${f.titulo}` : f.titulo))
    .join(' · '));
}
if (intactas.length) console.log('  no toca:', intactas.map((f) => f.titulo).join(' · '));

if (!APLICAR) {
  console.log('\nEn seco. Para escribirlo: --aplicar');
  process.exit(0);
}

const fila = (f) => ({
  destino_id: destino.id,
  tipo: f.tipo,
  titulo: f.titulo,
  contenido: f.contenido,
  idioma: 'es',
  etiquetas: f.etiquetas ?? [],
  prioridad: f.prioridad,
  para_concierge: f.para_concierge,
  para_planificador: f.para_planificador,
  // La confianza no es columna de la tabla, pero tiene que verse en el panel:
  // un precio sacado de una guía de viajes no es lo mismo que uno confirmado.
  fuente: [f.fuente, f.confianza ? `(confianza: ${f.confianza})` : null].filter(Boolean).join(' ') || null,
  esta_verificado: false,
  esta_activo: true,
});

let escritas = 0;
for (const f of fichas) {
  const { error } = f.id
    ? await db.from('dst_conocimiento').update(fila(f)).eq('id', f.id)
    : await db.from('dst_conocimiento').insert(fila(f));
  if (error) { console.error(`\n"${f.titulo}":`, error.message); process.exit(1); }
  escritas += 1;
}

console.log(`\n${escritas} fichas escritas. Todas sin verificar: hay que repasarlas en /admin/ia/conocimiento.`);
