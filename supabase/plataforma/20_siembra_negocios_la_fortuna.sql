-- Plataforma de destinos | 20: llenar el directorio de La Fortuna
-- Punto 8 de la Fase MVP, el que la charla marco como el mas importante.
-- Pasa de 29 negocios publicados a unos 90.
--
-- De donde salen: los NOMBRES, la categoria y la zona se sacaron de los
-- listados publicos de Tripadvisor (atracciones, tours, hoteles y
-- restaurantes de La Fortuna). Eso son hechos y por eso se pueden usar. Los
-- textos de resumen y descripcion son PROPIOS, escritos aqui: copiar los
-- suyos seria, ademas de un problema con ellos, contenido duplicado, que es
-- justo lo que hunde la apuesta de SEO y GEO de la Fase 5.
--
-- Lo que NO trae este archivo, a proposito:
--   - Telefonos, correos y sitios web. No se inventan. Los rellena
--     lib/externas/ desde Google Places, que es la fuente correcta, junto con
--     las coordenadas, la nota y las resenas.
--   - Precios exactos. Cambian cada temporada; queda el rango.
-- Todo entra con estado_verificacion = 'pendiente' y fuente_dato =
-- 'siembra_manual': asi se sabe que falta repasar cuando lleguen los datos
-- buenos.
--
-- Correrlo dos veces no duplica nada: cada insert lleva su on conflict.

begin;

create temporary table _siembra (
  categoria     text not null,
  nombre        text not null,
  babosa        text not null,
  direccion     text,
  rango_precio  text,
  resumen_es    text not null,
  resumen_en    text not null,
  descripcion_es text not null,
  descripcion_en text not null,
  atributos     text not null default '{}'
) on commit drop;

insert into _siembra (categoria, nombre, babosa, direccion, rango_precio, resumen_es, resumen_en, descripcion_es, descripcion_en, atributos) values

-- ===========================================================================
-- QUE HACER · aguas termales
-- ===========================================================================

('aguas-termales','Los Lagos Hot Springs','los-lagos-hot-springs','Ruta 142, camino al volcan','moderado',
 'Complejo termal con toboganes, ranario y vista al volcan.',
 'Hot spring complex with slides, a frog farm and volcano views.',
 'Uno de los complejos mas grandes de la zona: varias pozas termales a distintas temperaturas, toboganes y piscinas frias, dentro del mismo terreno que el hotel. Tiene ademas un ranario y un criadero de cocodrilos que se visitan aparte. Funciona bien con ninos, porque no todo es quedarse quieto en el agua.',
 'One of the largest complexes in the area: several thermal pools at different temperatures, water slides and cold pools, on the same grounds as the hotel. It also has a frog farm and a crocodile hatchery you can visit separately. It works well with children, because not everything is sitting still in warm water.',
 '{"tiene_toboganes":true}'),

('aguas-termales','Kalambu Hot Springs','kalambu-hot-springs','Ruta 142, 3 km al oeste de La Fortuna','moderado',
 'Parque acuatico de agua termal, pensado para familias.',
 'A thermal water park built for families.',
 'Es el que eligen las familias con ninos: toboganes, rio lento y piscinas de agua termal a temperatura suave, con entrada por dia y opcion de dia completo con almuerzo. Menos bosque y mas parque acuatico que los demas de la lista, y esa es justamente la razon para venir o para saltarselo.',
 'The one families with children pick: slides, a lazy river and thermal pools at a mild temperature, with day passes and a full-day option including lunch. Less rainforest and more water park than the others on this list, which is exactly the reason to come or to skip it.',
 '{"apto_ninos":true}'),

('aguas-termales','Termales Los Laureles','termales-los-laureles','Ruta 142, camino al volcan','economico',
 'Termales sencillas y baratas, de las que usa la gente de aqui.',
 'Simple, cheap hot springs, the ones locals actually use.',
 'Pozas de agua termal sin spa, sin bar y sin show: un lugar familiar, tranquilo y de precio bajo, a un costado de la ruta al volcan. Es la opcion honesta cuando se quiere el agua caliente y no el resort alrededor.',
 'Thermal pools with no spa, no bar and no show: a quiet, family-run spot at a low price, just off the road to the volcano. It is the honest option when you want the hot water and not the resort around it.',
 '{}'),

('aguas-termales','Kuru Natural Springs','kuru-natural-springs','La Fortuna, camino al volcan','moderado',
 'Pozas termales pequenas, rodeadas de bosque.',
 'Small thermal pools surrounded by forest.',
 'Un complejo chico y reciente, con pozas de agua termal escalonadas entre jardines y bosque. Al ser mas pequeno que los grandes de la ruta, se siente menos lleno, sobre todo entre semana.',
 'A small, recent complex with terraced thermal pools among gardens and forest. Being smaller than the big names along the road, it feels less crowded, especially on weekdays.',
 '{}'),

('aguas-termales','El Chollin','el-chollin','Rio Tabacon, bajo el puente de la ruta 142','economico',
 'El rio termal gratuito. Sin entrada, sin horario y sin vigilancia.',
 'The free thermal river. No ticket, no opening hours, no supervision.',
 'El tramo del rio Tabacon que baja caliente desde el volcan y pasa bajo el puente de la ruta. Es gratis y es donde va la gente de la zona. No hay casilleros, ni bano, ni socorrista: las piedras resbalan, la corriente sube con las lluvias y no conviene dejar nada en la orilla. Con esas advertencias, es de las mejores cosas que se hacen aqui sin pagar.',
 'The stretch of the Tabacon river that runs hot down from the volcano and passes under the road bridge. It is free, and it is where locals go. There are no lockers, no bathrooms and no lifeguard: the rocks are slippery, the current rises with the rain, and you should not leave anything on the bank. With those warnings, it is one of the best things you can do here without paying.',
 '{"acceso":"gratuito","sin_servicios":true}'),

