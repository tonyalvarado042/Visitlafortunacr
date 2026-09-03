-- Plataforma de destinos | 10: categorias del destino y negocio por babosa
-- Las categorias encendidas de un destino, traducidas y con cuantos negocios
-- publicados tiene cada una. Se cuenta en la base y no en el sitio porque un
-- menu con siete secciones haria siete consultas de conteo por pagina.

create or replace function destinos.categorias_del_destino(
  p_destino_id uuid,
  p_idioma     char(2) default null
) returns table (
  categoria_id uuid,
  babosa       text,
  nombre       text,
  seccion      text,
  orden        smallint,
  total        bigint
)
language sql stable security definer set search_path = '' as $$
  with idi as (
    select coalesce(p_idioma, (select idioma_principal from destinos.dst_destino where id = p_destino_id)) as codigo
  )
  select c.id,
         coalesce(
           (select r.babosa from destinos.dst_ruta r
             where r.destino_id = p_destino_id and r.entidad = 'categoria'
               and r.entidad_id = c.id and r.idioma = (select codigo from idi) and r.es_vigente
             limit 1),
           c.babosa),
         coalesce(
           dc.nombre_local,
           destinos.texto_en('categoria', c.id, 'nombre', (select codigo from idi), c.nombre)
         ),
         c.seccion,
         dc.orden,
         count(n.id)
    from destinos.dst_destino_categoria dc
    join destinos.dst_categoria c on c.id = dc.categoria_id
    left join destinos.dst_negocio n
           on n.categoria_id = c.id
          and n.destino_id = p_destino_id
          and n.estado_publicacion = 'publicado'
          and not n.esta_cerrado
   where dc.destino_id = p_destino_id
     and dc.es_visible
   group by c.id, c.babosa, c.nombre, c.seccion, dc.orden, dc.nombre_local
   order by c.seccion, dc.orden;
$$;

comment on function destinos.categorias_del_destino is
  'Las categorias que ese destino tiene encendidas, con el nombre en el idioma pedido y cuantos negocios publicados hay en cada una. El conteo permite ocultar del menu las categorias vacias, que es lo que hace que un destino recien lanzado no se vea hueco.';

grant execute on function destinos.categorias_del_destino to anon, authenticated;

-- Un negocio por su babosa en cualquier idioma, con su ficha completa
create or replace function destinos.negocio_por_babosa(
  p_dominio text,
  p_babosa  text,
  p_idioma  char(2) default null
) returns table (
  id uuid, categoria_babosa text, categoria_nombre text, seccion text,
  nombre text, babosa text, resumen text, descripcion text, como_llegar text,
  logo_url text, email text, telefono text, telefono_whatsapp text, sitio_web text,
  direccion text, latitud numeric, longitud numeric,
  rango_precio destinos.rango_precio, precio_desde_usd numeric,
  estado_verificacion destinos.estado_verificacion, es_destacado boolean,
  atributos jsonb, total_resenas integer, promedio_calificacion numeric
)
language sql stable security definer set search_path = '' as $$
  with d as (
    select * from destinos.dst_destino where dominio = p_dominio and esta_activo
  ), idi as (
    select coalesce(p_idioma, (select idioma_principal from d)) as codigo
  ), encontrado as (
    select n.*
      from destinos.dst_negocio n
      join d on d.id = n.destino_id
     where n.estado_publicacion = 'publicado'
       and not n.esta_cerrado
       and (
         n.babosa = p_babosa
         or exists (
           select 1 from destinos.dst_ruta r
            where r.destino_id = n.destino_id and r.entidad = 'negocio'
              and r.entidad_id = n.id and r.babosa = p_babosa and r.es_vigente
         )
       )
     limit 1
  )
  select e.id,
         coalesce(
           (select r.babosa from destinos.dst_ruta r
             where r.destino_id = e.destino_id and r.entidad = 'categoria'
               and r.entidad_id = c.id and r.idioma = (select codigo from idi) and r.es_vigente
             limit 1), c.babosa),
         destinos.texto_en('categoria', c.id, 'nombre', (select codigo from idi), c.nombre),
         c.seccion,
         e.nombre,
         coalesce(
           (select r.babosa from destinos.dst_ruta r
             where r.destino_id = e.destino_id and r.entidad = 'negocio'
               and r.entidad_id = e.id and r.idioma = (select codigo from idi) and r.es_vigente
             limit 1), e.babosa),
         destinos.texto_en('negocio', e.id, 'resumen',     (select codigo from idi), e.resumen),
         destinos.texto_en('negocio', e.id, 'descripcion', (select codigo from idi), e.descripcion),
         destinos.texto_en('negocio', e.id, 'como_llegar', (select codigo from idi), e.como_llegar),
         e.logo_url, e.email, e.telefono, e.telefono_whatsapp, e.sitio_web,
         e.direccion, e.latitud, e.longitud, e.rango_precio, e.precio_desde_usd,
         e.estado_verificacion, e.es_destacado, e.atributos,
         e.total_resenas, e.promedio_calificacion
    from encontrado e
    join destinos.dst_categoria c on c.id = e.categoria_id;
$$;

comment on function destinos.negocio_por_babosa is
  'Busca por la babosa de CUALQUIER idioma y devuelve la ficha en el idioma pedido. Asi /en/hotels/don-rufino y /es/hoteles/don-rufino llegan al mismo negocio aunque la babosa cambie entre idiomas.';

grant execute on function destinos.negocio_por_babosa to anon, authenticated;
