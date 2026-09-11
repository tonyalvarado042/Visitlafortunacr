import { t, type Idioma } from '@/lib/idiomas';

/* El campo de búsqueda, en un formulario GET nativo: navega a /<idioma>?q=…
   sin una línea de JavaScript, y deja la búsqueda en la URL para poder
   compartirla y volver con el botón atrás.

   Lo usan dos sitios: el hero de la portada y la banda compacta que lo
   reemplaza cuando ya hay una búsqueda. */

export function CampoBusqueda({ idioma, consulta = '' }: { idioma: Idioma; consulta?: string }) {
  return (
    <form className="buscador" action={`/${idioma}`} method="get">
      <div className="campo">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#8B8B87"
             strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
        </svg>
        <input name="q" className="texto" defaultValue={consulta}
               placeholder={t('que_buscas', idioma)} aria-label={t('que_buscas', idioma)}
               autoComplete="off" />
      </div>
      <button type="submit" className="boton">{t('buscar', idioma)}</button>
    </form>
  );
}