('aguas-termales','Kenko Hot Springs','kenko-hot-springs','La Fortuna centro','economico',
 'Termales pequenas con restaurante, cerca del pueblo.',
 'Small hot springs with a restaurant, close to town.',
 'Pozas termales con restaurante en el mismo sitio, a pocos minutos del centro. Sirve para una tarde corta sin salir a la ruta del volcan, y para comer sin tener que volver al pueblo.',
 'Thermal pools with a restaurant on site, a few minutes from the centre of town. Good for a short afternoon without driving out along the volcano road, and for eating without heading back into town.',
 '{"tiene_restaurante":true}'),

-- ===========================================================================
-- QUE HACER · volcan, cataratas y senderos
-- ===========================================================================

('volcan','Arenal 1968 Volcano View & Trails','arenal-1968','Ruta 142, entrada al sector del volcan','economico',
 'Senderos sobre la colada de la erupcion de 1968.',
 'Trails over the lava flow of the 1968 eruption.',
 'Finca privada al pie del volcan, sobre el campo de lava que dejo la erupcion de 1968, la que cambio la historia de La Fortuna. Dos senderos, uno corto y uno largo, con miradores hacia el cono y hacia la laguna. Es el lugar donde mejor se entiende la escala de lo que paso.',
 'A private farm at the foot of the volcano, on the lava field left by the 1968 eruption, the one that changed the history of La Fortuna. Two trails, one short and one long, with viewpoints over the cone and the lagoon. It is the place where the scale of what happened makes the most sense.',
 '{"erupcion":"1968"}'),

('volcan','Mirador El Silencio','mirador-el-silencio','Ruta 142, sector oeste del volcan','economico',
 'Senderos y mirador en la ladera oeste, con poca gente.',
 'Trails and a viewpoint on the western slope, with few people.',
 'Reserva privada con senderos que suben por antiguas coladas hasta un mirador frente al cono. Recibe menos visitantes que el parque nacional, asi que es de los mejores sitios para ver el volcan sin fila y para escuchar el bosque.',
 'A private reserve with trails climbing over old lava flows to a viewpoint facing the cone. It gets fewer visitors than the national park, so it is one of the best places to see the volcano without a queue, and to actually hear the forest.',
 '{}'),

('cataratas','El Salto','el-salto','Camino a Chachagua, a la salida de La Fortuna','economico',
 'Poza de rio con una cuerda para saltar. Gratis y muy local.',
 'A river pool with a rope swing. Free, and very local.',
 'Una poza del rio a las afueras del pueblo, con una cuerda colgada de un arbol de la que se tira todo el mundo. No es una catarata de postal ni pretende serlo: es donde van los jovenes de La Fortuna un domingo. Sin entrada y sin servicios; hay que fijarse en la profundidad antes de saltar.',
 'A river pool on the edge of town with a rope hanging from a tree that everyone swings from. It is not a postcard waterfall and does not pretend to be: it is where young people from La Fortuna go on a Sunday. No entry fee and no facilities; check the depth before you jump.',
 '{"acceso":"gratuito"}'),

-- ===========================================================================
-- QUE HACER · vida silvestre
-- ===========================================================================

('vida-silvestre','Bogarin Trail','bogarin-trail','La Fortuna centro, 500 m del parque','economico',
 'Perezosos a pie, a cinco minutos del parque del pueblo.',
 'Sloths on foot, five minutes from the town park.',
 'Una finca recuperada en pleno pueblo que hoy es uno de los sitios mas seguros para ver perezosos de dos y tres dedos sin salir a la carretera. Los senderos son planos y cortos, y los guias trabajan con telescopio: la diferencia entre ver un perezoso y no verlo suele ser el guia.',
 'A regenerated farm inside the town that is now one of the surest places to see two- and three-toed sloths without driving anywhere. The trails are short and flat, and the guides work with a spotting scope: the difference between seeing a sloth and not seeing one is usually the guide.',
 '{"fauna":["perezoso","tucan","rana"]}'),

('vida-silvestre','Proyecto Asis','proyecto-asis','Javillos de Florencia, 25 km de La Fortuna','moderado',
 'Centro de rescate de fauna que ademas recibe voluntarios.',
 'A wildlife rescue centre that also takes volunteers.',
 'Centro de rescate que recibe animales decomisados o entregados, con visitas guiadas donde se explica de donde vino cada uno y por que muchos ya no pueden volver al bosque. Tiene programa de voluntariado de medio dia en adelante. Queda a media hora del pueblo, camino a Ciudad Quesada.',
 'A rescue centre that takes in confiscated or surrendered animals, with guided visits explaining where each one came from and why many can no longer go back to the forest. It runs a volunteering programme from half a day upwards. It is half an hour from town, on the road to Ciudad Quesada.',
 '{"es_rescate":true}'),

('vida-silvestre','Monkey Park La Fortuna','monkey-park-la-fortuna','La Fortuna','moderado',
 'Refugio de monos y fauna rescatada, con visita guiada.',
 'A refuge for monkeys and rescued wildlife, with a guided visit.',
 'Refugio dedicado sobre todo a monos rescatados, con recorrido guiado y explicacion del trabajo de rehabilitacion. Visita corta, buena con ninos y con lluvia.',
 'A refuge focused mainly on rescued monkeys, with a guided walk and an explanation of the rehabilitation work. A short visit, good with children and good in the rain.',
 '{"es_rescate":true}'),

