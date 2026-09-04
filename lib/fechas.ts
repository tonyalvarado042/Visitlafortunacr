/**
 * Cuándo, exactamente, empieza un día en un destino.
 *
 * `lanzado_el` es una fecha sin hora ("2027-01-15") y cada destino vive en su
 * propia zona. La cuenta regresiva tiene que terminar a la medianoche de allá,
 * no a la del servidor ni a la del navegador de quien mira: alguien en Berlín
 * y alguien en La Fortuna deben ver el mismo número.
 *
 * Se resuelve con Intl, sin librerías: se toma la medianoche UTC de ese día,
 * se pregunta qué hora marca esa misma marca en la zona del destino, y la
 * diferencia es el desfase que hay que corregir. Así funciona igual en un
 * lugar con horario de verano que en Costa Rica, que no lo tiene.
 */

function desfaseDeZona(instante: number, zona: string): number {
  const formato = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  const partes = Object.fromEntries(
    formato.formatToParts(instante).map((p) => [p.type, p.value])
  ) as Record<string, string>;

  // hour puede venir como "24" a medianoche en algunas plataformas.
  const comoSiFueraUTC = Date.UTC(
    Number(partes.year), Number(partes.month) - 1, Number(partes.day),
    Number(partes.hour) % 24, Number(partes.minute), Number(partes.second)
  );

  return comoSiFueraUTC - instante;
}

/**
 * El instante real (epoch en ms) de las 00:00 de `fecha` en `zona`.
 * Devuelve null si la fecha no viene o no tiene forma de fecha.
 */
export function medianocheEnZona(fecha: string | null, zona: string): number | null {
  if (!fecha) return null;
  const partes = fecha.slice(0, 10).split('-').map(Number);
  if (partes.length !== 3 || partes.some((n) => !Number.isFinite(n))) return null;

  const [anio, mes, dia] = partes;
  const tanteo = Date.UTC(anio, mes - 1, dia);
  try {
    return tanteo - desfaseDeZona(tanteo, zona);
  } catch {
    // Zona horaria inválida: mejor sin cuenta regresiva que con una hora falsa.
    return null;
  }
}
