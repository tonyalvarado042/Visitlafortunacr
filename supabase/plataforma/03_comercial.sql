-- Plataforma de destinos | 03: producto vendible, viajero y CRM propio
-- Este bloque es el negocio. El caso que tiene que soportar entero:
--   Maria -> llega el 15 de diciembre -> familia de 4 -> quiere termales y
--   rafting -> presupuesto 1.500 -> propuesta enviada -> seguimiento pendiente
--   -> reservo 860.

-- ===========================================================================
-- PRODUCTO VENDIBLE
-- ===========================================================================

create table destinos.dst_tour (
  id                 uuid primary key default gen_random_uuid(),
  destino_id         uuid not null references destinos.dst_destino (id) on delete cascade,
  negocio_id         uuid references destinos.dst_negocio (id) on delete set null,
  categoria_id       uuid references destinos.dst_categoria (id) on delete set null,

  babosa_es          text not null,
  babosa_en          text not null,
  nombre_es          text not null,
  nombre_en          text,
  resumen_es         text,
  resumen_en         text,
  descripcion_es     text,
  descripcion_en     text,
  incluye_es         text,
  incluye_en         text,
  no_incluye_es      text,
  no_incluye_en      text,
  que_llevar_es      text,
  que_llevar_en      text,

  duracion_horas     numeric(4,1),
  hora_inicio        time,
  dificultad         text,
  edad_minima        smallint,
  cupo_maximo        smallint,
  recoge_en_hotel    boolean not null default false,
  idiomas_guia       text[] not null default array['es','en'],

  precio_adulto_usd  numeric(10,2) not null,
  precio_nino_usd    numeric(10,2),
  precio_neto_usd    numeric(10,2),
  comision_pct       numeric(5,2),
  cancelacion_libre_horas smallint not null default 24,

  imagen_url         text,
  estado             destinos.estado_publicacion not null default 'borrador',
  es_destacado       boolean not null default false,
  total_reservas     integer not null default 0,

  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now(),
  publicado_en       timestamptz,

  constraint uq_dst_tour_babosa_es unique (destino_id, babosa_es),
  constraint uq_dst_tour_babosa_en unique (destino_id, babosa_en),
  constraint ck_dst_tour_precio    check (precio_adulto_usd >= 0),
  constraint ck_dst_tour_neto      check (precio_neto_usd is null or precio_neto_usd <= precio_adulto_usd),
  constraint ck_dst_tour_comision  check (comision_pct is null or comision_pct between 0 and 100),
  constraint ck_dst_tour_dificultad check (dificultad is null or dificultad in ('facil','moderada','exigente')),
  constraint ck_dst_tour_publicado check (estado <> 'publicado' or descripcion_es is not null)
);

comment on table destinos.dst_tour is
  'Lo que se vende. Distinto de dst_negocio: el negocio es quien lo opera, el tour es el producto con precio, cupo y comision. Un mismo operador vende varios tours, y un tour puede no tener operador asignado todavia.';
comment on column destinos.dst_tour.precio_neto_usd is
  'Lo que cobra el operador. La diferencia con precio_adulto_usd es el margen de la plataforma. Si esta puesto, manda sobre comision_pct.';
comment on column destinos.dst_tour.comision_pct is
  'Comision en porcentaje. Si es null se hereda la del negocio, y si esa falta, la del destino.';
comment on column destinos.dst_tour.cancelacion_libre_horas is
  'Horas antes de la salida en que aun se cancela sin costo. Se muestra en la ficha porque es de lo primero que pregunta el viajero.';

create index idx_dst_tour_destino    on destinos.dst_tour (destino_id);
create index idx_dst_tour_negocio    on destinos.dst_tour (negocio_id);
create index idx_dst_tour_publicados on destinos.dst_tour (destino_id, estado) where estado = 'publicado';

