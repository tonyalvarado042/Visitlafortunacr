/*
 * La campanita del chat, generada en el momento. Sin archivo de audio.
 *
 * ⚠️ POR QUÉ SIN ARCHIVO. Un .mp3 son 20-40 KB que cargan en TODAS las
 * páginas para un sonido de medio segundo que la mayoría nunca va a oír. Dos
 * osciladores hacen el mismo trabajo con cero bytes de red.
 *
 * ⚠️ Y POR QUÉ PUEDE NO SONAR, QUE ES LO IMPORTANTE.
 *
 * Los navegadores bloquean el audio hasta que la persona interactúa con la
 * página (la «política de autoplay»): un clic, una tecla, un toque. Hacer
 * scroll NO cuenta. Entonces una campanita que suena al abrirse el gancho
 * **no va a sonar** si la persona todavía no tocó nada — y eso no es un bug
 * que se pueda arreglar desde acá, es cómo funciona Chrome y Safari.
 *
 * Por eso esto NO promete sonar: `sonar()` devuelve si sonó o no. Quien la
 * llama se entera y no se queda esperando. Lo que no se hace es tragarse el
 * fallo y jurar que suena, porque entonces nadie entendería nunca por qué a
 * veces se oye y a veces no.
 */

let contexto: AudioContext | null = null;

/** Si la persona ya interactuó con la página, el audio está permitido. */
let huboToque = false;

/**
 * Se engancha una sola vez y se desengancha al primer toque. Hay que llamarla
 * temprano —al montar el chat— porque lo que importa es haber estado
 * escuchando ANTES de que la persona toque algo.
 */
export function vigilarElPrimerToque(): () => void {
  if (typeof window === 'undefined') return () => {};
  const anotar = () => { huboToque = true; quitar(); };
  const quitar = () => {
    window.removeEventListener('pointerdown', anotar);
    window.removeEventListener('keydown', anotar);
    window.removeEventListener('touchstart', anotar);
  };
  window.addEventListener('pointerdown', anotar, { passive: true });
  window.addEventListener('keydown', anotar);
  window.addEventListener('touchstart', anotar, { passive: true });
  return quitar;
}

export function sePuedeSonar(): boolean {
  return huboToque;
}

/**
 * Dos notas cortas, suaves, tipo campanita de recepción.
 *
 * @returns `true` si de verdad sonó. `false` si el navegador no lo permitió,
 *   si la persona pidió menos movimiento o si no hay WebAudio: en ninguno de
 *   esos casos se finge que sonó.
 */
export function sonar(): boolean {
  if (typeof window === 'undefined') return false;
  if (!huboToque) return false;

  /* Quien pide menos movimiento muchas veces pide menos de todo: un sonido
     inesperado es justo lo que molesta. Se respeta. */
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  } catch { /* si no se puede preguntar, se sigue */ }

  try {
    const Clase = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Clase) return false;
    contexto ??= new Clase();
    if (contexto.state === 'suspended') void contexto.resume();

    const ahora = contexto.currentTime;
    /* La (880) y mi (1318.5): una quinta, que suena a aviso amable y no a
       alarma. La segunda entra un pelo después, como una campanita de verdad. */
    for (const [hz, retraso] of [[880, 0], [1318.5, 0.09]] as const) {
      const osc = contexto.createOscillator();
      const vol = contexto.createGain();
      osc.type = 'sine';
      osc.frequency.value = hz;
      /* Arranca en casi cero y cae exponencialmente: sin esto se oye un
         «clic» en el ataque y en el corte. */
      vol.gain.setValueAtTime(0.0001, ahora + retraso);
      vol.gain.exponentialRampToValueAtTime(0.055, ahora + retraso + 0.012);
      vol.gain.exponentialRampToValueAtTime(0.0001, ahora + retraso + 0.5);
      osc.connect(vol).connect(contexto.destination);
      osc.start(ahora + retraso);
      osc.stop(ahora + retraso + 0.55);
    }
    return true;
  } catch {
    return false;
  }
}
