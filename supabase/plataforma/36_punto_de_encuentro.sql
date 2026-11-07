/*
 * 36 — Dónde se encuentran.
 *
 * 7 de noviembre de 2026. Tony, revisando fila por fila la ficha de
 * GetYourGuide contra la nuestra: *«¿estos son campos editables en el tour?»*.
 *
 * EL HUECO: la recogida era una casilla de sí o no, y el «Desde La Fortuna»
 * lo ponía el CÓDIGO con el nombre del destino. Un tour que recoge solo en
 * ciertos hoteles, o que arranca en un punto fijo, no tenía dónde decirlo — y
 * esa pregunta le llegaba al operador por WhatsApp, una por una.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LAS TRES DECISIONES
 *
 * 1. UN SOLO CAMPO PARA LOS DOS CASOS, y lo decide `recoge_en_hotel`:
 *      true  → la ficha dice «Te pasan buscando», y el texto es DE DÓNDE.
 *      false → la ficha dice «Punto de encuentro», y el texto es ADÓNDE ir.
 *    Dos campos separados obligarían al operador a entender la diferencia
 *    antes de escribir, y a nosotros a decidir cuál gana si llena los dos.
 *
 * 2. VACÍO CAE AL NOMBRE DEL DESTINO, que es lo que decía antes. Es cierto y
 *    es mejor que no decir nada: ninguna ficha empeora por soltar esto.
 *
 * 3. ⚠️ NACE TRADUCIBLE. Entró a la lista blanca de
 *    `guardar_traducciones_de_mi_tour` y a `lib/traducciones-de-tour.ts` en el
 *    mismo cambio. Es la lección de la migración 35, aplicada otra vez:
 *    `dst_traduccion` aceptaba `entidad='tour'` desde que se creó la tabla y
 *    aun así los tours pasaron meses sin una traducción, porque nadie las
 *    pedía. Construir el hueco y taparlo después cuesta tocar seis lugares.
 *
 * ⚠️ `actualizar_mi_tour` y `mi_tour` se BORRAN y se recrean, no se les
 * agrega el parámetro encima. Un parámetro con valor por omisión crea una
 * SEGUNDA función, y PostgREST ante dos candidatas que encajan contesta
 * «could not choose the best candidate»: el formulario del tour dejaría de
 * guardar entero. `mi_tour` además cambia el tipo que devuelve, así que
 * Postgres obliga a borrarla. Mismo caso que `registrar_resena` en la 34.
 *
 * COMPROBADO después: UNA sola firma de cada una.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * PROBADO A PROPÓSITO, en transacción revertida:
 *   - un texto de 400 caracteres se corta en 300 (es una línea de ficha, no
 *     un párrafo: si alguien pega media página, la fila se desarma);
 *   - solo espacios queda en NULL, no en cadena vacía — una cadena vacía haría
 *     que la ficha mostrara un hueco en vez de caer al respaldo;
 *   - el texto se guarda entero, sin recortes ni cambios;
 *   - el guardia de dueño rechaza al que no lo es, también con el campo nuevo;
 *   - y el campo nuevo sí se traduce.
 */

alter table destinos.dst_tour
  add column if not exists punto_encuentro text;

comment on column destinos.dst_tour.punto_encuentro is
  'Donde los recogen o donde se encuentran, en texto libre. Sirve para los DOS casos y lo decide recoge_en_hotel: con true la ficha dice «Te pasan buscando» y esto es de donde; con false dice «Punto de encuentro» y esto es adonde hay que ir. Vacio y recoge_en_hotel=true cae al nombre del destino. Traducible: esta en la lista blanca de guardar_traducciones_de_mi_tour y en lib/traducciones-de-tour.ts.';

/*
 * Las funciones van en la base y su texto se lee con `pg_get_functiondef`:
 *
 *   guardar_traducciones_de_mi_tour  — `punto_encuentro` entra a la lista
 *     blanca. Siguen fuera `precio_nota` y todo lo demás que el operador no
 *     puede escribir por la puerta.
 *   actualizar_mi_tour(..., p_punto_encuentro)  — con el tope de 300.
 *   mi_tour  — devuelve el campo, para que el formulario lo muestre.
 *
 * ⚠️ Y EL CUARTO LUGAR que tiene que decir lo mismo es `lib/destino.ts`:
 * su `CAMPOS_TRADUCIBLES_DE_TOUR` es el que LEE las traducciones en la ficha
 * pública. Si acá sobrara un campo, el operador escribiría algo que la ficha
 * nunca muestra; si allá sobrara, se leería una traducción que nadie puede
 * escribir. La nota larga de `lib/traducciones-de-tour.ts` lista los cuatro.
 */
notify pgrst, 'reload schema';
