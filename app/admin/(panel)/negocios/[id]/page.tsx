import Link from 'next/link';
import { notFound } from 'next/navigation';
import { contextoPanel } from '@/lib/admin/contexto';
import { fecha, relativo } from '@/lib/admin/formato';
import { Cabecera, Etiqueta, Vacio } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { editarNegocio, traducirCampo } from '../acciones';

export const dynamic = 'force-dynamic';

export default async function PaginaNegocio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { destino, db } = await contextoPanel('negocios');

  const { data: n } = await db.from('dst_negocio').select('*').eq('id', id).eq('destino_id', destino.id).maybeSingle();
  if (!n) notFound();

  const [{ data: categorias }, { data: traducciones }, { data: externas }, { data: fotos }, { data: leads }] = await Promise.all([
    db.from('dst_destino_categoria').select('orden, categoria:dst_categoria(id, nombre, seccion)').eq('destino_id', destino.id).order('orden'),
    db.from('dst_traduccion').select('campo, idioma, texto, esta_revisada, origen').eq('entidad', 'negocio').eq('entidad_id', id),
    db.from('dst_resena_externa').select('plataforma, calificacion, total_resenas, url_fuente, obtenida_en, expira_en').eq('negocio_id', id),
    db.from('dst_negocio_foto').select('id, url, es_portada, orden').eq('negocio_id', id).order('orden'),
    db.from('dst_solicitud').select('id, tipo, etapa, creado_en').eq('negocio_id', id).order('creado_en', { ascending: false }).limit(10),
  ]);
  const uno = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);
  const cats = (categorias ?? []).map((c) => uno(c.categoria) as { id: string; nombre: string; seccion: string } | null).filter((c): c is { id: string; nombre: string; seccion: string } => !!c);
  const otrosIdiomas = destino.idiomas.filter((i) => i !== destino.idioma_principal);
  const trad = (campo: string, idioma: string) => traducciones?.find((t) => t.campo === campo && t.idioma === idioma);

  return (
    <>
      <Cabecera titulo={n.nombre} migas={[{ ruta: '/admin/negocios', nombre: 'Negocios' }]} sub={<><Etiqueta suave>{n.estado_publicacion}</Etiqueta> <Etiqueta suave>{n.estado_verificacion}</Etiqueta> · {n.membresia} · actualizado {relativo(n.actualizado_en)}</>}>
        {n.estado_publicacion === 'publicado' && <a className="boton secundario" href={`https://${destino.dominio}/${destino.idioma_principal}/${cats.find((c) => c.id === n.categoria_id)?.nombre ? '' : ''}`.replace(/\/$/, '') + `/${destino.idioma_principal}`} target="_blank" rel="noreferrer">Ver sitio ↗</a>}
      </Cabecera>

      <form action={editarNegocio}>
        <input type="hidden" name="id" value={id} />
        <div className="lado">
          <div>
            <div className="tarjeta">
              <h2>Ficha pública <small>en {destino.idioma_principal}</small></h2>
              <div className="campos">
                <div className="campo"><label>Nombre (no se traduce)</label><input name="nombre" defaultValue={n.nombre} required /></div>
                <div className="campo"><label>Categoría</label><select name="categoria_id" defaultValue={n.categoria_id ?? ''}>{cats.map((c) => <option key={c.id} value={c.id}>{c.nombre} · {c.seccion}</option>)}</select></div>
                <div className="campo ancho"><label>Resumen (una frase para tarjetas)</label><input name="resumen" defaultValue={n.resumen ?? ''} maxLength={200} /></div>
                <div className="campo ancho"><label>Descripción (obligatoria para publicar)</label><textarea name="descripcion" defaultValue={n.descripcion ?? ''} style={{ minHeight: 140 }} /></div>
                <div className="campo"><label>Rango de precio</label><select name="rango_precio" defaultValue={n.rango_precio ?? ''}><option value="">—</option>{['economico', 'moderado', 'alto', 'lujo'].map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
                <div className="campo"><label>Precio desde USD</label><input type="number" step="0.01" name="precio_desde_usd" defaultValue={n.precio_desde_usd ?? ''} /></div>
                <div className="campo"><label>Logo (URL)</label><input name="logo_url" defaultValue={n.logo_url ?? ''} /></div>
                <div className="campo"><label>Google Place ID</label><input name="google_place_id" defaultValue={n.google_place_id ?? ''} /></div>
              </div>
            </div>

            <div className="tarjeta">
              <h2>Contacto y ubicación</h2>
              <div className="campos">
                <div className="campo"><label>Correo</label><input type="email" name="email" defaultValue={n.email ?? ''} /></div>
                <div className="campo"><label>Teléfono</label><input name="telefono" defaultValue={n.telefono ?? ''} placeholder="+506…" /></div>
                <div className="campo"><label>WhatsApp</label><input name="telefono_whatsapp" defaultValue={n.telefono_whatsapp ?? ''} placeholder="+506…" /></div>
                <div className="campo"><label>Sitio web</label><input name="sitio_web" defaultValue={n.sitio_web ?? ''} placeholder="https://" /></div>
                <div className="campo ancho"><label>Dirección</label><input name="direccion" defaultValue={n.direccion ?? ''} /></div>
                <div className="campo ancho"><label>Cómo llegar</label><input name="como_llegar" defaultValue={n.como_llegar ?? ''} /></div>
                <div className="campo"><label>Latitud</label><input type="number" step="any" name="latitud" defaultValue={n.latitud ?? ''} /></div>
                <div className="campo"><label>Longitud</label><input type="number" step="any" name="longitud" defaultValue={n.longitud ?? ''} /></div>
              </div>
            </div>

            <div className="tarjeta">
              <h2>Comercial <small>interno, nunca se muestra</small></h2>
              <div className="campos">
                <div className="campo"><label>Membresía</label><select name="membresia" defaultValue={n.membresia}><option value="gratis">Gratis</option><option value="pro">PRO</option><option value="destacado">Destacado</option></select></div>
                <div className="campo"><label>Membresía hasta</label><input type="date" name="membresia_hasta" defaultValue={n.membresia_hasta ?? ''} /></div>
                <div className="campo"><label>Comisión %</label><input type="number" step="0.5" name="comision_pct" defaultValue={n.comision_pct ?? ''} placeholder={`destino: ${destino.comision_por_defecto ?? 0}`} /></div>
                <div className="campo"><label>Contacto comercial</label><input name="contacto_comercial" defaultValue={n.contacto_comercial ?? ''} /></div>
                <div className="campo"><label>Correo de reservas</label><input type="email" name="email_reservas" defaultValue={n.email_reservas ?? ''} /></div>
                <div className="campo ancho"><label>Notas internas</label><textarea name="notas_internas" defaultValue={n.notas_internas ?? ''} style={{ minHeight: 60 }} /></div>
                <div className="campo ancho acciones-fila">
                  <label><input type="checkbox" name="es_destacado" value="1" defaultChecked={n.es_destacado} /> Destacado (se rotula como pagado)</label>
                  <label><input type="checkbox" name="es_casa" value="1" defaultChecked={n.es_casa} /> Es de la casa (interno, nunca se muestra)</label>
                  <label><input type="checkbox" name="esta_cerrado" value="1" defaultChecked={n.esta_cerrado} /> Cerrado temporalmente</label>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="tarjeta">
              <h2>Publicación</h2>
              <div className="campos" style={{ gridTemplateColumns: '1fr' }}>
                <div className="campo"><label>Estado</label><select name="estado_publicacion" defaultValue={n.estado_publicacion}>{['borrador', 'pendiente', 'publicado', 'archivado'].map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
                <div className="campo"><label>Verificación</label><select name="estado_verificacion" defaultValue={n.estado_verificacion}>{['pendiente', 'parcial', 'verificado', 'reclamado'].map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
              </div>
              <dl className="detalle-lista" style={{ marginTop: 10 }}>
                <dt>Fuente</dt><dd>{n.fuente_dato}</dd>
                <dt>Publicado</dt><dd>{n.publicado_en ? fecha(n.publicado_en, destino.zona_horaria) : '—'}</dd>
                <dt>Verificado</dt><dd>{n.verificado_en ? fecha(n.verificado_en, destino.zona_horaria) : '—'}</dd>
                <dt>Reseñas</dt><dd>{n.promedio_calificacion ?? '—'} ({n.total_resenas}) · {n.total_vistas} vistas</dd>
                <dt>Babosa</dt><dd>{n.babosa}</dd>
              </dl>
              <div className="pie-formulario"><BotonAccion>Guardar todo</BotonAccion></div>
            </div>

            <div className="tarjeta">
              <h2>Calificaciones externas</h2>
              {!externas?.length ? <Vacio texto="Sin datos de Google, TripAdvisor o Booking todavía." /> : externas.map((x) => (
                <div key={x.plataforma} style={{ fontSize: 13, marginBottom: 6 }}><strong>{x.plataforma}</strong>: {x.calificacion} ({x.total_resenas}) · <a href={x.url_fuente ?? '#'} target="_blank" rel="noreferrer">fuente</a> <span className="gris">vence {fecha(x.expira_en, destino.zona_horaria, false)}</span></div>
              ))}
            </div>

            <div className="tarjeta">
              <h2>Fotos</h2>
              {!fotos?.length ? <Vacio texto="Sin fotos." /> : <div className="acciones-fila">{fotos.map((f) => <a key={f.id} href={f.url} target="_blank" rel="noreferrer"><img src={f.url} alt="" style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 6, border: f.es_portada ? '2px solid var(--naranja)' : '1px solid #ddd' }} /></a>)}</div>}
            </div>

            {(leads?.length ?? 0) > 0 && (
              <div className="tarjeta">
                <h2>Leads sobre este negocio</h2>
                {leads!.map((l) => <div key={l.id}><Link href={`/admin/leads/${l.id}`}>{l.tipo} · {l.etapa}</Link> <span className="gris">{relativo(l.creado_en)}</span></div>)}
              </div>
            )}
          </div>
        </div>
      </form>

      {otrosIdiomas.length > 0 && (
        <div className="tarjeta">
          <h2>Traducciones <small>si falta una, el sitio muestra el {destino.idioma_principal}</small></h2>
          <div className="campos">
            {(['resumen', 'descripcion'] as const).map((campo) => otrosIdiomas.map((idioma) => {
              const t = trad(campo, idioma);
              return (
                <form action={traducirCampo} key={`${campo}-${idioma}`} className="campo">
                  <input type="hidden" name="entidad" value="negocio" /><input type="hidden" name="entidad_id" value={id} /><input type="hidden" name="campo" value={campo} /><input type="hidden" name="idioma" value={idioma} />
                  <label>{campo} · {idioma} {t ? <Etiqueta suave>{t.origen}{t.esta_revisada ? ' ✓' : ''}</Etiqueta> : null}</label>
                  {campo === 'descripcion' ? <textarea name="texto" defaultValue={t?.texto ?? ''} style={{ minHeight: 90 }} /> : <input name="texto" defaultValue={t?.texto ?? ''} />}
                  <div className="pie-formulario" style={{ marginTop: 6 }}><BotonAccion clase="boton secundario chico">Guardar</BotonAccion></div>
                </form>
              );
            }))}
          </div>
        </div>
      )}
    </>
  );
}
