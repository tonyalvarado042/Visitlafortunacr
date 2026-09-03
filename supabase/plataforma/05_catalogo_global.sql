-- Plataforma de destinos | 05: catalogo global de categorias y etiquetas
-- Este catalogo lo comparten TODOS los destinos. Monteverde no lo recrea:
-- enciende las que le sirven en dst_destino_categoria. Ahi esta el "un clic".
-- La estructura sigue la navegacion definida para el sitio.

insert into destinos.dst_categoria (seccion, babosa_es, babosa_en, nombre_es, nombre_en, icono, orden) values
  -- QUE HACER ---------------------------------------------------------------
  ('que_hacer','volcan',             'volcano',            'Volcán',                'Volcano',              'volcan',      10),
  ('que_hacer','aguas-termales',     'hot-springs',        'Aguas termales',        'Hot springs',          'termal',      20),
  ('que_hacer','cataratas',          'waterfalls',         'Cataratas',             'Waterfalls',           'catarata',    30),
  ('que_hacer','puentes-colgantes',  'hanging-bridges',    'Puentes colgantes',     'Hanging bridges',      'puente',      40),
  ('que_hacer','canopy',             'zip-lining',         'Canopy',                'Zip lining',           'canopy',      50),
  ('que_hacer','rafting',            'rafting',            'Rafting',               'Rafting',              'rafting',     60),
  ('que_hacer','canyoning',          'canyoning',          'Canyoning',             'Canyoning',            'rappel',      70),
  ('que_hacer','cuadraciclos',       'atv',                'Cuadraciclos',          'ATV',                  'cuadra',      80),
  ('que_hacer','cabalgatas',         'horseback-riding',   'Cabalgatas',            'Horseback riding',     'caballo',     90),
  ('que_hacer','vida-silvestre',     'wildlife',           'Vida silvestre',        'Wildlife',             'fauna',      100),
  ('que_hacer','cafe-y-chocolate',   'coffee-and-chocolate','Café y chocolate',     'Coffee and chocolate', 'grano',      110),
  ('que_hacer','ciclismo',           'cycling',            'Ciclismo',              'Cycling',              'bici',       120),
  ('que_hacer','bienestar',          'wellness',           'Bienestar',             'Wellness',             'hoja',       130),
  ('que_hacer','parques-nacionales', 'national-parks',     'Parques nacionales',    'National parks',       'arbol',      140),

  -- TOURS Y EXPERIENCIAS ----------------------------------------------------
  ('tours','tours-aventura',      'adventure-tours', 'Aventura',        'Adventure',     'brujula', 10),
  ('tours','tours-naturaleza',    'nature-tours',    'Naturaleza',      'Nature',        'hoja',    20),
  ('tours','tours-familiares',    'family-tours',    'En familia',      'Family',        'familia', 30),
  ('tours','tours-bienestar',     'wellness-tours',  'Bienestar',       'Wellness',      'spa',     40),
  ('tours','tours-ciclismo',      'cycling-tours',   'Ciclismo',        'Cycling',       'bici',    50),
  ('tours','tours-privados',      'private-tours',   'Tours privados',  'Private tours', 'estrella',60),
  ('tours','paquetes',            'packages',        'Paquetes',        'Packages',      'caja',    70),

  -- DONDE DORMIR ------------------------------------------------------------
  ('donde_dormir','hoteles',            'hotels',           'Hoteles',            'Hotels',           'cama',    10),
  ('donde_dormir','resorts',            'resorts',          'Resorts',            'Resorts',          'cama',    20),
  ('donde_dormir','lodges',             'lodges',           'Lodges',             'Lodges',           'cabana',  30),
  ('donde_dormir','villas',             'villas',           'Villas',             'Villas',           'casa',    40),
  ('donde_dormir','alquiler-vacacional','vacation-rentals', 'Alquiler vacacional','Vacation rentals', 'llave',   50),
  ('donde_dormir','hospedaje-lujo',     'luxury-stays',     'Lujo',               'Luxury',           'diamante',60),
  ('donde_dormir','hospedaje-bienestar','wellness-stays',   'Bienestar',          'Wellness stays',   'spa',     70),
  ('donde_dormir','hospedaje-familiar', 'family-stays',     'Para familias',      'Family stays',     'familia', 80),
  ('donde_dormir','hospedaje-economico','budget-stays',     'Económico',          'Budget',           'moneda',  90),
  ('donde_dormir','hostales',           'hostels',          'Hostales',           'Hostels',          'mochila',100),
  ('donde_dormir','cabinas',            'cabins',           'Cabinas',            'Cabins',           'cabana', 110),

  -- COMER Y BEBER -----------------------------------------------------------
  ('comer_beber','restaurantes',         'restaurants',           'Restaurantes',         'Restaurants',           'cubiertos',10),
  ('comer_beber','comida-tipica',        'local-food',            'Comida típica',        'Local food',            'olla',     20),
  ('comer_beber','cocina-internacional', 'international-cuisine', 'Cocina internacional', 'International cuisine', 'globo',    30),
  ('comer_beber','cafeterias',           'coffee',                'Cafeterías',           'Coffee',                'taza',     40),
  ('comer_beber','saludable',            'healthy',               'Saludable',            'Healthy',               'hoja',     50),
  ('comer_beber','bares',                'bars',                  'Bares',                'Bars',                  'copa',     60),

  -- EXPLORAR ----------------------------------------------------------------
  ('explorar','atracciones',          'attractions',      'Atracciones',        'Attractions',      'estrella', 10),
  ('explorar','tiendas',              'shopping',         'Tiendas',            'Shopping',         'bolsa',    20),
  ('explorar','spas',                 'spas',             'Spas',               'Spas',             'spa',      30),
  ('explorar','gimnasios',            'gyms',             'Gimnasios',          'Gyms',             'pesa',     40),
  ('explorar','tiendas-de-bicicletas','bike-shops',       'Tiendas de bicis',   'Bike shops',       'bici',     50),
  ('explorar','servicios-locales',    'local-businesses', 'Servicios locales',  'Local businesses', 'tienda',   60),

  -- TRANSPORTE --------------------------------------------------------------
  ('transporte','shuttles',          'shuttles',   'Shuttles',           'Shuttles',   'furgoneta', 10),
  ('transporte','alquiler-de-autos', 'car-rental', 'Alquiler de autos',  'Car rental', 'auto',      20),
  ('transporte','taxis',             'taxis',      'Taxis',              'Taxis',      'taxi',      30),
  ('transporte','traslados',         'transfers',  'Traslados privados', 'Transfers',  'ruta',      40);

