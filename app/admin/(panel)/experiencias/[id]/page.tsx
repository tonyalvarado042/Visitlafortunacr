import { notFound } from 'next/navigation';
import { contextoPanel } from '@/lib/admin/contexto';
import { Cabecera } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { FormularioExperiencia } from '../FormularioExperiencia';
import { borrarExperiencia } from '../acciones';

export const dynamic = 'force-dynamic';

export default async function EditarExperiencia({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { destino, db, usuario } = await contextoPanel('experiencias');

  const { data } = await db
    .from('dst_itinerario')
    .select('id, titulo, babosa, subtitulo, resumen, cuerpo_html, dia_a_dia_html, atracciones_html, dias, noches, personas, precio_desde_usd, imagen_url, zonas, incluye, no_incluye, ideal_para, orden, es_publico')
    .eq('id', id)
    .eq('destino_id', destino.id)
    .eq('generado_por', 'equipo')
    .maybeSingle();

  if (!data) notFound();

  const urlPublica = `/${destino.idioma_principal}/experiencias/${data.babosa}`;

  return (
    <>
      <Cabecera
        titulo={data.titulo}
        sub={data.es_publico ? `Publicada · ${urlPublica}` : 'Borrador · no se ve en el sitio'}
      />

      <div className="lado">
        <div className="tarjeta">
          <FormularioExperiencia
            exp={{
              id: data.id,
              titulo: data.titulo,
              babosa: data.babosa,
              subtitulo: data.subtitulo,
              resumen: data.resumen,
              cuerpo_html: data.cuerpo_html,
              dia_a_dia_html: data.dia_a_dia_html,
              atracciones_html: data.atracciones_html,
              dias: data.dias,
              noches: data.noches,
              personas: data.personas,
              precio_desde_usd: data.precio_desde_usd === null ? null : Number(data.precio_desde_usd),
              imagen_url: data.imagen_url,
              zonas: data.zonas ?? [],
              ideal_para: data.ideal_para ?? [],
              incluye: data.incluye ?? [],
              no_incluye: data.no_incluye ?? [],
              orden: data.orden ?? 0,
              es_publico: data.es_publico,
            }}
          />
        </div>

        <div>
          {data.es_publico && (
            <div className="tarjeta">
              <h2>Verla</h2>
              <a className="boton" href={urlPublica} target="_blank" rel="noreferrer">
                Abrir en el sitio ↗
              </a>
            </div>
          )}

          {usuario.rol === 'admin' && (
            <div className="tarjeta">
              <h2>Borrarla</h2>
              <p className="gris" style={{ fontSize: 13, lineHeight: 1.55 }}>
                Se va del sitio y del panel. Las consultas que ya entraron se
                quedan en Leads: son de gente de verdad y no se borran con esto.
              </p>
              <form action={borrarExperiencia}>
                <input type="hidden" name="id" value={data.id} />
                <BotonAccion clase="boton-linea" confirmar="¿Seguro? Esto no se puede deshacer.">
                  Borrar experiencia
                </BotonAccion>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
