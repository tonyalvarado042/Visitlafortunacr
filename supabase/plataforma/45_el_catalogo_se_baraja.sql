-- 45. El catálogo que ve la IA se baraja, para que no se note la preferencia.
--
-- ⚠️ POR QUÉ. Tony, 10 de noviembre de 2026:
--
--   «quiero que recomiende bike and bed y también otros que son destacados
--    que yo selecciono, pero debería ser aleatorio para que no se note que
--    tengo preferencia sobre algunos»
--
-- Hasta hoy el catálogo salía SIEMPRE EN EL MISMO ORDEN:
--
--   order by n.es_destacado desc, n.promedio_calificacion desc nulls last, n.nombre
--
-- Y eso no es neutral aunque el prompt diga que lo sea. Un modelo elige más lo
-- que lee primero —es sesgo de posición, está medido— así que el primer
-- destacado de la lista salía en todos los planes, todos los días. Con el
-- tiempo eso se ve: el mismo hotel en cada itinerario.
--
-- Ahora los destacados SIGUEN YENDO PRIMERO —son la lista de Tony y para eso
-- están— pero BARAJADOS ENTRE SÍ. Igual los no destacados entre sí.
--
-- ⚠️ LA SEMILLA ES EL DÍA, NO LA PETICIÓN, Y ES A PROPÓSITO.
-- El catálogo va dentro del prompt que se manda con caché de Anthropic
-- (`sistemaCacheado`). Si el orden cambiara en cada llamada, el prompt
-- cambiaría en cada llamada y el caché no pegaría NUNCA: cada plan pagaría el
-- catálogo entero a precio lleno. Con la semilla del día, dentro de un mismo
-- día el prompt es idéntico —el caché funciona— y de un día al otro el orden
-- rota. La preferencia se diluye en el tiempo, que es donde se notaba.
--
-- Si algún día se quiere por petición, se le agrega un parámetro de semilla.
-- OJO al hacerlo: un parámetro con DEFAULT crea una SEGUNDA función y
-- PostgREST contesta «could not choose the best candidate». Ya pasó con
-- `opciones_de_tour`. Por eso esto va con CREATE OR REPLACE y la MISMA firma.
--
-- La nota y las reseñas siguen en cada línea del catálogo, así que la IA puede
-- preferir lo bien calificado por el DATO y no por la POSICIÓN, que es como
-- debería haber sido siempre.

-- La semilla: la fecha de HOY en la zona horaria del destino.
--
-- Va en su propia función y no inline por dos razones. Una, que la usan el
-- bloque de negocios y el de tours y tienen que coincidir. Dos, que así se
-- puede mirar qué semilla está corriendo —`select destinos.semilla_del_dia(id)`—
-- cuando alguien pregunte por qué hoy sale este hotel y ayer salía otro.
--
-- La zona horaria del destino, no UTC: en Costa Rica (UTC-6) el día cambia a
-- las 6 de la tarde si se usa UTC, así que un plan pedido a las 7 p.m. veía
-- el orden de mañana. Con la zona del destino, el orden cambia a medianoche
-- de verdad.
create or replace function destinos.semilla_del_dia(p_destino_id uuid)
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select to_char(
    now() at time zone coalesce(
      (select d.zona_horaria from destinos.dst_destino d where d.id = p_destino_id),
      'UTC'),
    'YYYY-MM-DD');
$$;

