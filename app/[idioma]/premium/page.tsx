import Link from 'next/link';
import type { Metadata } from 'next';
import { destinoActual, categoriasDe, cuposPremium, negocioPorBabosa, fotosDe } from '@/lib/destino';
import { t, type Idioma } from '@/lib/idiomas';
import { Barra } from '@/componentes/Barra';
import { Pie } from '@/componentes/Pie';
import { VideoNegocio } from '@/componentes/VideoNegocio';
import { FormularioPremium } from './FormularioPremium';

export const dynamic = 'force-dynamic';

type Parametros = Promise<{ idioma: Idioma }>;

export async function generateMetadata({ params }: { params: Parametros }): Promise<Metadata> {
  const { idioma } = await params;
  try {
    const destino = await destinoActual();
    return {
      title: `${t('premium_pagina_titulo', idioma)} · ${destino.nombre}`,
      description: destino.premium_gancho ?? t('premium_pagina_bajada', idioma),
    };
  } catch {
    return {};
  }
}

export default async function Premium({ params }: { params: Parametros }) {
  const { idioma } = await params;
  const destino = await destinoActual();

  const [categorias, cupos] = await Promise.all([
    categoriasDe(destino, idioma),
    cuposPremium(destino),
  ]);

  /* El ejemplo es una ficha de VERDAD del directorio, no una maqueta. Vale
     más que cualquier explicación: se ve cómo queda. */
  const ejemplo = destino.premium_ejemplo_babosa
    ? await negocioPorBabosa(destino, destino.premium_ejemplo_babosa, idioma)
    : null;
  const fotosEjemplo = ejemplo ? await fotosDe(ejemplo.id, idioma) : [];

  const precio = destino.premium_precio_usd ? Number(destino.premium_precio_usd) : null;
  const antes = destino.premium_precio_antes ? Number(destino.premium_precio_antes) : null;
  const hayRebaja = precio !== null && antes !== null && antes > precio && cupos.quedan > 0;
  const aPagar = hayRebaja ? precio : (antes ?? precio);
  const dinero = (n: number) => `$${n.toLocaleString('en-US')}`;

  return (
    <>
      <Barra destino={destino} idioma={idioma} categorias={categorias} rutaActual="/premium" />

      <main className="caja premium-pagina">
        <header className="premium-hero">
          <span className="premium-sello">{t('premium_sello', idioma)}</span>
          <h1>{destino.premium_titulo ?? t('premium_pagina_titulo', idioma)}</h1>
          <p>{destino.premium_gancho ?? t('premium_pagina_bajada', idioma)}</p>

          {aPagar !== null && (
            <div className="premium-precio premium-precio-grande">
              {hayRebaja && <span className="premium-antes">{dinero(antes!)}</span>}
              <strong>{dinero(aPagar)}</strong>
              <small>{t('premium_una_vez', idioma)}</small>
            </div>
          )}

          {hayRebaja && cupos.cupos !== null && (
            <p className="premium-cupos-linea">
              {t('premium_quedan', idioma).replace('{n}', String(cupos.quedan))}
            </p>
          )}
        </header>

        <div className="premium-reja">
          <div>
            {destino.premium_incluye.length > 0 && (
              <ul className="premium-lista premium-lista-grande">
                {destino.premium_incluye.map((cosa) => (
                  <li key={cosa}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {cosa}
                  </li>
                ))}
              </ul>
            )}

            <section className="premium-pasos">
              <h2>{t('premium_como_va', idioma)}</h2>
              <ol>
                <li>{t('premium_paso_1', idioma)}</li>
                <li>{t('premium_paso_2', idioma)}</li>
                <li>{t('premium_paso_3', idioma)}</li>
              </ol>
            </section>
          </div>

          <aside className="premium-columna">
            <div className="exp-caja-consulta">
              <h2>{t('premium_hablemos', idioma)}</h2>
              <FormularioPremium idioma={idioma} />
            </div>
            <p className="exp-letra-chica">{t('premium_sin_pago', idioma)}</p>
          </aside>
        </div>

        {ejemplo && ejemplo.video_url && (
          <section className="premium-ejemplo" id="ejemplo">
            <div className="premium-rotulo-ejemplo">
              <span className="premium-sello">{t('premium_ejemplo_rot', idioma)}</span>
              <p>{t('premium_ejemplo_pie', idioma)}</p>
            </div>

            <VideoNegocio
              url={ejemplo.video_url}
              portada={ejemplo.video_portada_url}
              nombre={ejemplo.nombre}
              idioma={idioma}
            />

            <Link
              href={`/${idioma}/${ejemplo.categoria_babosa}/${ejemplo.babosa}`}
              className="boton-linea premium-ver-ficha"
            >
              {t('ver_todo', idioma)}: {ejemplo.nombre} ↗
            </Link>
            {fotosEjemplo.length > 0 && (
              <p className="exp-letra-chica" style={{ marginTop: 10 }}>
                {fotosEjemplo.length} {fotosEjemplo.length === 1 ? 'foto' : 'fotos'} · {ejemplo.categoria_nombre}
              </p>
            )}
          </section>
        )}
      </main>

      <Pie destino={destino} />
    </>
  );
}
