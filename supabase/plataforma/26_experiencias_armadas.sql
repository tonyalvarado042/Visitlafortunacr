-- =========================================================================
-- 26 · Experiencias armadas: el paquete de varios días que se consulta
--
-- Lo que vende costaricavacations.com y las agencias de acá: un viaje de
-- varios días, con hoteles y tours ya escogidos, un precio POR PERSONA, y
-- un botón que NO cobra — abre una consulta y un asesor contesta.
--
-- No se crea tabla nueva. dst_itinerario ya tiene días, paradas por día,
-- notas en dos idiomas, costo por parada y la bandera es_publico, que para
-- eso estaba. Lo que le faltaba era lo de vender: precio por persona, foto,
-- qué incluye y qué no.
--
-- Cómo se distingue de los itinerarios que arma la IA para un viajero:
--   generado_por = 'equipo'  +  es_publico = true
-- Los del planificador nacen con generado_por = 'planificador' y privados.
-- =========================================================================

alter table destinos.dst_itinerario
  add column if not exists subtitulo         text,
  add column if not exists precio_desde_usd  numeric(10,2),
  add column if not exists imagen_url        text,
  add column if not exists noches            smallint,
  add column if not exists incluye           text[] not null default '{}',
  add column if not exists no_incluye        text[] not null default '{}',
  add column if not exists zonas             text[] not null default '{}',
  add column if not exists orden             smallint not null default 0;

comment on column destinos.dst_itinerario.precio_desde_usd is
  'Precio POR PERSONA en ocupación doble, como lo cotiza toda la industria. '
  'Es un "desde": el precio firme se lo da el asesor, porque cambia con la '
  'temporada y con cuántos van. Vacío = no se muestra precio.';
comment on column destinos.dst_itinerario.noches is
  'Noches de hospedaje. Van aparte de dias porque un viaje de 7 días tiene 6 '
  'noches, y poner "7 noches" en la tarjeta es la clase de error que después '
  'alguien reclama.';
comment on column destinos.dst_itinerario.zonas is
  'Las zonas que recorre, para la tarjeta: {Arenal, Manuel Antonio}. Texto '
  'libre a propósito: el paquete sale de La Fortuna pero pasa por lugares '
  'que no son un destino de la plataforma.';
comment on column destinos.dst_itinerario.no_incluye is
  'Lo que NO entra. Tan importante como lo que sí: el vuelo internacional y '
  'el seguro son la discusión número uno con el viajero.';

create index if not exists idx_dst_itinerario_publico
  on destinos.dst_itinerario (destino_id, orden)
  where es_publico and generado_por = 'equipo';

-- ---------------------------------------------------------------------------
-- La lista, para la página de experiencias
-- ---------------------------------------------------------------------------

create or replace function destinos.experiencias_publicas(
  p_dominio text,
  p_idioma  char(2) default null
) returns table (
  id uuid, babosa text, titulo text, subtitulo text, resumen text,
  dias smallint, noches smallint, personas smallint,
  precio_desde_usd numeric, imagen_url text, zonas text[]
) language sql stable security definer set search_path = '' as $fn$
  with d as (
    select * from destinos.dst_destino where dominio = p_dominio and esta_activo
  ), idi as (
    select coalesce(p_idioma, (select idioma_principal from d)) as codigo
  )
  select i.id, i.babosa,
         destinos.texto_en('itinerario', i.id, 'titulo',    (select codigo from idi), i.titulo),
         destinos.texto_en('itinerario', i.id, 'subtitulo', (select codigo from idi), i.subtitulo),
         destinos.texto_en('itinerario', i.id, 'resumen',   (select codigo from idi), i.resumen),
         i.dias, i.noches, i.personas,
         i.precio_desde_usd, i.imagen_url, i.zonas
    from destinos.dst_itinerario i
    join d on d.id = i.destino_id
   where i.es_publico and i.generado_por = 'equipo'
   order by i.orden, i.creado_en;
$fn$;

