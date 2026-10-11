-- =====================================================================
-- PERMISOS DE LA RIFA
--
-- En 29_sorteo.sql escribi "el panel entra con la llave de servicio" y es
-- FALSO: el panel entra con la sesion del usuario (anon + su JWT). Deje las
-- dos tablas con RLS y sin politicas ni grants, asi que /admin/rifa veia
-- cero filas y mostraba "este destino todavia no tiene rifa".
--
-- Son DOS capas y solo habia puesto media. El grant dice si un rol puede
-- tocar la tabla siquiera; la politica dice QUE FILAS ve. Sin el grant,
-- Postgres ni llega a mirar la politica.
-- =====================================================================

grant select, insert, update, delete on destinos.dst_sorteo               to authenticated;
grant select, insert, update, delete on destinos.dst_sorteo_participacion to authenticated;
grant all on destinos.dst_sorteo               to service_role;
grant all on destinos.dst_sorteo_participacion to service_role;

-- A `anon` no se le da NADA. El sitio publico lee por sorteo_activo(), que
-- es SECURITY DEFINER y se salta RLS. Y los apuntados son correos de gente
-- de verdad: los ve el equipo del destino y nadie mas.

create policy "el equipo administra la rifa de sus destinos"
  on destinos.dst_sorteo
  for all
  using (destinos.tiene_acceso_a(destino_id))
  with check (destinos.tiene_acceso_a(destino_id));

create policy "el equipo ve los apuntados de sus destinos"
  on destinos.dst_sorteo_participacion
  for all
  using (exists (
    select 1 from destinos.dst_sorteo s
     where s.id = dst_sorteo_participacion.sorteo_id
       and destinos.tiene_acceso_a(s.destino_id)
  ))
  with check (exists (
    select 1 from destinos.dst_sorteo s
     where s.id = dst_sorteo_participacion.sorteo_id
       and destinos.tiene_acceso_a(s.destino_id)
  ));
