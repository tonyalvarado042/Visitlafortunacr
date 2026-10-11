-- Las tres cadenas. Nacen APAGADAS: son correos a personas de verdad y la
-- regla de Tony es que el ve la prueba antes de que salga nada.
--
-- Los textos van sin promesas que no podamos cumplir y sin cifras
-- inventadas. Lo que se nombra -la catarata, las termales, el volcan, la
-- experiencia de Arenal y Manuel Antonio- existe en el sitio.

with d as (select id from destinos.dst_destino where dominio = 'visitlafortunacr.com')
insert into destinos.dst_cadena (destino_id, clave, nombre, descripcion, publico, esta_activa)
select d.id, x.clave, x.nombre, x.descripcion, x.publico, false
  from d, (values
    ('rifa', 'Se apuntó a la rifa',
     'Cuatro correos en 45 días. Está soñando con el viaje: se le enseña qué hay, y al final se le ofrece hablar con un asesor.',
     'sorteo'),
    ('contacto', 'Pidió el contacto de un negocio',
     'Tres correos en 15 días. Llega caliente: quería llamar a alguien. Corta a propósito.',
     'contacto_negocio'),
    ('premium', 'Se registró y no pagó premium',
     'Cuatro correos en 20 días para el dueño del negocio. Se sale solo cuando paga.',
     'comerciante_gratis')
  ) as x(clave, nombre, descripcion, publico)
on conflict (destino_id, clave) do nothing;

-- ---------------------------------------------------------------- RIFA
with c as (select id from destinos.dst_cadena where clave = 'rifa'
            and destino_id = (select id from destinos.dst_destino where dominio='visitlafortunacr.com'))
insert into destinos.dst_cadena_paso
  (cadena_id, orden, dias_desde_alta, asunto_es, cuerpo_es, asunto_en, cuerpo_en,
   boton_texto_es, boton_texto_en, boton_ruta)
select c.id, p.orden, p.dias, p.a_es, p.c_es, p.a_en, p.c_en, p.b_es, p.b_en, p.ruta
  from c, (values
  (1, 3,
   'Mientras esperás el sorteo, esto es La Fortuna en tres días',
   E'Ya estás adentro del sorteo. Falta, así que mientras tanto te dejamos algo mejor que esperar.\n\nTres días alcanzan para el volcán, la catarata y las aguas termales sin correr. La guía la escribió gente que vive acá, no un folleto: dice a qué hora ir, qué se puede saltar y qué no.',
   'While you wait for the draw, here is La Fortuna in three days',
   E'You are in the draw. It is a while away, so in the meantime here is something better than waiting.\n\nThree days is enough for the volcano, the waterfall and the hot springs without rushing. This guide was written by people who live here, not by a brochure: it says what time to go, what you can skip and what you cannot.',
   'Leer la guía', 'Read the guide', '/blog/que-hacer-en-la-fortuna-3-dias'),

  (2, 10,
   'Las aguas termales, comparadas de verdad',
   E'Hay muchas termales en La Fortuna y no son iguales: unas son para pasar el día, otras para ir de noche, otras cuestan la mitad y casi nadie las menciona.\n\nAcá están todas, con lo que cuestan y para quién es cada una.',
   'The hot springs, actually compared',
   E'There are a lot of hot springs in La Fortuna and they are not the same: some are for spending the day, others for the evening, and some cost half as much and almost nobody mentions them.\n\nHere they all are, with prices and who each one is for.',
   'Ver las termales', 'See the hot springs', '/blog/mejores-aguas-termales-la-fortuna'),

  (3, 21,
   'Si te animás antes del sorteo',
   E'No hace falta ganar para venir.\n\nTenemos un viaje de siete días que junta las dos caras de Costa Rica: el volcán Arenal y el Pacífico de Manuel Antonio. No se compra por internet; lo arma un asesor con vos, según cuándo venís y con quién.\n\nSi te interesa, mirá de qué se trata y dejanos una consulta. Sin compromiso.',
   'If you feel like coming before the draw',
   E'You do not have to win to come.\n\nWe have a seven-day trip that puts together both sides of Costa Rica: the Arenal volcano and the Pacific at Manuel Antonio. You cannot buy it online; an advisor builds it with you, around when you are coming and who with.\n\nIf you are interested, have a look and send us a question. No commitment.',
   'Ver la experiencia', 'See the experience', '/experiencias'),

  (4, 45,
   '¿Venís este año?',
   E'Último correo de esta serie — después solo te escribimos cuando haya algo del sorteo.\n\nSi estás pensando en venir, armemos el viaje. Decinos cuántos días tenés y qué te gusta, y te mandamos un plan de verdad, con nombres y horarios.\n\nY si no era el momento, no pasa nada: el sorteo sigue y te avisamos igual.',
   'Are you coming this year?',
   E'Last email in this series — after this we only write when there is news about the draw.\n\nIf you are thinking of coming, let us put the trip together. Tell us how many days you have and what you like, and we will send you a real plan, with names and times.\n\nAnd if this was not the moment, no problem: the draw is still on and we will let you know.',
   'Armar mi viaje', 'Plan my trip', '#plan')
) as p(orden, dias, a_es, c_es, a_en, c_en, b_es, b_en, ruta)
on conflict (cadena_id, orden) do nothing;

