import type { EtiquetaNegocio, Horario } from '@/lib/destino';
import { t, type Idioma } from '@/lib/idiomas';

/*
 * La tira de hechos, debajo de la cabecera.
 *
 * Seis cosas que se leen de un vistazo antes de leer nada. No es decoración:
 * quien está comparando tres termales no lee el párrafo de ninguna — busca si
 * hay parqueo, si hay restaurante y a qué hora cierra. Eso estaba enterrado en
 * pastillas grises a media página.
 *
 * Los íconos se mapean por la BABOSA de la etiqueta, no por su nombre: el
 * nombre se traduce a cinco idiomas y la babosa no. Y hay uno genérico de
 * respaldo, para que una etiqueta nueva salga igual aunque nadie le haya
 * asignado dibujo todavía — sin ícono se ve pobre, pero sin la etiqueta se
 * pierde un dato.
 */

type Dibujo = (props: { className?: string }) => React.ReactElement;

const caja = { width: 22, height: 22, viewBox: '0 0 24 24', 'aria-hidden': true } as const;
const trazo = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const Agua: Dibujo = () => (
  <svg {...caja}><path {...trazo} d="M3 14c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0M3 19c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0" /><path {...trazo} d="M8 10V6M12 10V4M16 10V7" /></svg>
);
const Comida: Dibujo = () => (
  <svg {...caja}><path {...trazo} d="M7 3v8a2 2 0 002 2v8M7 3v5M10 3v5M17 3c-1.2 1.4-1.6 3.4-1.6 5.5 0 1.6.6 2.5 1.6 2.5v10" /></svg>
);
const Carro: Dibujo = () => (
  <svg {...caja}><path {...trazo} d="M4 16l1.6-5.2A2 2 0 017.5 9.4h9a2 2 0 011.9 1.4L20 16M4 16h16M4 16v3M20 16v3" /><circle cx="7.5" cy="16" r="1" fill="currentColor" /><circle cx="16.5" cy="16" r="1" fill="currentColor" /></svg>
);
const Wifi: Dibujo = () => (
  <svg {...caja}><path {...trazo} d="M3.5 9a13 13 0 0117 0M6.5 12.5a8.5 8.5 0 0111 0M9.5 16a4 4 0 015 0" /><circle cx="12" cy="19" r="1.2" fill="currentColor" /></svg>
);
const Hoja: Dibujo = () => (
  <svg {...caja}><path {...trazo} d="M12 21c-4-1.5-6.5-4.5-6.5-8.5C5.5 7 9 3.5 12 3c3 .5 6.5 4 6.5 9.5 0 4-2.5 7-6.5 8.5z" /><path {...trazo} d="M12 21V8" /></svg>
);
const Volcan: Dibujo = () => (
  <svg {...caja}><path {...trazo} d="M3 19l6-11 2.5 4.5L14 9l7 10z" /><path {...trazo} d="M3 19h18" /></svg>
);
const Pin: Dibujo = () => (
  <svg {...caja}><path {...trazo} d="M12 21s7-6.3 7-11.6A7 7 0 005 9.4C5 14.7 12 21 12 21z" /><circle cx="12" cy="9.4" r="2.4" fill="currentColor" /></svg>
);
const Gente: Dibujo = () => (
  <svg {...caja}><circle {...trazo} cx="9" cy="8" r="3" /><path {...trazo} d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><path {...trazo} d="M16 7.5a2.6 2.6 0 010 5M17.5 14.4c2 .7 3.2 2.4 3.2 4.6" /></svg>
);
const Furgoneta: Dibujo = () => (
  <svg {...caja}><path {...trazo} d="M3 16V8h11l4 4h3v4M3 16h18M3 16v2M21 16v2M14 8v4h7" /><circle cx="7.5" cy="16" r="1.4" fill="currentColor" /><circle cx="16.5" cy="16" r="1.4" fill="currentColor" /></svg>
);
const Tarjeta: Dibujo = () => (
  <svg {...caja}><rect {...trazo} x="3" y="5.5" width="18" height="13" rx="2" /><path {...trazo} d="M3 10h18" /></svg>
);
const Corazon: Dibujo = () => (
  <svg {...caja}><path {...trazo} d="M12 20.5l-1.4-1.3C5.6 14.7 3 12.3 3 9.2A4.2 4.2 0 017.2 5c1.4 0 2.8.7 3.8 1.9l1 1.2 1-1.2A5 5 0 0116.8 5 4.2 4.2 0 0121 9.2c0 3.1-2.6 5.5-7.6 10z" /></svg>
);
const Reloj: Dibujo = () => (
  <svg {...caja}><circle {...trazo} cx="12" cy="12" r="8.6" /><path {...trazo} d="M12 7v5.4l3.3 2" /></svg>
);
const Silla: Dibujo = () => (
  <svg {...caja}><circle {...trazo} cx="12" cy="4.6" r="1.9" /><path {...trazo} d="M10.5 8v6h5l2.5 5M10.5 11h4" /><circle {...trazo} cx="9" cy="16.5" r="4.5" /></svg>
);
const Estrella: Dibujo = () => (
  <svg {...caja}><path {...trazo} d="M12 3.5l2.6 5.5 5.9.8-4.3 4.1 1.1 5.9L12 17l-5.3 2.8 1.1-5.9L3.5 9.8l5.9-.8z" /></svg>
);

