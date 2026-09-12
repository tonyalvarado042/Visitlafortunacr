/*
 * Escribe en dst_negocio.sitio_web los sitios que la siembra no traía.
 *
 *   node --env-file=.env.local scripts/cargar-sitios-web.mjs            (en seco)
 *   node --env-file=.env.local scripts/cargar-sitios-web.mjs --aplicar
 *
 * Lee `datos/investigacion/sitios-web-encontrados.json`.
 *
 * Dos cuidados, y los dos importan:
 *
 * 1. **Solo rellena lo que esté vacío.** Si alguien ya puso un sitio a mano, no
 *    se pisa. Es la misma regla que usa cargar-fichas.mjs con el contacto.
 * 2. **Vuelve a comprobar el título antes de escribir.** El JSON guarda el
 *    <title> que se leyó al verificarlo; aquí se pide la página otra vez y se
 *    compara. Un dominio puede caducar y cambiar de dueño entre que se
 *    investigó y que se carga, y meter en la ficha de un hotel el sitio de otra
 *    cosa es peor que dejarlo vacío. Si el título ya no coincide, se salta y
 *    lo dice.
 *
 * Necesita SUPABASE_SECRET_KEY. No hace DDL.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const APLICAR = process.argv.includes('--aplicar');
const ARCHIVO = 'datos/investigacion/sitios-web-encontrados.json';
const AGENTE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const db = createClient('https://eulkufetcymallfbpone.supabase.co', process.env.SUPABASE_SECRET_KEY?.trim(), {
  db: { schema: 'destinos' }, auth: { persistSession: false },
});

const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const clave = (s) => sinTildes(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const { sitios } = JSON.parse(readFileSync(ARCHIVO, 'utf8'));

const { data: destino, error: eDest } = await db
  .from('dst_destino').select('id').eq('babosa', 'la-fortuna').single();
if (eDest) { console.error('No se pudo leer el destino:', eDest.message); process.exit(1); }

const { data: negocios, error: eNeg } = await db
  .from('dst_negocio').select('id, babosa, nombre, sitio_web').eq('destino_id', destino.id);
if (eNeg) { console.error('No se pudieron leer los negocios:', eNeg.message); process.exit(1); }
const porBabosa = Object.fromEntries(negocios.map((n) => [n.babosa, n]));

const faltan = Object.keys(sitios).filter((b) => !porBabosa[b]);
if (faltan.length) { console.error('Babosas que no existen en la base:', faltan.join(', ')); process.exit(1); }

console.log(`${Object.keys(sitios).length} sitios en ${ARCHIVO}\n`);

const aEscribir = [];
for (const [babosa, { url, titulo_verificado }] of Object.entries(sitios)) {
  const negocio = porBabosa[babosa];

  if (negocio.sitio_web) {
    console.log(`  = ${babosa}: ya tiene (${negocio.sitio_web}), no se pisa`);
    continue;
  }

  let titulo = null;
  try {
    const r = await fetch(url, { headers: { 'user-agent': AGENTE }, redirect: 'follow', signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const html = await r.text();
    titulo = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').trim();
  } catch (e) {
    console.log(`  ! ${babosa}: no se pudo comprobar (${e.message}). NO se escribe.`);
    continue;
  }

  // No se exige que sea idéntico —los sitios cambian el título sin cambiar de
  // dueño— pero sí que siga hablando del mismo negocio.
  const esperadas = clave(titulo_verificado).split(' ').filter((p) => p.length > 3);
  const ahora = clave(titulo);
  const coinciden = esperadas.filter((p) => ahora.includes(p)).length;
  if (coinciden < 2) {
    console.log(`  ! ${babosa}: el título cambió y ya no coincide. NO se escribe.`);
    console.log(`      esperaba: ${titulo_verificado}`);
    console.log(`      ahora:    ${titulo}`);
    continue;
  }

  console.log(`  + ${babosa}: ${url}`);
  aEscribir.push({ id: negocio.id, babosa, url });
}

console.log(`\n${aEscribir.length} por escribir.`);
if (!APLICAR) { console.log('En seco. Para escribirlo: --aplicar'); process.exit(0); }

let escritos = 0;
for (const { id, babosa, url } of aEscribir) {
  // El filtro por is null es la red de seguridad: si alguien escribió el campo
  // entre la lectura de arriba y este update, esta escritura no hace nada.
  const { data, error } = await db
    .from('dst_negocio').update({ sitio_web: url }).eq('id', id).is('sitio_web', null).select('id');
  if (error) { console.error(`${babosa}:`, error.message); process.exit(1); }
  if (data?.length) escritos += 1;
  else console.log(`  = ${babosa}: alguien lo llenó mientras tanto, se respeta`);
}

console.log(`${escritos} sitios web escritos.`);