create table destinos.dst_tour_salida (
  id             uuid primary key default gen_random_uuid(),
  tour_id        uuid not null references destinos.dst_tour (id) on delete cascade,

  sale_el        date not null,
  hora           time,
  cupo_total     smallint not null,
  cupo_tomado    smallint not null default 0,
  precio_usd     numeric(10,2),
  esta_abierta   boolean not null default true,

  creado_en      timestamptz not null default now(),

  constraint uq_dst_salida unique (tour_id, sale_el, hora),
  constraint ck_dst_salida_cupo check (cupo_tomado between 0 and cupo_total)
);

comment on table destinos.dst_tour_salida is
  'Disponibilidad por fecha. En la primera etapa se usa poco: las reservas entran como solicitudes que el equipo confirma con el operador. Cuando haya inventario en tiempo real, esta tabla ya esta y el cupo se descuenta aqui.';
comment on column destinos.dst_tour_salida.precio_usd is
  'Precio de esa fecha si difiere del de lista, para temporada alta.';

create index idx_dst_salida_tour  on destinos.dst_tour_salida (tour_id, sale_el);
create index idx_dst_salida_fecha on destinos.dst_tour_salida (sale_el) where esta_abierta;

create table destinos.dst_habitacion (
  id                uuid primary key default gen_random_uuid(),
  negocio_id        uuid not null references destinos.dst_negocio (id) on delete cascade,

  nombre_es         text not null,
  nombre_en         text,
  descripcion_es    text,
  descripcion_en    text,
  capacidad         smallint not null default 2,
  camas             text,
  metros_cuadrados  smallint,
  precio_noche_usd  numeric(10,2),
  precio_neto_usd   numeric(10,2),
  total_unidades    smallint not null default 1,
  imagen_url        text,
  esta_activa       boolean not null default true,

  creado_en         timestamptz not null default now(),

  constraint ck_dst_habitacion_capacidad check (capacidad > 0),
  constraint ck_dst_habitacion_unidades  check (total_unidades > 0)
);

comment on table destinos.dst_habitacion is
  'Tipos de habitacion de un hotel del directorio. Solo se llena para los hoteles con los que hay acuerdo comercial; el resto vive como ficha simple.';

create index idx_dst_habitacion_negocio on destinos.dst_habitacion (negocio_id);

create table destinos.dst_cupon (
  id              uuid primary key default gen_random_uuid(),
  destino_id      uuid not null references destinos.dst_destino (id) on delete cascade,

  codigo          text not null,
  descripcion     text,
  tipo_descuento  text not null default 'porcentaje',
  valor           numeric(10,2) not null,
  minimo_usd      numeric(10,2),

  vale_desde      date,
  vale_hasta      date,
  usos_maximos    integer,
  usos_hechos     integer not null default 0,
  esta_activo     boolean not null default true,

  creado_en       timestamptz not null default now(),

  constraint uq_dst_cupon_codigo unique (destino_id, codigo),
  constraint ck_dst_cupon_tipo   check (tipo_descuento in ('porcentaje','monto')),
  constraint ck_dst_cupon_valor  check (valor > 0),
  constraint ck_dst_cupon_pct    check (tipo_descuento <> 'porcentaje' or valor <= 100),
  constraint ck_dst_cupon_fechas check (vale_hasta is null or vale_desde is null or vale_hasta >= vale_desde)
);

comment on table destinos.dst_cupon is
  'Cupones y promociones por destino. usos_hechos lo mueve la reserva, nunca a mano.';

-- ===========================================================================
-- EL VIAJERO  -- el CRM propio de la plataforma
-- ===========================================================================

