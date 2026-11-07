import { notFound } from 'next/navigation';
import Link from 'next/link';
import { EditorRico } from '@/componentes/EditorRico';
import { contextoPanel } from '@/lib/admin/contexto';
import { Aviso, Cabecera, Etiqueta, Vacio } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { editarTour, subirFotoTour, moverFotoTour, marcarPortadaTour, borrarFotoTour, pedirCompletarTour, pedirRevisionDeTour } from '../acciones';
import { relativo } from '@/lib/admin/formato';
import { MINIMO_FOTOS_TOUR } from '@/lib/comercio';

export const dynamic = 'force-dynamic';

export default async function PaginaTour({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { destino, db } = await contextoPanel('tours');
  const { data: t } = await db.from('dst_tour').select('*').eq('id', id).eq('destino_id', destino.id).maybeSingle();
  if (!t) notFound();
  /* La babosa del operador. La necesita el subidor de fotos: la ruta en el
     almacén es <destino>/<negocio>/tours/… y la política de storage solo deja
     escribir dentro de la carpeta del destino al que uno tiene acceso. */
  const { data: fotos } = await db.from('dst_tour_foto')
    .select('id, url, es_portada, orden, credito, licencia').eq('tour_id', id).order('orden');
  const { data: operador } = t.negocio_id
    ? await db.from('dst_negocio').select('babosa, email, nombre').eq('id', t.negocio_id).maybeSingle()
    : { data: null };
  /* Lo que le falta al tour para poder publicarse y venderse. El precio
     cuenta: sin él `tour_reservable` no devuelve nada y la caja de reservar
     no sale — ver la nota de ese RPC. */
  const faltan = [
    /* Menos de las que necesita, no «ninguna». Con el chequeo en cero los dos
       tours de Jacamar —publicados, con UNA foto cada uno— salían como si no
       les faltara nada, y el botón de pedírselas no aparecía. */
    (fotos?.length ?? 0) < MINIMO_FOTOS_TOUR && (fotos?.length ? 'más fotos' : 'las fotos'),
    !String(t.descripcion ?? '').trim() && 'la descripción',
    !(Number(t.precio_adulto_usd) > 0) && 'el precio',
  ].filter(Boolean) as string[];
  /* Las tres cifras que el correo de revisión le muestra JUNTAS: lo que paga
     el viajero, lo que se le gira y la comisión. Si el neto no es el rack
     menos la comisión, el operador recibiría tres números que se contradicen
     y el correo quita la confianza que venía a dar — así que el botón no se
     ofrece y la cabecera dice por qué. Un botón que se sabe que va a rebotar
     es peor que ninguno.
     Medio punto de tolerancia porque los netos están redondeados a centavos:
     99.44 − 74.58 = 24.86, que es 25.0% justo, pero no todos caen tan
     redondo. */
  const rack = Number(t.precio_adulto_usd);
  const neto = t.precio_neto_usd != null ? Number(t.precio_neto_usd) : null;
  const comision = t.comision_pct != null ? Number(t.comision_pct) : null;
  const pctImplicita = rack > 0 && neto != null ? ((rack - neto) / rack) * 100 : null;
  const cifrasCuadran =
    pctImplicita == null || comision == null || Math.abs(pctImplicita - comision) <= 0.5;
  /* Para la confirmación del botón: que quien lo aprieta vea los mismos
     números que le van a llegar al operador, no un «¿seguro?» a ciegas.
     `Number` y no `toFixed(0)`: Outback firmó 12.60% y 22.80%. */
  const resumenTarifas = [
    rack > 0 ? `rack $${rack.toFixed(2)}` : null,
    neto != null ? `neto $${neto.toFixed(2)}` : null,
    comision != null ? `comisión ${Number(comision)}%` : null,
  ].filter(Boolean).join(', ') || 'todavía sin tarifas cargadas';
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
      <Cabecera titulo={t.nombre} migas={[{ ruta: '/admin/tours', nombre: 'Tours' }]} sub={<><Etiqueta suave>{t.estado}</Etiqueta>{t.completar_pedido_en ? <> <Etiqueta suave>se le pidió {relativo(t.completar_pedido_en)}</Etiqueta></> : null}{t.revisar_pedido_en ? <> <Etiqueta suave>revisión pedida {relativo(t.revisar_pedido_en)}</Etiqueta></> : null}{faltan.length ? <> <Etiqueta color="alerta">le falta {faltan.join(' y ')}</Etiqueta></> : null}{!cifrasCuadran ? <> <Etiqueta color="alerta">las cifras no cuadran: rack menos neto da {pctImplicita!.toFixed(1)}% y el tour dice {Number(comision)}%</Etiqueta></> : null} · {t.total_reservas} reservas</>}>
        {/* Ver el tour en el sitio. Regla de Tony: toda ficha lleva su enlace
            para mirarla directamente — si no, revisar lo que uno acaba de
            escribir obliga a adivinar la dirección. Solo si está publicado:
            un enlace a algo que no se sirve lleva a un 404 y hace dudar de si
            el tour existe. */}
        {/* Pedirle al operador lo que falta. El correo lo lleva DIRECTO a la
            pantalla de este tour en su portal, no a la raíz de su cuenta:
            mandarlo a buscar cuál de sus cuatro tours es, es como se pierde a
            alguien que estaba dispuesto a hacerlo.
            Sin correo del operador no se ofrece: un botón que no puede hacer
            nada es peor que ninguno. */}
        {faltan.length > 0 && operador?.email && (
          <form action={pedirCompletarTour}>
            <input type="hidden" name="id" value={id} />
            <BotonAccion
              confirmar={`Se le manda un correo a ${operador.email} pidiéndole ${faltan.join(' y ')} de «${t.nombre}». El enlace lo lleva directo a este tour en su cuenta. ¿Lo mando?`}
            >
              {t.completar_pedido_en ? 'Volver a pedírselo' : `Pedirle ${faltan.join(' y ')}`}
            </BotonAccion>
          </form>
        )}

        {/* A la par del otro, y hace otra cosa: ese pide lo que FALTA, este
            sirve cuando no falta nada — que mire lo que ya se publica y
            confirme los números antes de que entre la primera reserva. Un
            operador que descubre la comisión cuando le llega la liquidación
            se enoja con razón, y ese enojo cuesta más que la comisión.
            No se ofrece sin correo del operador, ni cuando las tres cifras no
            cuadran: el correo las muestra juntas y mandar una contradicción
            quita la confianza que venía a dar. El por qué sale arriba, en la
            cabecera, para que no parezca que el botón se perdió. */}
        {operador?.email && cifrasCuadran && (
          <form action={pedirRevisionDeTour}>
            <input type="hidden" name="id" value={id} />
            <BotonAccion
              confirmar={`Se le manda un correo a ${operador.email} con lo que se publica de «${t.nombre}» y las tarifas —${resumenTarifas}— para que lo confirme o lo corrija. El enlace lo lleva directo a este tour en su cuenta. ¿Lo mando?`}
            >
              {t.revisar_pedido_en ? 'Volver a pedirle que revise' : 'Pedirle que revise info y tarifas'}
            </BotonAccion>
          </form>
        )}

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
                {/* La letra chica del precio. La ficha muestra «$101» a secas,
                    y un precio de verdad casi nunca es un número solo: el
                    tarifario de Outback va +13% de IVA, y un cuadraciclo se
                    cobra POR VEHÍCULO, no por persona. Sin esta nota el sitio
                    muestra una cifra que no es la que se paga. */}
                <div className="campo ancho"><label>Letra chica del precio</label>
                  <textarea name="precio_nota" defaultValue={t.precio_nota ?? ''} style={{ minHeight: 90 }}
                            placeholder={'+13% de IVA · Precio por persona · Salidas: 8:00 y 10:00 a. m.'} />
                  <small>Sale debajo del precio en la ficha. Impuestos, si es por persona o por vehículo, otras tarifas, horarios. Una línea por renglón.</small>
                </div>
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

      {/* ⚠️ LA GALERÍA VIVE FUERA DEL FORMULARIO GRANDE, y no es cosmético:
          HTML NO PERMITE FORMULARIOS ANIDADOS. Estaba dentro del <form> de
          editar, el navegador se comía los de adentro al parsear, y cada
          botón de foto —subir, mover, portada, borrar— terminaba mandando
          el formulario de afuera. O sea GUARDABA el tour en vez de tocar la
          foto. Sin error y sin aviso: simplemente no hacía nada.

          Mismo motivo por el que las fotos de un negocio viven fuera de su
          formulario. Si algún día esto vuelve adentro, vuelve a romperse. */}
        {/* La GALERÍA del tour.
            Antes el tour tenía UNA foto y nada más, cuando el tour es
            justo lo que se vende —y lo único que publica un operador—.
            Quien está decidiendo si paga $99 por una clase de cocina
            quiere ver más de una.
            Es el mismo bloque que el de un negocio a propósito: quien ya
            sabe mover las fotos de una ficha no tiene que aprender otra
            cosa. */}
        <div className="tarjeta">
          <h2>Fotos <small>la primera manda: es la que se ve en las tarjetas</small></h2>
          {!operador?.babosa ? (
            <Aviso tipo="info">
              Para subir fotos hay que elegir primero el <strong>operador</strong> arriba y guardar.
              Las fotos se guardan en la carpeta de ese operador.
            </Aviso>
          ) : (
            <>
              {!fotos?.length ? <Vacio texto="Sin fotos todavía." /> : (
                <div className="rejilla-fotos">
                  {fotos.map((f, i) => (
                    <div key={f.id} className="foto-admin">
                      <a href={f.url} target="_blank" rel="noreferrer">
                        <img src={f.url} alt="" className={f.es_portada ? 'es-portada' : ''} />
                      </a>
                      <div className="foto-pie">
                        {f.es_portada && <span className="marca-portada">Portada</span>}
                      </div>
                      {(f.credito || f.licencia) && (
                        <p className="gris foto-credito">
                          {f.credito}{f.licencia ? ` · ${f.licencia}` : ''}
                        </p>
                      )}
                      <div className="acciones-fila">
                        {/* El id y el paso viajan JUNTOS en el value: un
                            botón manda un solo par nombre/valor, así que
                            un campo `paso` suelto valdría lo mismo para
                            subir que para bajar. */}
                        <form action={moverFotoTour}>
                          <input type="hidden" name="id" value={id} />
                          <button type="submit" name="foto_mover" value={`${f.id}|-1`}
                                  className="boton tenue" disabled={i === 0}
                                  aria-label="Mover antes">&#9664;</button>
                          <button type="submit" name="foto_mover" value={`${f.id}|1`}
                                  className="boton tenue" disabled={i === (fotos?.length ?? 0) - 1}
                                  aria-label="Mover después">&#9654;</button>
                        </form>
                        {!f.es_portada && (
                          <form action={marcarPortadaTour}>
                            <input type="hidden" name="id" value={id} />
                            <input type="hidden" name="foto_id" value={f.id} />
                            <BotonAccion clase="boton tenue">Portada</BotonAccion>
                          </form>
                        )}
                        <form action={borrarFotoTour}>
                          <input type="hidden" name="id" value={id} />
                          <input type="hidden" name="foto_id" value={f.id} />
                          <BotonAccion clase="boton tenue" confirmar="Se borra la foto y su archivo. No se puede deshacer.">Borrar</BotonAccion>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* El crédito y la licencia se piden ACÁ y no después, que
                  es cuando ya nadie se acuerda de dónde salió la imagen. */}
              <form action={subirFotoTour} className="subir-foto">
                <input type="hidden" name="id" value={id} />
                <div className="campo">
                  <label>Agregar fotos <small style={{ fontWeight: 400, color: '#8B8B87' }}>podés elegir varias de un solo</small></label>
                  <input type="file" name="archivo" accept="image/jpeg,image/png,image/webp,image/avif" multiple required />
                </div>
                <div className="campo"><label>Qué se ve (texto alternativo)</label><input name="texto_alternativo" placeholder={t.nombre} /></div>
                <div className="campo"><label>Autor</label><input name="credito" placeholder="Vacío si la foto es nuestra o del operador" /></div>
                <div className="campo"><label>Licencia</label><input name="licencia" placeholder="Cedida por el operador…" /></div>
                <div className="campo"><label>Enlace de origen</label><input name="fuente_url" placeholder="https://…" /></div>
                <p className="gris" style={{ fontSize: 12, margin: '6px 0 10px' }}>
                  Si ponés enlace de origen, el autor y la licencia son obligatorios, y se
                  aplican a TODAS las que subas de un saque. Cada una se redimensiona a
                  1600 px y se convierte a webp. Si alguna falla, las demás entran igual.
                </p>
                <BotonAccion>Subir fotos</BotonAccion>
              </form>
            </>
          )}
        </div>
    </>
  );
}
