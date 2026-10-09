-- =========================================================================
-- 19 · Comerciantes: el dueño de un negocio administra su propia ficha
--
-- Hasta aquí el panel era del EQUIPO: dst_usuario con roles admin, vendedor,
-- editor, moderador y socio, repartidos por destino. Un comerciante no se
-- reparte por destino: se reparte por SU NEGOCIO, que es otro eje.
--
-- Por qué una tabla aparte y no un rol más en dst_usuario:
--   todo el panel decide el acceso preguntando "¿tiene fila en dst_usuario?".
--   Si los comerciantes vivieran ahí, esa pregunta empezaría a decir que sí
--   para gente que no es del equipo, y habría que revisar una por una las
--   políticas que ya funcionan. Con tabla aparte, /admin no se entera de que
--   existen y sigue igual de cerrado.
--
-- Y el enlace negocio<->comerciante va en su propia tabla porque un dueño
-- puede tener hotel Y restaurante, y un negocio puede tener dueño Y
-- encargado. Eso no cabe en una columna.
--
-- Nada de esto escribe por tabla abierta: todo pasa por funciones con la
-- lista de campos permitidos escrita adentro, igual que registrar_solicitud.
-- Es lo que impide que un comerciante se ponga destacado o se cambie la
-- comisión aunque llame a la API por fuera del sitio.
-- =========================================================================

-- ---------------------------------------------------------------------------
-- Quién es

create table if not exists destinos.dst_comerciante (
  id              uuid primary key references auth.users(id) on delete cascade,
  nombre          text not null,
  email           text not null,
  telefono        text,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

comment on table destinos.dst_comerciante is
  'La persona que administra uno o varios negocios del directorio. NO es del '
  'equipo: para eso está dst_usuario, y a propósito no comparten tabla — el '
  'panel /admin da acceso a quien tenga fila en dst_usuario, y un comerciante '
  'nunca debe pasar por ahí.';

-- ---------------------------------------------------------------------------
-- Qué administra

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                  where n.nspname = 'destinos' and t.typname = 'rol_comercio') then
    create type destinos.rol_comercio as enum ('duenno', 'encargado');
  end if;
end $$;

create table if not exists destinos.dst_negocio_comerciante (
  negocio_id      uuid not null references destinos.dst_negocio(id) on delete cascade,
  comerciante_id  uuid not null references destinos.dst_comerciante(id) on delete cascade,
  rol             destinos.rol_comercio not null default 'duenno',
  creado_en       timestamptz not null default now(),
  primary key (negocio_id, comerciante_id)
);

create index if not exists ix_dst_negocio_comerciante_comerciante
  on destinos.dst_negocio_comerciante (comerciante_id);

comment on table destinos.dst_negocio_comerciante is
  'Quién administra qué negocio. Muchos a muchos a proposito: un dueño puede '
  'tener varios negocios y un negocio puede tener varios encargados. NO es '
  'una lista de permisos: lo que cada quien puede tocar lo deciden las '
  'funciones actualizar_mi_negocio y companeras, no esta tabla.';

-- ---------------------------------------------------------------------------
-- Candados

alter table destinos.dst_comerciante           enable row level security;
alter table destinos.dst_negocio_comerciante   enable row level security;

drop policy if exists "cada quien ve su ficha de comerciante" on destinos.dst_comerciante;
create policy "cada quien ve su ficha de comerciante"
  on destinos.dst_comerciante for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "cada quien edita su ficha de comerciante" on destinos.dst_comerciante;
create policy "cada quien edita su ficha de comerciante"
  on destinos.dst_comerciante for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Solo lectura: ligar un negocio a una cuenta pasa por crear_mi_negocio.