-- ------------------------------------------------------------ CONTACTO
with c as (select id from destinos.dst_cadena where clave = 'contacto'
            and destino_id = (select id from destinos.dst_destino where dominio='visitlafortunacr.com'))
insert into destinos.dst_cadena_paso
  (cadena_id, orden, dias_desde_alta, asunto_es, cuerpo_es, asunto_en, cuerpo_en,
   boton_texto_es, boton_texto_en, boton_ruta)
select c.id, p.orden, p.dias, p.a_es, p.c_es, p.a_en, p.c_en, p.b_es, p.b_en, p.ruta
  from c, (values
  (1, 2,
   '¿Lograste hablar con ellos?',
   E'Hace un par de días pediste los datos de un negocio nuestro. ¿Te contestaron?\n\nSi no, o si querés comparar antes de decidir, en el directorio están los demás de la misma categoría, con sus precios y sus reseñas.\n\nY si preferís que lo veamos nosotros, respondé este correo y te ayudamos.',
   'Did you manage to reach them?',
   E'A couple of days ago you asked for a business''s contact details. Did they get back to you?\n\nIf not, or if you want to compare before deciding, the directory has the others in the same category, with prices and reviews.\n\nAnd if you would rather we looked into it, just reply to this email.',
   'Ver el directorio', 'Browse the directory', ''),

  (2, 7,
   'Lo que conviene saber antes de reservar',
   E'Una cosa que nos preguntan mucho: cuándo venir.\n\nLa seca es la fácil. La verde es la barata, la verde de verdad, y la que casi nadie se anima a recomendar. Depende de qué venís a hacer.\n\nAcá está la diferencia, mes por mes.',
   'What is worth knowing before you book',
   E'Something we get asked a lot: when to come.\n\nThe dry season is the easy one. The green season is the cheap one, the properly green one, and the one almost nobody dares recommend. It depends on what you are coming to do.\n\nHere is the difference, month by month.',
   'Cuándo venir', 'When to come', '/blog/cuando-venir-a-la-fortuna'),

  (3, 15,
   '¿Armamos el viaje completo?',
   E'Si ya tenés fechas, podemos armarte el plan entero: dónde dormir, qué tours valen la pena para lo que te gusta, y cómo moverte entre uno y otro sin perder medio día.\n\nNo cobramos por eso.',
   'Shall we put the whole trip together?',
   E'If you already have dates, we can build the whole plan: where to stay, which tours are worth it for what you like, and how to get between them without losing half a day.\n\nWe do not charge for that.',
   'Armar mi viaje', 'Plan my trip', '#plan')
) as p(orden, dias, a_es, c_es, a_en, c_en, b_es, b_en, ruta)
on conflict (cadena_id, orden) do nothing;

