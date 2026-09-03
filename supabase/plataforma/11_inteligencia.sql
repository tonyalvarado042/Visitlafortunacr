-- Plataforma de destinos | 11: inteligencia
-- Lo que convierte esto en algo mas que un CRM: la IA lee de aqui, escribe
-- aqui, y todo lo que hace queda registrado con su costo. Sigue las reglas
-- del cerebro: todo cuelga de destino_id, prefijo dst_, singular, espanol.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Quien es administrador. Complementa es_del_equipo() y tiene_acceso_a().
-- ---------------------------------------------------------------------------
create or replace function destinos.es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from destinos.dst_usuario u
     where u.id = (select auth.uid()) and u.esta_activo and u.rol = 'admin'
  );
$$;
comment on function destinos.es_admin is
  'true si quien llama es un usuario activo con rol admin. Es lo que abre invitaciones, roles y agentes.';

-- ---------------------------------------------------------------------------
-- 1. Conocimiento: lo que la IA sabe de un destino
-- ---------------------------------------------------------------------------
create table destinos.dst_conocimiento (
  id                uuid primary key default gen_random_uuid(),
  destino_id        uuid not null references destinos.dst_destino(id) on delete cascade,
  tipo              text not null default 'dato'
                    check (tipo in ('dato','faq','politica','guion','regla','aviso','negocio','tour')),
  titulo            text not null,
  contenido         text not null,
  idioma            char(2) not null default 'es',
  etiquetas         text[] not null default '{}',
  negocio_id        uuid references destinos.dst_negocio(id) on delete cascade,
  tour_id           uuid references destinos.dst_tour(id) on delete cascade,
  prioridad         smallint not null default 0 check (prioridad between 0 and 10),
  para_concierge    boolean not null default true,
  para_planificador boolean not null default true,
  fuente            text,
  esta_verificado   boolean not null default false,
  esta_activo       boolean not null default true,
  vigente_hasta     date,
  busqueda          tsvector,
  creado_por        uuid references destinos.dst_usuario(id) on delete set null,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now()
);
comment on table destinos.dst_conocimiento is
  'Base de conocimiento por destino: datos, preguntas frecuentes, politicas, guiones de venta, reglas y avisos temporales que la IA usa para responder y planificar. NO es contenido publico ni una guia: es lo que el agente sabe. prioridad 10 = se incluye siempre; vigente_hasta = dejar de usarlo despues de esa fecha.';

create index dst_conocimiento_busqueda_idx on destinos.dst_conocimiento using gin (busqueda);
create index dst_conocimiento_titulo_trgm_idx on destinos.dst_conocimiento using gin (titulo extensions.gin_trgm_ops);
create index dst_conocimiento_destino_idx on destinos.dst_conocimiento (destino_id, esta_activo, prioridad desc);
create index dst_conocimiento_etiquetas_idx on destinos.dst_conocimiento using gin (etiquetas);

create or replace function destinos.indexar_conocimiento() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_config regconfig;
begin
  select i.config_texto into v_config from destinos.dst_idioma i where i.codigo = new.idioma;
  v_config := coalesce(v_config, 'simple'::regconfig);
  new.busqueda :=
       setweight(to_tsvector(v_config, coalesce(new.titulo, '')), 'A')
    || setweight(to_tsvector(v_config, coalesce(new.contenido, '')), 'B')
    || setweight(to_tsvector('simple', coalesce(array_to_string(new.etiquetas, ' '), '')), 'A');
  return new;
end;
$$;

create trigger dst_conocimiento_indexar
  before insert or update of titulo, contenido, etiquetas, idioma on destinos.dst_conocimiento
  for each row execute function destinos.indexar_conocimiento();
create trigger dst_conocimiento_marca_tiempo
  before update on destinos.dst_conocimiento
  for each row execute function destinos.actualizar_marca_tiempo();

