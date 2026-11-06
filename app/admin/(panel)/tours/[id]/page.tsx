import { notFound } from 'next/navigation';
import Link from 'next/link';
import { EditorRico } from '@/componentes/EditorRico';
import { contextoPanel } from '@/lib/admin/contexto';
import { Aviso, Cabecera, Etiqueta } from '@/componentes/admin/ui';
import { FotoTour } from '@/app/negocio/[id]/tours/FotoTour';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { editarTour } from '../acciones';

export const dynamic = 'force-dynamic';

export default async function PaginaTour({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { destino, db } = await contextoPanel('tours');
  const { data: t } = await db.from('dst_tour').select('*').eq('id', id).eq('destino_id', destino.id).maybeSingle();
  if (!t) notFound();
  /* La babosa del operador. La necesita el subidor de fotos: la ruta en el
     almacén es <destino>/<negocio>/tours/… y la política de storage solo deja
     escribir dentro de la carpeta del destino al que uno tiene acceso. */
  const { data: operador } = t.negocio_id
    ? await db.from('dst_negocio').select('babosa').eq('id', t.negocio_id).maybeSingle()
    : { data: null };
  /* Solo los contratos DEL OPERADOR de esta tour. La base tiene un disparador
     que rechaza un contrato de otro negocio, asi que ofrecer los demas seria
     ofrecer un error: la lista se arma con los que de verdad se pueden pegar. */
  const [{ data: operadores }, { data: categorias }, { data: salidas }, { data: contratos }] = await Promise.all([
    db.from('dst_negocio').select('id, nombre').eq('destino_id', destino.id).neq('estado_publicacion', 'archivado').order('nombre'),
    db.from('dst_destino_categoria').select('orden, categoria:dst_categoria(id, nombre, seccion)').eq('destino_id', destino.id).order('orden'),
    db.from('dst_tour_salida').select('id, sale_el, hora, cupo_total, cupo_tomado, precio_usd, esta_abierta').eq('tour_id', id).gte('sale_el', new Date().toISOString().slice(0, 10)).order('sale_el').limit(30),
    t.negocio_id
      ? db.from('dst_contrato').select('id, nombre, esta_activo, vigencia_hasta, comision_tipo, comision_valor')
          .eq('destino_id', destino.id).eq('negocio_id', t.negocio_id).order('creado_en', { ascending: false })
      : Promise.resolve({ data: [] as { id: string; nombre: string; esta_activo: boolean; vigencia_hasta: string | null; comision_tipo: string; comision_valor: number | null }[] }),
  ]);
  const uno = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);
  const cats = (categorias ?? []).map((c) => uno(c.categoria) as { id: string; nombre: string; seccion: string } | null).filter((c): c is { id: string; nombre: string; seccion: string } => !!c);

  return (
    <>
      <Cabecera titulo={t.nombre} migas={[{ ruta: '/admin/tours', nombre: 'Tours' }]} sub={<><Etiqueta suave>{t.estado}</Etiqueta> · {t.total_reservas} reservas</>}>
        {/* Ver el tour en el sitio. Regla de Tony: toda ficha lleva su enlace
            para mirarla directamente — si no, revisar lo que uno acaba de
            escribir obliga a adivinar la dirección. Solo si está publicado:
            un enlace a algo que no se sirve lleva a un 404 y hace dudar de si
            el tour existe. */}
        {t.estado === 'publicado' && t.babosa && (
          <a className="boton secundario" target="_blank" rel="noreferrer"
             href={`https://${destino.dominio}/${destino.idioma_principal}/tour/${t.babosa}`}>
            Ver el tour ↗
          </a>
        )}
      </Cabecera>
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
                <div className="campo ancho">
                  <EditorRico
                    nombre="descripcion"
                    etiqueta="Descripción"
                    valor={t.descripcion}
                    ayuda="Es lo que lee quien está decidiendo si va"
                    filas={10}
                  />
                </div>
                <div className="campo"><label>Incluye</label><textarea name="incluye" defaultValue={t.incluye ?? ''} style={{ minHeight: 70 }} /></div>
                <div className="campo"><label>No incluye</label><textarea name="no_incluye" defaultValue={t.no_incluye ?? ''} style={{ minHeight: 70 }} /></div>
                <div className="campo ancho"><label>Qué llevar</label><input name="que_llevar" defaultValue={t.que_llevar ?? ''} /></div>
              </div>
            </div>
            {/* La foto del tour, con su botón.
                ANTES ERA UNA CAJA DE TEXTO pidiendo una URL, y encima enterrada
                dentro de «Logística» — una foto no es logística, así que ni se
                encontraba. Tony la buscó y concluyó que los tours no tenían
                fotos. Regla de la casa: un campo que pide una foto lleva su
                botón; nadie tiene a mano la dirección de una imagen, tiene la
                foto en el teléfono.
                Es el MISMO componente que usa el dueño en su portal, subiendo
                a la misma carpeta: `<destino>/<negocio>/tours/`. La política
                «el equipo sube fotos de sus destinos» deja escribir ahí a
                quien tiene acceso al destino. */}
            <div className="tarjeta">
              <h2>La foto <small>es lo primero que se ve del tour</small></h2>
              {operador?.babosa ? (
                <FotoTour destinoBabosa={destino.babosa} negocioBabosa={operador.babosa}
                          valor={t.imagen_url} />
              ) : (
                <>
                  <Aviso tipo="info">
                    Para subir una foto hay que elegir primero el <strong>operador</strong> arriba y guardar.
                    La foto se guarda en la carpeta de ese operador.
                  </Aviso>
                  <input type="hidden" name="imagen_url" value={t.imagen_url ?? ''} />
                </>
              )}
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
                <div className="campo"><label>Video (URL) <small style={{ fontWeight: 400, color: '#8B8B87' }}>YouTube, Vimeo o un archivo</small></label><input name="video_url" defaultValue={t.video_url ?? ''} placeholder="https://www.youtube.com/watch?v=…" /></div>
                <div className="campo"><label>Portada del video (URL) <small style={{ fontWeight: 400, color: '#8B8B87' }}>opcional</small></label><input name="video_portada_url" defaultValue={t.video_portada_url ?? ''} placeholder="https://" /></div>
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

              {/* ---- Lo que vuelve vendible una tour ----
                  Sin contrato no hay widget de reserva en la pagina publica:
                  `productos_reservables` solo devuelve lo que tiene contrato
                  activo. Esto no es un dato mas del formulario, es el
                  interruptor — y por eso lleva su propia explicacion. */}
              <div className="campo ancho" style={{ marginTop: 16 }}>
                <label htmlFor="tc">Contrato <small className="gris">sin esto no se puede reservar</small></label>
                {!t.negocio_id ? (
                  <small className="gris">
                    Primero elegí el <strong>operador</strong> y guardá. Los contratos cuelgan
                    del negocio, no de la tour.
                  </small>
                ) : !contratos?.length ? (
                  <small className="gris">
                    Este operador no tiene contratos.{' '}
                    <Link href={`/admin/negocios/${t.negocio_id}`}>Crearle uno</Link> y volver.
                  </small>
                ) : (
                  <>
                    <select id="tc" name="contrato_id" defaultValue={t.contrato_id ?? ''}>
                      <option value="">— sin contrato, no se vende —</option>
                      {contratos.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                          {c.comision_valor != null ? ` · ${c.comision_tipo === 'porcentaje' ? `${c.comision_valor}%` : `$${c.comision_valor}`}` : ''}
                          {c.esta_activo ? '' : ' · APAGADO'}
                        </option>
                      ))}
                    </select>
                    <small className="gris">
                      Con un contrato activo la tour muestra el botón de reservar y entra
                      en el descuento de lanzamiento. Si el contrato está apagado o vencido,
                      el botón desaparece solo.
                    </small>
                  </>
                )}
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