-- Si se pudiera insertar aquí, cualquiera se ligaria la ficha que quisiera.
drop policy if exists "cada quien ve sus negocios ligados" on destinos.dst_negocio_comerciante;
create policy "cada quien ve sus negocios ligados"
  on destinos.dst_negocio_comerciante for select to authenticated
  using (comerciante_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- ¿Es mío este negocio?

create or replace function destinos.es_mi_negocio(p_negocio_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from destinos.dst_negocio_comerciante
     where negocio_id = p_negocio_id
       and comerciante_id = (select auth.uid())
  );
$$;

comment on function destinos.es_mi_negocio is
  'La pregunta que hacen todas las funciones del comerciante antes de tocar '
  'nada. Se centraliza aquí para que ninguna se olvide de hacerla.';

-- ---------------------------------------------------------------------------
-- Crear la ficha propia
--
-- Entra como PENDIENTE, nunca publicada: si se publicara sola, cualquiera
-- llena el directorio de fichas falsas en una tarde. La aprueba el equipo.

-- p_nota va a notas_internas, que es campo del equipo: sirve para que la ficha
-- llegue marcada ("posible duplicado de X"). El dueño no lo ve ni lo escribe.
--
-- ⚠️ Si algún día hay que agregarle otro parámetro, hay que BORRAR la función
-- primero. Un `create or replace` con distinta cantidad de parámetros no
-- reemplaza: deja las dos versiones, y después cualquier grant sin firma
-- explícita falla por ambiguo.
drop function if exists destinos.crear_mi_negocio(text,uuid,text,text,text,text,text,text,text,text,text);

create or replace function destinos.crear_mi_negocio(
  p_dominio       text,
  p_categoria_id  uuid,
  p_nombre        text,
  p_resumen       text default null,
  p_telefono      text default null,
  p_whatsapp      text default null,
  p_email         text default null,
  p_sitio_web     text default null,
  p_direccion     text default null,
  p_mi_nombre     text default null,
  p_mi_telefono   text default null,
  p_nota          text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_yo         uuid := (select auth.uid());
  v_mi_email   text;
  v_destino_id uuid;
  v_idiomas    text[];
  v_nombre     text := nullif(trim(p_nombre), '');
  v_babosa     text;
  v_negocio_id uuid;
  v_idioma     text;
begin
  if v_yo is null then
    raise exception 'Hay que entrar con una cuenta para sumar un negocio.';
  end if;
  if v_nombre is null then
    raise exception 'El negocio necesita un nombre.';
  end if;

  select email into v_mi_email from auth.users where id = v_yo;

  -- La ficha del comerciante se crea sola la primera vez.
  insert into destinos.dst_comerciante (id, nombre, email, telefono)
  values (v_yo,
          coalesce(nullif(trim(p_mi_nombre), ''), split_part(v_mi_email, '@', 1)),
          lower(v_mi_email),
          nullif(trim(p_mi_telefono), ''))
  on conflict (id) do update
     set nombre   = coalesce(nullif(trim(p_mi_nombre), ''), destinos.dst_comerciante.nombre),
         telefono = coalesce(nullif(trim(p_mi_telefono), ''), destinos.dst_comerciante.telefono),
         actualizado_en = now();

  select id, idiomas into v_destino_id, v_idiomas
    from destinos.dst_destino
   where dominio = p_dominio and esta_activo;

  if v_destino_id is null then
    raise exception 'Destino no encontrado: %', p_dominio;
  end if;

  -- La categoría tiene que estar encendida EN ESTE destino. Sin esto se
  -- podría colar una categoría de otro destino pasando su id a mano.
  if not exists (
    select 1 from destinos.dst_destino_categoria
     where destino_id = v_destino_id and categoria_id = p_categoria_id and es_visible
  ) then
    raise exception 'Esa categoría no existe en este destino.';
  end if;

  -- Babosa única dentro del destino.
  v_babosa := left(regexp_replace(
                     lower(translate(v_nombre,
                       'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc')),
                     '[^a-z0-9]+', '-', 'g'), 80);
  v_babosa := trim(both '-' from v_babosa);
  if v_babosa = '' then v_babosa := 'negocio'; end if;

  if exists (select 1 from destinos.dst_negocio
              where destino_id = v_destino_id and babosa = v_babosa) then
    v_babosa := v_babosa || '-' || substr(md5(random()::text), 1, 4);
  end if;

  insert into destinos.dst_negocio (
    destino_id, categoria_id, nombre, babosa, resumen,
    telefono, telefono_whatsapp, email, sitio_web, direccion, notas_internas,
    estado_publicacion, estado_verificacion, fuente_dato
  ) values (
    v_destino_id, p_categoria_id, v_nombre, v_babosa, nullif(trim(p_resumen), ''),
    nullif(trim(p_telefono), ''), nullif(trim(p_whatsapp), ''),
    lower(nullif(trim(p_email), '')), nullif(trim(p_sitio_web), ''),
    nullif(trim(p_direccion), ''), nullif(trim(p_nota), ''),
    'pendiente', 'reclamado', 'duenno'
  ) returning id into v_negocio_id;

  -- Cada idioma apunta a la misma babosa hasta que alguien la traduzca,
  -- igual que cuando la ficha la crea el equipo.
  foreach v_idioma in array v_idiomas loop
    insert into destinos.dst_ruta (destino_id, entidad, entidad_id, idioma, babosa)
    values (v_destino_id, 'negocio', v_negocio_id, v_idioma, v_babosa)
    on conflict do nothing;
  end loop;

  insert into destinos.dst_negocio_comerciante (negocio_id, comerciante_id, rol)
  values (v_negocio_id, v_yo, 'duenno');

  return v_negocio_id;
end;
$$;

comment on function destinos.crear_mi_negocio is
  'La puerta por la que un dueño suma su negocio desde el sitio público. '
  'Entra como "pendiente" y NO publicada: la revisa el equipo antes de que '
  'salga al directorio. El estado de publicación no es parámetro a propósito.';

-- ---------------------------------------------------------------------------
-- Mis negocios

create or replace function destinos.mis_negocios()
returns table (
  id uuid, nombre text, babosa text, resumen text, descripcion text,
  telefono text, telefono_whatsapp text, email text, sitio_web text,
  direccion text, como_llegar text, rango_precio text,
  estado_publicacion text, estado_verificacion text, esta_cerrado boolean,
  categoria_nombre text, categoria_babosa text,
  destino_babosa text, destino_dominio text, idioma_principal text,
  total_resenas integer, promedio_calificacion numeric, total_vistas integer,
  mi_rol text
) language sql stable security definer set search_path = '' as $$
  select n.id, n.nombre, n.babosa, n.resumen, n.descripcion,
         n.telefono, n.telefono_whatsapp, n.email, n.sitio_web,
         n.direccion, n.como_llegar, n.rango_precio::text,
         n.estado_publicacion::text, n.estado_verificacion::text, n.esta_cerrado,
         c.nombre, c.babosa,
         d.babosa, d.dominio, d.idioma_principal::text,
         n.total_resenas, n.promedio_calificacion, n.total_vistas,
         nc.rol::text
    from destinos.dst_negocio_comerciante nc
    join destinos.dst_negocio  n on n.id = nc.negocio_id
    join destinos.dst_categoria c on c.id = n.categoria_id
    join destinos.dst_destino   d on d.id = n.destino_id
   where nc.comerciante_id = (select auth.uid())
   order by n.nombre;
$$;

comment on function destinos.mis_negocios is
  'Los negocios de quien llama, con todo lo que su panel necesita mostrar. '
  'Incluye los que todavía están pendientes de aprobación: el dueño tiene que '
  'poder ver y seguir editando lo que mandó.';

-- ---------------------------------------------------------------------------
-- Editar la ficha propia
--
-- La lista de campos es ESTA y no hay otra. Lo que no aparece aquí no lo
-- puede tocar un comerciante ni llamando a la función a mano: la categoría,
-- es_destacado, la comisión, la membresía, es_casa y el estado de publicación
-- se quedan del lado del equipo.

create or replace function destinos.actualizar_mi_negocio(
  p_negocio_id   uuid,
  p_nombre       text,
  p_resumen      text default null,
  p_descripcion  text default null,
  p_telefono     text default null,
  p_whatsapp     text default null,
  p_email        text default null,
  p_sitio_web    text default null,
  p_direccion    text default null,
  p_como_llegar  text default null,
  p_rango_precio text default null,
  p_esta_cerrado boolean default false
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_nombre text := nullif(trim(p_nombre), '');
begin
  if not destinos.es_mi_negocio(p_negocio_id) then
    raise exception 'Ese negocio no es tuyo.';
  end if;
  if v_nombre is null then
    raise exception 'El negocio necesita un nombre.';
  end if;

  update destinos.dst_negocio set
    nombre            = v_nombre,
    resumen           = nullif(trim(p_resumen), ''),
    descripcion       = nullif(trim(p_descripcion), ''),
    telefono          = nullif(trim(p_telefono), ''),
    telefono_whatsapp = nullif(trim(p_whatsapp), ''),
    email             = lower(nullif(trim(p_email), '')),
    sitio_web         = nullif(trim(p_sitio_web), ''),
    direccion         = nullif(trim(p_direccion), ''),
    como_llegar       = nullif(trim(p_como_llegar), ''),
    rango_precio      = case when p_rango_precio in ('economico','moderado','alto','lujo')
                             then p_rango_precio::destinos.rango_precio else null end,
    esta_cerrado      = coalesce(p_esta_cerrado, false),
    actualizado_en    = now()
  where id = p_negocio_id;
end;
$$;

comment on function destinos.actualizar_mi_negocio is
  'Lo único que un dueño puede cambiar de su ficha. La lista de columnas está '
  'escrita adentro a propósito: categoria_id, es_destacado, comision_pct, '
  'membresia, es_casa y estado_publicacion NO son parámetros, así que no se '
  'pueden tocar ni llamando a la función por fuera del sitio.';

-- ---------------------------------------------------------------------------
-- Responder una reseña
--
-- Solo se responde; la reseña en sí no se toca. Un dueño no puede borrar ni
-- editar lo que un viajero escribió — eso sería comprar la nota.

create or replace function destinos.responder_resena(
  p_resena_id uuid,
  p_respuesta text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_negocio_id uuid;
  v_texto      text := nullif(trim(p_respuesta), '');
begin
  select negocio_id into v_negocio_id from destinos.dst_resena where id = p_resena_id;
  if v_negocio_id is null then
    raise exception 'Esa reseña no existe.';
  end if;
  if not destinos.es_mi_negocio(v_negocio_id) then
    raise exception 'Esa reseña no es de un negocio tuyo.';
  end if;

  update destinos.dst_resena set
    respuesta_negocio = v_texto,
    respondida_en     = case when v_texto is null then null else now() end,
    actualizado_en    = now()
  where id = p_resena_id;
end;
$$;

comment on function destinos.responder_resena is
  'El dueño contesta una reseña de SU negocio. No puede editarla ni borrarla: '
  'solo se escribe respuesta_negocio.';

-- ---------------------------------------------------------------------------
-- Las reseñas de mis negocios (incluidas las que no están publicadas todavía)

create or replace function destinos.resenas_de_mi_negocio(p_negocio_id uuid)
returns table (
  id uuid, calificacion smallint, titulo text, cuerpo text, idioma text,
  estado text, visitado_el date, creado_en timestamptz,
  respuesta_negocio text, respondida_en timestamptz, autor text
) language sql stable security definer set search_path = '' as $$
  select r.id, r.calificacion, r.titulo, r.cuerpo, r.idioma,
         r.estado::text, r.visitado_el, r.creado_en,
         r.respuesta_negocio, r.respondida_en,
         coalesce(nullif(trim(v.nombre), ''), 'Viajero')
    from destinos.dst_resena r
    left join destinos.dst_viajero v on v.id = r.viajero_id
   where r.negocio_id = p_negocio_id
     and destinos.es_mi_negocio(p_negocio_id)
     and r.estado = 'publicada'
   order by r.creado_en desc;
$$;

comment on function destinos.resenas_de_mi_negocio is
  'Las reseñas publicadas de un negocio propio, para contestarlas. Las que '
  'están pendientes de moderación no se muestran: todavía no son públicas y '
  'enseñárselas al dueño antes de tiempo invita a presionar al viajero.';

-- ---------------------------------------------------------------------------
-- Permisos: estas funciones las llama gente con cuenta, nunca el público anónimo

revoke all on function destinos.crear_mi_negocio(text,uuid,text,text,text,text,text,text,text,text,text,text) from public, anon;
revoke all on function destinos.actualizar_mi_negocio   from public, anon;
revoke all on function destinos.mis_negocios            from public, anon;
revoke all on function destinos.responder_resena        from public, anon;
revoke all on function destinos.resenas_de_mi_negocio   from public, anon;
revoke all on function destinos.es_mi_negocio           from public, anon;

grant execute on function destinos.crear_mi_negocio(text,uuid,text,text,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function destinos.actualizar_mi_negocio to authenticated;
grant execute on function destinos.mis_negocios          to authenticated;
grant execute on function destinos.responder_resena      to authenticated;
grant execute on function destinos.resenas_de_mi_negocio to authenticated;
grant execute on function destinos.es_mi_negocio         to authenticated;