-- ---------------------------------------------------------------------------
-- 2. Agentes: la configuracion de cada IA, por destino
-- ---------------------------------------------------------------------------
create table destinos.dst_agente (
  id              uuid primary key default gen_random_uuid(),
  destino_id      uuid not null references destinos.dst_destino(id) on delete cascade,
  clave           text not null check (clave in ('concierge','planificador','seguimiento','analista','redactor')),
  nombre          text not null,
  modelo          text not null default 'claude-opus-5',
  esfuerzo        text not null default 'medium' check (esfuerzo in ('low','medium','high','xhigh','max')),
  max_tokens      integer not null default 4000 check (max_tokens between 256 and 64000),
  instrucciones   text,
  tono            text,
  max_iteraciones smallint not null default 8 check (max_iteraciones between 1 and 20),
  puede_escalar   boolean not null default true,
  escala_a        uuid references destinos.dst_usuario(id) on delete set null,
  reglas          jsonb not null default '{}'::jsonb,
  esta_activo     boolean not null default true,
  version         integer not null default 1,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  unique (destino_id, clave)
);
comment on table destinos.dst_agente is
  'Un agente de IA por funcion y por destino: concierge (conversa con el viajero), planificador (arma itinerarios), seguimiento (redacta y puntua prospectos), analista (resume y califica conversaciones), redactor (borradores de guias). Las instrucciones aqui se suman al prompt base del codigo; el modelo y el esfuerzo se cambian desde el panel sin desplegar. NO guarda claves de API.';

create trigger dst_agente_marca_tiempo
  before update on destinos.dst_agente
  for each row execute function destinos.actualizar_marca_tiempo();

-- ---------------------------------------------------------------------------
-- 3. Conversaciones: un hilo por viajero y canal
-- ---------------------------------------------------------------------------
create table destinos.dst_conversacion (
  id                     uuid primary key default gen_random_uuid(),
  destino_id             uuid not null references destinos.dst_destino(id) on delete cascade,
  viajero_id             uuid references destinos.dst_viajero(id) on delete set null,
  solicitud_id           uuid references destinos.dst_solicitud(id) on delete set null,
  canal                  destinos.canal_mensaje not null,
  identificador_externo  text,
  idioma                 char(2) not null default 'es',
  estado                 text not null default 'abierta'
                         check (estado in ('abierta','esperando_viajero','esperando_equipo','escalada','cerrada')),
  atendida_por           text not null default 'ia' check (atendida_por in ('ia','humano')),
  responsable_id         uuid references destinos.dst_usuario(id) on delete set null,
  agente_id              uuid references destinos.dst_agente(id) on delete set null,
  resumen_ia             text,
  sentimiento            text check (sentimiento in ('positivo','neutral','negativo')),
  intencion              text,
  requiere_revision      boolean not null default false,
  motivo_revision        text,
  calificacion_revision  smallint check (calificacion_revision between 1 and 5),
  nota_revision          text,
  revisada_por           uuid references destinos.dst_usuario(id) on delete set null,
  revisada_en            timestamptz,
  total_mensajes         integer not null default 0,
  ultimo_mensaje_en      timestamptz,
  ultimo_mensaje_de      text check (ultimo_mensaje_de in ('viajero','ia','equipo','sistema')),
  metadatos              jsonb not null default '{}'::jsonb,
  creado_en              timestamptz not null default now(),
  actualizado_en         timestamptz not null default now(),
  cerrada_en             timestamptz
);
comment on table destinos.dst_conversacion is
  'El hilo entre un viajero y el destino en un canal (web, WhatsApp, correo). atendida_por dice si responde la IA o una persona; escalada = la IA pidio ayuda; requiere_revision = alguien del equipo debe leerla. Las calificaciones de revision alimentan la mejora del agente. NO es el mensaje: los mensajes viven en dst_mensaje.';

create unique index dst_conversacion_externa_abierta_idx
  on destinos.dst_conversacion (destino_id, canal, identificador_externo)
  where identificador_externo is not null and estado <> 'cerrada';
create index dst_conversacion_bandeja_idx
  on destinos.dst_conversacion (destino_id, estado, ultimo_mensaje_en desc);
create index dst_conversacion_viajero_idx on destinos.dst_conversacion (viajero_id);
create index dst_conversacion_revision_idx
  on destinos.dst_conversacion (destino_id, requiere_revision) where requiere_revision;

create trigger dst_conversacion_marca_tiempo
  before update on destinos.dst_conversacion
  for each row execute function destinos.actualizar_marca_tiempo();

