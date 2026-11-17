/*
 * Probar a quién le pertenece un correo que ENTRA, sin base de datos y sin MX.
 *
 *   npm run entrante:probar
 *
 * ⚠️ POR QUÉ EXISTE.
 *
 * El correo entrante del sitio está escrito y desplegado desde el 10 de
 * noviembre de 2026, pero DORMIDO: no hay MX apuntándole. Cuando se encienda
 * va a llegar a un **subdominio** —`correo.visitlafortunacr.com`— porque el
 * dominio pelado ya recibe correo por SiteGround y no se puede tocar.
 *
 * Y el código, tal como estaba, NO habría enganchado ese subdominio: buscaba
 * `dominio.eq.correo.visitlafortunacr.com`, que no es igual a
 * `visitlafortunacr.com`. O sea: se encendía el MX, llegaba la respuesta de
 * una viajera, y se perdía con una línea en los registros. El agujero que
 * `entrante.ts` existe para tapar, abierto de nuevo por el lado del DNS.
 *
 * Esto se habría visto el día del estreno, con un cliente de verdad. Ahora se
 * ve acá.
 *
 * Llama a `direccionSana` y `dominiosPosibles` DE VERDAD —las mismas que corre
 * el correo entrante—, no una copia. Si se copiara el texto a mano, la prueba
 * dejaría de probar.
 */

import { direccionSana, dominiosPosibles, soloDireccion, soloLoNuevo } from '../lib/correo/direcciones.ts';

/* El dominio que `dst_destino.dominio` tiene hoy. Si un caso dice que
   «engancha», es contra este. */
const NUESTRO = 'visitlafortunacr.com';

type Caso = {
  que: string;
  para: string;
  /** ¿la dirección pasa el filtro de forma? */
  sana: boolean;
  /** ¿alguno de los dominios posibles es EXACTAMENTE el nuestro? */
  engancha: boolean;
};

const CASOS: Caso[] = [
  /* ── Lo que tiene que entrar ─────────────────────────────────────────── */
  { que: 'el dominio pelado, como hoy', para: 'hola@visitlafortunacr.com', sana: true, engancha: true },
  { que: 'el subdominio que se va a usar', para: 'respuestas@correo.visitlafortunacr.com', sana: true, engancha: true },
  { que: 'otro subdominio cualquiera nuestro', para: 'x@inbound.visitlafortunacr.com', sana: true, engancha: true },
  { que: 'dos niveles de subdominio', para: 'x@a.b.visitlafortunacr.com', sana: true, engancha: true },
  { que: 'con punto y guion en el nombre', para: 'ana.maria-r@correo.visitlafortunacr.com', sana: true, engancha: true },
  { que: 'con + de Gmail', para: 'hola+plan@visitlafortunacr.com', sana: true, engancha: true },

  /* ── Lo que NO tiene que entrar ──────────────────────────────────────── */
  { que: 'nuestro dominio METIDO en uno ajeno', para: 'x@visitlafortunacr.com.de-otro.com', sana: true, engancha: false },
  { que: 'un dominio parecido al nuestro', para: 'x@mal-visitlafortunacr.com', sana: true, engancha: false },
  { que: 'un dominio que nos lleva de sufijo', para: 'x@novisitlafortunacr.com', sana: true, engancha: false },
  { que: 'otro dominio del todo', para: 'x@gmail.com', sana: true, engancha: false },

  /* ── Lo que no es una dirección ──────────────────────────────────────── */
  { que: 'sin arroba', para: 'visitlafortunacr.com', sana: false, engancha: false },
  { que: 'sin dominio', para: 'hola@', sana: false, engancha: false },
  { que: 'un host sin punto', para: 'hola@localhost', sana: false, engancha: false },
  { que: 'vacía', para: '', sana: false, engancha: false },

  /* ── El intento de torcer la consulta ───────────────────────────────────
     `.or()` de PostgREST se arma con comas y paréntesis, y esta dirección la
     elige quien escribe. Estas tienen que rebotar en el filtro de forma,
     ANTES de tocar la base. */
  { que: 'cierra el filtro y abre otro', para: 'x@a.com),email_noreply.eq.y@z.com', sana: false, engancha: false },
  { que: 'mete una coma', para: 'x@a.com,dominio.eq.visitlafortunacr.com', sana: false, engancha: false },
  { que: 'mete un asterisco', para: 'x@*.com', sana: false, engancha: false },
  { que: 'mete un espacio', para: 'x@a .com', sana: false, engancha: false },
  { que: 'mete comillas', para: 'x@"a".com', sana: false, engancha: false },
  { que: 'mete un salto de línea', para: 'x@a.com\ndominio.eq.visitlafortunacr.com', sana: false, engancha: false },
];

