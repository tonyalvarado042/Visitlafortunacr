/*
 * Escribe `fotos/FALTAN.md`: qué negocios siguen sin foto y cómo se llama la
 * carpeta de cada uno.
 *
 *   node --env-file=.env.local scripts/listar-fotos-que-faltan.mjs
 *
 * Se genera desde la base, no desde una lista escrita a mano, porque el nombre
 * de la carpeta TIENE que ser la babosa exacta del negocio y varias no son las
 * que uno supondría (Baldi es `baldi-hot-springs`, el Observatory es
 * `arenal-observatory-lodge`, Kenko es `kenko-bar-restaurante`).
 *
 * Se puede volver a correr cuando se hayan subido más: la lista se rehace.
 */
import { writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const db = createClient('https://eulkufetcymallfbpone.supabase.co', process.env.SUPABASE_SECRET_KEY?.trim(), {
  db: { schema: 'destinos' }, auth: { persistSession: false },
});

const { data: destino } = await db.from('dst_destino').select('id, dominio').eq('babosa', 'la-fortuna').single();
const { data: np, error } = await db.rpc('negocios_publicados', { p_dominio: destino.dominio, p_idioma: 'es' });
if (error) { console.error(error.message); process.exit(1); }

const { data: negocios } = await db
  .from('dst_negocio')
  .select('babosa, nombre, direccion, sitio_web, categoria:dst_categoria(nombre, seccion)')
  .eq('destino_id', destino.id).eq('estado_publicacion', 'publicado');

const conPortada = new Set(np.filter((n) => n.foto_portada_url).map((n) => n.babosa));
const faltan = negocios.filter((n) => !conPortada.has(n.babosa));

const porSeccion = {};
for (const n of faltan) {
  const s = n.categoria?.seccion ?? 'sin seccion';
  (porSeccion[s] ??= []).push(n);
}

mkdirSync('fotos', { recursive: true });
const yaPuestas = existsSync('fotos') ? readdirSync('fotos').filter((c) => !c.endsWith('.md')) : [];

const lineas = [
  '# Fotos que faltan',
  '',
  `Generado desde la base. **${faltan.length} de ${np.length} negocios sin foto.**`,
  '',
  '## Cómo dejarlas',
  '',
  'Una subcarpeta por negocio, **con exactamente el nombre que dice la columna',
  '`carpeta`** de las tablas de abajo. No es el nombre del negocio: es su babosa,',
  'y varias no se parecen (Baldi es `baldi-hot-springs`, Kenko es',
  '`kenko-bar-restaurante`). Si el nombre no coincide, el cargador avisa y se',
  'salta esa carpeta.',
  '',
  '```',
  'fotos/soda-viquez/1.jpg',
  'fotos/soda-viquez/2.jpg',
  'fotos/tica-grill/1.jpg',
  '```',
  '',
  '- **La primera en orden alfabético es la portada**, la que sale en la tarjeta.',
  '  Por eso conviene numerarlas `1`, `2`, `3`.',
  '- Valen `.jpg`, `.png`, `.webp` y `.avif`. Se reducen a 1600 px y se pasan a',
  '  webp al subir, así que no hace falta prepararlas.',
  '- Cuantas más grandes mejor: por debajo de unos 900 px de ancho se ven mal en',
  '  la ficha.',
  '- Con **una sola basta** para que la tarjeta deje de estar vacía.',
  '',
  '## Qué NO poner',
  '',
  'Es lo que ya hizo fallar dos intentos, así que vale repetirlo:',
  '',
  '- **Logos**, y banners promocionales con precios o texto encima.',
  '- **Fotos de categoría**: una piscina cualquiera en la ficha de un hotel, la',
  '  rana de ojos rojos en la de un parque. La foto tiene que ser DE ESE lugar.',
  '- **La foto de otra ficha.** Un restaurante dentro de un hotel necesita una',
  '  foto del restaurante, no la del hotel que ya está usada.',
  '- Capturas de pantalla, collages y fotos con marca de agua.',
  '',
  '## Cuando estén listas',
  '',
  '```',
  'node --env-file=.env.local scripts/cargar-fotos.mjs             (en seco, dice qué haría)',
  'node --env-file=.env.local scripts/cargar-fotos.mjs --aplicar',
  '```',
  '',
  'Es idempotente: reconoce por URL lo que ya subió, así que se puede correr las',
  'veces que haga falta. `scripts/preparar-fotos.mjs` **no toca** las carpetas',
  'que pongas a mano.',
  '',
];

const TITULOS = {
  comer_beber: 'Comer y beber',
  que_hacer: 'Qué hacer',
  donde_dormir: 'Dónde dormir',
  transporte: 'Transporte',
  tours: 'Tours',
  explorar: 'Explorar',
};

// Comer y beber primero: es el hueco grande.
const orden = ['comer_beber', 'que_hacer', 'donde_dormir', 'transporte', 'tours', 'explorar'];
for (const seccion of [...orden, ...Object.keys(porSeccion).filter((s) => !orden.includes(s))]) {
  const grupo = porSeccion[seccion];
  if (!grupo?.length) continue;
  lineas.push(`## ${TITULOS[seccion] ?? seccion} (${grupo.length})`, '');
  lineas.push('| carpeta | negocio | categoría | dónde está | sitio web |');
  lineas.push('|---|---|---|---|---|');
  for (const n of grupo.sort((a, b) => a.babosa.localeCompare(b.babosa))) {
    const web = n.sitio_web ? `[web](${n.sitio_web})` : '—';
    const puesta = yaPuestas.includes(n.babosa) ? ' ✅' : '';
    lineas.push(`| \`${n.babosa}\`${puesta} | ${n.nombre} | ${n.categoria?.nombre ?? '—'} | ${n.direccion ?? '—'} | ${web} |`);
  }
  lineas.push('');
}

writeFileSync('fotos/FALTAN.md', lineas.join('\n'));
console.log(`fotos/FALTAN.md · ${faltan.length} negocios sin foto`);
for (const [s, g] of Object.entries(porSeccion)) console.log(`   ${s}: ${g.length}`);
