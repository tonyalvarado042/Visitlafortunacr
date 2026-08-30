# Arquitectura de visitlafortunacr

## 1. Que es esto

Un directorio de La Fortuna de San Carlos con resenas de visitantes: hoteles,
restaurantes, tours, parques, atracciones, transporte y comercio. El modelo de
referencia es Tripadvisor, pero acotado a un solo destino.

Esa acotacion es la ventaja competitiva, no una limitacion. Tripadvisor sabe un
poco de 200.000 destinos; este sitio puede saberlo todo de uno: que termales
tienen sombra a las 3 de la tarde, cual soda abre los domingos, cuanto cobra de
verdad el taxi-bote-taxi a Monteverde este mes. Ese detalle es lo que Google
premia y lo que un agregador global no puede sostener.

### A quien sirve

| Quien | Que viene a hacer | Que se lleva |
|---|---|---|
| Turista antes del viaje | Comparar y decidir | Fichas comparables, resenas, precios reales |
| Turista ya en La Fortuna | Resolver ahora | Que esta abierto, que queda cerca, telefono y WhatsApp |
| Negocio local | Ser encontrado | Ficha reclamable, gratis, que posiciona en Google |
| Duena del sitio | Monetizar | Destacados, comisiones de reserva, perfiles premium |

## 2. El problema real: el arranque en frio

Un directorio sin resenas no sirve a nadie, y nadie deja resenas en un
directorio que no sirve. Se rompe el circulo en tres fases, y el modelo de datos
tiene que soportar las tres desde el dia uno.

### Fase 1 - Credibilidad prestada (meses 0-3)

El sitio no inventa resenas ni copia las ajenas. Muestra, junto a cada ficha, lo
que **otras plataformas ya dicen** de ese negocio, con atribucion y enlace:

```
Don Rufino
Google        4,6  (3.214 resenas)   ver en Google
Tripadvisor   4,5  (2.087 resenas)   ver en Tripadvisor
visitlafortunacr  aun sin resenas - se la primera persona en opinar
```

Esto es lo que hacen los metabuscadores y es legalmente defendible: un
**dato factual agregado** (la nota y el conteo) mas un enlace a la fuente. Es
distinto de reproducir el texto con derechos de autor de la persona que la
escribio.

De Google Places API si se muestran hasta 5 resenas con texto, porque la propia
API las entrega para ese uso, siempre con el nombre y foto del autor, la
atribucion a Google y enlace a la original. La API prohibe almacenarlas de forma
permanente, asi que se cachean con vencimiento y se refrescan; por eso
`resena_externa` lleva `expira_en` y por eso las resenas externas viven en una
tabla **separada** de las propias.

**Lo que no se hace**: raspar el texto de las resenas de Tripadvisor o Booking.
Viola sus terminos, expone a reclamos de copyright, y ademas hunde el SEO por
contenido duplicado, que es justo lo contrario de lo que el sitio necesita.

### Fase 2 - Resenas propias (meses 3-12)

Se siembra la base de resenas propias con tres palancas, en este orden de
rendimiento:

1. **QR en el mostrador del negocio.** Se le entrega a cada negocio que reclama
   su ficha un QR que lleva directo al formulario de resena de SU ficha. Es la
   fuente mas barata y la de mayor conversion.
2. **Correo posterior a la reserva.** Si el sitio intermedio la reserva, sabe
   cuando termino la visita y puede pedir la resena en el momento justo.
3. **Perfil de colaborador.** Insignias por numero de resenas y fotos aportadas,
   con un ranking local. Funciona bien con el residente y el guia, no con el
   turista de paso.

### Fase 3 - Datos propios (ano 2 en adelante)

Cuando hay volumen propio, el agregado externo pasa a segundo plano y el sitio
tiene lo que ninguna otra plataforma tiene de La Fortuna: series de precios,
estacionalidad real, y resenas en espanol de gente de la zona.

## 3. Stack

