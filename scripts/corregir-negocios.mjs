/* Correcciones de categoría, resumen y dirección salidas de la investigación
 * de las 27 fichas que faltaban. El cargador no toca estos campos a propósito.
 * La babosa NO cambia en ningún caso, así que dst_ruta se queda como está.
 */
import { createClient } from '@supabase/supabase-js';
const APLICAR = process.argv.includes('--aplicar');
const db = createClient('https://eulkufetcymallfbpone.supabase.co', process.env.SUPABASE_SECRET_KEY?.trim(), { db: { schema: 'destinos' }, auth: { persistSession: false } });

const { data: destino } = await db.from('dst_destino').select('id').eq('babosa', 'la-fortuna').single();
const { data: cats } = await db.from('dst_categoria').select('id,babosa');
const catId = Object.fromEntries(cats.map((c) => [c.babosa, c.id]));

// Mal clasificados: el resumen de la siembra no correspondía al negocio real.
const CATEGORIA = {
  'cuenca-restaurante': {
    categoria: 'cocina-internacional',
    resumen: 'Cocina que cruza Italia, Perú y España, en el hotel Casa del Río.',
    porque: 'Estaba en Saludable. Es el restaurante del hotel boutique Casa del Río, de cocina italiana, peruana y española.',
  },
  'acacia-restaurant': {
    categoria: 'cocina-internacional',
    resumen: 'Cocina internacional con producto local, dentro del bosque.',
    porque: 'Estaba en Cafeterías. Es el restaurante del hotel Noah´s Forest, con desayuno, cena y brunch, y reserva obligatoria.',
  },
};

// Direcciones exactas encontradas en fuente, donde la siembra dejó algo genérico.
const DIRECCION = {
  'tierra-mia-restaurante': 'Ruta 702, 50 metros sur de la iglesia católica',
  'soda-viquez': '50 metros sur del Parque Central',
  'soda-el-turnito': 'Calle principal, junto al Hotel Villas Vilma',
  'soda-rodriguez': '300 metros norte del Parque Central',
  'restaurante-tiquicia': '700 metros sur del Polideportivo',
  'restaurante-fortuneno': '200 metros este del Parque Central',
  'tica-grill': 'A dos cuadras de la iglesia central',
  'mirador-steak-house': '8 km del centro sobre la ruta al volcán, pasando el Hotel Montaña de Fuego',
  'restaurante-cafe-mediterraneo': '400 metros sur del centro de La Fortuna',
  'maria-bonita-steak-house': 'Calle 470, 25 metros sur de la iglesia católica',
  'restaurante-travesia': 'Calle 468, 400 metros norte del Banco Nacional',
  'bosque-restaurant': 'Dentro del Hotel Tifakara, 300 metros de la catarata de La Fortuna',
  'chifa-la-familia-feliz': 'Ruta 702, diagonal a Alamo Rent a Car',
  'kappa-sushi-fortuna': '25 metros norte del Banco Nacional',
  'que-rico-arenal': 'Contiguo al Arenal Volcano Inn, 6,5 km noroeste de la iglesia de La Fortuna',
  'rojo-coral': '2 km oeste del parque de La Fortuna, contiguo al Hotel Vista Al Cerro',
  'cuenca-restaurante': 'Avenida 301, en el Hotel Casa del Río',
  'acacia-restaurant': 'Dentro del hotel Noah´s Forest, 1 km del centro',
  'selva-negra-bar': '25 metros sur del parque de La Fortuna',
  'adobe-rent-a-car-la-fortuna': '75 metros sur de la Gasolinera La Fortuna, contiguo al Hotel La Fortuna',
};

const babosas = [...new Set([...Object.keys(CATEGORIA), ...Object.keys(DIRECCION)])];
const { data: filas } = await db.from('dst_negocio').select('id,babosa,nombre,categoria_id,direccion,resumen').eq('destino_id', destino.id).in('babosa', babosas);
const porBabosa = Object.fromEntries(filas.map((n) => [n.babosa, n]));

let cambios = 0;
for (const babosa of babosas) {
  const n = porBabosa[babosa];
  if (!n) { console.log(`  ${babosa}: NO EXISTE, se salta`); continue; }
  const parche = {};
  const c = CATEGORIA[babosa];
  if (c) {
    if (!catId[c.categoria]) { console.log(`  ${babosa}: categoría ${c.categoria} no existe`); continue; }
    if (n.categoria_id !== catId[c.categoria]) { parche.categoria_id = catId[c.categoria]; parche.resumen = c.resumen; }
  }
  const d = DIRECCION[babosa];
  if (d && n.direccion !== d) parche.direccion = d;
  if (!Object.keys(parche).length) continue;
  cambios++;
  console.log(`${babosa}${parche.categoria_id ? '  [CATEGORIA]' : ''}`);
  if (parche.categoria_id) console.log(`   ${c.porque}`);
  if (parche.direccion) console.log(`   dirección: "${n.direccion}"  ->  "${parche.direccion}"`);
  if (APLICAR) {
    const { error } = await db.from('dst_negocio').update(parche).eq('id', n.id);
    if (error) console.log(`   ERROR -> ${error.message}`);
  }
}
console.log(APLICAR ? `\nAplicado: ${cambios} negocios` : `\nEn seco: cambiarían ${cambios} negocios`);