let malos = 0;
console.log('\n  A quién le pertenece un correo que entra\n');

for (const c of CASOS) {
  /* Tal como lo hace `recibirCorreo`: pela el nombre y baja a minúsculas. */
  const para = soloDireccion(c.para).toLowerCase();
  const sana = direccionSana(para);
  const dominios = dominiosPosibles(para);
  const engancha = dominios.includes(NUESTRO);

  const fallas: string[] = [];
  if (sana !== c.sana) fallas.push(`sana: esperaba ${c.sana}, dio ${sana}`);
  if (engancha !== c.engancha) fallas.push(`engancha: esperaba ${c.engancha}, dio ${engancha}`);
  /* Una dirección que no pasa el filtro de forma NUNCA debe llegar a la
     consulta, así que tampoco debería poder enganchar un destino. */
  if (!sana && engancha) fallas.push('no es sana y aun así engancha: eso es la consulta expuesta');

  if (fallas.length) {
    malos++;
    console.log(`  ❌ ${c.que}`);
    console.log(`     ${JSON.stringify(c.para)}`);
    for (const f of fallas) console.log(`     ${f}`);
  } else {
    console.log(`  ✅ ${c.que.padEnd(38)} ${c.engancha ? 'entra' : 'no entra'}`);
  }
}

/* El recorte de la cita del hilo ya estaba probado a mano el 10 de noviembre;
   queda acá para que no se pierda al cambiar el archivo. */
const CITAS: { que: string; crudo: string; esperado: string }[] = [
  {
    que: 'cita de Gmail en español',
    crudo: 'Sí, nos interesa.\n\nEl 10 nov 2026, a las 9:00, Visit La Fortuna CR escribió:\n> Tu plan está listo',
    esperado: 'Sí, nos interesa.',
  },
  {
    que: 'cita de Gmail en inglés',
    crudo: 'Sounds great!\n\nOn Mon, 10 Nov 2026 at 09:00, Visit La Fortuna CR wrote:\n> Your plan is ready',
    esperado: 'Sounds great!',
  },
  {
    que: 'una fecha que NO es una cita',
    crudo: 'Llegamos el 10 nov 2026 a las 9:00 y queremos el tour.',
    esperado: 'Llegamos el 10 nov 2026 a las 9:00 y queremos el tour.',
  },
];

console.log('\n  El recorte de la cita del hilo\n');
for (const c of CITAS) {
  const dio = soloLoNuevo(c.crudo).trim();
  if (dio !== c.esperado) {
    malos++;
    console.log(`  ❌ ${c.que}`);
    console.log(`     esperaba: ${JSON.stringify(c.esperado)}`);
    console.log(`     dio:      ${JSON.stringify(dio)}`);
  } else {
    console.log(`  ✅ ${c.que}`);
  }
}

const total = CASOS.length + CITAS.length;
console.log(malos ? `\n  ❌ ${malos} de ${total} MAL\n` : `\n  ✅ ${total} de ${total} bien\n`);
process.exit(malos ? 1 : 0);
