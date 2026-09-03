-- Plataforma de destinos | 09: mover los textos a la nueva estructura
-- El idioma principal del destino se queda en la fila; los demas pasan a
-- dst_traduccion y dst_ruta. Ningun texto se pierde.

drop view if exists destinos.v_negocio_publicado;

-- ---------------------------------------------------------------------------
-- Categorias
-- ---------------------------------------------------------------------------

insert into destinos.dst_traduccion (entidad, entidad_id, campo, idioma, texto, origen, esta_revisada)
select 'categoria', id, 'nombre', 'en', nombre_en, 'humano', true
  from destinos.dst_categoria where nombre_en is not null;

insert into destinos.dst_traduccion (entidad, entidad_id, campo, idioma, texto, origen, esta_revisada)
select 'categoria', id, 'descripcion', 'en', descripcion_en, 'humano', true
  from destinos.dst_categoria where descripcion_en is not null;

alter table destinos.dst_categoria rename column nombre_es      to nombre;
alter table destinos.dst_categoria rename column descripcion_es to descripcion;
alter table destinos.dst_categoria rename column babosa_es      to babosa;
alter table destinos.dst_categoria drop column nombre_en;
alter table destinos.dst_categoria drop column descripcion_en;

-- La babosa en ingles pasa a ser una ruta; la tabla de rutas necesita destino,
-- asi que las de categoria se registran por destino al encenderlas.
create temporary table _babosa_cat_en as
  select id, babosa_en from destinos.dst_categoria where babosa_en is not null;
alter table destinos.dst_categoria drop column babosa_en;

comment on column destinos.dst_categoria.nombre is
  'Nombre en el idioma base del catalogo (espanol). Las demas lenguas viven en dst_traduccion.';

-- ---------------------------------------------------------------------------
-- Etiquetas
-- ---------------------------------------------------------------------------

insert into destinos.dst_traduccion (entidad, entidad_id, campo, idioma, texto, origen, esta_revisada)
select 'etiqueta', id, 'nombre', 'en', nombre_en, 'humano', true
  from destinos.dst_etiqueta where nombre_en is not null;

alter table destinos.dst_etiqueta rename column nombre_es to nombre;
alter table destinos.dst_etiqueta drop column nombre_en;

-- ---------------------------------------------------------------------------
-- Negocios
-- ---------------------------------------------------------------------------

insert into destinos.dst_traduccion (entidad, entidad_id, campo, idioma, texto, origen, esta_revisada)
select 'negocio', id, 'descripcion', 'en', descripcion_en, 'humano', true
  from destinos.dst_negocio where descripcion_en is not null;

insert into destinos.dst_traduccion (entidad, entidad_id, campo, idioma, texto, origen, esta_revisada)
select 'negocio', id, 'resumen', 'en', resumen_en, 'humano', true
  from destinos.dst_negocio where resumen_en is not null;

insert into destinos.dst_traduccion (entidad, entidad_id, campo, idioma, texto, origen, esta_revisada)
select 'negocio', id, 'como_llegar', 'en', como_llegar_en, 'humano', true
  from destinos.dst_negocio where como_llegar_en is not null;

-- Rutas: la babosa de cada idioma, incluida la del idioma principal
insert into destinos.dst_ruta (destino_id, entidad, entidad_id, idioma, babosa)
select destino_id, 'negocio', id, 'es', babosa_es from destinos.dst_negocio
union all
select destino_id, 'negocio', id, 'en', babosa_en from destinos.dst_negocio
where babosa_en is not null
on conflict do nothing;

drop index if exists destinos.idx_dst_negocio_busq_es;
drop index if exists destinos.idx_dst_negocio_busq_en;
alter table destinos.dst_negocio drop column busqueda_es;
alter table destinos.dst_negocio drop column busqueda_en;

alter table destinos.dst_negocio rename column descripcion_es to descripcion;
alter table destinos.dst_negocio rename column resumen_es     to resumen;
alter table destinos.dst_negocio rename column como_llegar_es to como_llegar;
alter table destinos.dst_negocio rename column babosa_es      to babosa;
alter table destinos.dst_negocio drop column descripcion_en;
alter table destinos.dst_negocio drop column resumen_en;
alter table destinos.dst_negocio drop column como_llegar_en;
alter table destinos.dst_negocio drop column babosa_en;

