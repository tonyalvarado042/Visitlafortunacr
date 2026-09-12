/*
 * Saca del sitio los negocios que no tienen foto, y los devuelve cuando la
 * tienen.
 *
 *   node --env-file=.env.local scripts/archivar-sin-foto.mjs              (en seco)
 *   node --env-file=.env.local scripts/archivar-sin-foto.mjs --aplicar
 *   node --env-file=.env.local scripts/archivar-sin-foto.mjs --reactivar --aplicar
 *
 * Archivar, no borrar. `estado_publicacion = 'archivado'` los quita del sitio,
 * del buscador y del catálogo que ve la IA igual de bien que un DELETE —el
 * sitio solo lee 'publicado'—, pero **conserva la ficha**: las secciones
 * investigadas, las etiquetas, los horarios, las rutas y las traducciones al
 * inglés. Borrar los 39 de La Fortuna se habría llevado 98 secciones de las
 * 231 que se escribieron, y habría que investigarlas de nuevo el día que
 * aparezca la foto.
 *
 * `--reactivar` es el camino de vuelta: republica lo archivado que ya tenga
 * foto. Es lo que hay que correr después de cada tanda de fotos nuevas.
 *
 * Necesita SUPABASE_SECRET_KEY. No hace DDL.
 */
import { createClient } from '@supabase/supabase-js';

const APLICAR = process.argv.includes('--aplicar');
const REACTIVAR = process.argv.includes('--reactivar');

const db = createClient('https://eulkufetcymallfbpone.supabase.co', process.env.SUPABASE_SECRET_KEY?.trim(), {
  db: { schema: 'destinos' }, auth: { persistSession: false },
});

const { data: destino, error: eDest } = await db
  .from('dst_destino').select('id').eq('babosa', 'la-fortuna').single();
if (eDest) { console.error('No se pudo leer el destino:', eDest.message); process.exit(1); }

// Quién tiene foto se mira en dst_negocio_foto y no en negocios_publicados,
// porque esa vista solo devuelve lo publicado y entonces no vería nunca a los
// archivados: --reactivar no podría encontrar a nadie.
const { data: fotos, error: eFotos } = await db.from('dst_negocio_foto').select('negocio_id');
if (eFotos) { console.error('No se pudieron leer las fotos:', eFotos.message); process.exit(1); }
const conFoto = new Set(fotos.map((f) => f.negocio_id));

const { data: negocios, error: eNeg } = await db
  .from('dst_negocio').select('id, babosa, nombre, estado_publicacion, categoria:dst_categoria(seccion)')
  .eq('destino_id', destino.id);
if (eNeg) { console.error('No se pudieron leer los negocios:', eNeg.message); process.exit(1); }

const objetivo = REACTIVAR
  ? negocios.filter((n) => n.estado_publicacion === 'archivado' && conFoto.has(n.id))
  : negocios.filter((n) => n.estado_publicacion === 'publicado' && !conFoto.has(n.id));

const nuevoEstado = REACTIVAR ? 'publicado' : 'archivado';
const publicados = negocios.filter((n) => n.estado_publicacion === 'publicado').length;

console.log(`${negocios.length} negocios · ${publicados} publicados · ${conFoto.size} con foto\n`);

if (!objetivo.length) {
  console.log(REACTIVAR
    ? 'No hay ningún archivado que ya tenga foto. Nada que reactivar.'
    : 'Todos los publicados tienen foto. Nada que archivar.');
  process.exit(0);
}

const porSeccion = {};
for (const n of objetivo) {
  const s = n.categoria?.seccion ?? 'sin seccion';
  (porSeccion[s] ??= []).push(n.babosa);
}

console.log(`${objetivo.length} pasarían a "${nuevoEstado}":`);
for (const [seccion, babosas] of Object.entries(porSeccion)) {
  console.log(`  ${seccion} (${babosas.length}): ${babosas.join(', ')}`);
}

if (!APLICAR) {
  console.log('\nEn seco. Para aplicarlo: --aplicar');
  console.log('Esto NO borra nada: la ficha, las secciones y las traducciones se quedan.');
  process.exit(0);
}

const { data: hechos, error } = await db
  .from('dst_negocio').update({ estado_publicacion: nuevoEstado })
  .in('id', objetivo.map((n) => n.id)).select('id');
if (error) { console.error('No se pudo actualizar:', error.message); process.exit(1); }

console.log(`\n${hechos.length} negocios a "${nuevoEstado}".`);
if (!REACTIVAR) {
  console.log('Para devolver al sitio los que vayan consiguiendo foto:');
  console.log('  node --env-file=.env.local scripts/archivar-sin-foto.mjs --reactivar --aplicar');
}
