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

/*
 * Lo que va a pagar, antes de apretar.
 *
 * Es lo primero que la gente busca y hoy no estaba: la tarjeta mostraba $47 y
 * $33 sueltos y el visitante tenía que multiplicar de cabeza. Ver el número
 * completo antes de comprometerse es lo que quita la fricción más grande.
 *
 * Devuelve `null` —y entonces no se muestra nada— cuando NO se puede afirmar
 * el total con certeza: si vienen niños y no hay tarifa de niño ni general, el
 * número sería una suposición, y una suposición con signo de dólares en una
 * página pública es una promesa que después no podemos cumplir. Misma regla
 * que ya rige el "consultar" de arriba.
 *
 * Ojo: esto es para MIRAR. El total que vale lo calcula el servidor con la
 * tarifa vigente — un total que viaja desde el navegador es un total que se
 * edita, y por eso /api/reserva nunca lo recibe.
 */
export function totalEstimado(
  tarifas: ProductoReservable['tarifas'],
  adultos: number,
  ninos: number,
): number | null {
  const de = (quien: string) => tarifas.find((x) => x.es_para === quien)?.precio ?? null;
  const general = de('general');
  const porAdulto = de('adulto') ?? general;
  const porNino = de('nino') ?? general;

  if (adultos > 0 && porAdulto === null) return null;
  if (ninos > 0 && porNino === null) return null;
  if (adultos < 1) return null;

  return adultos * (porAdulto ?? 0) + ninos * (porNino ?? 0);
}

/*
 * El rótulo de una tarifa, en el idioma de quien mira.
 *
 * El `nombre` de la tarifa es texto libre que escribió alguien en el panel —
 * "Adulto", "Niño (3 a 11)"— y está en español y solo en español: en inglés la
 * tarjeta decía "Adulto $47" al lado de un "Total" traducido, que se lee como
 * un descuido.
 *
 * El rótulo sale de `es_para`, que es el valor CANÓNICO y está acotado por
 * constraint a cuatro: adulto, nino, senior, general. Lo que el nombre tenga
 * entre paréntesis —"(3 a 11)", un rango de edad— se conserva: ahí sí hay un
 * dato que el rótulo no trae y que no depende del idioma.
 */
const ROTULO: Record<string, 'reserva_adulto_uno' | 'reserva_nino_uno' | 'reserva_senior_uno' | 'reserva_general_uno'> = {
  adulto: 'reserva_adulto_uno',
  nino: 'reserva_nino_uno',
  senior: 'reserva_senior_uno',
  general: 'reserva_general_uno',
};

function rotuloDeTarifa(tarifa: ProductoReservable['tarifas'][number], idioma: Idioma): string {
  const clave = ROTULO[tarifa.es_para];
  if (!clave) return tarifa.nombre;
  const base = t(clave, idioma);
  const entreParentesis = tarifa.nombre.match(/\(([^)]+)\)/);
  const rotulo = base.charAt(0).toUpperCase() + base.slice(1);
  return entreParentesis ? `${rotulo} (${entreParentesis[1]})` : rotulo;
}

function textoDelBoton(accion: ProductoReservable['accion'], idioma: Idioma): string {
  if (accion === 'reservar_y_pagar') return t('reserva_y_pagar', idioma);
  if (accion === 'solicitar_disponibilidad') return t('reserva_pedir_dispo', idioma);
  return t('reserva_pedir', idioma);
}