create or replace function destinos.contexto_destino(
  p_destino_id uuid,
  p_idioma character default 'es'::bpchar,
  p_max_negocios integer default 200
)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'destino', (
      select jsonb_build_object(
        'id', d.id, 'nombre', d.nombre, 'nombre_largo', d.nombre_largo, 'pais', d.pais_nombre, 'region', d.region,
        'zona_horaria', d.zona_horaria, 'moneda', d.moneda_iso, 'moneda_visitante', d.moneda_visitante,
        'idioma_principal', d.idioma_principal, 'idiomas', d.idiomas, 'whatsapp', d.whatsapp,
        'email', d.email_contacto, 'lema', destinos.texto_en('destino', d.id, 'lema', p_idioma, d.lema),
        'dominio', d.dominio, 'marca', d.marca_nombre, 'latitud', d.latitud, 'longitud', d.longitud)
      from destinos.dst_destino d where d.id = p_destino_id),
    'categorias', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'babosa', c.babosa, 'seccion', c.seccion,
        'nombre', destinos.texto_en('categoria', c.id, 'nombre', p_idioma, c.nombre)) order by dc.orden), '[]'::jsonb)
      from destinos.dst_destino_categoria dc
      join destinos.dst_categoria c on c.id = dc.categoria_id
      where dc.destino_id = p_destino_id and dc.es_visible),
    'negocios', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', n.id, 'nombre', n.nombre, 'categoria', c.babosa, 'seccion', c.seccion,
        'resumen', destinos.texto_en('negocio', n.id, 'resumen', p_idioma, n.resumen),
        'rango_precio', n.rango_precio, 'precio_desde_usd', n.precio_desde_usd,
        'calificacion', n.promedio_calificacion, 'resenas', n.total_resenas,
        'verificado', n.estado_verificacion = 'verificado', 'destacado', n.es_destacado,
        'direccion', n.direccion, 'latitud', n.latitud, 'longitud', n.longitud,
        'whatsapp', n.telefono_whatsapp, 'telefono', n.telefono, 'sitio_web', n.sitio_web,
        'url', '/' || p_idioma || '/' || destinos.babosa_en('categoria', c.id, p_idioma, c.babosa)
               || '/' || destinos.babosa_en('negocio', n.id, p_idioma, n.babosa)
      )
      -- Destacados primero, barajados dentro de cada grupo. Ver la nota de arriba.
      order by n.es_destacado desc,
               md5(n.id::text || destinos.semilla_del_dia(p_destino_id)),
               n.nombre), '[]'::jsonb)
      from (
        -- El corte a p_max_negocios SÍ va por calificación: si algún día hay
        -- más de 200, los que se quedan afuera tienen que ser los peores, no
        -- los que la suerte mandó al final.
        select * from destinos.dst_negocio
         where destino_id = p_destino_id and estado_publicacion = 'publicado' and not coalesce(esta_cerrado, false)
         order by es_destacado desc, promedio_calificacion desc nulls last
         limit p_max_negocios
      ) n
      join destinos.dst_categoria c on c.id = n.categoria_id),
    'tours', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id, 'nombre', t.nombre, 'resumen', t.resumen, 'duracion_horas', t.duracion_horas,
        'hora_inicio', t.hora_inicio, 'dificultad', t.dificultad, 'edad_minima', t.edad_minima,
        'precio_adulto_usd', t.precio_adulto_usd, 'precio_nino_usd', t.precio_nino_usd,
        'recoge_en_hotel', t.recoge_en_hotel, 'idiomas_guia', t.idiomas_guia, 'incluye', t.incluye,
        'operador', n.nombre, 'negocio_id', t.negocio_id, 'destacado', t.es_destacado
      ) order by t.es_destacado desc,
                 md5(t.id::text || destinos.semilla_del_dia(p_destino_id)),
                 t.nombre), '[]'::jsonb)
      from destinos.dst_tour t
      left join destinos.dst_negocio n on n.id = t.negocio_id
      where t.destino_id = p_destino_id and t.estado = 'publicado'),
    'conocimiento', (
      select coalesce(jsonb_agg(jsonb_build_object('tipo', k.tipo, 'titulo', k.titulo, 'contenido', k.contenido, 'fuente', k.fuente)
                                order by k.prioridad desc), '[]'::jsonb)
      from destinos.conocimiento_base(p_destino_id, 'planificador', 5::smallint) k)
  );
$function$;

comment on function destinos.contexto_destino(uuid, character, integer) is
  'El catálogo que ve la IA. Destacados primero, barajados dentro de cada grupo con la semilla del día: ver 45_el_catalogo_se_baraja.sql.';