-- Etiquetas: globales, porque significan lo mismo en cualquier destino -------

insert into destinos.dst_etiqueta (grupo, babosa, nombre_es, nombre_en) values
  ('servicio','wifi-gratis',            'Wifi gratis',                  'Free wifi'),
  ('servicio','estacionamiento',        'Estacionamiento',              'Parking'),
  ('servicio','piscina',                'Piscina',                      'Swimming pool'),
  ('servicio','aguas-termales-propias', 'Aguas termales propias',       'On-site hot springs'),
  ('servicio','spa-en-sitio',           'Spa',                          'Spa'),
  ('servicio','restaurante-en-sitio',   'Restaurante en el sitio',      'On-site restaurant'),
  ('servicio','transporte-hotel',       'Transporte desde el hotel',    'Hotel pickup'),
  ('servicio','guia-bilingue',          'Guía bilingüe',                'Bilingual guide'),
  ('servicio','desayuno-incluido',      'Desayuno incluido',            'Breakfast included'),
  ('servicio','guarda-bicicletas',      'Guarda bicicletas',            'Bike storage'),
  ('ambiente','vista-al-volcan',        'Vista al volcán',              'Volcano view'),
  ('ambiente','en-el-centro',           'En el centro del pueblo',      'Downtown'),
  ('ambiente','en-la-naturaleza',       'Rodeado de naturaleza',        'Surrounded by nature'),
  ('ambiente','romantico',              'Romántico',                    'Romantic'),
  ('ambiente','tranquilo',              'Tranquilo',                    'Quiet'),
  ('accesibilidad','silla-de-ruedas',   'Accesible en silla de ruedas', 'Wheelchair accessible'),
  ('accesibilidad','sin-escaleras',     'Sin escaleras',                'Step-free access'),
  ('publico','apto-para-ninos',         'Apto para niños',              'Kid friendly'),
  ('publico','solo-adultos',            'Solo adultos',                 'Adults only'),
  ('publico','acepta-mascotas',         'Acepta mascotas',              'Pet friendly'),
  ('publico','opciones-vegetarianas',   'Opciones vegetarianas',        'Vegetarian options'),
  ('publico','apto-ciclistas',          'Apto para ciclistas',          'Cyclist friendly'),
  ('pago','acepta-tarjeta',             'Acepta tarjeta',               'Cards accepted'),
  ('pago','acepta-dolares',             'Acepta dólares',               'US dollars accepted'),
  ('pago','solo-efectivo',              'Solo efectivo',                'Cash only'),
  ('pago','tarifa-nacional',            'Tarifa para nacionales',       'Local resident rate');
