# Módulo de marketing — diseño

**6 de noviembre de 2026.** Pedido por Tony:

> *«ve diseñando un módulo de marketing completo para enviar»*
>
> *«Cada persona entra como lead con etiqueta. Y se pueden hacer envíos de
> novedades manuales o también automáticos cada semana con novedades de la
> fortuna»*

Esto es un diseño, no código. Dos cosas incómodas primero, porque cambian el
orden de todo:

> **1. La mitad del módulo ya está construida y nunca mandó un correo.**
>
> **2. La lista son 8 personas y hay 2 negocios nuevos por semana.** El cuello
> no es la máquina. Es la lista.

---

## 1. Los números, medidos hoy

| | |
|---|---|
| Viajeros en la base | **9** |
| Que aceptan marketing, sin baja, sin no-molestar | **8** |
| Negocios publicados en total | 66 |
| Negocios nuevos últimos 7 días | **2** (uno hoy) |
| Negocios nuevos últimos 30 días | 3 |
| Tours publicados | 2 |
| Reseñas, en total | 1 |
| Guías | 10 |

**Qué significa:** un boletín semanal tiene con qué llenarse —2 o 3 lugares
nuevos es un boletín corto y honesto— pero le llega a ocho personas. Construir
el módulo está bien; esperar resultado de ocho envíos, no. La palanca es la
puerta de entrada, y sobre eso vuelvo en §3.

---

## 2. Lo que YA existe (medido, no supuesto)

| Pieza | Dónde | Estado |
|---|---|---|
| **Cuello de botella único de envío** | `enviarAViajero` en `lib/ia/mensajeria.ts` | Funciona. WhatsApp si lo hay, si no correo. Respeta `no_molestar` y —desde hoy— `baja`. |
| **Correo** | `lib/correo/enviar.ts` → Resend | Funciona. Llave en la bóveda (`dst_secreto`), puesta el 10 oct 2026. |
| **Plantilla** | `lib/correo/plantilla.ts` | HTML **y** texto. 5 idiomas. Pie propio y `token_baja`. |
| **Automatizaciones 1:1** | `dst_automatizacion` + `_envio` | 10 activas. Armadas hoy. |
| **Motor de cadenas (goteo)** | `dst_cadena`, `_paso`, `_inscrito`, `_envio` + `lib/cadenas.ts` | **Construido y bien construido. Nunca ha corrido.** |
| **Pantalla de cadenas** | `/admin/cadenas` | Existe. |
| **Plantillas de mensaje** | `dst_plantilla_mensaje` (16) + `plantilla_para(destino, clave, canal, idioma)` | Funciona, por canal e idioma. |
| **Etiquetas** | `dst_etiqueta` (26) + `dst_negocio_etiqueta` | Existe — pero **solo para negocios**. Ver §3. |
| **Cola de trabajos** | `enSegundoPlano` → `visit-la-fortuna-trabajos` | Existe. Hoy `maxBatchSize: 1`. |
| **Baja** | `/baja`, `dst_viajero.token_baja`, `.baja` | La ruta existía; el guardia se agregó hoy. |

### La ley del módulo, que ya estaba escrita en `lib/cadenas.ts`

> *«el botón "ver qué saldría" del panel llama a la MISMA consulta que el cron.
> Si la prueba mirara otra cosa que el envío, no probaría nada.»*

No se diseña nada que se pruebe mirando una consulta distinta de la que manda.
Ese paso de contar es el que hoy evitó creer que había una ráfaga cuando eran
cuatro mensajes.

### Por qué las cadenas nunca mandaron nada

> ⚠️ **Corregido el 7 de noviembre de 2026. El punto 1 de esta lista estaba
> MAL, y era el más importante de los tres.**
>
> Decía *«nadie inscribe a nadie»*, y lo decía porque yo busqué la tabla en el
> TypeScript y no en las funciones de la base. **Dos de las tres cadenas sí
> tienen puerta de entrada, y está escrita en SQL:**
>
> | Cadena | Público | Quién inscribe | Pasos |
> |---|---|---|---|
> | `rifa` | `sorteo` | `participar_en_sorteo` | 4 |
> | `contacto` | `contacto_negocio` | `pedir_contacto_de_negocio` | 3 |
> | `premium` | `comerciante_gratis` | **nadie** | 4 |
>
> `inscribir_en_cadena` arranca con `where ... and c.esta_activa` y **devuelve
> sin hacer nada si la cadena está apagada**. Por eso `dst_cadena_inscrito`
> tiene cero filas: no es que falte la puerta, es que el interruptor está en
> apagado.
>
> **Lo que eso cambia:** encender la cadena `rifa` no es construir nada. Es un
> `update ... set esta_activa = true`, y a partir de ahí **todo el que se
> apunte al sorteo entra a un goteo de 4 pasos**. Por eso NO se enciende sin
> que Tony lea antes los 4 correos en pantalla — la regla de siempre.
>
> La lección: *buscar en el código no es buscar en el sistema.* La mitad de
> este proyecto vive en funciones de Postgres, y un `grep` por `.ts` no las ve.

