import Link from 'next/link';
import { notFound } from 'next/navigation';
import { miNegocio, resenasDeMiNegocio, ESTADO_FICHA } from '@/lib/comercio';
import { FormularioNegocio } from './FormularioNegocio';
import { Resenas } from './Resenas';

export const dynamic = 'force-dynamic';

export default async function EditarMiNegocio({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nuevo?: string }>;
}) {
  const { id } = await params;
  const { nuevo } = await searchParams;

  // miNegocio sale de mis_negocios, que ya filtra por quién llama: si el id
  // no es suyo, no aparece y esto es un 404. No hace falta otro chequeo.
  const negocio = await miNegocio(id);
  if (!negocio) notFound();

  const resenas = negocio.estado_publicacion === 'publicado'
    ? await resenasDeMiNegocio(id)
    : [];

  const estado = ESTADO_FICHA[negocio.estado_publicacion] ?? ESTADO_FICHA.borrador;
  const urlPublica = `/${negocio.idioma_principal}/${negocio.categoria_babosa}/${negocio.babosa}`;

  return (
    <>
      <Link href="/negocio" className="comercio-volver">← Mis negocios</Link>

      {nuevo === '1' && (
        <div className="aviso-logro">
          <strong>¡Listo! Tu negocio quedó cargado.</strong>
          <p>
            Ahora lo revisa el equipo antes de publicarlo en el directorio.
            Mientras tanto podés seguir completando la ficha — todo lo que
            agregues se guarda.
          </p>
        </div>
      )}

      <div className="comercio-cabecera">
        <div>
          <span className="comercio-cat">{negocio.categoria_nombre}</span>
          <h1>{negocio.nombre}</h1>
        </div>
        <div className="comercio-estado-caja">
          <span className="comercio-estado" style={{ color: estado.color }}>● {estado.texto}</span>
          <small>{estado.detalle}</small>
          {negocio.estado_publicacion === 'publicado' && (
            <a href={urlPublica} target="_blank" rel="noreferrer" className="comercio-ver">
              Ver mi ficha ↗
            </a>
          )}
        </div>
      </div>

      <FormularioNegocio negocio={negocio} />

      {negocio.estado_publicacion === 'publicado' && (
        <Resenas negocioId={negocio.id} resenas={resenas} />
      )}
    </>
  );
}