create table destinos.dst_viajero (
  id                uuid primary key default gen_random_uuid(),
  destino_id        uuid not null references destinos.dst_destino (id) on delete restrict,
  cuenta_id         uuid references auth.users (id) on delete set null,

  nombre            text,
  apellidos         text,
  email             text,
  whatsapp          text,
  pais_iso          char(2),
  idioma            char(2) not null default 'es',

  -- Lo que define un viaje ---------------------------------------------------
  llega_el          date,
  sale_el           date,
  personas          smallint,
  ninos             smallint,
  tipo_viajero      destinos.tipo_viajero,
  presupuesto       destinos.presupuesto_viaje,
  presupuesto_usd   numeric(10,2),
  intereses         text[] not null default '{}',
  -- -------------------------------------------------------------------------

  -- De donde vino ------------------------------------------------------------
  origen            text not null default 'web',
  guia_id           uuid references destinos.dst_guia (id) on delete set null,
  utm_fuente        text,
  utm_medio         text,
  utm_campana       text,
  pagina_entrada    text,
  -- -------------------------------------------------------------------------

  acepta_marketing  boolean not null default false,
  baja              boolean not null default false,
  notas             text,

  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),

  constraint ck_dst_viajero_contacto check (email is not null or whatsapp is not null),
  constraint ck_dst_viajero_email    check (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-zA-Z]{2,}$'),
  constraint ck_dst_viajero_whatsapp check (whatsapp is null or whatsapp ~ '^\+[1-9][0-9]{6,14}$'),
  constraint ck_dst_viajero_fechas   check (sale_el is null or llega_el is null or sale_el >= llega_el),
  constraint ck_dst_viajero_personas check (personas is null or personas > 0),
  constraint ck_dst_viajero_ninos    check (ninos is null or personas is null or ninos <= personas)
);

comment on table destinos.dst_viajero is
  'La persona que va a viajar al destino. Es el CRM de la plataforma y NO se mezcla con el CRM de inversionistas: un viajero y un copropietario no comparten llave de identidad, ni embudo, ni ciclo de vida. Una fila por persona y destino: la misma Maria que consulta La Fortuna y Monteverde es dos filas, porque son dos viajes.';

comment on column destinos.dst_viajero.email is
  'Puede faltar si dejo WhatsApp. La restriccion exige al menos uno de los dos: sin forma de contacto el registro no sirve para nada.';
comment on column destinos.dst_viajero.llega_el is
  'El dato mas valioso de toda la tabla. Con la fecha de llegada se dispara la secuencia: 60 dias antes inspiracion, 30 alojamiento, 14 tours, 7 transporte, durante la estadia restaurantes, despues resena.';
comment on column destinos.dst_viajero.intereses is
  'Que le gusta, del formulario del planificador: termales, rafting, bienestar, ciclismo. Decide que se le recomienda y que correos recibe.';
comment on column destinos.dst_viajero.origen is
  'De donde salio: planificador, guia, ficha, whatsapp, boletin, manual. Junto a utm_* y guia_id responde a "de donde viene cada persona", que es lo que se mide para saber que contenido produce ventas.';
comment on column destinos.dst_viajero.guia_id is
  'Que guia lo trajo, cuando se puede saber. Es lo que permite decir "el articulo de termales genero 40 leads y 6 reservas".';

create unique index uq_dst_viajero_email    on destinos.dst_viajero (destino_id, lower(email))  where email is not null;
create unique index uq_dst_viajero_whatsapp on destinos.dst_viajero (destino_id, whatsapp)      where whatsapp is not null;
create index idx_dst_viajero_destino  on destinos.dst_viajero (destino_id);
create index idx_dst_viajero_llegada  on destinos.dst_viajero (llega_el) where llega_el is not null;
create index idx_dst_viajero_intereses on destinos.dst_viajero using gin (intereses);

alter table destinos.dst_resena
  add constraint fk_dst_resena_viajero foreign key (viajero_id)
  references destinos.dst_viajero (id) on delete cascade;

alter table destinos.dst_resena_util
  add constraint fk_dst_resena_util_viajero foreign key (viajero_id)
  references destinos.dst_viajero (id) on delete cascade;

-- ===========================================================================
-- PLANIFICACION
-- ===========================================================================

