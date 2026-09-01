-- Plataforma de destinos | 02: directorio, resenas y contenido
-- El negocio es a la vez ficha publica y proveedor comercial. Una sola tabla
-- para las dos caras, porque son el mismo negocio: separarlas obligaria a
-- mantener dos veces el nombre, el telefono y el dueno.

create table destinos.dst_negocio (
  id                  uuid primary key default gen_random_uuid(),
  destino_id          uuid not null references destinos.dst_destino (id)   on delete restrict,
  categoria_id        uuid not null references destinos.dst_categoria (id) on delete restrict,

  -- Los seis campos base de toda ficha --------------------------------------
  logo_url            text,
  nombre              text not null,
  email               text,
  telefono            text,
  sitio_web           text,
  descripcion_es      text,
  descripcion_en      text,
  -- -------------------------------------------------------------------------

  babosa_es           text not null,
  babosa_en           text not null,
  resumen_es          text,
  resumen_en          text,

  telefono_whatsapp   text,
  direccion           text,
  como_llegar_es      text,
  como_llegar_en      text,
  latitud             numeric(10,7),
  longitud            numeric(10,7),

  rango_precio        destinos.rango_precio,
  precio_desde_usd    numeric(10,2),

  -- Cara comercial: el negocio como proveedor -------------------------------
  membresia           destinos.nivel_membresia not null default 'gratis',
  membresia_hasta     date,
  comision_pct        numeric(5,2),
  contacto_comercial  text,
  email_reservas      text,
  notas_internas      text,
  -- -------------------------------------------------------------------------

  estado_publicacion  destinos.estado_publicacion  not null default 'borrador',
  estado_verificacion destinos.estado_verificacion not null default 'pendiente',
  fuente_dato         destinos.fuente_dato         not null default 'siembra_manual',
  es_destacado        boolean not null default false,
  es_casa             boolean not null default false,
  esta_cerrado        boolean not null default false,

  google_place_id     text,
  atributos           jsonb not null default '{}'::jsonb,

  total_resenas       integer not null default 0,
  promedio_calificacion numeric(2,1),
  total_vistas        integer not null default 0,

  busqueda_es tsvector generated always as (
    setweight(to_tsvector('spanish', coalesce(nombre,'')),         'A') ||
    setweight(to_tsvector('spanish', coalesce(resumen_es,'')),     'B') ||
    setweight(to_tsvector('spanish', coalesce(descripcion_es,'')), 'C')
  ) stored,
  busqueda_en tsvector generated always as (
    setweight(to_tsvector('english', coalesce(nombre,'')),         'A') ||
    setweight(to_tsvector('english', coalesce(resumen_en,'')),     'B') ||
    setweight(to_tsvector('english', coalesce(descripcion_en,'')), 'C')
  ) stored,

  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),
  publicado_en        timestamptz,
  verificado_en       timestamptz,

  constraint uq_dst_negocio_babosa_es unique (destino_id, babosa_es),
  constraint uq_dst_negocio_babosa_en unique (destino_id, babosa_en),
  constraint uq_dst_negocio_place_id  unique (google_place_id),
  constraint ck_dst_negocio_email     check (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-zA-Z]{2,}$'),
  constraint ck_dst_negocio_telefono  check (telefono is null or telefono ~ '^\+[1-9][0-9]{6,14}$'),
  constraint ck_dst_negocio_whatsapp  check (telefono_whatsapp is null or telefono_whatsapp ~ '^\+[1-9][0-9]{6,14}$'),
  constraint ck_dst_negocio_web       check (sitio_web is null or sitio_web ~ '^https?://'),
  constraint ck_dst_negocio_latitud   check (latitud  is null or latitud  between -90 and 90),
  constraint ck_dst_negocio_longitud  check (longitud is null or longitud between -180 and 180),
  constraint ck_dst_negocio_comision  check (comision_pct is null or comision_pct between 0 and 100),
  constraint ck_dst_negocio_nota      check (promedio_calificacion is null or promedio_calificacion between 1.0 and 5.0),
  constraint ck_dst_negocio_publicado check (estado_publicacion <> 'publicado' or descripcion_es is not null),
  constraint ck_dst_negocio_membresia_vence check (membresia = 'gratis' or membresia_hasta is not null)
);

