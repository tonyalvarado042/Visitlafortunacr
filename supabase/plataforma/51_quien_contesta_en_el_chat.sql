-- ---------------------------------------------------------------------------
-- 51. Quién contesta en el chat, visible desde el sitio público
--
-- ⚠️ POR QUÉ UNA FUNCIÓN Y NO UNA POLÍTICA.
--
-- `dst_agente` tiene RLS, y sus políticas son solo para el equipo. Está bien
-- que sea así: esa tabla guarda `instrucciones`, que es el prompt del negocio
-- —cómo vende, qué nunca decir, a quién escalar— y eso no se publica.
--
-- Pero el chat del sitio necesita TRES campos de ahí: el nombre, el cargo y la
-- foto. Se intentó leerlos con el cliente público y la consulta volvía vacía
-- sin un solo error: RLS no se queja, simplemente no devuelve filas. El chat
-- se habría abierto con el nombre de respaldo para siempre y nadie se habría
-- enterado. Exactamente la forma de fallar que más cuesta.
--
-- Una política pública NO sirve: las políticas son por FILA, no por columna.
-- Abrir la fila del concierge a `anon` abriría también `instrucciones`.
--
-- Entonces: una función `security definer` que devuelve únicamente esas tres
-- columnas. Lo que no está en el `select` no se puede pedir.
-- ---------------------------------------------------------------------------

create or replace function destinos.quien_contesta(p_destino_id uuid)
returns table (nombre text, cargo text, foto_url text)
language sql
stable
security definer
set search_path = destinos, public
as $$
  select a.nombre,
         coalesce(nullif(btrim(a.cargo), ''), 'Asistente virtual') as cargo,
         a.foto_url
    from destinos.dst_agente a
   where a.destino_id = p_destino_id
     and a.clave = 'concierge'
     and a.esta_activo
   limit 1;
$$;

comment on function destinos.quien_contesta(uuid) is
  'El nombre, el cargo y la foto del concierge de un destino, para pintar el chat del sitio publico. Es security definer porque dst_agente tiene RLS cerrada al equipo, y devuelve SOLO esas tres columnas: las instrucciones del agente nunca salen de aqui. Devuelve cero filas si el agente esta apagado, y entonces el chat usa su propio respaldo.';

revoke all on function destinos.quien_contesta(uuid) from public;
grant execute on function destinos.quien_contesta(uuid) to anon, authenticated, service_role;