alter table destinos.dst_negocio
  add column busqueda tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(nombre,'')),      'A') ||
    setweight(to_tsvector('simple', coalesce(resumen,'')),     'B') ||
    setweight(to_tsvector('simple', coalesce(descripcion,'')), 'C')
  ) stored;

comment on column destinos.dst_negocio.busqueda is
  'Indice de texto completo con configuracion "simple": sin reduccion a raiz, porque la misma columna sirve a destinos en cinco idiomas y una configuracion fija le haria mal trabajo a cuatro de ellos. La busqueda en otros idiomas cruza ademas dst_traduccion.';
comment on column destinos.dst_negocio.descripcion is
  'Descripcion en el idioma principal del destino. Las demas lenguas viven en dst_traduccion, y el sitio las resuelve con destinos.texto_en().';
comment on column destinos.dst_negocio.babosa is
  'Babosa en el idioma principal. Las de los demas idiomas viven en dst_ruta, que es lo que permite /de/hotels/... sin agregar columnas.';

create index idx_dst_negocio_busqueda on destinos.dst_negocio using gin (busqueda);

-- ---------------------------------------------------------------------------
-- Tours
-- ---------------------------------------------------------------------------

insert into destinos.dst_traduccion (entidad, entidad_id, campo, idioma, texto, origen, esta_revisada)
select 'tour', id, c.campo, 'en', c.texto, 'humano', true
  from destinos.dst_tour t
  cross join lateral (values
    ('nombre', t.nombre_en), ('resumen', t.resumen_en), ('descripcion', t.descripcion_en),
    ('incluye', t.incluye_en), ('no_incluye', t.no_incluye_en), ('que_llevar', t.que_llevar_en)
  ) as c(campo, texto)
 where c.texto is not null;

insert into destinos.dst_ruta (destino_id, entidad, entidad_id, idioma, babosa)
select destino_id, 'tour', id, 'es', babosa_es from destinos.dst_tour
union all
select destino_id, 'tour', id, 'en', babosa_en from destinos.dst_tour where babosa_en is not null
on conflict do nothing;

alter table destinos.dst_tour rename column nombre_es      to nombre;
alter table destinos.dst_tour rename column resumen_es     to resumen;
alter table destinos.dst_tour rename column descripcion_es to descripcion;
alter table destinos.dst_tour rename column incluye_es     to incluye;
alter table destinos.dst_tour rename column no_incluye_es  to no_incluye;
alter table destinos.dst_tour rename column que_llevar_es  to que_llevar;
alter table destinos.dst_tour rename column babosa_es      to babosa;
alter table destinos.dst_tour drop column nombre_en;
alter table destinos.dst_tour drop column resumen_en;
alter table destinos.dst_tour drop column descripcion_en;
alter table destinos.dst_tour drop column incluye_en;
alter table destinos.dst_tour drop column no_incluye_en;
alter table destinos.dst_tour drop column que_llevar_en;
alter table destinos.dst_tour drop column babosa_en;

-- ---------------------------------------------------------------------------
-- Guias
-- ---------------------------------------------------------------------------

insert into destinos.dst_traduccion (entidad, entidad_id, campo, idioma, texto, origen, esta_revisada)
select 'guia', id, c.campo, 'en', c.texto, 'humano', true
  from destinos.dst_guia g
  cross join lateral (values
    ('titulo', g.titulo_en), ('entradilla', g.entradilla_en), ('cuerpo', g.cuerpo_en),
    ('meta_titulo', g.meta_titulo_en), ('meta_desc', g.meta_desc_en)
  ) as c(campo, texto)
 where c.texto is not null;

insert into destinos.dst_ruta (destino_id, entidad, entidad_id, idioma, babosa)
select destino_id, 'guia', id, 'es', babosa_es from destinos.dst_guia
union all
select destino_id, 'guia', id, 'en', babosa_en from destinos.dst_guia where babosa_en is not null
on conflict do nothing;

alter table destinos.dst_guia rename column titulo_es      to titulo;
alter table destinos.dst_guia rename column entradilla_es  to entradilla;
alter table destinos.dst_guia rename column cuerpo_es      to cuerpo;
alter table destinos.dst_guia rename column meta_titulo_es to meta_titulo;
alter table destinos.dst_guia rename column meta_desc_es   to meta_desc;
alter table destinos.dst_guia rename column babosa_es      to babosa;
alter table destinos.dst_guia drop column titulo_en;
alter table destinos.dst_guia drop column entradilla_en;
alter table destinos.dst_guia drop column cuerpo_en;
alter table destinos.dst_guia drop column meta_titulo_en;
alter table destinos.dst_guia drop column meta_desc_en;
alter table destinos.dst_guia drop column babosa_en;

