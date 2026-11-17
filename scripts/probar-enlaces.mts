/*
 * Las pruebas de lib/enlaces.ts.  `npm run enlaces:probar`
 *
 * ⚠️ NO alcanza con que la funcion diga «ok». Lo que importa es que el valor
 * que devuelve lo ACEPTE POSTGRES, asi que cada resultado se pasa por las
 * MISMAS expresiones que tienen los `check` de la base. Si alguien afloja una
 * de las dos, esto se pone rojo.
 */
import { enlaceDeRed, sitioWeb, correo, telefono } from '../lib/enlaces.ts';

/* Copiadas de pg_constraint, tal cual las devolvio la base. */
const CHECK = {
  facebook: /^https?:\/\/([a-z0-9-]+\.)?(facebook\.com|fb\.com|fb\.me)\/.+/i,
  instagram: /^https?:\/\/([a-z0-9-]+\.)?instagram\.com\/.+/i,
  sitio: /^https?:\/\//,
  email: /^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/,
  tel: /^\+[1-9][0-9]{6,14}$/,
};

type Caso = { que: string; entra: string; espera: string | null | 'ERROR'; check?: RegExp };
const CASOS: Caso[] = [
  // ── EL CASO QUE ROMPIO LA FICHA DE BIKE & BED ──────────────────────────
  { que: 'facebook', entra: 'facebook.com/bikeandbed', espera: 'https://facebook.com/bikeandbed', check: CHECK.facebook },
  { que: 'facebook', entra: 'www.facebook.com/BikeAndBed', espera: 'https://www.facebook.com/BikeAndBed', check: CHECK.facebook },
  { que: 'facebook', entra: '@bikeandbed', espera: 'https://www.facebook.com/bikeandbed', check: CHECK.facebook },
  { que: 'facebook', entra: 'bikeandbed', espera: 'https://www.facebook.com/bikeandbed', check: CHECK.facebook },
  { que: 'facebook', entra: ' https://www.facebook.com/p/Bike-Bed-123/ ', espera: 'https://www.facebook.com/p/Bike-Bed-123/', check: CHECK.facebook },
  { que: 'facebook', entra: '', espera: null },
  // Lo que NO se adivina: se avisa, no se inventa.
  { que: 'facebook', entra: 'https://facebook.com', espera: 'ERROR' },
  { que: 'facebook', entra: 'https://www.instagram.com/otracosa', espera: 'ERROR' },
  { que: 'facebook', entra: 'no se, preguntale al duenno', espera: 'ERROR' },

  { que: 'instagram', entra: '@bikeandbed', espera: 'https://www.instagram.com/bikeandbed', check: CHECK.instagram },
  { que: 'instagram', entra: 'instagram.com/bikeandbed', espera: 'https://instagram.com/bikeandbed', check: CHECK.instagram },
  { que: 'instagram', entra: 'https://www.facebook.com/x', espera: 'ERROR' },

  { que: 'sitio', entra: 'bikeandbedarenal.com', espera: 'https://bikeandbedarenal.com', check: CHECK.sitio },
  { que: 'sitio', entra: 'www.bikeandbed.cr/reservas', espera: 'https://www.bikeandbed.cr/reservas', check: CHECK.sitio },
  { que: 'sitio', entra: 'http://viejo.com', espera: 'http://viejo.com', check: CHECK.sitio },
  { que: 'sitio', entra: '', espera: null },
  { que: 'sitio', entra: 'asdf', espera: 'ERROR' },

  { que: 'email', entra: '  TONY@Gmail.COM ', espera: 'tony@gmail.com', check: CHECK.email },
  { que: 'email', entra: 'tony@gmail', espera: 'ERROR' },
  { que: 'email', entra: 'tony arroba gmail.com', espera: 'ERROR' },
  { que: 'email', entra: '', espera: null },

  { que: 'tel', entra: '+506 2479 1234', espera: '+50624791234', check: CHECK.tel },
  { que: 'tel', entra: '(506) 8888-8888', espera: '+50688888888', check: CHECK.tel },
  { que: 'tel', entra: '', espera: null },
  // Ocho digitos ticos sin codigo: PASAN el check de la base por casualidad y
  // quedan como un numero que no existe. Por eso se avisa.
  { que: 'tel', entra: '2479-1234', espera: 'ERROR' },
  { que: 'tel', entra: '8888 8888', espera: 'ERROR' },
  { que: 'tel', entra: '123', espera: 'ERROR' },
];

const correr = (c: Caso) =>
  c.que === 'facebook' || c.que === 'instagram' ? enlaceDeRed(c.entra, c.que)
  : c.que === 'sitio' ? sitioWeb(c.entra)
  : c.que === 'email' ? correo(c.entra)
  : telefono(c.entra, 'telefono');

let fallos = 0;
for (const c of CASOS) {
  const r = correr(c);
  const obtuvo = r.error ? 'ERROR' : r.valor;
  let mal = obtuvo !== c.espera ? `esperaba ${JSON.stringify(c.espera)}` : '';

  /* La prueba de verdad: lo que devuelve, ¿lo traga Postgres? */
  if (!mal && c.check && typeof obtuvo === 'string' && !c.check.test(obtuvo)) {
    mal = `la BASE lo rechazaria: ${obtuvo}`;
  }

  if (mal) { fallos++; console.log(`  ✗ ${c.que} «${c.entra}» -> ${JSON.stringify(obtuvo)} — ${mal}`); }
  else console.log(`  ✓ ${c.que} «${c.entra}» -> ${r.error ? 'aviso: ' + r.error : JSON.stringify(obtuvo)}`);
}

console.log(fallos ? `\n${fallos} de ${CASOS.length} MAL` : `\n${CASOS.length} de ${CASOS.length} bien`);
process.exit(fallos ? 1 : 0);
