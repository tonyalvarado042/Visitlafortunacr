-- Plataforma de destinos | 01: fundamentos
-- Una sola base para cientos de destinos. El destino es una fila, no un
-- despliegue: lanzar visitmonteverdecr.com es insertar en dst_destino.
-- Convencion: esquema propio + prefijo dst_, como el CRM usa cta_.

create schema if not exists destinos;

comment on schema destinos is
  'Plataforma de destinos turisticos: sitio publico y CRM propio, multi-destino desde el diseno. Independiente del CRM de inversionistas a proposito: un viajero y un copropietario no comparten llave de identidad, ni embudo, ni ciclo de vida.';

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type destinos.estado_publicacion  as enum ('borrador','pendiente','publicado','archivado');
create type destinos.estado_verificacion as enum ('pendiente','parcial','verificado','reclamado');
create type destinos.fuente_dato         as enum ('siembra_manual','google_places','sitio_del_negocio','duenno','equipo');
create type destinos.plataforma_externa  as enum ('google','tripadvisor','booking','facebook');
create type destinos.estado_resena       as enum ('pendiente','publicada','rechazada','oculta');
create type destinos.rango_precio        as enum ('economico','moderado','alto','lujo');
create type destinos.grupo_etiqueta      as enum ('servicio','ambiente','accesibilidad','publico','pago');
create type destinos.rol_usuario         as enum ('admin','editor','vendedor','moderador','socio');
create type destinos.nivel_membresia     as enum ('gratis','pro','destacado');

create type destinos.etapa_comercial as enum (
  'nuevo','contactado','propuesta_enviada','negociacion','reservado','perdido'
);

create type destinos.tipo_solicitud as enum (
  'itinerario','tour','hospedaje','transporte','consulta_general','reclamo_ficha'
);

create type destinos.estado_reserva as enum (
  'solicitada','confirmada','pagada','completada','cancelada','no_show'
);

create type destinos.estado_pago as enum ('pendiente','parcial','pagado','reembolsado','fallido');
create type destinos.canal_mensaje as enum ('email','whatsapp','llamada','web','nota_interna');
create type destinos.direccion_mensaje as enum ('entrante','saliente');
create type destinos.tipo_viajero as enum ('pareja','familia','amigos','solo','grupo','negocios');
create type destinos.presupuesto_viaje as enum ('economico','medio','alto','lujo');

-- ---------------------------------------------------------------------------
-- dst_destino  -- la fila que vale un sitio entero
-- ---------------------------------------------------------------------------

create table destinos.dst_destino (
  id                 uuid primary key default gen_random_uuid(),

  babosa             text not null,
  nombre             text not null,
  nombre_largo       text,
  dominio            text not null,

  pais_iso           char(2) not null,
  pais_nombre        text    not null,
  region             text,
  zona_horaria       text    not null,

  marca_nombre       text not null,
  marca_sigla        text,
  lema_es            text,
  lema_en            text,

  idioma_principal   char(2) not null default 'es',
  idiomas            text[]  not null default array['es','en'],
  moneda_iso         char(3) not null,
  moneda_visitante   char(3),

  latitud            numeric(10,7),
  longitud           numeric(10,7),
  zoom_mapa          smallint not null default 12,

  color_tinta        text not null default '#0B0B0B',
  color_acento       text not null default '#FF6A00',
  color_naturaleza   text not null default '#66BB2E',
  color_gris         text not null default '#333333',
  tipografia         text not null default 'Montserrat',

  logo_url           text,
  favicon_url        text,
  video_portada_url  text,
  imagen_portada_url text,

  whatsapp           text,
  email_contacto     text,
  comision_por_defecto numeric(5,2) not null default 20.00,

  esta_activo        boolean not null default false,
  lanzado_el         date,

  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now(),

  constraint uq_dst_destino_babosa  unique (babosa),
  constraint uq_dst_destino_dominio unique (dominio),
  constraint ck_dst_destino_pais    check (pais_iso ~ '^[A-Z]{2}$'),
  constraint ck_dst_destino_moneda  check (moneda_iso ~ '^[A-Z]{3}$'),
  constraint ck_dst_destino_idioma  check (idioma_principal = any (idiomas)),
  constraint ck_dst_destino_whatsapp check (whatsapp is null or whatsapp ~ '^\+[1-9][0-9]{6,14}$'),
  constraint ck_dst_destino_comision check (comision_por_defecto between 0 and 100),
  constraint ck_dst_destino_colores check (
    color_tinta ~ '^#[0-9a-fA-F]{6}$' and color_acento ~ '^#[0-9a-fA-F]{6}$'
    and color_naturaleza ~ '^#[0-9a-fA-F]{6}$' and color_gris ~ '^#[0-9a-fA-F]{6}$'
  )
);

comment on table destinos.dst_destino is
  'Un destino = un sitio publicado. Esta fila es TODO lo que distingue visitlafortunacr.com de visitmonteverdecr.com: dominio, marca, colores, idiomas, moneda y centro del mapa. El codigo del sitio es uno solo y lo lee de aqui. Lanzar un destino nuevo es insertar aqui, no desplegar otro proyecto.';

comment on column destinos.dst_destino.dominio is
  'Con este dominio el sitio resuelve, en cada peticion, que destino esta sirviendo. Es la llave del multi-destino.';
comment on column destinos.dst_destino.idiomas is
  'Idiomas publicados, en orden. El primero es el de respaldo cuando falta una traduccion.';