-- ---------------------------------------------------------------------------
-- Rutas de categoria por destino, y nombres locales
-- ---------------------------------------------------------------------------

insert into destinos.dst_ruta (destino_id, entidad, entidad_id, idioma, babosa)
select dc.destino_id, 'categoria', c.id, 'es', c.babosa
  from destinos.dst_destino_categoria dc
  join destinos.dst_categoria c on c.id = dc.categoria_id
union all
select dc.destino_id, 'categoria', b.id, 'en', b.babosa_en
  from destinos.dst_destino_categoria dc
  join _babosa_cat_en b on b.id = dc.categoria_id
on conflict do nothing;

insert into destinos.dst_traduccion (entidad, entidad_id, campo, idioma, texto, origen, esta_revisada)
select 'categoria', categoria_id, 'nombre_local', 'en', nombre_local_en, 'humano', true
  from destinos.dst_destino_categoria where nombre_local_en is not null
on conflict do nothing;

alter table destinos.dst_destino_categoria rename column nombre_local_es to nombre_local;
alter table destinos.dst_destino_categoria drop column nombre_local_en;

-- ---------------------------------------------------------------------------
-- El destino ahora publica cinco idiomas
-- ---------------------------------------------------------------------------

alter table destinos.dst_destino rename column lema_es to lema;
insert into destinos.dst_traduccion (entidad, entidad_id, campo, idioma, texto, origen, esta_revisada)
select 'destino', id, 'lema', 'en', lema_en, 'humano', true
  from destinos.dst_destino where lema_en is not null;
alter table destinos.dst_destino drop column lema_en;

update destinos.dst_destino
   set idiomas = array['es','en','pt','fr','de']
 where babosa = 'la-fortuna';

alter table destinos.dst_destino
  add constraint fk_dst_destino_idioma_principal
  foreign key (idioma_principal) references destinos.dst_idioma (codigo) on delete restrict;

-- ---------------------------------------------------------------------------
-- La vista publica, ahora por idioma
-- ---------------------------------------------------------------------------

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
  total_resenas integer, promedio_calificacion numeric
)
language sql stable security definer set search_path = '' as $$
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
         n.total_resenas, n.promedio_calificacion
    from destinos.dst_negocio n
    join d on d.id = n.destino_id
    join destinos.dst_categoria c on c.id = n.categoria_id
   where n.estado_publicacion = 'publicado' and not n.esta_cerrado;
$$;

comment on function destinos.negocios_publicados is
  'Los negocios publicados de un dominio, ya resueltos al idioma pedido: cada texto cae a su traduccion si existe y al idioma principal si no. Reemplaza a la vista v_negocio_publicado, que no podia recibir el idioma como parametro.';

grant execute on function destinos.negocios_publicados to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seguridad de las tablas nuevas
-- ---------------------------------------------------------------------------

alter table destinos.dst_idioma      enable row level security;
alter table destinos.dst_traduccion  enable row level security;
alter table destinos.dst_ruta        enable row level security;

grant select on destinos.dst_idioma, destinos.dst_traduccion, destinos.dst_ruta to anon, authenticated;

create policy "cualquiera lee los idiomas activos" on destinos.dst_idioma
  for select to anon, authenticated using (esta_activo);

create policy "cualquiera lee traducciones" on destinos.dst_traduccion
  for select to anon, authenticated using (true);

create policy "cualquiera lee rutas vigentes" on destinos.dst_ruta
  for select to anon, authenticated using (es_vigente);

create policy "el equipo administra idiomas" on destinos.dst_idioma
  for all to authenticated using (destinos.es_del_equipo()) with check (destinos.es_del_equipo());

create policy "el equipo administra traducciones" on destinos.dst_traduccion
  for all to authenticated using (destinos.es_del_equipo()) with check (destinos.es_del_equipo());

create policy "el equipo administra rutas de sus destinos" on destinos.dst_ruta
  for all to authenticated using (destinos.tiene_acceso_a(destino_id)) with check (destinos.tiene_acceso_a(destino_id));