create table destinos.dst_itinerario (
  id             uuid primary key default gen_random_uuid(),
  destino_id     uuid not null references destinos.dst_destino (id) on delete cascade,
  viajero_id     uuid references destinos.dst_viajero (id) on delete cascade,

  titulo         text not null,
  babosa         text not null,
  dias           smallint not null,
  empieza_el     date,
  personas       smallint,
  tipo_viajero   destinos.tipo_viajero,
  presupuesto    destinos.presupuesto_viaje,
  intereses      text[] not null default '{}',

  generado_por   text not null default 'planificador',
  es_publico     boolean not null default false,
  total_usd      numeric(10,2),

  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint uq_dst_itinerario_babosa unique (babosa),
  constraint ck_dst_itinerario_dias check (dias between 1 and 30),
  constraint ck_dst_itinerario_generado check (generado_por in ('planificador','equipo','plantilla','viajero'))
);

comment on table destinos.dst_itinerario is
  'El plan de viaje: lo que devuelve el planificador y lo que el equipo arma a mano. La babosa lo hace compartible por enlace, que es como se difunde solo. Un itinerario sin viajero_id es una plantilla publica ("4 dias en La Fortuna para familias").';
comment on column destinos.dst_itinerario.es_publico is
  'true en las plantillas que se indexan y traen trafico. El itinerario personal de alguien no se publica nunca.';

create index idx_dst_itinerario_destino on destinos.dst_itinerario (destino_id);
create index idx_dst_itinerario_viajero on destinos.dst_itinerario (viajero_id);

create table destinos.dst_itinerario_parada (
  id             uuid primary key default gen_random_uuid(),
  itinerario_id  uuid not null references destinos.dst_itinerario (id) on delete cascade,

  dia            smallint not null,
  orden          smallint not null default 0,
  momento        text,

  negocio_id     uuid references destinos.dst_negocio (id) on delete set null,
  tour_id        uuid references destinos.dst_tour (id)    on delete set null,
  titulo_libre   text,
  nota_es        text,
  nota_en        text,
  duracion_horas numeric(4,1),

  esta_reservado boolean not null default false,

  constraint ck_dst_parada_dia check (dia >= 1),
  constraint ck_dst_parada_momento check (momento is null or momento in ('manana','tarde','noche')),
  constraint ck_dst_parada_algo check (negocio_id is not null or tour_id is not null or titulo_libre is not null)
);

comment on table destinos.dst_itinerario_parada is
  'Cada bloque del itinerario. Apunta a un negocio, a un tour, o a texto libre cuando es algo que no esta en el directorio. La restriccion impide guardar una parada vacia.';
comment on column destinos.dst_itinerario_parada.esta_reservado is
  'Se enciende cuando esa parada se convirtio en reserva. Es la medida real de si el planificador vende o solo entretiene.';

create index idx_dst_parada_itinerario on destinos.dst_itinerario_parada (itinerario_id, dia, orden);

create table destinos.dst_favorito (
  viajero_id uuid not null references destinos.dst_viajero (id) on delete cascade,
  negocio_id uuid references destinos.dst_negocio (id) on delete cascade,
  tour_id    uuid references destinos.dst_tour (id)    on delete cascade,
  creado_en  timestamptz not null default now(),

  constraint ck_dst_favorito_uno check (num_nonnulls(negocio_id, tour_id) = 1)
);
comment on table destinos.dst_favorito is
  'El corazon que guarda un negocio o un tour. Senal de intencion barata de capturar y util para saber que ofrecerle a esa persona.';
create unique index uq_dst_favorito_negocio on destinos.dst_favorito (viajero_id, negocio_id) where negocio_id is not null;
create unique index uq_dst_favorito_tour    on destinos.dst_favorito (viajero_id, tour_id)    where tour_id is not null;

-- ===========================================================================
-- COMERCIAL
-- ===========================================================================

