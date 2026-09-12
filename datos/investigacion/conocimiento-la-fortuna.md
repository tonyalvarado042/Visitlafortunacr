# Conocimiento de La Fortuna — borrador para revisión

**Esto no es una guía ni contenido del sitio.** Es lo que va a saber el agente
de IA: los datos con los que el concierge responde y el planificador arma
itinerarios. Punto 10 de la Fase MVP.

**Tony: hay que leerlo antes de cargarlo.** Nada de esto lo revisó una persona
que conozca La Fortuna, y ese es justamente el trabajo que falta. Es el puente
hasta que el experto real pase su archivo.

## Cómo revisarlo

Cada ficha lleva una línea de metadatos y su fuente. Lo que hay que mirar, en
este orden:

1. **`confianza: baja`** — son precios y horarios, que cambian sin avisar.
   Están sacados de sitios oficiales donde los había y de guías de viaje donde
   no. Si algo se sabe distinto, se corrige aquí y punto.
2. **Lo que falte.** Lo que un fortuneño diría y no está escrito es
   exactamente lo que hace falta agregar. Se escribe una ficha nueva con el
   mismo formato.
3. **Lo que sobre o esté mal.** Se borra la ficha o se arregla el texto.

Después se carga con:

```
node --env-file=.env.local scripts/cargar-conocimiento.mjs            (en seco)
node --env-file=.env.local scripts/cargar-conocimiento.mjs --aplicar
```

**Todo entra `esta_verificado = false`**, incluso lo que Tony ya haya leído
aquí: la marca de verificado se pone desde `/admin/ia/conocimiento`, que es
donde queda constancia de quién la puso. El cargador usa el título como llave,
así que una ficha con el mismo título que una existente **la reemplaza**, no la
duplica.

## El formato

```
### Título de la ficha
`tipo: dato · prioridad: 8 · para: concierge, planificador · confianza: media`
**Etiquetas**: termales, presupuesto
**Fuente**: https://...

El contenido, en prosa, tal como el agente lo va a leer.
```

- **tipo**: `dato`, `faq`, `politica`, `guion`, `regla` o `aviso`.
- **prioridad**: 0 a 10. **7 o más va siempre en el prompt**; el resto se busca
  cuando hace falta. Por eso hay pocas de 8+: si todo es prioritario, nada lo es.
- **para**: a qué agente le sirve. El planificador no necesita saber el
  teléfono de la farmacia; el concierge sí.
- **confianza**: `alta` (hecho estable), `media` (cierto pero puede matizarse),
  `baja` (precio u horario, verificar antes de darlo por bueno). No es columna
  de la tabla: el cargador la pega al final de la fuente para que se vea en el
  panel.
- **reemplaza** (opcional): el título de una ficha que ya está en la base y que
  esta sustituye. Hace falta solo cuando **cambia el título**; si es el mismo,
  se pisa sola. Sin esto, renombrar una ficha deja viva la vieja y el agente se
  queda con dos versiones del mismo dato — que es exactamente lo que pasaba con
  las cinco fichas que este archivo renombró.

**Lo que ya está en la base y no se toca**: las 4 reglas de la casa, la
política de reservas y los 2 guiones de venta. Eso lo escribió el equipo, no
sale de internet, y no es lo que este archivo viene a resolver.

## Qué hace el agente con las fuentes

Desde la **migración 23** el agente recibe la fuente junto con cada ficha, y el
prompt le dice qué puede hacer con ella:

- **Puede citarla** — "según el sitio oficial de la catarata" — y **puede
  pasarle el enlace al viajero** que quiera comprobar un dato.
- **Puede abrirla**, desde el 12 de septiembre de 2026: el concierge tiene
  `web_fetch`. Cuando la fuente termina en `(confianza: baja)` y el viajero
  está por decidir con ese número, el agente abre la página y lo comprueba
  antes de responder.
- **Con dos límites que conviene conocer al escribir una ficha.** El primero es
  técnico: solo puede abrir enlaces que hayan pasado por la conversación, y las
  fichas de prioridad 7+ van en el prompt del sistema, que no cuenta — así que
  **de esas no puede comprobar nada**. El segundo es de criterio: Tripadvisor y
  Booking están bloqueados, porque de ahí no se copia texto de reseñas.

Dos cosas que se siguen de esto y que valen al revisar:

1. **Una fuente que sea una página real y estable vale más que una buena.** Un
   PDF que cambia de URL o un buscador no le sirven de nada.
2. **Lo que no esté escrito en la ficha, el agente sigue sin saberlo.** Abrir la
   fuente le sirve para confirmar un precio, no para aprender lo que la ficha no
   dice. Por eso importa que estas 61 estén bien.

---

# 1 · El destino, de fondo

Lo que hace que el agente no suene a folleto. Un viajero pregunta "¿por qué hay
tantas termales acá?" y la respuesta buena es el volcán, no una lista.

### Qué es La Fortuna
`tipo: dato · prioridad: 7 · para: concierge, planificador · confianza: alta`
**Etiquetas**: destino, contexto, pueblo
**Fuente**: https://en.wikipedia.org/wiki/La_Fortuna,_San_Carlos

La Fortuna es un distrito del cantón de San Carlos, en la provincia de
Alajuela, al norte de Costa Rica. Unos 16.000 habitantes, 253 metros sobre el
nivel del mar, y el volcán Arenal a menos de 10 kilómetros del centro. Se fundó
a mediados de los años treinta con colonos de Ciudad Quesada, Grecia y
Alajuela, y se creó oficialmente como distrito el 5 de febrero de 1952. Antes
se llamaba **El Burío**. Era un pueblo agrícola y ganadero: el turismo llegó
después, y llegó por el volcán.

### La erupción de 1968, que es por lo que existe todo esto
`tipo: dato · prioridad: 6 · para: concierge, planificador · confianza: media`
**Etiquetas**: volcan, historia, 1968
**Fuente**: https://www.arenal.net/arenal-volcano-1968-eruption.htm · https://en.wikipedia.org/wiki/La_Fortuna,_San_Carlos

El Arenal llevaba siglos dormido y la gente de la zona le decía "Cerro Arenal":
lo tenían por un cerro, no por un volcán. El **29 de julio de 1968, a las 7:30
de la mañana**, entró en erupción de golpe. Sepultó tres poblados —Tabacón,
Pueblo Nuevo y San Luis— y afectó más de 200 km² de tierra. **La Fortuna se
salvó** porque la explosión salió hacia el oeste. Hay un mito bonito y falso
sobre el nombre: no se llama La Fortuna por haberse librado de la erupción,
porque el nombre es de dieciséis años antes.

Después de 1968 el volcán estuvo activo casi a diario durante cuatro décadas, y
eso fue lo que trajo a los primeros turistas. Dejó de expulsar lava en
**diciembre de 2010**.

**Ojo con la cifra de muertos**: las fuentes dicen 82 o 87 según cuál se mire.
Si alguien pregunta, se dice "alrededor de 80" y no un número exacto.

### El volcán hoy: no se ve lava, y hay que decirlo antes
`tipo: aviso · prioridad: 8 · para: concierge, planificador · confianza: alta`
**Etiquetas**: volcan, expectativa, lava
**Fuente**: https://en.wikipedia.org/wiki/Arenal_Volcano

**El Arenal está en reposo desde diciembre de 2010: no se ve lava, no hay ríos
de fuego de noche, y no se puede subir a la cima.** Todavía circulan fotos
nocturnas de los años noventa y hay gente que llega esperando eso.

Se dice de entrada, no cuando el viajero ya reservó. Y se dice completo: lo que
sí se ve es el cono perfecto, que es de los más bonitos del país; las coladas
de lava endurecida de 1968, que se caminan; y fumarolas los días despejados. El
volcán **se despeja casi siempre temprano en la mañana** y se nubla por la
tarde, así que quien quiera la foto madruga.

### Dónde queda y a qué distancia está todo
`tipo: dato · prioridad: 6 · para: concierge, planificador · confianza: media`
**Etiquetas**: distancias, geografia, mapa
**Fuente**: recopilación de las fichas de transporte de este mismo archivo

Distancias en tiempo de carro desde el centro de La Fortuna, que es como se
piensa acá —los kilómetros engañan, las carreteras son de montaña—:

- Catarata de La Fortuna: 10 minutos.
- Termales (todas están sobre la misma carretera al volcán): 10 a 20 minutos.
- Parque Nacional Volcán Arenal: 25 minutos.
- Puentes colgantes (Místico): 30 minutos.
- Represa del lago y El Castillo: 30 a 45 minutos.
- Cavernas de Venado: 1 hora.
- Río Celeste (Tenorio): 1 hora y media a 2 horas.
- Caño Negro: 2 horas.
- Monteverde: 3 a 4 horas por carretera, o 3 horas por el lago.
- Aeropuerto de San José (SJO): 3 a 4 horas.
- Aeropuerto de Liberia (LIR): 3 horas.

---

# 2 · Llegar y moverse

### Cómo llegar desde San José (SJO)
`tipo: dato · prioridad: 8 · para: concierge, planificador · confianza: baja`
**Etiquetas**: transporte, llegar, san-jose, shuttle
**Fuente**: https://www.rome2rio.com/s/San-Jose-Airport-SJO/La-Fortuna-Provincia-de-Alajuela-Costa-Rica · https://tropicaltourshuttles.com/routes/san-jose-airport-to-arenal-bus/

Son unas **3 a 4 horas** desde el aeropuerto Juan Santamaría. Cuatro maneras,
de más barata a más cómoda:

- **Bus público**: entre 4 y 5 horas y menos de 15 USD. No hay directo desde el
  aeropuerto: se va a San José, a la terminal de San Carlos (la 7-10), y de ahí
  a La Fortuna. Barato y seguro, pero con maletas y con un vuelo recién
  aterrizado es un día entero.
- **Shuttle compartido**: **entre 44 y 60 USD por persona**, unas 4 horas,
  recoge en el aeropuerto o en el hotel de San José y deja en la puerta del
  hotel en La Fortuna. Es lo que elige la mayoría. Hay que reservarlo con
  anticipación porque se llenan, y suele haber límite de equipaje.
- **Traslado privado**: entre 150 y 200 USD por vehículo, no por persona. A
  partir de tres o cuatro personas sale parecido al compartido y va directo.
- **Carro alquilado**: 3 horas por la Ruta 1 hasta San Ramón y luego la 702, o
  por Zarcero y Ciudad Quesada, que es más lento y más bonito.

**El detalle que importa**: conviene no programar el traslado justo después de
aterrizar. Migración y equipaje en SJO se comen fácil una hora.

### Cómo llegar desde Liberia (LIR) y desde otros destinos
`tipo: dato · prioridad: 5 · para: concierge, planificador · confianza: baja`
**Etiquetas**: transporte, llegar, liberia, guanacaste
**Fuente**: https://www.rome2rio.com/s/San-Jose-Airport-SJO/La-Fortuna-Provincia-de-Alajuela-Costa-Rica

Desde el aeropuerto de Liberia (LIR) son unas **3 horas**, y es la puerta de
entrada natural para quien combina La Fortuna con Guanacaste. Hay shuttles
compartidos por la ruta de Bagaces y Tilarán, bordeando el lago.

Desde las playas del Pacífico (Tamarindo, Sámara) son 4 a 5 horas; desde
Manuel Antonio, 5 a 6; desde Puerto Viejo y el Caribe, 6 o más, casi siempre
con transbordo en San José. Para trayectos largos conviene partir el día o
salir muy temprano: en Costa Rica se maneja de día, que es cuando se ve.

### Moverse dentro de La Fortuna
`tipo: dato · prioridad: 7 · para: concierge · confianza: media`
**Etiquetas**: transporte, taxi, uber, caminar
**Fuente**: https://www.fortunawelcome.com/es/consejos-de-viaje/ · https://www.uber.com/global/en/r/cities/la-fortuna-alajuela-cr/

**El centro se camina entero**: son unas pocas cuadras alrededor del parque, y
ahí están los restaurantes, los bancos, los supermercados y las agencias.

Para todo lo demás —termales, catarata, parque nacional— hay que moverse:

- **Taxi**: la central atiende de 6:00 a 23:00 en los teléfonos **2479-9605** y
  **2479-9604**. Fuera de ese horario hay unidades esperando al costado del
  parque central.
- **Uber** funciona en La Fortuna, pero con menos carros que en una ciudad:
  los tiempos de espera son más largos y conviene pedirlo con anticipación.
- **Shuttles compartidos a las atracciones**, desde unos 5 USD por trayecto.
- **La recogida en el hotel viene incluida en casi todos los tours**, que es la
  razón por la que mucha gente no necesita carro. Si el hospedaje está fuera
  del pueblo, hay que confirmar que llegan hasta ahí.

La parada de buses está **100 metros al sur de la iglesia católica**, con
salidas a Tilarán, Ciudad Quesada y San Ramón. Se le paga al chofer.

### Alquilar carro: cuándo sí y cuándo no
`tipo: dato · prioridad: 5 · para: concierge, planificador · confianza: baja`
**Etiquetas**: transporte, carro, alquiler
**Fuente**: https://www.easyhop.co/post/costos-y-tipos-de-transporte-para-movilizarse-en-la-fortuna

Un carro básico ronda los **100 a 130 USD por día** una vez sumados el seguro
obligatorio y la gasolina — el precio que se ve en los comparadores casi nunca
incluye el seguro, y esa es la sorpresa clásica en el mostrador.

**Sí conviene** si son varios días, si el hospedaje está fuera del pueblo, si
se va a Río Celeste o al lago por cuenta propia, o si el viaje sigue a otro
destino. **No conviene** para tres días en el pueblo con tours que ya recogen
en el hotel: se paga por un carro parqueado. No hace falta 4x4 para La Fortuna
y sus atracciones principales; sí para caminos de tierra secundarios en
temporada de lluvia.

### Hacia Monteverde: el jeep-boat-jeep
`tipo: dato · prioridad: 5 · para: concierge, planificador · confianza: baja · reemplaza: Hacia Monteverde`
**Etiquetas**: monteverde, transporte, jeep-boat-jeep
**Fuente**: https://morphovans.com/jeep-boat-jeep/ · https://montetours.com/jeep-boat-jeep-tour-from-la-fortuna-to-monteverde/

Es la ruta clásica entre los dos destinos y es media excursión en sí misma:
van hasta la represa del lago Arenal, **30 a 40 minutos de bote cruzando el
lago** con el volcán detrás, y otra van hasta Monteverde. Unas **3 horas y
media a 4 en total**, de puerta de hotel a puerta de hotel, y **entre 33 y 50
USD por persona** según la hora y el operador.

Salidas de La Fortuna alrededor de las 8:30 y de las 14:30. Por carretera son
3 a 4 horas rodeando el lago y no se ahorra tiempo ni dinero, así que el
jeep-boat-jeep gana casi siempre. "Jeep" es un nombre heredado: hoy son
microbuses con aire acondicionado.

---

# 3 · Cuándo venir

### Clima y qué llevar
`tipo: dato · prioridad: 8 · para: concierge, planificador · confianza: media`
**Etiquetas**: clima, lluvia, temporada, que-llevar
**Fuente**: https://es.weatherspark.com/y/15526/Clima-promedio-en-La-Fortuna-Costa-Rica-durante-todo-el-a%C3%B1o

Clima tropical húmedo todo el año, entre **22 y 32 °C**, con humedad alta
siempre. Aquí no hay invierno ni verano en el sentido europeo: hay temporada
seca (diciembre a abril) y temporada verde (mayo a noviembre). Diciembre y
enero son los meses más frescos; abril y mayo, los más calientes.

**Llueve en cualquier época**, y eso hay que decirlo: es bosque lluvioso. En
temporada verde llueve casi todos los días, pero **casi siempre por la tarde**,
así que un aguacero de las tres no arruina un día que empezó a las siete.

Qué llevar: impermeable ligero o poncho (el paraguas no sirve en el bosque),
zapato cerrado con suela que agarre, ropa que seque rápido, repelente,
bloqueador, traje de baño y una bolsa seca para el celular. Un abrigo liviano
para las noches y para el aire acondicionado de los buses.

### Temporadas: precios, gente y qué se gana en cada una
`tipo: dato · prioridad: 6 · para: concierge, planificador · confianza: media`
**Etiquetas**: temporada, precios, aforo, cuando-venir
**Fuente**: https://www.adventuretourscostarica.com/es/blog/la-fortuna-weather-what-to-expect-and-how-to-pack