/* Babosa → dibujo. Varias etiquetas comparten ícono a propósito: diecisiete
   dibujos distintos no se distinguen de un vistazo, que es justo para lo que
   está esta tira. */
const DIBUJOS: Record<string, Dibujo> = {
  'aguas-termales-propias': Agua,
  piscina: Agua,
  'spa-en-sitio': Hoja,
  'restaurante-en-sitio': Comida,
  'desayuno-incluido': Comida,
  'opciones-vegetarianas': Comida,
  estacionamiento: Carro,
  'wifi-gratis': Wifi,
  'en-la-naturaleza': Hoja,
  'vista-al-volcan': Volcan,
  'en-el-centro': Pin,
  'guia-bilingue': Gente,
  'transporte-hotel': Furgoneta,
  'apto-para-ninos': Gente,
  'solo-adultos': Gente,
  'apto-ciclistas': Gente,
  'acepta-mascotas': Gente,
  'acepta-tarjeta': Tarjeta,
  'acepta-dolares': Tarjeta,
  'solo-efectivo': Tarjeta,
  'tarifa-nacional': Tarjeta,
  'guarda-bicicletas': Carro,
  romantico: Corazon,
  tranquilo: Hoja,
  'silla-de-ruedas': Silla,
  'sin-escaleras': Silla,
};

/* Qué sube primero cuando hay más de seis. Lo que decide una visita va antes
   que lo que la adorna: el agua y la comida pesan más que "romántico". */
const PESO: Record<string, number> = {
  'aguas-termales-propias': 100, piscina: 90, 'restaurante-en-sitio': 85,
  'spa-en-sitio': 80, 'desayuno-incluido': 75, 'vista-al-volcan': 70,
  estacionamiento: 65, 'transporte-hotel': 60, 'guia-bilingue': 55,
  'wifi-gratis': 50, 'en-la-naturaleza': 45, 'en-el-centro': 44,
  'apto-para-ninos': 40, 'solo-adultos': 39, 'opciones-vegetarianas': 35,
  'acepta-tarjeta': 30, 'solo-efectivo': 29, tranquilo: 25, romantico: 24,
};

const CUANTAS = 6;

/** "11:00 – 21:00" cuando todos los días abren igual; si no, no se promete nada. */
function horarioParejo(horario: Horario[]): string | null {
  const abiertos = horario.filter((h) => !h.esta_cerrado && h.abre_a && h.cierra_a);
  if (abiertos.length !== 7) return null;
  const primero = `${abiertos[0].abre_a?.slice(0, 5)} – ${abiertos[0].cierra_a?.slice(0, 5)}`;
  const todosIguales = abiertos.every(
    (h) => `${h.abre_a?.slice(0, 5)} – ${h.cierra_a?.slice(0, 5)}` === primero,
  );
  return todosIguales ? primero : null;
}

export function TiraAtributos({
  etiquetas, horario, idioma,
}: {
  etiquetas: EtiquetaNegocio[];
  horario: Horario[];
  idioma: Idioma;
}) {
  const parejo = horarioParejo(horario);

  const elegidas = [...etiquetas]
    .sort((a, b) => (PESO[b.babosa] ?? 0) - (PESO[a.babosa] ?? 0))
    .slice(0, parejo ? CUANTAS - 1 : CUANTAS);

  if (!elegidas.length && !parejo) return null;

  return (
    <ul className="tira-atributos">
      {elegidas.map((e) => {
        const Dibujo = DIBUJOS[e.babosa] ?? Estrella;
        return (
          <li key={e.babosa}>
            <Dibujo />
            <span>{e.nombre}</span>
          </li>
        );
      })}
      {parejo && (
        <li>
          <Reloj />
          <span>{t('todos_los_dias', idioma)}<br />{parejo}</span>
        </li>
      )}
    </ul>
  );
}
