/*
 * La firma del webhook de correo entrante, probada de verdad.
 *
 *   npm run firma:probar
 *
 * ⚠️ POR QUÉ EXISTE.
 *
 * Una revisión de firma falla de dos maneras y las dos son calladas:
 *
 *   - Rechaza todo → no entra ni un correo, y en los registros solo queda
 *     «firma rechazada». Nadie se enterá hasta que un viajero reclame.
 *   - Acepta todo  → cualquiera puede inventar un correo de un viajero,
 *     abrirle conversación en el CRM y hacer que le contestemos.
 *
 * Un probador que solo manda la firma buena no distingue una cosa de la otra:
 * la versión «return { ok: true }» pasaría esa prueba con 10 de 10. Por eso acá
 * la mitad de los casos son firmas MALAS, cada una rota de una forma distinta,
 * y el probador falla si alguna pasa.
 *
 * Esto corre con `node` pelado, sin dependencias y sin llaves de nadie.
 */

import { firmaValida, firmarComoSvix, TOLERANCIA_SEGUNDOS } from '../lib/correo/firma-svix.ts';

/* Un secreto de mentira, con la misma forma que el de Resend: `whsec_` y
   base64. No es el de nadie: lo genera este archivo y muere acá. */
const SECRETO = `whsec_${Buffer.from('un-secreto-de-prueba-que-no-abre-nada').toString('base64')}`;
const OTRO_SECRETO = `whsec_${Buffer.from('otro-secreto-distinto-del-de-arriba').toString('base64')}`;

const CUERPO = JSON.stringify({
  type: 'email.received',
  created_at: '2026-11-16T10:00:00.000Z',
  data: {
    email_id: '56761188-7520-42d8-8898-ff6fc54ce618',
    from: 'viajera@example.com',
    to: ['respuestas@correo.visitlafortunacr.com'],
    message_id: '<111-222-333@email.example.com>',
    subject: 'Re: tu consulta del Cerro Chato',
  },
});

const ID = 'msg_2abcDEF';
const AHORA = 1_763_289_600; // un reloj fijo, para que la prueba no dependa de la hora
const SELLO = String(AHORA);

let bien = 0;
let mal = 0;

function caso(nombre: string, seEspera: 'pasa' | 'rebota', hacer: () => ReturnType<typeof firmaValida>) {
  let r: ReturnType<typeof firmaValida>;
  try {
    r = hacer();
  } catch (fallo) {
    /* Una firma rara NO puede tumbar la ruta: un `throw` acá sería un 500 en
       producción, y Resend reintentaría el mismo correo para siempre. */
    console.log(`  ❌ ${nombre} — se cayó en vez de rebotar: ${fallo instanceof Error ? fallo.message : fallo}`);
    mal++;
    return;
  }
  const paso = r.ok;
  const correcto = seEspera === 'pasa' ? paso : !paso;
  if (correcto) {
    console.log(`  ✅ ${nombre}${paso ? '' : ` → ${(r as { porque: string }).porque}`}`);
    bien++;
  } else {
    console.log(`  ❌ ${nombre} — se esperaba que ${seEspera === 'pasa' ? 'PASARA y rebotó' : 'REBOTARA y pasó'}`);
    mal++;
  }
}

const firmaBuena = firmarComoSvix(CUERPO, ID, SELLO, SECRETO);

console.log('\n  La firma que SÍ tiene que pasar\n');

caso('firma correcta', 'pasa', () =>
  firmaValida(CUERPO, { id: ID, timestamp: SELLO, firma: firmaBuena }, SECRETO, AHORA));

caso('varias firmas, la nuestra entre ellas (rotación de secreto)', 'pasa', () =>
  firmaValida(CUERPO, { id: ID, timestamp: SELLO, firma: `v1,otraCosaQueNoCalza ${firmaBuena}` }, SECRETO, AHORA));

caso('justo en el borde de la ventana', 'pasa', () =>
  firmaValida(CUERPO, { id: ID, timestamp: SELLO, firma: firmaBuena }, SECRETO, AHORA + TOLERANCIA_SEGUNDOS));

