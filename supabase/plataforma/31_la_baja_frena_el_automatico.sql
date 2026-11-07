/*
 * 31 — La baja frena el envío automático.
 *
 * 6 de noviembre de 2026.
 *
 * EL HUECO: `programar_automatizaciones` filtraba por `no_molestar` y NUNCA
 * por `baja`, así que le programaba envíos a quien se había dado de baja. Y
 * tampoco lo miraba `ejecutarEnvio` ni `enviarAViajero`. O sea: existe la ruta
 * `/baja` en el sitio, existe la columna `token_baja`, la gente SÍ se puede
 * dar de baja y la baja SÍ se guardaba — solo que a nadie le servía de nada.
 *
 * El guardia que de verdad impide el envío quedó en `enviarAViajero`
 * (`lib/ia/mensajeria.ts`), que es el único cuello de botella por el que pasa
 * todo envío. Esto de aquí es lo otro: que no se programen filas que nacen
 * para ser omitidas, porque ensucian el panel y hacen creer que se mandó algo.
 *
 * ÚNICO cambio respecto a la versión anterior: `and not v.baja` junto a cada
 * `and not v.no_molestar`, en las 5 ramas que unen `dst_viajero`.
 *
 * Las ramas `puntaje` y `conversacion_inactiva` no unen `dst_viajero` y se
 * dejan igual: su acción es `crear_tarea`, que no le escribe a nadie. Si
 * alguien les cambia la acción a un mensaje, el guardia de `enviarAViajero`
 * las frena de todos modos.
 *
 * CÓMO COMPROBAR que quedó bien, sin mandar nada:
 *
 *   begin;
 *     update destinos.dst_viajero set baja = true
 *      where email = 'barajas_reyna@icloud.com';
 *     select destinos.programar_automatizaciones(
 *       (select id from destinos.dst_destino where babosa = 'la-fortuna'));
 *     -- tiene que programar UNO MENOS que sin el update
 *   rollback;
 */
