-- =====================================================================
-- EL SORTEO
--
-- Una rifa de una experiencia completa. Sirve para dos cosas a la vez:
-- juntar correos y darle a la portada una razon para volver.
--
-- Dos tablas y no una. La persona entra como VIAJERO (el lead, que ya existe
-- y se reusa entre el directorio, las experiencias y esto) y ademas queda una
-- PARTICIPACION, que es una fila por persona por sorteo con los datos tal
-- como los escribio. Un sorteo tiene que poder demostrarse: si manana alguien
-- edita o borra su lead, la lista con la que se sorteo no puede cambiar.
--
-- Todo lo que se ve en pantalla sale de dst_sorteo y se edita en el panel:
-- el titulo, el premio, la fecha, las bases, la imagen, cuantos segundos
-- espera el aviso y si pide WhatsApp. Nada de esto vive en el codigo, porque
-- la proxima rifa va a ser distinta y no se despliega por cambiar un texto.
-- =====================================================================

create table if not exists destinos.dst_sorteo (
  id              uuid primary key default gen_random_uuid(),
  destino_id      uuid not null references destinos.dst_destino(id) on delete cascade,
  babosa          text not null default 'rifa',

  -- Encendido: apagado no se pinta el aviso ni existe la pagina.
  esta_activo     boolean not null default false,

  titulo          text not null,
  gancho          text,
  premio_titulo   text,
  premio_usd      numeric(10,2),

  -- La fecha exacta puede no estar decidida todavia. Cuando no esta, la
  -- pagina muestra `cuando_texto` ("Abril 2027") y NO se inventa un dia.
  fecha_sorteo    date,
  cuando_texto    text,

  ganadores       smallint not null default 1,
  en_vivo         boolean not null default true,
  enlace_vivo     text,

  imagen_url      text,

  -- Las bases, en HTML libre. Mismo criterio que las experiencias: quien
  -- arma la rifa escribe las condiciones, no el programador.
  bases_html      text,

  -- El formulario. Pedir menos sube la conversion; pedir WhatsApp sube la
  -- probabilidad de poder avisarle al ganador meses despues, cuando el
  -- correo ya se enfrio. Por eso se pide, pero se puede dejar opcional.
  pide_whatsapp        boolean not null default true,
  whatsapp_obligatorio boolean not null default false,

  -- El aviso emergente.
  aviso_activo         boolean not null default true,
  segundos_para_abrir  smallint not null default 10,
  al_intentar_salir    boolean not null default true,
  dias_para_repreguntar smallint not null default 30,

  -- Despues del sorteo.
  cerrado_en      timestamptz,
  ganador_nombre  text,
  ganador_nota    text,

  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),

  constraint ck_dst_sorteo_ganadores check (ganadores between 1 and 50),
  constraint ck_dst_sorteo_segundos  check (segundos_para_abrir between 0 and 600),
  constraint ck_dst_sorteo_dias      check (dias_para_repreguntar between 1 and 365),
  constraint uq_dst_sorteo_babosa    unique (destino_id, babosa)
);

-- Solo un sorteo encendido por destino: si hubiera dos, el aviso no sabria
-- cual mostrar y la pagina tampoco.
create unique index if not exists uq_dst_sorteo_uno_activo
  on destinos.dst_sorteo (destino_id) where esta_activo;

create table if not exists destinos.dst_sorteo_participacion (
  id            uuid primary key default gen_random_uuid(),
  sorteo_id     uuid not null references destinos.dst_sorteo(id) on delete cascade,
  viajero_id    uuid references destinos.dst_viajero(id) on delete set null,

  -- Copia de los datos tal como los escribio. A proposito: la lista del
  -- sorteo no puede moverse porque alguien edito su ficha despues.
  nombre        text not null,
  email         text not null,
  whatsapp      text,

  idioma        char(2) not null default 'es',
  origen        text not null default 'aviso',
  pagina_entrada text,
  utm_fuente    text,
  utm_medio     text,
  utm_campana   text,

  acepto_bases  boolean not null default false,
  creado_en     timestamptz not null default now(),

  constraint ck_dst_part_origen check (origen in ('aviso', 'pagina', 'otro')),
  constraint uq_dst_part_email  unique (sorteo_id, email)
);

create index if not exists ix_dst_part_sorteo on destinos.dst_sorteo_participacion (sorteo_id, creado_en desc);

alter table destinos.dst_sorteo               enable row level security;
alter table destinos.dst_sorteo_participacion enable row level security;

-- Sin politicas: ni anon ni authenticated tocan estas tablas de frente. El
-- sitio publico escribe por la funcion de abajo y el panel entra con la
-- llave de servicio. La lista de participantes es lo ultimo que uno quiere
-- dejar leer: son correos de gente de verdad.

