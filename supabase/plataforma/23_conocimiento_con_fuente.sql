-- Plataforma de destinos | 23: el agente ve de dónde sale cada dato
--
-- dst_conocimiento.fuente existe desde la migración 11, pero ninguna de las
-- tres funciones que alimentan a la IA lo devolvía: el agente recibía título y
-- contenido y nada más. Con las 61 fichas investigadas del punto 10 del MVP eso
-- se volvió un problema concreto — el agente puede decir "la entrada cuesta 20
-- USD" y no puede decir de dónde lo sacó, ni pasarle el enlace al viajero que
-- quiere comprobarlo.
--
-- OJO, y es la razón de que esto sea una migración y no un parche en el código:
-- las tres funciones tienen `returns table (...)` explícito, y Postgres NO deja
-- cambiar el tipo de retorno con `create or replace`. Hay que DROP primero.
-- Por eso no basta la clave de servicio y esto va al SQL Editor.
--
-- Es idempotente: se puede volver a pegar entera sin romper nada.

-- ---------------------------------------------------------------------------
-- 1. buscar_conocimiento — la que llama el agente cuando no sabe algo
-- ---------------------------------------------------------------------------
-- La firma no cambia, solo el tipo de retorno, así que el drop es por firma.
drop function if exists destinos.buscar_conocimiento(uuid, text, integer, text);

create function destinos.buscar_conocimiento(
  p_destino_id uuid, p_consulta text, p_limite integer default 6, p_uso text default 'concierge'
) returns table (id uuid, tipo text, titulo text, contenido text, etiquetas text[], prioridad smallint, fuente text, relevancia real)
language sql stable security definer set search_path = '' as $$
  with q as (
    select replace(websearch_to_tsquery('spanish', p_consulta)::text, '&', '|')::tsquery as es,
           replace(websearch_to_tsquery('english', p_consulta)::text, '&', '|')::tsquery as en,
           replace(websearch_to_tsquery('simple',  p_consulta)::text, '&', '|')::tsquery as si
  )
  select c.id, c.tipo, c.titulo, c.contenido, c.etiquetas, c.prioridad, c.fuente,
         (greatest(ts_rank(c.busqueda, q.es), ts_rank(c.busqueda, q.en), ts_rank(c.busqueda, q.si))
          + extensions.similarity(c.titulo, p_consulta) / 2
          + c.prioridad / 100.0)::real as relevancia
    from destinos.dst_conocimiento c cross join q
   where c.destino_id = p_destino_id
     and c.esta_activo
     and (c.vigente_hasta is null or c.vigente_hasta >= current_date)
     and (case when p_uso = 'planificador' then c.para_planificador else c.para_concierge end)
     and (c.busqueda @@ q.es or c.busqueda @@ q.en or c.busqueda @@ q.si
          or extensions.similarity(c.titulo, p_consulta) > 0.25)
   order by relevancia desc
   limit greatest(1, least(p_limite, 20));
$$;
comment on function destinos.buscar_conocimiento is
  'Busqueda de texto completo (es/en/simple) mas parecido por trigramas sobre dst_conocimiento, con la fuente de cada ficha. Es la herramienta que el concierge llama cuando no sabe algo. La busqueda es con "o", no con "y" (migracion 15).';

revoke all on function destinos.buscar_conocimiento(uuid, text, integer, text) from public, anon;
grant execute on function destinos.buscar_conocimiento(uuid, text, integer, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. conocimiento_base — lo de prioridad alta, que va siempre en el prompt
-- ---------------------------------------------------------------------------
drop function if exists destinos.conocimiento_base(uuid, text, smallint);

create function destinos.conocimiento_base(
  p_destino_id uuid, p_uso text default 'concierge', p_minimo smallint default 7
) returns table (id uuid, tipo text, titulo text, contenido text, prioridad smallint, fuente text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.tipo, c.titulo, c.contenido, c.prioridad, c.fuente
    from destinos.dst_conocimiento c
   where c.destino_id = p_destino_id and c.esta_activo
     and (c.vigente_hasta is null or c.vigente_hasta >= current_date)
     and c.prioridad >= p_minimo
     and (case when p_uso = 'planificador' then c.para_planificador else c.para_concierge end)
   order by c.prioridad desc, c.titulo
   limit 60;
$$;
comment on function destinos.conocimiento_base is
  'El conocimiento de prioridad alta que va SIEMPRE en el prompt del agente, sin buscarlo, con la fuente de cada ficha.';

revoke all on function destinos.conocimiento_base(uuid, text, smallint) from public, anon;
grant execute on function destinos.conocimiento_base(uuid, text, smallint) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. contexto_destino — el JSON que reciben el planificador y el redactor
-- ---------------------------------------------------------------------------
-- Aquí el conocimiento va dentro de un jsonb, no de un `returns table`, así que
-- basta con agregar la llave al objeto. Se parchea solo esa parte con un
-- create or replace de la función entera, que es como está escrita en la 12.
-- Si algún día cambia el resto de contexto_destino, esta es la parte a
-- respetar: la llave `fuente` dentro de cada ficha de `conocimiento`.

do $$
declare
  v_cuerpo text;
begin
  select pg_get_functiondef(p.oid) into v_cuerpo
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'destinos' and p.proname = 'contexto_destino';

  if v_cuerpo is null then
    raise exception 'No existe destinos.contexto_destino';
  end if;

  -- Ya tiene la fuente: no hay nada que hacer (esto es lo que la vuelve
  -- idempotente).
  if position('''fuente'', k.fuente' in v_cuerpo) > 0 then
    raise notice 'contexto_destino ya devuelve la fuente; sin cambios.';
    return;
  end if;

  -- El objeto del conocimiento se arma con jsonb_build_object. Se le agrega la
  -- llave al final, que es donde no estorba a nada que lea por posición.
  v_cuerpo := replace(
    v_cuerpo,
    '''tipo'', k.tipo, ''titulo'', k.titulo, ''contenido'', k.contenido',
    '''tipo'', k.tipo, ''titulo'', k.titulo, ''contenido'', k.contenido, ''fuente'', k.fuente'
  );

  if position('''fuente'', k.fuente' in v_cuerpo) = 0 then
    raise exception 'No se encontró el jsonb_build_object del conocimiento en contexto_destino. Hay que agregar la llave "fuente" a mano y volver a correr esta migración.';
  end if;

  execute v_cuerpo;
end $$;

-- ---------------------------------------------------------------------------
-- Comprobación
-- ---------------------------------------------------------------------------
-- Las tres tienen que devolver la columna o la llave `fuente`:
--
--   select titulo, fuente from destinos.conocimiento_base(
--     (select id from destinos.dst_destino where babosa = 'la-fortuna'), 'concierge', 7::smallint);
--
--   select titulo, fuente from destinos.buscar_conocimiento(
--     (select id from destinos.dst_destino where babosa = 'la-fortuna'), 'termales');
--
--   select jsonb_path_query_first(
--     destinos.contexto_destino((select id from destinos.dst_destino where babosa = 'la-fortuna'), 'es'),
--     '$.conocimiento[0]');