('vida-silvestre','Parque Eco Natura Costa Rica','parque-eco-natura','La Fortuna','moderado',
 'Mariposario, ranario y serpientes en una sola visita.',
 'Butterflies, frogs and snakes in a single visit.',
 'Parque tematico de naturaleza con mariposario, ranario, serpentario y senderos cortos. Es de las opciones mas comodas para ver de cerca lo que en el bosque cuesta encontrar, y funciona bien de noche, cuando las ranas estan activas.',
 'A nature park with a butterfly house, frog house, snake exhibit and short trails. One of the easiest ways to see up close what is hard to find in the forest, and it works well at night, when the frogs are active.',
 '{}'),

-- ===========================================================================
-- QUE HACER · aventura
-- ===========================================================================

('canopy','Ecoglide Arenal Park','ecoglide-arenal-park','Ruta 142, camino al volcan','moderado',
 'Canopy de trece cables con vista al volcan y al lago.',
 'A thirteen-cable zip line with volcano and lake views.',
 'Circuito de canopy sobre el dosel con vista al cono y al lago, freno automatico en cada cable y un puente tibetano en el recorrido. De los mas directos de la zona: se llega, se vuela y se vuelve, sin un dia entero comprometido.',
 'A zip line circuit over the canopy with views of the cone and the lake, automatic braking on every cable and a suspension bridge along the way. One of the most straightforward in the area: you arrive, you fly and you leave, without committing a whole day.',
 '{"cables":13}'),

('canyoning','La Roca Canyoning','la-roca-canyoning','La Fortuna','alto',
 'Rappel por cascadas dentro del canon, con equipo y guia.',
 'Rappelling down waterfalls inside the canyon, gear and guide included.',
 'Descenso de canon con rappel por cascadas, con equipo completo y guias certificados. No hace falta experiencia previa, pero si aguantar el frio del agua y la altura del primer rappel, que es el que asusta.',
 'A canyon descent rappelling down waterfalls, with full gear and certified guides. No previous experience is needed, but you do need to handle the cold water and the height of the first rappel, which is the one that scares people.',
 '{}'),

('cuadraciclos','The Jungle Tours','the-jungle-tours','La Fortuna','moderado',
 'Cuadraciclos por caminos de finca y cauces de rio.',
 'ATV rides along farm tracks and river beds.',
 'Salidas guiadas en cuadraciclo por caminos de tierra, fincas y vados del rio, con paradas para mirar el volcan. Se sale embarrado, que es parte del asunto. Hay opcion de conductor acompanante para quien no quiere manejar.',
 'Guided ATV rides along dirt roads, farms and river crossings, with stops to look at the volcano. You come back muddy, which is part of the deal. There is a passenger option for anyone who would rather not drive.',
 '{}'),

-- ===========================================================================
-- QUE HACER · cafe y chocolate
-- ===========================================================================

('cafe-y-chocolate','North Fields Cafe','north-fields-cafe','La Fortuna','moderado',
 'Tour de cafe, cacao y cana de azucar en una finca familiar.',
 'A coffee, cacao and sugar cane tour on a family farm.',
 'Recorrido por una finca familiar donde se ve el proceso completo: el grano en el arbol, el tueste, la mazorca de cacao abierta y la cana molida en trapiche. Termina con cata de cafe y chocolate hecho ahi mismo. Dura unas dos horas y funciona muy bien con lluvia.',
 'A walk through a family farm where you see the whole process: the bean on the tree, the roast, the cacao pod opened, the cane pressed in a mill. It ends with a tasting of coffee and chocolate made on site. It lasts about two hours and works very well in the rain.',
 '{}'),

('cafe-y-chocolate','Don Juan Coffee & Chocolate Tour','don-juan-coffee-chocolate-tour','La Fortuna centro','moderado',
 'El clasico de cafe y chocolate, a pie desde el pueblo.',
 'The classic coffee and chocolate tour, walkable from town.',
 'De los tours mas hechos de La Fortuna, y por algo: explica bien, deja probar todo y queda cerca del centro. Cafe, cacao, cana y un poco de cocina tipica en el mismo recorrido.',
 'One of the most popular tours in La Fortuna, and with reason: it explains things well, lets you taste everything, and it is close to the centre. Coffee, cacao, cane and a bit of local cooking in the same visit.',
 '{}'),

('cafe-y-chocolate','Don Olivo Chocolate Tour','don-olivo-chocolate-tour','La Fortuna','economico',
 'Tour de chocolate en finca, chico y familiar.',
 'A small, family-run chocolate farm tour.',
 'Finca familiar con un recorrido corto y sin guion aprendido: la familia explica el cacao, lo abre, lo tuesta y lo muele delante de uno. Grupos pequenos y precio bajo.',
 'A family farm with a short tour and no rehearsed script: the family explains the cacao, opens it, roasts it and grinds it in front of you. Small groups and a low price.',
 '{}'),

-- ===========================================================================
-- EXPLORAR · atracciones
-- ===========================================================================

('atracciones','Cavernas de Venado','cavernas-de-venado','Venado de San Carlos, 45 km de La Fortuna','moderado',
 'Cuevas de caliza de millones de anos. Se entra con casco y agua al tobillo.',
 'Limestone caves millions of years old. Helmet on, ankle-deep water.',
 'Un sistema de cuevas de caliza formado por un rio subterraneo, con estalactitas, formaciones con nombre propio y murcielagos. Se entra con casco, foco y botas, y se sale mojado y sucio. No es para quien sufre con los espacios estrechos: hay pasos donde toca agacharse y apretarse.',
 'A limestone cave system carved by an underground river, with stalactites, named formations and bats. You go in with a helmet, a torch and boots, and you come out wet and dirty. Not for anyone who struggles with tight spaces: there are passages where you have to crouch and squeeze.',
 '{"apto_claustrofobia":false}'),

