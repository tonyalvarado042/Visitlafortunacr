import type { Destino } from '@/lib/destino';

export function Pie({ destino }: { destino: Destino }) {
  const lugar = [destino.nombre_largo ?? destino.nombre, destino.region, destino.pais_nombre]
    .filter(Boolean)
    .join(', ');

  /* El crédito sale de dst_destino, no del código. Sin texto no se pinta nada,
     y sin URL se pinta el texto sin enlace — así un destino que no quiera
     crédito simplemente deja el campo vacío.

     El enlace lleva rel="noopener": abre en pestaña nueva y sin esto la página
     de destino puede manipular la nuestra con window.opener. */
  const credito = destino.pie_credito_texto?.trim();
  const url = destino.pie_credito_url?.trim();
  const urlSegura = url && /^https?:\/\//i.test(url) ? url : null;

  return (
    <footer>
      <div className="pie-caja">
        <div className="legal">© {new Date().getFullYear()} {destino.dominio} · {lugar}</div>
        {credito && (
          <div className="credito">
            {urlSegura
              ? <a href={urlSegura} target="_blank" rel="noopener noreferrer">{credito}</a>
              : credito}
          </div>
        )}
      </div>
    </footer>
  );
}
