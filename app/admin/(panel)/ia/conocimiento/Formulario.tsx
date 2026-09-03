import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { guardarConocimiento } from '../acciones';

type Fila = {
  id?: string; tipo?: string; titulo?: string; contenido?: string; idioma?: string; etiquetas?: string[] | null; prioridad?: number;
  para_concierge?: boolean; para_planificador?: boolean; fuente?: string | null; esta_verificado?: boolean; esta_activo?: boolean;
  vigente_hasta?: string | null; negocio_id?: string | null;
};

export function FormularioConocimiento({ fila, idiomas, principal, negocios, volver }: {
  fila: Fila; idiomas: string[]; principal: string; negocios: { id: string; nombre: string }[]; volver?: string;
}) {
  return (
    <form action={guardarConocimiento} className="campos">
      {fila.id && <input type="hidden" name="id" value={fila.id} />}
      {volver && <input type="hidden" name="volver" value={volver} />}
      <div className="campo ancho"><label>Título</label><input name="titulo" defaultValue={fila.titulo ?? ''} required maxLength={200} /></div>
      <div className="campo ancho"><label>Contenido (lo que la IA va a saber, con datos concretos)</label><textarea name="contenido" defaultValue={fila.contenido ?? ''} required style={{ minHeight: 140 }} /></div>
      <div className="campo"><label>Tipo</label><select name="tipo" defaultValue={fila.tipo ?? 'dato'}>{[['dato', 'Dato del destino'], ['faq', 'Pregunta frecuente'], ['politica', 'Política nuestra'], ['guion', 'Guion de ventas'], ['regla', 'Regla para la IA'], ['aviso', 'Aviso temporal'], ['negocio', 'Sobre un negocio'], ['tour', 'Sobre un tour']].map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></div>
      <div className="campo"><label>Idioma</label><select name="idioma" defaultValue={fila.idioma ?? principal}>{idiomas.map((i) => <option key={i} value={i}>{i}</option>)}</select></div>
      <div className="campo"><label>Prioridad (7+ va siempre en el prompt)</label><input type="number" name="prioridad" min={0} max={10} defaultValue={fila.prioridad ?? 0} /></div>
      <div className="campo"><label>Vigente hasta (avisos temporales)</label><input type="date" name="vigente_hasta" defaultValue={fila.vigente_hasta ?? ''} /></div>
      <div className="campo ancho"><label>Etiquetas (coma)</label><input name="etiquetas" defaultValue={(fila.etiquetas ?? []).join(', ')} placeholder="termales, precios, familia" /></div>
      <div className="campo"><label>Fuente</label><input name="fuente" defaultValue={fila.fuente ?? ''} placeholder="sitio oficial, llamada al negocio, equipo…" /></div>
      <div className="campo"><label>Negocio relacionado</label><select name="negocio_id" defaultValue={fila.negocio_id ?? ''}><option value="">—</option>{negocios.map((n) => <option key={n.id} value={n.id}>{n.nombre}</option>)}</select></div>
      <div className="campo ancho acciones-fila">
        <label><input type="checkbox" name="para_concierge" value="1" defaultChecked={fila.para_concierge ?? true} /> Lo usa el concierge</label>
        <label><input type="checkbox" name="para_planificador" value="1" defaultChecked={fila.para_planificador ?? true} /> Lo usa el planificador</label>
        <label><input type="checkbox" name="esta_verificado" value="1" defaultChecked={fila.esta_verificado ?? false} /> Verificado por el equipo</label>
        <label><input type="checkbox" name="esta_activo" value="1" defaultChecked={fila.esta_activo ?? true} /> Activo</label>
      </div>
      <div className="campo ancho"><BotonAccion>{fila.id ? 'Guardar' : 'Agregar al conocimiento'}</BotonAccion></div>
    </form>
  );
}
