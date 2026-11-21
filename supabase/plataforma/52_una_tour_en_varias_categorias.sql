-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Una tour puede estar en VARIAS categorías.                          ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Tony, 21 de noviembre de 2026: «el tour debe poder ponerse en múltiples
-- categorías, actualmente solo puede una y no debería ser así».
--
-- ⚠️ `dst_tour.categoria_id` NO SE VA: pasa a ser LA PRINCIPAL.
--
-- Podría haberse borrado y dejar todo en la tabla puente. No se hizo, y por
-- razones concretas:
--
--   1. Algo tiene que ser la migaja y la etiqueta de la tarjeta. Con cinco
--      categorías, ¿cuál sale en el cintillo? La principal. Sin una, habría
--      que inventar un criterio (¿la primera por orden? ¿la más llena?) que
--      cambiaría solo cuando alguien publique otra cosa.
--   2. Seis lugares del código leen `categoria_id` hoy. Quitarlo es cambiar
--      los seis a la vez y rezar; dejarlo es que todos sigan andando.
--
-- ⚠️ LA TABLA PUENTE GUARDA TODAS, LA PRINCIPAL INCLUIDA. No solo las
-- "extras". Si guardara solo las extras, cada consulta de "en qué categorías
-- está esta tour" sería una unión con `categoria_id` — y el día que alguien
-- escriba una de las dos consultas sin la unión, la tour desaparece de su
-- categoría principal sin que nada falle.
--
-- El disparador de abajo es lo que sostiene esa invariante **venga de donde
-- venga el cambio**: el panel, un script, o la consola de Supabase.

create table if not exists destinos.dst_tour_categoria (
  tour_id      uuid        not null references destinos.dst_tour(id)      on delete cascade,
  categoria_id uuid        not null references destinos.dst_categoria(id) on delete cascade,
  creado_en    timestamptz not null default now(),
  primary key (tour_id, categoria_id)
);

-- La consulta que más va a correr es al revés: «qué tours hay en esta
-- categoría», desde el listado público y desde el conteo del menú.
create index if not exists idx_dst_tour_categoria_categoria
  on destinos.dst_tour_categoria (categoria_id);

-- ── El relleno: lo que ya existía entra tal cual ──────────────────────────
-- Sin esto la tabla nace vacía y, el día que el listado lea de acá, TODAS
-- las tours desaparecen del directorio a la vez.
insert into destinos.dst_tour_categoria (tour_id, categoria_id)
select t.id, t.categoria_id
  from destinos.dst_tour t
 where t.categoria_id is not null
on conflict do nothing;

