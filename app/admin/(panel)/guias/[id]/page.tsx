import Link from 'next/link';
import { notFound } from 'next/navigation';
import { contextoPanel } from '@/lib/admin/contexto';
import { fecha } from '@/lib/admin/formato';
import { Cabecera, Etiqueta } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { editarGuia } from '../acciones';

export const dynamic = 'force-dynamic';

export default async function PaginaGuia({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { destino, db } = await contextoPanel('guias');
  const { data: g } = await db.from('dst_guia').select('*').eq('id', id).eq('destino_id', destino.id).maybeSingle();
  if (!g) notFound();
  const { data: enlaces } = await db.from('dst_guia_negocio').select('orden, negocio:dst_negocio(id, nombre)').eq('guia_id', id).order('orden');
  const uno = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);
  const palabras = (g.cuerpo ?? '').split(/\s+/).filter(Boolean).length;

  return (
    <>
      <Cabecera titulo={g.titulo} migas={[{ ruta: '/admin/guias', nombre: 'Guías' }]} sub={<><Etiqueta suave>{g.estado}</Etiqueta> · {g.tipo} · {palabras} palabras · {g.total_vistas} vistas{g.publicado_en ? ` · publicada ${fecha(g.publicado_en, destino.zona_horaria, false)}` : ''}</>} />
      <form action={editarGuia}>
        <input type="hidden" name="id" value={id} />
        <div className="lado">
          <div className="tarjeta">
            <div className="campos">
              <div className="campo ancho"><label>Título</label><input name="titulo" defaultValue={g.titulo} required /></div>
              <div className="campo ancho"><label>Entradilla</label><textarea name="entradilla" defaultValue={g.entradilla ?? ''} style={{ minHeight: 60 }} /></div>
              <div className="campo ancho"><label>Cuerpo (Markdown)</label><textarea name="cuerpo" defaultValue={g.cuerpo ?? ''} style={{ minHeight: 520, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13 }} /></div>
            </div>
          </div>
          <div>
            <div className="tarjeta">
              <h2>Publicación</h2>
              <div className="campos" style={{ gridTemplateColumns: '1fr' }}>
                <div className="campo"><label>Estado</label><select name="estado" defaultValue={g.estado}>{['borrador', 'pendiente', 'publicado', 'archivado'].map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
                <div className="campo"><label>Tipo</label><select name="tipo" defaultValue={g.tipo}>{['guia', 'itinerario', 'comparativa', 'como_llegar', 'lista'].map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
                <div className="campo"><label>Público</label><select name="publico" defaultValue={g.publico ?? ''}><option value="">Todos</option>{['pareja', 'familia', 'amigos', 'solo', 'grupo', 'negocios'].map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
                <div className="campo"><label>Días (si es itinerario)</label><input type="number" name="dias" min={1} max={30} defaultValue={g.dias ?? ''} /></div>
                <div className="campo"><label>Babosa (URL)</label><input name="babosa" defaultValue={g.babosa} /></div>
                <div className="campo"><label>Imagen (URL)</label><input name="imagen_url" defaultValue={g.imagen_url ?? ''} /></div>
              </div>
              <div className="pie-formulario"><BotonAccion>Guardar</BotonAccion></div>
            </div>
            <div className="tarjeta">
              <h2>SEO</h2>
              <div className="campos" style={{ gridTemplateColumns: '1fr' }}>
                <div className="campo"><label>Meta título ({(g.meta_titulo ?? '').length}/60)</label><input name="meta_titulo" defaultValue={g.meta_titulo ?? ''} maxLength={70} /></div>
                <div className="campo"><label>Meta descripción ({(g.meta_desc ?? '').length}/155)</label><textarea name="meta_desc" defaultValue={g.meta_desc ?? ''} maxLength={170} style={{ minHeight: 70 }} /></div>
              </div>
            </div>
            <div className="tarjeta">
              <h2>Negocios mencionados</h2>
              {!enlaces?.length ? <p className="gris" style={{ color: '#8B8B87', margin: 0 }}>Ninguno enlazado.</p> : enlaces.map((e, i) => { const n = uno(e.negocio) as { id: string; nombre: string } | null; return n ? <div key={i}><Link href={`/admin/negocios/${n.id}`}>{n.nombre}</Link></div> : null; })}
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
