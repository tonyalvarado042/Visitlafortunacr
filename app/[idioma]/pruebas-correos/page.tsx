import { notFound } from 'next/navigation';
/* El mismo CSS del panel: sin esto la tarjeta se veria sin estilo y «quedo
   bonita» no se podria juzgar. */
import '@/app/admin/admin.css';
import { CorreosDeUnClic } from '@/app/admin/(panel)/leads/[id]/CorreosDeUnClic';
import type { CorreoDeUnClic } from '@/lib/correo/respuestas';

/*
 * Ver la tarjeta «Contestarle ya» SIN base de datos y SIN entrar al panel.
 *
 * ⚠️ POR QUE EXISTE, Y POR QUE NO SE PUEDE ABRIR EN PRODUCCION.
 *
 * El panel necesita SUPABASE_SECRET_KEY para pintar un lead, y esa llave la
 * pone Tony en el panel de Cloudflare — acá no está y no debe estar. Sin eso
 * la pantalla no se puede mirar con los ojos antes de desplegarla, y entonces
 * «quedó bonita» sería una opinión y no un hecho.
 *
 * Esta ruta monta el MISMO componente con datos de ejemplo. No prueba que la
 * base entregue los correos —eso es `correosDeUnClic`— pero sí prueba lo que
 * no se puede probar leyendo: cómo se ve, cómo se porta al cambiar de
 * pestaña, y que los tres estados raros (sin ficha, sin correo, con aviso) se
 * vean como corresponde.
 *
 * `notFound()` en producción: una ruta de prueba abierta al público es una
 * puerta que nadie cerró.
 */
export const dynamic = 'force-dynamic';

const CORREOS: CorreoDeUnClic[] = [
  {
    clave: 'respuesta_tour',
    titulo: 'Responderle sobre el tour',
    cuando: 'La primera respuesta a quien preguntó por algo concreto.',
    asunto: 'Sobre Bike & Bed Hotel Arenal — Visit La Fortuna CR',
    cuerpo: `Hola Hannah,

Gracias por escribirnos sobre Bike & Bed Hotel Arenal. Con gusto te ayudamos.

https://visitlafortunacr.com/es/hoteles/bike-bed-hotel-arenal

Contanos dos cosas y te mandamos todo de una:

· ¿Qué día lo harías?
· ¿Cuántas personas van?

Con eso te confirmamos la disponibilidad y el precio exacto, sin vueltas.

Visit La Fortuna CR`,
    porQueNo: null,
  },
  {
    clave: 'seguimiento_1',
    titulo: 'Seguimiento',
    cuando: 'A los pocos días, si no contestó.',
    asunto: '¿Seguimos con lo de La Fortuna?',
    cuerpo: `Hola Hannah,

Te escribimos hace unos días por tu consulta para La Fortuna y no queremos dejarte colgado.

¿Seguís con la idea? Decime las fechas y cuántos van, y te armo la opción concreta hoy mismo.

Y si ya lo resolviste por otro lado, decímelo nomás y no te escribo más.

Visit La Fortuna CR`,
    porQueNo: null,
  },
  {
    clave: 'seguimiento_2',
    titulo: 'Último intento',
    cuando: 'La segunda y última insistencia.',
    asunto: 'Una última idea para tu viaje a La Fortuna',
    cuerpo: `Hola Hannah,

Es la última vez que te molesto con esto.

Si todavía estás viendo La Fortuna, lo que mejor le funciona a casi todo el mundo es cerrar primero la actividad principal y acomodar el resto alrededor: los días buenos se llenan y el resto del viaje se arma solo.

Decime qué te gustaría hacer y te mando la opción. Vos decidís.

Si no es el momento, igual de bien. Buen viaje.

Visit La Fortuna CR`,
    porQueNo: null,
  },
  {
    clave: 'cierre_suave',
    titulo: 'Cerrar sin portazo',
    cuando: 'Cuando ya no contestó, dejando la puerta abierta.',
    asunto: 'Cierro tu consulta de La Fortuna',
    cuerpo: `Hola Hannah,

Como no supe más de vos, voy a cerrar tu consulta para no seguir llenándote el correo.

Si más adelante retomás el viaje, respondé este mismo correo y lo abrimos de nuevo — no hay que empezar de cero.

Que estés bien,
Visit La Fortuna CR`,
    porQueNo: null,
  },
];

const SIN_FICHA = CORREOS.map((c) =>
  c.clave === 'respuesta_tour'
    ? { ...c, porQueNo: 'Esta consulta no trae un tour ni un negocio, así que este correo no tendría de qué hablar. Usá el de abajo o escribile a mano.' }
    : c,
);

export default async function PaginaPruebasCorreos() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    /* ⚠️ DENTRO DE .admin. Casi todo el CSS del panel esta scopeado ahi
       (`.admin .boton.verde`, por ejemplo). Sin este div la prueba muestra
       colores que NO son los que Tony va a ver, y una prueba que no reproduce
       el contexto real miente en las dos direcciones. */
    <main className="admin" style={{ maxWidth: 820, margin: '0 auto', padding: '32px 16px 80px' }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Prueba de pantalla: «Contestarle ya»</h1>
      <p style={{ color: '#8B8B87', fontSize: 13.5, marginTop: 0 }}>
        Solo en desarrollo. Mismo componente que la ficha del lead, con datos de ejemplo.
      </p>

      <h2 style={{ fontSize: 15, marginTop: 30 }}>1 · Lo normal: todo listo para mandar</h2>
      <CorreosDeUnClic
        id="00000000-0000-0000-0000-000000000001"
        para="hannah@example.com" nombre="Hannah"
        problema={null} avisos={[]} correos={CORREOS}
      />

      <h2 style={{ fontSize: 15, marginTop: 30 }}>2 · La consulta no trae tour ni negocio</h2>
      <CorreosDeUnClic
        id="00000000-0000-0000-0000-000000000002"
        para="amir@example.com" nombre="Amir"
        problema={null} avisos={[]} correos={SIN_FICHA}
      />

      <h2 style={{ fontSize: 15, marginTop: 30 }}>3 · El viajero no tiene correo</h2>
      <CorreosDeUnClic
        id="00000000-0000-0000-0000-000000000003"
        para={null} nombre="Sin correo"
        problema="Este viajero no tiene correo cargado. Ponele uno en la ficha y vuelve a aparecer el botón."
        avisos={[]} correos={CORREOS}
      />

      <h2 style={{ fontSize: 15, marginTop: 30 }}>4 · Se dio de baja: se puede mandar, pero hay que saberlo</h2>
      <CorreosDeUnClic
        id="00000000-0000-0000-0000-000000000004"
        para="baja@example.com" nombre="Se dio de baja"
        problema={null}
        avisos={['Este viajero se dio de baja de los correos automáticos. Una respuesta a mano sí le llega, pero sabelo.']}
        correos={CORREOS}
      />
    </main>
  );
}
