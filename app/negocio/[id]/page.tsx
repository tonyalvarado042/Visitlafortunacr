import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fotosDeMiNegocio, miNegocio, pedidosDeMiNegocio, resenasDeMiNegocio, misDatosFiscales, ESTADO_FICHA } from '@/lib/comercio';
import { DatosFiscales } from './DatosFiscales';
import { FormularioNegocio } from './FormularioNegocio';
import { Fotos } from './Fotos';
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

  const [resenas, fotos, pedidos, fiscales] = await Promise.all([
    negocio.estado_publicacion === 'publicado' ? resenasDeMiNegocio(id) : Promise.resolve([]),
    fotosDeMiNegocio(id),
    pedidosDeMiNegocio(id),
    misDatosFiscales(id),
  ]);

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
            Mientras tanto <strong>sumale fotos</strong> aquí abajo: una ficha
            con fotos se mira mucho más que una sin. Todo lo que agregues se
            guarda.
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

      {/* Lo primero que quiere saber un dueño: si esto le sirve. */}
      {pedidos.cuantos > 0 && (
        <div className="pedidos-caja">
          <strong>{pedidos.cuantos}</strong>
          <span>
            {pedidos.cuantos === 1 ? 'persona pidió tus datos' : 'personas pidieron tus datos'} en los últimos 30 días.
            {' '}Cada una te llegó por correo apenas lo hizo.
          </span>
        </div>
      )}

      {/* Las tours, arriba de todo lo demas para el operador: es lo unico que
          tiene para hacer acá. Para un hotel es un extra, y va igual — un
          hotel que vende un tour de aguas termales existe. */}
      <Link href={`/negocio/${negocio.id}/tours`} className="comercio-atajo">
        <div>
          <strong>Mis tours</strong>
          <span>Cargá lo que vendés: precio, qué incluye y una foto de cada una.</span>
        </div>
        <span className="comercio-atajo-flecha" aria-hidden="true">→</span>
      </Link>

      <FormularioNegocio negocio={negocio} />

      <DatosFiscales negocioId={negocio.id} nombreComercial={negocio.nombre} datos={fiscales} />

      <Fotos
        negocioId={negocio.id}
        destinoBabosa={negocio.destino_babosa}
        negocioBabosa={negocio.babosa}
        fotos={fotos}
      />

      {negocio.estado_publicacion === 'publicado' && (
        <Resenas negocioId={negocio.id} resenas={resenas} />
      )}
    </>
  );
}