- **Temporada alta (diciembre a abril)**: menos lluvia, más probabilidad de ver
  el volcán despejado, y más gente y precios más altos. Navidad, Año Nuevo y
  Semana Santa son los picos: hay que reservar hospedaje y tours con semanas de
  anticipación, y las termales se llenan.
- **Temporada verde (mayo a noviembre)**: todo más barato y más vacío, el
  bosque en su mejor momento y las cataratas con caudal. Llueve por la tarde.
  Septiembre y octubre son los meses más lluviosos y también los más baratos.
- **Los hombros (mayo y noviembre)** son, para muchos, el mejor momento:
  precios de temporada baja y clima todavía razonable.

Un consejo que vale para todo el año: **las actividades al aire libre se
programan en la mañana** y las termales o los museos para la tarde. Así la
lluvia estorba lo menos posible.

---

# 4 · Lo grande que hay que ver

### Volcán Arenal
`tipo: dato · prioridad: 7 · para: concierge, planificador · confianza: baja`
**Etiquetas**: volcan, parque-nacional, senderos
**Fuente**: https://sinac.go.cr/ES/ac/ACAHN/pnva/Paginas/default.aspx · https://en.wikipedia.org/wiki/Arenal_Volcano_National_Park

El Parque Nacional Volcán Arenal lo administra el SINAC. Abre **de 8:00 a
16:00** todos los días. La entrada ronda los **15 USD para adultos
extranjeros** y **5 USD para niños**; los nacionales y residentes pagan unos
1.130 colones.

**Se compra en la boletería, el mismo día**: este parque no tiene venta en
línea, al contrario de otros parques del país. Vale la pena decirlo, porque
mucha gente llega con la reserva hecha de otro parque y asume que aquí es igual.

Unos 15 km de senderos bien marcados. El **sector Coladas** lleva sobre la
lava endurecida de 1968 hasta un mirador; el **sector Península**, abierto en
2017, tiene 1,2 km de sendero, una torre de observación y vistas del lago.
**No se puede subir al cono**, y no es una regla decorativa: el terreno es
inestable y ha habido muertos.

Teléfonos del parque: administración (506) 2200-4192, caseta (506) 2200-5714.

### Catarata de La Fortuna
`tipo: dato · prioridad: 7 · para: concierge, planificador · confianza: baja`
**Etiquetas**: catarata, cascada, senderismo
**Fuente**: https://www.cataratalafortuna.com/es/faq · https://arenaladifort.com/servicios/atracciones/

Caída de unos 70 metros dentro de un cañón de bosque. La entrada cuesta
**20 USD extranjeros y 10 USD nacionales**, y los **menores de 8 años entran
gratis**. La entrada vale para todo el día.

Se baja por unos **500 escalones** (la cifra que repiten las guías es 530; el
sitio oficial dice 500). Bajar toma 20 a 30 minutos y subir bastante más, pero
el camino es de cemento, con baranda y con bancos para descansar cada pocos
minutos. **Se puede nadar** en la poza, con cuidado con la corriente cerca de
la caída.

Hay servicios sanitarios, duchas, tienda, restaurante y mirador. **El mirador
es accesible según la ley 7600**, así que quien no pueda con los escalones ve
la catarata de todos modos — eso se ofrece, no se espera a que lo pregunten.

La administra **ADIFORT**, la asociación de desarrollo de La Fortuna, y lo
recaudado se reinvierte en el pueblo. Es un dato que a mucha gente le gusta
oír. Conviene ir temprano: después de las diez llegan los grupos.

### Aguas termales: cómo elegir
`tipo: dato · prioridad: 8 · para: concierge, planificador · confianza: media`
**Etiquetas**: termales, hot-springs, relax, como-elegir
**Fuente**: https://costaricatravelblog.com/best-la-fortuna-hot-springs/

Las termales son agua calentada por el volcán, y son **la razón por la que
mucha gente elige La Fortuna sobre otros destinos**. Hay catorce y casi todas
están sobre la misma carretera, así que la pregunta nunca es "dónde" sino
"cuál".

Se elige por tres cosas y en este orden:

1. **Con quién va** — unos niños quieren toboganes; una pareja quiere silencio.
   Son lugares distintos y confundirlos arruina la tarde.
2. **Presupuesto** — el rango va de gratis a más de 100 USD por persona.
3. **Cuánto tiempo** — un pase de día con almuerzo o cena es medio día; una
   entrada de dos horas al final de la tarde es otra cosa.

Casi todas venden **pase de día con o sin comida**, y varias abren hasta las
diez de la noche: meterse al agua caliente de noche, con el bosque sonando, es
mejor experiencia que hacerlo a mediodía con sol. Las de aforo limitado
—Ecotermales sobre todo— **hay que reservarlas**.

### Termales de lujo: Tabacón y The Springs
`tipo: dato · prioridad: 6 · para: concierge, planificador · confianza: baja`
**Etiquetas**: termales, lujo, parejas, tabacon, the-springs
**Fuente**: https://costaricatravelblog.com/best-la-fortuna-hot-springs/

Las dos más caras y las dos mejores en su estilo. **Más de 100 USD por adulto**
el pase de día en ambas.

- **Tabacón** tiene lo que ninguna otra: un **río termal de corriente natural**,
  no agua bombeada a piscinas. Jardín tropical, cascadas, ambiente de pareja.
  Es el nombre que la gente conoce de afuera. Está donde estuvo el poblado que
  sepultó la erupción de 1968, cosa que casi nadie sabe.
- **The Springs Resort** es la propiedad más grande, con unas 25 piscinas
  repartidas en tres zonas (Cascadas Calientes, Los Perdidos y Club Río). Da
  para un día entero y funciona igual de bien para familias que para parejas,
  porque las zonas están separadas.

Para quien viene una sola vez y quiere la tarde redonda, cualquiera de las dos
se justifica. Para quien viene tres noches, gastar ahí una tarde y las otras en
algo más barato es mejor reparto.

### Termales de gama media: Ecotermales, Paradise y Titoku
`tipo: dato · prioridad: 6 · para: concierge, planificador · confianza: baja`
**Etiquetas**: termales, gama-media, tranquilo, adultos
**Fuente**: https://costaricatravelblog.com/best-la-fortuna-hot-springs/

El punto dulce: **entre 40 y 60 USD por persona**, pocas piscinas, poca gente.

- **Ecotermales Fortuna** es la más querida de esta categoría. **Trabaja con
  aforo limitado por turno y hay que reservar**, que es justamente lo que la
  hace valer la pena: nunca está llena. Ambiente de bosque, sin toboganes, sin
  música.
- **Paradise Hot Springs**: pequeña, tranquila, con una cascada bonita. Buena
  relación entre lo que cuesta y lo que da.
- **Titoku**: de las más pequeñas y silenciosas, con piscinas de colores y
  diseño cuidado. Para adultos.

Ninguna de las tres es para niños que quieran correr y tirarse por un tobogán.
Si el viajero anda con chiquitos, se le manda a Baldi o a Kalambu y todos
quedan mejor.

### Termales económicas y familiares
`tipo: dato · prioridad: 6 · para: concierge, planificador · confianza: baja`
**Etiquetas**: termales, familias, economico, ninos, baldi, kalambu
**Fuente**: https://costaricatravelblog.com/best-la-fortuna-hot-springs/

- **Baldi**: unas 25 piscinas, toboganes, saunas, bares dentro del agua y zona
  de niños. Es la más grande y la más ruidosa; para un grupo de amigos o una
  familia con adolescentes es perfecta, y para quien busca silencio es un
  error. Ronda los 85 USD el pase completo.
- **Kalambu**: literalmente un parque acuático de agua termal, con toboganes
  grandes. **La mejor opción con niños pequeños**, y de las más baratas:
  alrededor de 35 USD.
- **Los Lagos**: económica, con toboganes, piscinas frías y exhibición de ranas
  y tortugas.
- **Los Laureles**: sin pretensiones, con canchas de fútbol y voleibol. Es
  adonde va la gente del pueblo.
- **Termalitas del Arenal, Relax Termalitas y Termales del Arenal**: lo más
  barato que hay pagando, por debajo de 20 USD. Instalaciones sencillas.