caso('un cuerpo con acentos y emoji (no se rompe el UTF-8)', 'pasa', () => {
  const cuerpo = JSON.stringify({ type: 'email.received', data: { subject: '¿Vamos al Cerro Chato? 🌋 — mañana' } });
  return firmaValida(cuerpo, { id: ID, timestamp: SELLO, firma: firmarComoSvix(cuerpo, ID, SELLO, SECRETO) }, SECRETO, AHORA);
});

console.log('\n  Las firmas que TIENEN que rebotar\n');

caso('sin ninguna cabecera', 'rebota', () =>
  firmaValida(CUERPO, { id: null, timestamp: null, firma: null }, SECRETO, AHORA));

caso('falta solo el svix-id', 'rebota', () =>
  firmaValida(CUERPO, { id: null, timestamp: SELLO, firma: firmaBuena }, SECRETO, AHORA));

caso('firma de otro secreto', 'rebota', () =>
  firmaValida(CUERPO, { id: ID, timestamp: SELLO, firma: firmarComoSvix(CUERPO, ID, SELLO, OTRO_SECRETO) }, SECRETO, AHORA));

caso('el cuerpo cambió después de firmar', 'rebota', () =>
  firmaValida(CUERPO.replace('viajera@example.com', 'atacante@example.com'),
    { id: ID, timestamp: SELLO, firma: firmaBuena }, SECRETO, AHORA));

caso('el svix-id cambió (firma de otro aviso)', 'rebota', () =>
  firmaValida(CUERPO, { id: 'msg_otroCompletamente', timestamp: SELLO, firma: firmaBuena }, SECRETO, AHORA));

caso('el sello cambió (firma de otro momento)', 'rebota', () =>
  firmaValida(CUERPO, { id: ID, timestamp: String(AHORA - 1), firma: firmaBuena }, SECRETO, AHORA));

caso('repetición: aviso viejo, firma legítima', 'rebota', () =>
  firmaValida(CUERPO, { id: ID, timestamp: SELLO, firma: firmaBuena }, SECRETO, AHORA + TOLERANCIA_SEGUNDOS + 1));

caso('del futuro, fuera de la ventana', 'rebota', () =>
  firmaValida(CUERPO, { id: ID, timestamp: SELLO, firma: firmaBuena }, SECRETO, AHORA - TOLERANCIA_SEGUNDOS - 1));

caso('sello que no es número', 'rebota', () =>
  firmaValida(CUERPO, { id: ID, timestamp: 'ayer', firma: firmaBuena }, SECRETO, AHORA));

caso('la firma va sin la versión', 'rebota', () =>
  firmaValida(CUERPO, { id: ID, timestamp: SELLO, firma: firmaBuena.replace('v1,', '') }, SECRETO, AHORA));

caso('una versión que no sabemos revisar (v2)', 'rebota', () =>
  firmaValida(CUERPO, { id: ID, timestamp: SELLO, firma: firmaBuena.replace('v1,', 'v2,') }, SECRETO, AHORA));

caso('firma vacía', 'rebota', () =>
  firmaValida(CUERPO, { id: ID, timestamp: SELLO, firma: 'v1,' }, SECRETO, AHORA));

caso('sin secreto configurado', 'rebota', () =>
  firmaValida(CUERPO, { id: ID, timestamp: SELLO, firma: firmaBuena }, '', AHORA));

caso('secreto que no es base64 utilizable', 'rebota', () =>
  firmaValida(CUERPO, { id: ID, timestamp: SELLO, firma: firmaBuena }, 'whsec_', AHORA));

caso('firma más corta (no se cae el timingSafeEqual)', 'rebota', () =>
  firmaValida(CUERPO, { id: ID, timestamp: SELLO, firma: 'v1,abc' }, SECRETO, AHORA));

caso('firma larguísima', 'rebota', () =>
  firmaValida(CUERPO, { id: ID, timestamp: SELLO, firma: `v1,${'A'.repeat(5000)}` }, SECRETO, AHORA));

console.log('\n' + '─'.repeat(70));
console.log(mal ? `  ❌ ${mal} de ${bien + mal} MAL\n` : `  ✅ ${bien} de ${bien} bien\n`);
process.exit(mal ? 1 : 0);
