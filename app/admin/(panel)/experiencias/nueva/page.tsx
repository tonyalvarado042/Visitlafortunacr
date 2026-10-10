import { contextoPanel } from '@/lib/admin/contexto';
import { Cabecera } from '@/componentes/admin/ui';
import { FormularioExperiencia } from '../FormularioExperiencia';

export const dynamic = 'force-dynamic';

export default async function NuevaExperiencia() {
  await contextoPanel('experiencias');

  return (
    <>
      <Cabecera
        titulo="Nueva experiencia"
        sub="Nace en borrador. No se ve en el sitio hasta que la marqués publicada."
      />
      <div className="tarjeta">
        <FormularioExperiencia
          exp={{
            id: null,
            titulo: '',
            babosa: '',
            subtitulo: null,
            resumen: null,
            cuerpo_html: null,
            dias: 7,
            noches: 6,
            personas: 2,
            precio_desde_usd: null,
            imagen_url: null,
            zonas: [],
            incluye: [],
            no_incluye: [],
            orden: 0,
            es_publico: false,
          }}
        />
      </div>
    </>
  );
}
