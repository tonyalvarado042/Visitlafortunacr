/*
 * Leer los correos de un clic ANTES de que salgan, y cazar lo que delata un
 * hueco.
 *
 *   npm run correos:probar                      (con SUPABASE_SECRET_KEY)
 *   DATOS=plantillas.json npm run correos:probar (sin llaves)
 *
 * ⚠️ POR QUÉ EXISTE.
 *
 * El 9 de noviembre de 2026 una viajera de verdad recibió un correo que
 * empezaba «Hi ,» porque no tenía nombre cargado y la plantilla dice
 * `Hi {{nombre}},`. Nadie lo vio hasta que llegó. `rellenarPlantilla` se
 * escribió justo para eso — limpia el espacio que deja una variable vacía —
 * pero **una plantilla nueva puede abrir el mismo hueco por otro lado**, y
 * la limpieza no adivina todo: su propio comentario lo admite
 * («para {{destino}}.» sin destino → «para.», y eso lo arregla la plantilla,
 * no la función).
 *
 * Las cuatro plantillas del botón de un clic son nuevas (migración 49). Esto
 * las pasa por `rellenarPlantilla` DE VERDAD —la misma que corre al mandar—
 * en los tres escenarios que de verdad ocurren, y falla si queda a la vista
 * cualquier rastro del hueco.
 *
 * Lo que NO prueba: que la base entregue las plantillas ni que el correo
 * salga. Eso es `mandarCorreoRapido`, y necesita llaves.
 */

import { readFileSync } from 'node:fs';
import { rellenarPlantilla } from '../lib/plantillas.ts';

type Plantilla = { clave: string; idioma: string; asunto: string; cuerpo: string };

/* ── De dónde salen las plantillas ───────────────────────────────────────── */
let plantillas: Plantilla[];
let marca: string;
let nombreDestino: string;

if (process.env.DATOS) {
  const crudo = JSON.parse(readFileSync(process.env.DATOS, 'utf8'));
  plantillas = crudo.plantillas;
  marca = crudo.destino?.marca_nombre ?? '';
  nombreDestino = crudo.destino?.nombre ?? '';
  console.log(`(plantillas leídas de ${process.env.DATOS})`);
} else {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://eulkufetcymallfbpone.supabase.co';
  const llave = process.env.SUPABASE_SECRET_KEY;
  if (!llave) {
    console.error('Faltan las llaves. Usá DATOS=archivo.json, o poné SUPABASE_SECRET_KEY.');
    process.exit(1);
  }
  const { createClient } = await import('@supabase/supabase-js');
  const db = createClient(url, llave, { db: { schema: 'destinos' } });
  const { data: d } = await db.from('dst_destino').select('nombre, marca_nombre').eq('dominio', 'visitlafortunacr.com').maybeSingle();
  const { data: p } = await db.from('dst_plantilla_mensaje')
    .select('clave, idioma, asunto, cuerpo').eq('canal', 'email')
    .in('clave', ['respuesta_tour', 'seguimiento_1', 'seguimiento_2', 'cierre_suave']);
  plantillas = (p ?? []) as Plantilla[];
  marca = (d?.marca_nombre as string) ?? '';
  nombreDestino = (d?.nombre as string) ?? '';
}

/* ── Los tres escenarios que de verdad ocurren ───────────────────────────── */
let malosDeVariable = 0;

const ESCENARIOS = [
  {
    que: 'todo completo',
    /* Un caso real: el lead de un negocio con ficha publicada. */
    vars: {
      nombre: 'Hannah', destino: nombreDestino, marca,
      negocio: 'Bike & Bed Hotel Arenal',
      enlace_negocio: 'https://visitlafortunacr.com/es/hoteles/bike-bed-hotel-arenal',
      enlace_itinerario: '', llega_el: '', whatsapp_destino: '',
    },
  },
  {
    que: 'SIN nombre (el bug del 9 de noviembre)',
    vars: {
      nombre: '', destino: nombreDestino, marca,
      negocio: 'Bike & Bed Hotel Arenal',
      enlace_negocio: 'https://visitlafortunacr.com/es/hoteles/bike-bed-hotel-arenal',
      enlace_itinerario: '', llega_el: '', whatsapp_destino: '',
    },
  },
  {
    que: 'SIN negocio ni enlace',
    vars: {
      nombre: 'Amir', destino: nombreDestino, marca,
      negocio: '', enlace_negocio: '',
      enlace_itinerario: '', llega_el: '', whatsapp_destino: '',
    },
  },
];

