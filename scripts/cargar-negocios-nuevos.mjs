/*
 * Agrega negocios al directorio: la fila, sus rutas y su traducción al inglés.
 *
 *   node --env-file=.env.local scripts/cargar-negocios-nuevos.mjs            (en seco)
 *   node --env-file=.env.local scripts/cargar-negocios-nuevos.mjs --aplicar
 *
 * Lee `datos/investigacion/negocios-nuevos.json`. Hace lo mismo que hizo la
 * migración 20 pero por PostgREST, que alcanza porque son DATOS y no DDL.
 *
 * Tres cosas que hay que hacer juntas o el negocio queda roto:
 *
 *   1. la fila en `dst_negocio`,
 *   2. una fila en `dst_ruta` por idioma, que es lo que resuelve la URL —sin
 *      eso la ficha no abre—, y
 *   3. `dst_traduccion` con el resumen y la descripción en inglés.
 *
 * Entran `estado_verificacion = 'pendiente'` y la traducción con
 * `esta_revisada = false`: son textos que nadie del equipo ha leído.
 *
 * Es idempotente por babosa: un negocio que ya existe se salta entero.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const APLICAR = process.argv.includes('--aplicar');
const ARCHIVO = 'datos/investigacion/negocios-nuevos.json';

const db = createClient('https://eulkufetcymallfbpone.supabase.co', process.env.SUPABASE_SECRET_KEY?.trim(), {
  db: { schema: 'destinos' }, auth: { persistSession: false },
});

const { negocios } = JSON.parse(readFileSync(ARCHIVO, 'utf8'));

const { data: destino, error: eD } = await db.from('dst_destino').select('id').eq('babosa', 'la-fortuna').single();
if (eD) { console.error(eD.message); process.exit(1); }

const { data: cats } = await db.from('dst_destino_categoria')
  .select('categoria:dst_categoria(id, babosa)').eq('destino_id', destino.id).eq('es_visible', true);
const catId = Object.fromEntries(cats.map((c) => [c.categoria.babosa, c.categoria.id]));

const { data: existentes } = await db.from('dst_negocio').select('babosa').eq('destino_id', destino.id);
const yaEstan = new Set(existentes.map((n) => n.babosa));

// Validar todo antes de escribir nada: media carga es peor que ninguna.
const problemas = [];
for (const n of negocios) {
  if (!catId[n.categoria]) problemas.push(`${n.babosa}: la categoría "${n.categoria}" no está encendida en La Fortuna`);
  if (!n.descripcion) problemas.push(`${n.babosa}: sin descripción (publicado la exige)`);
  if (n.sitio_web && !/^https?:\/\//.test(n.sitio_web)) problemas.push(`${n.babosa}: sitio_web tiene que empezar por http`);
}
if (problemas.length) {
  console.log('No se cargó nada:');
  for (const p of problemas) console.log(`  - ${p}`);
  process.exit(1);
}

const nuevos = negocios.filter((n) => !yaEstan.has(n.babosa));
const repetidos = negocios.filter((n) => yaEstan.has(n.babosa));

console.log(`${negocios.length} en ${ARCHIVO} · ${nuevos.length} nuevos · ${repetidos.length} ya existen`);
if (repetidos.length) console.log(`  ya existen: ${repetidos.map((n) => n.babosa).join(', ')}`);
for (const n of nuevos) console.log(`  + ${n.babosa} (${n.categoria})`);

if (!nuevos.length) process.exit(0);
if (!APLICAR) { console.log('\nEn seco. Para escribirlo: --aplicar'); process.exit(0); }

let hechos = 0;
for (const n of nuevos) {
  const { data: fila, error } = await db.from('dst_negocio').insert({
    destino_id: destino.id,
    categoria_id: catId[n.categoria],
    nombre: n.nombre,
    babosa: n.babosa,
    resumen: n.resumen,
    descripcion: n.descripcion,
    direccion: n.direccion ?? null,
    sitio_web: n.sitio_web ?? null,
    rango_precio: n.rango_precio ?? null,
    estado_publicacion: 'publicado',
    estado_verificacion: 'pendiente',
    fuente_dato: 'siembra_manual',
    publicado_en: new Date().toISOString(),
  }).select('id').single();
  if (error) { console.error(`${n.babosa}:`, error.message); process.exit(1); }

  // Las rutas: una por idioma. Sin esto la ficha no tiene URL y no abre.
  const { error: eR } = await db.from('dst_ruta').insert(['es', 'en'].map((idioma) => ({
    destino_id: destino.id, entidad: 'negocio', entidad_id: fila.id,
    idioma, babosa: n.babosa, es_vigente: true,
  })));
  if (eR) { console.error(`${n.babosa} (rutas):`, eR.message); process.exit(1); }

  const traducciones = [];
  if (n.descripcion_en) traducciones.push({ campo: 'descripcion', texto: n.descripcion_en });
  if (n.resumen_en) traducciones.push({ campo: 'resumen', texto: n.resumen_en });
  if (traducciones.length) {
    const { error: eT } = await db.from('dst_traduccion').insert(traducciones.map((t) => ({
      entidad: 'negocio', entidad_id: fila.id, campo: t.campo, idioma: 'en',
      texto: t.texto, origen: 'humano', esta_revisada: false,
    })));
    if (eT) { console.error(`${n.babosa} (traducciones):`, eT.message); process.exit(1); }
  }

  hechos += 1;
  console.log(`  ✓ ${n.babosa}`);
}

console.log(`\n${hechos} negocios agregados, publicados y sin verificar.`);
console.log('Ahora las fotos: scripts/preparar-fotos.mjs --aplicar && scripts/cargar-fotos.mjs --aplicar');