('atracciones','Lago Arenal','lago-arenal','Represa del Arenal, 20 km al oeste','economico',
 'El lago artificial mas grande del pais, al pie del volcan.',
 'The largest artificial lake in the country, at the foot of the volcano.',
 'El embalse que en 1979 inundo dos pueblos y hoy genera buena parte de la electricidad del pais. Se recorre por la carretera de la orilla, con miradores hacia el volcan, y se navega en kayak, en catamaran o cruzandolo hacia Monteverde. Los vientos de la tarde en la punta oeste son de los mejores del mundo para windsurf.',
 'The reservoir that flooded two villages in 1979 and today generates a good share of the country electricity. You drive its shore road, with viewpoints towards the volcano, and you get on the water by kayak, by catamaran, or crossing it on the way to Monteverde. The afternoon winds at the western end are among the best in the world for windsurfing.',
 '{}'),

-- ===========================================================================
-- DONDE DORMIR
-- ===========================================================================

('hospedaje-lujo','Nayara Springs','nayara-springs','Ruta 142, camino al volcan','lujo',
 'Villas solo para adultos, cada una con su piscina termal.',
 'Adults-only villas, each with its own thermal plunge pool.',
 'Villas independientes sobre pilotes dentro del bosque, cada una con piscina alimentada por agua termal y vista al volcan. Solo adultos. Es de los hospedajes mas premiados del pais y el precio va acorde.',
 'Free-standing villas on stilts inside the forest, each with a plunge pool fed by thermal water and a view of the volcano. Adults only. It is one of the most awarded stays in the country, and the price matches.',
 '{"solo_adultos":true}'),

('hospedaje-lujo','Nayara Tented Camp','nayara-tented-camp','Ruta 142, camino al volcan','lujo',
 'Tiendas de lujo sobre la ladera, con aguas termales propias.',
 'Luxury tents on the hillside, with their own hot springs.',
 'Glamping de gama alta: tiendas amplias sobre plataformas, con terraza, piscina propia en varias de ellas y acceso a las aguas termales del complejo. Comparte finca con los otros hoteles Nayara y con un proyecto de reforestacion donde se ven perezosos.',
 'High-end glamping: large tents on platforms, with a terrace, a private pool in several of them, and access to the hot springs on the property. It shares grounds with the other Nayara hotels and with a reforestation project where sloths are regularly seen.',
 '{}'),

('hospedaje-lujo','Amor Arenal','amor-arenal','Ruta 142, camino al volcan','lujo',
 'Solo adultos, casitas con jacuzzi y vista despejada al cono.',
 'Adults only, casitas with a hot tub and a clear view of the cone.',
 'Hotel de casitas independientes frente al volcan, solo para adultos, con jacuzzi privado en la terraza de varias de ellas. Tranquilo y sin ninos, que es exactamente lo que busca quien viene aqui.',
 'A hotel of free-standing casitas facing the volcano, adults only, several with a private hot tub on the terrace. Quiet and child-free, which is exactly what people come here for.',
 '{"solo_adultos":true}'),

('resorts','The Royal Corin Thermal Water Spa & Resort','royal-corin','Ruta 142, camino al volcan','alto',
 'Resort solo para adultos con piscinas termales y spa.',
 'An adults-only resort with thermal pools and a spa.',
 'Resort de linea moderna, solo adultos, con piscinas de agua termal a distintas temperaturas, bar dentro del agua y spa. Queda sobre la ruta al volcan, con vista al cono desde las habitaciones del frente.',
 'A modern adults-only resort with thermal pools at different temperatures, a swim-up bar and a spa. It sits on the volcano road, with views of the cone from the front rooms.',
 '{"solo_adultos":true}'),

('resorts','Arenal Manoa Hot Spring Resort','arenal-manoa','Ruta 142, camino al volcan','alto',
 'Habitaciones en finca lechera, con termales y vista frontal al volcan.',
 'Rooms on a working dairy farm, with hot springs and a full volcano view.',
 'Hotel dentro de una finca lechera en activo, con una de las vistas mas limpias al cono y aguas termales propias. Se puede ordenar las vacas por la manana, que es el tipo de cosa que no aparece en el folleto de un resort.',
 'A hotel on a working dairy farm, with one of the cleanest views of the cone and its own hot springs. You can join the morning milking, which is the sort of thing a resort brochure does not usually offer.',
 '{}'),

('resorts','Los Lagos Hotel Spa & Resort','los-lagos-hotel-spa-resort','Ruta 142, camino al volcan','alto',
 'Resort grande con termales, toboganes y fauna en el terreno.',
 'A large resort with hot springs, slides and wildlife on the grounds.',
 'El hotel del mismo complejo de las termales Los Lagos: habitaciones repartidas en un terreno grande, con acceso a las pozas, los toboganes, el ranario y el criadero de cocodrilos. Conviene para familias que quieren no salir del hotel en todo un dia.',
 'The hotel attached to the Los Lagos hot springs: rooms spread over large grounds, with access to the pools, the slides, the frog farm and the crocodile hatchery. Good for families who want to spend a whole day without leaving the property.',
 '{}'),

