import { notFound } from 'next/navigation';
import { contextoPanel } from '@/lib/admin/contexto';
import { ACCION, DISPARADOR } from '@/lib/admin/formato';
import { Cabecera } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { editarAutomatizacion } from '../../acciones';

export const dynamic = 'force-dynamic';

export default async function PaginaAutomatizacion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { destino, db } = await contextoPanel('ia');
  const { data: a } = await db.from('dst_automatizacion').select('*').eq('id', id).eq('destino_id', destino.id).maybeSingle();
  if (!a) notFound();
  return (
    <>
      <Cabecera titulo={a.nombre} migas={[{ ruta: '/admin/ia', nombre: 'Inteligencia' }, { ruta: '/admin/ia/automatizaciones', nombre: 'Automatizaciones' }]} sub={`clave ${a.clave}`} />
      <form action={editarAutomatizacion}>
        <input type="hidden" name="id" value={id} />
        <div className="lado">
          <div className="tarjeta">
            <div className="campos">
              <div className="campo ancho"><label>Nombre</label><input name="nombre" defaultValue={a.nombre} required /></div>
              <div className="campo ancho"><label>Descripción</label><input name="descripcion" defaultValue={a.descripcion ?? ''} /></div>
              <div className="campo"><label>Cuándo</label><select name="disparador" defaultValue={a.disparador}>{Object.entries(DISPARADOR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div className="campo"><label>Qué hace</label><select name="accion" defaultValue={a.accion}>{Object.entries(ACCION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div className="campo ancho"><label>Condiciones (JSON)</label><textarea name="condiciones" defaultValue={JSON.stringify(a.condiciones, null, 2)} style={{ fontFamily: 'ui-monospace, monospace', minHeight: 90 }} /><div className="ayuda">horas · dias · hora · etapa · etapas [] · tipos [] · temperatura</div></div>
              <div className="campo ancho"><label>Parámetros (JSON)</label><textarea name="parametros" defaultValue={JSON.stringify(a.parametros, null, 2)} style={{ fontFamily: 'ui-monospace, monospace', minHeight: 90 }} /><div className="ayuda">plantilla · agente · intento · titulo · prioridad · etapa · motivo · aunque_cerrada</div></div>
            </div>
          </div>
          <div className="tarjeta">
            <div className="campos" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="campo"><label>Retraso (horas)</label><input type="number" step="0.5" name="retraso_horas" defaultValue={a.retraso_horas} /></div>
              <div className="campo"><label>Máximo por lead</label><input type="number" name="maximo_por_solicitud" min={1} max={20} defaultValue={a.maximo_por_solicitud} /></div>
              <div className="campo"><label>Orden</label><input type="number" name="orden" defaultValue={a.orden} /></div>
            </div>
            <div className="campos" style={{ gridTemplateColumns: '1fr', marginTop: 10 }}>
              <div className="campo"><label><input type="checkbox" name="requiere_aprobacion" value="1" defaultChecked={a.requiere_aprobacion} /> Una persona aprueba antes de enviar</label></div>
              <div className="campo"><label><input type="checkbox" name="esta_activa" value="1" defaultChecked={a.esta_activa} /> Activa</label></div>
            </div>
            <div className="pie-formulario"><BotonAccion>Guardar</BotonAccion></div>
          </div>
        </div>
      </form>
    </>
  );
}
