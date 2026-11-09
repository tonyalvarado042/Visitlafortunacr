/*
 * 38 — Una fila por opción comprable, y el IVA que se suma al final.
 *
 * 9 de noviembre de 2026. Tony, mirando el catálogo de Outback:
 * *«¿cómo resolvés el acompañante si es doble y todo eso? Por ejemplo ATV, que
 * tiene muchas variantes de precios.»* Y después: *«debe ser configurable
 * desde la pantalla»* y *«prefiero así, se ve más barato, y el IVA al final»*.
 *
 * EL HUECO: `dst_tour` guarda UN `precio_adulto_usd` y UN `precio_nino_usd`.
 * El catálogo de Outback no cabe ahí, así que las variantes estaban metidas a
 * mano en `precio_nota`, como texto corrido, en los cuatro tours. La ficha
 * mostraba $119 en grande y seis líneas de letra chica debajo.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LA IDEA, EN UNA FRASE: EL ACOMPAÑANTE NO ES OTRO PASAJERO, ES OTRA OPCIÓN.
 *
 * El jet ski doble no cuesta $119 × 2 = $238. Cuesta $139. El segundo
 * pasajero suma $20. Y ocupa UN jet ski, no dos: contado por persona, las
 * salidas se agotarían al doble de velocidad.
 *
 * Por eso la unidad es la OPCIÓN y no la persona, y por eso `cobro` tiene
 * tres valores y no dos: el catálogo cobra por persona (individual), por
 * vehículo (doble, triple, Side by Side) y por la reserva entera (privados).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LAS CINCO DECISIONES
 *
 * 1. TABLA NUEVA, no columnas en `dst_tour`. Son seis opciones en el jet ski
 *    y tres en cada cuadraciclo; en columnas serían `precio_1`…`precio_6` y
 *    el día que alguien tenga siete se agrega una columna.
 *
 * 2. ⚠️ LAS OPCIONES NO REEMPLAZAN `precio_adulto_usd`. Un tour SIN opciones
 *    se sigue viendo exactamente como hoy. Soltar esto no mueve una sola
 *    ficha: las dos de Jacamar no tienen opciones y no cambian.
 *    Es el mismo criterio de la 37 (los textos configurables): lo que no se
 *    configura se queda como estaba.
 *
 * 3. NO HAY CAMPO «esta es la del desde». La de entrada es LA MÁS BARATA
 *    activa, calculada. Un campo marcable se queda con dos marcadas o con
 *    ninguna el día que alguien borre una fila, y entonces la ficha dice
 *    «desde» de algo que no es lo más barato — que es exactamente la clase de
 *    mentira que no se ve hasta que un cliente reclama.
 *
 * 4. LA COMISIÓN TAMPOCO SE GUARDA: sale de rack − neto. Guardarla es tener
 *    dos verdades que se pueden contradecir, y ya pasó con `dst_tour`: la
 *    pantalla del tour tiene un aviso entero dedicado a cuando no cuadran.
 *
 * 5. ⚠️ NACE TRADUCIBLE. `tour_opcion` entra al CHECK de `dst_traduccion` en
 *    esta misma migración y `opciones_de_tour` traduce con `texto_en` desde el
 *    primer día. Es la lección de la 35 y la 36 aplicada por tercera vez:
 *    `dst_traduccion` aceptaba `entidad='tour'` desde que se creó la tabla y
 *    aun así los tours pasaron meses sin una traducción, porque nadie las
 *    pedía. Taparlo después cuesta tocar seis lugares.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * EL IVA
 *
 * `dst_destino.iva_pct` — el impuesto va en el DESTINO y no en el tour: es del
 * país (13% en Costa Rica), no del operador. Un destino en otro país trae otro.
 *
 * `dst_tour.precio_incluye_iva` — esto SÍ es del tour, porque depende de cómo
 * lo entregó el operador. Nace en `true` («el precio ya lo trae») a propósito:
 * con ese valor la ficha se ve igual que antes y soltar la migración no sube
 * ni baja un solo precio publicado. Los cuatro de Outback se marcan en `false`
 * aparte, porque su convenio lo dice con todas las letras: *«TODAS LAS TARIFAS
 * SON +13% DE IVA. Los precios cargados en los tours son SIN impuesto»*.
 *
 * Jacamar y Paradise quedan en `true`: lo confirmó Tony el 9 de noviembre.
 */

/* ---- El IVA --------------------------------------------------------------- */

alter table destinos.dst_destino
  add column if not exists iva_pct numeric(5,2) not null default 13.00;

alter table destinos.dst_destino drop constraint if exists ck_dst_destino_iva;
alter table destinos.dst_destino add constraint ck_dst_destino_iva
  check (iva_pct >= 0 and iva_pct <= 100);

comment on column destinos.dst_destino.iva_pct is
  'El impuesto al valor agregado del pais del destino, en por ciento. 13 en Costa Rica. Va en el destino y no en el tour porque es del pais, no del operador. Se usa para desglosar el total cuando un tour tiene precio_incluye_iva en false.';

