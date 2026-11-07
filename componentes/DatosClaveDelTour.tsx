import { t, NOMBRE_PROPIO, type Idioma } from '@/lib/idiomas';

/*
 * Los datos clave de una tour: cancelación, duración, guía, recogida, grupo,
 * edad y dificultad.
 *
 * ⚠️ POR QUÉ CAMBIÓ LA FORMA, Y NO SOLO EL ADORNO.
 *
 * Antes esto era una rejilla de celditas con ETIQUETA y valor:
 *
 *     CUPO MÁXIMO        CANCELACIÓN        GUÍA EN
 *     20                 24                 ES, EN
 *
 * El dato estaba, pero le dejaba el trabajo a quien lee: «24 ¿qué? ¿horas?
 * ¿horas de qué?». Ahora cada fila es un TITULAR y una línea que lo explica
 * —«Cancelación gratuita / Cancelá sin costo hasta 24 horas antes»— que es la
 * forma en que lo muestra la referencia que pidió Tony el 7 de noviembre de
 * 2026, y funciona porque la decisión de reservar se toma leyendo esto.
 *
 * Los íconos van escritos a mano y no de una librería: el repo no carga
 * ninguna, y seis SVG de veinte líneas pesan menos que la dependencia.
 *
 * ⚠️ TODO SALE DE LA BASE. Ni una fila se inventa: si el operador no puso
 * cupo, no hay fila de grupo. La única que se muestra en negativo es la
 * cancelación, y a propósito: no poder cancelar es exactamente lo que alguien
 * necesita saber ANTES de pagar, y callarlo sería la forma más cara de fallar
 * en silencio.
 */

function Icono({ d, relleno }: { d: string; relleno?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true"
         fill={relleno ? 'currentColor' : 'none'} stroke="currentColor"
         strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const CALENDARIO = 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 15l2 2 4-4';
const RELOJ       = 'M12 7v5l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z';
const PERSONA_GUIA= 'M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M18 4v7M18 4l4 2-4 2';
const BUS         = 'M4 17h16M6 17v2M18 17v2M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8.5 14h.01M15.5 14h.01';
const GRUPO       = 'M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75';
const ESCUDO     = 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z';
const MONTANA     = 'M3 19h18L14 7l-3.5 6L8 10l-5 9z';

export type FilaClave = { icono: string; titulo: string; detalle: string | null; apagada?: boolean };

/**
 * Arma las filas desde los datos de la tour. Fuera del componente para que la
 * página pueda preguntar `filas.length` sin pintar nada.
 */
export function filasClaveDeTour(
  tour: {
    cancelacion_libre_horas: number; duracion_horas: number | null; hora_inicio: string | null;
    idiomas_guia: string[]; recoge_en_hotel: boolean; cupo_maximo: number | null;
    edad_minima: number | null; dificultad: string | null;
  },
  idioma: Idioma,
  dondeRecoge: string,
): FilaClave[] {
  const filas: FilaClave[] = [];

  if (tour.cancelacion_libre_horas > 0) {
    filas.push({
      icono: CALENDARIO,
      titulo: t('clave_cancela_si', idioma),
      detalle: `${t('clave_cancela_det', idioma)} ${tour.cancelacion_libre_horas} ${t('clave_horas_antes', idioma)}.`,
    });
  } else {
    filas.push({
      icono: ESCUDO,
      titulo: t('clave_cancela_no', idioma),
      detalle: t('clave_cancela_no_det', idioma),
      apagada: true,
    });
  }

  if (tour.duracion_horas != null) {
    filas.push({
      icono: RELOJ,
      titulo: `${t('tour_duracion', idioma)} ${tour.duracion_horas} ${t('clave_horas', idioma)}`,
      detalle: tour.hora_inicio
        ? `${t('tour_salida', idioma)} ${tour.hora_inicio.slice(0, 5)}.`
        : t('clave_consulta_salida', idioma),
    });
  }

  if (tour.idiomas_guia?.length) {
    /* El idioma con su nombre propio —«Español, Inglés»— y no el código. `ES,
       EN` obliga a descifrar justo al que menos español lee. */
    filas.push({
      icono: PERSONA_GUIA,
      titulo: t('clave_guia_vivo', idioma),
      detalle: tour.idiomas_guia
        .map((i) => NOMBRE_PROPIO[i as Idioma] ?? i.toUpperCase())
        .join(', '),
    });
  }

  if (tour.recoge_en_hotel) {
    filas.push({
      icono: BUS,
      titulo: t('clave_recoge', idioma),
      detalle: `${t('clave_recoge_det', idioma)} ${dondeRecoge}.`,
    });
  }

  if (tour.cupo_maximo != null) {
    /* «Grupo pequeño» solo si de verdad lo es. Llamarle pequeño a uno de
       cuarenta es la clase de adorno que se nota al llegar. */
    filas.push({
      icono: GRUPO,
      titulo: tour.cupo_maximo <= 16 ? t('clave_grupo', idioma) : t('clave_grupo_grande', idioma),
      detalle: `${t('clave_hasta', idioma)} ${tour.cupo_maximo} ${t('clave_personas', idioma)}.`,
    });
  }

  if (tour.edad_minima != null && tour.edad_minima > 0) {
    filas.push({
      icono: PERSONA_GUIA,
      titulo: t('tour_edad', idioma),
      detalle: `${tour.edad_minima} ${t('clave_anos', idioma)}.`,
    });
  }

  const dif = tour.dificultad;
  if (dif === 'facil' || dif === 'moderada' || dif === 'dificil') {
    filas.push({
      icono: MONTANA,
      titulo: t(`dificultad_${dif}` as 'dificultad_facil', idioma),
      detalle: t(`dificultad_${dif}_det` as 'dificultad_facil_det', idioma),
    });
  }

  return filas;
}

export function DatosClaveDelTour({ filas }: { filas: FilaClave[] }) {
  if (!filas.length) return null;
  return (
    <ul className="tour-claves">
      {filas.map((f, i) => (
        <li key={i} className={f.apagada ? 'apagada' : undefined}>
          <span className="tour-clave-icono"><Icono d={f.icono} /></span>
          <div>
            <strong>{f.titulo}</strong>
            {f.detalle && <span>{f.detalle}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}