Con presupuesto ajustado y niños, Kalambu o Los Lagos. Con presupuesto ajustado
y sin niños, Los Laureles o el río gratis.

### Las termales gratis: el Chollín
`tipo: dato · prioridad: 6 · para: concierge · confianza: media`
**Etiquetas**: termales, gratis, chollin, rio, presupuesto
**Fuente**: https://costaricatravelblog.com/best-la-fortuna-hot-springs/

El río Tabacón corre caliente por debajo del puente de la carretera al volcán,
y ahí la gente se mete gratis. Se le dice **el Chollín** o "mini-Tabacón": es
la continuación del mismo río termal que Tabacón cobra por ver.

**Lo que se advierte siempre, junto con el dato**: no hay vestidores, ni
guardas, ni salvavidas, ni luz. Las piedras resbalan, la corriente sube rápido
si llovió arriba, y **han robado carros parqueados ahí**: no se deja nada
adentro, ni escondido. De día y acompañado.

Desde 2025 hay un negocio al lado, **Choyín Río Termal**, que cobra poco y da
casilleros, toallas y comida con acceso al mismo río. Para quien quiere el río
sin el riesgo del parqueo, es la respuesta.

### Puentes colgantes
`tipo: dato · prioridad: 6 · para: concierge, planificador · confianza: baja`
**Etiquetas**: puentes, bosque, fauna, caminata, mistico
**Fuente**: https://misticopark.com/tours/self-guided-hanging-bridges/

**Místico Arenal Hanging Bridges** es el más conocido. Sendero principal de
**3,2 km con 6 puentes colgantes y 10 fijos**, unas 2 horas a paso tranquilo.
Hay un recorrido corto de 1,5 km y **un tramo accesible de 250 metros apto para
silla de ruedas**. Abre **de 6:00 a 15:50**, con entradas cada media hora.

Autoguiado: alrededor de **32 USD por la mañana y 28 por la tarde**, más
impuestos. **Menores de 4 años, gratis.** Con guía naturalista sube a **44–54
USD** y vale la diferencia: el guía trae telescopio y ve lo que nadie ve solo —
serpientes, perezosos, tucanes. Hay más de 350 especies de aves en el parque.

**La recomendación honesta**: quien vaya a hacer un solo tour guiado en todo el
viaje, que lo haga aquí. Caminar los puentes solo se puede; ver la fauna, no.

### Miradores y coladas de lava
`tipo: dato · prioridad: 5 · para: concierge, planificador · confianza: baja`
**Etiquetas**: mirador, lava, coladas, caminata, el-silencio, arenal-1968
**Fuente**: https://miradorelsilencio.com/

Alternativas al parque nacional, más baratas y casi siempre más vacías:

- **Mirador El Silencio**: unos **10 USD por persona**, parqueo gratis. Se
  camina sobre las coladas de 1968 hasta miradores del volcán y del lago.
- **Arenal 1968**: senderos privados sobre la colada de la erupción, con laguna
  y vistas. Mismo espíritu, otra finca.

Los dos son propiedad privada, se pagan en la entrada y se hacen por cuenta
propia sin reservar. Para quien ya pagó el parque nacional puede ser repetir;
para quien busca la foto del cono sin el precio de la entrada del SINAC, es la
respuesta. **Temprano en la mañana**, o se nubla.

### Lago Arenal y El Castillo
`tipo: dato · prioridad: 5 · para: concierge, planificador · confianza: media · reemplaza: Lago Arenal`
**Etiquetas**: lago, kayak, windsurf, pesca, el-castillo
**Fuente**: https://en.wikipedia.org/wiki/Lake_Arenal

El lago Arenal es el más grande de Costa Rica y es artificial: se represó en
los años setenta para generar electricidad, y bajo el agua quedaron dos
pueblos. Todavía mueve buena parte de la energía del país.

Se hace kayak, paddle y pesca de guapote todo el año. **Windsurf y kitesurf en
la zona de Tronadora y El Castillo, sobre todo de diciembre a abril**, que es
cuando entra el viento — y entra fuerte: es de los mejores lugares del mundo
para eso.

**El Castillo** es un pueblito en la ladera del volcán, al otro lado del lago:
mucho más tranquilo que La Fortuna, con vistas del volcán y del agua, y
hospedajes pequeños. Para quien quiere naturaleza sin el movimiento del pueblo,
es el lugar. Para quien quiere caminar a cenar, no: hay que tener carro.

---

# 5 · Aventura

### Canopy y tirolesa: cómo elegir
`tipo: dato · prioridad: 6 · para: concierge, planificador · confianza: baja`
**Etiquetas**: canopy, tirolesa, zipline, aventura
**Fuente**: https://www.costarica-spirit.com/guides/arenal-ziplines/ · https://www.arenal.net/tours/ecoglide-canopy-tour

El canopy se inventó en Costa Rica y aquí hay varios. Se diferencian por el
paisaje y por el tamaño del grupo, no por la adrenalina:

- **Sky Adventures Arenal** tiene el circuito más escénico, con vistas del lago,
  y se sube en teleférico. **75 a 90 USD** solo canopy; el combo con el
  teleférico y los puentes, **110 a 120 USD**.
- **Ecoglide Arenal Park**: alrededor de **75 USD**, 15 cables en tres tramos y
  **Tarzan swing**. Grupos de máximo 8 por circuito, contra 12 o 14 de los
  grandes, así que el guía atiende mejor. Es la mejor relación calidad-precio.
- **Athica** y **Arenal Mundo Aventura** completan la oferta; el segundo queda
  a las afueras del pueblo y combina canopy con cataratas y cultura maleku.

Casi todos piden peso mínimo y máximo y no aceptan embarazadas ni problemas de
espalda o cuello. **Se moja y se ensucia**: ropa que no importe y zapato
cerrado amarrado, nada de sandalias.

### Rafting: qué río elegir
`tipo: dato · prioridad: 6 · para: concierge, planificador · confianza: baja`
**Etiquetas**: rafting, rios, aventura, familia, balsa, sarapiqui
**Fuente**: https://www.costaricadaytrip.com/guides/es-cr/rafting-aguas-bravas-la-fortuna · https://www.desafiocostarica.com/tour-detail/sarapiqui-costa-rica-rafting-2-3

La pregunta es la edad y las ganas, no el río:

- **Río Balsa**, clase II y III: para principiantes y familias. La edad mínima
  que piden los operadores va de **5 a 8 años** según la compañía y el caudal.
  Es el que se hace en medio día y el que casi siempre se combina con otra cosa.
- **Río Sarapiquí y Balsa alto**, clase III y IV: más adrenalina, **desde 12
  años**. Es día completo porque el traslado es más largo.

**Entre 65 y 112 USD** con recogida en el hotel, equipo, guía y almuerzo o
fruta. Muchos operadores ponen tope de peso, alrededor de 100 kg.

Se moja todo, sin excepción: cambio de ropa, zapato que se pueda amarrar, y el
celular en bolsa seca o en el bus. En temporada verde el caudal sube y el río
se pone más entretenido; si llovió muchísimo, lo cancelan, y eso es buena señal
sobre el operador, no mala.

### Canyoning y rappel de cataratas
`tipo: dato · prioridad: 5 · para: concierge, planificador · confianza: baja`
**Etiquetas**: canyoning, rappel, cataratas, aventura
**Fuente**: https://www.viator.com/tours/La-Fortuna/Canyoning-in-the-Lost-Canyon/d821-6833LOST · https://abccanyoning.com/es/

Bajar cataratas en cuerda, dentro de un cañón de bosque. El clásico es el
**Lost Canyon**, con varios rappeles y uno de hasta unos 60 metros. Medio día,
con salidas típicas a las 7:00, 10:00 y 13:00, y recogida unos 45 minutos antes.

Edad mínima habitual **8 a 10 años**. No hace falta experiencia —el guía va
atado al lado en el primer rappel— pero sí razonable estado físico y ninguna
lesión de rodilla ni de hombro. Quien le tenga miedo a la altura la va a pasar
mal: eso se dice antes, no después de cobrar.

Se suele combinar con rafting o con canopy en un solo día.

