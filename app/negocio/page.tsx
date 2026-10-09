import Link from 'next/link';
import { contextoComercio, ESTADO_FICHA } from '@/lib/comercio';

export const dynamic = 'force-dynamic';

export default async function MisNegocios() {
  const { cuenta, negocios } = await contextoComercio();

  return (
    <>
      <h1>Mis negocios</h1>
      <p className="comercio-sub">Entraste como {cuenta.email}</p>

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
