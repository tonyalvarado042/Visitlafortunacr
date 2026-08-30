# Modelo de datos de visitlafortunacr

Catorce tablas en el esquema `directorio` de Supabase. Aqui esta el porque de
cada una; el DDL exacto vive en `supabase/migraciones/`.

## Mapa rapido

| Tabla | Que guarda | Quien escribe |
|---|---|---|
| `categoria` | Las 7 categorias y sus subcategorias | Redaccion |
| `etiqueta` | Rasgos filtrables: wifi, vista al volcan, solo adultos | Redaccion |
| `negocio` | La ficha. El centro de todo | Redaccion, luego el dueno |
| `negocio_etiqueta` | Que etiquetas lleva cada ficha | Redaccion |
| `negocio_horario` | Horario por dia de la semana | Dueno o Google Places |
| `negocio_foto` | Galeria oficial | Dueno o redaccion |
| `perfil` | Quien usa el sitio | La persona |
| `resena` | Resenas propias | Visitantes |
| `resena_foto` | Fotos de una resena | Quien la escribio |
| `resena_util` | Votos de "me sirvio" | Visitantes |
| `resena_externa` | Nota y conteo de Google, Tripadvisor, Booking | Proceso automatico |
| `resena_externa_extracto` | Las 5 resenas con texto de Google | Proceso automatico |
| `reclamo_negocio` | Un dueno pide su ficha | El dueno |
| `redireccion` | Babosas retiradas, para servir 301 | Sistema |

## Las cuatro decisiones que sostienen el modelo

### 1. Una sola tabla `negocio` para las siete categorias

Un hotel, una catarata y un rent-a-car comparten el 90% de lo que el sitio
necesita: nombre, contacto, ubicacion, fotos, resenas, estado de publicacion.
Lo que no comparten cabe en `atributos`, de tipo `jsonb`:

```json
Hotel            {"estrellas": 4, "tiene_aguas_termales": true}
Catarata         {"altura_metros": 70, "escalones": 500}
Tour de canopy   {"cables_big_ama": 12, "duracion": "medio dia"}
Rent-a-car       {"servicios": ["alquiler", "shuttle privado"]}
```

Con siete tablas paralelas, la busqueda global necesitaria siete consultas y un
`union`, y el sistema de resenas habria que escribirlo siete veces. La regla de
mantenimiento: **cuando un campo de `atributos` empieza a usarse para filtrar o
para ordenar, se asciende a columna real con su indice**. `jsonb` es el borrador,
no el destino final.

### 2. Resenas propias y externas en tablas distintas

No es purismo, son cuatro diferencias concretas:

| | `resena` | `resena_externa` |
|---|---|---|
| De quien es | Del sitio y de quien la escribio | De Google, Tripadvisor o Booking |
| Cuanto vive | Para siempre | Hasta `expira_en` |
| Entra en el promedio | Si | Nunca |
| Si se borra por error | Se pierde contenido irrecuperable | Se vuelve a pedir a la API |

Una sola tabla con una columna `origen` haria que un `DELETE` mal escrito
borrara resenas de gente real, y que fuera facil colar notas ajenas en el
`aggregateRating` del marcado, que es exactamente el tipo de cosa por la que
Google aplica una penalizacion manual.

El campo `expira_en` no es decorativo: los terminos de Google Places prohiben
almacenar sus datos de forma indefinida. Con la fecha en la fila, el
cumplimiento es una condicion en la politica RLS y no la buena memoria de
alguien:

```sql
create policy "cualquiera lee agregados externos vigentes"
  on directorio.resena_externa for select
  using (expira_en > now());
```

Vencido el plazo, el dato deja de mostrarse solo.

### 3. Los contadores se calculan con triggers, no a mano

`negocio.total_resenas`, `negocio.promedio_calificacion`, `perfil.total_resenas`
y `resena.total_util` estan desnormalizados: un listado de 40 fichas no puede
hacer 40 subconsultas de agregacion.

Los mantienen triggers, nunca la aplicacion. Si el calculo estuviera en el
codigo del sitio, bastaria una insercion desde el panel de Supabase o desde un
script de importacion para que los numeros dejaran de cuadrar en silencio.

`recalcular_calificacion_negocio()` filtra por `estado = 'publicada'`, asi que
una resena pendiente de moderacion no mueve la nota mientras espera.

### 4. Todo campo publico es bilingue con columnas hermanas

`nombre_es`/`nombre_en`, `descripcion_es`/`descripcion_en`,
`babosa_es`/`babosa_en`. Se descarto una tabla `traduccion` aparte porque solo
hay dos idiomas fijos y obligaria a un `join` en el listado, que es la consulta
mas frecuente del sitio.