-- ------------------------------------------------------------- PREMIUM
with c as (select id from destinos.dst_cadena where clave = 'premium'
            and destino_id = (select id from destinos.dst_destino where dominio='visitlafortunacr.com'))
insert into destinos.dst_cadena_paso
  (cadena_id, orden, dias_desde_alta, asunto_es, cuerpo_es, asunto_en, cuerpo_en,
   boton_texto_es, boton_texto_en, boton_ruta)
select c.id, p.orden, p.dias, p.a_es, p.c_es, p.a_en, p.c_en, p.b_es, p.b_en, p.ruta
  from c, (values
  (1, 1,
   'Tu ficha ya está viva',
   E'Tu negocio ya aparece en el directorio, en los cinco idiomas del sitio.\n\nDos cosas que valen la pena hacer hoy, y toman cinco minutos: subí fotos buenas (las fichas con fotos reales reciben bastantes más clics que las que no) y revisá que el horario y el teléfono estén al día.\n\nTodo se edita desde tu panel.',
   'Your listing is live',
   E'Your business is now in the directory, in all five languages of the site.\n\nTwo things worth doing today, and they take five minutes: upload good photos (listings with real photos get noticeably more clicks) and check that your hours and phone number are current.\n\nYou can edit everything from your panel.',
   'Ir a mi panel', 'Go to my panel', ''),

  (2, 4,
   'Quién está mirando tu ficha',
   E'Desde tu panel podés ver cuánta gente abrió tu ficha y cuántos pidieron tus datos para llamarte.\n\nEso último es lo que importa: son personas que estaban decidiendo y te eligieron a vos. Cada una queda con su nombre y su correo, para que les escribas.',
   'Who is looking at your listing',
   E'From your panel you can see how many people opened your listing and how many asked for your details to call you.\n\nThat last number is the one that matters: those are people who were deciding and picked you. Each one leaves their name and email so you can write to them.',
   'Ver mis números', 'See my numbers', ''),

  (3, 10,
   'Lo que hace la diferencia en el directorio',
   E'Una ficha gratis aparece. Una destacada se vende.\n\nSale primero en su categoría, lleva un cintillo naranja, tiene la foto a sangre arriba del todo y aparece en la portada. Además le hacemos un video y las historias para redes.\n\nEl precio de lanzamiento es para los primeros negocios, y los cupos se cuentan de verdad: en la página sale cuántos quedan.',
   'What makes the difference in the directory',
   E'A free listing shows up. A featured one sells.\n\nIt comes first in its category, carries an orange ribbon, has a full-width photo at the top and appears on the home page. We also make you a video and the social stories.\n\nThe launch price is for the first businesses, and the slots are counted for real: the page shows how many are left.',
   'Ver la oferta', 'See the offer', '/premium'),

  (4, 20,
   'Mirá cómo se ve una ficha destacada',
   E'Último correo sobre esto.\n\nEn la página de la oferta hay un ejemplo real: la misma ficha, con el video y la foto grande. Así se ve la diferencia mejor que explicándola.\n\nSi no es el momento, no pasa nada — tu ficha gratis se queda igual y seguís recibiendo los pedidos de contacto.',
   'See what a featured listing looks like',
   E'Last email about this.\n\nOn the offer page there is a real example: the same listing, with the video and the big photo. That shows the difference better than explaining it.\n\nIf now is not the moment, no problem — your free listing stays as it is and you keep getting contact requests.',
   'Ver el ejemplo', 'See the example', '/premium')
) as p(orden, dias, a_es, c_es, a_en, c_en, b_es, b_en, ruta)
on conflict (cadena_id, orden) do nothing;