comment on table destinos.dst_negocio is
  'Toda ficha del directorio, en cualquier destino: hotel, restaurante, tour operador, atraccion, transporte o comercio. Una sola tabla a proposito, porque todas comparten contacto, ubicacion, fotos y resenas; lo propio de cada categoria vive en atributos. No guarda resenas ni tours: esos tienen tabla propia.';

comment on column destinos.dst_negocio.destino_id is
  'A que destino pertenece. Toda consulta del sitio y toda politica de acceso filtran por aqui: es lo que impide que un destino lea o toque el contenido de otro.';
comment on column destinos.dst_negocio.nombre is
  'Nombre propio. No se traduce: Don Rufino se llama igual en las dos versiones del sitio.';
comment on column destinos.dst_negocio.telefono is
  'E.164 con codigo de pais (+50624799997). Normalizado para que sirva de enlace tel: sin transformar.';
comment on column destinos.dst_negocio.es_casa is
  'Negocio propio del grupo (Bike & Bed y los que sigan). Sirve para medir aparte lo que produce el canal propio. NUNCA se muestra al publico: la ficha no dice que es nuestra. Aparece donde genuinamente corresponde y compite por merito.';
comment on column destinos.dst_negocio.es_destacado is
  'Posicion pagada. Sube en el listado y se rotula como pagado, pero NO altera su nota ni el orden de sus resenas.';
comment on column destinos.dst_negocio.membresia is
  'gratis: ficha basica. pro: mas fotos, WhatsApp, ofertas y estadisticas. destacado: ademas, tope de categoria y presencia en portada.';
comment on column destinos.dst_negocio.comision_pct is
  'Comision propia del negocio. Si es null se aplica la del destino.';
comment on column destinos.dst_negocio.atributos is
  'Lo propio de cada categoria. Un hotel guarda {"estrellas":4}; una catarata {"altura_metros":70}. Lo que se empiece a filtrar se asciende a columna real.';

create index idx_dst_negocio_destino    on destinos.dst_negocio (destino_id);
create index idx_dst_negocio_dest_cat   on destinos.dst_negocio (destino_id, categoria_id);
create index idx_dst_negocio_publicados on destinos.dst_negocio (destino_id, estado_publicacion) where estado_publicacion = 'publicado';
create index idx_dst_negocio_destacado  on destinos.dst_negocio (destino_id) where es_destacado;
create index idx_dst_negocio_casa       on destinos.dst_negocio (destino_id) where es_casa;
create index idx_dst_negocio_nota       on destinos.dst_negocio (promedio_calificacion desc nulls last);
create index idx_dst_negocio_busq_es    on destinos.dst_negocio using gin (busqueda_es);
create index idx_dst_negocio_busq_en    on destinos.dst_negocio using gin (busqueda_en);
create index idx_dst_negocio_atributos  on destinos.dst_negocio using gin (atributos);
create index idx_dst_negocio_ubicacion  on destinos.dst_negocio (latitud, longitud) where latitud is not null;

-- ---------------------------------------------------------------------------
-- Tablas hijas del negocio
-- ---------------------------------------------------------------------------

create table destinos.dst_negocio_etiqueta (
  negocio_id  uuid not null references destinos.dst_negocio (id)  on delete cascade,
  etiqueta_id uuid not null references destinos.dst_etiqueta (id) on delete cascade,
  creado_en   timestamptz not null default now(),
  primary key (negocio_id, etiqueta_id)
);
comment on table destinos.dst_negocio_etiqueta is
  'Que etiquetas lleva cada negocio. Puente puro.';
