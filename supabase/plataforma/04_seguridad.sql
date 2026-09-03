-- Plataforma de destinos | 04: funciones, triggers, vistas y seguridad
-- Dos mundos en una base: el sitio publico, que solo lee contenido publicado,
-- y el panel en /admin, donde el equipo ve lo suyo y nada mas.
-- Todas las funciones fijan search_path vacio y califican cada objeto.

-- ---------------------------------------------------------------------------
-- Helpers de seguridad
-- ---------------------------------------------------------------------------

create or replace function destinos.es_del_equipo()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from destinos.dst_usuario u
     where u.id = (select auth.uid()) and u.esta_activo
  );
$$;

comment on function destinos.es_del_equipo() is
  'true si quien consulta es un miembro activo del equipo. Base de toda politica del panel.';

create or replace function destinos.tiene_acceso_a(p_destino_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from destinos.dst_usuario u
     where u.id = (select auth.uid())
       and u.esta_activo
       and (u.destinos_ids = '{}' or p_destino_id = any (u.destinos_ids))
  );
$$;

comment on function destinos.tiene_acceso_a(uuid) is
  'true si el usuario puede trabajar ese destino. Un arreglo destinos_ids vacio significa todos, y es como se marca a un administrador. Es la funcion que impide que el vendedor de Monteverde vea la cartera de La Fortuna.';

-- ---------------------------------------------------------------------------
-- Funciones de mantenimiento
-- ---------------------------------------------------------------------------

create or replace function destinos.actualizar_marca_tiempo()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;
comment on function destinos.actualizar_marca_tiempo() is
  'Pone actualizado_en al momento actual en cada UPDATE.';

create or replace function destinos.recalcular_calificacion_negocio()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_negocio_id uuid := coalesce(new.negocio_id, old.negocio_id);
begin
  update destinos.dst_negocio n
     set total_resenas = sub.total, promedio_calificacion = sub.promedio
    from (select count(*) as total, round(avg(calificacion), 1) as promedio
            from destinos.dst_resena
           where negocio_id = v_negocio_id and estado = 'publicada') sub
   where n.id = v_negocio_id;
  return null;
end;
$$;
comment on function destinos.recalcular_calificacion_negocio() is
  'Recalcula total y promedio contando SOLO resenas propias publicadas. Las notas de Google y Tripadvisor viven en dst_resena_externa y jamas entran en este promedio.';

create or replace function destinos.recalcular_total_util_resena()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_resena_id uuid := coalesce(new.resena_id, old.resena_id);
begin
  update destinos.dst_resena r
     set total_util = (select count(*) from destinos.dst_resena_util where resena_id = v_resena_id)
   where r.id = v_resena_id;
  return null;
end;
$$;

create or replace function destinos.generar_codigo_reserva()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_sigla text;
  v_correlativo bigint;
begin
  if new.codigo is not null and new.codigo <> '' then
    return new;
  end if;

  select coalesce(d.marca_sigla, upper(left(d.babosa, 3))) into v_sigla
    from destinos.dst_destino d where d.id = new.destino_id;

  select count(*) + 1 into v_correlativo
    from destinos.dst_reserva r
   where r.destino_id = new.destino_id
     and date_part('year', r.creado_en) = date_part('year', now());

  new.codigo := v_sigla || '-' || to_char(now(), 'YYYY') || '-' || lpad(v_correlativo::text, 4, '0');
  return new;
