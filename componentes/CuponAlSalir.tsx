'use client';

import { useEffect, useRef, useState } from 'react';
import { t, type Idioma } from '@/lib/idiomas';

/*
 * La ventana que se le ofrece a quien está por irse sin reservar.
 *
 * POR QUÉ ESTO SÍ PUEDE DECIR «NO LO TIENE TODO EL MUNDO»: el descuento de
 * lanzamiento es automático y le toca a cualquiera que entre, así que
 * presentarlo como exclusivo sería mentira — de las que el cliente descubre
 * solo, comparando con un amigo. Un cupón con tope de usos es escaso de
 * verdad, y la escasez se puede CONTAR porque es un número en una tabla.
 * Por eso dice «quedan 12» únicamente cuando quedan 12.
 *
 * Y por eso la base no lo devuelve cuando ya se agotó o venció: ofrecer un
 * código que la reserva va a rechazar después es peor que no ofrecer nada.
 *
 * Cuándo aparece, y las tres cosas que NO hace:
 *  - Una sola vez por navegador (se recuerda que ya se vio). Una ventana que
 *    vuelve en cada página es la razón por la que la gente se va.
 *  - No sale si la persona YA EMPEZÓ a llenar el formulario. Ojo con esto:
 *    la primera versión miraba si el formulario estaba a la vista, y en
 *    escritorio vive en la columna derecha y casi siempre lo está — la ventana
 *    no habría salido nunca. Estar a la vista no es estar usándolo; haber
 *    tocado un campo sí.
 *  - No sale de entrada: espera a que haya intención de irse, o a que lleve un
 *    rato leyendo. Tapar una ficha a los dos segundos es perder la visita.
 */

export type CuponOfrecible = {
  codigo: string;
  tipo_descuento: 'porcentaje' | 'monto';
  valor: number;
  gancho: string | null;
  vale_hasta: string | null;
  quedan: number | null;
};

const YA_LO_VIO = 'vlf_cupon_salida_visto';
const ESPERA_MS = 45_000;

export function CuponAlSalir({ cupon, idioma }: { cupon: CuponOfrecible; idioma: Idioma }) {
  const [abierto, setAbierto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const yaSalio = useRef(false);
  /* Si tocó el formulario, la ventana no sale más. */
  const tocoElFormulario = useRef(false);

  useEffect(() => {
    /* `localStorage` puede tronar en ventana privada o con las cookies
       bloqueadas. Si no se puede leer, se asume que no lo vio: mejor una
       ventana de más que una página rota. */
    try {
      if (localStorage.getItem(YA_LO_VIO)) return;
    } catch { /* sin memoria, seguimos */ }

    const mostrar = () => {
      if (yaSalio.current) return;
      /* Ya metió mano en el formulario: está haciendo justo lo que queremos,
         y taparle la pantalla es sabotearse. */
      if (tocoElFormulario.current) return;
      yaSalio.current = true;
      setAbierto(true);
      try { localStorage.setItem(YA_LO_VIO, '1'); } catch { /* da igual */ }
    };

    /* Cualquier toque dentro del widget cuenta como «está en eso»: enfocar un
       campo, escribir, elegir una fecha. Se escucha en el documento y se filtra
       por `closest` para no tener que colgar oyentes de cada campo — y porque
       el widget se repinta cuando cambia de pase. */
    const anotarToque = (e: Event) => {
      const donde = e.target as Element | null;
      if (donde?.closest?.('.reservar')) tocoElFormulario.current = true;
    };
    document.addEventListener('focusin', anotarToque);
    document.addEventListener('change', anotarToque);

    /* El mouse saliendo por arriba es la señal clásica de que se va. En
       teléfono no existe, y por eso además hay un reloj. */
    const alSalir = (e: MouseEvent) => { if (e.clientY <= 0) mostrar(); };
    const reloj = window.setTimeout(mostrar, ESPERA_MS);
    document.addEventListener('mouseout', alSalir);
    return () => {
      document.removeEventListener('focusin', anotarToque);
      document.removeEventListener('change', anotarToque);
      document.removeEventListener('mouseout', alSalir);
      window.clearTimeout(reloj);
    };
  }, []);

  if (!abierto) return null;

  const cuanto = cupon.tipo_descuento === 'porcentaje' ? `${cupon.valor}%` : `$${cupon.valor}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(cupon.codigo);
      setCopiado(true);
    } catch {
      /* Sin permiso de portapapeles el código igual está a la vista para
         copiarlo a mano. No se avisa de un fallo que no impide nada. */
    }
  }

  return (
    <div className="cupon-fondo" role="dialog" aria-modal="true" aria-labelledby="cupon-titulo">
      <div className="cupon-caja">
        <button type="button" className="cupon-cerrar" onClick={() => setAbierto(false)}
                aria-label={t('cerrar', idioma)}>×</button>

        <span className="cupon-sello">{cuanto}</span>

        <h2 id="cupon-titulo">{cupon.gancho || t('cupon_titulo', idioma)}</h2>

        <p className="cupon-que">{t('cupon_como_se_usa', idioma)}</p>

        <button type="button" className="cupon-codigo" onClick={copiar}
                aria-label={`${t('cupon_copiar', idioma)}: ${cupon.codigo}`}>
          <code>{cupon.codigo}</code>
          <span>{copiado ? t('cupon_copiado', idioma) : t('cupon_copiar', idioma)}</span>
        </button>

        {/* La escasez SOLO cuando es un número real. Sin tope de usos no se
            dice nada: «quedan pocos» sin saber cuántos es justo la frase que
            vuelve sospechoso todo lo demás. */}
        {(cupon.quedan != null || cupon.vale_hasta) && (
          <p className="cupon-letra">
            {cupon.quedan != null && (
              <strong>{t('cupon_quedan', idioma)} {cupon.quedan}</strong>
            )}
            {cupon.quedan != null && cupon.vale_hasta && ' · '}
            {cupon.vale_hasta && (
              <>{t('cupon_hasta', idioma)} {new Date(`${cupon.vale_hasta}T12:00:00`)
                .toLocaleDateString(idioma, { day: 'numeric', month: 'long' })}</>
            )}
          </p>
        )}

        <a className="boton" href="#reservar" onClick={() => setAbierto(false)}>
          {t('cupon_ir', idioma)}
        </a>
      </div>
    </div>
  );
}