### Cabalgatas, cuadraciclos y tubing
`tipo: dato · prioridad: 4 · para: concierge, planificador · confianza: media`
**Etiquetas**: cabalgata, atv, cuadraciclos, tubing, aventura
**Fuente**: https://www.arenalvolcanopark.com/tours/horseback-ride-la-fortuna-waterfall · https://www.fortunawelcome.com/la-fortuna-tours/canyoning-rafting-arenal/

- **Cabalgatas**: la clásica va por finca y bosque hasta la Catarata de La
  Fortuna, medio día. Apta para principiantes; se pregunta siempre el peso del
  jinete, porque hay tope.
- **Cuadraciclos (ATV)**: por caminos de tierra y ríos alrededor del volcán.
  Se maneja uno mismo, con licencia; de pasajero se puede ir sin licencia.
  Medio día y se termina embarrado, que es la gracia.
- **Tubing**: bajar el río sentado en una cámara. Más suave que el rafting y
  buenísimo con adolescentes.

Los tres son de los pocos tours que **no dependen del clima**: si llueve, se
hacen igual.

### Cavernas de Venado
`tipo: dato · prioridad: 4 · para: concierge, planificador · confianza: baja`
**Etiquetas**: cavernas, venado, espeleologia, aventura
**Fuente**: https://www.viator.com/La-Fortuna-attractions/Venado-Caves/d821-a19655

A una hora de La Fortuna. Cuevas de roca caliza de millones de años, con
estalactitas, un río subterráneo y murciélagos. El recorrido dura unas **2
horas** y con transporte desde La Fortuna ronda los **60 a 80 USD**.

**Hay que decir con franqueza lo que es**: se entra con casco y linterna, se
moja hasta la cintura, hay tramos donde se pasa de lado o agachado, y no hay
señal. **Quien sufra de claustrofobia no debe ir**, y quien tenga problemas de
movilidad tampoco. A quien no le importe eso, le suele resultar lo más
memorable del viaje.

---

# 6 · Fauna

### Qué animales se ven y dónde
`tipo: dato · prioridad: 6 · para: concierge, planificador · confianza: media`
**Etiquetas**: fauna, animales, perezosos, aves, monos
**Fuente**: https://bogarintrail.com/ · https://misticopark.com/tours/self-guided-hanging-bridges/

Lo que la gente viene esperando ver: **perezosos de dos y tres dedos, tucanes,
monos congo y carablanca, coatíes, ranas venenosas, iguanas y colibríes**. En
la zona hay más de 350 especies de aves.

**La verdad incómoda que conviene decir**: sin guía casi no se ve nada. Un
perezoso duerme de 15 a 18 horas al día, arriba del todo, quieto y del color de
la corteza. Los guías de acá trabajan con telescopio y saben en qué árbol
estaba ayer. La diferencia entre un sendero con guía y sin guía no es el
relato, es cuántos animales se ven.

Mejores horas: **temprano en la mañana** y al caer la tarde. A mediodía el
bosque duerme.

### Perezosos: Bogarín Trail
`tipo: dato · prioridad: 5 · para: concierge, planificador · confianza: baja`
**Etiquetas**: perezosos, fauna, bogarin, caminando
**Fuente**: https://bogarintrail.com/ · https://www.getyourguide.com/la-fortuna-l1904/la-fortuna-bogarin-trail-sloth-watching-tour-with-guide-t1094067/

El **Bogarín Trail** es el sitio de perezosos de La Fortuna, y tiene una
ventaja que ninguno de los otros: **está a minutos del centro, se llega
caminando**, así que no hace falta tour con transporte ni medio día libre.

Es bosque regenerado —una finca ganadera que se dejó volver bosque— y hoy es
santuario. Sendero de unos 2,5 km. Salidas típicas a las 6:00, 9:00, 12:00 y
15:00, unas 2 horas. **Se suelen ver 4 o 5 perezosos**, a veces muy cerca.
También tucanes, ranas y aves.

### Tour nocturno
`tipo: dato · prioridad: 4 · para: concierge, planificador · confianza: media`
**Etiquetas**: nocturno, ranas, fauna, noche
**Fuente**: https://bogarintrail.com/night-walk/

El bosque de noche es otro bosque. Salida alrededor de las **17:30, unas 2
horas**, con linterna y guía por un sendero corto. Se ven **ranas de colores,
ranas de vidrio, serpientes, insectos enormes, perezosos despiertos** y, con
suerte, algún mamífero nocturno.

Es el tour que mejor funciona con niños y el que menos cansa: poca caminata,
mucho que ver. Zapato cerrado y repelente, que a esa hora es cuando pican.

---

# 7 · Excursiones de día completo

### Río Celeste (Parque Nacional Volcán Tenorio)
`tipo: dato · prioridad: 5 · para: concierge, planificador · confianza: baja · reemplaza: Río Celeste (Parque Nacional Tenorio)`
**Etiquetas**: rio-celeste, tenorio, excursion, dia-completo
**Fuente**: https://www.viajeroscallejeros.com/visitar-rio-celeste-parque-nacional-volcan-tenorio/ · https://www.getyourguide.com/la-fortuna-l1904/full-day-rio-celeste-from-la-fortuna-t81186/

A **hora y media o dos** de La Fortuna. El río es de un celeste que no parece
real, y el color es química, no mito: dos ríos se juntan y los minerales
precipitan en partículas del tamaño justo para dispersar esa luz. El punto
donde pasa se llama **el Teñidero** y verlo es lo mejor de la caminata.

Sendero de unos **6 km ida y vuelta** hasta la catarata, el Teñidero, la laguna
azul y los borbollones. Entrada alrededor de **14 USD**; se entra **de 8:00 a
14:00** y se puede permanecer hasta las 16:00.

**Lo que hay que advertir antes de venderlo**: si llovió fuerte el día
anterior, el río baja turbio y **el celeste no se ve**. No es culpa de nadie y
no hay devolución. Es día completo; con tour desde La Fortuna van transporte,
guía, entrada y almuerzo.

### Caño Negro
`tipo: dato · prioridad: 4 · para: concierge, planificador · confianza: media`
**Etiquetas**: cano-negro, aves, bote, fauna
**Fuente**: https://www.arenal.net/tours/penas-blancas-safari-float

Refugio Nacional de Vida Silvestre cerca de la frontera con Nicaragua, a unas
dos horas. Se recorre **en bote por los humedales del río Frío**: caimanes,
tortugas, monos, iguanas, perezosos y muchísimas aves.

**De noviembre a abril** llegan las migratorias y es cuando más se ve. En
temporada muy seca el nivel del agua baja y el recorrido se acorta.

Es el mejor tour de la zona para quien viene por las aves, y el más tranquilo
de todos: se va sentado.

### Safari float por el Peñas Blancas
`tipo: dato · prioridad: 4 · para: concierge, planificador · confianza: media`
**Etiquetas**: safari-float, penas-blancas, fauna, tranquilo, familias
**Fuente**: https://www.arenal.net/tours/penas-blancas-safari-float · https://www.waveexpeditions.com/product/nature-wildlife-safari-float-tour/

Bajar el río Peñas Blancas en balsa inflable, **sin rápidos**: el guía rema y
el viajero mira. Unas 3 horas de recorrido, medio día contando el transporte,
con salida alrededor de las 7:00 y recogida en el hotel.

Es la respuesta cuando alguien quiere ver fauna pero no quiere caminar, o anda
con niños pequeños, o con gente mayor. Se ven monos, perezosos, iguanas,
tucanes y garzas desde el agua, que es donde los animales bajan a tomar.
Suele terminar con fruta y a veces se combina con el tour de chocolate.

### Sarapiquí, Bijagua y el resto de la zona norte
`tipo: dato · prioridad: 3 · para: planificador · confianza: media`
**Etiquetas**: sarapiqui, bijagua, excursiones, zona-norte

Para estadías de cinco días o más, o para quien repite:

- **Sarapiquí**: rafting clase III-IV, jardines de mariposas y la mejor zona de
  aves de la vertiente caribeña. Dos horas.
- **Bijagua**: el pueblo de entrada a Río Celeste por el otro lado, con
  proyectos comunitarios de avistamiento de aves y ranas.
- **Nuevo Arenal y Tilarán**: bordeando el lago, con vistas y cafés de
  carretera. Es el camino natural hacia Guanacaste.

---

# 8 · Café, chocolate y el pueblo

