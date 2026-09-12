/*
 * Le busca sitio web a los negocios que no lo tienen en la base.
 *
 *   node scripts/buscar-sitio-web.mjs
 *
 * Prueba dominios probables armados desde el nombre y **verifica que la página
 * hable de ese negocio** antes de dar nada por bueno: pide la portada y busca
 * en el texto las palabras distintivas del nombre. Sin esa comprobación esto
 * sería adivinar, y un dominio ocupado por otra cosa —un parking de dominios,
 * una cadena con nombre parecido— metería fotos de otro lugar en la ficha, que
 * es exactamente el error que todo este proceso existe para evitar.
 *
 * Escribe `.sitios-encontrados.json`. NO toca la base: los sitios se revisan y
 * se cargan aparte.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const AGENTE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

// Palabras que no distinguen a nadie: no sirven ni para armar el dominio ni
// para comprobar que la página es la correcta.
const VACIAS = new Set(['hotel', 'hoteles', 'restaurante', 'restaurant', 'the', 'la', 'el', 'los', 'las',
  'de', 'del', 'y', 'and', 'spa', 'resort', 'lodge', 'bar', 'cafe', 'soda', 'tour', 'tours',
  'comida', 'tipica', 'grill', 'steak', 'house', 'suites', 'springs', 'hot', 'natural', 'park']);

const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const palabras = (s) => sinTildes(s).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** Dominios a probar, del más probable al menos. */
function candidatos(nombre) {
  const todas = palabras(nombre);
  const fuertes = todas.filter((p) => !VACIAS.has(p));
  const bases = new Set();
  if (todas.length) bases.add(todas.join(''));
  if (fuertes.length) bases.add(fuertes.join(''));
  if (fuertes.length > 1) bases.add(fuertes.slice(0, 2).join(''));
  if (fuertes.length === 1) { bases.add(`${fuertes[0]}arenal`); bases.add(`${fuertes[0]}lafortuna`); }
  if (fuertes.length) bases.add(`hotel${fuertes.join('')}`);

  const urls = [];
  for (const base of bases) {
    if (base.length < 4 || base.length > 30) continue;
    for (const tld of ['.com', '.cr', '.co.cr']) urls.push(`https://www.${base}${tld}`, `https://${base}${tld}`);
  }
  return urls;
}

/*
 * ¿La página es de ESTE negocio? Se piden dos cosas a la vez, y las dos hacen
 * falta:
 *
 *   1. una palabra distintiva del nombre, y
 *   2. una señal de que el sitio es de aquí (La Fortuna, Arenal, Costa Rica,
 *      un teléfono +506).
 *
 * Con solo la primera esto daba disparates: "Mirador Steak House" caía en
 * icapital.com/data-solutions, "Tica Grill" en una naviera y "El Salto" en
 * salto.com. Una palabra suelta dentro de 300 kB de HTML no prueba nada; que
 * además diga Costa Rica, sí.
 */
const LOCAL = /(la\s*fortuna|arenal|costa\s*rica|\+506|tel[^0-9]{0,8}2\d{3}[\s-]?\d{4})/i;

function hablaDe(html, nombre) {
  const texto = sinTildes(html).toLowerCase();
  const fuertes = palabras(nombre).filter((p) => !VACIAS.has(p) && p.length > 3);
  if (!fuertes.length) return false;
  if (!fuertes.some((p) => texto.includes(p))) return false;
  if (!LOCAL.test(texto)) return false;

  /*
   * Y la que de verdad decide: la palabra distintiva tiene que estar en el
   * TÍTULO. Con las dos comprobaciones de arriba solas seguían colándose seis
   * negocios equivocados, todos ticos y todos con la palabra suelta en algún
   * lado del HTML: "Acacia" era la Asociación Costarricense de Agencias de
   * Carga, "Mirador" una inmobiliaria, "Rodríguez" un expresidente de la
   * República y "Víquez" un estudio de arquitectura. El título es lo único que
   * dice de qué es el sitio.
   */
  const titulo = sinTildes(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').toLowerCase();
  if (!titulo) return false;
  return fuertes.some((p) => titulo.includes(p));
}

const negocios = JSON.parse(readFileSync('.negocios.json', 'utf8')).filter((n) => !n.sitio_web);
const encontrados = {};

for (const [i, negocio] of negocios.entries()) {
  let hallado = null;
  for (const url of candidatos(negocio.nombre)) {
    try {
      const r = await fetch(url, {
        headers: { 'user-agent': AGENTE, accept: 'text/html' },
        redirect: 'follow', signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) continue;
      const html = await r.text();
      if (html.length < 500) continue;
      if (!hablaDe(html, negocio.nombre)) continue;
      hallado = r.url;
      break;
    } catch { /* no resuelve, timeout o TLS roto */ }
  }
  if (hallado) encontrados[negocio.babosa] = hallado;
  console.log(`[${i + 1}/${negocios.length}] ${negocio.babosa}: ${hallado ?? '—'}`);
}

writeFileSync('.sitios-encontrados.json', JSON.stringify(encontrados, null, 2));
console.log(`\n${Object.keys(encontrados).length} de ${negocios.length} con sitio encontrado y verificado.`);