-- ---------------------------------------------------------------------------
-- 4. Ejecuciones de IA: cada llamada al modelo, con tokens y costo
-- ---------------------------------------------------------------------------
create table destinos.dst_agente_ejecucion (
  id                      uuid primary key default gen_random_uuid(),
  destino_id              uuid not null references destinos.dst_destino(id) on delete cascade,
  agente_id               uuid references destinos.dst_agente(id) on delete set null,
  clave_agente            text not null,
  conversacion_id         uuid references destinos.dst_conversacion(id) on delete set null,
  solicitud_id            uuid references destinos.dst_solicitud(id) on delete set null,
  viajero_id              uuid references destinos.dst_viajero(id) on delete set null,
  itinerario_id           uuid references destinos.dst_itinerario(id) on delete set null,
  origen                  text not null default 'panel'
                          check (origen in ('web','whatsapp','email','panel','cron','api')),
  solicitado_por          uuid references destinos.dst_usuario(id) on delete set null,
  modelo                  text not null,
  esfuerzo                text,
  entrada_tokens          integer not null default 0,
  salida_tokens           integer not null default 0,
  cache_lectura_tokens    integer not null default 0,
  cache_escritura_tokens  integer not null default 0,
  costo_usd               numeric(10,6) not null default 0,
  duracion_ms             integer,
  iteraciones             smallint not null default 1,
  herramientas_usadas     text[] not null default '{}',
  motivo_parada           text,
  resultado               jsonb,
  error                   text,
  creado_en               timestamptz not null default now()
);
comment on table destinos.dst_agente_ejecucion is
  'Bitacora de cada ejecucion de un agente: modelo, tokens, costo estimado, herramientas usadas y resultado. Es lo que permite ver cuanto cuesta la IA por destino y por mes, y revisar por que respondio lo que respondio. NO se borra: es auditoria.';

create index dst_agente_ejecucion_destino_idx on destinos.dst_agente_ejecucion (destino_id, creado_en desc);
create index dst_agente_ejecucion_conversacion_idx on destinos.dst_agente_ejecucion (conversacion_id);
create index dst_agente_ejecucion_solicitud_idx on destinos.dst_agente_ejecucion (solicitud_id);

-- ---------------------------------------------------------------------------
-- 5. Mensajes: se cuelgan de la conversacion y saben quien los escribio
-- ---------------------------------------------------------------------------
alter table destinos.dst_mensaje
  add column conversacion_id uuid references destinos.dst_conversacion(id) on delete cascade,
  add column autor           text not null default 'equipo' check (autor in ('viajero','ia','equipo','sistema')),
  add column agente_id       uuid references destinos.dst_agente(id) on delete set null,
  add column ejecucion_id    uuid references destinos.dst_agente_ejecucion(id) on delete set null,
  add column estado_envio    text not null default 'enviado'
                             check (estado_envio in ('pendiente','enviado','entregado','leido','fallido')),
  add column error_envio     text,
  add column metadatos       jsonb not null default '{}'::jsonb;

create index dst_mensaje_conversacion_idx on destinos.dst_mensaje (conversacion_id, enviado_en);
create unique index dst_mensaje_externo_idx on destinos.dst_mensaje (canal, id_externo) where id_externo is not null;

-- ---------------------------------------------------------------------------
-- 6. Plantillas de mensaje, por destino, canal e idioma
-- ---------------------------------------------------------------------------
create table destinos.dst_plantilla_mensaje (
  id             uuid primary key default gen_random_uuid(),
  destino_id     uuid not null references destinos.dst_destino(id) on delete cascade,
  clave          text not null,
  canal          destinos.canal_mensaje not null default 'whatsapp',
  idioma         char(2) not null default 'es',
  asunto         text,
  cuerpo         text not null,
  esta_activa    boolean not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (destino_id, clave, canal, idioma)
);
comment on table destinos.dst_plantilla_mensaje is
  'Textos listos para enviar, con variables entre llaves dobles ({{nombre}}, {{destino}}, {{llega_el}}, {{enlace_itinerario}}). Si falta el idioma del viajero se cae al principal del destino. NO es una plantilla aprobada de Meta: eso se configura aparte y se referencia en parametros de la automatizacion.';

