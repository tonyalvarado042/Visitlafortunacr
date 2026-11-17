-- ---------------------------------------------------------------------------
-- 50. La cara del concierge
--
-- Tony, 16 de noviembre de 2026: «un agente virtual en chat integrado pero
-- visualmente muy bonito… que la persona vea una foto».
--
-- El nombre ya estaba (`dst_agente.nombre`, hoy «Sofía»). Faltaban la cara y
-- la línea de abajo.
--
-- ⚠️ `es_persona` NO EXISTE A PROPÓSITO.
--
-- Lo que se pidió fue que se sintiera humano. Eso se logra con cara, nombre y
-- forma de hablar —y todo eso está acá—. Lo que NO se hace es decir que es una
-- persona cuando no lo es: el día que alguien lo descubre, no pierde la
-- confianza en el chat, la pierde en el sitio entero. Por eso `cargo` existe y
-- arranca diciendo lo que es, y la pantalla siempre lo muestra.
-- ---------------------------------------------------------------------------

alter table destinos.dst_agente
  add column if not exists foto_url text,
  add column if not exists cargo    text;

comment on column destinos.dst_agente.foto_url is
  'La foto que se ve en el chat. Tiene que ser de una persona REAL del equipo, o quedar vacía: con una cara inventada el chat afirma algo falso sin decir una palabra. Vacía = se pinta un avatar de marca con la inicial, que es honesto y se ve bien.';

comment on column destinos.dst_agente.cargo is
  'La línea de abajo del nombre, visible siempre en el encabezado del chat. Dice qué es quien contesta. No se deja vacía para disimular: si está vacía, la pantalla pone «Asistente virtual» por su cuenta.';

-- Un punto de partida en español para el concierge de cada destino que ya
-- exista. No se toca el nombre: ese ya lo eligió alguien.
update destinos.dst_agente
   set cargo = 'Asistente virtual'
 where clave = 'concierge'
   and cargo is null;