create index idx_dst_negocio_etiqueta_et on destinos.dst_negocio_etiqueta (etiqueta_id);

create table destinos.dst_negocio_horario (
  id           uuid primary key default gen_random_uuid(),
  negocio_id   uuid not null references destinos.dst_negocio (id) on delete cascade,
  dia_semana   smallint not null,
  abre_a       time,
  cierra_a     time,
  esta_cerrado boolean not null default false,
  creado_en    timestamptz not null default now(),

  constraint ck_dst_horario_dia check (dia_semana between 0 and 6),
  constraint ck_dst_horario_coherente check (
    (esta_cerrado and abre_a is null and cierra_a is null)
    or (not esta_cerrado and abre_a is not null and cierra_a is not null)
  ),
  constraint uq_dst_horario_dia unique (negocio_id, dia_semana)
);
comment on table destinos.dst_negocio_horario is
  'Horario de atencion, una fila por dia. dia_semana 0 es domingo. Alimenta el indicador "abierto ahora", que es lo que busca quien ya esta en el destino.';
create index idx_dst_horario_negocio on destinos.dst_negocio_horario (negocio_id);

create table destinos.dst_negocio_foto (
  id                   uuid primary key default gen_random_uuid(),
  negocio_id           uuid not null references destinos.dst_negocio (id) on delete cascade,
  url                  text not null,
  texto_alternativo_es text,
  texto_alternativo_en text,
  credito              text,
  orden                smallint not null default 0,
  es_portada           boolean not null default false,
  creado_en            timestamptz not null default now()
);
comment on table destinos.dst_negocio_foto is
  'Galeria oficial del negocio: la que sube el dueno o aporta el equipo. Las fotos de visitantes van en dst_resena_foto, para no confundir material promocional con evidencia de una visita.';
comment on column destinos.dst_negocio_foto.credito is
  'De quien es la foto. Obligatorio si no la subio el dueno del negocio.';
create unique index uq_dst_foto_portada on destinos.dst_negocio_foto (negocio_id) where es_portada;
create index idx_dst_foto_negocio on destinos.dst_negocio_foto (negocio_id);

-- ---------------------------------------------------------------------------
-- Resenas propias
-- ---------------------------------------------------------------------------

create table destinos.dst_resena (
  id                uuid primary key default gen_random_uuid(),
  negocio_id        uuid not null references destinos.dst_negocio (id) on delete cascade,
  viajero_id        uuid not null,

  calificacion      smallint not null,
  titulo            text,
  cuerpo            text not null,
  idioma            char(2) not null default 'es',
  visitado_el       date,

  estado            destinos.estado_resena not null default 'pendiente',
  total_util        integer not null default 0,

  respuesta_negocio text,
  respondida_en     timestamptz,

  moderador_id      uuid references destinos.dst_usuario (id) on delete set null,
  moderada_en       timestamptz,
  motivo_rechazo    text,

  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),

  constraint ck_dst_resena_calificacion check (calificacion between 1 and 5),
  constraint ck_dst_resena_cuerpo       check (char_length(btrim(cuerpo)) >= 40),
  constraint ck_dst_resena_idioma       check (idioma in ('es','en')),
  constraint ck_dst_resena_visita       check (visitado_el is null or visitado_el <= current_date),
  constraint ck_dst_resena_rechazo      check (estado <> 'rechazada' or motivo_rechazo is not null),
  constraint uq_dst_resena_una_por_viajero unique (negocio_id, viajero_id)
);

comment on table destinos.dst_resena is
  'Resenas escritas en la plataforma. Son el activo propio y las unicas que cuentan para promedio_calificacion y para el aggregateRating del marcado. Una persona deja como maximo una por negocio; para corregirla, la edita.';
comment on column destinos.dst_resena.cuerpo is
  'El minimo de 40 caracteres esta puesto contra el "muy bueno" suelto, que no le sirve a nadie que este decidiendo.';