('hoteles','Volcano Lodge, Hotel & Thermal Experience','volcano-lodge','Ruta 142, camino al volcan','alto',
 'Vista frontal al volcan y circuito de aguas termales propio.',
 'A head-on volcano view and its own hot spring circuit.',
 'Hotel de habitaciones bajas repartidas en jardines, con el cono justo enfrente y un circuito termal propio. De los que mejor resuelven la ecuacion vista, termales y precio sin entrar en la gama de lujo.',
 'A hotel of low-rise rooms set in gardens, with the cone right in front and its own thermal circuit. One of the best at solving the view-hot springs-price equation without moving into the luxury bracket.',
 '{}'),

('hoteles','Hotel Lomas del Volcan','lomas-del-volcan','Ruta 142, camino al volcan','alto',
 'Cabinas separadas con vista al cono desde la terraza.',
 'Separate cabins with a view of the cone from the porch.',
 'Cabinas independientes repartidas en una finca con el volcan de frente, cada una con su terraza. Sin pasillos ni vecinos pared con pared, que es la razon por la que la gente repite.',
 'Free-standing cabins spread over a farm facing the volcano, each with its own porch. No corridors and no neighbours through the wall, which is why people come back.',
 '{}'),

('hoteles','Hotel El Silencio del Campo','el-silencio-del-campo','Ruta 142, camino al volcan','alto',
 'Cabinas en finca con termales propias y vista al volcan.',
 'Farm cabins with their own hot springs and a volcano view.',
 'Finca con cabinas de madera, pozas termales propias y animales de granja en el terreno. Familiar, tranquilo y con una de las mejores vistas al cono de todo el corredor.',
 'A farm with wooden cabins, its own thermal pools and farm animals on the grounds. Family-friendly, quiet, and with one of the best views of the cone along the whole corridor.',
 '{}'),

('hoteles','Hotel Montana de Fuego','montana-de-fuego','Ruta 142, camino al volcan','alto',
 'Bungalows frente al volcan, con spa y restaurante.',
 'Bungalows facing the volcano, with a spa and restaurant.',
 'Bungalows de madera en jardines amplios mirando al cono, con spa, piscina y restaurante propio. Una de las opciones clasicas del corredor entre el pueblo y el volcan.',
 'Wooden bungalows in large gardens looking at the cone, with a spa, a pool and its own restaurant. One of the classic options along the corridor between town and volcano.',
 '{}'),

('hoteles','Hotel Magic Mountain','magic-mountain','La Fortuna, salida al volcan','moderado',
 'Vista al volcan a pocos minutos del centro, a pie.',
 'A volcano view a few minutes walk from the centre.',
 'Hotel sobre una loma a la salida del pueblo: tiene vista al cono y al mismo tiempo se llega caminando a los restaurantes del centro, combinacion poco comun por aqui. Piscina con vista y habitaciones amplias.',
 'A hotel on a rise at the edge of town: it has a view of the cone and is still within walking distance of the restaurants in the centre, a combination that is rare here. Pool with a view and large rooms.',
 '{}'),

('hoteles','Hotel Secreto La Fortuna','hotel-secreto-la-fortuna','La Fortuna centro','moderado',
 'Hotel pequeno y silencioso en pleno centro.',
 'A small, quiet hotel right in the centre.',
 'Hotel chico a pasos del parque, con patio interior y habitaciones tranquilas pese a estar en el centro. Practico para quien anda sin carro: todo queda caminando.',
 'A small hotel steps from the park, with an inner courtyard and quiet rooms despite being downtown. Practical if you have no car: everything is walkable.',
 '{}'),

('hoteles','Casa Luna Hotel & Spa','casa-luna','Ruta 142, camino al volcan','alto',
 'Jardines, spa y vista al volcan a medio camino del pueblo.',
 'Gardens, a spa and a volcano view halfway from town.',
 'Hotel de jardines cuidados con spa y piscina, entre el pueblo y el volcan. Ambiente tranquilo y de pareja, sin llegar a ser solo adultos.',
 'A hotel with well-kept gardens, a spa and a pool, between town and the volcano. A quiet, couple-friendly feel, without being adults-only.',
 '{}'),

('hoteles','Arenal Montechiari Hotel','arenal-montechiari','Ruta 142, camino al volcan','moderado',
 'Cabinas sencillas en finca, con el volcan enfrente.',
 'Simple farm cabins with the volcano in front.',
 'Cabinas sencillas y limpias repartidas en una finca con vista despejada al cono, a precio moderado. Sin lujos y sin pretensiones: se paga la vista y la tranquilidad.',
 'Simple, clean cabins spread over a farm with an unobstructed view of the cone, at a moderate price. No luxuries and no pretence: you are paying for the view and the quiet.',
 '{}'),

('hoteles','Hotel Roca Negra del Arenal','roca-negra-del-arenal','Ruta 142, camino al volcan','alto',
 'Bungalows sobre la antigua colada de lava.',
 'Bungalows on the old lava flow.',
 'Bungalows construidos sobre terreno de lava vieja, con jardines, piscina y vista al volcan. Tranquilo, alejado del ruido del pueblo y con bastante fauna en el terreno.',
 'Bungalows built on old lava ground, with gardens, a pool and a volcano view. Quiet, away from the noise of town, and with plenty of wildlife on the property.',
 '{}'),

('hoteles','Hotel Lavas Tacotal','lavas-tacotal','Ruta 142, camino al volcan','moderado',
 'Habitaciones entre jardines, junto a un rio, con vista al cono.',
 'Rooms among gardens, beside a river, with a view of the cone.',
 'Hotel de jardines grandes junto a un rio, con piscina y vista al volcan. Precio moderado para lo que ofrece el corredor, y buena opcion con ninos.',
 'A hotel with large gardens beside a river, with a pool and a volcano view. Moderately priced for what this corridor usually costs, and a good option with children.',
 '{}'),

