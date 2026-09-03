-- Plataforma de destinos | 12: funciones de inteligencia
-- Las puertas por las que el panel, la IA, los webhooks y el cron hablan con
-- la base. Las que llama el panel corren como el usuario (RLS manda); las que
-- llama el servidor son security definer y solo las ejecuta service_role.

-- ---------------------------------------------------------------------------
-- 1. Conocimiento
-- ---------------------------------------------------------------------------
create or replace function destinos.buscar_conocimiento(
  p_destino_id uuid, p_consulta text, p_limite integer default 6, p_uso text default 'concierge'
) returns table (id uuid, tipo text, titulo text, contenido text, etiquetas text[], prioridad smallint, relevancia real)
language sql stable security definer set search_path = '' as $$
  with q as (
    select websearch_to_tsquery('spanish', p_consulta) as es,
           websearch_to_tsquery('english', p_consulta) as en,
           websearch_to_tsquery('simple',  p_consulta) as si
  )
  select c.id, c.tipo, c.titulo, c.contenido, c.etiquetas, c.prioridad,
         greatest(ts_rank(c.busqueda, q.es), ts_rank(c.busqueda, q.en), ts_rank(c.busqueda, q.si),
                  extensions.similarity(c.titulo, p_consulta))::real as relevancia
    from destinos.dst_conocimiento c cross join q
   where c.destino_id = p_destino_id
     and c.esta_activo
     and (c.vigente_hasta is null or c.vigente_hasta >= current_date)
     and (case when p_uso = 'planificador' then c.para_planificador else c.para_concierge end)
     and (c.busqueda @@ q.es or c.busqueda @@ q.en or c.busqueda @@ q.si
          or extensions.similarity(c.titulo, p_consulta) > 0.25)
   order by relevancia desc, c.prioridad desc
   limit greatest(1, least(p_limite, 20));
$$;
comment on function destinos.buscar_conocimiento is
  'Busqueda de texto completo (es/en/simple) mas parecido por trigramas sobre dst_conocimiento. Es la herramienta que el concierge llama cuando no sabe algo.';

create or replace function destinos.conocimiento_base(
  p_destino_id uuid, p_uso text default 'concierge', p_minimo smallint default 7
) returns table (id uuid, tipo text, titulo text, contenido text, prioridad smallint)
language sql stable security definer set search_path = '' as $$
  select c.id, c.tipo, c.titulo, c.contenido, c.prioridad
    from destinos.dst_conocimiento c
   where c.destino_id = p_destino_id and c.esta_activo
     and (c.vigente_hasta is null or c.vigente_hasta >= current_date)
     and c.prioridad >= p_minimo
     and (case when p_uso = 'planificador' then c.para_planificador else c.para_concierge end)
   order by c.prioridad desc, c.titulo
   limit 60;
$$;
comment on function destinos.conocimiento_base is
  'El conocimiento de prioridad alta que va SIEMPRE en el prompt del agente, sin buscarlo.';

-- ---------------------------------------------------------------------------
-- 2. Contextos: todo lo que un agente necesita saber, en un solo JSON
-- ---------------------------------------------------------------------------
create or replace function destinos.babosa_en(p_entidad text, p_entidad_id uuid, p_idioma char(2), p_respaldo text)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select r.babosa from destinos.dst_ruta r
      where r.entidad = p_entidad and r.entidad_id = p_entidad_id and r.idioma = p_idioma and r.es_vigente
      limit 1),
    p_respaldo);
$$;

create or replace function destinos.contexto_destino(
  p_destino_id uuid, p_idioma char(2) default 'es', p_max_negocios integer default 200
) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'destino', (
      select jsonb_build_object(
        'id', d.id, 'nombre', d.nombre, 'nombre_largo', d.nombre_largo, 'pais', d.pais_nombre, 'region', d.region,
        'zona_horaria', d.zona_horaria, 'moneda', d.moneda_iso, 'moneda_visitante', d.moneda_visitante,
        'idioma_principal', d.idioma_principal, 'idiomas', d.idiomas, 'whatsapp', d.whatsapp,
        'email', d.email_contacto, 'lema', destinos.texto_en('destino', d.id, 'lema', p_idioma, d.lema),
        'dominio', d.dominio, 'marca', d.marca_nombre, 'latitud', d.latitud, 'longitud', d.longitud)
      from destinos.dst_destino d where d.id = p_destino_id),
    'categorias', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'babosa', c.babosa, 'seccion', c.seccion,
        'nombre', destinos.texto_en('categoria', c.id, 'nombre', p_idioma, c.nombre)) order by dc.orden), '[]'::jsonb)
      from destinos.dst_destino_categoria dc
      join destinos.dst_categoria c on c.id = dc.categoria_id
      where dc.destino_id = p_destino_id and dc.es_visible),
    'negocios', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', n.id, 'nombre', n.nombre, 'categoria', c.babosa, 'seccion', c.seccion,
        'resumen', destinos.texto_en('negocio', n.id, 'resumen', p_idioma, n.resumen),
        'rango_precio', n.rango_precio, 'precio_desde_usd', n.precio_desde_usd,
        'calificacion', n.promedio_calificacion, 'resenas', n.total_resenas,
        'verificado', n.estado_verificacion = 'verificado', 'destacado', n.es_destacado,
        'direccion', n.direccion, 'latitud', n.latitud, 'longitud', n.longitud,
        'whatsapp', n.telefono_whatsapp, 'telefono', n.telefono, 'sitio_web', n.sitio_web,
        'url', '/' || p_idioma || '/' || destinos.babosa_en('categoria', c.id, p_idioma, c.babosa)
               || '/' || destinos.babosa_en('negocio', n.id, p_idioma, n.babosa)
      ) order by n.es_destacado desc, n.promedio_calificacion desc nulls last, n.nombre), '[]'::jsonb)
      from (
        select * from destinos.dst_negocio
         where destino_id = p_destino_id and estado_publicacion = 'publicado' and not coalesce(esta_cerrado, false)
         order by es_destacado desc, promedio_calificacion desc nulls last
         limit p_max_negocios
      ) n
      join destinos.dst_categoria c on c.id = n.categoria_id),
    'tours', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id, 'nombre', t.nombre, 'resumen', t.resumen, 'duracion_horas', t.duracion_horas,
        'hora_inicio', t.hora_inicio, 'dificultad', t.dificultad, 'edad_minima', t.edad_minima,
        'precio_adulto_usd', t.precio_adulto_usd, 'precio_nino_usd', t.precio_nino_usd,
        'recoge_en_hotel', t.recoge_en_hotel, 'idiomas_guia', t.idiomas_guia, 'incluye', t.incluye,
        'operador', n.nombre, 'negocio_id', t.negocio_id, 'destacado', t.es_destacado
      ) order by t.es_destacado desc, t.nombre), '[]'::jsonb)
      from destinos.dst_tour t
      left join destinos.dst_negocio n on n.id = t.negocio_id
      where t.destino_id = p_destino_id and t.estado = 'publicado'),
    'conocimiento', (
      select coalesce(jsonb_agg(jsonb_build_object('tipo', k.tipo, 'titulo', k.titulo, 'contenido', k.contenido)
                                order by k.prioridad desc), '[]'::jsonb)
      from destinos.conocimiento_base(p_destino_id, 'planificador', 5::smallint) k)
  );
