/*
 * Ver cómo sale un correo SIN mandarlo.
 *
 * Regla de Tony, 30 de octubre de 2026: «necesito que siempre antes dejen el
 * cerebro y mandes una prueba». Y la razón por la que la pidió: el correo de
 * aprobación había salido dos veces y NADIE lo había visto nunca —va solo al
 * destinatario, sin copia—. Cuando por fin lo vio, encontró en treinta
 * segundos tres cosas que ningún control automático agarra, entre ellas un
 * botón que no se veía en Outlook.
 *
 * El 9 de noviembre volvió a pasar, peor: una viajera de verdad recibió
 * «Hi ,\n\nYour plan for La Fortuna is ready:\n…» con los saltos de línea
 * escritos como dos caracteres. Se vio cuando Tony lo pidió, no antes.
 *
 * Esto existe para que eso no vuelva a depender de que alguien se acuerde:
 *
 *   npx tsx scripts/ver-correo.mts itinerario_listo en
 *
 * Lee la plantilla DE LA BASE —no una copia— la rellena con el MISMO
 * `rellenarPlantilla` que usa el envío de verdad, y la pasa por el MISMO
 * `armarCorreo`. Si se copiara el texto a mano, la prueba dejaría de probar.
 *
 * Escribe dos archivos y no manda nada:
 *   <salida>/correo-<clave>-<idioma>.html   lo que vería en Gmail
 *   <salida>/correo-<clave>-<idioma>.txt    lo que ve quien tiene el HTML apagado
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { rellenarPlantilla } from '../lib/plantillas.ts';
import { armarCorreo } from '../lib/correo/plantilla.ts';
import type { Destino } from '../lib/destino.ts';
import type { Idioma } from '../lib/idiomas.ts';

const clave = process.argv[2] ?? 'itinerario_listo';
const idioma = (process.argv[3] ?? 'en') as Idioma;
const salida = process.argv[4] ?? '.';
const babosaDestino = process.env.DESTINO ?? 'la-fortuna';

/*
 * De dónde salen la plantilla y el destino.
 *
 * El camino normal es la base, con la llave de SERVICIO: `dst_plantilla_mensaje`
 * no es pública —son los textos internos— así que la clave publicable no la ve.
 *
 * `DATOS=archivo.json` es la puerta de atrás para quien NO tiene esa llave
 * (Claude no la tiene y no debe tenerla: las llaves las pone Tony). El archivo
 * lleva la fila tal como está en la base, traída con otra herramienta. Sigue
 * siendo la fila de la base y no un texto escrito a mano: lo que esta prueba
 * tiene que probar es el CÓDIGO que arma el correo, y ese corre igual por los
 * dos caminos.
 */
type Plantilla = { asunto: string; cuerpo: string };
let destino: Record<string, unknown> | null = null;
let plantilla: Plantilla | null = null;

if (process.env.DATOS) {
  const crudo = JSON.parse(readFileSync(process.env.DATOS, 'utf8'));
  destino = crudo.destino;
  plantilla = crudo.plantilla;
  if (!destino || !plantilla) {
    console.error('El archivo de DATOS necesita { destino, plantilla }.');
    process.exit(1);
  }
  console.log(`(plantilla y destino leídos de ${process.env.DATOS})\n`);
} else {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const llave = process.env.SUPABASE_SECRET_KEY;
  if (!url || !llave) {
    console.error('Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY (o usá DATOS=archivo.json).');
    process.exit(1);
  }
  const db = createClient(url, llave, { db: { schema: 'destinos' } });

  const { data: d, error: eDestino } = await db
    .from('dst_destino').select('*').eq('babosa', babosaDestino).maybeSingle();
  if (eDestino || !d) {
    console.error('No se pudo leer el destino:', eDestino?.message ?? 'no existe');
    process.exit(1);
  }
  destino = d;

  const { data: p, error: ePlantilla } = await db
    .from('dst_plantilla_mensaje')
    .select('asunto, cuerpo')
    .eq('clave', clave).eq('canal', 'email').eq('idioma', idioma)
    .maybeSingle();
  if (ePlantilla || !p) {
    console.error(`No hay plantilla de correo «${clave}» en «${idioma}».`);
    process.exit(1);
  }
  plantilla = p;
}

/* Datos de muestra. Son los de un caso REAL (el plan que recibió una viajera
   el 9 de noviembre) para que la prueba se parezca a lo que sale, y no a un
   «Juan Pérez» que nunca existió. */