1. ~~Nadie inscribe a nadie.~~ Ver el cuadro de arriba: dos de tres sí
   inscriben, pero la inscripción no ocurre con la cadena apagada.
2. **Las tres están apagadas**: `contacto`, `premium`, `rifa`.
3. **Los pasos solo tienen `es` y `en`.** El sitio sirve **tres** idiomas
   (`es`, `en`, `pt`), no cinco: `/fr` y `/de` redirigen a `/es`. Falta `pt`.

---

## 3. «Cada persona entra como lead con etiqueta»

### Ya entra con etiquetas, y tres de ellas están poblados

| Campo | Qué es | Qué hay hoy |
|---|---|---|
| `dst_viajero.origen` | **Por qué puerta entró** | `sorteo` (5), `planificador` (3), `reserva` (1) |
| `dst_viajero.intereses` | Arreglo de intereses | `aguas-termales`, `rafting`, `comida`, `aventura`, `bienestar`, `naturaleza` |
| `dst_viajero.tipo_viajero` | Con quién viaja | `pareja`, `amigos`, `familia` |
| `pais_iso`, `idioma` | De dónde y en qué idioma | poblados |

O sea: **lo que pedís existe a medias y ya funciona.** Falta tres cosas.

### a) ✅ HECHO el 7 de noviembre de 2026: el sorteo ya etiqueta

> La pregunta NO quedó como un cuarto campo del formulario, sino en la pantalla
> de «¡Ya estás adentro!», después de apuntarse. El propio
> `FormularioSorteo.tsx` traía escrito que *«cada campo que se agrega cuesta
> participantes»*, y tiene razón: preguntando después, la conversión ya está
> en el banco y la pregunta no cuesta ninguno.
>
> Y las etiquetas quedaron en **tabla propia** (`dst_viajero_etiqueta`), que
> era la recomendación de §3c. Ver
> `supabase/plataforma/33_etiquetas_de_personas.sql` y `lib/intereses.ts`.

### a) El problema que esto resolvía

**Los 5 viajeros que entraron por `sorteo` tienen `intereses` VACÍO.** Los que
entraron por el planificador sí los traen. Es decir: la puerta por la que
entra más de la mitad de la gente los mete sin una sola etiqueta de interés.

Eso es lo primero que arreglaría de todo el módulo. No porque sea difícil —es
una pregunta más en el formulario de la rifa— sino porque **sin interés no hay
segmento**, y sin segmento el boletín le manda lo mismo a todos.

### b) `dst_etiqueta` NO sirve para personas

Sus 26 etiquetas están agrupadas en `servicio`, `ambiente`, `pago`,
`accesibilidad`, `publico`: *«Wifi gratis»*, *«Vista al volcán»*, *«Acepta
mascotas»*. **Son atributos de un negocio.** Etiquetar a una persona con «Wifi
gratis» no significa nada.

Hace falta vocabulario propio para personas, con el **mismo patrón** que ya
existe para negocios (`dst_negocio_etiqueta`):

```
dst_viajero_etiqueta (viajero_id, etiqueta_id, creado_en, puesta_por)
```

…y los grupos nuevos en el enum de `dst_etiqueta.grupo`:

| Grupo | Para qué | Ejemplos |
|---|---|---|
| `origen` | Por qué puerta entró | rifa, planificador, reserva, desbloqueó un teléfono |
| `interes` | Qué le gusta | aguas termales, rafting, aves, comida, bienestar |
| `momento` | Dónde está en su viaje | solo mirando, con fechas, ya reservó, ya vino |
| `mano` | Lo que pone Tony a mano | VIP, agencia, repetidor, prensa |

### c) La decisión: ¿`intereses` o tabla propia?

- **`intereses`** (arreglo de texto) ya existe y es gratis. Pero es texto
  libre: el día que alguien escriba `aguas termales` con espacio en vez de
  `aguas-termales`, esa persona **desaparece del segmento sin avisar**.
- **Tabla propia** cuesta una migración y una pantalla, y da vocabulario
  controlado, grupos, iconos y consistencia con negocios.

**Recomiendo la tabla propia**, justo porque de esto van a colgar los envíos.
Un segmento que pierde gente por un dedazo es peor que no tener segmento: no
falla, miente.

---

## 4. «Novedades manuales o automáticas cada semana»

### El boletín se arma solo, de lo que ya hay en la base

No hay que escribir contenido nuevo: las novedades **ya están**, con fecha.

