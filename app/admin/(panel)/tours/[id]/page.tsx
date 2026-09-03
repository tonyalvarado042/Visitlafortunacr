import { notFound } from 'next/navigation';
import { contextoPanel } from '@/lib/admin/contexto';
import { Cabecera, Etiqueta } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { editarTour } from '../acciones';

export const dynamic = 'force-dynamic';

export default async function PaginaTour({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { destino, db } = await contextoPanel('tours');
  const { data: t } = await db.from('dst_tour').select('*').eq('id', id).eq('destino_id', destino.id).maybeSingle();
  if (!t) notFound();
  const [{ data: operadores }, { data: categorias }, { data: salidas }] = await Promise.all([
    db.from('dst_negocio').select('id, nombre').eq('destino_id', destino.id).neq('estado_publicacion', 'archivado').order('nombre'),
    db.from('dst_destino_categoria').select('orden, categoria:dst_categoria(id, nombre, seccion)').eq('destino_id', destino.id).order('orden'),
    db.from('dst_tour_salida').select('id, sale_el, hora, cupo_total, cupo_tomado, precio_usd, esta_abierta').eq('tour_id', id).gte('sale_el', new Date().toISOString().slice(0, 10)).order('sale_el').limit(30),
  ]);
  const uno = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);
  const cats = (categorias ?? []).map((c) => uno(c.categoria) as { id: string; nombre: string; seccion: string } | null).filter((c): c is { id: string; nombre: string; seccion: string } => !!c);

  return (
    <>
      <Cabecera titulo={t.nombre} migas={[{ ruta: '/admin/tours', nombre: 'Tours' }]} sub={<><Etiqueta suave>{t.estado}</Etiqueta> · {t.total_reservas} reservas</>} />
      <form action={editarTour}>
        <input type="hidden" name="id" value={id} />
        <div className="lado">
          <div>
            <div className="tarjeta">
              <h2>Ficha</h2>
              <div className="campos">
                <div className="campo ancho"><label>Nombre</label><input name="nombre" defaultValue={t.nombre} required /></div>
                <div className="campo"><label>Operador</label><select name="negocio_id" defaultValue={t.negocio_id ?? ''}><option value="">—</option>{operadores?.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select></div>
                <div className="campo"><label>Categoría</label><select name="categoria_id" defaultValue={t.categoria_id ?? ''}><option value="">—</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.nombre} · {c.seccion}</option>)}</select></div>
                <div className="campo ancho"><label>Resumen</label><input name="resumen" defaultValue={t.resumen ?? ''} maxLength={200} /></div>
                <div className="campo ancho"><label>Descripción</label><textarea name="descripcion" defaultValue={t.descripcion ?? ''} style={{ minHeight: 120 }} /></div>
                <div className="campo"><label>Incluye</label><textarea name="incluye" defaultValue={t.incluye ?? ''} style={{ minHeight: 70 }} /></div>
                <div className="campo"><label>No incluye</label><textarea name="no_incluye" defaultValue={t.no_incluye ?? ''} style={{ minHeight: 70 }} /></div>
                <div className="campo ancho"><label>Qué llevar</label><input name="que_llevar" defaultValue={t.que_llevar ?? ''} /></div>
              </div>
            </div>
            <div className="tarjeta">
              <h2>Logística</h2>
              <div className="campos">
                <div className="campo"><label>Duración (horas)</label><input type="number" step="0.5" name="duracion_horas" defaultValue={t.duracion_horas ?? ''} /></div>
                <div className="campo"><label>Hora de inicio</label><input type="time" name="hora_inicio" defaultValue={t.hora_inicio ?? ''} /></div>
                <div className="campo"><label>Dificultad</label><select name="dificultad" defaultValue={t.dificultad ?? ''}><option value="">—</option>{['facil', 'moderada', 'exigente'].map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
                <div className="campo"><label>Edad mínima</label><input type="number" name="edad_minima" defaultValue={t.edad_minima ?? ''} /></div>
                <div className="campo"><label>Cupo máximo</label><input type="number" name="cupo_maximo" defaultValue={t.cupo_maximo ?? ''} /></div>
                <div className="campo"><label>Idiomas del guía (coma)</label><input name="idiomas_guia" defaultValue={(t.idiomas_guia ?? []).join(', ')} placeholder="es, en" /></div>
                <div className="campo"><label>Cancelación libre (horas antes)</label><input type="number" name="cancelacion_libre_horas" defaultValue={t.cancelacion_libre_horas ?? ''} /></div>
                <div className="campo"><label>Imagen (URL)</label><input name="imagen_url" defaultValue={t.imagen_url ?? ''} /></div>
                <div className="campo ancho"><label><input type="checkbox" name="recoge_en_hotel" value="1" defaultChecked={!!t.recoge_en_hotel} /> Recoge en el hotel</label></div>
              </div>
            </div>
          </div>
          <div>
            <div className="tarjeta">
              <h2>Precio y comisión</h2>
              <div className="campos" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="campo"><label>Adulto USD</label><input type="number" step="0.01" name="precio_adulto_usd" defaultValue={t.precio_adulto_usd ?? ''} required /></div>
                <div className="campo"><label>Niño USD</label><input type="number" step="0.01" name="precio_nino_usd" defaultValue={t.precio_nino_usd ?? ''} /></div>
                <div className="campo"><label>Neto al operador USD</label><input type="number" step="0.01" name="precio_neto_usd" defaultValue={t.precio_neto_usd ?? ''} /></div>
                <div className="campo"><label>Comisión %</label><input type="number" step="0.5" name="comision_pct" defaultValue={t.comision_pct ?? ''} /></div>
              </div>
            </div>
            <div className="tarjeta">
              <h2>Publicación</h2>
              <div className="campos" style={{ gridTemplateColumns: '1fr' }}>
                <div className="campo"><label>Estado</label><select name="estado" defaultValue={t.estado}>{['borrador', 'pendiente', 'publicado', 'archivado'].map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
                <div className="campo"><label><input type="checkbox" name="es_destacado" value="1" defaultChecked={t.es_destacado} /> Destacado</label></div>
              </div>
              <div className="pie-formulario"><BotonAccion>Guardar</BotonAccion></div>
            </div>
            <div className="tarjeta">
              <h2>Próximas salidas</h2>
              {!salidas?.length ? <p className="gris" style={{ color: '#8B8B87', margin: 0 }}>Sin salidas cargadas: el equipo confirma disponibilidad a mano.</p> : (
                <table className="tabla"><tbody>{salidas.map((s) => <tr key={s.id}><td>{s.sale_el} {s.hora ?? ''}</td><td className="num">{s.cupo_tomado}/{s.cupo_total}</td><td>{s.esta_abierta ? 'abierta' : 'cerrada'}</td></tr>)}</tbody></table>
              )}
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