('lodges','La Fortuna Lodge','la-fortuna-lodge','La Fortuna, junto al rio','alto',
 'Lodge junto al rio, entre el pueblo y el bosque.',
 'A riverside lodge, between town and forest.',
 'Lodge de habitaciones amplias junto al rio, con jardines y bastante vegetacion alrededor. Queda cerca del pueblo sin estar dentro, que para muchos es el punto justo.',
 'A lodge of large rooms beside the river, with gardens and plenty of vegetation around. Close to town without being in it, which for many is the right balance.',
 '{}'),

('lodges','Arenal Oasis Eco Lodge & Wildlife Refuge','arenal-oasis','La Fortuna, 2 km del centro','moderado',
 'Cabinas familiares y uno de los mejores tours nocturnos de ranas.',
 'Family-run cabins and one of the best night frog tours.',
 'Lodge familiar de cabinas de madera con un refugio de fauna en el mismo terreno. Su tour nocturno de ranas es de los mas reconocidos de la zona: la familia lleva anos sembrando el jardin para que las ranas vengan solas.',
 'A family-run lodge of wooden cabins with a wildlife refuge on the same grounds. Its night frog tour is one of the best known in the area: the family has spent years planting the garden so the frogs come on their own.',
 '{}'),

('lodges','Sangregado Lodge','sangregado-lodge','Cerca de la represa del Arenal','alto',
 'Lodge junto al lago, con senderos y mucha fauna.',
 'A lodge by the lake, with trails and abundant wildlife.',
 'Lodge cerca de la represa, con senderos propios, bosque y salida al lago. Mas orientado a quien viene por los pajaros y la caminata que por el spa.',
 'A lodge near the dam, with its own trails, forest and access to the lake. Aimed more at people who come for the birds and the walking than for a spa.',
 '{}'),

('lodges','Tifakara Boutique Lodge','tifakara-lodge','La Fortuna, zona de lagunas','alto',
 'Lodge pequeno junto a lagunas, bueno para aves.',
 'A small lodge beside lagoons, good for birds.',
 'Lodge chico junto a unas lagunas, rodeado de bosque y con mucha ave. Silencioso y sin las multitudes del corredor principal.',
 'A small lodge next to a set of lagoons, surrounded by forest and full of birds. Quiet, and without the crowds of the main corridor.',
 '{}'),

('lodges','Noahs Forest Hotel','noahs-forest','La Fortuna, zona de bosque','alto',
 'Habitaciones dentro del bosque, con restaurante propio.',
 'Rooms inside the forest, with its own restaurant.',
 'Hotel metido en el bosque, con habitaciones discretas, senderos y restaurante propio. La idea es despertarse con el ruido de los monos y no con el de la ruta.',
 'A hotel set inside the forest, with understated rooms, trails and its own restaurant. The idea is to wake up to howler monkeys rather than to the road.',
 '{}'),

('cabinas','Casa del Rio','casa-del-rio','La Fortuna, junto al rio','economico',
 'Hospedaje sencillo junto al rio, a pasos del centro.',
 'Simple lodging by the river, steps from the centre.',
 'Hospedaje sencillo y limpio junto al rio, caminando al centro. De las opciones honestas de precio bajo en un pueblo donde casi todo apunta al resort.',
 'Simple, clean lodging by the river, within walking distance of the centre. One of the honest low-price options in a town where almost everything points at resorts.',
 '{}'),

-- ===========================================================================
-- COMER Y BEBER
-- ===========================================================================

('comida-tipica','Soda Viquez','soda-viquez','La Fortuna centro','economico',
 'Casado, gallo pinto y precio de soda de pueblo.',
 'Casado, gallo pinto and small-town soda prices.',
 'Soda de toda la vida en el centro: casados, gallo pinto, olla de carne y refrescos naturales, a precio de gente de aqui y no de turista. Porciones grandes y servicio rapido.',
 'A long-standing soda in the centre: casados, gallo pinto, olla de carne and fresh fruit drinks, at local prices rather than tourist ones. Big portions and quick service.',
 '{}'),

('comida-tipica','Soda El Turnito','soda-el-turnito','La Fortuna centro','economico',
 'Soda chica, comida tipica y desayuno temprano.',
 'A small soda, local food and early breakfast.',
 'Soda pequena de barrio, con desayuno temprano y casados al mediodia. Nada de carta larga: se come lo que hay, que es de lo que se trata.',
 'A small neighbourhood soda, with early breakfast and casados at midday. No long menu: you eat what there is, which is rather the point.',
 '{}'),

('comida-tipica','Soda y Restaurante Rodriguez','soda-rodriguez','La Fortuna centro','economico',
 'Comida tipica con opciones livianas, cerca del parque.',
 'Local food with lighter options, near the park.',
 'Comida costarricense de siempre con algunas opciones mas livianas, a pocos pasos del parque. Buena parada de mediodia sin gastar.',
 'Traditional Costa Rican food with some lighter options, a few steps from the park. A good midday stop without spending much.',
 '{}'),

('comida-tipica','Restaurante Tiquicia La Fortuna','restaurante-tiquicia','La Fortuna centro','moderado',
 'Cocina tipica en version de restaurante, no de soda.',
 'Local cooking, restaurant version rather than soda.',
 'Cocina costarricense servida como restaurante: mismos platos de siempre, mejor presentados y con mas espacio. Buena puerta de entrada para quien nunca ha comido tipico.',
 'Costa Rican cooking served as a restaurant: the same dishes as always, better presented and with more room. A good entry point for anyone who has never eaten local food here.',
 '{}'),