| Sección | De dónde sale |
|---|---|
| Lugares nuevos | `dst_negocio` donde `publicado_en` cayó en la semana |
| Tours nuevos | `dst_tour` publicados en la semana |
| Lo que dijo la gente | `dst_resena` de la semana |
| Guía de la semana | `dst_guia` |
| El sorteo | la rifa, si está abierta |

Una función en la base —`novedades_de_la_semana(destino_id, desde, hasta)`—
y **la misma función** alimenta el botón de vista previa y el cron. La ley de
§2.

### Manual y automático son el mismo camino, con un interruptor

```
armar  →  vista previa en los 5 idiomas  →  prueba a uno mismo
       →  contar a cuántos + muestra de quiénes  →  APROBAR
       →  cola  →  mandar con tope por minuto  →  reporte
```

- **Manual:** Tony entra, ve lo que la consulta encontró, le cambia lo que
  quiera, le agrega una nota suya, y aprueba.
- **Automático semanal:** el mismo camino sin el paso de aprobar.

### ⚠️ El piso: un boletín vacío es peor que ningún boletín

Con 2 o 3 novedades por semana, va a haber semanas con cero. **El automático
no debe mandar si no hay con qué.** La regla: si la consulta devuelve menos de
N novedades (propongo 3), no sale y queda anotado por qué.

Un boletín que llega vacío enseña a no abrirlo, y después a darse de baja. Y
la baja es para siempre.

### Qué reusar y qué no tocar

- Reusar `lib/correo/plantilla.ts` tal cual: ya rinde HTML **y** texto, 5
  idiomas, pie propio y `token_baja`.
- Reusar la cola (`enSegundoPlano`) para el envío, no el bucle del cron.
- Reusar `enviarAViajero` como única salida, para que el guardia de `baja`
  valga también acá.
- **No** un motor nuevo de secuencias: ya hay uno.
- **No** sistema de envío propio: Resend anda.

---

## 5. Lo que falta de fontanería, y duele si falta

### a) El consentimiento, y la diferencia que importa
- **`baja`** → absoluta. Bloquea todo lo automático. (Ya está.)
- **`acepta_marketing`** → **hoy no se usa en ninguna parte**, y 8 de 9 lo
  tienen en `true`. Es la puerta de **las campañas y el boletín**, y **no** la
  de lo transaccional: un «tres días antes de llegar» a quien ya reservó es
  servicio, no mercadeo.

### b) Rebotes y supresión — lo más importante de esta lista
Resend avisa de rebotes y quejas por webhook y **nada los capta**. Mandarle
tres veces a una dirección que rebotó duro quema el dominio, y el síntoma es
que dejan de llegar **todos** los correos, los transaccionales incluidos.

Un webhook → tabla de supresión, y que `enviarAViajero` la mire en el mismo
lugar donde ya mira `baja`. **Esto va antes del primer envío masivo**, no
después.

### c) Medición
Aperturas, clics, y sobre todo **atribución**: qué boletín produjo una
reserva. Sin eso no se sabe qué repetir.

---

## 6. Orden que propongo

| Fase | Qué | Por qué en este lugar |
|---|---|---|
| **0** | **Que el sorteo etiquete.** Una pregunta de intereses en el formulario de la rifa. | Es la puerta más grande y hoy no etiqueta nada. Sin esto el boletín es uno solo para todos. |
| **1** | Rebotes + `acepta_marketing` como puerta | Antes del primer envío masivo. Después ya se quemó el dominio. |
| **2** | `dst_viajero_etiqueta` + grupos nuevos + poner etiquetas a mano en `/admin/viajeros` | Es la pieza de la que cuelga todo lo demás. |
| **3** | `novedades_de_la_semana()` + boletín manual con el ritual completo | Ya con red debajo. |
| **4** | El interruptor de automático semanal, con el piso de §4 | Solo cuando el manual ya salió bien dos o tres veces. |
| **5** | Encender las 3 cadenas: inscripción, activarlas, llenar pt/fr/de | Vale, pero es otro frente; el boletín le pega a toda la lista y las cadenas a una puerta cada una. |
| **6** | Medición y atribución | Cuando haya algo que medir. |

---

## 7. Lo que hay que decidir (no lo decido yo)

1. **¿Etiquetas en tabla propia o reusar `intereses`?** Recomiendo tabla.
2. **¿Canal?** Correo solo, o también WhatsApp — que tiene reglas de Meta,
   plantillas aprobadas y **costo por mensaje**. Resend ya está pagado.
3. **¿A quién?** `dst_cadena_inscrito` ya tiene `viajero_id` **y**
   `comerciante_id`: el motor se diseñó para los dos. ¿El boletín va a
   viajeros, a negocios, o a los dos? Son boletines distintos.
4. **¿Cuántos idiomas?** Cinco sirve el sitio. Cada boletín en cinco idiomas
   es traducción cada semana.
5. **¿Cuál es el piso de novedades** para que el automático salga? Propongo 3.
