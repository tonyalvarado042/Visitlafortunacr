-- Plataforma de destinos | 15: buscar conocimiento con "o", no con "y"
-- websearch_to_tsquery exige TODAS las palabras. Un viajero escribe "rafting
-- rivers for families" y la ficha "Rafting: que rio elegir" no salia. Ahora
-- basta con que coincida una palabra, y el ranking ordena por cuantas.

create or replace function destinos.buscar_conocimiento(
  p_destino_id uuid, p_consulta text, p_limite integer default 6, p_uso text default 'concierge'
) returns table (id uuid, tipo text, titulo text, contenido text, etiquetas text[], prioridad smallint, relevancia real)
language sql stable security definer set search_path = '' as $$
  with q as (
    select replace(websearch_to_tsquery('spanish', p_consulta)::text, '&', '|')::tsquery as es,
           replace(websearch_to_tsquery('english', p_consulta)::text, '&', '|')::tsquery as en,
           replace(websearch_to_tsquery('simple',  p_consulta)::text, '&', '|')::tsquery as si
  )
  select c.id, c.tipo, c.titulo, c.contenido, c.etiquetas, c.prioridad,
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

revoke all on function destinos.buscar_conocimiento(uuid, text, integer, text) from public, anon;
grant execute on function destinos.buscar_conocimiento(uuid, text, integer, text) to authenticated, service_role;
