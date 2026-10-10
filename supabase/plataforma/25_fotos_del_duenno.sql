-- =========================================================================
-- 25 · El dueño del negocio sube sus propias fotos
--
-- Hasta ahora las fotos solo las podía poner el equipo: las políticas de la
-- 22 piden tiene_acceso_a(), que es del equipo, y dst_negocio_foto tiene RLS
-- con una sola política de escritura, también del equipo. Un comerciante
-- estaba afuera de las DOS puertas: ni Storage ni tabla.
--
-- Las fotos NO pasan por el servidor del sitio. Un server action corta en 1 MB
-- y Vercel corta todo cuerpo en 4.5 MB: una sola foto de teléfono no cabe. El
-- navegador la encoge a WebP y la sube directo a Storage con la sesión del
-- dueño; acá solo se anota la fila. Por eso hacen falta las dos cosas.
-- =========================================================================

-- ---------------------------------------------------------------------------
-- 1. Storage: el dueño escribe SOLO dentro de la carpeta de su negocio
-- ---------------------------------------------------------------------------
-- La ruta es <destino-babosa>/<negocio-babosa>/<archivo>. Con los dos primeros
-- segmentos alcanza para saber de qué negocio se trata y preguntarle a
-- es_mi_negocio si esta persona es su dueña.

create or replace function destinos.es_carpeta_de_mi_negocio(p_ruta text)
returns boolean language sql stable security definer set search_path = '' as $fn$
  select exists (
    select 1
      from destinos.dst_negocio n
      join destinos.dst_destino d on d.id = n.destino_id
     where d.babosa = (storage.foldername(p_ruta))[1]
       and n.babosa = (storage.foldername(p_ruta))[2]
       and destinos.es_mi_negocio(n.id)
  );
$fn$;

comment on function destinos.es_carpeta_de_mi_negocio is
  'Si la ruta <destino>/<negocio>/<archivo> cae dentro de un negocio de quien '
  'está pidiendo. Es lo que deja al dueño subir sus fotos sin darle acceso al '
  'resto del bucket.';

revoke execute on function destinos.es_carpeta_de_mi_negocio(text) from public, anon;
grant  execute on function destinos.es_carpeta_de_mi_negocio(text) to authenticated;

drop policy if exists "el dueno sube fotos de su negocio" on storage.objects;
create policy "el dueno sube fotos de su negocio" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'negocios' and destinos.es_carpeta_de_mi_negocio(name));

drop policy if exists "el dueno reemplaza fotos de su negocio" on storage.objects;
create policy "el dueno reemplaza fotos de su negocio" on storage.objects
  for update to authenticated
  using (bucket_id = 'negocios' and destinos.es_carpeta_de_mi_negocio(name));

drop policy if exists "el dueno borra fotos de su negocio" on storage.objects;
create policy "el dueno borra fotos de su negocio" on storage.objects
  for delete to authenticated
  using (bucket_id = 'negocios' and destinos.es_carpeta_de_mi_negocio(name));

-- ---------------------------------------------------------------------------
-- 2. La tabla: por funciones, no abriendo RLS
-- ---------------------------------------------------------------------------
-- Misma regla que actualizar_mi_negocio: el dueño no escribe la tabla, llama a
-- una función que decide qué se escribe. Si se le abriera la tabla podría
-- marcarse es_generica, inventarse un crédito, o apuntar la url a cualquier
-- lado. Acá no son parámetros: no existen.

create or replace function destinos.agregar_mi_foto(
  p_negocio_id uuid,
  p_url        text,
  p_texto      text default null
) returns uuid language plpgsql security definer set search_path = '' as $fn$
declare
  v_destino text;
  v_negocio text;
  v_cuantas int;
  v_id      uuid;
begin
  if not destinos.es_mi_negocio(p_negocio_id) then
    raise exception 'Ese negocio no es tuyo.' using errcode = '42501';
  end if;

  select d.babosa, n.babosa into v_destino, v_negocio
    from destinos.dst_negocio n
    join destinos.dst_destino d on d.id = n.destino_id
   where n.id = p_negocio_id;

  -- El tope. Ocho da para una galería decente sin volverse una carga de
  -- moderación, y se cuenta acá porque el navegador se puede saltar.
  select count(*) into v_cuantas
    from destinos.dst_negocio_foto
   where negocio_id = p_negocio_id and not es_generica;

  if v_cuantas >= 8 then
    raise exception 'Ya tenés el máximo de 8 fotos. Borrá una para subir otra.';
  end if;

  -- La url tiene que apuntar DENTRO de la carpeta de este negocio. Sin esto,
  -- el dueño podría anotar la foto de otro —o un pixel espía de otro dominio—
  -- aunque Storage no lo haya dejado subir nada.
  if p_url !~ ('^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/negocios/'
               || v_destino || '/' || v_negocio || '/[A-Za-z0-9._-]+$') then
    raise exception 'Esa foto no está en la carpeta de tu negocio.' using errcode = '42501';
  end if;

  insert into destinos.dst_negocio_foto (
    negocio_id, url, orden, es_portada, es_generica,
    texto_alternativo_es, texto_alternativo_en
  ) values (
    p_negocio_id, p_url, v_cuantas,
    -- La primera foto real manda de portada. Las genéricas nunca.
    v_cuantas = 0, false,
    nullif(trim(coalesce(p_texto, '')), ''), nullif(trim(coalesce(p_texto, '')), '')
  ) returning id into v_id;

  return v_id;
