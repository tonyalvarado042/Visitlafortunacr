/*
 * La calificación no se mide en estrellas: se mide en volcanes. Es el mismo
 * gesto de siempre —cinco iconos, se llenan de izquierda a derecha— pero con
 * la silueta del Arenal, que es de lo que habla el destino entero.
 *
 * El icono es una sola ruta para que se lea a 14px igual que a 40. Si mañana
 * Monteverde quiere una hoja en vez de un volcán, se cambia aquí: nadie más
 * dibuja el símbolo.
 */

export function IconoVolcan({ tamano = 16 }: { tamano?: number }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M1.5 20.7 8.6 7.4l2 1.6h2.8l2-1.6 7.1 13.3z" />
    </svg>
  );
}

/**
 * La nota, de solo lectura. Admite fracciones: el relleno se recorta por
 * ancho, así que 4,3 se ve como 4,3 y no como 4.
 */
export function Volcanes({
  nota,
  tamano = 16,
  etiqueta,
}: {
  nota: number | null;
  tamano?: number;
  etiqueta?: string;
}) {
  const relleno = Math.max(0, Math.min(5, nota ?? 0)) * 20;
  const cinco = [0, 1, 2, 3, 4];

  return (
    <span className="volcanes" role="img" aria-label={etiqueta}>
      <span className="fila">{cinco.map((i) => <IconoVolcan key={i} tamano={tamano} />)}</span>
      <span className="fila llena" style={{ width: `${relleno}%` }} aria-hidden="true">
        {cinco.map((i) => <IconoVolcan key={i} tamano={tamano} />)}
      </span>
    </span>
  );
}
