import Link from 'next/link';
import type { CuposPremium, Destino } from '@/lib/destino';
import { t, type Idioma } from '@/lib/idiomas';

/*
 * La oferta premium: video, historias y un mes de ficha destacada.
 *
 * El precio, lo que incluye y cuántos cupos quedan salen de dst_destino, no
 * del código: el precio de lanzamiento cambia y Tony lo edita desde Ajustes
 * sin desplegar.
 *
 * Los cupos que quedan se CUENTAN. Una escasez inventada se nota —alguien
 * vuelve en un mes y siguen "quedando 3"— y cuesta más confianza de la que
 * gana. Si se acabaron, el bloque deja de hablar de lanzamiento y muestra el
 * precio normal, que es lo honesto.
 */
export function OfertaPremium({
  destino, cupos, idioma, compacta = false,
}: {
  destino: Destino;
  cupos: CuposPremium;
  idioma: Idioma;
  /** En el alta va compacta; en su propia página, entera. */
  compacta?: boolean;
}) {
  if (!destino.premium_activo || !destino.premium_precio_usd) return null;

  const precio = Number(destino.premium_precio_usd);
  const antes = destino.premium_precio_antes ? Number(destino.premium_precio_antes) : null;
  const hayRebaja = antes !== null && antes > precio && cupos.quedan > 0;
  const aPagar = hayRebaja ? precio : (antes ?? precio);

  const dinero = (n: number) => `$${n.toLocaleString('en-US')}`;

  return (
    <section className={compacta ? 'premium premium-compacta' : 'premium'}>
      <div className="premium-cabecera">
        <span className="premium-sello">{t('premium_sello', idioma)}</span>
        {hayRebaja && cupos.cupos !== null && (
          <span className="premium-cupos">
            {t('premium_quedan', idioma).replace('{n}', String(cupos.quedan))}
          </span>
        )}
      </div>

      <h2>{destino.premium_titulo ?? t('premium_titulo', idioma)}</h2>
      {destino.premium_gancho && <p className="premium-gancho">{destino.premium_gancho}</p>}

      {destino.premium_incluye.length > 0 && (
        <ul className="premium-lista">
          {destino.premium_incluye.map((cosa) => (
            <li key={cosa}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {cosa}
            </li>
          ))}
        </ul>
      )}

      <div className="premium-precio">
        {hayRebaja && <span className="premium-antes">{dinero(antes!)}</span>}
        <strong>{dinero(aPagar)}</strong>
        <small>{t('premium_una_vez', idioma)}</small>
      </div>

      <div className="premium-botones">
        <Link href={`/${idioma}/premium`} className="boton">
          {t('premium_quiero', idioma)}
        </Link>
        {destino.premium_ejemplo_babosa && (
          <Link href={`/${idioma}/premium#ejemplo`} className="enlace-flojo">
            {t('premium_ver_ejemplo', idioma)}
          </Link>
        )}
      </div>

      {hayRebaja && cupos.quedan === 0 && (
        <p className="premium-letra-chica">{t('premium_se_acabo', idioma)}</p>
      )}
    </section>
  );
}