end;
$fn$;

comment on function destinos.agregar_mi_foto is
  'Anota una foto que el dueño ya subió a Storage. Tope de 8 por negocio. '
  'La url se verifica contra la carpeta del propio negocio: sin eso, anotar '
  'una fila no requeriría haber subido nada. El dueño no puede tocar '
  'es_generica, credito ni licencia: no son parámetros.';

create or replace function destinos.marcar_mi_portada(p_negocio_id uuid, p_foto_id uuid)
returns void language plpgsql security definer set search_path = '' as $fn$
begin
  if not destinos.es_mi_negocio(p_negocio_id) then
    raise exception 'Ese negocio no es tuyo.' using errcode = '42501';
  end if;
  -- Primero se apaga la anterior: el índice único parcial no deja dos.
  update destinos.dst_negocio_foto set es_portada = false
   where negocio_id = p_negocio_id and es_portada;
  update destinos.dst_negocio_foto set es_portada = true
   where id = p_foto_id and negocio_id = p_negocio_id and not es_generica;
end;
$fn$;

comment on function destinos.marcar_mi_portada is
  'La foto que encabeza la ficha. Una genérica no puede ser portada: ilustra '
  'la categoría, no retrata el lugar.';

-- Devuelve la ruta en Storage para que el sitio borre también el archivo: sin
-- eso la fila se va y el bucket engorda solo.
create or replace function destinos.borrar_mi_foto(p_negocio_id uuid, p_foto_id uuid)
returns text language plpgsql security definer set search_path = '' as $fn$
declare
  v_url         text;
  v_era_portada boolean;
begin
  if not destinos.es_mi_negocio(p_negocio_id) then
    raise exception 'Ese negocio no es tuyo.' using errcode = '42501';
  end if;

  delete from destinos.dst_negocio_foto
   where id = p_foto_id and negocio_id = p_negocio_id and not es_generica
   returning url, es_portada into v_url, v_era_portada;

  if v_url is null then return null; end if;

  -- Si se fue la portada, la ficha no puede quedar sin cara: manda la
  -- siguiente foto real que haya.
  if v_era_portada then
    update destinos.dst_negocio_foto set es_portada = true
     where id = (
       select f.id from destinos.dst_negocio_foto f
        where f.negocio_id = p_negocio_id and not f.es_generica
        order by f.orden, f.creado_en
        limit 1
     );
  end if;

  return regexp_replace(v_url, '^.*/storage/v1/object/public/negocios/', '');
end;
$fn$;

comment on function destinos.borrar_mi_foto is
  'Borra la fila y devuelve la ruta en Storage para que el sitio borre el '
  'archivo. Si la que se fue era la portada, asciende a la siguiente: una '
  'ficha sin cara se ve rota.';

create or replace function destinos.mis_fotos(p_negocio_id uuid)
returns table (id uuid, url text, es_portada boolean, orden smallint)
language sql stable security definer set search_path = '' as $fn$
  select f.id, f.url, f.es_portada, f.orden
    from destinos.dst_negocio_foto f
   where f.negocio_id = p_negocio_id
     and not f.es_generica
     and destinos.es_mi_negocio(p_negocio_id)
   order by f.es_portada desc, f.orden, f.creado_en;
$fn$;

comment on function destinos.mis_fotos is
  'Las fotos propias del negocio, para el panel del dueño. Las genéricas no '
  'se listan: no son suyas y no las puede borrar.';

revoke execute on function destinos.agregar_mi_foto(uuid, text, text) from public, anon;
revoke execute on function destinos.marcar_mi_portada(uuid, uuid)     from public, anon;
revoke execute on function destinos.borrar_mi_foto(uuid, uuid)        from public, anon;
revoke execute on function destinos.mis_fotos(uuid)                   from public, anon;

grant execute on function destinos.agregar_mi_foto(uuid, text, text) to authenticated;
grant execute on function destinos.marcar_mi_portada(uuid, uuid)     to authenticated;
grant execute on function destinos.borrar_mi_foto(uuid, uuid)        to authenticated;
grant execute on function destinos.mis_fotos(uuid)                   to authenticated;