$$;
comment on function destinos.contexto_destino is
  'El catalogo completo del destino en el idioma pedido: negocios publicados, tours, categorias y conocimiento base. Es lo que el planificador lee para armar un itinerario con ids reales.';

create or replace function destinos.contexto_viajero(p_viajero_id uuid, p_max_mensajes integer default 40)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'viajero', (select to_jsonb(v) from destinos.dst_viajero v where v.id = p_viajero_id),
    'solicitudes', (
      select coalesce(jsonb_agg(to_jsonb(s) order by s.creado_en desc), '[]'::jsonb)
      from destinos.dst_solicitud s where s.viajero_id = p_viajero_id),
    'reservas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'codigo', r.codigo, 'estado', r.estado, 'total_usd', r.total_usd,
        'estado_pago', r.estado_pago, 'creado_en', r.creado_en,
        'lineas', (select coalesce(jsonb_agg(jsonb_build_object('descripcion', l.descripcion, 'para_el', l.para_el, 'total_usd', l.total_usd)), '[]'::jsonb)
                   from destinos.dst_reserva_linea l where l.reserva_id = r.id)
      ) order by r.creado_en desc), '[]'::jsonb)
      from destinos.dst_reserva r where r.viajero_id = p_viajero_id),
    'conversaciones', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'canal', c.canal, 'estado', c.estado, 'atendida_por', c.atendida_por,
        'resumen_ia', c.resumen_ia, 'sentimiento', c.sentimiento, 'intencion', c.intencion,
        'total_mensajes', c.total_mensajes, 'ultimo_mensaje_en', c.ultimo_mensaje_en
      ) order by c.ultimo_mensaje_en desc nulls last), '[]'::jsonb)
      from destinos.dst_conversacion c where c.viajero_id = p_viajero_id),
    'itinerarios', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'titulo', i.titulo, 'babosa', i.babosa, 'dias', i.dias, 'empieza_el', i.empieza_el,
        'total_usd', i.total_usd, 'idioma', i.idioma, 'es_publico', i.es_publico, 'creado_en', i.creado_en
      ) order by i.creado_en desc), '[]'::jsonb)
      from destinos.dst_itinerario i where i.viajero_id = p_viajero_id),
    'tareas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id, 'titulo', t.titulo, 'vence_el', t.vence_el, 'prioridad', t.prioridad,
        'esta_hecha', t.esta_hecha, 'responsable_id', t.responsable_id
      ) order by t.vence_el nulls last), '[]'::jsonb)
      from destinos.dst_tarea t where t.viajero_id = p_viajero_id and not t.esta_hecha),
    'mensajes', (
      select coalesce(jsonb_agg(to_jsonb(m) order by m.enviado_en), '[]'::jsonb)
      from (select m.id, m.canal, m.direccion, m.autor, m.asunto, m.cuerpo, m.automatico, m.plantilla,
                   m.enviado_en, m.conversacion_id, m.estado_envio
              from destinos.dst_mensaje m
             where m.viajero_id = p_viajero_id
             order by m.enviado_en desc limit p_max_mensajes) m)
  );
$$;
comment on function destinos.contexto_viajero is
  'La ficha 360 de un viajero: datos, solicitudes, reservas, conversaciones, itinerarios, tareas y ultimos mensajes. La lee el panel y el agente de seguimiento.';