### Tours de café, chocolate y caña
`tipo: dato · prioridad: 5 · para: concierge, planificador · confianza: baja`
**Etiquetas**: cafe, chocolate, cultura, finca, familias
**Fuente**: https://www.arenal.net/tours/don-olivo-chocolate-tour · https://www.tripadvisor.com/AttractionProductReview-g309226-d11995290-Don_Olivo_Chocolate_Tour_from_La_Fortuna-La_Fortuna_de_San_Carlos_Arenal_Volcano_N.html

De los tours que mejor quedan en el recuerdo y de los más baratos:

- **Don Olivo**: finca familiar, tour de cacao **desde unos 30 USD**. Se ve el
  proceso entero, de la mazorca a la barra, y se prueba en cada paso. Trato
  familiar, sin producción.
- **North Fields**: café de especialidad y cacao juntos, **desde unos 46 USD**,
  con caña de azúcar y trapiche.

Duran unas 2 o 3 horas, son bajo techo en buena parte y **funcionan igual si
llueve**, así que son la carta que se juega cuando el clima tumba el plan del
día. Con niños funcionan muy bien.

El café costarricense es de los mejores del mundo y aquí se explica por qué:
altura, sombra, recolección a mano grano por grano.

### El pueblo: qué hacer sin pagar
`tipo: dato · prioridad: 5 · para: concierge, planificador · confianza: media`
**Etiquetas**: pueblo, gratis, parque-central, iglesia, presupuesto
**Fuente**: https://myvacationabode.com/5-actividades-gratis-en-la-fortuna/ · https://www.viajeroscallejeros.com/que-ver-y-hacer-en-la-fortuna/

El **parque central** con la iglesia blanca y el volcán detrás es la postal del
pueblo, y es gratis. Hay fuente, bancos, sombra y, casi todas las tardes,
gente jugando. Entrar a la iglesia no cuesta nada.

Otras cosas que no cuestan: caminar el pueblo, que es chico; ver aves en
cualquier árbol grande al amanecer; el mercado y las ferias; el atardecer desde
cualquier punto alto de la carretera al volcán; y el río termal gratis (ver la
ficha del Chollín).

Es la respuesta honesta para quien llega con presupuesto corto y cree que aquí
todo se paga.

### Fiestas y calendario local
`tipo: dato · prioridad: 3 · para: concierge, planificador · confianza: media`
**Etiquetas**: fiestas, cultura, calendario, toros
**Fuente**: https://adminsi.cultura.cr/expresiones-y-manifestaciones/fiestas-tradicionales-de-san-carlos

- **31 de enero, San Juan Bosco**: el patrono de La Fortuna.
- **Febrero: las fiestas cívicas**, dos semanas de topes a caballo, **toros a la
  tica**, bailes, conciertos, karaoke y comida en el redondel. Es la fecha en
  que el pueblo se ve más pueblo y menos destino turístico.

**Los toros a la tica no son corridas españolas: al toro no se le hace daño ni
se le mata.** La gracia es la gente que se mete al redondel a torearlo y a
salir corriendo. Si un viajero pregunta, se explica así, porque la palabra
"toros" asusta a mucha gente con razón.

Además, los feriados nacionales mueven todo: **Semana Santa** (el país entero
se va de viaje, hay que reservar con mucha anticipación y el jueves y viernes
santo cierra casi todo), **15 de setiembre** (independencia) y **Navidad y Año
Nuevo**.

---

# 9 · Comer

### Comida típica: qué es cada cosa
`tipo: dato · prioridad: 6 · para: concierge · confianza: alta`
**Etiquetas**: comida, tipica, casado, gallo-pinto, cultura
**Fuente**: https://lavidasondosviajes.com/costa-rica/donde-comer-en-la-fortuna-barato/

Lo que hay que saber traducir cuando alguien mira un menú:

- **Gallo pinto**: arroz con frijoles salteados, el desayuno del país. Va con
  huevo, queso, natilla y plátano maduro frito.
- **Casado**: el almuerzo. Arroz, frijoles, ensalada, plátano maduro y una
  proteína a elegir —pollo, carne, pescado, chuleta—. Abundante y barato.
- **Olla de carne**: sopa de res con verduras de la zona, para el almuerzo de
  domingo.
- **Chifrijo**: chicharrón, frijoles, arroz y pico de gallo, con tortilla. De
  bar.
- **Patacones**: plátano verde frito y aplastado.
- **Ceviche tico**: con leche de coco o no, y siempre con galleta salada.
- **Agua de pipa**: agua de coco, servida en el coco.
- **Batidos**: en agua o en leche, de frutas que en otro lado no existen —
  cas, guanábana, maracuyá, mora.

**Pura vida** no es solo un saludo: se usa para "hola", "gracias", "de nada",
"todo bien" y "no hay problema".

### Sodas: comer bien y barato
`tipo: dato · prioridad: 5 · para: concierge · confianza: baja`
**Etiquetas**: comida, economico, sodas, presupuesto
**Fuente**: https://lavidasondosviajes.com/costa-rica/donde-comer-en-la-fortuna-barato/ · https://costaricatravellife.com/restaurants-in-la-fortuna-costa-rica/

Una **soda** es un comedor de barrio, y es donde come la gente del pueblo. Un
casado ronda los **5 a 8 USD**, contra 20 o 25 en un restaurante de la calle
principal con vista al volcán.

Las que aparecen una y otra vez en las recomendaciones: **Soda La Hormiga**,
**Soda Viquez**, **Soda La Parada** (abierta 24 horas, frente a la parada de
buses), **Soda Ara** y **Restaurante Nene's**, que es de una familia de La
Fortuna.

La regla que nunca falla en Costa Rica: **si hay ticos almorzando, se come
bien**. Y a mediodía casi todas tienen "plato del día", que es más barato que
pedir a la carta.

### Restaurantes y vida nocturna
`tipo: dato · prioridad: 4 · para: concierge · confianza: media`
**Etiquetas**: restaurantes, cena, vista, bares, noche
**Fuente**: https://www.fortunawelcome.com/es/consejos-de-viaje/

En la calle principal hay cocina internacional, italiana, peruana y varias
opciones vegetarianas; casi todo el pueblo se cena caminando. Los restaurantes
**con vista al volcán** están sobre la carretera hacia el Arenal y en los
hoteles, y conviene reservar al atardecer, que es cuando todos quieren mesa.

La noche de La Fortuna es tranquila y temprana: bares en el centro —Lava
Lounge, El Establo, Bar Vagabundo, Mango's— y una discoteca, Volcán Look, que
es la de siempre. Nada de esto es una ciudad: a la una ya cerró casi todo.

### Dietas especiales
`tipo: dato · prioridad: 3 · para: concierge · confianza: media`
**Etiquetas**: vegetariano, vegano, celiaco, alergias, comida

Vegetariano se resuelve fácil: un casado sin carne es arroz, frijoles,
ensalada y plátano, y casi todos los lugares lo hacen sin drama. Vegano cuesta
un poco más por la natilla y el queso, pero hay lugares en el centro que lo
manejan bien.

**Sin gluten es más delicado**, sobre todo en sodas: el arroz y los frijoles
sirven, pero las salsas y los empanizados no siempre están claros. Para alergias
serias conviene reservar en restaurantes que lo declaren y avisar al reservar,
no al sentarse.

---

# 10 · Dormir

### Dónde alojarse: las tres zonas
`tipo: dato · prioridad: 7 · para: concierge, planificador · confianza: media`
**Etiquetas**: hospedaje, zonas, donde-dormir, centro, el-castillo
**Fuente**: https://misticopark.com/blog/costa-rica-travel-tips/where-to-stay-in-la-fortuna-costa-rica/

Es la primera pregunta del planificador y cambia todo el viaje:

- **El centro del pueblo.** Se camina a restaurantes, supermercados, bancos y
  agencias, y todos los tours recogen ahí. Lo más práctico y lo más barato, y
  la única zona donde se puede no tener carro. A cambio: poca vista del volcán
  y algo de ruido.
- **La carretera al volcán** (unos 5 a 15 minutos del centro). Es donde están
  las termales, los resorts y casi todas las vistas del cono. Más verde, más
  tranquilo, más caro, y **hace falta carro o taxi para cada comida**.
- **El Castillo**, al otro lado del lago, a 30 o 45 minutos. Lo más tranquilo y
  lo más bonito, con vista del volcán y del lago. Para desconectar de verdad,
  y solo con carro.

