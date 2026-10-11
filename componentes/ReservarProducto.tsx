'use client';

import { useState } from 'react';
import { t, type Idioma } from '@/lib/idiomas';
import type { ProductoReservable } from '@/lib/reservas';

/*
 * El widget de reserva de la ficha.
 *
 * El texto del botón sale de `accion`, que decide la BASE según el contrato.
 * No se adivina aquí: el mismo producto dice "reservar y pagar" o "solicitar
 * reserva" según con qué se firmó, y esa decisión no puede vivir en el
 * navegador.
 *
 * Tres cosas que no hace, y son deliberadas:
 *
 * - No manda el precio. El total lo calcula el servidor con la tarifa
 *   vigente. Un total que viaja desde el navegador es un total que se edita.
 * - No dice "confirmado" ni "reservado". Dice que recibimos la solicitud,
 *   porque es lo único cierto hasta que el operador responda.
 * - No muestra precio si la tarifa no está verificada. Ahí dice "consultar":
 *   un precio de oído en una página pública es una promesa que no podemos
 *   cumplir.
 */

const HOY = () => new Date().toISOString().slice(0, 10);

function textoDelBoton(accion: ProductoReservable['accion'], idioma: Idioma): string {
  if (accion === 'reservar_y_pagar') return t('reserva_y_pagar', idioma);
  if (accion === 'solicitar_disponibilidad') return t('reserva_pedir_dispo', idioma);
  return t('reserva_pedir', idioma);
}

