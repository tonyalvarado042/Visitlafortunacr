import { notFound } from 'next/navigation';
import { contextoPanel } from '@/lib/admin/contexto';
import { Cabecera } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { eliminarPlantilla, guardarPlantilla } from '../../acciones';

export const dynamic = 'force-dynamic';

export default async function PaginaPlantilla({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { destino, db } = await contextoPanel('ia');
  const { data: p } = await db.from('dst_plantilla_mensaje').select('*').eq('id', id).eq('destino_id', destino.id).maybeSingle();
  if (!p) notFound();
  return (
    <>
      <Cabecera titulo={`${p.clave} · ${p.canal} · ${p.idioma}`} migas={[{ ruta: '/admin/ia', nombre: 'Inteligencia' }, { ruta: '/admin/ia/plantillas', nombre: 'Plantillas' }]}>
        <form action={eliminarPlantilla}><input type="hidden" name="id" value={id} /><BotonAccion clase="boton peligro" confirmar="¿Borrar esta plantilla?">Borrar</BotonAccion></form>
      </Cabecera>
      <div className="tarjeta" style={{ maxWidth: 760 }}>
        <form action={guardarPlantilla} className="campos" style={{ gridTemplateColumns: '1fr' }}>
          <input type="hidden" name="id" value={id} />
          {p.canal === 'email' && <div className="campo"><label>Asunto</label><input name="asunto" defaultValue={p.asunto ?? ''} /></div>}
          <div className="campo"><label>Cuerpo</label><textarea name="cuerpo" defaultValue={p.cuerpo} required style={{ minHeight: 180 }} /></div>
          <div className="campo"><label><input type="checkbox" name="esta_activa" value="1" defaultChecked={p.esta_activa} /> Activa</label></div>
          <BotonAccion>Guardar</BotonAccion>
        </form>
      </div>
    </>
  );
}
