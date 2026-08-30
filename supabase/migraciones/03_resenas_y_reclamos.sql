-- visitlafortunacr | Migracion 03: resenas propias, resenas externas y reclamos
-- Las propias y las externas viven separadas a proposito: tienen dueno,
-- ciclo de vida y obligaciones legales distintas.

-- ---------------------------------------------------------------------------
-- resena  (propias del sitio)
-- ---------------------------------------------------------------------------

create table directorio.resena (
  id                  uuid primary key default gen_random_uuid(),
  negocio_id          uuid not null references directorio.negocio (id) on delete cascade,
  autor_id            uuid not null references directorio.perfil (id)  on delete cascade,

  calificacion        smallint not null,
  titulo              text,
  cuerpo              text not null,
  idioma              char(2) not null default 'es',
  visitado_el         date,

  estado              directorio.estado_resena not null default 'pendiente',
  total_util          integer not null default 0,

  respuesta_negocio   text,
  respondida_en       timestamptz,

  moderador_id        uuid references directorio.perfil (id) on delete set null,
  moderada_en         timestamptz,
  motivo_rechazo      text,

  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),

  constraint ck_resena_calificacion_rango check (calificacion between 1 and 5),
  constraint ck_resena_cuerpo_minimo check (char_length(btrim(cuerpo)) >= 40),
  constraint ck_resena_idioma check (idioma in ('es', 'en')),
  constraint ck_resena_visita_no_futura check (visitado_el is null or visitado_el <= current_date),
  constraint ck_resena_rechazo_con_motivo check (estado <> 'rechazada' or motivo_rechazo is not null),
  constraint uq_resena_autor_por_negocio unique (negocio_id, autor_id)
);

comment on table directorio.resena is
  'Resenas escritas por usuarios de visitlafortunacr. Son el activo propio del sitio y las unicas que cuentan para promedio_calificacion y para el aggregateRating del marcado JSON-LD. Una persona deja como maximo una resena por negocio; para corregirla, la edita.';
comment on column directorio.resena.cuerpo is
  'Texto de la resena. El minimo de 40 caracteres esta puesto contra el "muy bueno" suelto, que no le sirve a nadie que este decidiendo.';
comment on column directorio.resena.estado is
  'Toda resena entra como pendiente y pasa por moderacion. Es lo que separa un directorio util de un tablon de spam.';
comment on column directorio.resena.respuesta_negocio is
  'Derecho de respuesta del negocio, una sola por resena. Se muestra debajo, nunca en lugar de la resena.';

create index idx_resena_negocio_id on directorio.resena (negocio_id);
create index idx_resena_autor_id   on directorio.resena (autor_id);
create index idx_resena_estado     on directorio.resena (estado);
create index idx_resena_publicadas on directorio.resena (negocio_id, creado_en desc) where estado = 'publicada';

-- ---------------------------------------------------------------------------
-- resena_foto  /  resena_util
-- ---------------------------------------------------------------------------

create table directorio.resena_foto (
  id          uuid primary key default gen_random_uuid(),
  resena_id   uuid not null references directorio.resena (id) on delete cascade,

  url         text not null,
  orden       smallint not null default 0,
  creado_en   timestamptz not null default now()
);

comment on table directorio.resena_foto is
  'Fotos que aporta quien escribe la resena. Se separan de negocio_foto porque son evidencia de una visita real, no material promocional, y se borran con la resena.';

create index idx_resena_foto_resena_id on directorio.resena_foto (resena_id);

create table directorio.resena_util (
  resena_id   uuid not null references directorio.resena (id) on delete cascade,
  perfil_id   uuid not null references directorio.perfil (id) on delete cascade,
  creado_en   timestamptz not null default now(),

  primary key (resena_id, perfil_id)
);

comment on table directorio.resena_util is
  'Votos de "me sirvio esta resena". La llave compuesta impide que la misma persona vote dos veces la misma resena.';

-- ---------------------------------------------------------------------------
-- resena_externa  (agregado cacheado de otras plataformas)
-- ---------------------------------------------------------------------------

create table directorio.resena_externa (
  id                  uuid primary key default gen_random_uuid(),
  negocio_id          uuid not null references directorio.negocio (id) on delete cascade,

  plataforma          directorio.plataforma_externa not null,
  calificacion        numeric(2,1),
  total_resenas       integer,
  url_fuente          text not null,

  obtenida_en         timestamptz not null default now(),
  expira_en           timestamptz not null,

  constraint uq_resena_externa_negocio_plataforma unique (negocio_id, plataforma),
  constraint ck_resena_externa_calificacion check (calificacion is null or calificacion between 1.0 and 5.0),
  constraint ck_resena_externa_expira_despues check (expira_en > obtenida_en)
);

