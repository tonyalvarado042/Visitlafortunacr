-- 46. No repetirle el mismo mensaje a la misma persona.
--
-- ⚠️ QUÉ PASÓ, Y NO ES LO QUE PARECÍA.
--
-- El 10 de noviembre de 2026 una viajera real tenía DOS correos de bienvenida
-- en cola, con ocho segundos de diferencia. Parecía un lead duplicado. No lo
-- era: la persona hizo DOS COSAS DISTINTAS con dos minutos de diferencia —
--
--   01:39:20  tipo `itinerario`        pidió un plan
--   01:41:24  tipo `consulta_general`  pidió los datos de un negocio
--
-- Las dos solicitudes son legítimas, las dos hay que atenderlas, y el sistema
-- hasta la reconoció como la MISMA PERSONA (mismo `viajero_id`). Lo que falla
-- es el guardia que evita repetir, que mira la SOLICITUD y no la PERSONA:
--
--   and not exists (select 1 from dst_automatizacion_envio e
--                    where e.automatizacion_id = a.id and e.solicitud_id = s.id)
--
-- Dos solicitudes, dos envíos. Y le pasaría con todo: quien pide dos cosas
-- recibe el doble de correos.
--
-- ⚠️ BORRAR LA SEGUNDA SOLICITUD NO ES LA SOLUCIÓN. Son dos pedidos de verdad.
-- Lo que no puede duplicarse es el MENSAJE.
--
-- ════════════════════════════════════════════════════════════════════════════
-- POR QUÉ ESTO ES UN TRIGGER Y NO UN ARREGLO DENTRO DE `programar_automatizaciones`
--
-- Porque ese era el plan y casi rompe todo. `programar_automatizaciones` tiene
-- **SIETE disparadores** —solicitud_nueva, sin_respuesta, antes_de_llegar,
-- despues_de_salir, etapa, puntaje, conversacion_inactiva— en 7.588 caracteres.
-- La primera versión de esta migración la reescribía entera y solo copiaba
-- DOS: habría borrado cinco en silencio. Se vio contando los `elsif` de la
-- definición real antes de aplicar, no después.
--
-- Un trigger `before insert` sobre la tabla de envíos:
--
--   · no reescribe nada, así que no puede borrar lo que no copió;
--   · cubre los siete disparadores de una, y los que se agreguen después;
--   · pone el invariante donde pertenece —«no se crea un envío repetido»—
--     y no en cada lugar que inserta, que es como se escapan estos bugs.
--
-- Devolver `null` en un `before insert` SALTA esa fila sin reventar: el resto
-- de la tanda entra, y `get diagnostics row_count` cuenta las que sí pasaron,
-- que es exactamente lo que se quiere informar.
--
-- ════════════════════════════════════════════════════════════════════════════
-- CÓMO SE CONFIGURA, Y POR QUÉ SOLTARLO ES SEGURO
--
-- La ventana va en `condiciones` —el JSONB que ya tiene `horas`, `dias`,
-- `tipos` y `etapas`— con la clave `no_repetir_horas`. Sin migración de
-- esquema, igual que el resto.
--
--   {"no_repetir_horas": 168}   no le repitas esto a la misma persona en 7 días
--
-- **Si la clave no está, no hace absolutamente nada.** Ninguna automatización
-- cambia de conducta hasta que alguien le ponga el número.
--
-- Cuenta desde `creado_en` —cuándo se PROGRAMÓ— y no desde cuándo se ejecutó:
-- si no, dos envíos ya en cola y todavía sin salir no se verían entre ellos,
-- que es exactamente el caso de esta viajera. Y mira todos los estados menos
-- `cancelado`: uno «programado» no salió todavía, pero va a salir.

create or replace function destinos.no_repetir_a_la_misma_persona()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_horas integer;
begin
  select (a.condiciones ->> 'no_repetir_horas')::integer
    into v_horas
    from destinos.dst_automatizacion a
   where a.id = new.automatizacion_id;

  /* Sin ventana configurada, o sin persona a quien repetirle, esto no existe. */
  if v_horas is null or new.viajero_id is null then
    return new;
  end if;

  if exists (
    select 1
      from destinos.dst_automatizacion_envio e
     where e.automatizacion_id = new.automatizacion_id
       and e.viajero_id = new.viajero_id
       and e.estado <> 'cancelado'
       and e.creado_en > now() - make_interval(hours => v_horas)
  ) then
    /* Se salta la fila. Sin error: no es un fallo, es la regla funcionando. */
    return null;
  end if;

  return new;
end;
$function$;

drop trigger if exists tg_no_repetir_a_la_misma_persona on destinos.dst_automatizacion_envio;

create trigger tg_no_repetir_a_la_misma_persona
before insert on destinos.dst_automatizacion_envio
for each row
execute function destinos.no_repetir_a_la_misma_persona();

comment on function destinos.no_repetir_a_la_misma_persona() is
  'Evita programarle a la MISMA PERSONA el mismo mensaje dos veces dentro de la ventana `condiciones.no_repetir_horas` de esa automatizacion. Sin esa clave no hace nada. Ver 46_no_repetirle_a_la_misma_persona.sql.';
