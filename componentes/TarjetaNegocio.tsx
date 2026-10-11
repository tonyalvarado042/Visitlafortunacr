import Link from 'next/link';
import { IconoVerificado } from './Marca';
import { Volcanes } from './Volcanes';
import { resenas, t, type Idioma } from '@/lib/idiomas';
import { nota } from '@/lib/resenas';
import { SIMBOLO_PRECIO, type Negocio } from '@/lib/destino';

/* El color del marcador sale de la sección, para que la retícula tenga ritmo
   sin necesitar una foto por ficha. Es lo que hará el sitio real hasta que
   cada negocio suba su logo. */
const COLOR_SECCION: Record<string, string> = {
  que_hacer: '#FF6A00',
  tours: '#66BB2E',
  donde_dormir: '#7FA8D4',
  comer_beber: '#E0A63C',
  explorar: '#B07FD4',
  transporte: '#6BC9C0',
};

export function TarjetaNegocio({ negocio, idioma }: { negocio: Negocio; idioma: Idioma }) {
  const color = COLOR_SECCION[negocio.seccion] ?? '#8B8B87';
  const verificado = negocio.estado_verificacion === 'verificado' || negocio.estado_verificacion === 'reclamado';

  return (
    /* El destacado se nota desde la reticula: borde naranja y cintillo sobre
       la foto. Es lo que se compra con el plan premium; si se viera igual que
       los demas, no habria que pagarlo. */
    <article className={negocio.es_destacado ? 'tarjeta tarjeta-destacada' : 'tarjeta'}>
      <Link href={`/${idioma}/${negocio.categoria_babosa}/${negocio.babosa}`}>
        <div className="imagen" style={{ background: `linear-gradient(150deg, ${color}1F, var(--negro) 72%)` }}>
          {negocio.foto_portada_url && (
            <img className="foto" src={negocio.foto_portada_url} alt=""
                 loading="lazy" decoding="async" />
          )}
          {/* Un tinte con el color de la sección, para que la retícula tenga
              ritmo. Suave a propósito: la foto tiene que verse. */}
          {negocio.foto_portada_url && (
            <span className={`velo-foto${negocio.foto_portada_generica ? ' generica' : ''}`}
                  style={{ background: `linear-gradient(160deg, ${color}, var(--negro) 85%)` }} />
          )}
          {negocio.logo_url
            ? <img src={negocio.logo_url} alt="" style={{ maxHeight: 110, width: 'auto', position: 'relative' }} />
            : !negocio.foto_portada_url && <span className="inicial" style={{ color }}>{negocio.nombre.charAt(0)}</span>}

          {negocio.es_destacado && (
            <span className="cintillo">{t('destacado_cintillo', idioma)}</span>
          )}
          {negocio.video_url && (
            <span className="destacado-video" aria-hidden="true">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
              {t('ver_video', idioma)}
            </span>
          )}
        </div>
      </Link>

      <div className="cuerpo">
        <div className="meta">
          <span className="etiqueta-cat">{negocio.categoria_nombre}</span>
          {verificado
            ? <span className="sello"><IconoVerificado />{t('verificado', idioma)}</span>
            : <span className="sello sello-tenue">{t('por_confirmar', idioma)}</span>}
        </div>

        <h3><Link href={`/${idioma}/${negocio.categoria_babosa}/${negocio.babosa}`}>{negocio.nombre}</Link></h3>
        <p>{negocio.resumen}</p>

        {/* Sin calificación no se anuncia el vacío: se muestran los cinco
            volcanes apagados y se invita a calificar. Un "todavía sin
            reseñas" repetido en 29 tarjetas hace ver muerto el directorio. */}
        <div className="pie">
          {negocio.promedio_calificacion ? (
            <>
              <Volcanes nota={negocio.promedio_calificacion} tamano={14}
                        etiqueta={`${nota(negocio.promedio_calificacion, idioma)} ${t('de_cinco', idioma)}`} />
              <b>{nota(negocio.promedio_calificacion, idioma)}</b>
              <span>{negocio.total_resenas} {resenas(negocio.total_resenas, idioma)}</span>
            </>
          ) : (
            <>
              <Volcanes nota={0} tamano={14} etiqueta={t('se_el_primero', idioma)} />
              <span>{t('se_el_primero', idioma)}</span>
            </>
          )}
          {negocio.rango_precio && <span style={{ marginLeft: 'auto' }}>{SIMBOLO_PRECIO[negocio.rango_precio]}</span>}
        </div>
      </div>
    </article>
  );
}
