import Link from 'next/link';
import { contextoComercio, ESTADO_FICHA } from '@/lib/comercio';
import { avisarmeDeResenas } from './acciones';

export const dynamic = 'force-dynamic';

export default async function MisNegocios() {
  const { cuenta, negocios, avisarResenas } = await contextoComercio();

  return (
    <>
      <h1>Mis negocios</h1>
      <p className="comercio-sub">Entraste como {cuenta.email}</p>

      {/* El aviso de resenas. Encendido de arranque a proposito: un duenno que
          no sabe que le escribieron no puede contestar, y una resena sin
          respuesta es la que mas duele. */}
      <form action={avisarmeDeResenas} className="comercio-aviso">
        <input type="hidden" name="avisar" value={avisarResenas ? '0' : '1'} />
        <div>
          <strong>Avisarme por correo cuando me dejen una reseña</strong>
          <span>
            Te llega la reseña entera y un botón para responder sin entrar a tu cuenta.
            {avisarResenas ? '' : ' Ahora mismo está apagado.'}
          </span>
        </div>
        <button className={avisarResenas ? 'boton tenue' : 'boton'} type="submit">
          {avisarResenas ? 'Apagar' : 'Encender'}
        </button>
      </form>

      {negocios.length === 0 ? (
        <div className="comercio-vacio">
          <p>Todavía no tenés ningún negocio cargado.</p>
          <Link className="boton" href="/es/sumar-negocio">Sumar mi negocio</Link>
        </div>
      ) : (
        <>
          <div className="comercio-lista">
            {negocios.map((n) => {
              const estado = ESTADO_FICHA[n.estado_publicacion] ?? ESTADO_FICHA.borrador;
              return (
                <Link key={n.id} href={`/negocio/${n.id}`} className="comercio-ficha">
                  <div>
                    <span className="comercio-cat">{n.categoria_nombre}</span>
                    <h2>{n.nombre}</h2>
                    {n.resumen && <p>{n.resumen}</p>}
                  </div>
                  <div className="comercio-ficha-pie">
                    <span className="comercio-estado" style={{ color: estado.color }}>
                      ● {estado.texto}
                    </span>
                    {n.estado_publicacion === 'publicado' && (
                      <span className="comercio-dato">
                        {n.total_vistas} visitas · {n.total_resenas} reseñas
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
          <Link className="boton-linea comercio-sumar-mas" href="/es/sumar-negocio">
            Sumar otro negocio
          </Link>
        </>
      )}
    </>
  );
}
