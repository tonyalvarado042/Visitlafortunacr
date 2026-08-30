-- visitlafortunacr | Semilla 05: catalogos
-- Categorias principales, subcategorias y etiquetas transversales.

insert into directorio.categoria
  (babosa_es, babosa_en, nombre_es, nombre_en, descripcion_es, descripcion_en, icono, color_hex, orden)
values
  ('hoteles', 'hotels', 'Hoteles', 'Hotels',
   'Donde dormir en La Fortuna: desde hostales en el centro hasta resorts con aguas termales propias.',
   'Where to sleep in La Fortuna: from hostels downtown to resorts with their own hot springs.',
   'cama', '#1B6B4A', 10),
  ('restaurantes', 'restaurants', 'Restaurantes', 'Restaurants',
   'Donde comer: sodas de comida tipica, parrillas de lena y cocina de autor con vista al volcan.',
   'Where to eat: traditional sodas, wood-fired grills and chef-driven kitchens with volcano views.',
   'cubiertos', '#C1440E', 20),
  ('tours', 'tours', 'Tours', 'Tours',
   'Operadores de aventura de la zona: canopy, rafting, canyoning, cabalgatas y caminatas guiadas.',
   'Local adventure operators: zip lines, rafting, canyoning, horseback riding and guided hikes.',
   'brujula', '#0F766E', 30),
  ('atracciones', 'attractions', 'Atracciones', 'Attractions',
   'Lo que hay que ver: aguas termales, cataratas, puentes colgantes y refugios de vida silvestre.',
   'The must-sees: hot springs, waterfalls, hanging bridges and wildlife sanctuaries.',
   'estrella', '#B45309', 40),
  ('parques', 'parks', 'Parques', 'Parks',
   'Areas protegidas y reservas del area de conservacion Arenal Huetar Norte.',
   'Protected areas and reserves of the Arenal Huetar Norte conservation area.',
   'arbol', '#166534', 50),
  ('transporte', 'transport', 'Transporte', 'Transport',
   'Como moverse: shuttles compartidos y privados, alquiler de vehiculos y traslados.',
   'Getting around: shared and private shuttles, car rental and transfers.',
   'furgoneta', '#1D4ED8', 60),
  ('comercio', 'shopping', 'Comercio y servicios', 'Shopping and services',
   'Souvenirs, supermercados, farmacias y servicios utiles para quien ya esta en el pueblo.',
   'Souvenirs, supermarkets, pharmacies and useful services for those already in town.',
   'bolsa', '#7C3AED', 70);

-- Subcategorias ------------------------------------------------------------

insert into directorio.categoria
  (padre_id, babosa_es, babosa_en, nombre_es, nombre_en, icono, color_hex, orden)
select p.id, s.babosa_es, s.babosa_en, s.nombre_es, s.nombre_en, p.icono, p.color_hex, s.orden
  from (values
    ('hoteles',      'resorts',            'resorts',            'Resorts',                'Resorts',              10),
    ('hoteles',      'lodges',             'lodges',             'Lodges',                 'Lodges',               20),
    ('hoteles',      'hostales',           'hostels',            'Hostales',               'Hostels',              30),
    ('hoteles',      'cabinas',            'cabins',             'Cabinas',                'Cabins',               40),
    ('restaurantes', 'comida-tipica',      'costa-rican-food',   'Comida tipica',          'Costa Rican food',     10),
    ('restaurantes', 'cocina-internacional','international-cuisine','Cocina internacional','International cuisine',20),
    ('restaurantes', 'cafeterias',         'cafes',              'Cafeterias',             'Cafes',                30),
    ('tours',        'canopy',             'zip-lining',         'Canopy',                 'Zip lining',           10),
    ('tours',        'rafting',            'rafting',            'Rafting',                'Rafting',              20),
    ('tours',        'canyoning',          'canyoning',          'Canyoning',              'Canyoning',            30),
    ('tours',        'cabalgatas',         'horseback-riding',   'Cabalgatas',             'Horseback riding',     40),
    ('tours',        'caminatas-guiadas',  'guided-hikes',       'Caminatas guiadas',      'Guided hikes',         50),
    ('atracciones',  'aguas-termales',     'hot-springs',        'Aguas termales',         'Hot springs',          10),
    ('atracciones',  'cataratas',          'waterfalls',         'Cataratas',              'Waterfalls',           20),
    ('atracciones',  'puentes-colgantes',  'hanging-bridges',    'Puentes colgantes',      'Hanging bridges',      30),
    ('atracciones',  'vida-silvestre',     'wildlife',           'Vida silvestre',         'Wildlife',             40),
    ('transporte',   'shuttles',           'shuttles',           'Shuttles',               'Shuttles',             10),
    ('transporte',   'alquiler-de-autos',  'car-rental',         'Alquiler de autos',      'Car rental',           20)
  ) as s(padre_babosa, babosa_es, babosa_en, nombre_es, nombre_en, orden)
  join directorio.categoria p on p.babosa_es = s.padre_babosa;

-- Etiquetas ----------------------------------------------------------------

insert into directorio.etiqueta (grupo, babosa, nombre_es, nombre_en) values
  ('servicio',      'wifi-gratis',           'Wifi gratis',                  'Free wifi'),
  ('servicio',      'estacionamiento',       'Estacionamiento',              'Parking'),
  ('servicio',      'piscina',               'Piscina',                      'Swimming pool'),
  ('servicio',      'aguas-termales-propias','Aguas termales propias',       'On-site hot springs'),
  ('servicio',      'spa',                   'Spa',                          'Spa'),
  ('servicio',      'restaurante-en-sitio',  'Restaurante en el sitio',      'On-site restaurant'),
  ('servicio',      'transporte-hotel',      'Transporte desde el hotel',    'Hotel pickup'),
  ('servicio',      'guia-bilingue',         'Guia bilingue',                'Bilingual guide'),
  ('ambiente',      'vista-al-volcan',       'Vista al volcan',              'Volcano view'),
  ('ambiente',      'en-el-centro',          'En el centro del pueblo',      'Downtown'),
  ('ambiente',      'en-la-naturaleza',      'Rodeado de naturaleza',        'Surrounded by nature'),
  ('ambiente',      'romantico',             'Romantico',                    'Romantic'),
  ('accesibilidad', 'silla-de-ruedas',       'Accesible en silla de ruedas', 'Wheelchair accessible'),
  ('accesibilidad', 'sin-escaleras',         'Sin escaleras',                'Step-free access'),
  ('publico',       'apto-para-ninos',       'Apto para ninos',              'Kid friendly'),
  ('publico',       'solo-adultos',          'Solo adultos',                 'Adults only'),
  ('publico',       'acepta-mascotas',       'Acepta mascotas',              'Pet friendly'),
  ('publico',       'opciones-vegetarianas', 'Opciones vegetarianas',        'Vegetarian options'),
  ('pago',          'acepta-tarjeta',        'Acepta tarjeta',               'Cards accepted'),
  ('pago',          'acepta-dolares',        'Acepta dolares',               'US dollars accepted'),
  ('pago',          'solo-efectivo',         'Solo efectivo',                'Cash only'),
  ('pago',          'tarifa-nacional',       'Tarifa para nacionales',       'Local resident rate');