| Capa | Eleccion | Por que |
|---|---|---|
| Framework | Next.js (App Router) en TypeScript | Renderizado en servidor, que es innegociable para un directorio que vive del SEO. Rutas por idioma nativas. |
| Estilos | Tailwind CSS | Velocidad de iteracion y consistencia sin CSS suelto. |
| Base de datos | Supabase (Postgres 17), esquema `directorio` | Ya la usa el resto de los proyectos. Postgres da busqueda de texto completo y PostGIS sin pagar otro servicio. |
| Autenticacion | Supabase Auth | Google y correo. Necesaria para resenas propias y para reclamar fichas. |
| Imagenes | Supabase Storage + `next/image` | Fotos de resenas y logos, con transformacion al vuelo. |
| Hosting | Vercel | Despliegue desde el repo y CDN. Ya esta el conector disponible. |
| Mapas | Leaflet + OpenStreetMap | Sin costo por carga de mapa. Google Maps solo si hace falta Street View. |
| Datos externos | Google Places API | Coordenadas, horarios, rating, conteo y hasta 5 resenas con atribucion. |
| Busqueda | `tsvector` de Postgres, en espanol e ingles | Suficiente hasta decenas de miles de fichas. No hace falta Algolia todavia. |

## 4. Mapa de rutas

```
/es                                    portada
/es/hoteles                            listado con filtros
/es/hoteles/tabacon-thermal-resort     ficha
/es/restaurantes
/es/tours
/es/atracciones
/es/parques
/es/transporte
/es/comercio
/es/buscar?q=&categoria=&precio=&nota= resultados
/es/mapa                               todas las fichas sobre el mapa
/es/guias/como-llegar-a-monteverde     articulos de guia
/es/negocio/reclamar                   flujo del duenno
/es/perfil/<usuario>                   colaborador y sus resenas
/en/...                                el espejo completo en ingles

/api/resenas                           alta de resena propia
/api/negocios/<id>/reclamar
/webhooks/places-refresh               refresco del cache externo
```

Cada ficha lleva `hreflang` cruzado entre `/es` y `/en`, y JSON-LD de
`LocalBusiness` con `aggregateRating` calculado **solo con resenas propias**.
Marcar como propias las notas de Google seria enganar al buscador y arriesga una
penalizacion manual.

## 5. Modelo de datos

Doce tablas en el esquema `directorio`. El detalle campo por campo esta en
`03-modelo-datos.md`; aqui va la forma general.

```
                        ┌──────────────┐
                        │  categoria   │  hoteles, restaurantes, tours,
                        └──────┬───────┘  atracciones, parques, transporte,
                               │          comercio (jerarquica: padre_id)
                               │ 1:N
                        ┌──────▼───────┐
          ┌─────────────┤   negocio    ├─────────────┐
          │             └──────┬───────┘             │
          │ 1:N                │ 1:N                 │ N:M
   ┌──────▼───────┐     ┌──────▼────────┐     ┌──────▼───────┐
   │    resena    │     │ resena_externa│     │  etiqueta    │
   │  (propias)   │     │ (cache Google │     │ pet friendly,│
   └──────┬───────┘     │  y agregados) │     │ vista volcan │
          │             └───────────────┘     └──────────────┘
          │ 1:N
   ┌──────▼───────┐     ┌───────────────┐     ┌──────────────┐
   │ resena_foto  │     │ negocio_horario│    │ negocio_foto │
   └──────────────┘     └───────────────┘     └──────────────┘

   ┌──────────────┐     ┌───────────────┐     ┌──────────────┐
   │    perfil    │     │ reclamo_negocio│    │ redireccion  │
   │ (extiende    │     │ (dueno pide su │    │ (babosas     │
   │  auth.users) │     │  ficha)        │    │  viejas)     │
   └──────────────┘     └───────────────┘     └──────────────┘
```

Las dos decisiones que sostienen todo el modelo:

**Una sola tabla `negocio` para las siete categorias.** Un hotel, una catarata y
un rent-a-car comparten el 90% de los campos: nombre, contacto, ubicacion,
fotos, resenas. Lo que no comparten va en `atributos` (`jsonb`), donde el hotel
guarda `{"estrellas": 4, "piscina": true}` y la catarata
`{"altura_metros": 70, "escalones": 500}`. Siete tablas paralelas obligarian a
siete consultas para pintar la busqueda global y a duplicar el sistema de
resenas siete veces.