**La recomendación por defecto**: primera vez y tres noches, el centro o la
carretera. Luna de miel o gente que ya conoce, la carretera o El Castillo.

### Qué tipo de hospedaje hay
`tipo: dato · prioridad: 4 · para: concierge, planificador · confianza: media`
**Etiquetas**: hospedaje, hoteles, cabinas, presupuesto

La Fortuna tiene de todo, y la palabra que confunde es **"cabina"**: en Costa
Rica es un hospedaje sencillo de habitaciones independientes, no una cabaña de
montaña. Baratas, limpias y funcionales.

De ahí para arriba: hostales con cama en dormitorio compartido; hoteles
pequeños de pueblo; hoteles boutique; y los resorts con termales propias sobre
la carretera al volcán, que son el tramo caro.

**Un detalle que ahorra una queja**: muchos hospedajes de la zona **no tienen
aire acondicionado, solo ventilador**, porque de noche refresca. Con calor y
humedad alta, a alguna gente le importa. Se pregunta antes de reservar.

Varios hoteles tienen **pase a termales incluido o con descuento**, lo que
cambia la cuenta del viaje entero: conviene mirarlo antes de comparar precios
de habitación pelados.

---

# 11 · Práctico

### Dinero, pagos y propinas
`tipo: dato · prioridad: 7 · para: concierge · confianza: media`
**Etiquetas**: dinero, moneda, propinas, tarjetas, impuestos
**Fuente**: https://www.costarica-spirit.com/es/guias/cultura-propinas/ · https://www.fortunawelcome.com/es/consejos-de-viaje/

La moneda es el **colón**, pero el dólar se acepta en casi todo el pueblo. Dos
advertencias que ahorran plata: **billetes pequeños y en buen estado** —uno
roto o muy viejo lo rechazan—, y el vuelto casi siempre llega en colones a un
tipo de cambio peor que el del banco. Para gastos chicos conviene tener colones.

Las tarjetas se aceptan en hoteles, restaurantes y tours. Efectivo para sodas,
taxis, ferias y propinas.

**Los impuestos ya vienen en el precio**: en restaurantes la factura incluye
**13 % de IVA y 10 % de servicio**. Ese 10 % ya es la propina, así que dejar
más es opcional y solo si atendieron muy bien. **No es como en Estados
Unidos**, y decirlo evita que alguien pague 20 % de más sin saberlo.

A los guías de tour se les suele dar **5 a 10 USD por persona** al final del
día, y eso sí se agradece de verdad.

### Bancos, cajeros y horarios del pueblo
`tipo: dato · prioridad: 4 · para: concierge · confianza: baja`
**Etiquetas**: bancos, cajeros, horarios, supermercados, practico
**Fuente**: https://www.fortunawelcome.com/es/consejos-de-viaje/

Cinco bancos en el centro, **de 8:30 a 15:30**: Banco Nacional (2479-9355),
Banco de Costa Rica (2479-9113), Banco Popular (2479-9422), Banco de San José
(2479-8576) y COOCIQUE (2479-9121). Los cajeros funcionan fuera de ese horario.

- **Supermercados**: de 7:00 a 22:00 (Súper Cristian, Mega Súper).
- **Tiendas y souvenirs**: de 8:00 a 20:00, todos los días.
- **Gasolineras**: 24 horas (Gasolinera Fortuna, Gasolinera La Cristalina).

Los cheques de viajero cobran alrededor de 1 % de comisión y casi nadie los usa
ya; no vale la pena traerlos.

### Salud, seguridad y emergencias
`tipo: dato · prioridad: 6 · para: concierge · confianza: media · reemplaza: Salud y seguridad`
**Etiquetas**: seguridad, salud, emergencias, farmacias, agua
**Fuente**: https://www.fortunawelcome.com/es/consejos-de-viaje/ · https://www.visitcostarica.com/planning-your-trip/tips

**Emergencias: 911**, y funciona sin línea local ni saldo.

La Fortuna es un pueblo tranquilo y el problema real no es la violencia, es el
robo de oportunidad: **no dejar nada a la vista en el carro**, ni siquiera por
diez minutos, y menos en parqueos de senderos y del río termal.

- **Farmacias** hasta las 20:00: Farmacia El Pueblo (2479-7264), Farmacia
  Fishel (2479-9518), Farmacia La Fortuna (2479-8155).
- Hay clínica y consultorios privados en el centro; el **hospital más cercano
  está en Ciudad Quesada**, a una hora.
- **El agua del tubo es potable** en La Fortuna y en casi todo el país. No hace
  falta comprar botellas, y decirlo es además lo coherente con la sostenibilidad.

En senderos: zapato cerrado, no meter las manos donde no se ve, y **no tocar ni
alimentar a ningún animal**. Con el sol y la humedad se deshidrata uno sin
notarlo: agua y bloqueador aunque esté nublado, que aquí el nublado quema igual.

**El seguro de viaje con cobertura médica y de aventura se recomienda siempre**,
y hay tours que lo piden.

### Internet, señal y enchufes
`tipo: dato · prioridad: 3 · para: concierge · confianza: media`
**Etiquetas**: internet, wifi, sim, enchufes, practico

Wifi en casi todos los hoteles, restaurantes y cafés del centro; la señal de
celular es buena en el pueblo y se cae en los senderos, en el parque nacional y
camino a Venado. Hay SIM prepago de Kölbi, Claro y Movistar en el centro, y
eSIM para quien prefiera llegar con todo listo.

**Los enchufes son los mismos de Estados Unidos** (tipo A y B, 110 V, 60 Hz):
quien venga de Europa necesita adaptador. Costa Rica está en **GMT-6 y no
cambia de hora** en todo el año.

---

# 12 · Lo que hay que advertir

Fichas escritas para que el agente **se adelante** a un malentendido, en vez de
justificarse después. Son las que más valen en una reserva.

### Los errores que comete casi todo el mundo
`tipo: aviso · prioridad: 7 · para: concierge, planificador · confianza: media`
**Etiquetas**: errores, consejos, expectativa

1. **Venir muy pocos días.** Dos noches dan para dos actividades y un traslado.
   Lo sensato son **tres o cuatro noches**.
2. **Programar todo por la tarde.** El volcán se despeja en la mañana y llueve
   en la tarde: las caminatas y las vistas van temprano, las termales después.
3. **Esperar ver lava.** Ver la ficha del volcán. Se dice antes de reservar.
4. **Subestimar los escalones de la catarata.** Son 500 para abajo y 500 para
   arriba, con calor y humedad.
5. **Meter dos excursiones de día completo seguidas.** Río Celeste y Caño
   Negro el mismo fin de semana es dejar el viaje en el carro.
6. **Llegar sin reservar en temporada alta.** Diciembre a abril y Semana Santa
   se llenan de verdad.
7. **Cambiar plata en el aeropuerto o con particulares.** Cajero o banco.
8. **Creer que hace falta 4x4.** Para lo principal, no.

### Cerro Chato: está cerrado
`tipo: aviso · prioridad: 5 · para: concierge, planificador · confianza: media · reemplaza: Cerro Chato`
**Etiquetas**: cerro-chato, cerrado, senderismo, seguridad

El sendero al **Cerro Chato está cerrado oficialmente desde 2017** y no se
ofrece ni se recomienda. Sigue apareciendo en blogs viejos y en listas de
"qué hacer", así que la pregunta llega sola. Se cerró por seguridad: el
descenso a la laguna es muy empinado y hubo accidentes.

Alternativas para caminar con vista: el Parque Nacional Volcán Arenal, Arenal
1968, Mirador El Silencio y los puentes colgantes.

### Sostenibilidad: lo que aquí no se hace
`tipo: regla · prioridad: 6 · para: concierge, planificador · confianza: alta`
**Etiquetas**: sostenibilidad, fauna, etica, cst
**Fuente**: https://www.ict.go.cr/es/sostenibilidad/cst.html

Costa Rica protege más de una cuarta parte de su territorio y el turismo es la
razón de que a mucha de esa gente le convenga cuidarlo. El agente no recomienda
nada que rompa eso:

- **No se toca, no se alimenta y no se carga a ningún animal.** Un tour que
  ofrezca sostener un perezoso para la foto no se recomienda, y punto. Darles
  comida los enferma y los vuelve dependientes.