create trigger dst_plantilla_mensaje_marca_tiempo
  before update on destinos.dst_plantilla_mensaje
  for each row execute function destinos.actualizar_marca_tiempo();

-- ---------------------------------------------------------------------------
-- 7. Automatizaciones: reglas de seguimiento, y su registro
-- ---------------------------------------------------------------------------
create table destinos.dst_automatizacion (
  id                   uuid primary key default gen_random_uuid(),
  destino_id           uuid not null references destinos.dst_destino(id) on delete cascade,
  clave                text not null,
  nombre               text not null,
  descripcion          text,
  disparador           text not null
                       check (disparador in ('solicitud_nueva','sin_respuesta','antes_de_llegar','despues_de_salir','conversacion_inactiva','etapa','puntaje')),
  condiciones          jsonb not null default '{}'::jsonb,
  accion               text not null
                       check (accion in ('enviar_plantilla','mensaje_ia','crear_tarea','cambiar_etapa','avisar_equipo','puntuar')),
  parametros           jsonb not null default '{}'::jsonb,
  retraso_horas        numeric(7,2) not null default 0,
  maximo_por_solicitud smallint not null default 1,
  requiere_aprobacion  boolean not null default false,
  orden                smallint not null default 0,
  esta_activa          boolean not null default true,
  creado_en            timestamptz not null default now(),
  actualizado_en       timestamptz not null default now(),
  unique (destino_id, clave)
);
comment on table destinos.dst_automatizacion is
  'Reglas de seguimiento: cuando pasa X (disparador + condiciones) se hace Y (accion + parametros) con tanto retraso. requiere_aprobacion = la IA prepara el borrador y una persona lo aprueba desde el panel. NO ejecuta nada por si misma: el cron de /api/cron/automatizaciones la lee.';

create trigger dst_automatizacion_marca_tiempo
  before update on destinos.dst_automatizacion
  for each row execute function destinos.actualizar_marca_tiempo();

create table destinos.dst_automatizacion_envio (
  id                uuid primary key default gen_random_uuid(),
  automatizacion_id uuid not null references destinos.dst_automatizacion(id) on delete cascade,
  destino_id        uuid not null references destinos.dst_destino(id) on delete cascade,
  solicitud_id      uuid references destinos.dst_solicitud(id) on delete cascade,
  viajero_id        uuid references destinos.dst_viajero(id) on delete cascade,
  conversacion_id   uuid references destinos.dst_conversacion(id) on delete set null,
  intento           smallint not null default 1,
  estado            text not null default 'programado'
                    check (estado in ('programado','pendiente_aprobacion','hecho','omitido','fallido','cancelado')),
  programado_para   timestamptz not null default now(),
  ejecutado_en      timestamptz,
  borrador          text,
  resultado         text,
  mensaje_id        uuid references destinos.dst_mensaje(id) on delete set null,
  tarea_id          uuid references destinos.dst_tarea(id) on delete set null,
  ejecucion_id      uuid references destinos.dst_agente_ejecucion(id) on delete set null,
  aprobado_por      uuid references destinos.dst_usuario(id) on delete set null,
  creado_en         timestamptz not null default now(),
  unique (automatizacion_id, solicitud_id, intento)
);
comment on table destinos.dst_automatizacion_envio is
  'Cada vez que una automatizacion se programa para una solicitud queda una fila: es lo que garantiza que un seguimiento no se mande dos veces. borrador = texto que la IA propuso y espera aprobacion.';

create index dst_automatizacion_envio_pendiente_idx
  on destinos.dst_automatizacion_envio (estado, programado_para)
  where estado in ('programado','pendiente_aprobacion');

