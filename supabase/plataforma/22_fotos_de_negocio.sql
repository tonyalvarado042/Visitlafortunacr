-- Plataforma de destinos | 22: las fotos de las fichas y su credito
--
-- La tabla dst_negocio_foto existe desde la migracion 02 y nunca se uso: el
-- sitio pintaba un degradado con el color de la seccion. Esta migracion la
-- pone a trabajar y agrega lo que faltaba para poder mostrar una foto ajena
-- sin problema: de quien es, con que licencia, y adonde enlaza.
--
-- Por que tres columnas y no una de texto libre:
--   - CC BY y CC BY-SA exigen cuatro cosas concretas: autor, titulo, licencia
--     y enlace. Metidas en un solo campo de texto no se pueden mostrar
--     distinto en la tarjeta y en la ficha, ni auditar cuales faltan.
--   - `es_generica` es la mas importante de las tres y no tiene que ver con
--     licencias: dice si la foto es DEL negocio o solo ilustra su categoria.
--     Una foto de aguas termales cualquiera en la ficha de Ecotermales, sin
--     marcar, es decirle al viajero algo que no es cierto. Marcada, el sitio
--     la puede usar de fondo y no como retrato.
--
-- Cuando llegue GOOGLE_PLACES_API_KEY, las fotos reales entran con
-- es_generica = false y desplazan a estas sin borrar nada.

-- ---------------------------------------------------------------------------
-- 1. De quien es la foto
-- ---------------------------------------------------------------------------

alter table destinos.dst_negocio_foto add column if not exists licencia    text;
alter table destinos.dst_negocio_foto add column if not exists fuente_url  text;
alter table destinos.dst_negocio_foto add column if not exists es_generica boolean not null default false;

comment on column destinos.dst_negocio_foto.licencia is
  'La licencia bajo la que se puede mostrar: CC0, CC BY 4.0, CC BY-SA 4.0, dominio publico, o "cedida por el negocio". Si esta vacia y credito tambien, la foto es propia. Sin uno de los dos, no se publica: el credito no es una licencia, pero la licencia sin credito tampoco alcanza cuando la licencia lo exige.';
comment on column destinos.dst_negocio_foto.fuente_url is
  'Enlace a la pagina de origen del archivo. CC BY y CC BY-SA lo exigen junto con el autor; para una foto propia va vacio.';
comment on column destinos.dst_negocio_foto.es_generica is
  'true = la foto ilustra la categoria, no retrata a este negocio. El sitio la muestra de fondo y nunca la presenta como una imagen del lugar. false = es una foto real de este negocio. Es lo que evita que una piscina cualquiera pase por la piscina de este hotel.';

-- Las de antes tenian comentario viejo; se corrige el de credito.
comment on column destinos.dst_negocio_foto.credito is
  'A quien hay que nombrar: el autor. Obligatorio si la licencia lo exige (CC BY, CC BY-SA) o si la foto no es del dueno del negocio. Vacio solo en fotos propias.';

-- Si la foto no es propia, tiene que decir de quien es y con que licencia.
alter table destinos.dst_negocio_foto drop constraint if exists ck_dst_foto_credito;
alter table destinos.dst_negocio_foto add constraint ck_dst_foto_credito
  check (fuente_url is null or (credito is not null and licencia is not null));

create index if not exists idx_dst_foto_portada
  on destinos.dst_negocio_foto (negocio_id, es_portada) where es_portada;

-- La 02 creo la tabla y la 11 dio permisos a todo lo que existia ese dia, asi
-- que esta ya los tiene. Se repiten por si acaso: son idempotentes.
grant select on destinos.dst_negocio_foto to anon;
grant select, insert, update, delete on destinos.dst_negocio_foto to authenticated;
grant all on destinos.dst_negocio_foto to service_role;

-- ---------------------------------------------------------------------------
-- 2. La portada, en la vista publica
-- ---------------------------------------------------------------------------
-- negocios_publicados es lo que alimenta la portada, el listado y la busqueda.
-- Tiene `returns table (...)` explicito, asi que agregarle una columna es
-- reemplazar la funcion entera. Va al final para no mover el orden de las que
-- ya estaban: el sitio las lee por nombre, pero un cambio de orden en medio
-- es la clase de cosa que rompe callado.

drop function if exists destinos.negocios_publicados(text, char(2));