-- ---------------------------------------------------------------------
-- Lo que el sitio publico necesita saber del sorteo.
-- ---------------------------------------------------------------------
create or replace function destinos.sorteo_activo(p_dominio text)
returns table (
  id uuid, babosa text, titulo text, gancho text, premio_titulo text,
  premio_usd numeric, fecha_sorteo date, cuando_texto text, ganadores smallint,
  en_vivo boolean, enlace_vivo text, imagen_url text, bases_html text,
  pide_whatsapp boolean, whatsapp_obligatorio boolean,
  aviso_activo boolean, segundos_para_abrir smallint, al_intentar_salir boolean,
  dias_para_repreguntar smallint,
  cerrado_en timestamptz, ganador_nombre text, ganador_nota text,
  participantes bigint
)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.babosa, s.titulo, s.gancho, s.premio_titulo,
         s.premio_usd, s.fecha_sorteo, s.cuando_texto, s.ganadores,
         s.en_vivo, s.enlace_vivo, s.imagen_url, s.bases_html,
         s.pide_whatsapp, s.whatsapp_obligatorio,
         s.aviso_activo, s.segundos_para_abrir, s.al_intentar_salir,
         s.dias_para_repreguntar,
         s.cerrado_en, s.ganador_nombre, s.ganador_nota,
         (select count(*) from destinos.dst_sorteo_participacion p where p.sorteo_id = s.id)
    from destinos.dst_sorteo s
    join destinos.dst_destino d on d.id = s.destino_id
   where d.dominio = p_dominio and d.esta_activo and s.esta_activo
   limit 1;
$$;

-- ---------------------------------------------------------------------
-- Apuntarse.
--
-- Devuelve `ya_estaba` en vez de fallar cuando el correo ya participo: que
-- alguien se apunte dos veces no es un error suyo, y un mensaje de error le
-- haria pensar que no quedo adentro.
-- ---------------------------------------------------------------------
create or replace function destinos.participar_en_sorteo(
  p_dominio  text,
  p_nombre   text,
  p_email    text,
  p_whatsapp text default null,
  p_idioma   text default 'es',
  p_origen   text default 'aviso',
  p_pagina   text default null,
  p_acepta   boolean default false
)
returns table (ok boolean, ya_estaba boolean, sorteo_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  v_destino uuid;
  v_sorteo  destinos.dst_sorteo%rowtype;
  v_viajero uuid;
  v_nombre  text := nullif(trim(coalesce(p_nombre, '')), '');
  v_email   text := lower(nullif(trim(coalesce(p_email, '')), ''));
  v_wa      text := nullif(regexp_replace(coalesce(p_whatsapp, ''), '[^0-9+]', '', 'g'), '');
  v_ya      boolean := false;
begin
  select d.id into v_destino
    from destinos.dst_destino d
   where d.dominio = p_dominio and d.esta_activo;
  if v_destino is null then
    raise exception 'Destino no encontrado.';
  end if;

  select * into v_sorteo
    from destinos.dst_sorteo s
   where s.destino_id = v_destino and s.esta_activo
   limit 1;
  if v_sorteo.id is null then
    raise exception 'No hay ningun sorteo abierto.';
  end if;
  if v_sorteo.cerrado_en is not null then
    raise exception 'Este sorteo ya se cerro.';
  end if;

  if v_nombre is null then
    raise exception 'Hace falta el nombre.';
  end if;
  if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' then
    raise exception 'Ese correo no se ve bien.';
  end if;
  if v_sorteo.whatsapp_obligatorio and v_wa is null then
    raise exception 'Hace falta el WhatsApp.';
  end if;
  -- Las bases se aceptan de verdad o no se participa. Un sorteo sin
  -- constancia de que la persona las acepto no se puede defender despues.
  if not coalesce(p_acepta, false) then
    raise exception 'Hay que aceptar las bases.';
  end if;

  select v.id into v_viajero
    from destinos.dst_viajero v
   where v.destino_id = v_destino and lower(v.email) = v_email
   order by v.creado_en
   limit 1;

  if v_viajero is null then
    insert into destinos.dst_viajero as nv
      (destino_id, nombre, email, whatsapp, idioma, origen, pagina_entrada, acepta_marketing)
    values
      (v_destino, v_nombre, v_email, v_wa, left(coalesce(p_idioma, 'es'), 2),
       'sorteo', p_pagina, true)
    returning nv.id into v_viajero;
  else
    update destinos.dst_viajero as vj
       set nombre   = coalesce(vj.nombre, v_nombre),
           whatsapp = coalesce(vj.whatsapp, v_wa),
           acepta_marketing = true,
           actualizado_en = now()
     where vj.id = v_viajero;
  end if;

  insert into destinos.dst_sorteo_participacion as pa
    (sorteo_id, viajero_id, nombre, email, whatsapp, idioma, origen, pagina_entrada, acepto_bases)
  values
    (v_sorteo.id, v_viajero, v_nombre, v_email, v_wa,
     left(coalesce(p_idioma, 'es'), 2),
     case when p_origen in ('aviso', 'pagina') then p_origen else 'otro' end,
     p_pagina, true)
  on conflict (sorteo_id, email) do nothing;

  if not found then
    v_ya := true;
  end if;

  return query select true, v_ya, v_sorteo.id;
end;
$$;

revoke all on function destinos.sorteo_activo(text) from public;
revoke all on function destinos.participar_en_sorteo(text, text, text, text, text, text, text, boolean) from public;
grant execute on function destinos.sorteo_activo(text) to anon, authenticated, service_role;
grant execute on function destinos.participar_en_sorteo(text, text, text, text, text, text, text, boolean) to anon, authenticated, service_role;
