/*
 * 33 — Las etiquetas de las personas, y que el sorteo las ponga.
 *
 * 7 de noviembre de 2026. Fase 0 del módulo de marketing
 * (`docs/modulo-de-marketing.md`). Tony escogió «tabla propia» sobre reusar el
 * arreglo de texto `dst_viajero.intereses`, y escogió empezar por el sorteo.
 *
 * EL PROBLEMA MEDIDO: de 11 viajeros, 6 entraron por el sorteo y **los 6
 * tienen `intereses` vacío**. Los que entraron por el planificador sí los
 * traen, porque ese formulario los pregunta. O sea: la puerta por la que entra
 * más de la mitad de la gente los mete sin una sola etiqueta, y sin interés no
 * hay segmento: el boletín le manda lo mismo a todo el mundo.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LAS TRES DECISIONES DE DISEÑO, Y POR QUÉ
 *
 * 1. `origen` NO lleva grupo de etiquetas, aunque el diseño lo proponía.
 *    `dst_viajero.origen` ya existe, es de un solo valor y como columna está
 *    perfecta. Duplicarla en etiquetas crea dos verdades para el mismo hecho,
 *    que es justo la forma de fallo que este archivo intenta evitar.
 *
 * 2. `dst_viajero.intereses` SE QUEDA, y lo mantiene un disparador.
 *    Hoy lo leen `lib/ia/agente.ts`, `lib/ia/analista.ts`,
 *    `lib/ia/planificador.ts` y la pantalla del lead. Si la tabla nueva fuera
 *    la única verdad, todo eso se queda ciego hasta que se reescriba, y
 *    mientras tanto falla callado. Así que: **la tabla es la verdad y la
 *    columna es un reflejo que mantiene `refrescar_intereses_del_viajero`.**
 *    Un disparador y no los que llaman, porque a un llamador nuevo se le
 *    olvida y al disparador no.
 *
 * 3. El vocabulario son las MISMAS ocho babosas que ya usa el planificador
 *    (`lib/intereses.ts`, antes dentro de `Planificador.tsx`). Ni una nueva.
 *    Así el relleno de abajo no pierde nada: los seis valores que los viajeros
 *    ya tenían —aguas-termales, aventura, bienestar, comida, naturaleza,
 *    rafting— están los seis en la lista.
 *
 * ⚠️ `alter type ... add value` y usar el valor nuevo NO pueden ir en la misma
 * transacción («unsafe use of new value of enum type»). Por eso el bloque A va
 * aparte, y se aplicó aparte. Misma familia de problema que la migración 32:
 * un valor que el código tiene y la base no.
 */

-- ──────────────────────────── BLOQUE A, solo ────────────────────────────
-- Los grupos nuevos. `servicio/ambiente/accesibilidad/publico/pago` son
-- atributos de un NEGOCIO («Wifi gratis», «Vista al volcán»): etiquetar a una
-- persona con eso no significa nada.
alter type destinos.grupo_etiqueta add value if not exists 'interes';
alter type destinos.grupo_etiqueta add value if not exists 'momento';
alter type destinos.grupo_etiqueta add value if not exists 'mano';

-- ──────────────────────────── BLOQUE B ────────────────────────────
create table if not exists destinos.dst_viajero_etiqueta (
  viajero_id  uuid not null references destinos.dst_viajero(id)  on delete cascade,
  etiqueta_id uuid not null references destinos.dst_etiqueta(id)  on delete cascade,
  puesta_por  text not null default 'equipo',
  creado_en   timestamptz not null default now(),
  primary key (viajero_id, etiqueta_id)
);

comment on table destinos.dst_viajero_etiqueta is
  'Etiquetas de una persona. Es la VERDAD de los intereses; dst_viajero.intereses es un reflejo que mantiene el disparador refrescar_intereses_del_viajero. Las babosas del grupo interes tienen que coincidir con lib/intereses.ts.';
comment on column destinos.dst_viajero_etiqueta.puesta_por is
  'Quien la puso: sorteo | planificador | concierge | equipo. Sirve para saber si un segmento lo construyó la gente o lo construimos nosotros.';

create index if not exists ix_dst_viajero_etiqueta_etiqueta
  on destinos.dst_viajero_etiqueta (etiqueta_id);

alter table destinos.dst_viajero_etiqueta enable row level security;

/* Mismo molde que dst_viajero: solo el equipo del destino, y NADA de lectura
   pública. Las etiquetas de un negocio sí se leen en público —son parte de su
   ficha—; las de una persona no son de nadie más. El sitio público nunca
   escribe acá: lo hace etiquetar_viajero, que es SECURITY DEFINER. */
drop policy if exists "el equipo administra etiquetas de sus viajeros" on destinos.dst_viajero_etiqueta;
create policy "el equipo administra etiquetas de sus viajeros"
  on destinos.dst_viajero_etiqueta for all to authenticated
  using (destinos.tiene_acceso_a(
          (select v.destino_id from destinos.dst_viajero v where v.id = viajero_id)))
  with check (destinos.tiene_acceso_a(
          (select v.destino_id from destinos.dst_viajero v where v.id = viajero_id)));