create table destinos.dst_solicitud (
  id                uuid primary key default gen_random_uuid(),
  destino_id        uuid not null references destinos.dst_destino (id) on delete cascade,
  viajero_id        uuid not null references destinos.dst_viajero (id) on delete cascade,

  tipo              destinos.tipo_solicitud not null,
  negocio_id        uuid references destinos.dst_negocio (id)    on delete set null,
  tour_id           uuid references destinos.dst_tour (id)       on delete set null,
  itinerario_id     uuid references destinos.dst_itinerario (id) on delete set null,

  mensaje           text,
  valor_estimado_usd numeric(10,2),

  etapa             destinos.etapa_comercial not null default 'nuevo',
  responsable_id    uuid references destinos.dst_usuario (id) on delete set null,
  probabilidad      smallint,
  cierra_estimado_el date,
  motivo_perdida    text,

  primera_respuesta_en timestamptz,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),

  constraint ck_dst_solicitud_prob    check (probabilidad is null or probabilidad between 0 and 100),
  constraint ck_dst_solicitud_perdida check (etapa <> 'perdido' or motivo_perdida is not null)
);

comment on table destinos.dst_solicitud is
  'Toda consulta que entra: pedido de itinerario, de un tour, de hospedaje o pregunta suelta. Es el pipeline comercial. Un vendedor cierra desde aqui igual que en cualquier CRM, y el caso mas jugoso es el de quien pidio itinerario y no compro: ahi es donde entra la llamada de cierre.';
comment on column destinos.dst_solicitud.primera_respuesta_en is
  'Cuando se le contesto por primera vez. En turismo el tiempo de respuesta decide la venta mas que el precio, asi que se mide explicitamente.';
comment on column destinos.dst_solicitud.etapa is
  'nuevo, contactado, propuesta_enviada, negociacion, reservado o perdido. Es el embudo del viajero, no el del inversionista.';

create index idx_dst_solicitud_destino on destinos.dst_solicitud (destino_id, etapa);
create index idx_dst_solicitud_viajero on destinos.dst_solicitud (viajero_id);
create index idx_dst_solicitud_responsable on destinos.dst_solicitud (responsable_id) where etapa not in ('reservado','perdido');
create index idx_dst_solicitud_abiertas on destinos.dst_solicitud (destino_id, creado_en desc) where etapa not in ('reservado','perdido');

create table destinos.dst_reserva (
  id                uuid primary key default gen_random_uuid(),
  destino_id        uuid not null references destinos.dst_destino (id) on delete restrict,
  viajero_id        uuid not null references destinos.dst_viajero (id) on delete restrict,
  solicitud_id      uuid references destinos.dst_solicitud (id) on delete set null,

  codigo            text not null,
  estado            destinos.estado_reserva not null default 'solicitada',

  subtotal_usd      numeric(10,2) not null default 0,
  descuento_usd     numeric(10,2) not null default 0,
  total_usd         numeric(10,2) not null default 0,
  comision_usd      numeric(10,2) not null default 0,
  cupon_id          uuid references destinos.dst_cupon (id) on delete set null,

  estado_pago       destinos.estado_pago not null default 'pendiente',
  pagado_usd        numeric(10,2) not null default 0,

  nombre_titular    text not null,
  email_titular     text,
  whatsapp_titular  text,
  notas             text,
  notas_internas    text,

  confirmada_en     timestamptz,
  cancelada_en      timestamptz,
  motivo_cancelacion text,

  creado_por        uuid references destinos.dst_usuario (id) on delete set null,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),

  constraint uq_dst_reserva_codigo unique (codigo),
  constraint ck_dst_reserva_montos check (
    subtotal_usd >= 0 and descuento_usd >= 0 and total_usd >= 0 and pagado_usd >= 0
  ),
  constraint ck_dst_reserva_cancelada check (estado <> 'cancelada' or motivo_cancelacion is not null)
);

comment on table destinos.dst_reserva is
  'La conversion. En la primera etapa entra como solicitada y el equipo la confirma con el operador; cuando haya inventario en tiempo real pasara sola a confirmada. Los montos se guardan en USD porque es la moneda en la que se cotiza el turismo receptivo.';
comment on column destinos.dst_reserva.codigo is
  'Codigo corto que ve el viajero (VLF-2026-0042). Es lo que dice por WhatsApp cuando escribe.';
