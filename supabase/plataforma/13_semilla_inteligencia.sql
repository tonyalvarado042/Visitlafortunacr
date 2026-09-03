-- Plataforma de destinos | 13: semilla de inteligencia para La Fortuna
-- Agentes, plantillas y automatizaciones de arranque (via
-- preparar_inteligencia_destino), el conocimiento inicial del destino y la
-- invitacion del primer administrador. Todo el conocimiento entra SIN
-- verificar: el equipo lo revisa desde el panel y marca esta_verificado.

do $$
declare
  v_destino uuid;
begin
  select id into v_destino from destinos.dst_destino where babosa = 'la-fortuna';
  if v_destino is null then
    raise exception 'No existe el destino la-fortuna';
  end if;

  perform destinos.preparar_inteligencia_destino(v_destino);

  insert into destinos.dst_conocimiento (destino_id, tipo, titulo, contenido, etiquetas, prioridad, para_concierge, para_planificador, fuente) values
  -- Reglas de la casa: prioridad 10, van siempre en el prompt.
  (v_destino, 'regla', 'Precios: rangos, nunca cifras finales',
   'Los precios de tours, hoteles y entradas cambian por temporada. Se dan como rango orientativo en dólares ("entre 60 y 80 USD por persona") y se aclara que el equipo confirma el precio final al reservar. Nunca se inventa un precio que no esté en el catálogo o en el conocimiento.',
   array['precios','reglas'], 10, true, true, 'equipo'),
  (v_destino, 'regla', 'Neutralidad: recomendamos por lo que busca el viajero',
   'Nunca se dice que un negocio es "nuestro" ni se favorece a uno por razones comerciales. Se recomienda lo que mejor encaja con lo que el viajero pidió (presupuesto, con quién viaja, intereses). Los negocios destacados se pueden mencionar, pero se rotulan como tales si el viajero pregunta por qué.',
   array['reglas','neutralidad'], 10, true, true, 'equipo'),
  (v_destino, 'regla', 'Reservas: el equipo confirma',
   'La IA no confirma disponibilidad ni cierra reservas. Recoge fechas, personas y contacto, crea la solicitud y explica que una persona del equipo confirma por WhatsApp o correo, normalmente en menos de 24 horas.',
   array['reglas','reservas'], 10, true, false, 'equipo'),
  (v_destino, 'regla', 'Cuándo pasar a una persona',
   'Se escala a una persona cuando hay una queja, un problema de salud o seguridad, una pregunta legal o de dinero que no está en el conocimiento, cuando el viajero lo pide, o cuando la IA no encuentra la respuesta después de buscar.',
   array['reglas','escalar'], 10, true, false, 'equipo'),
  -- Datos del destino
  (v_destino, 'dato', 'Cómo llegar desde San José (SJO)',
   'En carro son unas 3 horas: Ruta 1 hasta San Ramón y luego la Ruta 702 hacia La Fortuna, o por Zarcero y Ciudad Quesada. En bus público desde la terminal 7-10 de San José son entre 4 y 4.5 horas y cuesta pocos dólares. Los shuttles compartidos (Interbus, Gray Line y similares) cuestan alrededor de 50 a 60 USD por persona y recogen en el hotel. Un traslado privado ronda los 150 a 200 USD por vehículo.',
   array['transporte','llegar','san-jose','shuttle'], 8, true, true, 'equipo (verificar)'),
  (v_destino, 'dato', 'Clima y qué llevar',
   'Clima tropical húmedo todo el año, entre 22 y 30 °C. Temporada más seca de diciembre a abril; lluviosa de mayo a noviembre, con lluvias sobre todo por la tarde. El volcán se ve mejor temprano en la mañana. Llevar impermeable ligero, zapato cerrado para senderos, repelente, bloqueador y traje de baño para las termales.',
   array['clima','lluvia','temporada','que-llevar'], 8, true, true, 'equipo (verificar)'),
  (v_destino, 'dato', 'Volcán Arenal',
   'El Arenal tuvo su gran erupción en 1968 y está en reposo desde 2010: no se ve lava. No está permitido subir al volcán. El Parque Nacional Volcán Arenal tiene senderos sobre coladas antiguas y bosque (sector Coladas y sector El Ceibo); la entrada para extranjeros ronda los 15 USD y se compra en línea en el sistema de SINAC. Mirador clásico: la zona de El Castillo y el lago.',
   array['volcan','parque-nacional','senderos'], 7, true, true, 'equipo (verificar)'),
  (v_destino, 'dato', 'Catarata de La Fortuna',
   'Caída de unos 70 metros. Se baja por unos 500 escalones (subir toma 20 a 30 minutos, hay bancos). Se puede nadar en la poza de abajo con cuidado. Entrada alrededor de 18 USD para adultos extranjeros; la administra la asociación de desarrollo local. Abre de 7:00 a 17:00, última entrada a las 16:00. Ir temprano para evitar grupos.',
   array['catarata','cascada','senderismo'], 7, true, true, 'equipo (verificar)'),
  (v_destino, 'dato', 'Aguas termales: cómo elegir',
   'Hay termales para cada presupuesto. Lujo y pareja: Tabacón y The Springs. Familias y amigos: Baldi (muchas piscinas, toboganes) y Paradise (más tranquilo, aforo pequeño). Ecotermales es íntimo y trabaja con aforo limitado: hay que reservar. Económico: Los Laureles. Gratis: el río de agua tibia junto a Tabacón, conocido como Chollín, sin servicios y sin dejar objetos de valor en el carro. Casi todas ofrecen pase de día con o sin cena.',
   array['termales','hot-springs','relax'], 8, true, true, 'equipo (verificar)'),
  (v_destino, 'dato', 'Puentes colgantes',
   'Místico Arenal Hanging Bridges: circuito de unos 3 km con 16 puentes, 2 horas a paso tranquilo, apto para casi todas las edades. Entrada alrededor de 28 a 30 USD por adulto; con guía naturalista se ve mucha más fauna. Salidas típicas a las 7:30 y a la 1:30.',
   array['puentes','bosque','fauna','caminata'], 6, true, true, 'equipo (verificar)'),
  (v_destino, 'dato', 'Dinero, pagos y propinas',
   'La moneda es el colón, pero el dólar se acepta en casi todo (billetes pequeños y en buen estado). Las tarjetas se aceptan en la mayoría de hoteles, restaurantes y tours; conviene efectivo para sodas, taxis y propinas. Cajeros en el centro (BCR, Banco Nacional, BAC). En restaurantes la factura ya incluye 10 % de servicio y 13 % de IVA; una propina extra es opcional. A guías de tour se les suele dar 5 a 10 USD por persona.',
   array['dinero','moneda','propinas','tarjetas'], 7, true, true, 'equipo (verificar)'),
  (v_destino, 'dato', 'Lago Arenal',
   'Es el lago más grande de Costa Rica. Kayak, paddle y pesca de guapote todo el año; windsurf y kitesurf en la zona de Tronadora y El Castillo, sobre todo de diciembre a abril, cuando hay viento. Vistas del volcán desde la represa y desde El Castillo.',
   array['lago','kayak','windsurf','pesca'], 5, true, true, 'equipo (verificar)'),
  (v_destino, 'dato', 'Río Celeste (Parque Nacional Tenorio)',
   'A 1.5 a 2 horas en carro. Sendero de unos 6 km ida y vuelta hasta la catarata y el teñidero; la entrada ronda los 12 USD y se compra en línea (SINAC). El color celeste se ve mejor cuando no ha llovido fuerte el día anterior. Es un día completo; hay tours con transporte desde La Fortuna.',
   array['rio-celeste','tenorio','excursion','dia-completo'], 5, true, true, 'equipo (verificar)'),
  (v_destino, 'dato', 'Caño Negro',
   'Refugio de vida silvestre cerca de la frontera con Nicaragua. Tour de día completo en bote por los humedales: caimanes, monos, iguanas y muchas aves. Mejor época para aves migratorias de noviembre a abril.',
   array['cano-negro','aves','bote','fauna'], 4, true, true, 'equipo (verificar)'),
  (v_destino, 'dato', 'Rafting: qué río elegir',
   'Río Balsa: clase II y III, ideal para familias y primera vez, edad mínima usual 8 años. Río Sarapiquí: clase III y IV, más adrenalina, edad mínima usual 12 años. Casi todos incluyen transporte, equipo y almuerzo o fruta. Se moja todo: llevar cambio de ropa.',
   array['rafting','rios','aventura','familia'], 5, true, true, 'equipo (verificar)'),
  (v_destino, 'dato', 'Tours: horarios y recogida',
   'La mayoría de los tours recogen en el hotel dentro del pueblo y alrededores. Salidas típicas por la mañana (7:00 a 8:00) y por la tarde (13:00 a 14:00). El tour nocturno de ranas y fauna sale alrededor de las 17:30 y dura unas 2 horas. Conviene reservar termales y tours con al menos un día de anticipación en temporada alta (diciembre a abril y Semana Santa).',
   array['tours','horarios','recogida','temporada-alta'], 6, true, true, 'equipo (verificar)'),
  (v_destino, 'dato', 'Hacia Monteverde',
   'Por carretera son 3 a 4 horas. La opción clásica es "jeep-boat-jeep": van hasta el lago, bote y van hasta Monteverde, unas 3 horas en total y alrededor de 30 a 40 USD por persona.',
   array['monteverde','transporte','jeep-boat-jeep'], 4, true, true, 'equipo (verificar)'),
  (v_destino, 'dato', 'Cerro Chato',
   'El sendero al Cerro Chato está cerrado oficialmente desde 2017 y no se recomienda ni se ofrece. Alternativas para caminar con vista: Parque Nacional Volcán Arenal, Arenal 1968 y los puentes colgantes.',
   array['cerro-chato','cerrado','senderismo'], 5, true, true, 'equipo (verificar)'),
  (v_destino, 'dato', 'Salud y seguridad',
   'La Fortuna es un pueblo tranquilo. Lo básico: no dejar nada a la vista en el carro, zapato cerrado en senderos, no tocar ni alimentar fauna, y respetar las señales en ríos y termales. Hay farmacias y clínica en el centro; el hospital más cercano está en Ciudad Quesada, a una hora. Emergencias: 911.',
   array['seguridad','salud','emergencias'], 6, true, false, 'equipo (verificar)'),
  -- Politica del servicio (el equipo la ajusta)
  (v_destino, 'politica', 'Cómo funciona reservar con nosotros',
   'El viajero deja una solicitud (por el planificador, el chat o WhatsApp). Una persona del equipo confirma disponibilidad y precio final, normalmente en menos de 24 horas. El pago se hace con enlace seguro o directamente al proveedor, según el caso. La mayoría de los tours permiten cancelar sin costo hasta 48 horas antes; hoteles y termales tienen sus propias políticas y se informan antes de confirmar.',
   array['reservas','pagos','cancelacion'], 9, true, false, 'equipo (verificar)'),
  -- Guion de ventas
  (v_destino, 'guion', 'Cuando preguntan por termales',
   'Primero preguntar con quién viajan y qué presupuesto tienen. Pareja y presupuesto alto: Tabacón o The Springs con cena. Familia: Baldi o Paradise. Económico: Los Laureles, o el río Chollín si no les importa la falta de servicios. Cerrar ofreciendo reservar el pase de día con recogida.',
   array['guion','termales','ventas'], 6, true, false, 'equipo'),
  (v_destino, 'guion', 'Cuando dudan entre dos o tres días',
   'Con dos días alcanza para volcán o puentes, catarata y termales. Con tres se suma rafting o un tour de fauna. Con cuatro o más entran Río Celeste o Caño Negro. Proponer siempre un día de llegada liviano y termales la primera tarde.',
   array['guion','dias','itinerario'], 6, true, true, 'equipo');

  -- El primer administrador entra por invitacion, como todos.
  insert into destinos.dst_invitacion (email, nombre, rol, destinos_ids, vence_el)
  values ('aalvarado@gmail.com', 'Tony Alvarado', 'admin', '{}', now() + interval '90 days')
  on conflict do nothing;
end;
$$;
