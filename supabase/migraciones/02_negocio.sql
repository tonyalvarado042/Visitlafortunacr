-- visitlafortunacr | Migracion 02: el negocio y todo lo que cuelga de el
-- Una sola tabla para las siete categorias. Lo comun va en columnas; lo propio
-- de cada categoria va en atributos (jsonb).

create table directorio.negocio (
  id                     uuid primary key default gen_random_uuid(),
  categoria_id           uuid not null references directorio.categoria (id) on delete restrict,

  -- Los seis campos base del directorio -------------------------------------
  logo_url               text,
  nombre                 text not null,
  email                  text,
  telefono               text,
  sitio_web              text,
  descripcion_es         text,
  descripcion_en         text,
  -- -------------------------------------------------------------------------

  babosa_es              text not null,
  babosa_en              text not null,
  resumen_es             text,
  resumen_en             text,

  telefono_whatsapp      text,
  direccion              text,
  como_llegar_es         text,
  como_llegar_en         text,
  latitud                numeric(10,7),
  longitud               numeric(10,7),

  rango_precio           directorio.rango_precio,
  precio_desde_usd       numeric(10,2),

  estado_publicacion     directorio.estado_publicacion  not null default 'borrador',
  estado_verificacion    directorio.estado_verificacion not null default 'pendiente',
  fuente_dato            directorio.fuente_dato         not null default 'siembra_manual',
  es_destacado           boolean not null default false,
  es_permanentemente_cerrado boolean not null default false,

  google_place_id        text,
  atributos              jsonb not null default '{}'::jsonb,

  total_resenas          integer not null default 0,
  promedio_calificacion  numeric(2,1),

  busqueda_es tsvector generated always as (
    setweight(to_tsvector('spanish', coalesce(nombre, '')),         'A') ||
    setweight(to_tsvector('spanish', coalesce(resumen_es, '')),     'B') ||
    setweight(to_tsvector('spanish', coalesce(descripcion_es, '')), 'C')
  ) stored,
  busqueda_en tsvector generated always as (
    setweight(to_tsvector('english', coalesce(nombre, '')),         'A') ||
    setweight(to_tsvector('english', coalesce(resumen_en, '')),     'B') ||
    setweight(to_tsvector('english', coalesce(descripcion_en, '')), 'C')
  ) stored,

  creado_en              timestamptz not null default now(),
  actualizado_en         timestamptz not null default now(),
  publicado_en           timestamptz,
  verificado_en          timestamptz,

  constraint uq_negocio_babosa_es unique (babosa_es),
  constraint uq_negocio_babosa_en unique (babosa_en),
  constraint uq_negocio_google_place_id unique (google_place_id),
  constraint ck_negocio_email check (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-zA-Z]{2,}$'),
  constraint ck_negocio_telefono_e164 check (telefono is null or telefono ~ '^\+[1-9][0-9]{6,14}$'),
  constraint ck_negocio_whatsapp_e164 check (telefono_whatsapp is null or telefono_whatsapp ~ '^\+[1-9][0-9]{6,14}$'),
  constraint ck_negocio_sitio_web check (sitio_web is null or sitio_web ~ '^https?://'),
  constraint ck_negocio_latitud check (latitud is null or latitud between -90 and 90),
  constraint ck_negocio_longitud check (longitud is null or longitud between -180 and 180),
  constraint ck_negocio_calificacion_rango check (promedio_calificacion is null or promedio_calificacion between 1.0 and 5.0),
  constraint ck_negocio_publicado_tiene_descripcion check (
    estado_publicacion <> 'publicado' or descripcion_es is not null
  )
);

comment on table directorio.negocio is
  'Toda ficha del directorio: hotel, restaurante, tour, atraccion, parque, transporte o comercio. Una sola tabla a proposito, porque las siete comparten contacto, ubicacion, fotos y resenas; lo que no comparten vive en atributos. No guarda resenas: esas estan en resena y resena_externa.';
comment on column directorio.negocio.nombre is
  'Nombre propio del negocio. No se traduce: Don Rufino se llama igual en las dos versiones del sitio.';
comment on column directorio.negocio.telefono is
  'Telefono principal en formato E.164 con codigo de pais (+50624799997). Se guarda normalizado para que sirva de enlace tel: sin transformar.';
comment on column directorio.negocio.atributos is
  'Campos propios de cada categoria. Un hotel guarda {"estrellas":4,"piscina":true}; una catarata {"altura_metros":70,"escalones":530}. Lo que se consulte o filtre seguido se asciende a columna real.';