comment on column destinos.dst_resena.estado is
  'Toda resena entra pendiente y pasa por moderacion. Es lo que separa un directorio util de un tablon de spam.';

create index idx_dst_resena_negocio on destinos.dst_resena (negocio_id);
create index idx_dst_resena_viajero on destinos.dst_resena (viajero_id);
create index idx_dst_resena_pendientes on destinos.dst_resena (estado) where estado = 'pendiente';
create index idx_dst_resena_publicadas on destinos.dst_resena (negocio_id, creado_en desc) where estado = 'publicada';

create table destinos.dst_resena_foto (
  id        uuid primary key default gen_random_uuid(),
  resena_id uuid not null references destinos.dst_resena (id) on delete cascade,
  url       text not null,
  orden     smallint not null default 0,
  creado_en timestamptz not null default now()
);
comment on table destinos.dst_resena_foto is
  'Fotos de quien escribio la resena. Separadas de la galeria oficial porque son evidencia de una visita, no material promocional, y se borran con la resena.';
create index idx_dst_resena_foto on destinos.dst_resena_foto (resena_id);

create table destinos.dst_resena_util (
  resena_id  uuid not null references destinos.dst_resena (id) on delete cascade,
  viajero_id uuid not null,
  creado_en  timestamptz not null default now(),
  primary key (resena_id, viajero_id)
);
comment on table destinos.dst_resena_util is
  'Votos de "me sirvio esta resena". La llave compuesta impide votar dos veces.';

-- ---------------------------------------------------------------------------
-- Resenas externas: cache atribuido y con vencimiento
-- ---------------------------------------------------------------------------

create table destinos.dst_resena_externa (
  id            uuid primary key default gen_random_uuid(),
  negocio_id    uuid not null references destinos.dst_negocio (id) on delete cascade,

  plataforma    destinos.plataforma_externa not null,
  calificacion  numeric(2,1),
  total_resenas integer,
  url_fuente    text not null,

  obtenida_en   timestamptz not null default now(),
  expira_en     timestamptz not null,

  constraint uq_dst_externa_negocio_plat unique (negocio_id, plataforma),
  constraint ck_dst_externa_nota  check (calificacion is null or calificacion between 1.0 and 5.0),
  constraint ck_dst_externa_vence check (expira_en > obtenida_en)
);

comment on table destinos.dst_resena_externa is
  'Nota y numero de resenas que otras plataformas publican de un negocio. Dato factual agregado, mostrado SIEMPRE atribuido y enlazado a la fuente, y fuera del promedio propio. Sirve para que una ficha recien nacida ya le diga algo util a quien la visita.';
comment on column destinos.dst_resena_externa.expira_en is
  'Vencimiento del cache. Google Places no permite guardar sus datos de forma indefinida, asi que el cumplimiento vive en la politica de lectura y no en la buena memoria de alguien.';
comment on column destinos.dst_resena_externa.url_fuente is
  'Enlace a la ficha original. Obligatorio: sin el, mostrar la nota ajena no es cita, es apropiacion.';

create index idx_dst_externa_negocio on destinos.dst_resena_externa (negocio_id);
create index idx_dst_externa_expira  on destinos.dst_resena_externa (expira_en);

create table destinos.dst_resena_externa_extracto (
  id                uuid primary key default gen_random_uuid(),
  resena_externa_id uuid not null references destinos.dst_resena_externa (id) on delete cascade,
  autor_nombre      text not null,
  autor_avatar_url  text,
  autor_url         text,
  calificacion      smallint,
  texto             text not null,
  publicada_en      timestamptz,
  url_original      text not null,
  creado_en         timestamptz not null default now(),

  constraint ck_dst_extracto_nota check (calificacion is null or calificacion between 1 and 5)
);
comment on table destinos.dst_resena_externa_extracto is
  'Las hasta cinco resenas con texto que entrega Google Places, con el nombre del autor, la atribucion y enlace al original, que es lo que exigen sus terminos. Nunca se raspa texto de Tripadvisor ni de Booking para esta tabla.';