alter table destinos.dst_tour
  add column if not exists precio_incluye_iva boolean not null default true;

comment on column destinos.dst_tour.precio_incluye_iva is
  'Si el precio cargado YA trae el impuesto adentro. Nace en true a proposito: con true la ficha se ve como siempre y soltar esto no mueve ningun precio publicado. En false la ficha muestra el precio pelado, el IVA aparte y el total abajo, que es como lo pidio Tony el 9 de noviembre de 2026. Depende de como entrego los precios el operador: el convenio de Outback dice que sus tarifas son sin impuesto; los de Jacamar y Paradise ya lo traen.';

/* ---- Las opciones --------------------------------------------------------- */

create table if not exists destinos.dst_tour_opcion (
  id          uuid primary key default gen_random_uuid(),
  tour_id     uuid not null references destinos.dst_tour(id) on delete cascade,
  orden       smallint not null default 0,
  nombre      text not null,
  que_cubre   text,
  cobro       text not null default 'por_persona',
  personas    smallint,
  precio_rack_usd numeric(10,2) not null,
  precio_neto_usd numeric(10,2),
  esta_activa boolean not null default true,
  creado_en   timestamptz not null default now(),
  constraint ck_dst_tour_opcion_cobro
    check (cobro in ('por_persona', 'por_vehiculo', 'por_reserva')),
  constraint ck_dst_tour_opcion_nombre
    check (char_length(btrim(nombre)) > 0),
  constraint ck_dst_tour_opcion_rack
    check (precio_rack_usd >= 0),
  /* Mismo guardia que `ck_dst_tour_neto`: una neta por encima de la rack es
     una comision negativa, y eso no se ve hasta la liquidacion. */
  constraint ck_dst_tour_opcion_neto
    check (precio_neto_usd is null or precio_neto_usd <= precio_rack_usd),
  constraint ck_dst_tour_opcion_personas
    check (personas is null or personas >= 1)
);

comment on table destinos.dst_tour_opcion is
  'Una fila por opcion comprable de un tour: «individual con transporte», «doble sin transporte», «privado». NO reemplaza dst_tour.precio_adulto_usd: un tour sin opciones se ve igual que siempre. La opcion de entrada —la del «desde»— es la mas barata activa, calculada, no un campo marcable.';

comment on column destinos.dst_tour_opcion.cobro is
  'por_persona: el precio es por cada quien. por_vehiculo: el precio cubre la maquina entera con la gente que quepa (el jet ski doble, el Side by Side). por_reserva: se cobra por la reserva completa (los tours privados). Son tres y no dos porque el catalogo de Outback cobra de las tres maneras.';

comment on column destinos.dst_tour_opcion.personas is
  'Cuantas personas cubre esta opcion. En por_persona es 1. En por_vehiculo es cuantas caben (2 el jet ski doble, 6 el Side by Side). Null cuando no hay tope. Sirve para que la ficha diga «un jet ski para 2 personas» y para descontar el cupo por VEHICULO y no por persona.';

create index if not exists ix_dst_tour_opcion_tour
  on destinos.dst_tour_opcion (tour_id, orden);

alter table destinos.dst_tour_opcion enable row level security;

/* Las politicas, calcadas de `dst_tour_parada` pero con una diferencia: el
   dueño LEE las suyas y no las administra. Lo decidio Tony el 9 de noviembre:
   «solo el equipo». Es lo coherente con el precio, que ya esta congelado para
   el operador cuando el tour se vende. */
drop policy if exists "cualquiera lee opciones de tours publicados" on destinos.dst_tour_opcion;
create policy "cualquiera lee opciones de tours publicados"
  on destinos.dst_tour_opcion for select
  using (exists (select 1 from destinos.dst_tour t
                  where t.id = tour_id and t.estado = 'publicado'));

drop policy if exists "el duenno lee las opciones de sus tours" on destinos.dst_tour_opcion;
create policy "el duenno lee las opciones de sus tours"
  on destinos.dst_tour_opcion for select
  using (exists (select 1 from destinos.dst_tour t
                  where t.id = tour_id and destinos.es_mi_negocio(t.negocio_id)));

drop policy if exists "el equipo administra opciones de sus tours" on destinos.dst_tour_opcion;
create policy "el equipo administra opciones de sus tours"
  on destinos.dst_tour_opcion for all
  using (exists (select 1 from destinos.dst_tour t
                  where t.id = tour_id and destinos.tiene_acceso_a(t.destino_id)))
  with check (exists (select 1 from destinos.dst_tour t
                  where t.id = tour_id and destinos.tiene_acceso_a(t.destino_id)));

/* La opcion nace traducible. Ver la decision 5 de arriba. */
alter table destinos.dst_traduccion drop constraint if exists ck_dst_traduccion_entidad;
alter table destinos.dst_traduccion add constraint ck_dst_traduccion_entidad
  check (entidad in ('destino','categoria','etiqueta','negocio','negocio_seccion',
                     'tour','tour_parada','tour_opcion','guia','itinerario','sorteo',
                     'cadena_paso','producto','razon','combina'));

notify pgrst, 'reload schema';