comment on column directorio.negocio.estado_verificacion is
  'pendiente: solo nombre. parcial: web confirmada, falta contacto directo. verificado: telefono o email confirmados en fuente oficial. reclamado: el dueno tomo la ficha y sus datos mandan.';
comment on column directorio.negocio.es_destacado is
  'Posicion pagada. Sube la ficha en el listado y se rotula como contenido pagado, pero NO altera su nota ni el orden de sus resenas.';
comment on column directorio.negocio.promedio_calificacion is
  'Promedio de las resenas propias publicadas, mantenido por trigger. Nunca mezcla notas de Google ni de Tripadvisor: esas van en resena_externa y se muestran atribuidas aparte.';
comment on column directorio.negocio.google_place_id is
  'Identificador del lugar en Google Places. Es la llave para refrescar coordenadas, horarios y agregados sin depender del nombre.';

create index idx_negocio_categoria_id       on directorio.negocio (categoria_id);
create index idx_negocio_estado_publicacion on directorio.negocio (estado_publicacion);
create index idx_negocio_destacado          on directorio.negocio (es_destacado) where es_destacado;
create index idx_negocio_calificacion       on directorio.negocio (promedio_calificacion desc nulls last);
create index idx_negocio_busqueda_es        on directorio.negocio using gin (busqueda_es);
create index idx_negocio_busqueda_en        on directorio.negocio using gin (busqueda_en);
create index idx_negocio_atributos          on directorio.negocio using gin (atributos);
create index idx_negocio_ubicacion          on directorio.negocio (latitud, longitud) where latitud is not null;

-- ---------------------------------------------------------------------------
-- negocio_etiqueta
-- ---------------------------------------------------------------------------

create table directorio.negocio_etiqueta (
  negocio_id   uuid not null references directorio.negocio (id)  on delete cascade,
  etiqueta_id  uuid not null references directorio.etiqueta (id) on delete cascade,
  creado_en    timestamptz not null default now(),

  primary key (negocio_id, etiqueta_id)
);

comment on table directorio.negocio_etiqueta is
  'Que etiquetas lleva cada negocio. Puente puro: si hace falta guardar algo mas que la relacion, ese dato pertenece a otra tabla.';

create index idx_negocio_etiqueta_etiqueta_id on directorio.negocio_etiqueta (etiqueta_id);

-- ---------------------------------------------------------------------------
-- negocio_horario
-- ---------------------------------------------------------------------------

create table directorio.negocio_horario (
  id            uuid primary key default gen_random_uuid(),
  negocio_id    uuid not null references directorio.negocio (id) on delete cascade,

  dia_semana    smallint not null,
  abre_a        time,
  cierra_a      time,
  esta_cerrado  boolean not null default false,

  creado_en     timestamptz not null default now(),

  constraint ck_negocio_horario_dia check (dia_semana between 0 and 6),
  constraint ck_negocio_horario_coherente check (
    (esta_cerrado and abre_a is null and cierra_a is null)
    or (not esta_cerrado and abre_a is not null and cierra_a is not null)
  ),
  constraint uq_negocio_horario_dia unique (negocio_id, dia_semana)
);

comment on table directorio.negocio_horario is
  'Horario de atencion, una fila por dia de la semana. dia_semana 0 es domingo. Alimenta el indicador "abierto ahora", que es lo que busca el turista que ya esta en La Fortuna.';

create index idx_negocio_horario_negocio_id on directorio.negocio_horario (negocio_id);

-- ---------------------------------------------------------------------------
-- negocio_foto
-- ---------------------------------------------------------------------------

create table directorio.negocio_foto (
  id                     uuid primary key default gen_random_uuid(),
  negocio_id             uuid not null references directorio.negocio (id) on delete cascade,

  url                    text not null,
  texto_alternativo_es   text,
  texto_alternativo_en   text,
  credito                text,
  orden                  smallint not null default 0,
  es_portada             boolean not null default false,

  creado_en              timestamptz not null default now()
);

comment on table directorio.negocio_foto is
  'Galeria oficial del negocio: la que sube el dueno al reclamar su ficha o la que aporta la redaccion. Las fotos que suben los visitantes van en resena_foto, para no confundir material promocional con evidencia de una visita.';
comment on column directorio.negocio_foto.credito is
  'A quien pertenece la foto. Obligatorio si no la subio el dueno del negocio.';

create unique index uq_negocio_foto_portada on directorio.negocio_foto (negocio_id) where es_portada;
create index idx_negocio_foto_negocio_id on directorio.negocio_foto (negocio_id);