create or replace function destinos.negocios_publicados(p_dominio text, p_idioma char(2) default null)
returns table (
  id uuid, destino_id uuid, categoria_id uuid,
  categoria_babosa text, categoria_nombre text, seccion text,
  nombre text, babosa text, resumen text, descripcion text,
  logo_url text, email text, telefono text, telefono_whatsapp text, sitio_web text,
  direccion text, latitud numeric, longitud numeric,
  rango_precio destinos.rango_precio, precio_desde_usd numeric,
  estado_verificacion destinos.estado_verificacion, es_destacado boolean,
  membresia destinos.nivel_membresia, atributos jsonb,
  total_resenas integer, promedio_calificacion numeric,
  foto_portada_url text, foto_portada_generica boolean
)
language sql stable security definer set search_path = '' as $func$
  with d as (
    select * from destinos.dst_destino where dominio = p_dominio and esta_activo
  ), idi as (
    select coalesce(p_idioma, (select idioma_principal from d)) as codigo
  )
  select n.id, n.destino_id, n.categoria_id,
         coalesce(
           (select r.babosa from destinos.dst_ruta r
             where r.destino_id = n.destino_id and r.entidad = 'categoria'
               and r.entidad_id = c.id and r.idioma = (select codigo from idi) and r.es_vigente
             limit 1),
           c.babosa) as categoria_babosa,
         destinos.texto_en('categoria', c.id, 'nombre', (select codigo from idi), c.nombre) as categoria_nombre,
         c.seccion,
         n.nombre,
         coalesce(
           (select r.babosa from destinos.dst_ruta r
             where r.destino_id = n.destino_id and r.entidad = 'negocio'
               and r.entidad_id = n.id and r.idioma = (select codigo from idi) and r.es_vigente
             limit 1),
           n.babosa) as babosa,
         destinos.texto_en('negocio', n.id, 'resumen',     (select codigo from idi), n.resumen)     as resumen,
         destinos.texto_en('negocio', n.id, 'descripcion', (select codigo from idi), n.descripcion) as descripcion,
         n.logo_url, n.email, n.telefono, n.telefono_whatsapp, n.sitio_web,
         n.direccion, n.latitud, n.longitud,
         n.rango_precio, n.precio_desde_usd,
         n.estado_verificacion, n.es_destacado, n.membresia, n.atributos,
         n.total_resenas, n.promedio_calificacion,
         -- La portada marcada; si no hay ninguna marcada, la primera por orden.
         -- Una foto real del negocio le gana siempre a una generica.
         f.url, f.es_generica
    from destinos.dst_negocio n
    join d on d.id = n.destino_id
    join destinos.dst_categoria c on c.id = n.categoria_id
    left join lateral (
      select ff.url, ff.es_generica
        from destinos.dst_negocio_foto ff
       where ff.negocio_id = n.id
       order by ff.es_generica asc, ff.es_portada desc, ff.orden asc, ff.creado_en asc
       limit 1
    ) f on true
   where n.estado_publicacion = 'publicado' and not n.esta_cerrado;
$func$;

comment on function destinos.negocios_publicados is
  'Los negocios publicados de un dominio, ya resueltos al idioma pedido: cada texto cae a su traduccion si existe y al idioma principal si no. Desde la migracion 22 devuelve tambien la foto de portada y si esa foto es generica, para que la tarjeta sepa si esta mostrando el lugar o solo ilustrando su categoria.';

grant execute on function destinos.negocios_publicados to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. La galeria de la ficha, con su credito
-- ---------------------------------------------------------------------------

create or replace function destinos.fotos_de_negocio(
  p_negocio_id uuid,
  p_idioma     char(2) default null
) returns table (
  url                text,
  texto_alternativo  text,
  credito            text,
  licencia           text,
  fuente_url         text,
  es_generica        boolean,
  es_portada         boolean
) language sql stable security definer set search_path = '' as $func$
  select f.url,
         case when coalesce(p_idioma, 'es') = 'es'
              then coalesce(f.texto_alternativo_es, f.texto_alternativo_en)
              else coalesce(f.texto_alternativo_en, f.texto_alternativo_es)
         end,
         f.credito, f.licencia, f.fuente_url, f.es_generica, f.es_portada
    from destinos.dst_negocio_foto f
    join destinos.dst_negocio n on n.id = f.negocio_id
   where f.negocio_id = p_negocio_id
     and n.estado_publicacion = 'publicado'
   order by f.es_generica asc, f.es_portada desc, f.orden asc, f.creado_en asc;
$func$;

comment on function destinos.fotos_de_negocio is
  'La galeria de una ficha, ordenada: primero las fotos reales del negocio, dentro de esas la portada, y al final las genericas de categoria. Devuelve el credito, la licencia y el enlace de origen porque CC BY y CC BY-SA exigen mostrarlos junto a la imagen, no en una pagina aparte.';

grant execute on function destinos.fotos_de_negocio to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Que el panel pueda subir con la sesion del usuario
-- ---------------------------------------------------------------------------
-- El bucket "negocios" ya esta creado (publico, tope 10 MB, solo imagenes).
-- Lo que falta son las politicas de storage.objects: sin ellas, subir desde el
-- panel solo funcionaria con la clave de servicio, y el backend manda que el
-- panel use la sesion del usuario para que la auditoria sepa quien fue.
--
-- La ruta de cada archivo es <destino-babosa>/<negocio-babosa>/<archivo>, asi
-- que el primer segmento dice de que destino es y con eso alcanza para decidir.

drop policy if exists "cualquiera ve las fotos de negocios" on storage.objects;
create policy "cualquiera ve las fotos de negocios" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'negocios');

drop policy if exists "el equipo sube fotos de sus destinos" on storage.objects;
create policy "el equipo sube fotos de sus destinos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'negocios'
    and exists (
      select 1 from destinos.dst_destino d
       where d.babosa = (storage.foldername(name))[1]
         and destinos.tiene_acceso_a(d.id)
    )
  );

drop policy if exists "el equipo reemplaza fotos de sus destinos" on storage.objects;
create policy "el equipo reemplaza fotos de sus destinos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'negocios'
    and exists (
      select 1 from destinos.dst_destino d
       where d.babosa = (storage.foldername(name))[1]
         and destinos.tiene_acceso_a(d.id)
    )
  );

drop policy if exists "el equipo borra fotos de sus destinos" on storage.objects;
create policy "el equipo borra fotos de sus destinos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'negocios'
    and exists (
      select 1 from destinos.dst_destino d
       where d.babosa = (storage.foldername(name))[1]
         and destinos.tiene_acceso_a(d.id)
    )
  );
