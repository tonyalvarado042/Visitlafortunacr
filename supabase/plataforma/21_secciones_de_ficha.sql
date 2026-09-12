-- Plataforma de destinos | 21: las secciones plegables de la ficha
-- Punto 6 de la Fase MVP. La referencia es la ficha de Tripadvisor: una
-- columna de bloques que se abren y se cierran, en vez de un muro de texto.
--
-- Por que una tabla y no seis columnas en dst_negocio:
--   - Son texto largo que casi ningun negocio llena entero. Seis columnas
--     nullables por ficha, multiplicadas por cinco idiomas, es la version cara
--     del mismo problema.
--   - El orden en que se muestran es parte del contenido: un tour quiere
--     "Encuentro y recogida" arriba, un hotel ni la tiene.
--   - Agregar "Politica de cancelacion" manana es insertar filas, no alterar
--     tablas, que es la misma regla que sostiene los cinco idiomas.
--
-- El texto vive en el idioma principal del destino; los demas en
-- dst_traduccion, como todo lo demas.

-- ---------------------------------------------------------------------------
-- 1. La tabla
-- ---------------------------------------------------------------------------

create table if not exists destinos.dst_negocio_seccion (
  id             uuid primary key default gen_random_uuid(),
  negocio_id     uuid not null references destinos.dst_negocio (id) on delete cascade,
  clave          text not null,
  orden          smallint not null default 0,
  contenido      text not null,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint ck_dst_seccion_clave check (clave in (
    'incluye', 'no_incluye', 'que_esperar', 'encuentro', 'accesibilidad', 'adicional'
  )),
  constraint ck_dst_seccion_contenido check (char_length(btrim(contenido)) > 0),
  constraint uq_dst_seccion unique (negocio_id, clave)
);

comment on table destinos.dst_negocio_seccion is
  'Los bloques plegables de la ficha: que incluye, que no, que esperar, donde es el encuentro, accesibilidad e informacion adicional. Una fila por bloque y negocio, en el idioma principal del destino. NO es la descripcion: esa es una sola y va en dst_negocio. Un negocio sin secciones se ve igual de bien, solo mas corto.';
comment on column destinos.dst_negocio_seccion.clave is
  'Que bloque es. El titulo visible no se guarda aqui: lo pone el sitio desde lib/idiomas.ts, para que salga traducido a los cinco idiomas sin duplicar texto por negocio.';
comment on column destinos.dst_negocio_seccion.contenido is
  'Texto plano. Una linea por punto: el sitio parte por salto de linea y arma la lista. Se escribio asi y no como JSON para que se pueda pegar desde el panel sin pelear con la sintaxis.';
comment on column destinos.dst_negocio_seccion.orden is
  'De arriba abajo dentro de la ficha. Un tour pone el encuentro arriba; un hotel ni lo tiene.';

create index if not exists idx_dst_seccion_negocio
  on destinos.dst_negocio_seccion (negocio_id, orden);

drop trigger if exists dst_seccion_marca_tiempo on destinos.dst_negocio_seccion;
create trigger dst_seccion_marca_tiempo
  before update on destinos.dst_negocio_seccion
  for each row execute function destinos.actualizar_marca_tiempo();

-- ---------------------------------------------------------------------------
-- 2. Que se puedan traducir como todo lo demas
-- ---------------------------------------------------------------------------

alter table destinos.dst_traduccion drop constraint if exists ck_dst_traduccion_entidad;
alter table destinos.dst_traduccion add constraint ck_dst_traduccion_entidad
  check (entidad in (
    'destino','categoria','etiqueta','negocio','negocio_seccion','tour','guia','itinerario'
  ));

-- ---------------------------------------------------------------------------
-- 3. Quien las ve
-- ---------------------------------------------------------------------------

alter table destinos.dst_negocio_seccion enable row level security;

drop policy if exists "cualquiera lee secciones de negocios publicados" on destinos.dst_negocio_seccion;
create policy "cualquiera lee secciones de negocios publicados" on destinos.dst_negocio_seccion
  for select to anon, authenticated
  using (exists (
    select 1 from destinos.dst_negocio n
     where n.id = negocio_id and n.estado_publicacion = 'publicado'
  ));

drop policy if exists "el equipo administra las secciones" on destinos.dst_negocio_seccion;
create policy "el equipo administra las secciones" on destinos.dst_negocio_seccion
  for all to authenticated
  using (exists (select 1 from destinos.dst_negocio n
                  where n.id = negocio_id and destinos.tiene_acceso_a(n.destino_id)))
  with check (exists (select 1 from destinos.dst_negocio n
                       where n.id = negocio_id and destinos.tiene_acceso_a(n.destino_id)));

-- OJO: los `grant ... on all tables in schema destinos` de la migracion 11
-- solo alcanzaron a las tablas que existian ese dia. Una tabla nueva nace sin
-- permisos para nadie, asi que cada migracion que cree una tiene que darlos a
-- mano. Sin esto, el panel no puede escribir y el backend recibe
-- "permission denied" aunque use la clave de servicio.
grant select on destinos.dst_negocio_seccion to anon;
grant select, insert, update, delete on destinos.dst_negocio_seccion to authenticated;
grant all on destinos.dst_negocio_seccion to service_role;

-- ---------------------------------------------------------------------------
-- 4. Leerlas ya resueltas al idioma pedido
-- ---------------------------------------------------------------------------

create or replace function destinos.secciones_de_negocio(
  p_negocio_id uuid,
  p_idioma     char(2) default null
) returns table (
  clave     text,
  orden     smallint,
  contenido text
) language sql stable security definer set search_path = '' as $func$
  with idi as (
    select coalesce(
      p_idioma,
      (select d.idioma_principal from destinos.dst_negocio n
         join destinos.dst_destino d on d.id = n.destino_id
        where n.id = p_negocio_id)
    ) as codigo
  )
  select s.clave, s.orden,
         destinos.texto_en('negocio_seccion', s.id, 'contenido', (select codigo from idi), s.contenido)
    from destinos.dst_negocio_seccion s
    join destinos.dst_negocio n on n.id = s.negocio_id
   where s.negocio_id = p_negocio_id
     and n.estado_publicacion = 'publicado'
   order by s.orden, s.clave;
$func$;

comment on function destinos.secciones_de_negocio is
  'Los bloques plegables de una ficha, ya resueltos al idioma pedido: si falta la traduccion cae al idioma principal, igual que el resto del sitio, para que una ficha a medio traducir se vea completa y no con huecos.';

grant execute on function destinos.secciones_de_negocio to anon, authenticated;