create or replace function destinos.contexto_conversacion(p_conversacion_id uuid, p_max_mensajes integer default 30)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'conversacion', (select to_jsonb(c) from destinos.dst_conversacion c where c.id = p_conversacion_id),
    'viajero', (
      select to_jsonb(v) from destinos.dst_conversacion c
      join destinos.dst_viajero v on v.id = c.viajero_id where c.id = p_conversacion_id),
    'solicitud', (
      select to_jsonb(s) from destinos.dst_conversacion c
      join destinos.dst_solicitud s on s.id = c.solicitud_id where c.id = p_conversacion_id),
    'agente', (
      select to_jsonb(a) from destinos.dst_conversacion c
      join destinos.dst_agente a on a.id = c.agente_id where c.id = p_conversacion_id),
    'mensajes', (
      select coalesce(jsonb_agg(to_jsonb(m) order by m.enviado_en), '[]'::jsonb)
      from (select m.id, m.autor, m.direccion, m.cuerpo, m.enviado_en, m.automatico, m.estado_envio
              from destinos.dst_mensaje m
             where m.conversacion_id = p_conversacion_id and m.canal <> 'nota_interna'
             order by m.enviado_en desc limit p_max_mensajes) m),
    'notas', (
      select coalesce(jsonb_agg(jsonb_build_object('cuerpo', m.cuerpo, 'enviado_en', m.enviado_en, 'usuario_id', m.usuario_id) order by m.enviado_en), '[]'::jsonb)
      from destinos.dst_mensaje m where m.conversacion_id = p_conversacion_id and m.canal = 'nota_interna')
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Mensajes: entrar y salir por una sola puerta
-- ---------------------------------------------------------------------------
create or replace function destinos.registrar_mensaje_entrante(
  p_destino_id    uuid,
  p_canal         text,
  p_identificador text,
  p_cuerpo        text,
  p_id_externo    text default null,
  p_nombre        text default null,
  p_idioma        text default null,
  p_metadatos     jsonb default '{}'::jsonb,
  p_viajero_id    uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_canal      destinos.canal_mensaje := p_canal::destinos.canal_mensaje;
  v_conv       destinos.dst_conversacion%rowtype;
  v_existente  uuid;
  v_existente_conv uuid;
  v_viajero_id uuid := p_viajero_id;
  v_mensaje_id uuid;
  v_es_nueva   boolean := false;
  v_idioma     char(2);
begin
  -- Los webhooks reintentan: el mismo mensaje externo no entra dos veces.
  if p_id_externo is not null then
    select m.id, m.conversacion_id into v_existente, v_existente_conv
      from destinos.dst_mensaje m where m.canal = v_canal and m.id_externo = p_id_externo;
    if v_existente is not null then
      return jsonb_build_object('mensaje_id', v_existente, 'conversacion_id', v_existente_conv, 'duplicado', true);
    end if;
  end if;

  -- Por WhatsApp o correo el identificador ES el viajero: se busca o se crea.
  if v_viajero_id is null and v_canal = 'whatsapp' and p_identificador ~ '^\+[1-9][0-9]{6,14}$' then
    select id into v_viajero_id from destinos.dst_viajero
     where destino_id = p_destino_id and whatsapp = p_identificador order by creado_en limit 1;
    if v_viajero_id is null then
      insert into destinos.dst_viajero (destino_id, nombre, whatsapp, idioma, origen, acepta_marketing)
      values (p_destino_id, p_nombre, p_identificador, coalesce(p_idioma, 'es'), 'whatsapp', false)
      returning id into v_viajero_id;
    end if;
  elsif v_viajero_id is null and v_canal = 'email' and p_identificador ~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-zA-Z]{2,}$' then
    select id into v_viajero_id from destinos.dst_viajero
     where destino_id = p_destino_id and lower(email) = lower(p_identificador) limit 1;
    if v_viajero_id is null then
      insert into destinos.dst_viajero (destino_id, nombre, email, idioma, origen, acepta_marketing)
      values (p_destino_id, p_nombre, lower(p_identificador), coalesce(p_idioma, 'es'), 'email', false)
      returning id into v_viajero_id;
    end if;
  end if;

  select * into v_conv from destinos.dst_conversacion
   where destino_id = p_destino_id and canal = v_canal
     and identificador_externo = p_identificador and estado <> 'cerrada'
   limit 1;

  if v_conv.id is null then
    v_idioma := coalesce(
      p_idioma::char(2),
      (select idioma from destinos.dst_viajero where id = v_viajero_id),
      (select idioma_principal from destinos.dst_destino where id = p_destino_id),
      'es');
    insert into destinos.dst_conversacion (destino_id, viajero_id, canal, identificador_externo, idioma, metadatos, agente_id, solicitud_id)
    values (
      p_destino_id, v_viajero_id, v_canal, p_identificador, v_idioma, p_metadatos,
      (select a.id from destinos.dst_agente a where a.destino_id = p_destino_id and a.clave = 'concierge' and a.esta_activo),
      (select s.id from destinos.dst_solicitud s where s.viajero_id = v_viajero_id and s.etapa not in ('reservado','perdido') order by s.creado_en desc limit 1)
    )
    returning * into v_conv;
    v_es_nueva := true;
  elsif v_conv.viajero_id is null and v_viajero_id is not null then
    update destinos.dst_conversacion set viajero_id = v_viajero_id where id = v_conv.id;
    v_conv.viajero_id := v_viajero_id;
  end if;

  insert into destinos.dst_mensaje (destino_id, viajero_id, solicitud_id, conversacion_id, canal, direccion, autor,
                                    cuerpo, id_externo, metadatos, enviado_en)
  values (p_destino_id, v_conv.viajero_id, v_conv.solicitud_id, v_conv.id, v_canal, 'entrante', 'viajero',
          p_cuerpo, p_id_externo, p_metadatos, now())
  returning id into v_mensaje_id;

  return jsonb_build_object(
    'mensaje_id', v_mensaje_id, 'conversacion_id', v_conv.id, 'viajero_id', v_conv.viajero_id,
    'solicitud_id', v_conv.solicitud_id, 'es_nueva', v_es_nueva, 'atendida_por', v_conv.atendida_por,
    'estado', v_conv.estado, 'idioma', v_conv.idioma, 'duplicado', false);
end;
$$;
comment on function destinos.registrar_mensaje_entrante is
  'Entra un mensaje del viajero por cualquier canal: encuentra o crea la conversacion, encuentra o crea al viajero (WhatsApp o correo) y guarda el mensaje. Idempotente por id_externo.';