Excepcion deliberada: **`negocio.nombre` no se traduce**. Don Rufino se llama
Don Rufino en las dos versiones. Traducir nombres propios rompe la busqueda y
confunde a quien llega con el nombre que vio en un cartel.

Regla operativa: el espanol es obligatorio, el ingles puede estar vacio. Cuando
falta, el sitio cae al espanol y la ficha entra a la cola de traduccion.

## Integridad: lo que la base no deja hacer

Las reglas de negocio estan en la base, no solo en el formulario. Un formulario
se salta; una restriccion no.

| Restriccion | Que impide |
|---|---|
| `ck_negocio_telefono_e164` | Guardar `2479-9997` en vez de `+50624799997`. Formato unico o el enlace `tel:` no funciona en la mitad de los telefonos |
| `ck_negocio_publicado_tiene_descripcion` | Publicar una ficha vacia |
| `ck_resena_calificacion_rango` | Una calificacion de 0 o de 6 |
| `ck_resena_cuerpo_minimo` | Resenas de 40 caracteres o menos, que no le sirven a nadie que este decidiendo |
| `ck_resena_visita_no_futura` | Resenar una visita que aun no ocurrio |
| `uq_resena_autor_por_negocio` | Que una persona inflen la nota con diez resenas del mismo sitio |
| `ck_resena_rechazo_con_motivo` | Rechazar una resena sin decir por que |
| `uq_reclamo_negocio_pendiente` | Dos reclamos abiertos a la vez sobre la misma ficha |
| `uq_negocio_foto_portada` | Dos fotos de portada compitiendo |
| `ck_negocio_email` y `ck_negocio_sitio_web` | Correos y URLs mal formados que rompen la ficha al pintarla |

## Busqueda

`negocio.busqueda_es` y `busqueda_en` son columnas `tsvector` generadas, con
indice GIN y pesos: el nombre pesa mas que el resumen, y el resumen mas que la
descripcion.

```sql
select nombre, ts_rank(busqueda_es, q) as relevancia
  from directorio.negocio, plainto_tsquery('spanish', 'termales cerca del volcan') q
 where busqueda_es @@ q and estado_publicacion = 'publicado'
 order by relevancia desc;
```

Al ser columna generada, se recalcula sola en cada `UPDATE`. No hay forma de que
el indice quede desfasado del contenido. Postgres aguanta esto sin problema
hasta decenas de miles de fichas; La Fortuna tiene unos cientos de negocios, asi
que no hace falta un motor de busqueda aparte ni ahora ni en varios anos.

## Seguridad

RLS activo en las catorce tablas. Las politicas se leen como frases:

- `"cualquiera lee negocios publicados"` — un borrador no se filtra por la API
  publica aunque alguien adivine su id.
- `"cada quien escribe sus propias resenas"` — obliga a
  `autor_id = auth.uid()`, a `estado = 'pendiente'` y a que el negocio este
  publicado. Nadie puede publicar su propia resena sin pasar por moderacion, ni
  resenar una ficha que todavia no existe de cara al publico.
- `"cada quien edita su resena y vuelve a moderacion"` — editar devuelve la
  resena a la cola. Sin esto, alguien publica algo inocuo, espera la aprobacion
  y luego lo cambia por lo que quiera.
- `"cualquiera lee agregados externos vigentes"` — el vencimiento del cache es
  parte de la politica de lectura.

Las funciones de trigger van con `security definer` y `set search_path = ''`,
con cada objeto calificado por su esquema: sin eso, alguien que pueda crear un
esquema en la ruta de busqueda podria suplantar una tabla y hacer que la funcion
privilegiada opere sobre la suya.

La vista `v_negocio_publicado` se creo con `security_invoker = true`, de modo que
aplica las politicas de quien consulta y no las de quien la creo. Una vista sin
esa opcion es una puerta trasera alrededor de RLS.

## Lo que falta antes de abrir al publico

1. **Exponer el esquema en la API.** En Supabase, Settings > API > Exposed
   schemas, agregar `directorio`. Sin eso PostgREST no lo sirve y el sitio no
   ve nada.
2. **Trigger de alta de perfil.** Un `after insert` sobre `auth.users` que cree
   la fila en `directorio.perfil`. Se deja para la fase de cuentas, junto con la
   politica de moderadores.
3. **Politicas de escritura para moderadores y duenos.** Hoy solo puede escribir
   el autor sobre lo suyo. Moderar y responder resenas necesita politicas por
   rol, que se agregan con el panel de administracion.
4. **Coordenadas.** `latitud` y `longitud` estan vacias en la siembra. Las trae
   Google Places en la misma llamada que el rating.
5. **Storage.** Dos buckets, `logos` y `fotos`, con politicas propias.
