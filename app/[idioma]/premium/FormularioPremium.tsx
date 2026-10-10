'use client';

import { useState } from 'react';
import { t, type Idioma } from '@/lib/idiomas';

/**
 * «Lo quiero» no cobra nada: abre una conversación.
 *
 * Es la misma regla que en las experiencias y en las reservas — confirmar
 * primero, cobrar después. Acá además hay algo que coordinar (el día de la
 * filmación), así que cobrar antes de hablar sería prometer una fecha que no
 * existe.
 *
 * Cae en /api/solicitud con origen 'premium', así que aparece en Leads con su
 * etapa y se puede medir cuántos negocios lo piden.
 */
export function FormularioPremium({ idioma }: { idioma: Idioma }) {
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

    const negocio = String(datos.get('negocio') ?? '').trim();
    const mensaje = String(datos.get('mensaje') ?? '').trim();

    try {
      const respuesta = await fetch('/api/solicitud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'consulta_general',
          nombre: String(datos.get('nombre') ?? '').trim() || null,
          email: email || null,
          whatsapp: whatsapp || null,
          mensaje: `[PREMIUM — video] Negocio: ${negocio || 'sin decir'}. ${mensaje}`.trim(),
          idioma,
          origen: 'premium',
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
    <form className="forma" onSubmit={mandar}>
      <label>
        <span>{t('sumar_nombre_negocio', idioma)}</span>
        <input name="negocio" type="text" required />
      </label>
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
        {estado === 'mandando' ? t('exp_enviando', idioma) : t('premium_quiero', idioma)}
      </button>
    </form>
  );
}
