'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { t, type Idioma } from '@/lib/idiomas';
import { FormularioSorteo } from './FormularioSorteo';
import { premioEnPlata } from '@/lib/sorteo-formato';
import type { Sorteo } from '@/lib/sorteo';

/*
 * El aviso de la rifa.
 *
 * Sale solo dos veces: a los N segundos de entrar, o cuando el puntero se va
 * hacia la barra del navegador —el gesto de irse—. Los dos tiempos, y si el
 * segundo esta encendido, se deciden en el panel.
 *
 * Lo que NO hace, y es a proposito:
 *
 * - No vuelve a salir si ya lo cerraste, durante los dias que diga el panel.
 * - No vuelve a salir NUNCA si ya participaste.
 * - No sale en la pagina de la rifa: ahi el formulario ya esta en pantalla.
 * - No atrapa el boton de atras ni bloquea el scroll de la pagina. Un aviso
 *   del que no se puede salir no gana un correo, pierde un visitante.
 *
 * Se recuerda en localStorage, que es del navegador y no viaja a ningun lado.
 * Si esta bloqueado —modo privado— lo peor que pasa es que el aviso vuelva a
 * salir en la proxima visita. Nada revienta.
 */

const CERRADO = 'vlf_sorteo_cerrado';
const HECHO = 'vlf_sorteo_hecho';

function leer(clave: string): string | null {
  try { return localStorage.getItem(clave); } catch { return null; }
}

export function AvisoSorteo({
  sorteo, idioma,
}: {
  sorteo: Sorteo;
  idioma: Idioma;
}) {
  /* La ruta la mira el propio aviso y no se la pasa el layout: el layout se
     pinta una vez y no se entera de las navegaciones de adentro, asi que el
     aviso habria seguido saliendo encima de la pagina de la rifa. */
  const ruta = usePathname();
  const enLaPaginaDelSorteo = ruta === `/${idioma}/${sorteo.babosa}`;

  /* `?aviso=1` lo abre de una, aunque ya lo hayas cerrado o ya hayas
     participado. Sin esto no hay forma de volver a verlo: el aviso se
     recuerda en el navegador justamente para no repetirse, asi que mirar
     como quedo obligaba a borrar el almacenamiento a mano. */
  const forzado = useSearchParams().get('aviso') === '1';

  const [abierto, setAbierto] = useState(false);
  const [participo, setParticipo] = useState(false);
  const cerrable = useRef(true);
  const panel = useRef<HTMLDivElement>(null);
  const abiertoAlguna = useRef(false);

  const cerrar = useCallback(() => {
    setAbierto(false);
    if (!cerrable.current) return;
    try { localStorage.setItem(CERRADO, String(Date.now())); } catch { /* da igual */ }
  }, []);

  useEffect(() => {
    if (forzado) {
      /* Mirando: se abre ya y NO se anota nada, ni que se cerró ni que se
         participó. Ver el aviso no puede cambiarle el estado a nadie. */
      cerrable.current = false;
      setAbierto(true);
      return;
    }
    if (enLaPaginaDelSorteo || !sorteo.aviso_activo || sorteo.cerrado_en) return;

    if (leer(HECHO) === sorteo.id) return;              // ya participó
    const cerradoEn = Number(leer(CERRADO) ?? 0);
    const espera = sorteo.dias_para_repreguntar * 24 * 60 * 60 * 1000;
    if (cerradoEn && Date.now() - cerradoEn < espera) return;

    const abrir = () => {
      if (abiertoAlguna.current) return;
      abiertoAlguna.current = true;
      setAbierto(true);
    };

    const reloj = window.setTimeout(abrir, Math.max(0, sorteo.segundos_para_abrir) * 1000);

    /* La intención de salir: el puntero cruza el borde de ARRIBA, que es
       donde están la barra de direcciones y la X. Hacia los lados o hacia
       abajo no cuenta — ahí uno va al escritorio o a otra ventana y vuelve.
       En teléfono no existe el gesto: ahí manda el reloj y nada más. */
    const seVa = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget) abrir();
    };
    if (sorteo.al_intentar_salir) document.addEventListener('mouseout', seVa);

    return () => {
      window.clearTimeout(reloj);
      document.removeEventListener('mouseout', seVa);
    };
  }, [sorteo, enLaPaginaDelSorteo, forzado]);

  // Escape cierra, y al abrirse el foco entra al panel para que el teclado
  // no se quede navegando la página de atrás.
  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', tecla);
    panel.current?.focus();
    return () => document.removeEventListener('keydown', tecla);
  }, [abierto, cerrar]);

  if (!abierto) return null;

  const premio = premioEnPlata(sorteo.premio_usd, idioma);

  return (
    <div className="aviso-velo" onClick={cerrar}>
      <div className="aviso-sorteo" role="dialog" aria-modal="true" aria-labelledby="aviso-titulo"
           tabIndex={-1} ref={panel} onClick={(e) => e.stopPropagation()}>
        <button className="aviso-cerrar" type="button" onClick={cerrar}
                aria-label={t('cerrar', idioma)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M5 5l14 14M19 5L5 19" />
          </svg>
        </button>

        <div className="aviso-foto">
          {sorteo.imagen_url
            /* eslint-disable-next-line @next/next/no-img-element */
            ? <img src={sorteo.imagen_url} alt="" />
            : <span className="exp-sin-foto" aria-hidden="true" />}
          {/* La cifra sola no dice nada: "$1.000" podia ser un descuento,
              una cuota o un precio. Arriba el rotulo que dice QUE es, abajo
              que se gana con eso. La cifra se queda enorme, pero deja de
              estar huerfana. */}
          <span className="aviso-cartel">
            <span className="aviso-gran">{t('sorteo_gran', idioma)}</span>
            {premio && <strong>{premio}</strong>}
            {sorteo.premio_titulo && <span className="aviso-que">{sorteo.premio_titulo}</span>}
          </span>
        </div>

        <div className="aviso-cuerpo">
          <h2 id="aviso-titulo">{sorteo.titulo}</h2>
          {sorteo.gancho && <p>{sorteo.gancho}</p>}

          {/* Los tres primeros renglones nada mas: el aviso tiene que caber
              en una pantalla de telefono con el boton adentro. El resto esta
              a un clic en la pagina. */}
          {sorteo.incluye.length > 0 && (
            <ul className="aviso-incluye">
              {sorteo.incluye.slice(0, 3).map((linea) => <li key={linea}>{linea}</li>)}
            </ul>
          )}

          <FormularioSorteo
            sorteo={sorteo} idioma={idioma} origen="aviso"
            onListo={() => {
              setParticipo(true);
              /* Ya participó: el aviso no debe volver a salir nunca, y
                 `cerrable` en false evita además pisar esa marca con la de
                 "lo cerró", que solo dura unos días. */
              cerrable.current = false;
              window.setTimeout(() => setAbierto(false), 3200);
            }}
          />

          {!participo && (
            <Link className="aviso-ver-bases" href={`/${idioma}/${sorteo.babosa}`}>
              {t('sorteo_ver_todo', idioma)}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