export function ReservarProducto({
  producto, idioma,
}: {
  producto: ProductoReservable;
  idioma: Idioma;
}) {
  const [paraEl, setParaEl] = useState('');
  const [adultos, setAdultos] = useState(2);
  const [ninos, setNinos] = useState(0);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  /* Dos pasos: 1 es fecha y personas, 2 son los datos de contacto.
     Entera, la tarjeta medía 1034px contra una pantalla de 900: pegada a la
     columna, el botón de enviar quedaba siempre debajo del borde y no había
     forma de alcanzarlo. Partida, cada paso cabe y además se pide menos de
     entrada, que es como reserva todo el mundo. */
  const [paso, setPaso] = useState<1 | 2>(1);

  /* La antelación que pide el producto, convertida a la primera fecha que el
     formulario deja elegir. Así el visitante no escoge una fecha que el
     servidor le va a rechazar después. */
  const primeraFecha = new Date(Date.now() + producto.horas_antelacion * 3600_000)
    .toISOString().slice(0, 10);

  /* El paso 1 valida acá lo mismo que valida el servidor, para no mandar a
     alguien al paso 2 y rebotarlo después. La validación de verdad sigue
     estando en /api/reserva: esto es cortesía, no seguridad. */
  function seguir() {
    if (!paraEl) { setError(t('reserva_falta_fecha', idioma)); return; }
    if (adultos < 1) { setError(t('reserva_falta_personas', idioma)); return; }
    setError(null);
    setPaso(2);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setError(null);
    setEnviando(true);
    try {
      const r = await fetch('/api/reserva', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          producto_id: producto.producto_id,
          para_el: paraEl, adultos, ninos,
          nombre, email, whatsapp, notas, idioma,
        }),
      });
      const datos = await r.json();
      if (!r.ok) {
        setError(datos?.error ?? t('reserva_error', idioma));
        return;
      }
      setCodigo(datos.codigo ?? '');
    } catch {
      setError(t('reserva_error', idioma));
    } finally {
      setEnviando(false);
    }
  }

  if (codigo !== null) {
    return (
      <div className="reservar reservar-listo" role="status">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><path d="m8.5 12.5 2.5 2.5 4.5-5" />
        </svg>
        <strong>{t('reserva_listo', idioma)}</strong>
        {codigo && (
          <p className="reservar-codigo">
            {t('reserva_codigo', idioma)}: <code>{codigo}</code>
          </p>
        )}
        <p>{t('reserva_listo_nota', idioma)}</p>
      </div>
    );
  }

  return (
    <div className="reservar">
      <div className="reservar-cabeza">
        <div>
          <h2>{t('reserva_titulo', idioma)}</h2>
          <p className="reservar-que">{producto.nombre}</p>
        </div>
        {/* Las tarifas solo en el paso 1. En el paso 2 ya eligió, el resumen
            de arriba dice qué día y cuántos, y esos 97px son la diferencia
            entre que el botón de enviar quepa en pantalla o no. */}
        <div className="reservar-precio" hidden={paso === 2}>
          {producto.tarifas.length > 0 ? (
            /* Todas las tarifas, no un "desde": con adulto a $47 y niño a
               $33, un "desde $33" es cierto y engañoso a la vez. */
            <ul className="reservar-tarifas">
              {producto.tarifas.map((x) => (
                <li key={x.nombre}>
                  <span>{x.nombre}</span>
                  <strong>${x.precio}</strong>
                </li>
              ))}
            </ul>
          ) : (
            /* Sin tarifa verificada no sale número. Un precio de oído es una
               promesa que no podemos cumplir. */
            <strong className="reservar-consultar">{t('reserva_consultar', idioma)}</strong>
          )}
        </div>
      </div>

      {producto.resumen && <p className="reservar-resumen">{producto.resumen}</p>}

      {producto.incluye.length > 0 && (
        <ul className="reservar-incluye">
          {producto.incluye.map((x) => (
            <li key={x}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m5 12.5 4.5 4.5L19 7" />
              </svg>
              {x}
            </li>
          ))}
        </ul>
      )}

      <form className="forma reservar-forma" onSubmit={enviar} noValidate>
        {paso === 1 ? (
          <>
            <div className="reservar-fila">
              <div className="campo">
                <label htmlFor="rf">{t('reserva_fecha', idioma)}</label>
                <input id="rf" type="date" required min={primeraFecha || HOY()}
                       value={paraEl} onChange={(e) => setParaEl(e.target.value)} />
              </div>
              <div className="campo">
                <label htmlFor="ra">{t('reserva_adultos', idioma)}</label>
                <input id="ra" type="number" min={1} max={40} required
                       value={adultos} onChange={(e) => setAdultos(Number(e.target.value))} />
              </div>
              {producto.admite_ninos && (
                <div className="campo">
                  <label htmlFor="rn">{t('reserva_ninos', idioma)}</label>
                  <input id="rn" type="number" min={0} max={40}
                         value={ninos} onChange={(e) => setNinos(Number(e.target.value))} />
                </div>
              )}
            </div>

            {error && <p className="sorteo-error" role="alert">{error}</p>}

            {/* type="button": este no envía nada, abre el paso 2. Si fuera
                submit, el navegador mandaría el formulario a medias. */}
            <button className="boton" type="button" onClick={seguir}>
              {textoDelBoton(producto.accion, idioma)}
            </button>
          </>
        ) : (
          <>
            {/* Lo que ya eligió, a la vista. Si no, en el paso 2 no hay forma
                de saber para qué día se está pidiendo. */}
            <div className="reservar-elegido">
              <span>
                {/* El mediodía evita el corrimiento de un día: una fecha suelta
                    se lee como UTC y en Costa Rica eso resta seis horas. */}
                {new Date(`${paraEl}T12:00:00`).toLocaleDateString(idioma, { day: 'numeric', month: 'long' })}
                {' · '}
                {adultos + ninos} {t('reserva_personas', idioma)}
              </span>
              <button type="button" onClick={() => { setError(null); setPaso(1); }}>
                {t('reserva_volver', idioma)}
              </button>
            </div>

            <div className="campo">
              <label htmlFor="rnom">{t('sorteo_nombre', idioma)}</label>
              <input id="rnom" autoComplete="name" required
                     value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor="rem">{t('sorteo_correo', idioma)}</label>
              <input id="rem" type="email" autoComplete="email" required inputMode="email"
                     value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor="rwa">
                {t('sorteo_whatsapp', idioma)}
                <span className="opcional">{t('opcional', idioma)}</span>
              </label>
              <input id="rwa" type="tel" inputMode="tel" placeholder="+506…"
                     value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
            </div>
            {/* Las notas, plegadas. Casi nadie las escribe y abiertas se
                comen 90px de una tarjeta que tiene que caber en pantalla.
                <details> y no JavaScript: el teclado y el lector de pantalla
                ya los trae resueltos el navegador. */}
            <details className="reservar-mas">
              <summary>
                {t('reserva_notas', idioma)}
                <span className="opcional">{t('opcional', idioma)}</span>
              </summary>
              <textarea id="rno" rows={2} maxLength={1000} aria-label={t('reserva_notas', idioma)}
                        value={notas} onChange={(e) => setNotas(e.target.value)} />
            </details>

            {error && <p className="sorteo-error" role="alert">{error}</p>}

            <button className="boton" type="submit" disabled={enviando}>
              {enviando ? t('reserva_enviando', idioma) : t('reserva_enviar', idioma)}
            </button>
          </>
        )}

        <small className="reservar-letra">{t('reserva_sin_cobro', idioma)}</small>
        <small className="reservar-presta">
          {t('reserva_quien_presta', idioma)}: <strong>{producto.negocio_nombre}</strong>
        </small>
      </form>
    </div>
  );
}
