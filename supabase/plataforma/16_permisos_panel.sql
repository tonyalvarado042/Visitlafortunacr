-- Plataforma de destinos | 16: permisos de ejecucion para el panel
-- Al revocar EXECUTE de public en la migracion 12 se quito tambien a
-- authenticated, que es el rol con el que entra el equipo. Aqui se devuelve
-- solo lo que el panel usa. Las funciones del servidor (mensajes, cron,
-- preparar destino) siguen siendo exclusivas de service_role.

grant execute on function destinos.es_admin() to authenticated;
grant execute on function destinos.buscar_conocimiento(uuid, text, integer, text) to authenticated;
grant execute on function destinos.conocimiento_base(uuid, text, smallint) to authenticated;
grant execute on function destinos.babosa_en(text, uuid, char, text) to authenticated;
grant execute on function destinos.contexto_destino(uuid, char, integer) to authenticated;
grant execute on function destinos.contexto_viajero(uuid, integer) to authenticated;
grant execute on function destinos.contexto_conversacion(uuid, integer) to authenticated;
grant execute on function destinos.tomar_conversacion(uuid) to authenticated;
grant execute on function destinos.devolver_a_ia(uuid) to authenticated;
grant execute on function destinos.cerrar_conversacion(uuid) to authenticated;
grant execute on function destinos.revisar_conversacion(uuid, smallint, text) to authenticated;
grant execute on function destinos.mover_etapa(uuid, text, text) to authenticated;
grant execute on function destinos.marcar_acceso() to authenticated;
grant execute on function destinos.tablero(uuid) to authenticated;
grant execute on function destinos.reporte(uuid, date, date) to authenticated;
grant execute on function destinos.plantilla_para(uuid, text, text, text) to authenticated;
grant execute on function destinos.rellenar_plantilla(text, jsonb) to authenticated;

-- Lanzar un destino desde Ajustes (la accion del panel exige rol admin).
grant execute on function destinos.lanzar_destino(text, text, text, char, text, text, text, text, char, text, text, text, text, text[], char, numeric, numeric, text[], text[], text, text, text, text, text) to authenticated;
