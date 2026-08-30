-- visitlafortunacr | Migracion 04: funciones, triggers, vistas y seguridad
-- Todas las funciones fijan search_path vacio y califican cada objeto, para que
-- no puedan ser secuestradas por un esquema colocado antes en la ruta.

-- ---------------------------------------------------------------------------
-- Funciones
-- ---------------------------------------------------------------------------

create or replace function directorio.actualizar_marca_tiempo()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

comment on function directorio.actualizar_marca_tiempo() is
  'Pone actualizado_en al momento actual en cada UPDATE. Se engancha a toda tabla que tenga esa columna.';

create or replace function directorio.recalcular_calificacion_negocio()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_negocio_id uuid := coalesce(new.negocio_id, old.negocio_id);
begin
  update directorio.negocio n
     set total_resenas = sub.total,
         promedio_calificacion = sub.promedio
    from (
      select count(*) as total, round(avg(calificacion), 1) as promedio
        from directorio.resena
       where negocio_id = v_negocio_id and estado = 'publicada'
    ) sub
   where n.id = v_negocio_id;
  return null;
end;
$$;

comment on function directorio.recalcular_calificacion_negocio() is
  'Recalcula total_resenas y promedio_calificacion de un negocio contando SOLO resenas propias publicadas. Las notas de Google y Tripadvisor viven en resena_externa y jamas entran en este promedio.';

create or replace function directorio.recalcular_total_resenas_perfil()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_autor_id uuid := coalesce(new.autor_id, old.autor_id);
begin
  update directorio.perfil p
     set total_resenas = (
           select count(*) from directorio.resena
            where autor_id = v_autor_id and estado = 'publicada'
         )
   where p.id = v_autor_id;
  return null;
end;
$$;

comment on function directorio.recalcular_total_resenas_perfil() is
  'Mantiene el contador de resenas publicadas de cada perfil, que alimenta las insignias de colaborador.';

create or replace function directorio.recalcular_total_util_resena()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_resena_id uuid := coalesce(new.resena_id, old.resena_id);
begin
  update directorio.resena r
     set total_util = (select count(*) from directorio.resena_util where resena_id = v_resena_id)
   where r.id = v_resena_id;
  return null;
end;
$$;

comment on function directorio.recalcular_total_util_resena() is
  'Mantiene el contador de votos "me sirvio" de cada resena.';

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger tg_categoria_antes_actualizar
  before update on directorio.categoria
  for each row execute function directorio.actualizar_marca_tiempo();

create trigger tg_perfil_antes_actualizar
  before update on directorio.perfil
  for each row execute function directorio.actualizar_marca_tiempo();

create trigger tg_negocio_antes_actualizar
  before update on directorio.negocio
  for each row execute function directorio.actualizar_marca_tiempo();

create trigger tg_resena_antes_actualizar
  before update on directorio.resena
  for each row execute function directorio.actualizar_marca_tiempo();

create trigger tg_resena_despues_cambiar_recalcular
  after insert or update or delete on directorio.resena
  for each row execute function directorio.recalcular_calificacion_negocio();

create trigger tg_resena_despues_cambiar_contar_perfil
  after insert or update or delete on directorio.resena
  for each row execute function directorio.recalcular_total_resenas_perfil();

create trigger tg_resena_util_despues_cambiar_contar
  after insert or delete on directorio.resena_util
  for each row execute function directorio.recalcular_total_util_resena();

-- ---------------------------------------------------------------------------
-- Vistas
-- ---------------------------------------------------------------------------

create view directorio.v_negocio_publicado
with (security_invoker = true) as
select n.id, n.categoria_id,
       c.babosa_es as categoria_babosa_es, c.babosa_en as categoria_babosa_en,
       c.nombre_es as categoria_nombre_es, c.nombre_en as categoria_nombre_en,
       n.nombre, n.babosa_es, n.babosa_en, n.logo_url, n.email, n.telefono,
       n.telefono_whatsapp, n.sitio_web, n.descripcion_es, n.descripcion_en,
       n.resumen_es, n.resumen_en, n.direccion, n.latitud, n.longitud,
       n.rango_precio, n.precio_desde_usd, n.estado_verificacion, n.es_destacado,
       n.atributos, n.total_resenas, n.promedio_calificacion, n.publicado_en
  from directorio.negocio n
  join directorio.categoria c on c.id = n.categoria_id
 where n.estado_publicacion = 'publicado'
   and not n.es_permanentemente_cerrado;

comment on view directorio.v_negocio_publicado is
  'Lo que el sitio publico puede ver: fichas publicadas y abiertas, ya unidas a su categoria. Con security_invoker, de modo que las politicas RLS de quien consulta siguen aplicando y la vista no se convierte en una puerta trasera.';

-- ---------------------------------------------------------------------------
-- Permisos de esquema
-- ---------------------------------------------------------------------------

grant usage on schema directorio to anon, authenticated;

grant select on
  directorio.categoria, directorio.etiqueta, directorio.perfil,
  directorio.negocio, directorio.negocio_etiqueta, directorio.negocio_horario,
  directorio.negocio_foto, directorio.resena, directorio.resena_foto,
  directorio.resena_util, directorio.resena_externa,
  directorio.resena_externa_extracto, directorio.redireccion,
  directorio.v_negocio_publicado
to anon, authenticated;