- No se sale de los senderos ni se recogen plantas, piedras ni conchas.
- No se compra artesanía de carey, coral, plumas ni madera de especies
  protegidas.
- La basura se baja: en los senderos no hay basureros.
- El **CST** (Certificación para la Sostenibilidad Turística) es el sello
  oficial del ICT. Cuando un negocio lo tiene, se puede mencionar.

### Accesibilidad y movilidad reducida
`tipo: dato · prioridad: 4 · para: concierge, planificador · confianza: media`
**Etiquetas**: accesibilidad, ley-7600, movilidad, adultos-mayores
**Fuente**: https://www.cataratalafortuna.com/es/faq · https://misticopark.com/tours/self-guided-hanging-bridges/

Se puede hacer un viaje bueno con movilidad reducida, y conviene saber qué
ofrecer sin tener que preguntar:

- **Catarata de La Fortuna**: el **mirador es accesible** conforme a la ley
  7600. Bajar al pozo, no.
- **Místico**: tiene un **tramo accesible de 250 metros** apto para silla.
- **Termales**: las grandes tienen rampas y entradas graduales a las piscinas;
  conviene confirmar con cada una.
- **Safari float por el Peñas Blancas**: se va sentado, sin rápidos. Es el mejor
  tour de fauna para quien no camina bien.
- **Tours de café y chocolate**: casi planos y bajo techo.

Lo que queda fuera: cavernas de Venado, canyoning, canopy y el sendero de la
catarata.

### Viajar con niños
`tipo: dato · prioridad: 4 · para: concierge, planificador · confianza: media`
**Etiquetas**: familias, ninos, planificar

La Fortuna funciona muy bien con niños. Lo que casi siempre pega: **Kalambu**
(parque acuático termal), el **tour nocturno de ranas** (corto y espectacular),
el **tour de chocolate** (se come), el **safari float** (se va sentado viendo
monos) y los **puentes colgantes** con guía.

Lo que hay que mirar por edad: rafting en el Balsa desde 5 a 8 años según el
operador; canopy y canyoning con peso y edad mínimos; cavernas de Venado, no.

Los 500 escalones de la catarata con un niño pequeño en brazos son mucho: mejor
el mirador.

### Parejas y luna de miel
`tipo: dato · prioridad: 3 · para: concierge, planificador · confianza: media`
**Etiquetas**: parejas, luna-de-miel, romantico

Lo que arma un viaje de pareja acá: hospedaje sobre la carretera al volcán o en
El Castillo, con vista; **Tabacón, Ecotermales o Titoku** para las termales —no
Baldi—; cena con vista al volcán reservada al atardecer; y un día de algo
compartido, que suele ser los puentes con guía o el safari float.

Las termales **de noche** son la mejor versión de sí mismas para una pareja.

---

# 13 · Cuánto tiempo y en qué orden

### Cuántos días hacen falta
`tipo: guion · prioridad: 7 · para: concierge, planificador · confianza: media`
**Etiquetas**: itinerario, dias, planificar
**Fuente**: https://misticopark.com/blog/costa-rica-travel-tips/how-many-days-do-you-need-in-la-fortuna/

- **2 noches**: alcanza para lo esencial y se sale corriendo. Volcán o catarata,
  y termales. Se va con la sensación de haber dejado cosas.
- **3 noches**: lo mínimo cómodo, y lo que se recomienda por defecto.
- **4 o 5 noches**: lo ideal. Entra una excursión de día completo (Río Celeste
  o Caño Negro) y todavía queda una mañana libre.

**El criterio que hay que aplicar siempre: una actividad grande por día, no
dos.** Con calor, humedad y traslados, dos tours en un día dejan al viajero
agotado y de mal humor, y es la queja más común que se puede evitar de antemano.

### Un itinerario de tres días que funciona
`tipo: guion · prioridad: 6 · para: planificador · confianza: media`
**Etiquetas**: itinerario, tres-dias, plan

- **Día 1 — llegada.** Caminar el pueblo y el parque central, y **termales al
  atardecer**. Es lo mejor después de tres o cuatro horas de carretera y no
  exige madrugar.
- **Día 2 — volcán.** Temprano al Parque Nacional Volcán Arenal o a Místico
  (temprano no es un capricho: es cuando se ve el cono y cuando sale la fauna).
  Almuerzo en el pueblo y por la tarde la **Catarata de La Fortuna**.
- **Día 3 — a elegir según quién sea.** Aventura: rafting o canopy. Tranquilo:
  safari float y tour de chocolate. Naturaleza: Bogarín y tour nocturno.

Con un cuarto día se mete **Río Celeste**, que es día completo, y conviene
ponerlo antes del día de salida, no el mismo.

---

# 14 · Preguntas que llegan solas

### ¿Se ve lava?
`tipo: faq · prioridad: 6 · para: concierge · confianza: alta`
**Etiquetas**: faq, volcan, lava

No. El Arenal está en reposo desde diciembre de 2010. Se ve el cono, las
coladas endurecidas de 1968, que se caminan, y fumarolas los días despejados.
Se responde completo y de una, sin rodeos: nadie se enoja por la verdad
temprano, todos se enojan por la verdad tarde.

### ¿Cuándo se ve el volcán despejado?
`tipo: faq · prioridad: 6 · para: concierge · confianza: media`
**Etiquetas**: faq, volcan, clima, fotos

**Casi siempre temprano en la mañana**, entre el amanecer y las nueve. Después
suben las nubes y a media tarde suele estar tapado. Es así todo el año, aunque
en temporada seca se despeja más seguido. Quien esté tres noches lo ve; quien
esté una, es lotería. Si el viajero viene por la foto, se le dice que madrugue.

### ¿Se puede subir al volcán?
`tipo: faq · prioridad: 5 · para: concierge · confianza: alta`
**Etiquetas**: faq, volcan, seguridad

No. Está prohibido subir al cono del Arenal y no hay tour legal que lo ofrezca.
Lo que sí se camina son los senderos del parque nacional sobre las coladas, y
los miradores de El Silencio y Arenal 1968.

### ¿Hace falta carro?
`tipo: faq · prioridad: 5 · para: concierge, planificador · confianza: media`
**Etiquetas**: faq, transporte, carro

Depende de dónde se duerma. En el centro, no: se camina todo y los tours
recogen en el hotel. Sobre la carretera al volcán o en El Castillo, sí, o hay
que contar taxis para cada comida. Para Río Celeste por cuenta propia, sí.

### ¿Es seguro?
`tipo: faq · prioridad: 5 · para: concierge · confianza: media`
**Etiquetas**: faq, seguridad

La Fortuna es un pueblo tranquilo y se camina de noche por el centro sin
problema. Lo que sí pasa es robo de cosas dejadas en el carro, sobre todo en
parqueos de senderos y del río termal gratis. Emergencias, 911.

### ¿Se puede tomar agua del tubo?
`tipo: faq · prioridad: 4 · para: concierge · confianza: alta`
**Etiquetas**: faq, agua, salud

Sí, en La Fortuna y en casi todo el país. Lo mejor es traer botella
reutilizable y llenarla.

### ¿Qué idioma se habla?
`tipo: faq · prioridad: 4 · para: concierge · confianza: alta`
**Etiquetas**: faq, idioma, ingles

Español. En turismo se habla inglés con soltura: hoteles, tours y restaurantes
del centro. En sodas y con taxistas puede que no, y ahí basta con señas y
buena cara.

---

## Lo que este archivo todavía no tiene

Se anota para que quien siga sepa dónde está el hueco, y para que el experto
real sepa qué se le está pidiendo:

- **Los nombres propios de la gente.** Qué guía es bueno para aves, quién abre
  los domingos, cuál soda cierra en octubre. Eso no está en internet y es
  exactamente lo que hace distinto a un agente local.
- **Precios reales y actuales.** Todo lo marcado `confianza: baja` sale de
  guías y agregadores, no de llamar a preguntar.
- **Horarios de temporada.** Varias cosas cambian de horario entre temporada
  alta y verde y eso no se publica.
- **Lo que está cerrado o cambió de dueño.** Internet se queda viejo; el pueblo
  no.
- **Las historias.** Lo que pasó de verdad en 1968 contado por alguien de aquí
  vale más que cualquiera de estas fichas.