**Resenas propias y externas en tablas separadas.** Tienen dueno distinto,
ciclo de vida distinto y obligaciones legales distintas. Las propias son del
sitio y viven para siempre; las externas son cache con vencimiento y atribucion
obligatoria. Mezclarlas en una tabla con una columna `origen` haria que un
`DELETE` mal escrito borrara resenas de usuarios reales, y que fuera facil
colarlas por error en el `aggregateRating` del JSON-LD.

## 6. Ingesta de datos

Tres fuentes, tres niveles de confianza. La columna `negocio.fuente_dato` deja
registro de cual alimento cada ficha.

| Fuente | Que trae | Frecuencia | Confianza |
|---|---|---|---|
| Siembra manual investigada | Nombre, telefono, web, email, descripcion | Una vez | Alta |
| Google Places API | Coordenadas, horarios, rating, conteo, hasta 5 resenas | Semanal | Alta |
| Raspado del sitio del propio negocio | Email de contacto, precios, logo | Mensual | Media |
| El dueno tras reclamar la ficha | Todo, y manda sobre lo anterior | Cuando el quiera | Maxima |

Sobre el raspado: **solo se raspa el sitio web del propio negocio**, que es
informacion que ese negocio publica para que la lean sus clientes, respetando su
`robots.txt`, con un identificador propio en el agente de usuario
(`visitlafortunacr-bot`) y un limite de una peticion cada dos segundos. No se
raspan plataformas de terceros.

Los logos no se toman del sitio del negocio sin permiso: son marca registrada.
Hasta que el negocio reclame su ficha y suba el suyo, la ficha muestra un
marcador generado con la inicial del nombre sobre el color de su categoria.

## 7. SEO

Un directorio vive o muere de la busqueda organica. Lo que se hace desde el
primer despliegue:

- Renderizado en servidor de todas las fichas y listados.
- JSON-LD `LocalBusiness` por ficha, `ItemList` por listado, `BreadcrumbList`
  en ambos, `FAQPage` en las guias.
- `hreflang` reciproco entre `/es` y `/en` mas `x-default`.
- Sitemap partido por categoria e idioma, regenerado a diario.
- Meta descripcion escrita por ficha, nunca autogenerada por plantilla.
- Contenido propio irreemplazable: guias de rutas, comparativas de termales,
  tabla de precios de entradas actualizada. Eso es lo que trae el enlace y la
  visita recurrente.
- `aggregateRating` en el marcado **solo con resenas propias verificadas**.

## 8. Monetizacion

En orden de cuando conviene activarla:

1. **Perfil destacado.** Posicion superior en su categoria, marcado como
   contenido pagado. Se puede vender desde el mes uno.
2. **Comision por reserva.** Enlaces de afiliado a Booking y a los operadores de
   tours, que es donde esta el margen real en La Fortuna.
3. **Perfil premium del negocio.** Galeria ampliada, respuesta a resenas,
   estadisticas de visitas de su ficha, menu o lista de tours embebidos.
4. **Publicidad local.** Solo de negocios de la zona, y nunca dentro del bloque
   de resenas.

Regla que no se negocia: **el dinero no mueve el orden de las resenas ni la
nota**. Un destacado se ve arriba y dice que es pagado; su nota es la que sea.
El dia que eso se rompa, el sitio pierde lo unico que lo hace util.

## 9. Fases de entrega

| Fase | Que se entrega | Estado |
|---|---|---|
| 0 | Investigacion, arquitectura, nomenclatura, esquema y siembra | **este entregable** |
| 1 | Portada, listados, fichas y busqueda, bilingue, solo lectura | siguiente |
| 2 | Cuentas, resenas propias con fotos, moderacion | |
| 3 | Reclamo de fichas y panel del negocio | |
| 4 | Destacados, afiliados y estadisticas | |
