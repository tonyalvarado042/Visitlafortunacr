-- Plataforma de destinos | 19: resenas propias desde el sitio publico
-- La tabla dst_resena existia desde el principio, pero no habia por donde
-- escribirla: el sitio publico no tiene INSERT sobre ninguna tabla. Aqui se
-- abre la segunda puerta controlada, hermana de registrar_solicitud, y la
-- funcion de lectura que devuelve las resenas publicadas sin exponer el
-- viajero entero.
--
-- De paso, tres correcciones al diseno original:
--   1. El idioma estaba limitado a es/en. La plataforma habla cinco.
--   2. "Toda resena entra pendiente" deja un directorio nuevo sin una sola
--      resena visible hasta que alguien modere. Ahora lo decide el destino.
--   3. Quien deja una resena entra al CRM como viajero, pero SIN consentir
--      marketing: escribir una opinion no es pedir correos.

-- ---------------------------------------------------------------------------
-- 1. Cinco idiomas, no dos
-- ---------------------------------------------------------------------------

alter table destinos.dst_resena drop constraint if exists ck_dst_resena_idioma;
alter table destinos.dst_resena add constraint ck_dst_resena_idioma
  check (idioma in ('es','en','pt','fr','de'));

-- ---------------------------------------------------------------------------
-- 2. Moderar o no, lo decide el destino
-- ---------------------------------------------------------------------------

alter table destinos.dst_destino
  add column if not exists resenas_moderadas boolean not null default false;

comment on column destinos.dst_destino.resenas_moderadas is
  'Si esta encendido, la resena entra pendiente y no se ve hasta que el equipo la publique desde /admin/resenas. Apagado, se publica al enviarla y el equipo la oculta si hace falta. Nace apagado porque un destino recien lanzado con moderacion previa no muestra ninguna resena hasta que alguien se acuerde de entrar al panel.';

comment on column destinos.dst_resena.estado is
  'Estado de moderacion. Donde entra cada resena lo decide dst_destino.resenas_moderadas: pendiente si ese destino modera antes de publicar, publicada si no. En los dos casos el equipo puede ocultarla o rechazarla despues.';

-- ---------------------------------------------------------------------------
-- 3. Escribir: la segunda puerta publica
-- ---------------------------------------------------------------------------

create or replace function destinos.registrar_resena(
  p_dominio      text,
  p_negocio_id   uuid,
  p_calificacion smallint,
  p_cuerpo       text,
  p_nombre       text,
  p_email        text,
  p_titulo       text default null,
  p_idioma       text default 'es',
  p_visitado_el  date default null
) returns jsonb language plpgsql security definer set search_path = '' as $func$
declare
  v_destino_id uuid;
  v_modera     boolean;
  v_viajero_id uuid;
  v_estado     destinos.estado_resena;
  v_resena_id  uuid;
  v_nombre     text := nullif(btrim(coalesce(p_nombre, '')), '');
  v_cuerpo     text := btrim(coalesce(p_cuerpo, ''));
  v_idioma     char(2);
