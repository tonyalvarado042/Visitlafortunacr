import Link from 'next/link';
import { IconoVerificado } from './Marca';
import { t, type Idioma } from '@/lib/idiomas';
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
    <article className="tarjeta">
      <Link href={`/${idioma}/${negocio.categoria_babosa}/${negocio.babosa}`}>
        <div className="imagen" style={{ background: `linear-gradient(150deg, ${color}1F, #0B0B0B 72%)` }}>
          {negocio.logo_url
            ? <img src={negocio.logo_url} alt="" style={{ maxHeight: 110, width: 'auto' }} />
            : <span className="inicial" style={{ color }}>{negocio.nombre.charAt(0)}</span>}
        </div>
      </Link>

      <div className="cuerpo">
        <div className="meta">
          {negocio.es_destacado && <span className="sello-pagado">{t('destacado', idioma)}</span>}
          <span className="etiqueta-cat">{negocio.categoria_nombre}</span>
          {verificado
            ? <span className="sello"><IconoVerificado />{t('verificado', idioma)}</span>
            : <span className="sello sello-tenue">{t('por_confirmar', idioma)}</span>}
        </div>

        <h3><Link href={`/${idioma}/${negocio.categoria_babosa}/${negocio.babosa}`}>{negocio.nombre}</Link></h3>
        <p>{negocio.resumen}</p>

        <div className="pie">
          {negocio.promedio_calificacion
            ? <><b>{negocio.promedio_calificacion.toFixed(1).replace('.', ',')}</b> · {negocio.total_resenas}</>
            : <span>{t('sin_resenas', idioma)}</span>}
          {negocio.rango_precio && <span style={{ marginLeft: 'auto' }}>{SIMBOLO_PRECIO[negocio.rango_precio]}</span>}
        </div>
      </div>
    </article>
  );
}
