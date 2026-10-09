import Link from 'next/link';
import { t, type Idioma } from '@/lib/idiomas';
import { salir } from '@/app/negocio/acciones';

/**
 * El menú de quien tiene sesión, arriba a la derecha.
 *
 * Mismo `<details>` que el selector de idioma y el menú plegado: ni una línea
 * de JavaScript en el cliente, y la barra sigue siendo de servidor. El
 * navegador se encarga del teclado y del lector de pantalla.
 *
 * Aparece también en el sitio público, no solo dentro del panel: un dueño que
 * anda viendo el directorio tiene que poder volver a lo suyo sin salirse, y
 * navegar el sitio como cualquier otro.
 */
export function MenuPerfil({ idioma }: { idioma: Idioma }) {
  return (
    <details className="menu-perfil">
      <summary aria-label={t('perfil_mi_cuenta', idioma)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4.5 20c.9-3.7 3.9-5.6 7.5-5.6s6.6 1.9 7.5 5.6"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </summary>
      <div className="lista">
        <Link href="/negocio">{t('perfil_mis_negocios', idioma)}</Link>
        <Link href={`/${idioma}/sumar-negocio`}>{t('perfil_sumar_otro', idioma)}</Link>
        <form action={salir}>
          <button type="submit">{t('perfil_salir', idioma)}</button>
        </form>
      </div>
    </details>
  );
}