-- ──────────────────────────── BLOQUE C: el vocabulario ────────────────────────────
-- Las ocho de `interes` son EXACTAMENTE las de `lib/intereses.ts`, que son las
-- que el planificador ya preguntaba. Ni una nueva, para que el relleno del
-- bloque D no pierda nada.
insert into destinos.dst_etiqueta (grupo, babosa, nombre) values
  ('interes', 'aguas-termales', 'Aguas termales'),
  ('interes', 'rafting',        'Rafting'),
  ('interes', 'naturaleza',     'Naturaleza'),
  ('interes', 'bienestar',      'Bienestar'),
  ('interes', 'ciclismo',       'Ciclismo'),
  ('interes', 'comida',         'Comida'),
  ('interes', 'aventura',       'Aventura'),
  ('interes', 'vida-silvestre', 'Vida silvestre'),
  ('momento', 'solo-mirando',   'Solo esta mirando'),
  ('momento', 'con-fechas',     'Ya tiene fechas'),
  ('momento', 'ya-reservo',     'Ya reservo'),
  ('momento', 'ya-vino',        'Ya vino'),
  ('mano',    'vip',            'VIP'),
  ('mano',    'agencia',        'Agencia'),
  ('mano',    'repetidor',      'Repetidor'),
  ('mano',    'prensa',         'Prensa')
on conflict do nothing;

-- ──────────────────────────── BLOQUE D: el relleno ────────────────────────────
-- Lo que ya estaba en la columna pasa a ser etiqueta. Una sola vez.
-- Resultado medido el 7 de noviembre de 2026: 13 etiquetas, 4 viajeros, y
-- CERO valores que se quedaran afuera del vocabulario.
insert into destinos.dst_viajero_etiqueta (viajero_id, etiqueta_id, puesta_por)
select v.id, e.id, 'relleno'
  from destinos.dst_viajero v
  cross join lateral unnest(coalesce(v.intereses, '{}'::text[])) as i
  join destinos.dst_etiqueta e on e.grupo = 'interes' and e.babosa = i
on conflict do nothing;

-- ──────────────────────────── BLOQUE E: los dos disparadores ────────────────────────────
/*
 * ⚠️ LO MÁS DELICADO DE TODA LA MIGRACIÓN: SON DOS, Y SE MIRAN DE FRENTE.
 *
 *   A) `refrescar_intereses_del_viajero`  etiqueta  →  columna
 *   B) `etiquetar_desde_la_columna`       columna   →  etiqueta
 *
 * B existe porque `dst_viajero.intereses` lo escriben CUATRO lados distintos:
 * `registrar_solicitud` (el planificador), `lib/ia/agente.ts`,
 * `lib/ia/analista.ts` y la pantalla de viajeros. Arreglar los cuatro deja al
 * quinto sin etiquetas el día que alguien lo agregue, y el síntoma sería «esa
 * persona no sale en el segmento»: callado, y meses después.
 *
 * EL LAZO lo corta el `and v.intereses is distinct from t.nuevo` de A. Sin esa
 * línea: A escribe la columna → B mete etiquetas → A vuelve a escribir → para
 * siempre. Con ella, la segunda vuelta no escribe nada y la cadena se para.
 *
 * Y A conserva a propósito los intereses de TEXTO LIBRE que la IA saca de una
 * conversación («pesca», «fotografía»): la columna es el superconjunto —todo
 * lo que sabemos— y la tabla es la parte controlada, que es la única con la
 * que se segmenta. Así una palabra suelta nunca se cuela sola a un envío.
 *
 * PROBADO A PROPÓSITO el 7 de noviembre de 2026, en transacción revertida,
 * en los dos sentidos: insertar la columna crea las etiquetas; actualizarla
 * agrega la que falta sin colgarse; poner una etiqueta directa llega a la
 * columna; borrarla la saca; y el texto libre aguanta las cinco veces.
 * El código de ambas funciones está en la base — ver `pg_get_functiondef`.
 */

-- ──────────────────────────── BLOQUE F: las dos puertas públicas ────────────────────────────
/*
 * `etiquetar_viajero(viajero, babosas, puesta_por)` — SECURITY DEFINER.
 *   Solo pone etiquetas del grupo `interes`. Ese filtro es el guardia: la
 *   llama el sitio público, y sin él cualquiera podría mandar `vip` o `prensa`
 *   en el cuerpo del formulario del sorteo y etiquetarse a mano propia.
 *   PROBADO con el ataque: `['vip','prensa','ya-reservo','wifi-gratis',
 *   'no-existe']` → entraron 0.
 *
 * `etiquetar_participante_del_sorteo(dominio, email, babosas)` — la que llama
 *   `/api/sorteo/intereses`. Solo toca a quien YA es participante del sorteo
 *   abierto de ese dominio, y no devuelve ningún dato de la persona: solo
 *   cuántas etiquetas entraron.
 */
