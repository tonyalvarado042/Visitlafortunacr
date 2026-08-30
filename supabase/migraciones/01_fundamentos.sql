-- visitlafortunacr | Migracion 01: fundamentos del esquema directorio
-- Crea el esquema aislado, los tipos enumerados del dominio, y las tablas
-- que no dependen de ninguna otra: categoria, etiqueta y perfil.

create schema if not exists directorio;

comment on schema directorio is
  'Directorio turistico de La Fortuna (visitlafortunacr). Aislado a proposito del esquema public, donde viven el CRM y Humaya, que no tienen relacion con este sitio.';

-- ---------------------------------------------------------------------------
-- Tipos enumerados
-- ---------------------------------------------------------------------------

create type directorio.estado_publicacion as enum ('borrador', 'pendiente', 'publicado', 'archivado');
create type directorio.estado_verificacion as enum ('pendiente', 'parcial', 'verificado', 'reclamado');
create type directorio.fuente_dato as enum ('siembra_manual', 'google_places', 'sitio_del_negocio', 'duenno');
create type directorio.plataforma_externa as enum ('google', 'tripadvisor', 'booking', 'facebook');
create type directorio.estado_resena as enum ('pendiente', 'publicada', 'rechazada', 'oculta');
create type directorio.rango_precio as enum ('economico', 'moderado', 'alto', 'lujo');
create type directorio.estado_reclamo as enum ('pendiente', 'aprobado', 'rechazado');
create type directorio.rol_perfil as enum ('visitante', 'colaborador', 'duenno_negocio', 'moderador', 'admin');
create type directorio.grupo_etiqueta as enum ('servicio', 'ambiente', 'accesibilidad', 'publico', 'pago');

-- ---------------------------------------------------------------------------
-- categoria
-- ---------------------------------------------------------------------------

create table directorio.categoria (
  id              uuid primary key default gen_random_uuid(),
  padre_id        uuid references directorio.categoria (id) on delete restrict,

  babosa_es       text not null,
  babosa_en       text not null,
  nombre_es       text not null,
  nombre_en       text not null,
  descripcion_es  text,
  descripcion_en  text,

  icono           text,
  color_hex       text,
  orden           smallint not null default 0,
  es_visible      boolean  not null default true,

  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),

  constraint uq_categoria_babosa_es unique (babosa_es),
  constraint uq_categoria_babosa_en unique (babosa_en),
  constraint ck_categoria_color_hex check (color_hex is null or color_hex ~ '^#[0-9a-fA-F]{6}$'),
  constraint ck_categoria_no_es_su_propio_padre check (padre_id is null or padre_id <> id)
);

comment on table directorio.categoria is
  'Categorias del directorio: hoteles, restaurantes, tours, atracciones, parques, transporte y comercio. Jerarquica via padre_id, para que "canopy" pueda colgar de "tours". No es una lista de etiquetas: un negocio pertenece a UNA categoria y lleva N etiquetas.';
comment on column directorio.categoria.babosa_es is
  'Identificador legible en la URL en espanol (/es/hoteles). Nunca cambia una vez publicado.';
comment on column directorio.categoria.orden is
  'Orden de aparicion en el menu. Menor primero.';

create index idx_categoria_padre_id on directorio.categoria (padre_id);

-- ---------------------------------------------------------------------------
-- etiqueta
-- ---------------------------------------------------------------------------

create table directorio.etiqueta (
  id              uuid primary key default gen_random_uuid(),
  grupo           directorio.grupo_etiqueta not null,

  babosa          text not null,
  nombre_es       text not null,
  nombre_en       text not null,
  icono           text,

  creado_en       timestamptz not null default now(),

  constraint uq_etiqueta_babosa unique (babosa)
);

comment on table directorio.etiqueta is
  'Rasgos transversales que un visitante usa para filtrar: wifi, acepta mascotas, vista al volcan, accesible en silla de ruedas. Un negocio de cualquier categoria puede llevarlas. Distinta de categoria, que es una sola por negocio.';

create index idx_etiqueta_grupo on directorio.etiqueta (grupo);

-- ---------------------------------------------------------------------------
-- perfil
-- ---------------------------------------------------------------------------

create table directorio.perfil (
  id                  uuid primary key references auth.users (id) on delete cascade,

  babosa              text not null,
  nombre_visible      text not null,
  avatar_url          text,
  biografia           text,
  pais                text,
  rol                 directorio.rol_perfil not null default 'visitante',

  total_resenas       integer not null default 0,
  total_fotos         integer not null default 0,

  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),

  constraint uq_perfil_babosa unique (babosa),
  constraint ck_perfil_pais_iso check (pais is null or pais ~ '^[A-Z]{2}$')
);

comment on table directorio.perfil is
  'Persona que usa el sitio: deja resenas, sube fotos o administra un negocio. Extiende auth.users de Supabase con lo publico; el correo y la contrasena siguen viviendo en auth.users y no se copian aqui.';
comment on column directorio.perfil.rol is
  'visitante lee; colaborador ha dejado al menos una resena; duenno_negocio administra fichas reclamadas; moderador aprueba resenas; admin todo.';
comment on column directorio.perfil.total_resenas is
  'Contador desnormalizado que mantiene un trigger. No se escribe a mano.';
