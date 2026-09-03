'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { aprobar, type Estado } from '../acciones';

export function Aprobar({ id, borrador }: { id: string; borrador: string }) {
  const router = useRouter();
  const [estado, accion, pendiente] = useActionState(aprobar, {} as Estado);
  useEffect(() => { if (estado.ok) router.refresh(); }, [estado, router]);
  return (
    <form action={accion}>
      <input type="hidden" name="id" value={id} />
      <div className="campo"><textarea name="texto" defaultValue={borrador} style={{ minHeight: 120 }} /></div>
      <div className="pie-formulario">
        <button type="submit" className="boton verde" disabled={pendiente}>{pendiente ? 'Enviando…' : 'Aprobar y enviar'}</button>
        {estado.error && <span className="aviso mal" style={{ margin: 0 }}>{estado.error}</span>}
        {estado.ok && <span className="aviso ok" style={{ margin: 0 }}>{estado.ok}</span>}
      </div>
    </form>
  );
}