-- ---------------------------------------------------------------------------
-- 8. Canales: por donde habla cada destino (WhatsApp, correo, web)
-- ---------------------------------------------------------------------------
create table destinos.dst_canal (
  id               uuid primary key default gen_random_uuid(),
  destino_id       uuid not null references destinos.dst_destino(id) on delete cascade,
  tipo             destinos.canal_mensaje not null,
  proveedor        text not null check (proveedor in ('meta','resend','web','manual')),
  identificador    text,
  nombre_visible   text,
  variable_secreto text,
  esta_activo      boolean not null default true,
  creado_en        timestamptz not null default now(),
  unique (destino_id, tipo, proveedor)
);
comment on table destinos.dst_canal is
  'Como habla cada destino: el phone_number_id de WhatsApp Cloud API, el remitente de correo, el chat web. variable_secreto es el NOMBRE de la variable de entorno que trae el token; el secreto nunca vive en la base. Con esto un webhook sabe a que destino pertenece un mensaje.';

create unique index dst_canal_identificador_idx
  on destinos.dst_canal (proveedor, identificador) where identificador is not null;

-- ---------------------------------------------------------------------------
-- 9. Historial de etapa y auditoria
-- ---------------------------------------------------------------------------
create table destinos.dst_etapa_historial (
  id           bigint generated always as identity primary key,
  solicitud_id uuid not null references destinos.dst_solicitud(id) on delete cascade,
  destino_id   uuid not null,
  de_etapa     destinos.etapa_comercial,
  a_etapa      destinos.etapa_comercial not null,
  usuario_id   uuid,
  actor        text,
  motivo       text,
  creado_en    timestamptz not null default now()
);
comment on table destinos.dst_etapa_historial is
  'Cada cambio de etapa de una solicitud, con quien lo hizo. De aqui salen el embudo, el tiempo por etapa y la tasa de cierre por vendedor.';
create index dst_etapa_historial_solicitud_idx on destinos.dst_etapa_historial (solicitud_id, creado_en);
create index dst_etapa_historial_destino_idx on destinos.dst_etapa_historial (destino_id, creado_en desc);

create table destinos.dst_auditoria (
  id         bigint generated always as identity primary key,
  destino_id uuid,
  usuario_id uuid,
  actor      text not null,
  accion     text not null,
  entidad    text not null,
  entidad_id uuid,
  antes      jsonb,
  despues    jsonb,
  creado_en  timestamptz not null default now()
);
comment on table destinos.dst_auditoria is
  'Quien cambio que y cuando en las tablas sensibles (solicitudes, reservas, usuarios, agentes, negocios). Solo guarda las columnas que cambiaron. actor = uuid del usuario, o el nombre del proceso cuando fue la IA o el cron. NO es bitacora de la IA: eso es dst_agente_ejecucion.';
create index dst_auditoria_entidad_idx on destinos.dst_auditoria (entidad, entidad_id, creado_en desc);
create index dst_auditoria_destino_idx on destinos.dst_auditoria (destino_id, creado_en desc);

-- ---------------------------------------------------------------------------
-- 10. Invitaciones al equipo
-- ---------------------------------------------------------------------------
create table destinos.dst_invitacion (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  nombre       text,
  rol          destinos.rol_usuario not null default 'vendedor',
  destinos_ids uuid[] not null default '{}',
  invitado_por uuid references destinos.dst_usuario(id) on delete set null,
  aceptada_en  timestamptz,
  usuario_id   uuid references destinos.dst_usuario(id) on delete set null,
  vence_el     timestamptz not null default now() + interval '14 days',
  creado_en    timestamptz not null default now()
);
comment on table destinos.dst_invitacion is
  'Quien puede entrar al panel y con que rol. Cuando esa persona crea su cuenta (auth.users), un trigger la convierte en dst_usuario con el rol y los destinos de la invitacion. Sin invitacion, una cuenta nueva no ve nada. destinos_ids vacio = todos los destinos.';
create unique index dst_invitacion_pendiente_idx
  on destinos.dst_invitacion (lower(email)) where aceptada_en is null;

-- ---------------------------------------------------------------------------
-- 11. Columnas nuevas en tablas existentes
-- ---------------------------------------------------------------------------
alter table destinos.dst_solicitud
  add column puntaje_ia          smallint check (puntaje_ia between 0 and 100),
  add column temperatura         text check (temperatura in ('frio','tibio','caliente')),
  add column motivo_puntaje      text,
  add column resumen_ia          text,
  add column siguiente_accion    text,
  add column siguiente_accion_el timestamptz,
  add column puntuada_en         timestamptz,
  add column ultimo_contacto_en  timestamptz,
  add column ultimo_contacto_de  text check (ultimo_contacto_de in ('viajero','ia','equipo')),
  add column seguimientos        smallint not null default 0,
  add column origen_canal        destinos.canal_mensaje not null default 'web';

