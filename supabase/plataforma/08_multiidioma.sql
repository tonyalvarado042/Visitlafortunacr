-- Plataforma de destinos | 08: de dos idiomas a los que hagan falta
-- Las columnas hermanas _es/_en no escalan: con cinco idiomas y ocho campos
-- traducibles serian cuarenta columnas por tabla, y agregar un idioma seria
-- una migracion. Se cambia a: el texto del idioma principal vive en la fila,
-- y las traducciones en dst_traduccion. Agregar un idioma pasa a ser insertar
-- filas, no alterar tablas.

-- ---------------------------------------------------------------------------
-- Catalogo de idiomas
-- ---------------------------------------------------------------------------

create table destinos.dst_idioma (
  codigo        char(2) primary key,
  nombre_propio text not null,
  nombre_es     text not null,
  config_texto  regconfig not null,
  orden         smallint not null default 0,
  esta_activo   boolean not null default true,
  constraint ck_dst_idioma_codigo check (codigo ~ '^[a-z]{2}$')
);

comment on table destinos.dst_idioma is
  'Idiomas que la plataforma sabe servir. nombre_propio es como se llama el idioma en si mismo, que es lo que se muestra en el selector: un aleman busca "Deutsch", no "Aleman". config_texto es la configuracion de busqueda de Postgres para ese idioma.';
comment on column destinos.dst_idioma.config_texto is
  'Configuracion de texto completo de Postgres. Decide como se reduce cada palabra a su raiz al buscar: en aleman "Wasserfaelle" y "Wasserfall" deben encontrarse igual.';

insert into destinos.dst_idioma (codigo, nombre_propio, nombre_es, config_texto, orden) values
  ('es','Español',   'Español',   'spanish',    10),
  ('en','English',   'Inglés',    'english',    20),
  ('pt','Português', 'Portugués', 'portuguese', 30),
  ('fr','Français',  'Francés',   'french',     40),
  ('de','Deutsch',   'Alemán',    'german',     50);

-- ---------------------------------------------------------------------------
-- Traducciones de cualquier campo de cualquier entidad
-- ---------------------------------------------------------------------------

create table destinos.dst_traduccion (
  id             uuid primary key default gen_random_uuid(),
  entidad        text    not null,
  entidad_id     uuid    not null,
  campo          text    not null,
  idioma         char(2) not null references destinos.dst_idioma (codigo) on delete restrict,
  texto          text    not null,
  origen         text    not null default 'humano',
  esta_revisada  boolean not null default false,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint uq_dst_traduccion unique (entidad, entidad_id, campo, idioma),
  constraint ck_dst_traduccion_entidad check (entidad in (
    'destino','categoria','etiqueta','negocio','tour','guia','itinerario'
  )),
  constraint ck_dst_traduccion_origen check (origen in ('humano','maquina','importado')),
  constraint ck_dst_traduccion_texto check (char_length(btrim(texto)) > 0)
);

comment on table destinos.dst_traduccion is
  'Un texto, en un idioma, para un campo de una fila. Agregar japones a toda la plataforma es insertar filas aqui, no alterar ni una tabla. El texto del idioma principal del destino NO vive aqui: vive en la fila original, para que la consulta mas frecuente del sitio no necesite join.';
comment on column destinos.dst_traduccion.origen is
  'humano, maquina o importado. Una traduccion automatica se muestra igual, pero se marca como no revisada y se puede filtrar para corregirla.';
comment on column destinos.dst_traduccion.esta_revisada is
  'false mientras nadie que hable el idioma la haya leido. Sirve para no presumir de un aleman que en realidad salio de un traductor.';

create index idx_dst_traduccion_busca on destinos.dst_traduccion (entidad, entidad_id, idioma);
create index idx_dst_traduccion_idioma on destinos.dst_traduccion (idioma);
create index idx_dst_traduccion_pendientes on destinos.dst_traduccion (idioma, entidad) where not esta_revisada;
create index idx_dst_traduccion_texto on destinos.dst_traduccion using gin (to_tsvector('simple', texto));

create trigger tg_traduccion_antes_actualizar
  before update on destinos.dst_traduccion
  for each row execute function destinos.actualizar_marca_tiempo();

-- ---------------------------------------------------------------------------
-- Rutas por idioma
-- ---------------------------------------------------------------------------

create table destinos.dst_ruta (
  id          uuid primary key default gen_random_uuid(),
  destino_id  uuid    not null references destinos.dst_destino (id) on delete cascade,
  entidad     text    not null,
  entidad_id  uuid    not null,
  idioma      char(2) not null references destinos.dst_idioma (codigo) on delete restrict,
  babosa      text    not null,
  es_vigente  boolean not null default true,
  creado_en   timestamptz not null default now(),

  constraint uq_dst_ruta unique (destino_id, entidad, idioma, babosa),
  constraint ck_dst_ruta_entidad check (entidad in ('categoria','negocio','tour','guia','itinerario')),
  constraint ck_dst_ruta_babosa check (babosa ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

comment on table destinos.dst_ruta is
  'La URL de cada cosa en cada idioma: /es/hoteles/don-rufino, /en/hotels/don-rufino, /de/hotels/don-rufino. Una tabla y no columnas porque son cinco idiomas y creciendo. La restriccion de formato impide que entre una babosa con tildes, mayusculas o espacios, que romperia la URL en silencio.';
comment on column destinos.dst_ruta.es_vigente is
  'false en las babosas retiradas, que se conservan para servir un 301 en vez de un 404.';

create index idx_dst_ruta_resolver on destinos.dst_ruta (destino_id, idioma, entidad, babosa) where es_vigente;
create index idx_dst_ruta_entidad  on destinos.dst_ruta (entidad, entidad_id);

-- ---------------------------------------------------------------------------
-- Funcion de resolucion: el texto en el idioma pedido, con respaldo
-- ---------------------------------------------------------------------------

create or replace function destinos.texto_en(
  p_entidad   text,
  p_entidad_id uuid,
  p_campo     text,
  p_idioma    char(2),
  p_respaldo  text
) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select t.texto from destinos.dst_traduccion t
      where t.entidad = p_entidad and t.entidad_id = p_entidad_id
        and t.campo = p_campo and t.idioma = p_idioma
      limit 1),
    p_respaldo
  );
$$;

comment on function destinos.texto_en is
  'Devuelve el texto en el idioma pedido, y si no existe cae al respaldo, que es el texto del idioma principal del destino. Nunca devuelve vacio por falta de traduccion: una ficha a medio traducir se ve completa, con las partes que faltan en el idioma original.';

grant execute on function destinos.texto_en to anon, authenticated;