comment on column destinos.dst_destino.moneda_visitante is
  'Moneda en la que piensa el visitante tipico. En Costa Rica es USD aunque se cobre en colones.';
comment on column destinos.dst_destino.color_acento is
  'El color de los llamados a la accion. El codigo del sitio no trae colores propios: los lee de aqui, y por eso otro destino puede tener otra paleta sin tocar una linea.';
comment on column destinos.dst_destino.comision_por_defecto is
  'Porcentaje que cobra la plataforma cuando un tour no define el suyo.';
comment on column destinos.dst_destino.esta_activo is
  'false mientras se carga el contenido. El sitio no se sirve al publico hasta encenderlo.';

create index idx_dst_destino_activo on destinos.dst_destino (esta_activo) where esta_activo;

-- ---------------------------------------------------------------------------
-- dst_categoria  -- catalogo GLOBAL, compartido por todos los destinos
-- ---------------------------------------------------------------------------
-- "Hoteles" significa lo mismo en La Fortuna que en Tamarindo. Lo que cambia
-- es CUALES aplican: Tamarindo enciende surf, Monteverde bosque nuboso.
-- Sin esto, cada destino nuevo obligaria a recrear el arbol entero a mano,
-- y "replicar con un clic" seria mentira.

create table destinos.dst_categoria (
  id             uuid primary key default gen_random_uuid(),
  padre_id       uuid references destinos.dst_categoria (id) on delete restrict,

  babosa_es      text not null,
  babosa_en      text not null,
  nombre_es      text not null,
  nombre_en      text not null,
  descripcion_es text,
  descripcion_en text,

  seccion        text not null,
  icono          text,
  orden          smallint not null default 0,

  creado_en      timestamptz not null default now(),

  constraint uq_dst_categoria_babosa_es unique (babosa_es),
  constraint uq_dst_categoria_babosa_en unique (babosa_en),
  constraint ck_dst_categoria_seccion check (seccion in (
    'que_hacer','tours','donde_dormir','comer_beber','explorar','transporte'
  )),
  constraint ck_dst_categoria_padre check (padre_id is null or padre_id <> id)
);

comment on table destinos.dst_categoria is
  'Catalogo global de categorias, compartido por todos los destinos. Jerarquico via padre_id. Un negocio pertenece a UNA categoria y lleva N etiquetas.';
comment on column destinos.dst_categoria.seccion is
  'A que menu del sitio pertenece: que_hacer, tours, donde_dormir, comer_beber, explorar o transporte. Ordena la navegacion sin que cada destino la reinvente.';

create index idx_dst_categoria_padre   on destinos.dst_categoria (padre_id);
create index idx_dst_categoria_seccion on destinos.dst_categoria (seccion);

create table destinos.dst_destino_categoria (
  destino_id      uuid not null references destinos.dst_destino (id)   on delete cascade,
  categoria_id    uuid not null references destinos.dst_categoria (id) on delete restrict,

  orden           smallint not null default 0,
  nombre_local_es text,
  nombre_local_en text,
  es_visible      boolean not null default true,

  creado_en       timestamptz not null default now(),

  primary key (destino_id, categoria_id)
);

comment on table destinos.dst_destino_categoria is
  'Que categorias del catalogo global enciende cada destino, en que orden y con que nombre local. Los nombres locales sirven cuando el destino le dice distinto a lo mismo.';

create index idx_dst_destino_categoria_cat on destinos.dst_destino_categoria (categoria_id);

-- ---------------------------------------------------------------------------
-- dst_etiqueta  -- tambien global
-- ---------------------------------------------------------------------------

create table destinos.dst_etiqueta (
  id        uuid primary key default gen_random_uuid(),
  grupo     destinos.grupo_etiqueta not null,

  babosa    text not null,
  nombre_es text not null,
  nombre_en text not null,
  icono     text,

  creado_en timestamptz not null default now(),

  constraint uq_dst_etiqueta_babosa unique (babosa)
);

comment on table destinos.dst_etiqueta is
  'Rasgos con los que el visitante filtra: wifi, acepta mascotas, apto para ninos, accesible en silla de ruedas. Globales, porque significan lo mismo en cualquier destino. Distintas de categoria, que es una sola por negocio.';

create index idx_dst_etiqueta_grupo on destinos.dst_etiqueta (grupo);

-- ---------------------------------------------------------------------------
-- dst_usuario  -- el equipo que entra a /admin
-- ---------------------------------------------------------------------------

create table destinos.dst_usuario (
  id             uuid primary key references auth.users (id) on delete cascade,

  nombre         text not null,
  email          text not null,
  telefono       text,
  rol            destinos.rol_usuario not null default 'vendedor',
  foto_url       text,

  destinos_ids   uuid[] not null default '{}',
  meta_mensual   numeric(12,2),
  esta_activo    boolean not null default true,

  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint uq_dst_usuario_email unique (email)
);

comment on table destinos.dst_usuario is
  'Quien puede entrar al panel en /admin. Distinto de dst_viajero, que es el turista: aca vive el equipo. Un vendedor solo ve los destinos listados en destinos_ids; un admin con el arreglo vacio los ve todos.';
comment on column destinos.dst_usuario.destinos_ids is
  'A que destinos tiene acceso. Vacio en un admin significa todos. Es lo que permite que un vendedor de Monteverde no vea la cartera de La Fortuna.';
