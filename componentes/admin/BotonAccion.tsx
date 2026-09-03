'use client';

import { useFormStatus } from 'react-dom';

/** Un botón de formulario que se apaga mientras la acción del servidor corre. */
export function BotonAccion({ children, clase = 'boton', confirmar }: { children: React.ReactNode; clase?: string; confirmar?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={clase}
      disabled={pending}
      onClick={(e) => { if (confirmar && !window.confirm(confirmar)) e.preventDefault(); }}
    >
      {pending ? '…' : children}
    </button>
  );
}