create or replace function destinos.registrar_mensaje_saliente(
  p_conversacion_id uuid,
  p_cuerpo          text,
  p_autor           text default 'ia',
  p_usuario_id      uuid default null,
  p_agente_id       uuid default null,
  p_ejecucion_id    uuid default null,
  p_automatico      boolean default false,
  p_plantilla       text default null,
  p_id_externo      text default null,
  p_estado_envio    text default 'enviado',
  p_asunto          text default null,
  p_metadatos       jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_conv destinos.dst_conversacion%rowtype;
  v_id   uuid;
begin
  select * into v_conv from destinos.dst_conversacion where id = p_conversacion_id;
  if v_conv.id is null then
    raise exception 'La conversacion % no existe', p_conversacion_id;
  end if;
  insert into destinos.dst_mensaje (destino_id, viajero_id, solicitud_id, conversacion_id, canal, direccion, autor,
                                    asunto, cuerpo, usuario_id, agente_id, ejecucion_id, automatico, plantilla,
                                    id_externo, estado_envio, metadatos, enviado_en)
  values (v_conv.destino_id, v_conv.viajero_id, v_conv.solicitud_id, v_conv.id, v_conv.canal, 'saliente', p_autor,
          p_asunto, p_cuerpo, p_usuario_id, p_agente_id, p_ejecucion_id, p_automatico, p_plantilla,
          p_id_externo, p_estado_envio, p_metadatos, now())
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Lo que hace el equipo desde el panel (corren como el usuario)
-- ---------------------------------------------------------------------------
create or replace function destinos.tomar_conversacion(p_conversacion_id uuid) returns void
language sql set search_path = '' as $$
  update destinos.dst_conversacion
     set atendida_por = 'humano', responsable_id = (select auth.uid()),
         estado = case when estado = 'escalada' then 'esperando_equipo' else estado end
   where id = p_conversacion_id;
$$;

create or replace function destinos.devolver_a_ia(p_conversacion_id uuid) returns void
language sql set search_path = '' as $$
  update destinos.dst_conversacion
     set atendida_por = 'ia', responsable_id = null,
         estado = case when estado in ('escalada','esperando_equipo') then 'abierta' else estado end
   where id = p_conversacion_id;
$$;

create or replace function destinos.cerrar_conversacion(p_conversacion_id uuid) returns void
language sql set search_path = '' as $$
  update destinos.dst_conversacion
     set estado = 'cerrada', cerrada_en = now(), requiere_revision = false
   where id = p_conversacion_id;
$$;

create or replace function destinos.revisar_conversacion(p_conversacion_id uuid, p_calificacion smallint, p_nota text default null)
returns void language sql set search_path = '' as $$
  update destinos.dst_conversacion
     set calificacion_revision = p_calificacion, nota_revision = p_nota,
         revisada_por = (select auth.uid()), revisada_en = now(), requiere_revision = false
   where id = p_conversacion_id;
$$;

create or replace function destinos.mover_etapa(p_solicitud_id uuid, p_etapa text, p_motivo text default null)
returns void language plpgsql set search_path = '' as $$
declare
  v_etapa destinos.etapa_comercial := p_etapa::destinos.etapa_comercial;
begin
  update destinos.dst_solicitud s
     set etapa = v_etapa,
         motivo_perdida = case when v_etapa = 'perdido' then coalesce(p_motivo, 'sin motivo') else s.motivo_perdida end,
         probabilidad = case v_etapa
           when 'nuevo' then 10 when 'contactado' then 25 when 'propuesta_enviada' then 50
           when 'negociacion' then 70 when 'reservado' then 100 when 'perdido' then 0 end,
         responsable_id = coalesce(s.responsable_id, (select auth.uid()))
   where s.id = p_solicitud_id;
end;
$$;

create or replace function destinos.marcar_acceso() returns void
language sql set search_path = '' as $$
  update destinos.dst_usuario set ultimo_acceso_en = now() where id = (select auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- 5. Tablero y reportes
-- ---------------------------------------------------------------------------
create or replace function destinos.tablero(p_destino_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  with d as (select zona_horaria as tz from destinos.dst_destino where id = p_destino_id),
  hoy as (select (now() at time zone (select tz from d))::date as dia)
  select jsonb_build_object(
    'leads_hoy', (select count(*) from destinos.dst_solicitud s, d, hoy
                   where s.destino_id = p_destino_id and (s.creado_en at time zone d.tz)::date = hoy.dia),
    'leads_7d', (select count(*) from destinos.dst_solicitud where destino_id = p_destino_id and creado_en >= now() - interval '7 days'),
    'leads_30d', (select count(*) from destinos.dst_solicitud where destino_id = p_destino_id and creado_en >= now() - interval '30 days'),
    'leads_30d_previos', (select count(*) from destinos.dst_solicitud where destino_id = p_destino_id
                           and creado_en >= now() - interval '60 days' and creado_en < now() - interval '30 days'),
    'por_etapa', (
      select coalesce(jsonb_agg(jsonb_build_object('etapa', e.etapa, 'total', coalesce(x.total, 0), 'valor_usd', coalesce(x.valor, 0)) order by e.orden), '[]'::jsonb)
      from (values ('nuevo',1),('contactado',2),('propuesta_enviada',3),('negociacion',4),('reservado',5),('perdido',6)) e(etapa, orden)
      left join (select etapa::text as etapa, count(*) as total, sum(coalesce(valor_estimado_usd, 0)) as valor
                   from destinos.dst_solicitud where destino_id = p_destino_id and creado_en >= now() - interval '90 days'
                  group by etapa) x on x.etapa = e.etapa),
    'valor_pipeline_usd', (select coalesce(sum(valor_estimado_usd), 0) from destinos.dst_solicitud
                            where destino_id = p_destino_id and etapa not in ('reservado','perdido')),
    'calientes', (select count(*) from destinos.dst_solicitud where destino_id = p_destino_id
                   and temperatura = 'caliente' and etapa not in ('reservado','perdido')),
    'sin_responder', (select count(*) from destinos.dst_solicitud where destino_id = p_destino_id
                       and primera_respuesta_en is null and etapa not in ('reservado','perdido')),
    'conversaciones_abiertas', (select count(*) from destinos.dst_conversacion where destino_id = p_destino_id and estado <> 'cerrada'),
    'esperando_equipo', (select count(*) from destinos.dst_conversacion where destino_id = p_destino_id and estado in ('esperando_equipo','escalada')),
    'escaladas', (select count(*) from destinos.dst_conversacion where destino_id = p_destino_id and estado = 'escalada'),
    'requieren_revision', (select count(*) from destinos.dst_conversacion where destino_id = p_destino_id and requiere_revision),
    'tareas_vencidas', (select count(*) from destinos.dst_tarea t, hoy where t.destino_id = p_destino_id and not t.esta_hecha and t.vence_el < hoy.dia),
    'tareas_hoy', (select count(*) from destinos.dst_tarea t, hoy where t.destino_id = p_destino_id and not t.esta_hecha and t.vence_el = hoy.dia),
    'reservas_mes', (
      select jsonb_build_object('total', count(*), 'ventas_usd', coalesce(sum(total_usd), 0), 'comision_usd', coalesce(sum(comision_usd), 0))
      from destinos.dst_reserva r, d
      where r.destino_id = p_destino_id and r.estado in ('confirmada','pagada','completada')
        and date_trunc('month', r.creado_en at time zone d.tz) = date_trunc('month', now() at time zone d.tz)),
    'ia_mes', (
      select jsonb_build_object('ejecuciones', count(*), 'costo_usd', coalesce(sum(costo_usd), 0), 'errores', count(*) filter (where error is not null))
      from destinos.dst_agente_ejecucion e, d
      where e.destino_id = p_destino_id
        and date_trunc('month', e.creado_en at time zone d.tz) = date_trunc('month', now() at time zone d.tz)),
    'primera_respuesta_min', (
      select round((avg(extract(epoch from (primera_respuesta_en - creado_en)) / 60))::numeric, 1)
      from destinos.dst_solicitud
      where destino_id = p_destino_id and primera_respuesta_en is not null and creado_en >= now() - interval '30 days'),
    'tasa_cierre_90d', (
      select case when count(*) = 0 then null else round(100.0 * count(*) filter (where etapa = 'reservado') / count(*), 1) end
      from destinos.dst_solicitud where destino_id = p_destino_id and creado_en >= now() - interval '90 days'),
    'seguimientos_pendientes', (
      select jsonb_build_object('programados', count(*) filter (where estado = 'programado'),
                                'por_aprobar', count(*) filter (where estado = 'pendiente_aprobacion'))
      from destinos.dst_automatizacion_envio
      where destino_id = p_destino_id and estado in ('programado','pendiente_aprobacion'))
  );
$$;
comment on function destinos.tablero is 'Los numeros de la portada del panel, en un solo viaje a la base.';

create or replace function destinos.reporte(
  p_destino_id uuid, p_desde date default (current_date - 90), p_hasta date default current_date
) returns jsonb language sql stable set search_path = '' as $$
  with s as (
    select * from destinos.dst_solicitud
     where destino_id = p_destino_id and creado_en >= p_desde and creado_en < p_hasta + 1
  ),
  v as (select * from destinos.dst_viajero where destino_id = p_destino_id)
  select jsonb_build_object(
    'periodo', jsonb_build_object('desde', p_desde, 'hasta', p_hasta),
    'total_leads', (select count(*) from s),
    'embudo', (
      select coalesce(jsonb_agg(jsonb_build_object('etapa', e.etapa, 'total', coalesce(x.total, 0)) order by e.orden), '[]'::jsonb)
      from (values ('nuevo',1),('contactado',2),('propuesta_enviada',3),('negociacion',4),('reservado',5),('perdido',6)) e(etapa, orden)
      left join (select etapa::text as etapa, count(*) as total from s group by etapa) x on x.etapa = e.etapa),
    'por_tipo', (
      select coalesce(jsonb_agg(jsonb_build_object('tipo', tipo, 'total', total) order by total desc), '[]'::jsonb)
      from (select tipo::text as tipo, count(*) as total from s group by tipo) x),
    'por_origen', (
      select coalesce(jsonb_agg(jsonb_build_object('origen', origen, 'total', total, 'reservados', reservados) order by total desc), '[]'::jsonb)
      from (select coalesce(v.origen, '(sin origen)') as origen, count(*) as total,
                   count(*) filter (where s.etapa = 'reservado') as reservados
              from s join v on v.id = s.viajero_id group by 1) x),
    'por_fuente', (
      select coalesce(jsonb_agg(jsonb_build_object('fuente', fuente, 'medio', medio, 'campana', campana, 'total', total) order by total desc), '[]'::jsonb)
      from (select coalesce(v.utm_fuente, '(directo)') as fuente, v.utm_medio as medio, v.utm_campana as campana, count(*) as total
              from s join v on v.id = s.viajero_id group by 1, 2, 3 order by 4 desc limit 20) x),
    'por_idioma', (
      select coalesce(jsonb_agg(jsonb_build_object('idioma', idioma, 'total', total) order by total desc), '[]'::jsonb)
      from (select v.idioma, count(*) as total from s join v on v.id = s.viajero_id group by 1) x),
    'por_pais', (
      select coalesce(jsonb_agg(jsonb_build_object('pais', pais, 'total', total) order by total desc), '[]'::jsonb)
      from (select coalesce(v.pais_iso::text, '??') as pais, count(*) as total from s join v on v.id = s.viajero_id group by 1 order by 2 desc limit 15) x),
    'por_dia', (
      select coalesce(jsonb_agg(jsonb_build_object('dia', dia, 'total', total) order by dia), '[]'::jsonb)
      from (select creado_en::date as dia, count(*) as total from s group by 1) x),
    'por_vendedor', (
      select coalesce(jsonb_agg(jsonb_build_object('usuario_id', u.id, 'nombre', u.nombre, 'leads', x.total, 'reservados', x.reservados, 'valor_usd', x.valor) order by x.total desc), '[]'::jsonb)
      from (select responsable_id, count(*) as total, count(*) filter (where etapa = 'reservado') as reservados,
                   sum(coalesce(valor_estimado_usd, 0)) as valor
              from s where responsable_id is not null group by 1) x
      join destinos.dst_usuario u on u.id = x.responsable_id),
    'temperatura', (
      select coalesce(jsonb_agg(jsonb_build_object('temperatura', t, 'total', total)), '[]'::jsonb)
      from (select coalesce(temperatura, 'sin puntuar') as t, count(*) as total from s group by 1) x),
    'ingresos_por_mes', (
      select coalesce(jsonb_agg(jsonb_build_object('mes', mes, 'reservas', reservas, 'ventas_usd', ventas, 'comision_usd', comision) order by mes), '[]'::jsonb)
      from (select to_char(date_trunc('month', creado_en), 'YYYY-MM') as mes, count(*) as reservas,
                   sum(total_usd) as ventas, sum(comision_usd) as comision
              from destinos.dst_reserva
             where destino_id = p_destino_id and estado in ('confirmada','pagada','completada')
               and creado_en >= date_trunc('month', now()) - interval '11 months'
             group by 1) x),
    'ia_por_mes', (
      select coalesce(jsonb_agg(jsonb_build_object('mes', mes, 'ejecuciones', n, 'costo_usd', costo, 'tokens', tokens) order by mes), '[]'::jsonb)
      from (select to_char(date_trunc('month', creado_en), 'YYYY-MM') as mes, count(*) as n, sum(costo_usd) as costo,
                   sum(entrada_tokens + salida_tokens + cache_lectura_tokens + cache_escritura_tokens) as tokens
              from destinos.dst_agente_ejecucion
             where destino_id = p_destino_id and creado_en >= date_trunc('month', now()) - interval '11 months'
             group by 1) x),
    'ia_por_agente', (
      select coalesce(jsonb_agg(jsonb_build_object('agente', clave_agente, 'ejecuciones', n, 'costo_usd', costo, 'errores', errores) order by costo desc), '[]'::jsonb)
      from (select clave_agente, count(*) as n, sum(costo_usd) as costo, count(*) filter (where error is not null) as errores
              from destinos.dst_agente_ejecucion
             where destino_id = p_destino_id and creado_en >= p_desde group by 1) x),
    'conversaciones', (
      select jsonb_build_object('total', count(*), 'por_ia', count(*) filter (where atendida_por = 'ia'),
                                'escaladas', count(*) filter (where estado = 'escalada'),
                                'calificacion_promedio', round(avg(calificacion_revision)::numeric, 2),
                                'sentimiento_negativo', count(*) filter (where sentimiento = 'negativo'))
      from destinos.dst_conversacion where destino_id = p_destino_id and creado_en >= p_desde),
    'tiempo_en_etapa_horas', (
      select coalesce(jsonb_agg(jsonb_build_object('etapa', de, 'horas', horas)), '[]'::jsonb)
      from (select h.de_etapa::text as de,
                   round((avg(extract(epoch from (h.creado_en - prev.creado_en))) / 3600)::numeric, 1) as horas
              from destinos.dst_etapa_historial h
              join lateral (select p.creado_en from destinos.dst_etapa_historial p
                             where p.solicitud_id = h.solicitud_id and p.creado_en < h.creado_en
                             order by p.creado_en desc limit 1) prev on true
             where h.destino_id = p_destino_id and h.de_etapa is not null and h.creado_en >= p_desde
             group by 1) x)
  );
$$;
comment on function destinos.reporte is 'Embudo, origenes, idiomas, paises, vendedores, ingresos y costo de IA de un periodo, en un JSON.';

-- ---------------------------------------------------------------------------
-- 6. Automatizaciones: programar (aqui) y ejecutar (en el cron de Next.js)
-- ---------------------------------------------------------------------------
create or replace function destinos.programar_automatizaciones(p_destino_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
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
         and not v.no_molestar
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
         and not v.no_molestar
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
       where s.destino_id = p_destino_id and v.llega_el is not null and not v.no_molestar
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
       where s.destino_id = p_destino_id and v.sale_el is not null and not v.no_molestar
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
       where s.destino_id = p_destino_id and not v.no_molestar
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
$$;
comment on function destinos.programar_automatizaciones is
  'Recorre las automatizaciones activas del destino y deja programado en dst_automatizacion_envio lo que toca. No envia nada: eso lo hace el cron de Next.js, que necesita la IA y los canales.';

create or replace function destinos.plantilla_para(p_destino_id uuid, p_clave text, p_canal text, p_idioma text)
returns table (asunto text, cuerpo text, idioma char(2))
language sql stable security definer set search_path = '' as $$
  select p.asunto, p.cuerpo, p.idioma
    from destinos.dst_plantilla_mensaje p
    join destinos.dst_destino d on d.id = p.destino_id
   where p.destino_id = p_destino_id and p.clave = p_clave
     and p.canal = p_canal::destinos.canal_mensaje and p.esta_activa
   order by case when p.idioma = p_idioma then 0 when p.idioma = d.idioma_principal then 1 when p.idioma = 'en' then 2 else 3 end
   limit 1;
$$;

create or replace function destinos.rellenar_plantilla(p_cuerpo text, p_variables jsonb) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v_texto text := p_cuerpo;
  v_clave text;
  v_valor text;
begin
  for v_clave, v_valor in select key, value from jsonb_each_text(coalesce(p_variables, '{}'::jsonb)) loop
    v_texto := replace(v_texto, '{{' || v_clave || '}}', coalesce(v_valor, ''));
  end loop;
  return regexp_replace(v_texto, '\{\{[a-z_]+\}\}', '', 'g');
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Un destino nuevo nace con sus agentes, plantillas y automatizaciones
-- ---------------------------------------------------------------------------
create or replace function destinos.preparar_inteligencia_destino(p_destino_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  d destinos.dst_destino%rowtype;
begin
  select * into d from destinos.dst_destino where id = p_destino_id;
  if d.id is null then
    raise exception 'El destino % no existe', p_destino_id;
  end if;

  insert into destinos.dst_agente (destino_id, clave, nombre, esfuerzo, max_tokens, instrucciones) values
    (p_destino_id, 'concierge', 'Sofía', 'medium', 1500,
     'Atención humana de 8:00 a 20:00 hora local. Si el viajero quiere reservar, pedí fechas, cantidad de personas y un WhatsApp o correo, y creá la solicitud con la herramienta. Nunca prometas disponibilidad ni precios finales: el equipo confirma.'),
    (p_destino_id, 'planificador', 'Planificador', 'high', 16000,
     'Priorizá negocios verificados y con buena calificación. Mezclá aventura y descanso: nunca dos actividades de esfuerzo alto el mismo día. Un día llega y otro se va: esos van livianos.'),
    (p_destino_id, 'seguimiento', 'Seguimiento', 'medium', 2000,
     'Los mensajes de seguimiento son cortos, cálidos y con una sola pregunta o propuesta concreta. Nunca más de un mensaje sin respuesta por día.'),
    (p_destino_id, 'analista', 'Analista', 'low', 1500, null),
    (p_destino_id, 'redactor', 'Redactor', 'high', 16000,
     'Las guías se escriben en primera persona del plural, con datos concretos (precios, tiempos, distancias) y sin adjetivos vacíos.')
  on conflict (destino_id, clave) do nothing;

  insert into destinos.dst_canal (destino_id, tipo, proveedor, nombre_visible) values
    (p_destino_id, 'web', 'web', d.marca_nombre)
  on conflict (destino_id, tipo, proveedor) do nothing;

  insert into destinos.dst_plantilla_mensaje (destino_id, clave, canal, idioma, asunto, cuerpo) values
    (p_destino_id, 'bienvenida', 'whatsapp', 'es', null,
     '¡Hola {{nombre}}! Somos el equipo de {{marca}}. Recibimos tu solicitud para {{destino}} y ya estamos trabajando en ella. {{enlace_itinerario}}¿Hay algo más que te gustaría contarnos de tu viaje?'),
    (p_destino_id, 'bienvenida', 'whatsapp', 'en', null,
     'Hi {{nombre}}! This is the {{marca}} team. We received your request for {{destino}} and we are already working on it. {{enlace_itinerario}}Is there anything else you would like to tell us about your trip?'),
    (p_destino_id, 'bienvenida', 'email', 'es', 'Recibimos tu solicitud para {{destino}}',
     'Hola {{nombre}},\n\nSomos el equipo de {{marca}}. Recibimos tu solicitud y ya estamos trabajando en ella.\n\n{{enlace_itinerario}}\n\nRespondé a este correo con cualquier duda: te contesta una persona.\n\n{{marca}}'),
    (p_destino_id, 'bienvenida', 'email', 'en', 'We received your request for {{destino}}',
     'Hi {{nombre}},\n\nThis is the {{marca}} team. We received your request and we are already working on it.\n\n{{enlace_itinerario}}\n\nReply to this email with any question: a real person answers.\n\n{{marca}}'),
    (p_destino_id, 'itinerario_listo', 'whatsapp', 'es', null,
     '{{nombre}}, tu plan para {{destino}} está listo: {{enlace_itinerario}} Decinos qué te gustaría cambiar y lo ajustamos.'),
    (p_destino_id, 'itinerario_listo', 'whatsapp', 'en', null,
     '{{nombre}}, your plan for {{destino}} is ready: {{enlace_itinerario}} Tell us what you would like to change and we will adjust it.'),
    (p_destino_id, 'itinerario_listo', 'email', 'es', 'Tu plan para {{destino}} está listo',
     'Hola {{nombre}},\n\nTu plan para {{destino}} ya está listo:\n{{enlace_itinerario}}\n\nDecinos qué te gustaría cambiar y lo ajustamos.\n\n{{marca}}'),
    (p_destino_id, 'itinerario_listo', 'email', 'en', 'Your plan for {{destino}} is ready',
     'Hi {{nombre}},\n\nYour plan for {{destino}} is ready:\n{{enlace_itinerario}}\n\nTell us what you would like to change and we will adjust it.\n\n{{marca}}'),
    (p_destino_id, 'antes_de_llegar', 'whatsapp', 'es', null,
     '{{nombre}}, faltan pocos días para {{destino}}. ¿Necesitás ayuda con transporte, reservas o el clima? Escribinos por aquí.'),
    (p_destino_id, 'antes_de_llegar', 'whatsapp', 'en', null,
     '{{nombre}}, {{destino}} is just a few days away. Need help with transport, bookings or the weather? Just reply here.'),
    (p_destino_id, 'antes_de_llegar', 'email', 'es', 'Faltan pocos días para {{destino}}',
     'Hola {{nombre}},\n\nFaltan pocos días para tu viaje a {{destino}}. Si necesitás ayuda con transporte, reservas o el clima, respondé a este correo.\n\n{{marca}}'),
    (p_destino_id, 'antes_de_llegar', 'email', 'en', '{{destino}} is just a few days away',
     'Hi {{nombre}},\n\nYour trip to {{destino}} is just a few days away. If you need help with transport, bookings or the weather, reply to this email.\n\n{{marca}}'),
    (p_destino_id, 'despues_de_salir', 'whatsapp', 'es', null,
     '{{nombre}}, ¡gracias por visitar {{destino}}! ¿Cómo te fue? Si algo te encantó, nos ayuda muchísimo que lo cuentes en una reseña.'),
    (p_destino_id, 'despues_de_salir', 'whatsapp', 'en', null,
     '{{nombre}}, thank you for visiting {{destino}}! How was it? If you loved something, a review helps us a lot.'),
    (p_destino_id, 'despues_de_salir', 'email', 'es', '¿Cómo te fue en {{destino}}?',
     'Hola {{nombre}},\n\n¡Gracias por visitar {{destino}}! ¿Cómo te fue? Si algo te encantó, nos ayuda muchísimo que lo cuentes en una reseña.\n\n{{marca}}'),
    (p_destino_id, 'despues_de_salir', 'email', 'en', 'How was {{destino}}?',
     'Hi {{nombre}},\n\nThank you for visiting {{destino}}! How was it? If you loved something, a review helps us a lot.\n\n{{marca}}')
  on conflict (destino_id, clave, canal, idioma) do nothing;

  insert into destinos.dst_automatizacion (destino_id, clave, nombre, descripcion, disparador, condiciones, accion, parametros, retraso_horas, maximo_por_solicitud, requiere_aprobacion, orden) values
    (p_destino_id, 'puntuar_nuevo', 'Puntuar cada lead nuevo',
     'La IA lee la solicitud y la puntúa de 0 a 100 con una siguiente acción.',
     'solicitud_nueva', '{}', 'puntuar', '{}', 0, 1, false, 1),
    (p_destino_id, 'bienvenida', 'Bienvenida inmediata',
     'Confirma que recibimos la solicitud, con el enlace al plan si ya existe.',
     'solicitud_nueva', '{}', 'enviar_plantilla', '{"plantilla":"bienvenida"}', 0, 1, false, 2),
    (p_destino_id, 'seguimiento_24h', 'Seguimiento a las 24 horas',
     'Si el viajero no respondió en un día, la IA le escribe un mensaje corto y personal.',
     'sin_respuesta', '{"horas":24}', 'mensaje_ia', '{"agente":"seguimiento","intento":1}', 0, 1, false, 3),
    (p_destino_id, 'seguimiento_72h', 'Seguimiento a los 3 días',
     'Segundo intento con una propuesta concreta. Una persona aprueba antes de enviar.',
     'sin_respuesta', '{"horas":72}', 'mensaje_ia', '{"agente":"seguimiento","intento":2}', 0, 1, true, 4),
    (p_destino_id, 'seguimiento_7d', 'Último intento a la semana',
     'Mensaje de cierre suave. Una persona aprueba antes de enviar.',
     'sin_respuesta', '{"horas":168}', 'mensaje_ia', '{"agente":"seguimiento","intento":3}', 0, 1, true, 5),
    (p_destino_id, 'decidir_cierre', 'Decidir si se cierra',
     'Dos semanas sin respuesta: tarea para que alguien decida si se marca perdido.',
     'sin_respuesta', '{"horas":336}', 'crear_tarea', '{"titulo":"Decidir si cerrar este prospecto","prioridad":"baja"}', 0, 1, false, 6),
    (p_destino_id, 'caliente_llamar', 'Lead caliente: llamar hoy',
     'Cuando la IA marca un lead como caliente, crea una tarea urgente.',
     'puntaje', '{"temperatura":"caliente"}', 'crear_tarea', '{"titulo":"Lead caliente: llamar hoy","prioridad":"urgente"}', 0, 1, false, 7),
    (p_destino_id, 'antes_de_llegar_3d', 'Tres días antes de llegar',
     'Se ofrece ayuda con transporte, reservas y clima.',
     'antes_de_llegar', '{"dias":3,"hora":"09:00"}', 'enviar_plantilla', '{"plantilla":"antes_de_llegar"}', 0, 1, false, 8),
    (p_destino_id, 'despues_de_salir_2d', 'Dos días después de irse',
     'Agradece la visita y pide una reseña. Solo a quien reservó.',
     'despues_de_salir', '{"dias":2,"hora":"10:00","etapas":["reservado"]}', 'enviar_plantilla', '{"plantilla":"despues_de_salir"}', 0, 1, false, 9),
    (p_destino_id, 'conversacion_sin_atender', 'Conversación esperando al equipo',
     'Una conversación lleva dos horas esperando a una persona: tarea para atenderla.',
     'conversacion_inactiva', '{"horas":2}', 'crear_tarea', '{"titulo":"Responder conversación en espera","prioridad":"alta"}', 0, 1, false, 10)
  on conflict (destino_id, clave) do nothing;
end;
$$;
comment on function destinos.preparar_inteligencia_destino is
  'Deja un destino listo para operar: sus cinco agentes, el canal web, las plantillas en es/en y las diez automatizaciones de arranque. Idempotente. La llama un trigger al crear el destino.';

create or replace function destinos.preparar_inteligencia_al_crear() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform destinos.preparar_inteligencia_destino(new.id);
  return new;
end;
$$;

create trigger dst_destino_inteligencia
  after insert on destinos.dst_destino
  for each row execute function destinos.preparar_inteligencia_al_crear();

-- ---------------------------------------------------------------------------
-- 8. Quien puede llamar que
-- ---------------------------------------------------------------------------
revoke all on function destinos.buscar_conocimiento(uuid, text, integer, text) from public, anon;
revoke all on function destinos.conocimiento_base(uuid, text, smallint) from public, anon;
revoke all on function destinos.babosa_en(text, uuid, char, text) from public, anon;
revoke all on function destinos.contexto_destino(uuid, char, integer) from public, anon;
revoke all on function destinos.contexto_viajero(uuid, integer) from public, anon;
revoke all on function destinos.contexto_conversacion(uuid, integer) from public, anon;
revoke all on function destinos.registrar_mensaje_entrante(uuid, text, text, text, text, text, text, jsonb, uuid) from public, anon, authenticated;
revoke all on function destinos.registrar_mensaje_saliente(uuid, text, text, uuid, uuid, uuid, boolean, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function destinos.tomar_conversacion(uuid) from public, anon;
revoke all on function destinos.devolver_a_ia(uuid) from public, anon;
revoke all on function destinos.cerrar_conversacion(uuid) from public, anon;
revoke all on function destinos.revisar_conversacion(uuid, smallint, text) from public, anon;
revoke all on function destinos.mover_etapa(uuid, text, text) from public, anon;
revoke all on function destinos.marcar_acceso() from public, anon;
revoke all on function destinos.tablero(uuid) from public, anon;
revoke all on function destinos.reporte(uuid, date, date) from public, anon;
revoke all on function destinos.programar_automatizaciones(uuid) from public, anon, authenticated;
revoke all on function destinos.plantilla_para(uuid, text, text, text) from public, anon;
revoke all on function destinos.rellenar_plantilla(text, jsonb) from public, anon;
revoke all on function destinos.preparar_inteligencia_destino(uuid) from public, anon, authenticated;
revoke all on function destinos.es_admin() from public, anon;

grant execute on all functions in schema destinos to service_role;
