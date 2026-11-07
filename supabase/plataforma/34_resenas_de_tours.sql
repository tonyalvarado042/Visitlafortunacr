/*
 * 34 — Las tours también se reseñan.
 *
 * 7 de noviembre de 2026. Pedido por Tony mirando GetYourGuide:
 *
 *   «reviews también debe ser posible igual que negocios»
 *   «todo el sitio es de negocios y tours»
 *
 * EL HUECO: `dst_resena` solo tenía `negocio_id`. No se le podía colgar una
 * reseña a una tour, así que la ficha de una tour no tenía ni nota ni una sola
 * opinión — y es la página donde se decide una reserva.
 *
 * Estado al empezar: 1 reseña en toda la base, 0 publicadas. O sea, esto
 * construye para adelante; no arregla un atraso.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LAS CUATRO DECISIONES, Y POR QUÉ
 *
 * 1. `negocio_id` SIGUE SIENDO OBLIGATORIO, también en una reseña de tour.
 *    Toda tour tiene dueño, así que el dato no se inventa: se deriva. A cambio
 *    el operador ve todo lo que le escribieron en una sola consulta, y —lo que
 *    importa— NINGUNA consulta vieja se queda sin filas al soltar esto.
 *
 * 2. EL NEGOCIO SUMA LAS RESEÑAS DE SUS TOURS; LA TOUR SOLO LAS SUYAS.
 *    La reputación del operador es la suma de lo que hace. Pero la nota de un
 *    operador con diez tours no dice nada de la que uno está mirando, y por eso
 *    la tour lleva su propio promedio. Es la diferencia que hace GetYourGuide.
 *
 * 3. ⚠️ `unique nulls not distinct`, Y NO ES ADORNO.
 *    El índice viejo era `(negocio_id, viajero_id)`: una reseña por persona y
 *    negocio. Ahora hace falta una por persona y TOUR, más una del negocio en
 *    general. Si se agregara `tour_id` a secas, Postgres trata cada NULL como
 *    distinto de los demás y **la misma persona podría dejar diez reseñas del
 *    mismo negocio**. `nulls not distinct` (Postgres 15+; acá hay 17.6) hace
 *    que los NULL choquen entre sí, que es justo lo que se quiere.
 *
 * 4. QUE LA TOUR SEA DE ESE NEGOCIO SE COMPRUEBA EN `registrar_resena`.
 *    No puede ser un CHECK: una restricción de tabla no consulta otra tabla.
 *    Y el guardia tiene que estar, porque sin él el cuerpo del formulario
 *    podría colgarle a un negocio la reseña de la tour de un competidor.
 *    PROBADO con el ataque: se rechaza.
 *
 * ⚠️ `registrar_resena` se BORRA y se vuelve a crear, no se le agrega el
 * parámetro encima. Un parámetro con valor por omisión crea una SEGUNDA
 * función, y PostgREST ante dos candidatas que encajan contesta «could not
 * choose the best candidate»: el formulario de reseñas dejaría de funcionar
 * entero.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * PROBADO A PROPÓSITO el 7 de noviembre de 2026, en transacción revertida,
 * diez comprobaciones, todas en verde:
 *   - la reseña de una tour nace `pendiente` (el destino modera) y NO cuenta
 *     en el promedio hasta que se aprueba;
 *   - al aprobarla, cuentan la tour Y el negocio;
 *   - `resenas_de_tour` la devuelve con el nombre recortado a «Ana P.»;
 *   - la misma persona puede reseñar la tour Y el negocio aparte;
 *   - repetir la del negocio CORRIGE y no duplica (el `nulls not distinct`);
 *   - EL ATAQUE —colgarle a otro negocio esta tour— se rechaza;
 *   - al borrar la reseña, el promedio de la tour vuelve a nulo.
 * Y de punta a punta por el formulario público: entró como `pendiente`, al
 * aprobarla la ficha mostró «5,0» y «Ana P.», y un `tour_id` que no es un
 * uuid se rechaza en el borde. Las filas de prueba se borraron.
 */

alter table destinos.dst_resena
  add column if not exists tour_id uuid references destinos.dst_tour(id) on delete cascade;

comment on column destinos.dst_resena.tour_id is
  'NULL = resena del negocio entero. Con valor = resena de ESE tour. negocio_id sigue siendo obligatorio siempre.';

create index if not exists ix_dst_resena_tour on destinos.dst_resena (tour_id)
  where tour_id is not null;

alter table destinos.dst_resena drop constraint if exists uq_dst_resena_una_por_viajero;
alter table destinos.dst_resena
  add constraint uq_dst_resena_una_por_viajero
  unique nulls not distinct (negocio_id, viajero_id, tour_id);

alter table destinos.dst_tour
  add column if not exists total_resenas integer not null default 0,
  add column if not exists promedio_calificacion numeric(2,1);

comment on column destinos.dst_tour.total_resenas is
  'Lo mantiene el disparador recalcular_calificacion_negocio. Cuenta SOLO las resenas de este tour.';

/*
 * Las funciones van en la base y su texto se lee con `pg_get_functiondef`:
 *
 *   - `recalcular_calificacion_tour(uuid)`  — NUEVA.
 *   - `recalcular_calificacion_negocio()`   — el disparador, que ahora
 *     recalcula el tour VIEJO y el NUEVO. Los dos, porque una resena puede
 *     cambiar de tour al corregirla y recalcular solo el nuevo dejaria al
 *     viejo contando una que ya no tiene.
 *   - `registrar_resena(..., p_tour_id)`    — con el guardia de pertenencia.
 *   - `resenas_de_tour(uuid, integer)`      — NUEVA. Hermana de
 *     `resenas_de_negocio`: misma regla de nombre (nombre de pila e inicial
 *     del apellido) y mismo doble filtro de publicacion.
 *   - `resenas_de_mi_negocio(uuid)`         — devuelve `tour_id` y
 *     `tour_nombre`, para que el operador sepa de cual de sus tours es.
 *
 * ⚠️ Del lado del codigo, el bloque de resenas dejo de estar escrito a mano
 * dentro de la pagina del negocio y vive en `componentes/BloqueResenas.tsx`,
 * que usan las DOS fichas. Copiar cuarenta lineas de JSX habria dejado dos
 * bloques que se parecen hasta que alguien arregla uno.
 */
notify pgrst, 'reload schema';