-- ── El disparador que sostiene la invariante ──────────────────────────────
-- La principal SIEMPRE está en la tabla puente. No depende de que quien
-- escriba se acuerde: `crearTour` y `editarTour` no saben de esta tabla y no
-- hace falta que sepan.
--
-- Cambiar la principal NO saca a la vieja de la lista: queda como una más.
-- Es a propósito — sacarla sería que una categoría se pierda sola al tocar
-- un desplegable, que es justo lo que nadie espera.
create or replace function destinos.principal_entra_en_tour_categoria()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.categoria_id is not null then
    insert into destinos.dst_tour_categoria (tour_id, categoria_id)
    values (new.id, new.categoria_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_principal_entra_en_tour_categoria on destinos.dst_tour;
create trigger tr_principal_entra_en_tour_categoria
  after insert or update of categoria_id on destinos.dst_tour
  for each row execute function destinos.principal_entra_en_tour_categoria();

-- ── Permisos ──────────────────────────────────────────────────────────────
-- ⚠️ RLS CON POLÍTICAS PERO SIN GRANT NO SIRVE DE NADA: la política decide
-- QUÉ filas, el grant decide SI se puede tocar la tabla. Ya pasó en este
-- proyecto con siete tablas, y el panel no decía nada.
alter table destinos.dst_tour_categoria enable row level security;

drop policy if exists "cualquiera lee categorias de tours publicados" on destinos.dst_tour_categoria;
create policy "cualquiera lee categorias de tours publicados"
  on destinos.dst_tour_categoria for select to public
  using (exists (
    select 1 from destinos.dst_tour t
     where t.id = dst_tour_categoria.tour_id
       and t.estado = 'publicado'::destinos.estado_publicacion));

drop policy if exists "el duenno administra las categorias de sus tours" on destinos.dst_tour_categoria;
create policy "el duenno administra las categorias de sus tours"
  on destinos.dst_tour_categoria for all to authenticated
  using (exists (
    select 1 from destinos.dst_tour t
     where t.id = dst_tour_categoria.tour_id and destinos.es_mi_negocio(t.negocio_id)))
  with check (exists (
    select 1 from destinos.dst_tour t
     where t.id = dst_tour_categoria.tour_id and destinos.es_mi_negocio(t.negocio_id)));

drop policy if exists "el equipo administra las categorias de sus tours" on destinos.dst_tour_categoria;
create policy "el equipo administra las categorias de sus tours"
  on destinos.dst_tour_categoria for all to authenticated
  using (exists (
    select 1 from destinos.dst_tour t
     where t.id = dst_tour_categoria.tour_id and destinos.tiene_acceso_a(t.destino_id)))
  with check (exists (
    select 1 from destinos.dst_tour t
     where t.id = dst_tour_categoria.tour_id and destinos.tiene_acceso_a(t.destino_id)));

grant select on destinos.dst_tour_categoria to anon, authenticated;
grant insert, update, delete on destinos.dst_tour_categoria to authenticated;

-- ── El conteo del menú cuenta por la tabla puente ─────────────────────────
-- Antes contaba `dst_tour.categoria_id`, o sea solo la principal: una tour
-- agregada a «Puentes colgantes» como segunda categoría saldría en el
-- listado y NO en el número del menú. Y una categoría cuyos únicos tours la
-- tuvieran de secundaria contaría CERO y desaparecería del menú entero —
-- exactamente el agujero que ya se tapó una vez cuando los tours no
-- contaban para nada.
--
-- Los negocios siguen por `categoria_id`: un negocio sigue teniendo una
-- sola. Esto es solo para tours.
create or replace function destinos.categorias_del_destino(p_destino_id uuid, p_idioma character default null::bpchar)
 returns table(categoria_id uuid, babosa text, nombre text, seccion text, orden smallint, total bigint)
 language sql
 stable security definer
 set search_path to ''
as $function$
  with idi as (
    select coalesce(p_idioma, (select idioma_principal from destinos.dst_destino where id = p_destino_id)) as codigo
  )
  select c.id,
         coalesce(
           (select r.babosa from destinos.dst_ruta r
             where r.destino_id = p_destino_id and r.entidad = 'categoria'
               and r.entidad_id = c.id and r.idioma = (select codigo from idi) and r.es_vigente
             limit 1),
           c.babosa),
         coalesce(
           dc.nombre_local,
           destinos.texto_en('categoria', c.id, 'nombre', (select codigo from idi), c.nombre)
         ),
         c.seccion,
         dc.orden,
         (
           select count(*) from destinos.dst_negocio n
            where n.categoria_id = c.id
              and n.destino_id = p_destino_id
              and n.estado_publicacion = 'publicado'
              and not n.es_operador
              and not n.esta_cerrado
         )
         +
         (
           select count(*)
             from destinos.dst_tour_categoria tc
             join destinos.dst_tour t on t.id = tc.tour_id
            where tc.categoria_id = c.id
              and t.destino_id = p_destino_id
              and t.estado = 'publicado'
         )
    from destinos.dst_destino_categoria dc
    join destinos.dst_categoria c on c.id = dc.categoria_id
   where dc.destino_id = p_destino_id
     and dc.es_visible
   group by c.id, c.babosa, c.nombre, c.seccion, dc.orden, dc.nombre_local
   order by c.seccion, dc.orden;
$function$;
