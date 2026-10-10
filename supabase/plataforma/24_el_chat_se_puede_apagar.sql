-- =========================================================================
-- 24 · El chat del concierge se puede apagar desde Ajustes
--
-- Hasta ahora la burbuja salía siempre y no había forma de quitarla sin
-- desplegar. Va en dst_destino por la misma regla de siempre: lo que define
-- cómo se ve un destino vive en su fila, no en el código — un destino puede
-- querer concierge y el de al lado no.
--
-- Nace en true para no cambiarle el sitio a nadie con la migración.
-- =========================================================================

alter table destinos.dst_destino
  add column if not exists chat_activo boolean not null default true;

comment on column destinos.dst_destino.chat_activo is
  'Si el concierge (la burbuja de chat) se muestra en el sitio público. '
  'En false la burbuja no se pinta Y /api/ia/conversar rechaza mensajes '
  'nuevos con 503: apagar algo de cara al público no puede dejar la puerta '
  'de atrás abierta. La lectura (GET) sigue abierta a propósito, para no '
  'tragarse una respuesta que alguien del equipo ya había escrito.';