/* ── Lo que delata un hueco ──────────────────────────────────────────────── */
const DELATORES: { que: string; busca: RegExp }[] = [
  { que: 'quedó una variable sin rellenar', busca: /\{\{|\}\}/ },
  { que: 'espacio antes de puntuación («Hi ,»)', busca: /[ \t]+[,.;:!?)]/ },
  { que: 'dos espacios seguidos', busca: /[^\n][ \t]{2,}/ },
  { que: 'espacio al final de una línea', busca: /[ \t]+\n/ },
  { que: 'tres saltos de línea seguidos', busca: /\n{3,}/ },
  { que: 'empieza con coma o puntuación', busca: /(^|\n)[ \t]*[,.;:]/ },
  /* «Gracias por escribirnos sobre.» — la frase sobrevive pero no dice nada.
     Es lo que `rellenarPlantilla` NO puede arreglar y la plantilla sí. */
  { que: 'una preposición huérfana antes del punto', busca: /\b(sobre|about|para|for|de|of|en|in|a)\s*\./i },
  { que: 'guion suelto de una lista vacía', busca: /(^|\n)[·\-*]\s*(\n|$)/ },
];

/*
 * ⚠️ UNA VARIABLE MAL ESCRITA SE RELLENA CON VACIO Y NADIE SE ENTERA.
 *
 * `rellenarPlantilla` reemplaza CUALQUIER {{algo_en_minusculas}} por
 * `variables[clave] ?? ''`. O sea que {{nombres}} —con la ese de mas— no deja
 * rastro: no queda un {{...}} a la vista, queda un hueco mudo. Lo encontre
 * escribiendo esta misma prueba, al intentar meterle el bug a proposito.
 *
 * Asi que se compara contra el juego de variables que el codigo REALMENTE
 * pasa. Si una plantilla nombra otra, es un error de la plantilla.
 */
const CONOCIDAS = new Set(Object.keys(ESCENARIOS[0].vars));
for (const p of plantillas) {
  for (const m of `${p.asunto}
${p.cuerpo}`.matchAll(/\{\{([a-z_]+)\}\}/g)) {
    if (!CONOCIDAS.has(m[1])) {
      console.log(`
❌ ${p.clave} · ${p.idioma}: usa {{${m[1]}}}, que nadie rellena. Va a salir un hueco mudo.`);
      console.log(`   Las que si existen: ${[...CONOCIDAS].join(', ')}`);
      malosDeVariable++;
    }
  }
}

let malos = malosDeVariable;
let revisados = 0;

for (const esc of ESCENARIOS) {
  console.log(`\n${'═'.repeat(70)}\n  ${esc.que.toUpperCase()}\n${'═'.repeat(70)}`);

  for (const p of [...plantillas].sort((a, b) => (a.clave + a.idioma).localeCompare(b.clave + b.idioma))) {
    /* ⚠️ La MISMA función que corre al mandar. Si se copiara la lógica acá,
       la prueba dejaría de probar. */
    const asunto = rellenarPlantilla(p.asunto, esc.vars);
    const cuerpo = rellenarPlantilla(p.cuerpo, esc.vars);
    revisados++;

    /* `respuesta_tour` sin negocio NO se ofrece en la pantalla —se explica por
       qué no está—, así que tampoco se le exige salir bien. Se muestra igual,
       para poder ver el porqué con los ojos. */
    const noSeOfrece = p.clave === 'respuesta_tour' && !esc.vars.negocio;

    const fallas = DELATORES
      .filter((d) => d.busca.test(asunto) || d.busca.test(cuerpo))
      .map((d) => d.que);

    const marcaLinea = fallas.length ? (noSeOfrece ? '⚠️ ' : '❌ ') : '✅ ';
    console.log(`\n${marcaLinea}${p.clave} · ${p.idioma}`);
    console.log(`   Asunto: ${asunto}`);
    console.log(cuerpo.split('\n').map((l) => `   │ ${l}`).join('\n'));

    if (fallas.length) {
      for (const f of fallas) console.log(`   ${noSeOfrece ? '⚠️' : '❌'} ${f}`);
      if (noSeOfrece) console.log('   ⚠️  …y por esto la pantalla NO ofrece el botón en este caso.');
      else malos++;
    }
  }
}

console.log(`\n${'═'.repeat(70)}`);
console.log(malos ? `  ❌ ${malos} de ${revisados} salieron mal\n` : `  ✅ ${revisados} de ${revisados} limpios\n`);
process.exit(malos ? 1 : 0);