comment on column destinos.dst_solicitud.puntaje_ia is '0-100, calculado por el agente de seguimiento. El dinero no mueve la nota: esto mide probabilidad de cierre, no valor.';
comment on column destinos.dst_solicitud.siguiente_accion is 'Lo que la IA recomienda hacer ahora con este prospecto, en una frase.';

create index dst_solicitud_seguimiento_idx
  on destinos.dst_solicitud (destino_id, siguiente_accion_el)
  where etapa not in ('reservado','perdido');

alter table destinos.dst_viajero
  add column resumen_ia         text,
  add column ultimo_contacto_en timestamptz,
  add column no_molestar        boolean not null default false;
comment on column destinos.dst_viajero.no_molestar is 'true = ninguna automatizacion le escribe. Lo pone el viajero ("no me escriban mas") o el equipo.';

alter table destinos.dst_usuario
  add column ultimo_acceso_en timestamptz,
  add column invitado_por     uuid references destinos.dst_usuario(id) on delete set null;

alter table destinos.dst_itinerario
  add column solicitud_id uuid references destinos.dst_solicitud(id) on delete set null,
  add column idioma       char(2) not null default 'es',
  add column resumen      text,
  add column consejos     text,
  add column ejecucion_id uuid references destinos.dst_agente_ejecucion(id) on delete set null;

alter table destinos.dst_itinerario_parada
  add column nota               text,
  add column porque             text,
  add column costo_estimado_usd numeric(10,2);

-- ---------------------------------------------------------------------------
-- 12. Triggers de negocio
-- ---------------------------------------------------------------------------

-- Un mensaje mueve los contadores de su conversacion y de su solicitud.
create or replace function destinos.registrar_actividad_mensaje() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_momento timestamptz := coalesce(new.enviado_en, now());
begin
  if new.canal = 'nota_interna' then
    return new;
  end if;

  if new.conversacion_id is not null then
    update destinos.dst_conversacion c set
      total_mensajes    = c.total_mensajes + 1,
      ultimo_mensaje_en = v_momento,
      ultimo_mensaje_de = new.autor,
      estado = case
        when c.estado = 'escalada' then 'escalada'
        when new.autor = 'viajero' then 'esperando_equipo'
        when new.autor in ('ia','equipo') then 'esperando_viajero'
        else case when c.estado = 'cerrada' then 'abierta' else c.estado end
      end,
      cerrada_en = null
    where c.id = new.conversacion_id;
  end if;

  if new.solicitud_id is not null then
    update destinos.dst_solicitud s set
      ultimo_contacto_en = v_momento,
      ultimo_contacto_de = case when new.autor in ('viajero','ia','equipo') then new.autor else s.ultimo_contacto_de end,
      primera_respuesta_en = case
        when s.primera_respuesta_en is null and new.direccion = 'saliente' and new.autor in ('ia','equipo')
        then v_momento else s.primera_respuesta_en end,
      seguimientos = case when new.direccion = 'saliente' and new.automatico then s.seguimientos + 1 else s.seguimientos end
    where s.id = new.solicitud_id;
  end if;

  if new.viajero_id is not null then
    update destinos.dst_viajero set ultimo_contacto_en = v_momento where id = new.viajero_id;
  end if;

  return new;
end;
$$;

create trigger dst_mensaje_actividad
  after insert on destinos.dst_mensaje
  for each row execute function destinos.registrar_actividad_mensaje();

