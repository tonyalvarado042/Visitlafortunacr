/*
 * Carga en la base el contenido investigado de las fichas:
 * datos/investigacion/fichas-la-fortuna.json → dst_negocio_seccion (+ su
 * traducción al inglés), dst_negocio_horario, dst_negocio_etiqueta y los
 * datos de contacto de dst_negocio.
 *
 *   node --env-file=.env.local scripts/cargar-fichas.mjs            (en seco)
 *   node --env-file=.env.local scripts/cargar-fichas.mjs --aplicar
 *
 * Se puede correr las veces que haga falta: todo va por upsert, así que
 * reescribe lo que cambió y no duplica nada. El contacto es la excepción —
 * solo rellena lo que esté vacío, porque lo que corrigió una persona no se
 * pisa.
 *
 * Necesita SUPABASE_SECRET_KEY. No hace DDL: la tabla la crea la migración 21.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const APLICAR = process.argv.includes('--aplicar');
const ARCHIVO = 'datos/investigacion/fichas-la-fortuna.json';

// De arriba abajo en la ficha. Qué esperar va primero: es lo que decide si
// alguien sigue leyendo.
const ORDEN = { que_esperar: 10, incluye: 20, no_incluye: 30, encuentro: 40, accesibilidad: 50, adicional: 60 };

const db = createClient('https://eulkufetcymallfbpone.supabase.co', process.env.SUPABASE_SECRET_KEY?.trim(), {
  db: { schema: 'destinos' }, auth: { persistSession: false },
});

const { negocios } = JSON.parse(readFileSync(ARCHIVO, 'utf8'));
const { data: destino } = await db.from('dst_destino').select('id').eq('babosa', 'la-fortuna').single();
const { data: filas } = await db.from('dst_negocio').select('id, babosa, sitio_web, telefono, precio_desde_usd').eq('destino_id', destino.id);
const { data: catalogo } = await db.from('dst_etiqueta').select('id, babosa');

const porBabosa = Object.fromEntries(filas.map((n) => [n.babosa, n]));
const etiquetaId = Object.fromEntries(catalogo.map((e) => [e.babosa, e.id]));

const faltan = negocios.filter((n) => !porBabosa[n.babosa]).map((n) => n.babosa);
const etiquetasMalas = [...new Set(negocios.flatMap((n) => n.etiquetas ?? []).filter((e) => !etiquetaId[e]))];

console.log(`${negocios.length} fichas en ${ARCHIVO}`);
if (faltan.length) console.log('  negocios que no existen en la base:', faltan);
if (etiquetasMalas.length) console.log('  etiquetas que no existen en el catalogo:', etiquetasMalas);
if (faltan.length || etiquetasMalas.length) process.exit(1);

const resumen = { secciones: 0, traducciones: 0, horarios: 0, etiquetas: 0, contacto: 0 };

for (const ficha of negocios) {
  const negocio = porBabosa[ficha.babosa];

  // --- Secciones, en el idioma principal ---
  const claves = Object.keys(ficha.secciones ?? {});
  if (claves.length && APLICAR) {
    const { data: guardadas, error } = await db.from('dst_negocio_seccion').upsert(
      claves.map((clave) => ({
        negocio_id: negocio.id, clave, orden: ORDEN[clave] ?? 99,
        contenido: ficha.secciones[clave].es.trim(),
      })),
      { onConflict: 'negocio_id,clave' }
    ).select('id, clave');
    if (error) { console.log(`  ${ficha.babosa}: ERROR secciones → ${error.message}`); continue; }

    // --- Y su inglés, que va a dst_traduccion como todo lo demás ---
    const enIngles = guardadas
      .filter((s) => ficha.secciones[s.clave].en)
      .map((s) => ({
        entidad: 'negocio_seccion', entidad_id: s.id, campo: 'contenido', idioma: 'en',
        texto: ficha.secciones[s.clave].en.trim(), origen: 'importado', esta_revisada: false,
      }));
    if (enIngles.length) {
      const { error: e2 } = await db.from('dst_traduccion')
        .upsert(enIngles, { onConflict: 'entidad,entidad_id,campo,idioma' });
      if (e2) console.log(`  ${ficha.babosa}: ERROR traducciones → ${e2.message}`);
      else resumen.traducciones += enIngles.length;
    }
  }
  resumen.secciones += claves.length;

  // --- Horario ---
  if (ficha.horario?.length && APLICAR) {
    const { error } = await db.from('dst_negocio_horario').upsert(
      ficha.horario.map((h) => ({
        negocio_id: negocio.id, dia_semana: h.dia,
        abre_a: h.cerrado ? null : h.abre, cierra_a: h.cerrado ? null : h.cierra,
        esta_cerrado: !!h.cerrado,
      })),
      { onConflict: 'negocio_id,dia_semana' }
    );
    if (error) console.log(`  ${ficha.babosa}: ERROR horario → ${error.message}`);
  }
  resumen.horarios += ficha.horario?.length ?? 0;

  // --- Etiquetas ---
  if (ficha.etiquetas?.length && APLICAR) {
    const { error } = await db.from('dst_negocio_etiqueta').upsert(
      ficha.etiquetas.map((e) => ({ negocio_id: negocio.id, etiqueta_id: etiquetaId[e] })),
      { onConflict: 'negocio_id,etiqueta_id', ignoreDuplicates: true }
    );
    if (error) console.log(`  ${ficha.babosa}: ERROR etiquetas → ${error.message}`);
  }
  resumen.etiquetas += ficha.etiquetas?.length ?? 0;

  // --- Contacto: solo lo que falte ---
  const contacto = {};
  if (ficha.sitio_web && !negocio.sitio_web) contacto.sitio_web = ficha.sitio_web;
  if (ficha.telefono && !negocio.telefono) contacto.telefono = ficha.telefono;
  if (ficha.precio_desde_usd && !negocio.precio_desde_usd) contacto.precio_desde_usd = ficha.precio_desde_usd;
  if (Object.keys(contacto).length) {
    resumen.contacto++;
    if (APLICAR) {
      const { error } = await db.from('dst_negocio').update(contacto).eq('id', negocio.id);
      if (error) console.log(`  ${ficha.babosa}: ERROR contacto → ${error.message}`);
    }
  }
}

console.log(APLICAR ? '\nAplicado:' : '\nEn seco, se aplicaria:');
console.log(`  secciones ${resumen.secciones} · traducciones al ingles ${resumen.traducciones || '(solo con --aplicar)'}`);
console.log(`  dias de horario ${resumen.horarios} · etiquetas ${resumen.etiquetas} · negocios con contacto nuevo ${resumen.contacto}`);
