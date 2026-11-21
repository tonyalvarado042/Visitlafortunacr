/*
 * ¿La función que explica por qué una tour no se vende dice la verdad?
 *
 *   npm run vende:probar
 *
 * ⚠️ POR QUÉ EXISTE.
 *
 * `porQueNoSeVende` es un ESPEJO de `destinos.tour_reservable`. Un espejo
 * puede mentir de dos maneras y las dos son calladas:
 *
 *   - Dice «no se vende» cuando sí → Tony sale a arreglar algo que no está
 *     roto, y desconfía del panel.
 *   - Dice «se puede reservar» cuando NO → es el bug original otra vez, pero
 *     peor: ahora con un cartel verde que jura que todo está bien.
 *
 * Lo segundo es lo que pasa si alguien le agrega una condición a la función
 * de la base y se olvida de este archivo. Por eso acá hay un caso por CADA
 * condición, y la prueba falla si queda alguna sin cubrir.
 *
 * Corre con `node` pelado, sin llaves y sin base.
 */

import { porQueNoSeVende, CONDICIONES, type DatosDeVenta } from '../lib/se-vende.ts';

const HOY = '2026-11-20';

/** Una tour que SÍ se vende. Cada caso parte de esta y rompe UNA cosa. */
const BUENA: DatosDeVenta = {
  reservas_activas: true,
  estado: 'publicado',
  negocio_id: 'f1216baf-4066-4787-8f4f-c00e5d12d74a',
  negocio_estado: 'publicado',
  negocio_cerrado: false,
  vende_por_aqui: true,
  contrato_id: '135a4e4a-0fb9-4af9-97e5-4679c2d4a19c',
  contrato_activo: true,
  vigencia_desde: '2026-01-01',
  vigencia_hasta: '2027-01-01',
  precio_adulto_usd: 80,
};

let bien = 0;
let mal = 0;
const vistas = new Set<string>();

function caso(nombre: string, cambio: Partial<DatosDeVenta>, claveEsperada: string) {
  const r = porQueNoSeVende({ ...BUENA, ...cambio }, HOY);
  vistas.add(r.clave);
  const ok = r.clave === claveEsperada && r.se_vende === (claveEsperada === 'ok');
  if (ok) {
    console.log(`  ✅ ${nombre.padEnd(46)} → ${r.rotulo}`);
    bien++;
  } else {
    console.log(`  ❌ ${nombre.padEnd(46)} → esperaba «${claveEsperada}», dio «${r.clave}» (se_vende=${r.se_vende})`);
    mal++;
  }
  /* Si no se vende, TIENE que decir qué hacer. Un «no se vende» sin arreglo
     deja a Tony igual de perdido que el silencio de antes. */
  if (!r.se_vende && !r.arreglo) {
    console.log(`     ❌ ...y no dice qué hacer`);
    mal++;
  }
}

console.log('\n  La que SÍ se vende\n');
caso('todo en orden', {}, 'ok');
caso('sin fechas de vigencia (contrato abierto)', { vigencia_desde: null, vigencia_hasta: null }, 'ok');
caso('la vigencia arranca HOY mismo', { vigencia_desde: HOY }, 'ok');
caso('la vigencia vence HOY mismo', { vigencia_hasta: HOY }, 'ok');

console.log('\n  Las que NO, una por cada condición de la base\n');
caso('el módulo de reservas está apagado', { reservas_activas: false }, 'reservas_apagadas');
caso('la tour está en borrador', { estado: 'borrador' }, 'no_publicada');
caso('la tour está pendiente', { estado: 'pendiente' }, 'no_publicada');
caso('no tiene operador', { negocio_id: null }, 'sin_operador');
caso('el operador no está publicado', { negocio_estado: 'borrador' }, 'operador_no_publicado');
caso('el operador está cerrado', { negocio_cerrado: true }, 'operador_cerrado');
caso('el operador no vende por aquí', { vende_por_aqui: false }, 'no_vende_por_aqui');
caso('SIN CONTRATO (el caso de Hanging Bridges)', { contrato_id: null }, 'sin_contrato');
caso('contrato amarrado pero apagado', { contrato_activo: false }, 'contrato_apagado');
caso('el contrato empieza mañana', { vigencia_desde: '2026-11-21' }, 'vigencia_no_empezo');
caso('el contrato venció ayer', { vigencia_hasta: '2026-11-19' }, 'contrato_vencido');
caso('sin precio de adulto', { precio_adulto_usd: null }, 'sin_precio');
caso('precio de adulto en cero', { precio_adulto_usd: 0 }, 'sin_precio');

console.log('\n  El orden: lo más general manda\n');
/* Con TODO roto a la vez tiene que quejarse de lo primero, no de lo último:
   mandar a cargar un precio cuando el módulo está apagado es mandar a
   arreglar lo que no es. */
caso('todo roto a la vez → se queja del módulo',
  { reservas_activas: false, estado: 'borrador', contrato_id: null, precio_adulto_usd: null },
  'reservas_apagadas');
caso('sin contrato Y sin precio → manda el contrato',
  { contrato_id: null, precio_adulto_usd: null }, 'sin_contrato');

console.log('\n  ¿Quedó alguna condición de la base sin probar?\n');
const sinProbar = CONDICIONES.filter((c) => !vistas.has(c));
if (sinProbar.length) {
  console.log(`  ❌ ${sinProbar.length} sin caso: ${sinProbar.join(', ')}`);
  mal += sinProbar.length;
} else {
  console.log(`  ✅ las ${CONDICIONES.length} condiciones tienen su caso`);
  bien++;
}

console.log('\n' + '─'.repeat(72));
console.log(mal ? `  ❌ ${mal} MAL de ${bien + mal}\n` : `  ✅ ${bien} de ${bien} bien\n`);
process.exit(mal ? 1 : 0);
