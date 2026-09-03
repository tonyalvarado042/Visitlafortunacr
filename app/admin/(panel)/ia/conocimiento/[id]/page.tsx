import { notFound } from 'next/navigation';
import { contextoPanel } from '@/lib/admin/contexto';
import { relativo } from '@/lib/admin/formato';
import { Cabecera } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { eliminarConocimiento } from '../../acciones';
import { FormularioConocimiento } from '../Formulario';

export const dynamic = 'force-dynamic';

export default async function PaginaFicha({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { destino, db } = await contextoPanel('ia');
  const [{ data: k }, { data: negocios }] = await Promise.all([
    db.from('dst_conocimiento').select('*').eq('id', id).eq('destino_id', destino.id).maybeSingle(),
    db.from('dst_negocio').select('id, nombre').eq('destino_id', destino.id).order('nombre'),
  ]);
  if (!k) notFound();
  return (
    <>
      <Cabecera titulo={k.titulo} migas={[{ ruta: '/admin/ia', nombre: 'Inteligencia' }, { ruta: '/admin/ia/conocimiento', nombre: 'Conocimiento' }]} sub={`${k.tipo} · actualizada ${relativo(k.actualizado_en)}${k.fuente ? ` · fuente: ${k.fuente}` : ''}`}>
        <form action={eliminarConocimiento}><input type="hidden" name="id" value={id} /><BotonAccion clase="boton peligro" confirmar="¿Borrar esta ficha del conocimiento?">Borrar</BotonAccion></form>
      </Cabecera>
      <div className="tarjeta">
        <FormularioConocimiento fila={k} idiomas={destino.idiomas} principal={destino.idioma_principal} negocios={negocios ?? []} />
      </div>
    </>
  );
}