('comida-tipica','Restaurante Fortuneno','restaurante-fortuneno','La Fortuna centro','moderado',
 'Carta amplia, tipico y americano, en pleno centro.',
 'A broad menu, local and American, right in the centre.',
 'Restaurante de carta amplia en el centro, entre lo tipico y lo internacional. Resuelve bien la cena de un grupo donde cada quien quiere algo distinto.',
 'A restaurant with a broad menu in the centre, between local and international. It solves dinner for a group where everyone wants something different.',
 '{}'),

('comida-tipica','Dmi Tierra Comida Tipica','dmi-tierra','La Fortuna centro','economico',
 'Tipico y sabor caribeno en la misma carta.',
 'Local food with a Caribbean streak on the same menu.',
 'Comida tipica con platos de la costa caribena, que no es lo habitual en esta zona. Porciones generosas y precio bajo.',
 'Local food with dishes from the Caribbean coast, which is not common in this area. Generous portions and low prices.',
 '{}'),

('comida-tipica','Tica Grill','tica-grill','La Fortuna centro','moderado',
 'Parrilla tica: carnes, casados y platos para compartir.',
 'Costa Rican grill: meats, casados and plates to share.',
 'Parrilla de cocina tica con carnes a la brasa y platos para compartir. Ambiente informal y buen punto medio de precio en el centro.',
 'A Costa Rican grill with barbecued meats and sharing plates. Informal, and a good middle price point in the centre.',
 '{}'),

('cocina-internacional','Maria Bonita Steak House','maria-bonita-steak-house','La Fortuna centro','alto',
 'Cortes de carne y algunos platos libaneses.',
 'Steak cuts, plus a few Lebanese dishes.',
 'Casa de carnes con cortes al grill y una parte de la carta con platos libaneses, mezcla poco comun que le funciona. De las cenas mas formales del pueblo.',
 'A steak house with grilled cuts and a section of the menu with Lebanese dishes, an unusual mix that works. One of the more formal dinners in town.',
 '{}'),

('cocina-internacional','Restaurante Travesia','restaurante-travesia','La Fortuna centro','moderado',
 'Cocina latina e internacional, ambiente tranquilo.',
 'Latin and international cooking, a calm room.',
 'Restaurante de cocina latina e internacional, con ambiente mas tranquilo que el de la calle principal. Buena opcion para cenar sin ruido.',
 'A restaurant of Latin and international cooking, with a calmer room than the main street offers. A good option for a quiet dinner.',
 '{}'),

('cocina-internacional','Bosque Restaurant','bosque-restaurant','La Fortuna','alto',
 'Cocina de autor con producto local.',
 'Chef-driven cooking with local produce.',
 'Cocina de fusion con producto de la zona, carta corta y platos mas trabajados que el promedio del pueblo. Para una cena que se quiere que cuente.',
 'Fusion cooking with local produce, a short menu and more worked-through dishes than the town average. For a dinner meant to count.',
 '{}'),

('cocina-internacional','Jalapas Restaurant','jalapas-restaurant','La Fortuna centro','moderado',
 'Carta latina e internacional en la calle principal.',
 'Latin and international menu on the main street.',
 'Restaurante de carta variada sobre la calle principal, con platos latinos e internacionales. Practico, central y sin sorpresas.',
 'A varied menu on the main street, with Latin and international dishes. Practical, central and with no surprises.',
 '{}'),

('cocina-internacional','Chifa La Familia Feliz','chifa-la-familia-feliz','La Fortuna centro','moderado',
 'Cocina chifa: peruana con raiz china.',
 'Chifa cooking: Peruvian with Chinese roots.',
 'Chifa, la cocina peruana de raiz china, en un pueblo donde casi todo es tipico o internacional generico. Arroz chaufa, lomo saltado y porciones grandes.',
 'Chifa, the Chinese-rooted Peruvian kitchen, in a town where almost everything is either local or generic international. Arroz chaufa, lomo saltado and big portions.',
 '{}'),

('cocina-internacional','Kappa Sushi Fortuna','kappa-sushi-fortuna','La Fortuna centro','moderado',
 'Sushi en el centro, para cuando ya se comio suficiente casado.',
 'Sushi in the centre, for when you have had enough casado.',
 'Sushi y cocina japonesa en pleno centro. No es la razon para venir a La Fortuna, pero al cuarto dia de arroz con frijoles se agradece que exista.',
 'Sushi and Japanese cooking right in the centre. Not the reason to come to La Fortuna, but on the fourth day of rice and beans you are glad it exists.',
 '{}'),

('cocina-internacional','Que Rico Arenal','que-rico-arenal','La Fortuna centro','moderado',
 'Pizza y pasta, buena parada con ninos.',
 'Pizza and pasta, a good stop with children.',
 'Pizzeria y cocina italiana sencilla en el centro. De las paradas mas seguras cuando se anda con ninos cansados.',
 'A pizzeria and simple Italian cooking in the centre. One of the safest stops when you are travelling with tired children.',
 '{}'),

('cocina-internacional','Restaurante Marisqueria Rojo Coral','rojo-coral','La Fortuna centro','moderado',
 'Marisco y carnes, lejos del mar pero bien resuelto.',
 'Seafood and meat, far from the coast but well done.',
 'Marisqueria con carta de pescado y carnes. Estamos a tres horas de las dos costas, asi que conviene preguntar que llego fresco ese dia.',
 'A seafood place with a menu of fish and meat. We are three hours from either coast, so it is worth asking what came in fresh that day.',
 '{}'),

