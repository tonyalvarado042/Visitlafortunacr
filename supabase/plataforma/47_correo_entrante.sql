-- 47. El correo que ENTRA: cuando un viajero responde, el sitio lo lee.
--
-- Hoy Resend manda pero no recibe. Si una viajera contesta el correo del plan,
-- esa respuesta no llega a ninguna parte: se pierde. Es el agujero más caro
-- que tiene el sistema, porque la respuesta de alguien que ya mostró interés
-- es exactamente lo que no se puede perder.
--
-- ⚠️ CASI TODO ESTO YA EXISTÍA. Lo único que faltaba era la puerta de entrada.
--
--   `conversacionPara(destino, viajero, 'email')`  ya encuentra o abre la
--       conversación de correo — el canal 'email' ya estaba contemplado.
--   `sugerirRespuesta(conversacion)`               ya redacta en MODO BORRADOR,
--       sin mandar nada, que es justo lo que pide la aprobación.
--   `aprobarEnvio` / `descartarEnvio`              ya mandan o descartan desde
--       el panel, y ya los usan los seguimientos de 72 h y 7 días.
--
-- Así que esto NO construye un sistema de aprobación: lo enchufa.
--
-- ────────────────────────────────────────────────────────────────────────────
-- EL DISPARADOR `correo_entrante` NO LO PROGRAMA EL CRON, Y ESO ES A PROPÓSITO.
--
-- `programar_automatizaciones` recorre los disparadores con un if/elsif y este
-- no está entre ellos, así que el cron lo ignora. El envío lo crea la llegada
-- del correo, que es el único momento en que tiene sentido. Si algún día
-- alguien lo agrega al cron, empezaría a mandar respuestas a conversaciones
-- que nadie contestó.
--
-- ────────────────────────────────────────────────────────────────────────────
-- EL MODO, QUE ES LO QUE TONY PIDIÓ CONFIGURABLE
--
-- `condiciones.modo` decide qué pasa cuando entra un correo:
--
--   'aprobar'      la IA redacta y queda esperando el OK de Tony   ← ARRANCA ASÍ
--   'sola'         la IA responde sin preguntar
--   'solo_avisar'  no se redacta nada: entra a la conversación y listo
--
-- Arranca en 'aprobar' por la regla: nada escala solo, se propone y Tony
-- decide. Cambiar el modo es editar un JSON, no desplegar.
--
-- `requiere_aprobacion` queda en true y es el cinturón del modo: aunque
-- alguien ponga `modo: 'sola'` por error, un envío que llegue como
-- `pendiente_aprobacion` no sale sin que una persona lo apruebe.

alter table destinos.dst_automatizacion
  drop constraint if exists dst_automatizacion_disparador_check;

alter table destinos.dst_automatizacion
  add constraint dst_automatizacion_disparador_check
  check (disparador = any (array[
    'solicitud_nueva', 'sin_respuesta', 'antes_de_llegar', 'despues_de_salir',
    'conversacion_inactiva', 'etapa', 'puntaje',
    -- Nuevo: lo dispara la llegada de un correo, no el reloj.
    'correo_entrante'
  ]));

insert into destinos.dst_automatizacion
  (destino_id, clave, nombre, disparador, accion, condiciones, parametros,
   requiere_aprobacion, esta_activa, retraso_horas, maximo_por_solicitud, orden)
select d.id, 'responder_correo', 'Responder un correo del viajero',
       'correo_entrante', 'mensaje_ia',
       -- 'aprobar' | 'sola' | 'solo_avisar'
       '{"modo": "aprobar"}'::jsonb,
       '{"agente": "concierge"}'::jsonb,
       true,   -- cinturón: ni con modo 'sola' sale algo sin aprobar si entró como pendiente
       true,
       0, 99, 100
  from destinos.dst_destino d
 where not exists (
   select 1 from destinos.dst_automatizacion a
    where a.destino_id = d.id and a.clave = 'responder_correo');

comment on constraint dst_automatizacion_disparador_check on destinos.dst_automatizacion is
  'Disparadores validos. `correo_entrante` lo dispara la llegada de un correo, NO el cron: ver 47_correo_entrante.sql.';