comment on function destinos.experiencias_publicas is
  'Las experiencias armadas por el equipo que el sitio muestra, ya resueltas '
  'al idioma pedido. Los itinerarios que la IA arma para un viajero no '
  'aparecen acá: son suyos y son privados.';

-- ---------------------------------------------------------------------------
-- Una experiencia, con todo lo que la ficha necesita
-- ---------------------------------------------------------------------------

create or replace function destinos.experiencia_por_babosa(
  p_dominio text,
  p_babosa  text,
  p_idioma  char(2) default null
) returns table (
  id uuid, babosa text, titulo text, subtitulo text, resumen text, consejos text,
  dias smallint, noches smallint, personas smallint,
  precio_desde_usd numeric, imagen_url text,
  zonas text[], incluye text[], no_incluye text[]
) language sql stable security definer set search_path = '' as $fn$
  with d as (
    select * from destinos.dst_destino where dominio = p_dominio and esta_activo
  ), idi as (
    select coalesce(p_idioma, (select idioma_principal from d)) as codigo
  )
  select i.id, i.babosa,
         destinos.texto_en('itinerario', i.id, 'titulo',    (select codigo from idi), i.titulo),
         destinos.texto_en('itinerario', i.id, 'subtitulo', (select codigo from idi), i.subtitulo),
         destinos.texto_en('itinerario', i.id, 'resumen',   (select codigo from idi), i.resumen),
         destinos.texto_en('itinerario', i.id, 'consejos',  (select codigo from idi), i.consejos),
         i.dias, i.noches, i.personas,
         i.precio_desde_usd, i.imagen_url,
         i.zonas, i.incluye, i.no_incluye
    from destinos.dst_itinerario i
    join d on d.id = i.destino_id
   where i.es_publico and i.generado_por = 'equipo' and i.babosa = p_babosa;
$fn$;

comment on function destinos.experiencia_por_babosa is
  'Una experiencia publicada, por su babosa. Devuelve vacío si no existe o si '
  'no es pública: una ficha en borrador no se ve por adivinar la dirección.';

-- ---------------------------------------------------------------------------
-- El día a día
-- ---------------------------------------------------------------------------

create or replace function destinos.dias_de_experiencia(
  p_itinerario_id uuid,
  p_idioma        char(2) default null
) returns table (
  dia smallint, orden smallint, momento text,
  titulo text, nota text, porque text,
  negocio_nombre text, negocio_babosa text, negocio_categoria text,
  tour_nombre text
) language sql stable security definer set search_path = '' as $fn$
  select p.dia, p.orden, p.momento,
         coalesce(p.titulo_libre, n.nombre, t.nombre) as titulo,
         case when coalesce(p_idioma, 'es') = 'es'
              then coalesce(p.nota_es, p.nota_en, p.nota)
              else coalesce(p.nota_en, p.nota_es, p.nota)
         end as nota,
         p.porque,
         n.nombre, n.babosa,
         c.babosa as negocio_categoria,
         t.nombre
    from destinos.dst_itinerario_parada p
    join destinos.dst_itinerario i on i.id = p.itinerario_id
    left join destinos.dst_negocio n
           on n.id = p.negocio_id and n.estado_publicacion = 'publicado'
    left join destinos.dst_categoria c on c.id = n.categoria_id
    left join destinos.dst_tour t on t.id = p.tour_id
   where p.itinerario_id = p_itinerario_id
     and i.es_publico and i.generado_por = 'equipo'
   order by p.dia, p.orden;
$fn$;

comment on function destinos.dias_de_experiencia is
  'Las paradas día por día. El hotel o el tour se enlazan a su ficha del '
  'directorio cuando siguen publicados; si uno se archivó, la parada queda '
  'con su texto y sin enlace roto.';

grant execute on function destinos.experiencias_publicas(text, char(2))          to anon, authenticated;
grant execute on function destinos.experiencia_por_babosa(text, text, char(2))   to anon, authenticated;
grant execute on function destinos.dias_de_experiencia(uuid, char(2))            to anon, authenticated;
