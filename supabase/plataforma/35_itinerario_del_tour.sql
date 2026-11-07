/*
 * 35 — El itinerario de una tour, parada por parada.
 *
 * 7 de noviembre de 2026. Tony, señalando una ficha de GetYourGuide:
 * «Si tabla o campo nuevo en la tabla de tour pero hazlo bien como ellos».
 *
 * EL HUECO: una tour no tenía dónde decir QUÉ SE HACE. `dst_tour_salida` son
 * fechas y cupos —otra cosa— y la descripción es un bloque de texto donde el
 * plan del día se pierde.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LAS CUATRO DECISIONES
 *
 * 1. TABLA NUEVA, no campos en `dst_tour`. Un itinerario es una lista
 *    ordenada de largo variable. Metido en columnas serían `parada_1`…
 *    `parada_8`, y el día que alguien tenga nueve se agrega una columna.
 *
 * 2. ⚠️ `negocio_id`: UNA PARADA PUEDE SER UNA FICHA DEL DIRECTORIO.
 *    Esto es lo que GetYourGuide NO puede hacer. Sus paradas son texto; acá
 *    las aguas termales de la parada 3 son un negocio publicado, con su foto,
 *    su nota y sus reseñas, y la parada enlaza a su ficha. El itinerario de
 *    una tour pasa a ser una puerta al resto del sitio.
 *    `on delete set null`: si la ficha se borra, la parada SE QUEDA con su
 *    título en texto. Borrar el itinerario de un tour porque se despublicó un
 *    negocio sería romper una cosa por arreglar otra.
 *
 * 3. `entrada_incluida` tiene TRES estados: true, false y NULL («no se dijo»).
 *    Una casilla junta los dos últimos, y entonces la ficha diría «Entrada
 *    aparte» en tours donde nadie dijo eso. El `false` SE MUESTRA: es dinero
 *    que alguien no contó, y enterarse en la entrada del parque es peor que
 *    leerlo antes de pagar.
 *
 * 4. ⚠️ LA PARADA NACE TRADUCIBLE. Se agregó `tour_parada` al CHECK de
 *    `dst_traduccion` en esta misma migración, y `paradas_de_tour` traduce con
 *    `texto_en` desde el primer día.
 *    La lección es del mismo día: `dst_traduccion` aceptaba `entidad='tour'`
 *    desde que se creó la tabla, y aun así los tours pasaron meses sin una
 *    sola traducción porque nadie las pedía. Construir el hueco y taparlo
 *    después cuesta tocar seis lugares; hacerlo bien de entrada, una línea.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * FUNCIONES (su texto se lee con `pg_get_functiondef`):
 *
 *   paradas_de_tour(tour, idioma)   — pública. Traduce con `texto_en`, solo de
 *     tours publicados, y el enlace a la ficha SOLO si el negocio sigue
 *     publicado: un 404 en medio de un itinerario se lee como sitio roto.
 *   mis_paradas_de_tour(tour)       — el operador, SIN traducir: edita el
 *     original, y mostrarle la traducción sería dejarlo corregir un texto que
 *     no es el que se guarda.
 *   guardar_mi_parada(...)          — crea o corrige. Comprueba `es_mi_negocio`
 *     Y que el negocio enlazado sea de ESTE destino y esté publicado.
 *   borrar_mi_parada(parada)        — borra TAMBIÉN sus traducciones: no
 *     cuelgan con clave foránea (van por entidad + entidad_id), así que
 *     Postgres no las arrastra. Mismo caso que `dst_ruta` al borrar un negocio.
 *   mover_mi_parada(parada, hacia)  — intercambia el orden con la vecina.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * PROBADO A PROPÓSITO el 7 de noviembre de 2026, nueve comprobaciones en
 * transacción revertida, todas en verde — incluidos LOS TRES GUARDIAS DE
 * DUEÑO (mover, borrar y agregar una parada ajena: los tres rechazados), un
 * `tipo` inventado y un título en blanco. Y de punta a punta con el servidor
 * local: la salida y el regreso sin número, las paradas numeradas 1 y 2, «1 h
 * 30 min» a partir de 90 minutos, «Entrada incluida» en verde y «Entrada
 * aparte» en ámbar, y el enlace a /es/aguas-termales/paradise-hot-springs con
 * su foto. Las paradas de prueba se borraron.
 */

create table if not exists destinos.dst_tour_parada (
  id          uuid primary key default gen_random_uuid(),
  tour_id     uuid not null references destinos.dst_tour(id) on delete cascade,
  orden       smallint not null default 0,
  tipo        text not null default 'parada',
  titulo      text not null,
  descripcion text,
  duracion_minutos smallint,
  negocio_id  uuid references destinos.dst_negocio(id) on delete set null,
  entrada_incluida boolean,
  creado_en   timestamptz not null default now(),
  constraint ck_dst_tour_parada_tipo
    check (tipo in ('salida', 'parada', 'paso', 'regreso')),
  constraint ck_dst_tour_parada_titulo
    check (char_length(btrim(titulo)) > 0)
);

create index if not exists ix_dst_tour_parada_tour on destinos.dst_tour_parada (tour_id, orden);
create index if not exists ix_dst_tour_parada_negocio on destinos.dst_tour_parada (negocio_id)
  where negocio_id is not null;

alter table destinos.dst_tour_parada enable row level security;

-- Las TRES políticas, calcadas de dst_tour_foto: el público lee lo publicado,
-- el dueño administra lo suyo, el equipo administra lo de su destino.
drop policy if exists "cualquiera lee paradas de tours publicados" on destinos.dst_tour_parada;
create policy "cualquiera lee paradas de tours publicados"
  on destinos.dst_tour_parada for select
  using (exists (select 1 from destinos.dst_tour t
                  where t.id = tour_id and t.estado = 'publicado'));

drop policy if exists "el duenno administra paradas de sus tours" on destinos.dst_tour_parada;
create policy "el duenno administra paradas de sus tours"
  on destinos.dst_tour_parada for all
  using (exists (select 1 from destinos.dst_tour t
                  where t.id = tour_id and destinos.es_mi_negocio(t.negocio_id)))
  with check (exists (select 1 from destinos.dst_tour t
                  where t.id = tour_id and destinos.es_mi_negocio(t.negocio_id)));

drop policy if exists "el equipo administra paradas de sus tours" on destinos.dst_tour_parada;
create policy "el equipo administra paradas de sus tours"
  on destinos.dst_tour_parada for all
  using (exists (select 1 from destinos.dst_tour t
                  where t.id = tour_id and destinos.tiene_acceso_a(t.destino_id)))
  with check (exists (select 1 from destinos.dst_tour t
                  where t.id = tour_id and destinos.tiene_acceso_a(t.destino_id)));

-- La parada nace traducible. Ver la decisión 4 de arriba.
alter table destinos.dst_traduccion drop constraint if exists ck_dst_traduccion_entidad;
alter table destinos.dst_traduccion add constraint ck_dst_traduccion_entidad
  check (entidad in ('destino','categoria','etiqueta','negocio','negocio_seccion',
                     'tour','tour_parada','guia','itinerario','sorteo','cadena_paso',
                     'producto','razon','combina'));

notify pgrst, 'reload schema';