('saludable','Chante Verde','chante-verde','La Fortuna centro','moderado',
 'Cocina saludable y opciones vegetarianas de verdad.',
 'Healthy cooking and real vegetarian options.',
 'Cocina saludable con opciones vegetarianas y veganas que no son una guarnicion disfrazada de plato principal. Desayunos y almuerzos livianos.',
 'Healthy cooking with vegetarian and vegan options that are not a side dish dressed up as a main. Light breakfasts and lunches.',
 '{"opciones_vegetarianas":true}'),

('saludable','Cuenca Restaurante','cuenca-restaurante','La Fortuna centro','moderado',
 'Platos latinos en version liviana.',
 'Latin dishes in a lighter register.',
 'Cocina latina con carta liviana: bowls, ensaladas y platos sin la pesadez del casado clasico. Util a mitad de un dia de tours.',
 'Latin cooking with a light menu: bowls, salads and dishes without the weight of a classic casado. Useful in the middle of a day of tours.',
 '{"opciones_vegetarianas":true}'),

('cafeterias','Acacia Restaurant','acacia-restaurant','La Fortuna, zona de bosque','alto',
 'Desayuno y cocina saludable dentro del bosque.',
 'Breakfast and healthy cooking inside the forest.',
 'Restaurante dentro del hotel del bosque, con desayunos y carta saludable, abierto tambien a quien no se hospeda. Se come mirando arboles y no la calle.',
 'The restaurant inside the forest hotel, with breakfasts and a healthy menu, open to non-guests too. You eat looking at trees rather than at the street.',
 '{}'),

('bares','Selva Negra Cocktail & Wine Bar','selva-negra-bar','La Fortuna centro','alto',
 'Cocteleria y vinos, de lo poco que hay de noche.',
 'Cocktails and wine, one of the few late options.',
 'Bar de cocteles y vinos en el centro, con carta trabajada. La Fortuna se acuesta temprano, asi que es de los pocos sitios para alargar la noche sin que sea un bar deportivo.',
 'A cocktail and wine bar in the centre, with a thought-out list. La Fortuna goes to bed early, so it is one of the few places to stretch the night out that is not a sports bar.',
 '{}');

-- ---------------------------------------------------------------------------
-- Los negocios. La descripcion en espanol va en la fila porque es el idioma
-- principal de La Fortuna; el ingles baja a dst_traduccion mas abajo.
-- ---------------------------------------------------------------------------

insert into destinos.dst_negocio (
  destino_id, categoria_id, nombre, babosa, resumen, descripcion, direccion,
  rango_precio, estado_publicacion, estado_verificacion, fuente_dato,
  atributos, publicado_en
)
select d.id, c.id, s.nombre, s.babosa, s.resumen_es, s.descripcion_es, s.direccion,
       s.rango_precio::destinos.rango_precio,
       'publicado'::destinos.estado_publicacion,
       'pendiente'::destinos.estado_verificacion,
       'siembra_manual'::destinos.fuente_dato,
       s.atributos::jsonb, now()
  from _siembra s
  join destinos.dst_destino   d on d.babosa = 'la-fortuna'
  join destinos.dst_categoria c on c.babosa = s.categoria
on conflict (destino_id, babosa) do nothing;

-- ---------------------------------------------------------------------------
-- El ingles. esta_revisada = false: nadie del equipo lo ha leido todavia.
-- ---------------------------------------------------------------------------

insert into destinos.dst_traduccion (entidad, entidad_id, campo, idioma, texto, origen, esta_revisada)
select 'negocio', n.id, t.campo, 'en', t.texto, 'importado', false
  from _siembra s
  join destinos.dst_destino d on d.babosa = 'la-fortuna'
  join destinos.dst_negocio n on n.destino_id = d.id and n.babosa = s.babosa
  cross join lateral (values ('resumen', s.resumen_en), ('descripcion', s.descripcion_en)) as t(campo, texto)
on conflict (entidad, entidad_id, campo, idioma) do nothing;

-- ---------------------------------------------------------------------------
-- Las rutas. Misma babosa en los dos idiomas, como las 29 que ya estaban: se
-- traducen despues, y cuando se traduzcan basta cambiar la fila de dst_ruta.
-- ---------------------------------------------------------------------------

insert into destinos.dst_ruta (destino_id, entidad, entidad_id, idioma, babosa)
select d.id, 'negocio', n.id, i.codigo, s.babosa
  from _siembra s
  join destinos.dst_destino d on d.babosa = 'la-fortuna'
  join destinos.dst_negocio n on n.destino_id = d.id and n.babosa = s.babosa
  cross join (values ('es'), ('en')) as i(codigo)
on conflict do nothing;

commit;

-- ---------------------------------------------------------------------------
-- Para revisar despues de correrlo:
--
--   select c.seccion, c.nombre, count(*)
--     from destinos.dst_negocio n
--     join destinos.dst_categoria c on c.id = n.categoria_id
--     join destinos.dst_destino d on d.id = n.destino_id
--    where d.babosa = 'la-fortuna' and n.estado_publicacion = 'publicado'
--    group by c.seccion, c.nombre order by c.seccion, c.nombre;
--
-- Y despues, en /admin/negocios, el boton "Traer opiniones de Google": eso
-- rellena coordenadas, nota y resenas de todos estos de una vez.
-- ---------------------------------------------------------------------------