const variables = {
  nombre: process.env.NOMBRE ?? 'Hannah',
  destino: String(destino.nombre),
  marca: String(destino.marca_nombre),
  enlace_itinerario: process.env.ENLACE
    ?? `https://${String(destino.dominio)}/en/plan/three-family-days-in-la-fortuna-volcano-waterfall-and-hot-sp-sarsjw`,
};

const asunto = rellenarPlantilla(plantilla.asunto, variables);
const cuerpo = rellenarPlantilla(plantilla.cuerpo, variables);

/*
 * De una plantilla de texto plano al formato de `armarCorreo`.
 *
 * El enlace suelto se saca y se vuelve BOTÓN: una URL de noventa caracteres
 * en medio de un párrafo es lo que la viajera recibió y lo que no se puede
 * tocar con el pulgar.
 */
const BOTON: Partial<Record<Idioma, string>> = {
  es: 'Ver mi plan', en: 'See my plan', pt: 'Ver meu plano',
  fr: 'Voir mon plan', de: 'Meinen Plan ansehen',
};

const lineas = cuerpo.split('\n\n').map((p) => p.trim()).filter(Boolean);
const parrafos: string[] = [];
let boton: { texto: string; url: string } | undefined;

for (const parrafo of lineas) {
  const soloUrl = parrafo.match(/^https?:\/\/\S+$/);
  if (soloUrl) { boton = { texto: BOTON[idioma] ?? BOTON.es!, url: parrafo }; continue; }

  /* La plantilla termina con {{marca}} en una línea sola: el pie ya la dice,
     así que repetirla es ruido. */
  if (parrafo === String(destino.marca_nombre)) continue;

  /* Un párrafo que repite el asunto sobra: el correo ya lo trae de título. */
  if (parrafo.replace(/[:.]$/, '') === asunto.replace(/[:.]$/, '')) continue;

  /* «Your plan is ready:\nhttps://…» viene pegado en un solo párrafo. */
  const conEnlace = parrafo.match(/^([\s\S]*?)\n(https?:\/\/\S+)$/);
  if (conEnlace) {
    const texto = conEnlace[1].trim();
    if (texto && texto.replace(/[:.]$/, '') !== asunto.replace(/[:.]$/, '')) parrafos.push(texto);
    boton = { texto: BOTON[idioma] ?? BOTON.es!, url: conEnlace[2] };
    continue;
  }
  parrafos.push(parrafo);
}

/* Las razones y la urgencia salen de Ajustes → Textos del sitio. Acá se
   pueden pasar por el entorno para VER cómo quedan antes de escribirlas:
     RAZONES="una|otra|otra mas" URGENCIA="..." npm run correo:ver ... */
const razones = (process.env.RAZONES ?? '').split('|').map((r) => r.trim()).filter(Boolean);
const urgencia = (process.env.URGENCIA ?? '').trim();

const { html, texto } = armarCorreo({
  destino: destino as unknown as Destino,
  idioma, titulo: asunto, parrafos, boton,
  tokenBaja: 'PRUEBA-no-es-un-testigo-de-verdad',
  razones, urgencia,
});

mkdirSync(salida, { recursive: true });
const base = `${salida}/correo-${clave}-${idioma}`;
writeFileSync(`${base}.html`, html, 'utf8');
writeFileSync(`${base}.txt`, `Asunto: ${asunto}\n\n${texto}`, 'utf8');

console.log(`Asunto: ${asunto}`);
console.log(`Párrafos: ${parrafos.length}${boton ? ` · botón «${boton.texto}»` : ' · SIN BOTÓN'}`);
console.log(`\n${base}.html`);
console.log(`${base}.txt`);

/* El control que sí se puede automatizar: que no quede un hueco sin llenar
   ni un salto de línea escrito como dos caracteres, que es el bug del 9 de
   noviembre. Ver `ningun-hueco-sale-sin-llenar` en el cerebro. */
const problemas: string[] = [];
if (/\{\{[a-z_]+\}\}/.test(html)) problemas.push('quedó un {{hueco}} sin llenar');
if (/\\n/.test(html)) problemas.push('hay un \\n escrito como dos caracteres');
if (/\s,|\s\./.test(texto)) problemas.push('hay un espacio antes de una coma o un punto');
if (!boton) problemas.push('no se encontró enlace para el botón');
if (problemas.length) {
  console.error(`\n⚠️  ${problemas.join('; ')}`);
  process.exit(1);
}
console.log('\nSin huecos, sin \\n literales, sin espacios sueltos.');
