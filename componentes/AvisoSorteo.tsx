'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  }, [sorteo, enLaPaginaDelSorteo]);

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
          {premio && <span className="aviso-premio">{premio}</span>}
        </div>

        <div className="aviso-cuerpo">
          <span className="aviso-sello">{t('sorteo_sello', idioma)}</span>
          <h2 id="aviso-titulo">{sorteo.titulo}</h2>
          {sorteo.gancho && <p>{sorteo.gancho}</p>}

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
