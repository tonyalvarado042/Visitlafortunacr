'use client';

/** Abre el chat con el plan ya pegado, para reservarlo o pedir cambios. */
export function BotonReservarPlan({ texto, mensaje }: { texto: string; mensaje: string }) {
  return (
    <button
      type="button"
      className="boton"
      onClick={() => window.dispatchEvent(new CustomEvent('abrir-concierge', { detail: { mensaje } }))}
    >
      {texto}
    </button>
  );
}
