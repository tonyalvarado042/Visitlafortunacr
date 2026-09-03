import { notFound } from 'next/navigation';
import { contextoPanel } from '@/lib/admin/contexto';
import { MODELOS_DISPONIBLES } from '@/lib/ia/modelos';
import { Cabecera, Aviso } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { editarAgente } from '../../acciones';

export const dynamic = 'force-dynamic';

export default async function PaginaAgente({ params }: { params: Promise<{ clave: string }> }) {
  const { clave } = await params;
  const { destino, db, usuario } = await contextoPanel('ia');
  const { data: a } = await db.from('dst_agente').select('*').eq('destino_id', destino.id).eq('clave', clave).maybeSingle();
  if (!a) notFound();
  const { data: equipo } = await db.from('dst_usuario').select('id, nombre').eq('esta_activo', true).order('nombre');
  const soloLectura = usuario.rol !== 'admin';

  return (
    <>
      <Cabecera titulo={`${a.nombre} · ${a.clave}`} migas={[{ ruta: '/admin/ia', nombre: 'Inteligencia' }]} sub={`Versión ${a.version} · ${a.modelo} · esfuerzo ${a.esfuerzo}`} />
      {soloLectura && <Aviso tipo="info">Solo un administrador puede cambiar la configuración de los agentes.</Aviso>}
      <form action={editarAgente}>
        <input type="hidden" name="id" value={a.id} />
        <input type="hidden" name="clave" value={a.clave} />
        <div className="lado">
          <div className="tarjeta">
            <h2>Instrucciones del equipo <small>se suman al prompt base del código</small></h2>
            <div className="campos" style={{ gridTemplateColumns: '1fr' }}>
              <div className="campo"><label>Instrucciones</label><textarea name="instrucciones" defaultValue={a.instrucciones ?? ''} style={{ minHeight: 220 }} disabled={soloLectura} placeholder="Horarios de atención, políticas, qué ofrecer primero, qué nunca decir…" /></div>
              <div className="campo"><label>Tono</label><input name="tono" defaultValue={a.tono ?? ''} disabled={soloLectura} placeholder="Cálido y directo, tuteando, sin emojis" /></div>
            </div>
          </div>
          <div>
            <div className="tarjeta">
              <h2>Modelo</h2>
              <div className="campos" style={{ gridTemplateColumns: '1fr' }}>
                <div className="campo"><label>Nombre visible</label><input name="nombre" defaultValue={a.nombre} disabled={soloLectura} /></div>
                <div className="campo"><label>Modelo</label><select name="modelo" defaultValue={a.modelo} disabled={soloLectura}>{MODELOS_DISPONIBLES.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
                <div className="campo"><label>Esfuerzo (más = mejor y más caro)</label><select name="esfuerzo" defaultValue={a.esfuerzo} disabled={soloLectura}>{['low', 'medium', 'high', 'xhigh', 'max'].map((e) => <option key={e} value={e}>{e}</option>)}</select></div>
                <div className="campo"><label>Máximo de tokens de salida</label><input type="number" name="max_tokens" min={256} max={64000} defaultValue={a.max_tokens} disabled={soloLectura} /></div>
                <div className="campo"><label>Máximo de iteraciones con herramientas</label><input type="number" name="max_iteraciones" min={1} max={20} defaultValue={a.max_iteraciones} disabled={soloLectura} /></div>
              </div>
            </div>
            <div className="tarjeta">
              <h2>Escalar a una persona</h2>
              <div className="campos" style={{ gridTemplateColumns: '1fr' }}>
                <div className="campo"><label><input type="checkbox" name="puede_escalar" value="1" defaultChecked={a.puede_escalar} disabled={soloLectura} /> Puede pasar la conversación a una persona</label></div>
                <div className="campo"><label>A quién</label><select name="escala_a" defaultValue={a.escala_a ?? ''} disabled={soloLectura}><option value="">Sin asignar (queda en la bandeja)</option>{equipo?.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select></div>
                <div className="campo"><label><input type="checkbox" name="esta_activo" value="1" defaultChecked={a.esta_activo} disabled={soloLectura} /> Agente encendido</label></div>
              </div>
              {!soloLectura && <div className="pie-formulario"><BotonAccion>Guardar</BotonAccion></div>}
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
