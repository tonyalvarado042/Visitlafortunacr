'use client';

import { useState } from 'react';
import { t, type Idioma } from '@/lib/idiomas';

/**
 * La consulta de una experiencia.
 *
 * NO cobra ni reserva nada: cae en /api/solicitud, que crea el viajero y la
 * solicitud, y de ahí sale como lead en el panel con su etapa y su
 * responsable. Es la fase 1 del plan de reservas: todo pasa por un asesor
 * antes de confirmar nada.
 *
 * El origen lleva la babosa de la experiencia para saber, después, cuál
 * viaje trae consultas y cuál no.
 */
export function FormularioConsulta({
  idioma, babosa, titulo, personas,
}: {
  idioma: Idioma;
  babosa: string;
  titulo: string;
  personas: number | null;
}) {
  const [estado, setEstado] = useState<'listo' | 'mandando' | 'enviado'>('listo');
  const [error, setError] = useState<string | null>(null);

  async function mandar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);

    const email = String(datos.get('email') ?? '').trim();
    const whatsapp = String(datos.get('whatsapp') ?? '').trim();
    if (!email && !whatsapp) {
      setError(t('exp_falta_contacto', idioma));
      return;
    }

    setError(null);
    setEstado('mandando');

    try {
      const respuesta = await fetch('/api/solicitud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'itinerario',
          nombre: String(datos.get('nombre') ?? '').trim() || null,
          email: email || null,
          whatsapp: whatsapp || null,
          llega_el: String(datos.get('llega_el') ?? '') || null,
          personas: Number(datos.get('personas')) || null,
          mensaje: `[${titulo}] ${String(datos.get('mensaje') ?? '').trim()}`.trim(),
          idioma,
          origen: `experiencia:${babosa}`,
        }),
      });
      if (!respuesta.ok) throw new Error('falló');
      setEstado('enviado');
    } catch {
      setError(t('exp_fallo', idioma));
      setEstado('listo');
    }
  }

  if (estado === 'enviado') {
    return (
      <div className="exp-gracias">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <p>{t('exp_gracias', idioma)}</p>
      </div>
    );
  }

  return (
    <form className="forma exp-forma" onSubmit={mandar}>
      <p className="exp-aviso">{t('exp_sin_compromiso', idioma)}</p>

      <div className="forma-fila">
        <label>
          <span>{t('exp_cuando', idioma)}</span>
          <input name="llega_el" type="date" />
        </label>
        <label>
          <span>{t('exp_cuantos', idioma)}</span>
          <input name="personas" type="number" min={1} max={20} defaultValue={personas ?? 2} />
        </label>
      </div>

      <label>
        <span>{t('exp_tu_nombre', idioma)}</span>
        <input name="nombre" type="text" autoComplete="name" />
      </label>

      <div className="forma-fila">
        <label>
          <span>{t('exp_tu_correo', idioma)}</span>
          <input name="email" type="email" autoComplete="email" />
        </label>
        <label>
          <span>{t('exp_tu_whatsapp', idioma)}</span>
          <input name="whatsapp" type="tel" inputMode="tel" autoComplete="tel" placeholder="+506…" />
        </label>
      </div>

      <label>
        <span>{t('exp_tu_mensaje', idioma)}</span>
        <textarea name="mensaje" rows={3} />
      </label>

      {error && <p className="forma-error">{error}</p>}

      <button type="submit" className="boton" disabled={estado === 'mandando'}>
        {estado === 'mandando' ? t('exp_enviando', idioma) : t('exp_enviar', idioma)}
      </button>
    </form>
  );
}