comment on column destinos.dst_reserva.comision_usd is
  'Lo que gana la plataforma. Se calcula al confirmar y se congela: si manana cambia el porcentaje del tour, esta reserva no cambia.';

create index idx_dst_reserva_destino on destinos.dst_reserva (destino_id, estado);
create index idx_dst_reserva_viajero on destinos.dst_reserva (viajero_id);
create index idx_dst_reserva_fecha   on destinos.dst_reserva (creado_en desc);

create table destinos.dst_reserva_linea (
  id              uuid primary key default gen_random_uuid(),
  reserva_id      uuid not null references destinos.dst_reserva (id) on delete cascade,

  tour_id         uuid references destinos.dst_tour (id)        on delete set null,
  salida_id       uuid references destinos.dst_tour_salida (id) on delete set null,
  habitacion_id   uuid references destinos.dst_habitacion (id)  on delete set null,
  negocio_id      uuid references destinos.dst_negocio (id)     on delete set null,

  descripcion     text not null,
  para_el         date,
  adultos         smallint not null default 1,
  ninos           smallint not null default 0,
  noches          smallint,

  precio_unitario_usd numeric(10,2) not null,
  cantidad        smallint not null default 1,
  total_usd       numeric(10,2) not null,
  neto_usd        numeric(10,2),
  comision_usd    numeric(10,2) not null default 0,

  creado_en       timestamptz not null default now(),

  constraint ck_dst_linea_cantidad check (cantidad > 0),
  constraint ck_dst_linea_montos   check (precio_unitario_usd >= 0 and total_usd >= 0)
);

comment on table destinos.dst_reserva_linea is
  'Cada cosa reservada dentro de una reserva: dos tours y tres noches de hotel son cuatro lineas de la misma reserva. La descripcion se congela al crear la linea, para que cambiar el nombre de un tour no reescriba reservas viejas.';

create index idx_dst_linea_reserva on destinos.dst_reserva_linea (reserva_id);
create index idx_dst_linea_tour    on destinos.dst_reserva_linea (tour_id);

create table destinos.dst_pago (
  id             uuid primary key default gen_random_uuid(),
  reserva_id     uuid not null references destinos.dst_reserva (id) on delete cascade,

  concepto       text not null,
  monto_usd      numeric(10,2) not null,
  metodo         text,
  referencia     text,
  comprobante_url text,

  vence_el       date,
  pagado_el      date,
  estado         destinos.estado_pago not null default 'pendiente',

  registrado_por uuid references destinos.dst_usuario (id) on delete set null,
  creado_en      timestamptz not null default now(),

  constraint ck_dst_pago_monto check (monto_usd <> 0),
  constraint ck_dst_pago_metodo check (metodo is null or metodo in (
    'transferencia','sinpe','tarjeta','efectivo','paypal','stripe','otro'
  ))
);

comment on table destinos.dst_pago is
  'Movimientos de dinero de una reserva: adelanto, saldo y reembolsos. Varias filas por reserva. El saldo pendiente es total_usd menos la suma de lo pagado, no una columna que alguien pueda desincronizar.';
comment on column destinos.dst_pago.monto_usd is
  'Negativo en un reembolso. Por eso la restriccion pide distinto de cero y no mayor que cero.';

create index idx_dst_pago_reserva on destinos.dst_pago (reserva_id);
create index idx_dst_pago_vence   on destinos.dst_pago (vence_el) where estado = 'pendiente';

create table destinos.dst_comision (
  id            uuid primary key default gen_random_uuid(),
  reserva_id    uuid not null references destinos.dst_reserva (id) on delete cascade,
  negocio_id    uuid not null references destinos.dst_negocio (id) on delete restrict,

  base_usd      numeric(10,2) not null,
  porcentaje    numeric(5,2),
  monto_usd     numeric(10,2) not null,

  estado        text not null default 'por_cobrar',
  facturada_el  date,
  cobrada_el    date,
  nota          text,

  creado_en     timestamptz not null default now(),

  constraint ck_dst_comision_estado check (estado in ('por_cobrar','facturada','cobrada','anulada')),
  constraint ck_dst_comision_pct    check (porcentaje is null or porcentaje between 0 and 100)
);