comment on table directorio.resena_externa is
  'Nota y numero de resenas que otras plataformas tienen de un negocio. Es un dato factual agregado, se muestra SIEMPRE atribuido y enlazado a la fuente, y no entra en el promedio propio. Sirve para que una ficha recien nacida ya le diga algo util a quien la visita.';
comment on column directorio.resena_externa.expira_en is
  'Vencimiento del cache. Google Places no permite guardar sus datos de forma indefinida, asi que la fila se refresca o se deja de mostrar. Sin este campo el cumplimiento queda en la buena memoria de alguien.';
comment on column directorio.resena_externa.url_fuente is
  'Enlace a la ficha original. Obligatorio: sin el, mostrar la nota ajena no es cita, es apropiacion.';

create index idx_resena_externa_negocio_id on directorio.resena_externa (negocio_id);
create index idx_resena_externa_expira_en  on directorio.resena_externa (expira_en);

create table directorio.resena_externa_extracto (
  id                  uuid primary key default gen_random_uuid(),
  resena_externa_id   uuid not null references directorio.resena_externa (id) on delete cascade,

  autor_nombre        text not null,
  autor_avatar_url    text,
  autor_url           text,
  calificacion        smallint,
  texto               text not null,
  publicada_en        timestamptz,
  url_original        text not null,

  creado_en           timestamptz not null default now(),

  constraint ck_resena_externa_extracto_calificacion check (calificacion is null or calificacion between 1 and 5)
);

comment on table directorio.resena_externa_extracto is
  'Las hasta cinco resenas con texto que entrega Google Places. Se guardan solo mientras su resena_externa siga vigente y se muestran con el nombre del autor, la atribucion a Google y enlace a la original, que es lo que exigen sus terminos. Nunca se raspa texto de Tripadvisor ni de Booking para esta tabla.';

create index idx_resena_externa_extracto_padre on directorio.resena_externa_extracto (resena_externa_id);

-- ---------------------------------------------------------------------------
-- reclamo_negocio  /  redireccion
-- ---------------------------------------------------------------------------

create table directorio.reclamo_negocio (
  id                    uuid primary key default gen_random_uuid(),
  negocio_id            uuid not null references directorio.negocio (id) on delete cascade,
  solicitante_id        uuid not null references directorio.perfil (id) on delete cascade,

  estado                directorio.estado_reclamo not null default 'pendiente',
  email_comprobacion    text not null,
  cargo                 text,
  mensaje               text,

  revisado_por          uuid references directorio.perfil (id) on delete set null,
  revisado_en           timestamptz,
  motivo_rechazo        text,

  creado_en             timestamptz not null default now(),

  constraint ck_reclamo_rechazo_con_motivo check (estado <> 'rechazado' or motivo_rechazo is not null)
);

comment on table directorio.reclamo_negocio is
  'Solicitud de un dueno para tomar control de la ficha de su negocio. Se aprueba comprobando que el correo pertenezca al dominio del sitio web de la ficha, o por llamada al telefono publicado. Aprobar un reclamo pone el negocio en estado_verificacion reclamado.';

create index idx_reclamo_negocio_negocio_id on directorio.reclamo_negocio (negocio_id);
create index idx_reclamo_negocio_estado     on directorio.reclamo_negocio (estado);
create unique index uq_reclamo_negocio_pendiente
  on directorio.reclamo_negocio (negocio_id) where estado = 'pendiente';

create table directorio.redireccion (
  id            uuid primary key default gen_random_uuid(),
  babosa_vieja  text not null,
  babosa_nueva  text not null,
  idioma        char(2) not null,
  creado_en     timestamptz not null default now(),

  constraint uq_redireccion_babosa_vieja unique (babosa_vieja, idioma),
  constraint ck_redireccion_idioma check (idioma in ('es', 'en')),
  constraint ck_redireccion_distintas check (babosa_vieja <> babosa_nueva)
);

comment on table directorio.redireccion is
  'Babosas retiradas y a donde apuntan ahora, para servir un 301. Una URL publicada e indexada nunca debe morir en un 404: eso tira a la basura el posicionamiento que costo meses conseguir.';