CREATE OR REPLACE FUNCTION destinos.programar_automatizaciones(p_destino_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  a       destinos.dst_automatizacion%rowtype;
  v_tz    text;
  v_hoy   date;
  v_total integer := 0;
  v_n     integer;
  v_horas integer;
begin
  select zona_horaria into v_tz from destinos.dst_destino where id = p_destino_id;
  v_hoy := (now() at time zone v_tz)::date;

  for a in select * from destinos.dst_automatizacion where destino_id = p_destino_id and esta_activa order by orden loop
    v_n := 0;
    v_horas := coalesce((a.condiciones ->> 'horas')::integer, 24);

    if a.disparador = 'solicitud_nueva' then
      insert into destinos.dst_automatizacion_envio (automatizacion_id, destino_id, solicitud_id, viajero_id, intento, programado_para)
      select a.id, p_destino_id, s.id, s.viajero_id, 1, s.creado_en + make_interval(mins => (a.retraso_horas * 60)::integer)
        from destinos.dst_solicitud s join destinos.dst_viajero v on v.id = s.viajero_id
       where s.destino_id = p_destino_id
         and s.creado_en >= now() - interval '3 days'
         and s.etapa not in ('reservado','perdido')
         and not v.no_molestar and not v.baja
         and (a.condiciones -> 'tipos' is null or s.tipo::text in (select jsonb_array_elements_text(a.condiciones -> 'tipos')))
         and not exists (select 1 from destinos.dst_automatizacion_envio e where e.automatizacion_id = a.id and e.solicitud_id = s.id);
      get diagnostics v_n = row_count;

    elsif a.disparador = 'sin_respuesta' then
      insert into destinos.dst_automatizacion_envio (automatizacion_id, destino_id, solicitud_id, viajero_id, intento, programado_para)
      select a.id, p_destino_id, s.id, s.viajero_id,
             coalesce((select max(e.intento) from destinos.dst_automatizacion_envio e where e.automatizacion_id = a.id and e.solicitud_id = s.id), 0) + 1,
             now()
        from destinos.dst_solicitud s join destinos.dst_viajero v on v.id = s.viajero_id
       where s.destino_id = p_destino_id
         and s.etapa not in ('reservado','perdido')
         and not v.no_molestar and not v.baja
         and (a.condiciones -> 'etapas' is null or s.etapa::text in (select jsonb_array_elements_text(a.condiciones -> 'etapas')))
         and coalesce(s.ultimo_contacto_de, 'ia') <> 'viajero'
         and coalesce(s.ultimo_contacto_en, s.creado_en) < now() - make_interval(hours => v_horas)
         and (select count(*) from destinos.dst_automatizacion_envio e where e.automatizacion_id = a.id and e.solicitud_id = s.id) < a.maximo_por_solicitud
         and not exists (select 1 from destinos.dst_automatizacion_envio e
                          where e.automatizacion_id = a.id and e.solicitud_id = s.id
                            and (e.estado in ('programado','pendiente_aprobacion')
                                 or e.ejecutado_en > now() - make_interval(hours => v_horas)));
      get diagnostics v_n = row_count;

    elsif a.disparador = 'antes_de_llegar' then
      insert into destinos.dst_automatizacion_envio (automatizacion_id, destino_id, solicitud_id, viajero_id, intento, programado_para)
      select a.id, p_destino_id, s.id, s.viajero_id, 1,
             ((v.llega_el - coalesce((a.condiciones ->> 'dias')::integer, 3))::timestamp
               + coalesce((a.condiciones ->> 'hora')::time, '09:00'::time)) at time zone v_tz
        from destinos.dst_solicitud s join destinos.dst_viajero v on v.id = s.viajero_id
       where s.destino_id = p_destino_id and v.llega_el is not null and not v.no_molestar and not v.baja
         and v.llega_el - coalesce((a.condiciones ->> 'dias')::integer, 3) between v_hoy - 1 and v_hoy + 1
         and (a.condiciones -> 'etapas' is null or s.etapa::text in (select jsonb_array_elements_text(a.condiciones -> 'etapas')))
         and s.id = (select s2.id from destinos.dst_solicitud s2 where s2.viajero_id = v.id order by s2.creado_en desc limit 1)
         and not exists (select 1 from destinos.dst_automatizacion_envio e where e.automatizacion_id = a.id and e.solicitud_id = s.id);
      get diagnostics v_n = row_count;

    elsif a.disparador = 'despues_de_salir' then
      insert into destinos.dst_automatizacion_envio (automatizacion_id, destino_id, solicitud_id, viajero_id, intento, programado_para)
      select a.id, p_destino_id, s.id, s.viajero_id, 1,
             ((v.sale_el + coalesce((a.condiciones ->> 'dias')::integer, 2))::timestamp
               + coalesce((a.condiciones ->> 'hora')::time, '10:00'::time)) at time zone v_tz
        from destinos.dst_solicitud s join destinos.dst_viajero v on v.id = s.viajero_id
       where s.destino_id = p_destino_id and v.sale_el is not null and not v.no_molestar and not v.baja
         and v.sale_el + coalesce((a.condiciones ->> 'dias')::integer, 2) between v_hoy - 1 and v_hoy + 1
         and (a.condiciones -> 'etapas' is null or s.etapa::text in (select jsonb_array_elements_text(a.condiciones -> 'etapas')))
         and s.id = (select s2.id from destinos.dst_solicitud s2 where s2.viajero_id = v.id order by s2.creado_en desc limit 1)
         and not exists (select 1 from destinos.dst_automatizacion_envio e where e.automatizacion_id = a.id and e.solicitud_id = s.id);
      get diagnostics v_n = row_count;

    elsif a.disparador = 'etapa' then
      insert into destinos.dst_automatizacion_envio (automatizacion_id, destino_id, solicitud_id, viajero_id, intento, programado_para)
      select a.id, p_destino_id, s.id, s.viajero_id, 1,
             coalesce((select max(h.creado_en) from destinos.dst_etapa_historial h where h.solicitud_id = s.id), s.actualizado_en)
               + make_interval(mins => (a.retraso_horas * 60)::integer)
        from destinos.dst_solicitud s join destinos.dst_viajero v on v.id = s.viajero_id
       where s.destino_id = p_destino_id and not v.no_molestar and not v.baja
         and s.etapa::text = a.condiciones ->> 'etapa'
         and not exists (select 1 from destinos.dst_automatizacion_envio e where e.automatizacion_id = a.id and e.solicitud_id = s.id);
      get diagnostics v_n = row_count;

    elsif a.disparador = 'puntaje' then
      insert into destinos.dst_automatizacion_envio (automatizacion_id, destino_id, solicitud_id, viajero_id, intento, programado_para)
      select a.id, p_destino_id, s.id, s.viajero_id, 1, now()
        from destinos.dst_solicitud s
       where s.destino_id = p_destino_id
         and s.etapa not in ('reservado','perdido')
         and s.temperatura = coalesce(a.condiciones ->> 'temperatura', 'caliente')
         and not exists (select 1 from destinos.dst_automatizacion_envio e where e.automatizacion_id = a.id and e.solicitud_id = s.id);
      get diagnostics v_n = row_count;

    elsif a.disparador = 'conversacion_inactiva' then
      insert into destinos.dst_automatizacion_envio (automatizacion_id, destino_id, solicitud_id, viajero_id, conversacion_id, intento, programado_para)
      select a.id, p_destino_id, c.solicitud_id, c.viajero_id, c.id, 1, now()
        from destinos.dst_conversacion c
       where c.destino_id = p_destino_id
         and c.estado in ('esperando_equipo','escalada')
         and c.ultimo_mensaje_en < now() - make_interval(hours => coalesce((a.condiciones ->> 'horas')::integer, 2))
         and not exists (select 1 from destinos.dst_automatizacion_envio e
                          where e.automatizacion_id = a.id and e.conversacion_id = c.id and e.creado_en > c.ultimo_mensaje_en);
      get diagnostics v_n = row_count;
    end if;

    v_total := v_total + v_n;
  end loop;

  return v_total;
end;
$function$;

comment on function destinos.programar_automatizaciones(uuid) is
  'Programa los envíos que tocan. Respeta no_molestar Y baja (la baja se agregó el 6 de noviembre de 2026: antes se programaban envíos a quien se había dado de baja).';

notify pgrst, 'reload schema';