end;
$$;
comment on function destinos.generar_codigo_reserva() is
  'Arma el codigo que ve el viajero (VLF-2026-0042) a partir de la sigla del destino y un correlativo anual. Se calcula en la base para que dos reservas simultaneas no puedan salir con el mismo numero.';

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger tg_destino_antes_actualizar   before update on destinos.dst_destino    for each row execute function destinos.actualizar_marca_tiempo();
create trigger tg_usuario_antes_actualizar   before update on destinos.dst_usuario    for each row execute function destinos.actualizar_marca_tiempo();
create trigger tg_negocio_antes_actualizar   before update on destinos.dst_negocio    for each row execute function destinos.actualizar_marca_tiempo();
create trigger tg_guia_antes_actualizar      before update on destinos.dst_guia       for each row execute function destinos.actualizar_marca_tiempo();
create trigger tg_tour_antes_actualizar      before update on destinos.dst_tour       for each row execute function destinos.actualizar_marca_tiempo();
create trigger tg_resena_antes_actualizar    before update on destinos.dst_resena     for each row execute function destinos.actualizar_marca_tiempo();
create trigger tg_viajero_antes_actualizar   before update on destinos.dst_viajero    for each row execute function destinos.actualizar_marca_tiempo();
create trigger tg_solicitud_antes_actualizar before update on destinos.dst_solicitud  for each row execute function destinos.actualizar_marca_tiempo();
create trigger tg_reserva_antes_actualizar   before update on destinos.dst_reserva    for each row execute function destinos.actualizar_marca_tiempo();
create trigger tg_itinerario_antes_actualizar before update on destinos.dst_itinerario for each row execute function destinos.actualizar_marca_tiempo();

create trigger tg_resena_despues_cambiar_recalcular
  after insert or update or delete on destinos.dst_resena
  for each row execute function destinos.recalcular_calificacion_negocio();

create trigger tg_resena_util_despues_cambiar
  after insert or delete on destinos.dst_resena_util
  for each row execute function destinos.recalcular_total_util_resena();

create trigger tg_reserva_antes_insertar_codigo
  before insert on destinos.dst_reserva
  for each row execute function destinos.generar_codigo_reserva();

-- ---------------------------------------------------------------------------
-- Vistas publicas
-- ---------------------------------------------------------------------------

create view destinos.v_negocio_publicado with (security_invoker = true) as
select n.id, n.destino_id, d.babosa as destino_babosa, d.dominio,
       n.categoria_id, c.babosa_es as categoria_babosa_es, c.babosa_en as categoria_babosa_en,
       c.nombre_es as categoria_nombre_es, c.nombre_en as categoria_nombre_en, c.seccion,
       n.nombre, n.babosa_es, n.babosa_en, n.logo_url, n.email, n.telefono,
       n.telefono_whatsapp, n.sitio_web, n.descripcion_es, n.descripcion_en,
       n.resumen_es, n.resumen_en, n.direccion, n.latitud, n.longitud,
       n.rango_precio, n.precio_desde_usd, n.estado_verificacion, n.es_destacado,
       n.membresia, n.atributos, n.total_resenas, n.promedio_calificacion, n.publicado_en
  from destinos.dst_negocio n
  join destinos.dst_destino  d on d.id = n.destino_id
  join destinos.dst_categoria c on c.id = n.categoria_id
 where n.estado_publicacion = 'publicado' and not n.esta_cerrado and d.esta_activo;

comment on view destinos.v_negocio_publicado is
  'Lo que el sitio publico puede ver, ya unido a su destino y su categoria. Con security_invoker, de modo que las politicas de quien consulta siguen aplicando y la vista no se vuelve una puerta trasera. No expone es_casa ni las notas internas.';

create view destinos.v_embudo_destino with (security_invoker = true) as
select s.destino_id, s.etapa, count(*) as solicitudes,
       count(*) filter (where s.primera_respuesta_en is not null) as respondidas,
       round(avg(extract(epoch from (s.primera_respuesta_en - s.creado_en)) / 3600)::numeric, 1) as horas_primera_respuesta,
       sum(s.valor_estimado_usd) as valor_estimado_usd
  from destinos.dst_solicitud s
 group by s.destino_id, s.etapa;

comment on view destinos.v_embudo_destino is
  'El embudo por destino y etapa, con el tiempo medio de primera respuesta. En turismo ese tiempo decide la venta mas que el precio, y por eso es la primera columna del panel.';

-- ---------------------------------------------------------------------------
-- Captura publica: una sola puerta, controlada
-- ---------------------------------------------------------------------------