create index idx_dst_extracto_padre on destinos.dst_resena_externa_extracto (resena_externa_id);

-- ---------------------------------------------------------------------------
-- Contenido editorial: las guias que traen el trafico
-- ---------------------------------------------------------------------------

create table destinos.dst_guia (
  id             uuid primary key default gen_random_uuid(),
  destino_id     uuid not null references destinos.dst_destino (id) on delete cascade,
  autor_id       uuid references destinos.dst_usuario (id) on delete set null,

  babosa_es      text not null,
  babosa_en      text not null,
  titulo_es      text not null,
  titulo_en      text,
  entradilla_es  text,
  entradilla_en  text,
  cuerpo_es      text,
  cuerpo_en      text,

  tipo           text not null default 'guia',
  dias           smallint,
  publico        destinos.tipo_viajero,

  imagen_url     text,
  meta_titulo_es text,
  meta_titulo_en text,
  meta_desc_es   text,
  meta_desc_en   text,

  estado         destinos.estado_publicacion not null default 'borrador',
  total_vistas   integer not null default 0,

  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  publicado_en   timestamptz,

  constraint uq_dst_guia_babosa_es unique (destino_id, babosa_es),
  constraint uq_dst_guia_babosa_en unique (destino_id, babosa_en),
  constraint ck_dst_guia_tipo check (tipo in ('guia','itinerario','comparativa','como_llegar','lista')),
  constraint ck_dst_guia_dias check (dias is null or dias between 1 and 30)
);

comment on table destinos.dst_guia is
  'Los articulos que traen el trafico organico: "21 cosas que hacer en La Fortuna", "Itinerario de 4 dias", "Como llegar de SJO a La Fortuna". No es un blog: cada guia es una pieza de captacion que termina empujando al planificador.';
comment on column destinos.dst_guia.tipo is
  'guia, itinerario (los de N dias), comparativa, como_llegar o lista. El tipo decide la plantilla y el marcado que se emite.';

create index idx_dst_guia_destino     on destinos.dst_guia (destino_id);
create index idx_dst_guia_publicadas  on destinos.dst_guia (destino_id, publicado_en desc) where estado = 'publicado';

create table destinos.dst_guia_negocio (
  guia_id    uuid not null references destinos.dst_guia (id)    on delete cascade,
  negocio_id uuid not null references destinos.dst_negocio (id) on delete cascade,
  orden      smallint not null default 0,
  nota_es    text,
  nota_en    text,
  primary key (guia_id, negocio_id)
);
comment on table destinos.dst_guia_negocio is
  'Que negocios menciona cada guia y en que orden. Es el enlace interno que reparte autoridad hacia las fichas, y de paso permite ver que guia origino cada visita a un negocio.';
create index idx_dst_guia_negocio_neg on destinos.dst_guia_negocio (negocio_id);

-- ---------------------------------------------------------------------------
-- dst_redireccion
-- ---------------------------------------------------------------------------

create table destinos.dst_redireccion (
  id           uuid primary key default gen_random_uuid(),
  destino_id   uuid not null references destinos.dst_destino (id) on delete cascade,
  babosa_vieja text not null,
  babosa_nueva text not null,
  idioma       char(2) not null,
  creado_en    timestamptz not null default now(),

  constraint uq_dst_redireccion unique (destino_id, babosa_vieja, idioma),
  constraint ck_dst_redireccion_idioma check (idioma in ('es','en')),
  constraint ck_dst_redireccion_distintas check (babosa_vieja <> babosa_nueva)
);
comment on table destinos.dst_redireccion is
  'Babosas retiradas y a donde apuntan ahora, para servir un 301. Una URL indexada nunca debe morir en un 404: eso tira el posicionamiento que costo meses.';