-- Cada cambio de etapa queda en el historial.
create or replace function destinos.anotar_cambio_etapa() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into destinos.dst_etapa_historial (solicitud_id, destino_id, de_etapa, a_etapa, usuario_id, actor)
    values (new.id, new.destino_id, null, new.etapa, (select auth.uid()),
            coalesce((select auth.uid())::text, current_setting('destinos.actor', true), 'sitio'));
  elsif new.etapa is distinct from old.etapa then
    insert into destinos.dst_etapa_historial (solicitud_id, destino_id, de_etapa, a_etapa, usuario_id, actor, motivo)
    values (new.id, new.destino_id, old.etapa, new.etapa, (select auth.uid()),
            coalesce((select auth.uid())::text, current_setting('destinos.actor', true), 'servicio'),
            case when new.etapa = 'perdido' then new.motivo_perdida end);
  end if;
  return new;
end;
$$;

create trigger dst_solicitud_etapa
  after insert or update of etapa on destinos.dst_solicitud
  for each row execute function destinos.anotar_cambio_etapa();

-- Auditoria generica: guarda solo lo que cambio e ignora el ruido de contadores.
create or replace function destinos.auditar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_antes   jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  v_despues jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  v_fila    jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_cambios text[];
  v_ruido   text[] := array['actualizado_en','ultimo_contacto_en','ultimo_contacto_de','seguimientos',
                            'puntuada_en','total_vistas','total_mensajes','ultimo_mensaje_en',
                            'ultimo_mensaje_de','ultimo_acceso_en','primera_respuesta_en','busqueda'];