begin
  select id, resenas_moderadas into v_destino_id, v_modera
    from destinos.dst_destino
   where dominio = p_dominio and esta_activo;

  if v_destino_id is null then
    raise exception 'Destino no encontrado o todavia no publicado: %', p_dominio;
  end if;

  -- El negocio tiene que ser de ESTE destino y estar publicado. Sin esta
  -- comprobacion, la llave publica de un destino podria dejar resenas en los
  -- negocios de otro.
  if not exists (
    select 1 from destinos.dst_negocio n
     where n.id = p_negocio_id
       and n.destino_id = v_destino_id
       and n.estado_publicacion = 'publicado'
  ) then
    raise exception 'Ese negocio no existe en este destino o no esta publicado.';
  end if;

  if p_calificacion is null or p_calificacion < 1 or p_calificacion > 5 then
    raise exception 'La calificacion va de 1 a 5.';
  end if;

  if char_length(v_cuerpo) < 40 then
    raise exception 'Contanos un poco mas: al menos 40 caracteres.';
  end if;

  if p_email is null or btrim(p_email) = '' then
    raise exception 'Hace falta un correo para poder verificar la resena.';
  end if;

  v_idioma := case when p_idioma in ('es','en','pt','fr','de') then p_idioma else 'es' end;

  -- El viajero: la misma persona que ya pidio un itinerario no se duplica, se
  -- completa. acepta_marketing NO se enciende aqui: quien ya lo acepto sigue
  -- igual, y quien llega por una resena no queda suscrito sin pedirlo.
  insert into destinos.dst_viajero (destino_id, nombre, email, idioma, origen, acepta_marketing)
  values (v_destino_id, v_nombre, lower(btrim(p_email)), v_idioma, 'resena', false)
  on conflict (destino_id, lower(email)) where email is not null
  do update set
    nombre         = coalesce(destinos.dst_viajero.nombre, excluded.nombre),
    actualizado_en = now()
  returning id into v_viajero_id;

  v_estado := (case when v_modera then 'pendiente' else 'publicada' end)::destinos.estado_resena;

  -- Una resena por persona y negocio: si ya escribio, la corrige. Vuelve a
  -- pasar por el mismo filtro, porque si no, se publica algo decente y
  -- despues se edita a lo que sea.
  insert into destinos.dst_resena (
    negocio_id, viajero_id, calificacion, titulo, cuerpo, idioma, visitado_el, estado
  ) values (
    p_negocio_id, v_viajero_id, p_calificacion, nullif(btrim(coalesce(p_titulo,'')), ''),
    v_cuerpo, v_idioma, p_visitado_el, v_estado
  )
  on conflict (negocio_id, viajero_id) do update set
    calificacion   = excluded.calificacion,
    titulo         = excluded.titulo,
    cuerpo         = excluded.cuerpo,
    idioma         = excluded.idioma,
    visitado_el    = excluded.visitado_el,
    estado         = excluded.estado,
    motivo_rechazo = null,
    moderador_id   = null,
    moderada_en    = null,
    actualizado_en = now()
  returning id into v_resena_id;

  return jsonb_build_object(
    'resena_id', v_resena_id,
    'estado',    v_estado,
    'visible',   v_estado = 'publicada'
  );
end;
$func$;

comment on function destinos.registrar_resena is
  'La segunda puerta por la que el sitio publico escribe, hermana de registrar_solicitud. Valida el destino, que el negocio sea suyo y este publicado, la calificacion y el minimo de texto; crea o completa el viajero y deja la resena en el estado que ese destino haya decidido. No permite tocar ninguna otra columna: ni el estado, ni total_util, ni la respuesta del negocio.';

grant execute on function destinos.registrar_resena to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Leer: resenas publicadas sin exponer al viajero
-- ---------------------------------------------------------------------------

create or replace function destinos.resenas_de_negocio(
  p_negocio_id uuid,
  p_limite     integer default 20
) returns table (
  id                uuid,
  autor             text,
  calificacion      smallint,
  titulo            text,
  cuerpo            text,
  idioma            char(2),
  visitado_el       date,
  creado_en         timestamptz,
  respuesta_negocio text,
  respondida_en     timestamptz,
  total_util        integer
) language sql stable security definer set search_path = '' as $func$
  select r.id,
         -- Nombre de pila y la inicial del apellido. La politica de lectura
         -- de dst_resena deja ver la resena, pero el viajero entero (correo,
         -- fechas de viaje, presupuesto) es del CRM y no se publica.
         coalesce(
           nullif(btrim(split_part(btrim(v.nombre), ' ', 1)), '')
           || case
                when nullif(btrim(split_part(btrim(v.nombre), ' ', 2)), '') is not null
                then ' ' || upper(left(btrim(split_part(btrim(v.nombre), ' ', 2)), 1)) || '.'
                else ''
              end,
           'Viajero') as autor,
         r.calificacion, r.titulo, r.cuerpo, r.idioma, r.visitado_el, r.creado_en,
         r.respuesta_negocio, r.respondida_en, r.total_util
    from destinos.dst_resena r
    join destinos.dst_viajero v on v.id = r.viajero_id
    join destinos.dst_negocio n on n.id = r.negocio_id
   where r.negocio_id = p_negocio_id
     and r.estado = 'publicada'
     and n.estado_publicacion = 'publicado'
   order by r.total_util desc, r.creado_en desc
   limit least(greatest(coalesce(p_limite, 20), 1), 100);
$func$;

comment on function destinos.resenas_de_negocio is
  'Las resenas publicadas de un negocio, con el autor abreviado a nombre de pila mas inicial. Va por funcion y no por consulta directa porque el nombre vive en dst_viajero, que es el CRM: dar SELECT sobre esa tabla para poder firmar una resena publicaria correos, fechas de viaje y presupuestos.';

grant execute on function destinos.resenas_de_negocio to anon, authenticated;
