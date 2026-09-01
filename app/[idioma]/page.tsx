import Link from 'next/link';
import { destinoActual, categoriasDe, negociosDe, type Negocio, type Categoria } from '@/lib/destino';
import { t, type Idioma } from '@/lib/idiomas';
import { Barra } from '@/componentes/Barra';
import { Pie } from '@/componentes/Pie';
import { Hero } from '@/componentes/Hero';
import { TarjetaNegocio } from '@/componentes/TarjetaNegocio';
import { Planificador } from '@/componentes/Planificador';

export const dynamic = 'force-dynamic';

/* Cada categoría del mosaico lleva su propio ambiente. No son fotos: son
   gradientes, que es lo que hará el sitio hasta que haya imágenes propias. */
const AMBIENTE: Record<string, string> = {
  'volcan':            'linear-gradient(160deg,#1A0E04 0%,#0B0B0B 62%), radial-gradient(circle at 72% 22%, rgba(255,106,0,.40) 0%, transparent 55%)',
  'parques-nacionales':'linear-gradient(160deg,#1A0E04 0%,#0B0B0B 62%), radial-gradient(circle at 72% 22%, rgba(255,106,0,.40) 0%, transparent 55%)',
  'puentes-colgantes': 'linear-gradient(160deg,#04140F 0%,#0B0B0B 62%), radial-gradient(circle at 28% 30%, rgba(102,187,46,.30) 0%, transparent 58%)',
  'cataratas':         'linear-gradient(160deg,#0A1218 0%,#0B0B0B 68%)',
  'aguas-termales':    'linear-gradient(160deg,#180D06 0%,#0B0B0B 68%)',
  'canopy':            'linear-gradient(160deg,#0D1408 0%,#0B0B0B 68%)',
  'vida-silvestre':    'linear-gradient(160deg,#08140D 0%,#0B0B0B 68%)',
  'rafting':           'linear-gradient(160deg,#061218 0%,#0B0B0B 68%)',
  'canyoning':         'linear-gradient(160deg,#120E18 0%,#0B0B0B 68%)',
};
const AMBIENTE_NEUTRO = 'linear-gradient(160deg,#141414 0%,#0B0B0B 68%)';

/* El mosaico: dos piezas grandes arriba y tres abajo, como en el diseño. */
const FORMA = ['g-6 alta', 'g-6 alta', 'g-4', 'g-4', 'g-4'];