begin
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(key), '{}') into v_cambios
      from jsonb_each(v_despues) where v_antes -> key is distinct from value;
    if v_cambios <@ v_ruido then
      return new;
    end if;
    v_antes   := (select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from jsonb_each(v_antes)   where key = any (v_cambios));
    v_despues := (select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from jsonb_each(v_despues) where key = any (v_cambios));
  end if;

  insert into destinos.dst_auditoria (destino_id, usuario_id, actor, accion, entidad, entidad_id, antes, despues)
  values (
    (v_fila ->> 'destino_id')::uuid,
    (select auth.uid()),
    coalesce((select auth.uid())::text, current_setting('destinos.actor', true), 'servicio'),
    lower(tg_op), tg_table_name,
    (v_fila ->> 'id')::uuid,
    v_antes - 'busqueda', v_despues - 'busqueda'
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger dst_solicitud_auditoria after update or delete on destinos.dst_solicitud
  for each row execute function destinos.auditar();
create trigger dst_reserva_auditoria after insert or update or delete on destinos.dst_reserva
  for each row execute function destinos.auditar();
create trigger dst_usuario_auditoria after insert or update or delete on destinos.dst_usuario
  for each row execute function destinos.auditar();
create trigger dst_agente_auditoria after update or delete on destinos.dst_agente
  for each row execute function destinos.auditar();
create trigger dst_negocio_auditoria after update or delete on destinos.dst_negocio
  for each row execute function destinos.auditar();
create trigger dst_automatizacion_auditoria after update or delete on destinos.dst_automatizacion
  for each row execute function destinos.auditar();
create trigger dst_conocimiento_auditoria after delete on destinos.dst_conocimiento
  for each row execute function destinos.auditar();
create trigger dst_invitacion_auditoria after insert or delete on destinos.dst_invitacion
  for each row execute function destinos.auditar();

-- Una cuenta nueva en auth.users se vuelve usuario del equipo solo si fue invitada.
create or replace function destinos.alta_usuario_desde_auth() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_inv destinos.dst_invitacion%rowtype;
begin
  select * into v_inv
    from destinos.dst_invitacion
   where lower(email) = lower(new.email) and aceptada_en is null and vence_el > now()
   order by creado_en desc limit 1;

  if found then
    insert into destinos.dst_usuario (id, nombre, email, rol, destinos_ids, esta_activo, invitado_por)
    values (
      new.id,
      coalesce(v_inv.nombre, new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
      lower(new.email), v_inv.rol, v_inv.destinos_ids, true, v_inv.invitado_por
    )
    on conflict do nothing;
    update destinos.dst_invitacion set aceptada_en = now(), usuario_id = new.id where id = v_inv.id;
  end if;
  return new;
end;
$$;

create trigger dst_alta_usuario
  after insert on auth.users
  for each row execute function destinos.alta_usuario_desde_auth();

-- ---------------------------------------------------------------------------
-- 13. Acceso
-- ---------------------------------------------------------------------------
alter table destinos.dst_conocimiento          enable row level security;
alter table destinos.dst_agente                enable row level security;
alter table destinos.dst_conversacion          enable row level security;
alter table destinos.dst_agente_ejecucion      enable row level security;
alter table destinos.dst_plantilla_mensaje     enable row level security;
alter table destinos.dst_automatizacion        enable row level security;
alter table destinos.dst_automatizacion_envio  enable row level security;
alter table destinos.dst_canal                 enable row level security;
alter table destinos.dst_etapa_historial       enable row level security;
alter table destinos.dst_auditoria             enable row level security;
alter table destinos.dst_invitacion            enable row level security;

create policy "el equipo administra el conocimiento de sus destinos" on destinos.dst_conocimiento
  for all to authenticated using (destinos.tiene_acceso_a(destino_id)) with check (destinos.tiene_acceso_a(destino_id));
create policy "el equipo ve los agentes de sus destinos" on destinos.dst_agente
  for select to authenticated using (destinos.tiene_acceso_a(destino_id));
create policy "los administradores configuran agentes" on destinos.dst_agente
  for all to authenticated using (destinos.es_admin() and destinos.tiene_acceso_a(destino_id))
  with check (destinos.es_admin() and destinos.tiene_acceso_a(destino_id));
create policy "el equipo administra conversaciones de sus destinos" on destinos.dst_conversacion
  for all to authenticated using (destinos.tiene_acceso_a(destino_id)) with check (destinos.tiene_acceso_a(destino_id));
create policy "el equipo ve las ejecuciones de IA de sus destinos" on destinos.dst_agente_ejecucion
  for select to authenticated using (destinos.tiene_acceso_a(destino_id));
create policy "el equipo administra plantillas de sus destinos" on destinos.dst_plantilla_mensaje
  for all to authenticated using (destinos.tiene_acceso_a(destino_id)) with check (destinos.tiene_acceso_a(destino_id));
create policy "el equipo administra automatizaciones de sus destinos" on destinos.dst_automatizacion
  for all to authenticated using (destinos.tiene_acceso_a(destino_id)) with check (destinos.tiene_acceso_a(destino_id));
create policy "el equipo administra envios automaticos de sus destinos" on destinos.dst_automatizacion_envio
  for all to authenticated using (destinos.tiene_acceso_a(destino_id)) with check (destinos.tiene_acceso_a(destino_id));
create policy "el equipo ve los canales de sus destinos" on destinos.dst_canal
  for select to authenticated using (destinos.tiene_acceso_a(destino_id));
create policy "los administradores configuran canales" on destinos.dst_canal
  for all to authenticated using (destinos.es_admin() and destinos.tiene_acceso_a(destino_id))
  with check (destinos.es_admin() and destinos.tiene_acceso_a(destino_id));
create policy "el equipo ve el historial de etapas de sus destinos" on destinos.dst_etapa_historial
  for select to authenticated using (destinos.tiene_acceso_a(destino_id));
create policy "el equipo ve la auditoria de sus destinos" on destinos.dst_auditoria
  for select to authenticated
  using ((destino_id is null and destinos.es_admin()) or (destino_id is not null and destinos.tiene_acceso_a(destino_id)));
create policy "los administradores administran invitaciones" on destinos.dst_invitacion
  for all to authenticated using (destinos.es_admin()) with check (destinos.es_admin());
create policy "los administradores administran el equipo" on destinos.dst_usuario
  for update to authenticated using (destinos.es_admin()) with check (destinos.es_admin());

grant usage on schema destinos to service_role;
grant all on all tables in schema destinos to service_role;
grant all on all sequences in schema destinos to service_role;
grant execute on all functions in schema destinos to service_role;

grant select, insert, update, delete on
  destinos.dst_conocimiento, destinos.dst_agente, destinos.dst_conversacion,
  destinos.dst_plantilla_mensaje, destinos.dst_automatizacion, destinos.dst_automatizacion_envio,
  destinos.dst_canal, destinos.dst_invitacion
  to authenticated;
grant select on destinos.dst_agente_ejecucion, destinos.dst_etapa_historial, destinos.dst_auditoria to authenticated;
grant usage, select on all sequences in schema destinos to authenticated;