create or replace function destinos.registrar_solicitud(
  p_dominio      text,
  p_tipo         text,
  p_nombre       text  default null,
  p_email        text  default null,
  p_whatsapp     text  default null,
  p_llega_el     date  default null,
  p_sale_el      date  default null,
  p_personas     smallint default null,
  p_tipo_viajero text  default null,
  p_presupuesto  text  default null,
  p_intereses    text[] default '{}',
  p_mensaje      text  default null,
  p_idioma       text  default 'es',
  p_origen       text  default 'planificador',
  p_utm_fuente   text  default null,
  p_utm_medio    text  default null,
  p_utm_campana  text  default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_destino_id uuid;
  v_viajero_id uuid;
  v_solicitud_id uuid;
begin
  if p_email is null and p_whatsapp is null then
    raise exception 'Hace falta un correo o un WhatsApp para poder responder.';
  end if;

  select id into v_destino_id
    from destinos.dst_destino
   where dominio = p_dominio and esta_activo;

  if v_destino_id is null then
    raise exception 'Destino no encontrado o todavia no publicado: %', p_dominio;
  end if;

  insert into destinos.dst_viajero (
    destino_id, nombre, email, whatsapp, idioma, llega_el, sale_el, personas,
    tipo_viajero, presupuesto, intereses, origen, utm_fuente, utm_medio, utm_campana,
    acepta_marketing
  ) values (
    v_destino_id, p_nombre, lower(p_email), p_whatsapp, p_idioma, p_llega_el, p_sale_el,
    p_personas, p_tipo_viajero::destinos.tipo_viajero, p_presupuesto::destinos.presupuesto_viaje,
    p_intereses, p_origen, p_utm_fuente, p_utm_medio, p_utm_campana, true
  )
  on conflict (destino_id, lower(email)) where email is not null
  do update set
    nombre       = coalesce(excluded.nombre, destinos.dst_viajero.nombre),
    whatsapp     = coalesce(excluded.whatsapp, destinos.dst_viajero.whatsapp),
    llega_el     = coalesce(excluded.llega_el, destinos.dst_viajero.llega_el),
    sale_el      = coalesce(excluded.sale_el, destinos.dst_viajero.sale_el),
    personas     = coalesce(excluded.personas, destinos.dst_viajero.personas),
    tipo_viajero = coalesce(excluded.tipo_viajero, destinos.dst_viajero.tipo_viajero),
    presupuesto  = coalesce(excluded.presupuesto, destinos.dst_viajero.presupuesto),
    intereses    = case when excluded.intereses = '{}' then destinos.dst_viajero.intereses else excluded.intereses end,
    actualizado_en = now()
  returning id into v_viajero_id;

  insert into destinos.dst_solicitud (destino_id, viajero_id, tipo, mensaje)
  values (v_destino_id, v_viajero_id, p_tipo::destinos.tipo_solicitud, p_mensaje)
  returning id into v_solicitud_id;

  return v_solicitud_id;
end;
$$;

comment on function destinos.registrar_solicitud is
  'La unica puerta por la que el sitio publico escribe. Crea o actualiza el viajero y le abre una solicitud, en una transaccion. Se hizo asi en vez de dar INSERT directo a la llave publica porque un formulario abierto contra la tabla es una invitacion a llenarla de basura; aqui se valida el destino, se exige forma de contacto y no se puede tocar ninguna otra columna.';

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------

grant usage on schema destinos to anon, authenticated;

grant select on
  destinos.dst_destino, destinos.dst_categoria, destinos.dst_destino_categoria,
  destinos.dst_etiqueta, destinos.dst_negocio, destinos.dst_negocio_etiqueta,
  destinos.dst_negocio_horario, destinos.dst_negocio_foto, destinos.dst_resena,
  destinos.dst_resena_foto, destinos.dst_resena_util, destinos.dst_resena_externa,
  destinos.dst_resena_externa_extracto, destinos.dst_guia, destinos.dst_guia_negocio,
  destinos.dst_tour, destinos.dst_tour_salida, destinos.dst_habitacion,
  destinos.dst_itinerario, destinos.dst_itinerario_parada, destinos.dst_redireccion,
  destinos.v_negocio_publicado
to anon, authenticated;

grant execute on function destinos.registrar_solicitud to anon, authenticated;

grant select, insert, update, delete on all tables in schema destinos to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table destinos.dst_destino                enable row level security;
alter table destinos.dst_categoria              enable row level security;
alter table destinos.dst_destino_categoria      enable row level security;
alter table destinos.dst_etiqueta               enable row level security;
alter table destinos.dst_usuario                enable row level security;
alter table destinos.dst_negocio                enable row level security;
alter table destinos.dst_negocio_etiqueta       enable row level security;
alter table destinos.dst_negocio_horario        enable row level security;
alter table destinos.dst_negocio_foto           enable row level security;
alter table destinos.dst_resena                 enable row level security;
alter table destinos.dst_resena_foto            enable row level security;
alter table destinos.dst_resena_util            enable row level security;
alter table destinos.dst_resena_externa         enable row level security;
alter table destinos.dst_resena_externa_extracto enable row level security;
alter table destinos.dst_guia                   enable row level security;
alter table destinos.dst_guia_negocio           enable row level security;
alter table destinos.dst_redireccion            enable row level security;
alter table destinos.dst_tour                   enable row level security;
alter table destinos.dst_tour_salida            enable row level security;
alter table destinos.dst_habitacion             enable row level security;
alter table destinos.dst_cupon                  enable row level security;
alter table destinos.dst_viajero                enable row level security;
alter table destinos.dst_itinerario             enable row level security;
alter table destinos.dst_itinerario_parada      enable row level security;
alter table destinos.dst_favorito               enable row level security;
alter table destinos.dst_solicitud              enable row level security;
alter table destinos.dst_reserva                enable row level security;
alter table destinos.dst_reserva_linea          enable row level security;
alter table destinos.dst_pago                   enable row level security;
alter table destinos.dst_comision               enable row level security;
alter table destinos.dst_tarea                  enable row level security;
alter table destinos.dst_mensaje                enable row level security;

-- El sitio publico: solo lee lo publicado ----------------------------------

create policy "cualquiera lee destinos activos" on destinos.dst_destino
  for select to anon, authenticated using (esta_activo);

create policy "cualquiera lee el catalogo de categorias" on destinos.dst_categoria
  for select to anon, authenticated using (true);

create policy "cualquiera lee las categorias encendidas" on destinos.dst_destino_categoria
  for select to anon, authenticated using (es_visible);

create policy "cualquiera lee etiquetas" on destinos.dst_etiqueta
  for select to anon, authenticated using (true);

create policy "cualquiera lee redirecciones" on destinos.dst_redireccion
  for select to anon, authenticated using (true);

create policy "cualquiera lee negocios publicados" on destinos.dst_negocio
  for select to anon, authenticated
  using (estado_publicacion = 'publicado' and not esta_cerrado);

create policy "cualquiera lee etiquetas de negocios publicados" on destinos.dst_negocio_etiqueta
  for select to anon, authenticated
  using (exists (select 1 from destinos.dst_negocio n where n.id = negocio_id and n.estado_publicacion = 'publicado'));

create policy "cualquiera lee horarios de negocios publicados" on destinos.dst_negocio_horario
  for select to anon, authenticated
  using (exists (select 1 from destinos.dst_negocio n where n.id = negocio_id and n.estado_publicacion = 'publicado'));

create policy "cualquiera lee fotos de negocios publicados" on destinos.dst_negocio_foto
  for select to anon, authenticated
  using (exists (select 1 from destinos.dst_negocio n where n.id = negocio_id and n.estado_publicacion = 'publicado'));

create policy "cualquiera lee resenas publicadas" on destinos.dst_resena
  for select to anon, authenticated using (estado = 'publicada');

create policy "cualquiera lee fotos de resenas publicadas" on destinos.dst_resena_foto
  for select to anon, authenticated
  using (exists (select 1 from destinos.dst_resena r where r.id = resena_id and r.estado = 'publicada'));

create policy "cualquiera lee los votos util" on destinos.dst_resena_util
  for select to anon, authenticated using (true);

create policy "cualquiera lee agregados externos vigentes" on destinos.dst_resena_externa
  for select to anon, authenticated using (expira_en > now());

create policy "cualquiera lee extractos externos vigentes" on destinos.dst_resena_externa_extracto
  for select to anon, authenticated
  using (exists (select 1 from destinos.dst_resena_externa e where e.id = resena_externa_id and e.expira_en > now()));

create policy "cualquiera lee guias publicadas" on destinos.dst_guia
  for select to anon, authenticated using (estado = 'publicado');

create policy "cualquiera lee los negocios de una guia publicada" on destinos.dst_guia_negocio
  for select to anon, authenticated
  using (exists (select 1 from destinos.dst_guia g where g.id = guia_id and g.estado = 'publicado'));

create policy "cualquiera lee tours publicados" on destinos.dst_tour
  for select to anon, authenticated using (estado = 'publicado');

create policy "cualquiera lee salidas abiertas de tours publicados" on destinos.dst_tour_salida
  for select to anon, authenticated
  using (esta_abierta and exists (select 1 from destinos.dst_tour t where t.id = tour_id and t.estado = 'publicado'));

create policy "cualquiera lee habitaciones activas" on destinos.dst_habitacion
  for select to anon, authenticated
  using (esta_activa and exists (select 1 from destinos.dst_negocio n where n.id = negocio_id and n.estado_publicacion = 'publicado'));

create policy "cualquiera lee itinerarios publicos" on destinos.dst_itinerario
  for select to anon, authenticated using (es_publico);

create policy "cualquiera lee paradas de itinerarios publicos" on destinos.dst_itinerario_parada
  for select to anon, authenticated
  using (exists (select 1 from destinos.dst_itinerario i where i.id = itinerario_id and i.es_publico));

-- El panel: el equipo trabaja los destinos que tiene asignados ---------------
-- Nada de lo que sigue es legible por la llave publica. Un viajero, una
-- reserva o una comision no se exponen nunca al sitio.

create policy "el equipo administra sus destinos" on destinos.dst_destino
  for all to authenticated using (destinos.tiene_acceso_a(id)) with check (destinos.tiene_acceso_a(id));

create policy "el equipo ve el equipo" on destinos.dst_usuario
  for select to authenticated using (destinos.es_del_equipo());

create policy "cada quien edita su propia ficha de usuario" on destinos.dst_usuario
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "el equipo administra negocios de sus destinos" on destinos.dst_negocio
  for all to authenticated using (destinos.tiene_acceso_a(destino_id)) with check (destinos.tiene_acceso_a(destino_id));

create policy "el equipo administra guias de sus destinos" on destinos.dst_guia
  for all to authenticated using (destinos.tiene_acceso_a(destino_id)) with check (destinos.tiene_acceso_a(destino_id));

create policy "el equipo administra tours de sus destinos" on destinos.dst_tour
  for all to authenticated using (destinos.tiene_acceso_a(destino_id)) with check (destinos.tiene_acceso_a(destino_id));

create policy "el equipo administra cupones de sus destinos" on destinos.dst_cupon
  for all to authenticated using (destinos.tiene_acceso_a(destino_id)) with check (destinos.tiene_acceso_a(destino_id));

create policy "el equipo administra viajeros de sus destinos" on destinos.dst_viajero
  for all to authenticated using (destinos.tiene_acceso_a(destino_id)) with check (destinos.tiene_acceso_a(destino_id));

create policy "el equipo administra solicitudes de sus destinos" on destinos.dst_solicitud
  for all to authenticated using (destinos.tiene_acceso_a(destino_id)) with check (destinos.tiene_acceso_a(destino_id));

create policy "el equipo administra reservas de sus destinos" on destinos.dst_reserva
  for all to authenticated using (destinos.tiene_acceso_a(destino_id)) with check (destinos.tiene_acceso_a(destino_id));

create policy "el equipo administra tareas de sus destinos" on destinos.dst_tarea
  for all to authenticated using (destinos.tiene_acceso_a(destino_id)) with check (destinos.tiene_acceso_a(destino_id));

create policy "el equipo administra mensajes de sus destinos" on destinos.dst_mensaje
  for all to authenticated using (destinos.tiene_acceso_a(destino_id)) with check (destinos.tiene_acceso_a(destino_id));

create policy "el equipo administra itinerarios de sus destinos" on destinos.dst_itinerario
  for all to authenticated using (destinos.tiene_acceso_a(destino_id)) with check (destinos.tiene_acceso_a(destino_id));

-- Las hijas heredan el permiso de su padre ---------------------------------

create policy "el equipo administra lineas de sus reservas" on destinos.dst_reserva_linea
  for all to authenticated
  using (exists (select 1 from destinos.dst_reserva r where r.id = reserva_id and destinos.tiene_acceso_a(r.destino_id)))
  with check (exists (select 1 from destinos.dst_reserva r where r.id = reserva_id and destinos.tiene_acceso_a(r.destino_id)));

create policy "el equipo administra pagos de sus reservas" on destinos.dst_pago
  for all to authenticated
  using (exists (select 1 from destinos.dst_reserva r where r.id = reserva_id and destinos.tiene_acceso_a(r.destino_id)))
  with check (exists (select 1 from destinos.dst_reserva r where r.id = reserva_id and destinos.tiene_acceso_a(r.destino_id)));

create policy "el equipo administra comisiones de sus reservas" on destinos.dst_comision
  for all to authenticated
  using (exists (select 1 from destinos.dst_reserva r where r.id = reserva_id and destinos.tiene_acceso_a(r.destino_id)))
  with check (exists (select 1 from destinos.dst_reserva r where r.id = reserva_id and destinos.tiene_acceso_a(r.destino_id)));

create policy "el equipo administra paradas de sus itinerarios" on destinos.dst_itinerario_parada
  for all to authenticated
  using (exists (select 1 from destinos.dst_itinerario i where i.id = itinerario_id and destinos.tiene_acceso_a(i.destino_id)))
  with check (exists (select 1 from destinos.dst_itinerario i where i.id = itinerario_id and destinos.tiene_acceso_a(i.destino_id)));

create policy "el equipo administra favoritos de sus viajeros" on destinos.dst_favorito
  for all to authenticated
  using (exists (select 1 from destinos.dst_viajero v where v.id = viajero_id and destinos.tiene_acceso_a(v.destino_id)))
  with check (exists (select 1 from destinos.dst_viajero v where v.id = viajero_id and destinos.tiene_acceso_a(v.destino_id)));

create policy "el equipo modera resenas de sus destinos" on destinos.dst_resena
  for all to authenticated
  using (exists (select 1 from destinos.dst_negocio n where n.id = negocio_id and destinos.tiene_acceso_a(n.destino_id)))
  with check (exists (select 1 from destinos.dst_negocio n where n.id = negocio_id and destinos.tiene_acceso_a(n.destino_id)));

create policy "el equipo administra el catalogo" on destinos.dst_categoria
  for all to authenticated using (destinos.es_del_equipo()) with check (destinos.es_del_equipo());

create policy "el equipo administra etiquetas" on destinos.dst_etiqueta
  for all to authenticated using (destinos.es_del_equipo()) with check (destinos.es_del_equipo());

create policy "el equipo enciende categorias por destino" on destinos.dst_destino_categoria
  for all to authenticated using (destinos.tiene_acceso_a(destino_id)) with check (destinos.tiene_acceso_a(destino_id));

create policy "el equipo administra fotos de sus negocios" on destinos.dst_negocio_foto
  for all to authenticated
  using (exists (select 1 from destinos.dst_negocio n where n.id = negocio_id and destinos.tiene_acceso_a(n.destino_id)))
  with check (exists (select 1 from destinos.dst_negocio n where n.id = negocio_id and destinos.tiene_acceso_a(n.destino_id)));

create policy "el equipo administra horarios de sus negocios" on destinos.dst_negocio_horario
  for all to authenticated
  using (exists (select 1 from destinos.dst_negocio n where n.id = negocio_id and destinos.tiene_acceso_a(n.destino_id)))
  with check (exists (select 1 from destinos.dst_negocio n where n.id = negocio_id and destinos.tiene_acceso_a(n.destino_id)));

create policy "el equipo administra etiquetas de sus negocios" on destinos.dst_negocio_etiqueta
  for all to authenticated
  using (exists (select 1 from destinos.dst_negocio n where n.id = negocio_id and destinos.tiene_acceso_a(n.destino_id)))
  with check (exists (select 1 from destinos.dst_negocio n where n.id = negocio_id and destinos.tiene_acceso_a(n.destino_id)));

create policy "el equipo administra habitaciones de sus negocios" on destinos.dst_habitacion
  for all to authenticated
  using (exists (select 1 from destinos.dst_negocio n where n.id = negocio_id and destinos.tiene_acceso_a(n.destino_id)))
  with check (exists (select 1 from destinos.dst_negocio n where n.id = negocio_id and destinos.tiene_acceso_a(n.destino_id)));

create policy "el equipo administra salidas de sus tours" on destinos.dst_tour_salida
  for all to authenticated
  using (exists (select 1 from destinos.dst_tour t where t.id = tour_id and destinos.tiene_acceso_a(t.destino_id)))
  with check (exists (select 1 from destinos.dst_tour t where t.id = tour_id and destinos.tiene_acceso_a(t.destino_id)));

create policy "el equipo administra el cache externo" on destinos.dst_resena_externa
  for all to authenticated
  using (exists (select 1 from destinos.dst_negocio n where n.id = negocio_id and destinos.tiene_acceso_a(n.destino_id)))
  with check (exists (select 1 from destinos.dst_negocio n where n.id = negocio_id and destinos.tiene_acceso_a(n.destino_id)));

create policy "el equipo administra los extractos externos" on destinos.dst_resena_externa_extracto
  for all to authenticated
  using (exists (select 1 from destinos.dst_resena_externa e join destinos.dst_negocio n on n.id = e.negocio_id
                  where e.id = resena_externa_id and destinos.tiene_acceso_a(n.destino_id)))
  with check (exists (select 1 from destinos.dst_resena_externa e join destinos.dst_negocio n on n.id = e.negocio_id
                       where e.id = resena_externa_id and destinos.tiene_acceso_a(n.destino_id)));

create policy "el equipo administra fotos de resenas" on destinos.dst_resena_foto
  for all to authenticated
  using (exists (select 1 from destinos.dst_resena r join destinos.dst_negocio n on n.id = r.negocio_id
                  where r.id = resena_id and destinos.tiene_acceso_a(n.destino_id)))
  with check (exists (select 1 from destinos.dst_resena r join destinos.dst_negocio n on n.id = r.negocio_id
                       where r.id = resena_id and destinos.tiene_acceso_a(n.destino_id)));

create policy "el equipo administra los negocios de una guia" on destinos.dst_guia_negocio
  for all to authenticated
  using (exists (select 1 from destinos.dst_guia g where g.id = guia_id and destinos.tiene_acceso_a(g.destino_id)))
  with check (exists (select 1 from destinos.dst_guia g where g.id = guia_id and destinos.tiene_acceso_a(g.destino_id)));

create policy "el equipo administra redirecciones" on destinos.dst_redireccion
  for all to authenticated using (destinos.tiene_acceso_a(destino_id)) with check (destinos.tiene_acceso_a(destino_id));

create policy "el equipo administra votos util" on destinos.dst_resena_util
  for all to authenticated using (destinos.es_del_equipo()) with check (destinos.es_del_equipo());