grant insert, update on directorio.perfil          to authenticated;
grant insert, update on directorio.resena          to authenticated;
grant insert, delete on directorio.resena_foto     to authenticated;
grant insert, delete on directorio.resena_util     to authenticated;
grant insert         on directorio.reclamo_negocio to authenticated;
grant select         on directorio.reclamo_negocio to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table directorio.categoria               enable row level security;
alter table directorio.etiqueta                enable row level security;
alter table directorio.perfil                  enable row level security;
alter table directorio.negocio                 enable row level security;
alter table directorio.negocio_etiqueta        enable row level security;
alter table directorio.negocio_horario         enable row level security;
alter table directorio.negocio_foto            enable row level security;
alter table directorio.resena                  enable row level security;
alter table directorio.resena_foto             enable row level security;
alter table directorio.resena_util             enable row level security;
alter table directorio.resena_externa          enable row level security;
alter table directorio.resena_externa_extracto enable row level security;
alter table directorio.reclamo_negocio         enable row level security;
alter table directorio.redireccion             enable row level security;

-- Catalogos publicos -------------------------------------------------------

create policy "cualquiera lee categorias visibles"
  on directorio.categoria for select to anon, authenticated using (es_visible);

create policy "cualquiera lee etiquetas"
  on directorio.etiqueta for select to anon, authenticated using (true);

create policy "cualquiera lee redirecciones"
  on directorio.redireccion for select to anon, authenticated using (true);

-- Negocios -----------------------------------------------------------------

create policy "cualquiera lee negocios publicados"
  on directorio.negocio for select to anon, authenticated
  using (estado_publicacion = 'publicado');

create policy "cualquiera lee etiquetas de negocios publicados"
  on directorio.negocio_etiqueta for select to anon, authenticated
  using (exists (select 1 from directorio.negocio n
                  where n.id = negocio_id and n.estado_publicacion = 'publicado'));

create policy "cualquiera lee horarios de negocios publicados"
  on directorio.negocio_horario for select to anon, authenticated
  using (exists (select 1 from directorio.negocio n
                  where n.id = negocio_id and n.estado_publicacion = 'publicado'));

create policy "cualquiera lee fotos de negocios publicados"
  on directorio.negocio_foto for select to anon, authenticated
  using (exists (select 1 from directorio.negocio n
                  where n.id = negocio_id and n.estado_publicacion = 'publicado'));

-- Perfiles -----------------------------------------------------------------

create policy "cualquiera lee perfiles"
  on directorio.perfil for select to anon, authenticated using (true);

create policy "cada quien crea su propio perfil"
  on directorio.perfil for insert to authenticated
  with check (id = (select auth.uid()));

create policy "cada quien edita su propio perfil"
  on directorio.perfil for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Resenas propias ----------------------------------------------------------

create policy "cualquiera lee resenas publicadas"
  on directorio.resena for select to anon, authenticated
  using (estado = 'publicada');

create policy "cada quien lee sus propias resenas en cualquier estado"
  on directorio.resena for select to authenticated
  using (autor_id = (select auth.uid()));

create policy "cada quien escribe sus propias resenas"
  on directorio.resena for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and estado = 'pendiente'
    and exists (select 1 from directorio.negocio n
                 where n.id = negocio_id and n.estado_publicacion = 'publicado')
  );

create policy "cada quien edita su resena y vuelve a moderacion"
  on directorio.resena for update to authenticated
  using (autor_id = (select auth.uid()))
  with check (autor_id = (select auth.uid()) and estado = 'pendiente');

create policy "cualquiera lee fotos de resenas publicadas"
  on directorio.resena_foto for select to anon, authenticated
  using (exists (select 1 from directorio.resena r
                  where r.id = resena_id and r.estado = 'publicada'));

create policy "cada quien adjunta fotos a su resena"
  on directorio.resena_foto for insert to authenticated
  with check (exists (select 1 from directorio.resena r
                       where r.id = resena_id and r.autor_id = (select auth.uid())));

create policy "cada quien borra fotos de su resena"
  on directorio.resena_foto for delete to authenticated
  using (exists (select 1 from directorio.resena r
                  where r.id = resena_id and r.autor_id = (select auth.uid())));

create policy "cualquiera lee los votos util"
  on directorio.resena_util for select to anon, authenticated using (true);

create policy "cada quien vota con su propio perfil"
  on directorio.resena_util for insert to authenticated
  with check (perfil_id = (select auth.uid()));

create policy "cada quien retira su propio voto"
  on directorio.resena_util for delete to authenticated
  using (perfil_id = (select auth.uid()));

-- Resenas externas ---------------------------------------------------------

create policy "cualquiera lee agregados externos vigentes"
  on directorio.resena_externa for select to anon, authenticated
  using (expira_en > now());

create policy "cualquiera lee extractos externos vigentes"
  on directorio.resena_externa_extracto for select to anon, authenticated
  using (exists (select 1 from directorio.resena_externa e
                  where e.id = resena_externa_id and e.expira_en > now()));

-- Reclamos -----------------------------------------------------------------

create policy "cada quien lee sus propios reclamos"
  on directorio.reclamo_negocio for select to authenticated
  using (solicitante_id = (select auth.uid()));

create policy "cada quien abre reclamos a su nombre"
  on directorio.reclamo_negocio for insert to authenticated
  with check (solicitante_id = (select auth.uid()) and estado = 'pendiente');