comment on table destinos.dst_comision is
  'Lo que cada proveedor debe a la plataforma por una reserva. Separado de dst_pago porque son dos flujos distintos: el viajero paga la reserva, el proveedor paga la comision, y se cobran en momentos distintos.';

create index idx_dst_comision_negocio on destinos.dst_comision (negocio_id, estado);
create index idx_dst_comision_pendientes on destinos.dst_comision (estado) where estado = 'por_cobrar';

-- ===========================================================================
-- SEGUIMIENTO
-- ===========================================================================

create table destinos.dst_tarea (
  id            uuid primary key default gen_random_uuid(),
  destino_id    uuid not null references destinos.dst_destino (id) on delete cascade,

  titulo        text not null,
  detalle       text,
  viajero_id    uuid references destinos.dst_viajero (id)   on delete cascade,
  solicitud_id  uuid references destinos.dst_solicitud (id) on delete cascade,
  reserva_id    uuid references destinos.dst_reserva (id)   on delete cascade,
  negocio_id    uuid references destinos.dst_negocio (id)   on delete cascade,

  responsable_id uuid references destinos.dst_usuario (id) on delete set null,
  vence_el      date,
  prioridad     text not null default 'media',
  esta_hecha    boolean not null default false,
  hecha_en      timestamptz,

  creado_por    uuid references destinos.dst_usuario (id) on delete set null,
  creado_en     timestamptz not null default now(),

  constraint ck_dst_tarea_prioridad check (prioridad in ('baja','media','alta','urgente'))
);

comment on table destinos.dst_tarea is
  'Que hay que hacer y quien lo hace. Alimenta la pantalla "Hoy" del panel. Una tarea cuelga de lo que sea: un viajero, una solicitud, una reserva o un negocio.';

create index idx_dst_tarea_pendientes on destinos.dst_tarea (responsable_id, vence_el) where not esta_hecha;
create index idx_dst_tarea_destino on destinos.dst_tarea (destino_id) where not esta_hecha;

create table destinos.dst_mensaje (
  id            uuid primary key default gen_random_uuid(),
  destino_id    uuid not null references destinos.dst_destino (id) on delete cascade,

  viajero_id    uuid references destinos.dst_viajero (id)   on delete cascade,
  solicitud_id  uuid references destinos.dst_solicitud (id) on delete set null,
  reserva_id    uuid references destinos.dst_reserva (id)   on delete set null,
  negocio_id    uuid references destinos.dst_negocio (id)   on delete cascade,

  canal         destinos.canal_mensaje not null,
  direccion     destinos.direccion_mensaje not null,
  asunto        text,
  cuerpo        text not null,

  usuario_id    uuid references destinos.dst_usuario (id) on delete set null,
  automatico    boolean not null default false,
  plantilla     text,
  id_externo    text,

  enviado_en    timestamptz not null default now(),
  leido_en      timestamptz,

  constraint ck_dst_mensaje_a_alguien check (viajero_id is not null or negocio_id is not null)
);

comment on table destinos.dst_mensaje is
  'Todo lo que se dijo y por donde: correos, WhatsApp, llamadas y notas internas, en un solo hilo por persona. Sin esto, el historial vive en el telefono de quien atendio y se pierde cuando esa persona no esta.';
comment on column destinos.dst_mensaje.automatico is
  'true cuando lo mando una secuencia y no una persona. Permite medir aparte lo que produce la automatizacion.';

create index idx_dst_mensaje_viajero on destinos.dst_mensaje (viajero_id, enviado_en desc);
create index idx_dst_mensaje_negocio on destinos.dst_mensaje (negocio_id, enviado_en desc);
create index idx_dst_mensaje_destino on destinos.dst_mensaje (destino_id, enviado_en desc);