export default async function Portada({ params }: { params: Promise<{ idioma: Idioma }> }) {
  const { idioma } = await params;
  const destino = await destinoActual();
  const [categorias, negocios] = await Promise.all([
    categoriasDe(destino, idioma),
    negociosDe(destino, idioma),
  ]);

  const conContenido = categorias.filter((c) => c.total > 0);

  /* Para cada categoría del mosaico, su negocio mejor valorado presta el
     resumen: así la portada dice algo concreto en vez de un texto de relleno. */
  const mejorDe = (c: Categoria): Negocio | undefined =>
    negocios
      .filter((n) => n.categoria_id === c.categoria_id)
      .sort((a, b) => (b.promedio_calificacion ?? 0) - (a.promedio_calificacion ?? 0))[0];

  const mosaico = conContenido
    .filter((c) => ['que_hacer', 'tours'].includes(c.seccion))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const dormir = negocios
    .filter((n) => n.seccion === 'donde_dormir')
    .sort((a, b) => Number(b.es_destacado) - Number(a.es_destacado) || (b.promedio_calificacion ?? 0) - (a.promedio_calificacion ?? 0))
    .slice(0, 3);

  const comer = negocios
    .filter((n) => n.seccion === 'comer_beber')
    .sort((a, b) => Number(b.es_destacado) - Number(a.es_destacado) || (b.promedio_calificacion ?? 0) - (a.promedio_calificacion ?? 0))
    .slice(0, 3);

  const intereses = conContenido
    .filter((c) => ['que_hacer', 'tours'].includes(c.seccion))
    .slice(0, 8)
    .map((c) => ({ babosa: c.babosa, nombre: c.nombre }));

  return (
    <>
      <Barra destino={destino} idioma={idioma} categorias={categorias} rutaActual="" sobreHero />

      <Hero
        idioma={idioma}
        nombre={destino.nombre}
        region={destino.region}
        pais={destino.pais_nombre}
        lema={destino.lema}
        colorAcento={destino.color_acento}
        colorVerde={destino.color_naturaleza}
      />

      {/* ---- Qué hacer ---- */}
      <section className="zona">
        <div className="caja">
          <div className="cabecera-seccion revela">
            <div>
              <span className="rotulo">{t('que_hacer', idioma)}</span>
              <h2>{t('nadie_se_salta', idioma)}</h2>
            </div>
            <span className="enlace-mas">{negocios.length} {t('lugares', idioma)}</span>
          </div>

          <div className="rejilla-hacer">
            {mosaico.map((c, i) => {
              const mejor = mejorDe(c);
              return (
                <Link key={c.categoria_id} href={`/${idioma}/${c.babosa}`}
                      className={`ficha-grande revela ${FORMA[i] ?? 'g-4'}`}>
                  <div className="fondo" style={{ background: AMBIENTE[c.babosa] ?? AMBIENTE_NEUTRO }} />
                  <span className="marca">{c.total} {t('lugares', idioma)}</span>
                  <div className="contenido">
                    <h3>{c.nombre}</h3>
                    {mejor?.resumen && <p>{mejor.resumen}</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---- Planificador ---- */}
      <section className="zona" id="plan" style={{ paddingTop: 0 }}>
        <div className="caja">
          <div className="planificador revela">
            <div className="plan-cuerpo">
              <div>
                <span className="rotulo">{t('armar_viaje', idioma)}</span>
                <h2>{t('en_60_segundos', idioma)}</h2>
                <p style={{ fontSize: 16.5, color: '#C2C0BC', maxWidth: '44ch', marginTop: 18 }}>
                  {t('plan_explica', idioma)}
                </p>
                <div className="pasos">
                  <div className="paso"><i>1</i>{t('paso_1', idioma)}</div>
                  <div className="paso"><i>2</i>{t('paso_2', idioma)}</div>
                  <div className="paso"><i>3</i>{t('paso_3', idioma)}</div>
                </div>
              </div>
              <Planificador idioma={idioma} intereses={intereses} />
            </div>
          </div>
        </div>
      </section>

      {/* ---- Dónde dormir ---- */}
      {dormir.length > 0 && (
        <section className="zona" style={{ paddingTop: 0 }}>
          <div className="caja">
            <div className="cabecera-seccion revela">
              <div>
                <span className="rotulo">{t('donde_dormir', idioma)}</span>
                <h2>{t('de_hostal_a_villa', idioma)}</h2>
              </div>
              <Link className="enlace-mas" href={`/${idioma}/${conContenido.find((c) => c.seccion === 'donde_dormir')?.babosa ?? ''}`}>
                {t('ver_todo', idioma)} →
              </Link>
            </div>
            <div className="rejilla">
              {dormir.map((n) => <div key={n.id} className="revela"><TarjetaNegocio negocio={n} idioma={idioma} /></div>)}
            </div>
          </div>
        </section>
      )}

      {/* ---- Comer y beber ---- */}
      {comer.length > 0 && (
        <section className="zona" style={{ paddingTop: 0 }}>
          <div className="caja">
            <div className="cabecera-seccion revela">
              <div>
                <span className="rotulo">{t('comer_beber', idioma)}</span>
                <h2>{t('comer_beber', idioma)}</h2>
              </div>
              <Link className="enlace-mas" href={`/${idioma}/${conContenido.find((c) => c.seccion === 'comer_beber')?.babosa ?? ''}`}>
                {t('ver_todo', idioma)} →
              </Link>
            </div>
            <div className="rejilla">
              {comer.map((n) => <div key={n.id} className="revela"><TarjetaNegocio negocio={n} idioma={idioma} /></div>)}
            </div>
          </div>
        </section>
      )}

      {/* ---- Cifras ---- */}
      <section className="zona" style={{ paddingTop: 0 }}>
        <div className="caja">
          <div className="cifras revela">
            <div className="cifra"><div className="num">{negocios.length}</div><div className="que">{t('negocios_dir', idioma)}</div></div>
            <div className="cifra"><div className="num">{conContenido.length}</div><div className="que">{t('categorias_expl', idioma)}</div></div>
            <div className="cifra"><div className="num">{destino.idiomas.length}</div><div className="que">{t('idiomas_cuenta', idioma)}</div></div>
            <div className="cifra"><div className="num">100%</div><div className="que">{t('gratis_negocios', idioma)}</div></div>
          </div>
        </div>
      </section>

      {/* ---- Pilares ---- */}
      <section className="zona" style={{ paddingTop: 0 }}>
        <div className="caja">
          <div className="pilares">
            <div className="pilar revela">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 19l6-11 4 7 3-5 5 9z" /></svg>
              <h4>{t('naturaleza', idioma)}</h4><p>{t('naturaleza_lema', idioma)}</p>
            </div>
            <div className="pilar revela">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="6" cy="17" r="3.4" /><circle cx="18" cy="17" r="3.4" /><path d="M6 17l4-8h5l3 8" /><path d="M10 9l-1-3H7" /></svg>
              <h4>{t('aventura', idioma)}</h4><p>{t('aventura_lema', idioma)}</p>
            </div>
            <div className="pilar revela">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 4C10 4 5 9 5 16v4" /><path d="M5 16c9 1 14-3 15-12" /></svg>
              <h4>{t('sostenibilidad', idioma)}</h4><p>{t('sostenibilidad_lema', idioma)}</p>
            </div>
            <div className="pilar revela">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2" /><path d="M3 20a6 6 0 0112 0" /><path d="M16 6.5a3.2 3.2 0 010 6" /><path d="M18 20a6 6 0 00-3-5.2" /></svg>
              <h4>{t('comunidad', idioma)}</h4><p>{t('comunidad_lema', idioma)}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Cierre ---- */}
      <section className="cierre">
        <span className="rotulo">{t('para_negocios', idioma)}</span>
        <h2 style={{ maxWidth: '14ch', margin: '0 auto' }}>{t('tu_negocio', idioma)}</h2>
        <p>{t('negocio_explica', idioma)}</p>
        <Link className="boton" href={`/${idioma}#plan`} style={{ padding: '16px 34px', fontSize: 14 }}>
          {t('sumar_negocio', idioma)}
        </Link>
      </section>

      <Pie destino={destino} />
    </>
  );
}