export function ReservarProducto({
  producto, idioma, esTour,
}: {
  producto: ProductoReservable;
  idioma: Idioma;
  /* El mismo widget sirve para un producto de una ficha y para una tour con
     su propia página. Lo único que cambia es con qué nombre viaja el id: la
     base exige uno de los dos y rechaza los dos juntos. */
  esTour?: boolean;
}) {
  const [paraEl, setParaEl] = useState('');
  const [adultos, setAdultos] = useState(2);
  const [ninos, setNinos] = useState(0);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [notas, setNotas] = useState('');
  const [cupon, setCupon] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  /* Lo que de verdad quedó guardado, dicho por el servidor. El total de acá
     arriba es una estimación con la tarifa a la vista; si entró un cupón, el
     único que sabe cuánto rebajó es la base. */
  const [cobro, setCobro] = useState<{ total: number | null; descuento: number | null }>(
    { total: null, descuento: null },
  );
  /* Dos pasos: 1 es fecha y personas, 2 son los datos de contacto.
     Entera, la tarjeta medía 1034px contra una pantalla de 900: pegada a la
     columna, el botón de enviar quedaba siempre debajo del borde y no había
     forma de alcanzarlo. Partida, cada paso cabe y además se pide menos de
     entrada, que es como reserva todo el mundo. */
  const [paso, setPaso] = useState<1 | 2>(1);

  const subtotal = totalEstimado(producto.tarifas, adultos, ninos);
  const pct = Number(producto.descuento_pct ?? 0);
  /* El redondeo a dos decimales se hace igual que en la base, para que el
     número que se ve y el que se cobra no se separen por un centavo. */
  const descuento = subtotal !== null && pct > 0
    ? Math.round(subtotal * pct) / 100
    : 0;
  const total = subtotal === null ? null : subtotal - descuento;

  /* "$89,3" se lee como un error de programa, no como un precio. Con centavos
     van los dos decimales; sin centavos, ninguno — "$94,00" tampoco es como se
     escribe un precio redondo. */
  const plata = (n: number) => n.toLocaleString(idioma, {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });

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
          ...(esTour
            ? { tour_id: producto.producto_id }
            : { producto_id: producto.producto_id }),
          para_el: paraEl, adultos, ninos,
          nombre, email, whatsapp, notas, idioma,
          cupon: cupon.trim() || null,
        }),
      });
      const datos = await r.json();
      if (!r.ok) {
        setError(datos?.error ?? t('reserva_error', idioma));
        return;
      }
      setCobro({ total: datos.total_usd ?? null, descuento: datos.descuento_usd ?? null });
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
        {/* El total que dijo la base, no el que calculó el navegador: si entró
            un cupón son distintos, y el que vale es este. */}
        {cobro.total !== null && (
          <p className="reservar-listo-total">
            <span>{t('reserva_total', idioma)}</span>
            <strong>${plata(cobro.total)}</strong>
            {cobro.descuento != null && cobro.descuento > 0 && (
              <small>−${plata(cobro.descuento)} {t('reserva_ahorro', idioma)}</small>
            )}
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
                  <span>{rotuloDeTarifa(x, idioma)}</span>
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

            {total !== null && (
              <div className="reservar-total">
                <span>
                  <strong>{t('reserva_total', idioma)}</strong>
                  <small>
                    {adultos} {adultos === 1 ? t('reserva_adulto_uno', idioma) : t('reserva_adultos', idioma).toLowerCase()}
                    {ninos > 0 && <> · {ninos} {ninos === 1 ? t('reserva_nino_uno', idioma) : t('reserva_ninos', idioma).toLowerCase()}</>}
                  </small>
                </span>
                <span className="reservar-cifras">
                  {/* El precio de antes, tachado. Sin él, un descuento es una
                      rebaja que nadie ve. */}
                  {descuento > 0 && subtotal !== null && (
                    <s>${plata(subtotal)}</s>
                  )}
                  <b>${plata(total)}</b>
                </span>
              </div>
            )}

            {descuento > 0 && (
              <p className="reservar-lanzamiento">
                −{pct}% {t('reserva_lanzamiento', idioma)}
              </p>
            )}

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
                {total !== null && <> · <b>${plata(total)}</b></>}
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

            {/* El cupón, plegado y de último. Abierto le dice a los nueve de
                cada diez que no tienen código que les falta algo, y el que sí
                lo tiene lo va a buscar igual. El descuento de lanzamiento no
                pasa por acá: ese es automático y ya viene en el precio. */}
            <details className="reservar-mas">
              <summary>
                {t('reserva_cupon', idioma)}
                <span className="opcional">{t('opcional', idioma)}</span>
              </summary>
              <input id="rcu" maxLength={40} autoComplete="off" spellCheck={false}
                     aria-label={t('reserva_cupon', idioma)}
                     style={{ textTransform: 'uppercase' }}
                     value={cupon} onChange={(e) => setCupon(e.target.value.toUpperCase())} />
              <small className="gris">{t('reserva_cupon_nota', idioma)}</small>
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
