# El cerebro de Visit La Fortuna CR

Léeme antes de tocar nada. Aquí están las decisiones ya tomadas y dónde vive
cada cosa. Si algo cambia, se corrige **aquí primero**.

---

## Qué es esto

No es un directorio. Es una **plataforma privada de destinos**: contenido +
directorio + planificador + marketplace de tours + captación de leads +
agencia. El primer destino es La Fortuna; el objetivo es replicarla a cientos
de destinos en el mundo.

Referencias: Banff & Lake Louise Tourism (su Trip Builder generó 61.000
itinerarios y 323.000 referidos a negocios en 2025), Visit Iceland y
New Zealand Tourism.

---

## Dónde vive cada base de datos

| Qué | Proyecto Supabase | Esquema | Ojo |
|---|---|---|---|
| **La plataforma** | `visitdestinos` (`eulkufetcymallfbpone`) | `destinos`, prefijo `dst_` | **Aquí se trabaja.** |
| **CRM real de Tony** | `tonyalvarado042's Project` (`mlhhhwbgymobcxiklnoz`) | **`crm_tony_alvarado`**, tabla **`cta_contactos`** (1.377) | Inversionistas. **NO se mezcla.** |
| Copia vieja del CRM | Mismo proyecto | `public.crm_tony_alvarado_contactos` (872, sin correos) | **Obsoleta. No usarla ni citarla.** |
| Humaya | Mismo proyecto | `public.subscribers`, `public.booking_requests` | Nada que ver. |
| GraceDay | `vnjiwlauuezhuoalacwu` | `public`, prefijo `graceday_` | App aparte. |

**El CRM de inversionistas y el de viajeros están separados a propósito.** Un
copropietario y un turista no comparten llave de identidad (teléfono vs.
correo), ni embudo, ni ciclo de vida. La plataforma tiene su propio CRM en
`dst_viajero`, `dst_solicitud`, `dst_reserva`. Si algún día hay que cruzarlos,
se hace con una vista, nunca mezclando tablas.

---

## Reglas que no se discuten

1. **Una sola base para todos los destinos.** El destino es una fila, no un
   despliegue. Lanzar VisitMonteverdeCR es una llamada a
   `destinos.lanzar_destino(...)`. Todo cuelga de `destino_id`, y las
   políticas de acceso también: eso es lo que impide que un destino vea el
   contenido o los clientes de otro.
2. **Nomenclatura**: esquema propio + prefijo de tres letras, como el CRM usa
   `cta_`. Aquí es `dst_`. Español, snake_case, tablas en singular, y
   `COMMENT ON TABLE` que diga para qué sirve **y qué no es**.
3. **Cinco idiomas: es, en, pt, fr, de.** El texto del idioma principal del
   destino vive en la fila; los demás en `dst_traduccion`, y las URLs de cada
   idioma en `dst_ruta`. Agregar japonés es insertar filas, no alterar tablas.
   Si falta una traducción, cae al idioma principal: una ficha a medio traducir
   se ve completa. Excepción: `dst_negocio.nombre` no se traduce.
4. **Las reseñas ajenas no se copian ni se pegan a mano.** Se muestra la nota
   y el conteo con enlace a la fuente. Solo Google Places entrega texto, y con
   vencimiento (`expira_en`), que además está metido en la política de lectura.
   Ese texto **entra por la API oficial** (`lib/externas/`, botón en el panel y
   cron diario), nunca raspando páginas ni escribiendo filas en Supabase: si
   hay que pegarlo a mano, es que no hay licencia para mostrarlo.
   **Tripadvisor y Booking no tienen puerta abierta**: Tripadvisor exige pedir
   acceso a su Content API y mostrar su logo; Booking solo abre reseñas a sus
   afiliados. Hasta que haya acuerdo, de esas dos solo la nota y el enlace,
   cargados a mano en `/admin/negocios/[id]`.
5. **Neutralidad editorial.** Bike & Bed y los hoteles propios llevan
   `es_casa = true`, que es **interno y nunca se muestra**. Aparecen donde
   genuinamente corresponden ("mejores hoteles para ciclistas"). La ventaja
   viene de controlar el canal, no de decir que somos los dueños.
6. **El dinero no mueve la nota.** Un destacado se ve arriba y se rotula como
   pagado. Su calificación es la que sea.
7. **El sitio público escribe solo por funciones, nunca contra una tabla.**
   Hay dos puertas y no se abren más sin anotarlo aquí:
   `destinos.registrar_solicitud(...)` para los leads y
   `destinos.registrar_resena(...)` para las reseñas. Cada una valida el
   destino, valida lo suyo y no deja tocar ninguna otra columna. No hay INSERT
   directo desde la llave pública a ninguna tabla.
8. **Dos sesiones trabajan a la vez, dos personas.** La rama
   `claude/la-fortuna-directory-design-l8qnxg` la empuja más de uno. Antes de
   publicar: `git fetch` y **rebase** sobre el remoto, nunca `push --force` ni
   descartar lo ajeno. Si el rebase choca, se avisa y se resuelve a mano; el
   trabajo del otro no se pisa.
   **Ojo con `definir-fases`**: esa rama tiene su propia versión de este
   archivo, divergente. No se trae con `git checkout <rama> -- CLAUDE.md`
   —eso pisa el archivo entero y se lleva por delante lo del otro sin
   avisar—: se mira la diferencia y se injerta a mano lo que falte.
9. **No todas las sesiones pueden lo mismo, y hay que decirlo de entrada.**
   Una sesión en **la nube** (Claude Code on the web) corre en un contenedor de
   Anthropic detrás de un proxy de egress: **no** alcanza GoDaddy, Vercel,
   `*.supabase.co` ni el sitio desplegado, y **no** ve el navegador de nadie;
   sí trabaja la base por el conector de Supabase, lee DNS, compila y publica
   en git. Una sesión **local** (Claude Code en la máquina de Tony o de
   Sebastián) no tiene ese proxy: alcanza todo y puede manejar un navegador de
   verdad, con quien corresponda haciendo el login cuando haga falta. Al
   arrancar una tarea que dependa de un panel externo, **se aclara en la
   primera respuesta desde dónde se está corriendo**, en vez de dejar que se
   descubra a la tercera vez.
   **Comprobado el 11 de septiembre de 2026 desde la máquina de Sebastián**:
   con `SUPABASE_SECRET_KEY` en `.env.local` se leen y escriben datos por
   PostgREST sin el conector. Lo que ni así se puede es **DDL** —`alter table`,
   `create function`, `grant`—: eso no pasa por PostgREST y necesita el SQL
   Editor del panel o la contraseña de la base.
10. **Lo que se hace a mano se anota aquí, no se pregunta.** Claude no tiene
   acceso a GoDaddy, Vercel, el panel de Supabase, Meta ni SiteGround. Cuando
   Tony diga "entrá a GoDaddy" (o a cualquiera de esas), la respuesta NO es
   pedir permiso ni explicar que no se puede: es dejar escrito en
   **Trabajo a mano** de este archivo el paso exacto, con los valores exactos
   que hay que pegar, y avisar que quedó anotado. Si un valor lo decide el
   proveedor en pantalla, se dice cuál manda.
11. **Las fotos de los negocios: el derecho de autor se ignora a propósito
   hasta que llegue Google Places.** Lo decidieron Sebastián y Tony el 12 de
   septiembre de 2026, sabiendo lo que implica: que una foto es de quien la
   tomó, que poner el crédito no es tener licencia, y que el reclamo llega a
   quien publica. La decisión es que **para el MVP una foto que corresponda al
   negocio vale más que el riesgo de usarla unos meses**, y no se vuelve a
   discutir mientras esta regla diga esto.
   En claro: **las fotos se sacan de internet, de donde se encuentren.** No hay
   que verificar licencia, ni llenar `credito`, ni `licencia`, ni `fuente_url`.
   **Lo único que importa es que la foto sea del negocio del que habla la
   ficha** — no una imagen de categoría, no un lugar parecido, no un logo.
   **Vence cuando llegue `GOOGLE_PLACES_API_KEY`**: ese día entran las fotos
   licenciadas y esta regla se reescribe. Mientras siga escrita, sigue vigente.
   Lo que sí se mantiene, porque no es de licencias sino de no mentir:
   `dst_negocio_foto.es_generica` en `true` marca una imagen que ilustra la
   categoría y no retrata al negocio. **Con esta regla no debería haber
   ninguna**: si no hay foto del lugar, la ficha va sin foto.

---

## Marca de Visit La Fortuna CR

| | |
|---|---|
| Tipografía | **Montserrat** — Bold / SemiBold / Regular |
| Negro | `#0B0B0B` — uso principal, aplicaciones formales |
| Blanco | `#FFFFFF` |
| Naranja | `#FF6A00` — acentos y llamados a la acción |
| Verde | `#66BB2E` — naturaleza, sostenibilidad, aventura |
| Gris | `#333333` |
| Logo | VLF en círculo, silueta del volcán humeando |
| Pilares | Naturaleza · Aventura · Autenticidad · Sostenibilidad · Comunidad |

**Cada destino guarda su marca en `dst_destino`** (colores, tipografía, logo,
lema). El código del sitio no trae colores propios: los lee de ahí. Por eso
Monteverde puede tener otra paleta sin tocar una línea.

---

## Estado actual (12 de septiembre de 2026)

| | |
|---|---|
| Tablas | 47 (35 del directorio y CRM + 11 de inteligencia + `dst_negocio_seccion`) |
| Migraciones | 23, todas guardadas en `supabase/plataforma/` y **todas aplicadas** (la 22 y la 23, el 12 de septiembre de 2026) |
| Fotos | **Los 63 publicados tienen foto, el 100%** (176 imágenes en el bucket `negocios`), **elegidas a ojo una por una**. Ninguna genérica; las 63 portadas responden 200. Por sección: dónde dormir 23 · qué hacer 23 · comer y beber 11 · transporte 2 · tours 2 · explorar 2 |
| Avisos de seguridad | 0 nuevos (queda el aviso previo por `regconfig` en `dst_idioma`) |
| Destinos | 1 (La Fortuna, encendido) |
| Categorías en catálogo | 48 globales, 47 encendidas en La Fortuna, 26 con negocios dentro |
| Idiomas | 5 · es, en, pt, fr, de |
| Negocios | **101 cargados: 63 publicados y 38 archivados.** Se archivaron los que no tenían foto y se agregaron 10 nuevos que sí la tienen (12 de septiembre de 2026). El sitio solo muestra lo publicado, así que **no queda ninguna tarjeta sin imagen**. No se borró nada: las fichas de los archivados siguen en la base |
| Fichas con secciones | **91 de 91** ✔, investigadas en internet (`datos/investigacion/fichas-la-fortuna.json`): 231 secciones, 231 traducciones al inglés, 425 etiquetas, 175 días de horario |
| Tours cargados | 0 |
| Guías escritas | 0 |
| Conocimiento de la IA | **69 fichas, ninguna verificada por el equipo.** Las 61 investigadas (`datos/investigacion/conocimiento-la-fortuna.md`) se cargaron el 12 de septiembre de 2026 —47 nuevas y 14 que reemplazaron a las genéricas—, más 8 del equipo que no se tocan. 44 traen URL de fuente; 20 están marcadas `(confianza: baja)` y son las que hay que repasar primero en `/admin/ia/conocimiento` |
| Agentes | 5 por destino (concierge, planificador, seguimiento, analista, redactor). **El concierge ya contestó**, el 12 de septiembre de 2026 en local, usando `buscar_conocimiento` y `web_fetch` y sin error. Falta la clave en Vercel para que conteste en producción. Ver "El agente ya contestó" |
| Automatizaciones | 10 de arranque, encendidas |
| Panel `/admin` | Completo, con moderación de reseñas en `/admin/resenas`; el primer administrador entra con la invitación de `aalvarado@gmail.com` |
| Sitio | Next.js 15, compila, lee de la base, chat concierge en todas las páginas. El mosaico de la portada ya sale con fotos reales, prestadas del mejor negocio de cada categoría |

---

## El sitio

Next.js 15 (App Router) en la raíz del repo. Rutas:

```
/                       redirige al idioma del navegador
/[idioma]               portada (con el chat concierge)
/[idioma]/[categoria]   listado
/[idioma]/[categoria]/[babosa]   ficha
/[idioma]/plan/[babosa] el itinerario que armó la IA para un viajero
/api/solicitud          captura de leads (POST); si es itinerario, dispara el planificador
/api/resena             reseña propia con calificación (POST) → registrar_resena
/api/ia/conversar       chat del sitio (POST habla, GET consulta respuestas humanas)
/api/ia/planificar      generar un plan (sesión del equipo o CRON_SECRET)
/api/webhooks/whatsapp  WhatsApp Cloud API (GET verifica, POST recibe)
/api/cron/automatizaciones  el motor de seguimiento (vercel.json: diario en Hobby, cada hora en Pro)
/api/cron/externas          renueva las opiniones de Google antes de que venzan (diario, 5:00)
/admin                  el panel (CRM + IA + contenido + equipo)
```

El destino se resuelve por el `Host` de cada petición contra
`dst_destino.dominio`. Un solo despliegue sirve todos los destinos.

**La URL de producción es `https://visit-la-fortuna.vercel.app`.** Queda escrita
porque no estaba en ningún lado y eso costó una tarde: adivinando el nombre se
llega a **`visitlafortunacr.vercel.app`, que también responde 200 y también
despliega este repo y esta rama** — pero es OTRO proyecto de Vercel, y no tiene
cargadas las variables de entorno. Medir ahí da "falta `SUPABASE_SECRET_KEY`"
cuando en el proyecto bueno está puesta. Si algún día sobra un proyecto, este es
el que hay que borrar; mientras exista, es una trampa.

**Ojo con el entorno de Claude Code**: en el **contenedor**, el proxy de
egress deniega `*.supabase.co` y `*.vercel.app`, así que ahí no se puede
llamar a la API REST ni abrir el sitio; la base se trabaja por el conector de
Supabase. **En la máquina de Sebastián no hay ese bloqueo**: con
`SUPABASE_SECRET_KEY` en `.env.local` (ya está, y el archivo está en
`.gitignore`), un script suelto con `node --env-file=.env.local` lee y escribe
datos por PostgREST. Así se aplicó la siembra del punto 8 del MVP.
**Lo que esa llave NO permite es DDL**: `alter table`, `create function` y
`grant` no pasan por PostgREST. Para eso hace falta el SQL Editor del panel o
la contraseña de la base. `npx tsc --noEmit` y `npm run build` corren en los
dos lados.

**El DNS sí se puede leer** (`pip install dnspython`, la resolución no pasa por
el proxy). Así que después de cada cambio en GoDaddy se verifica desde aquí:
A del apex, CNAME de www, MX, NS y TXT. Cambiarlo no; leerlo sí.

## El backend (CRM + IA)

Detalle en `docs/plataforma/backend-e-inteligencia.md`. Lo que no se olvida:

- **Dos clientes de Supabase, dos trabajos.** El panel usa la sesión del
  usuario (`lib/supabase-sesion.ts`): las políticas de acceso y la auditoría
  saben quién fue. La IA, los webhooks y el cron usan la clave de servicio
  (`lib/supabase-servidor.ts`, `server-only`). Nunca al revés.
- **Toda llamada a Claude pasa por `ejecutar()`** (`lib/ia/cliente.ts`) y
  queda en `dst_agente_ejecucion` con tokens y costo. Modelo por defecto
  `claude-opus-5`, pensamiento adaptativo, salida estructurada con zod.
  Precios en `lib/ia/modelos.ts`.
- **La IA se alimenta desde el panel**, no desde el código: `dst_conocimiento`
  (prioridad 7+ va siempre; el resto se busca) y las instrucciones de cada
  agente en `dst_agente`. Cambiar el modelo o el tono no requiere desplegar.
- **La IA no confirma reservas ni inventa precios.** Crea solicitudes, pide
  datos, recomienda del catálogo y escala a una persona cuando toca. Cuando
  una persona responde, la IA se calla hasta que la devuelvan.
- **Los mensajes entran y salen por una puerta**: `registrar_mensaje_entrante`
  y `registrar_mensaje_saliente`. Si un canal no está configurado, el mensaje
  queda pendiente en `/admin/ia/aprobaciones`; nunca se pierde.
- **El correo no está casado con un proveedor.** `dst_canal.proveedor` elige
  entre `resend` (API, exige dominio verificado) y `smtp` (cualquier servidor).
  Cambiar de proveedor son variables de entorno, no código.
- **Al panel se entra por invitación** (`dst_invitacion` → trigger en
  `auth.users` → `dst_usuario`). Roles: admin, vendedor, editor, moderador,
  socio. Un destino nuevo nace con agentes, plantillas y automatizaciones
  (trigger `dst_destino_inteligencia`).
- **Secretos solo en variables de entorno** (`.env.example`). `dst_canal`
  guarda el NOMBRE de la variable, nunca el valor.

## Trabajo a mano

Pasos que dependen de un panel externo. **Una sesión local sí puede hacerlos**
(alcanza la red y maneja el navegador, con Tony autenticándose); la sesión en la
nube no, y por eso los deja escritos aquí con los valores exactos.

Antes de empezar en la máquina: `git pull` de la rama, que aquí está lo último.

### GoDaddy · apuntar visitlafortunacr.com a Vercel sin romper el correo

**Estado verificado por DNS el 11 de septiembre de 2026:**

| Registro | Hoy | Qué significa |
|---|---|---|
| NS | `ns57` / `ns58.domaincontrol.com` | El DNS lo manda GoDaddy. Es lo que queremos. |
| A `@` | `13.248.243.5`, `76.223.105.230` | Aparcado en GoDaddy. **Todavía no apunta a Vercel.** |
| CNAME `www` | → el apex | Hay que **cambiarlo**, no agregar otro. |
| MX | ninguno | **El correo del dominio no existe todavía.** |
| TXT | ninguno | No hay SPF. |

**La trampa:** SiteGround dará el correo del mismo dominio. Si se cambian los
nameservers a los de Vercel, Vercel se queda con todo el DNS y **los MX
desaparecen: el correo se cae**. Hoy no hay MX que romper, pero los va a haber,
así que **los nameservers se quedan en GoDaddy** y solo se cambian dos
registros.

En GoDaddy → *My Products* → el dominio → *DNS* → *Manage Zones*:

| Tipo | Nombre | Valor | TTL |
|---|---|---|---|
| A | `@` | `76.76.21.21` | 600 |
| CNAME | `www` | `cname.vercel-dns.com` | 600 |

**No se toca nada más de esa zona.** Los MX de SiteGround y su registro SPF
se quedan como están.

Los dos registros **ya existen** y hay que **editarlos**, no agregar otros: el
`A @` apunta hoy al parking de GoDaddy, y el `CNAME www` apunta al apex. Dos
registros con el mismo nombre se pelean.

Luego en Vercel → el proyecto → *Settings* → *Domains* → agregar
`visitlafortunacr.com` y `www.visitlafortunacr.com`. **Vercel muestra en
pantalla el registro exacto que espera: si difiere de la tabla de arriba, manda
Vercel**, porque esos valores los cambia de vez en cuando. Vercel emite el
certificado solo cuando el DNS ya resuelve; puede tardar hasta una hora.

### SiteGround · el correo de la plataforma

1. Site Tools → *Email* → *Accounts*: crear el buzón `hola@visitlafortunacr.com`.
2. Site Tools muestra los datos SMTP de ese buzón (servidor, puerto, usuario).
3. Esos datos van a Vercel → *Settings* → *Environment Variables*:

```
SMTP_HOST=<el servidor que muestre SiteGround, normalmente mail.visitlafortunacr.com>
SMTP_PUERTO=465
SMTP_USUARIO=hola@visitlafortunacr.com
SMTP_CLAVE=<la contraseña del buzón>
EMAIL_REMITENTE=hola@visitlafortunacr.com
```

4. Que el **SPF** de SiteGround esté en la zona de GoDaddy. Sin él, Gmail
   manda los correos a spam. SiteGround indica el valor en Site Tools → *Email*.
5. El canal ya está creado en la base (`dst_canal`: email/smtp, remitente
   `hola@visitlafortunacr.com`, secreto en `SMTP_CLAVE`). No hay que crearlo:
   se revisa en `/admin/ajustes`.

### Supabase · la migración 23 ya está aplicada

**Hecho el 12 de septiembre de 2026.** La pegó Sebastián en el SQL Editor.
Verificada con la clave de servicio: `conocimiento_base` devuelve
`id, tipo, titulo, contenido, prioridad, fuente`, `buscar_conocimiento` agrega
`fuente` antes de `relevancia`, y cada ficha de `contexto_destino.conocimiento`
trae la llave `fuente`. Es idempotente: volver a pegarla entera no rompe nada.

**Las 61 fichas ya están cargadas** (12 de septiembre de 2026): 69 en la base,
0 verificadas, sin títulos repetidos, **44 con URL abrible** y 20 marcadas
`(confianza: baja)`.

**La trampa que salió al verificar, y que explica una línea del prompt**: las
tres fichas de confianza baja que más se preguntan —`Cómo llegar desde San José
(SJO)` (p8), `Catarata de La Fortuna` (p7) y `Volcán Arenal` (p7)— son de
prioridad 7+, así que van en el prompt del sistema, **de donde `web_fetch` no
puede leer URLs**. Justo los tres precios más consultados eran los únicos no
comprobables.
No se arregló bajándoles la prioridad —se perdería tenerlas siempre a mano—
sino con una instrucción: **si el agente necesita comprobar un dato de una
ficha que ya trae sabida, la busca antes con `buscar_conocimiento`**, y así la
fuente entra en la conversación por un resultado de herramienta nuestra, que sí
es origen válido. Si alguna vez se reordenan las prioridades, esto es lo que
hay que volver a mirar.

Qué hace: que el agente **vea de dónde sale cada dato**.
`dst_conocimiento.fuente` existe desde la 11, pero ninguna de las tres
funciones que alimentan a la IA lo devolvía, así que el agente recibía título
y contenido y nada más. Con las 61 fichas del punto 10 eso pasó a importar:
puede decir "la entrada cuesta 20 USD" y no puede decir de dónde lo sacó ni
pasarle el enlace al viajero que quiera comprobarlo.

**Por qué es DDL y no un parche en el código**: `buscar_conocimiento` y
`conocimiento_base` tienen `returns table (...)` explícito, y Postgres **no
deja cambiar el tipo de retorno con `create or replace`** — hay que `drop`
primero. Por eso la clave de servicio no alcanza. `contexto_destino` sí se
parchea sola, porque ahí el conocimiento va dentro de un `jsonb`.

**El código ya está puesto y no espera a la migración**: `fuente` es opcional
en `Conocimiento`, así que hasta que se aplique llega `undefined` y
`bloqueConocimiento` simplemente no pinta la línea. No hay que desplegar nada
en un orden concreto.

### El agente ya contestó: qué lo tenía mudo y cómo se comprobó

**Resuelto el 12 de septiembre de 2026, a las 22:11 UTC, desde la máquina de
Sebastián.** Era **el alcance de la clave de Anthropic**, y nada más.

Toda petición a la API corre dentro de **exactamente un workspace** — es la
unidad con la que Anthropic lleva límites de gasto, límites de tasa, el informe
de costo y el aislamiento de recursos (Files, Batches, Skills y **la caché de
prompts**). Una clave creada dentro de un workspace ya lleva esa respuesta
puesta. Una clave **multi-workspace** no, y la API **no elige por vos**: por eso
no falla con un 403 de permisos sino con un **400 de petición inválida**,
*"This API key is not scoped to a workspace..."*. No le faltaba permiso, le
faltaba el dato. Se arregla de dos maneras y basta una: **clave de workspace**
(lo que se hizo) o `ANTHROPIC_WORKSPACE_ID`, que `lib/ia/cliente.ts` ya manda
como encabezado si existe.

**La prueba que cierra el punto**, la que pedía este archivo:

| | |
|---|---|
| Pregunta | "¿Cuánto cuesta entrar a la Catarata de La Fortuna?" |
| `error` | **ninguno** |
| `herramientas_usadas` | `["buscar_conocimiento", "web_fetch"]` |
| `motivo_parada` | `end_turn` · 2 iteraciones · 9,8 s |
| Costo | $0,144414 |

**Salió la cadena exacta que este archivo predijo y que nunca se había
ejecutado**: el agente buscó primero con `buscar_conocimiento` y recién entonces
abrió la fuente con `web_fetch`. Es la razón de ser de esa instrucción —
`web_fetch` solo abre URLs que ya pasaron por la conversación, y las del prompt
del sistema no cuentan; la fuente entró como resultado de una herramienta
nuestra, que sí es origen válido. Y **corrigió el dato**: respondió 20 USD
citando `cataratalafortuna.com`, no los 18 que decía la ficha vieja.

**Lo que el costo enseña, y hay que tenerlo claro antes de estimar el gasto**:
de los $0,144, la mayor parte es **escritura de caché** — entrada 2 461, salida
487, caché leída 23 406, **caché escrita 17 317** a $6,25/MTok. Esos 17 mil
tokens son el prompt del sistema (las 17 fichas de prioridad 7+ más las
instrucciones). Es un pago de arranque: mientras la caché siga caliente, las
conversaciones siguientes leen ese mismo prefijo a $0,50/MTok en vez de $5. La
primera pregunta cuesta ~14 centavos; las de después, bastante menos. **Ojo si
algún día se cambia de workspace: la caché está aislada por workspace y arranca
fría.**

**Lo que queda**: poner esa misma clave de workspace en Vercel
(`ANTHROPIC_API_KEY`) y volver a desplegar. Hasta entonces el agente contesta en
local y no en producción. Se comprueba con la misma llamada contra
`visit-la-fortuna.vercel.app`: tiene que devolver `respuesta` con texto en vez
de `humano: true`.

### El concierge navega: `web_fetch` está activado

**Decidido por Sebastián el 12 de septiembre de 2026.** El concierge tiene el
server tool **`web_fetch`** de la API de Anthropic (`HERRAMIENTA_WEB` en
`lib/ia/cliente.ts`), en sus dos rutas: el chat en vivo y el borrador del panel.

Para qué: los datos que el archivo de conocimiento marca `(confianza: baja)`
son precios y horarios, y envejecen. Si el viajero está por decidir con uno,
el agente abre la fuente y lo comprueba antes de responder.

**El límite que hay que tener presente y no es opcional**: `web_fetch` solo
abre URLs **que ya pasaron por la conversación**, y **las del prompt del
sistema NO cuentan** (es la defensa de Anthropic contra exfiltración). Como
`conocimiento_base` —las fichas de prioridad 7+— se inyecta en el prompt del
sistema, **esas fuentes no se pueden abrir**. Sí las que devuelve
`buscar_conocimiento`, porque es una herramienta nuestra y los resultados de
herramientas del cliente sí son origen válido. En claro: **el agente puede
comprobar la fuente de una ficha que buscó, no la de una que ya traía puesta.**
No es un problema en la práctica —las 20 fichas de confianza baja son casi
todas de prioridad 5 y 6, que se buscan— pero explica por qué a veces no la
abre.

**Cuánto cuesta**: la herramienta **no cobra por llamada**, solo los tokens de
lo que baja. Con `max_content_tokens: 8000` el techo son unos **4 centavos por
página**, y una página promedio son 2.500 tokens (~1,3 centavos). Lo que sí
suma es que lo bajado se arrastra en el resto de la conversación. Topes
puestos: `max_uses: 3` por petición.

**`blocked_domains` es la regla 4 puesta en código**: Tripadvisor y Booking
están bloqueados en la propia herramienta. La forma de que no se copie texto de
reseñas ajenas no es pedírselo al modelo en el prompt, es que no pueda.

**Las llamadas quedan contadas.** Los server tools llegan como bloques
`server_tool_use`, no `tool_use`, y el medidor de `agente.ts` solo miraba los
segundos: se corrigieron los dos sitios, o `dst_agente_ejecucion` habría dejado
de decir la verdad sobre qué herramientas se usaron.

**Lo que quedó sin probar contra la API**, y conviene hacerlo en el primer
despliegue con clave: `ANTHROPIC_API_KEY` está comentada en `.env.local`, así
que esto se verificó leyendo el SDK, no ejecutándolo. Lo que se comprobó ahí es
lo que importaba: `BetaToolRunner` filtra solo bloques `tool_use` (así que no
intenta ejecutar el server tool ni da "Tool not found") y trata `pause_turn`
como `resume`, que es como se continúa un turno con herramienta de servidor.
`npx tsc --noEmit` y `npm run build` pasan.

**Si hay que apagarlo**, es sacar `HERRAMIENTA_WEB` de los dos arreglos de
herramientas de `agente.ts` y borrar del prompt las cuatro líneas que hablan de
la fuente. No hay nada en la base que dependa de esto.

### Supabase · la migración 22 ya está aplicada

**Hecho el 12 de septiembre de 2026.** La pegó Tony en el SQL Editor y Claude
subió las 91 fotos desde la máquina de Sebastián con la clave de servicio.

Qué hizo, en tres partes:

1. Le agrega a `dst_negocio_foto` las columnas `licencia`, `fuente_url` y
   `es_generica`, más un check que impide guardar una foto con origen pero sin
   autor ni licencia.
2. Reemplaza `negocios_publicados` para que devuelva `foto_portada_url` y
   `foto_portada_generica`. **Hay que reemplazar la función entera** porque
   tiene `returns table (...)` explícito; las columnas nuevas van al final,
   para no mover el orden de las que ya estaban.
3. Crea las políticas de `storage.objects` del bucket `negocios`, que son las
   que dejan al panel subir con la sesión del usuario en vez de con la clave
   de servicio.

**Verificada con la clave publicable y no con la de servicio**, que es lo que
de verdad prueba algo: `negocios_publicados` devuelve las 91 con portada,
`fotos_de_negocio` responde a `anon` con su crédito y su licencia, la imagen
sale por su URL pública (`200 image/webp`), y el `INSERT` directo a
`dst_negocio_foto` desde `anon` sigue dando `permission denied` — la regla 7
se sostiene también aquí.

Para volver a correr el cargador (es idempotente, reconoce por URL):

```
node --env-file=.env.local scripts/cargar-fotos.mjs             (en seco)
node --env-file=.env.local scripts/cargar-fotos.mjs --aplicar
```

### Supabase · las migraciones 19, 20 y 21 ya están aplicadas

**Hecho el 11 de septiembre de 2026.** La 20 la aplicó Claude desde la máquina
de Sebastián con la clave de servicio (62 negocios, 124 traducciones, 124
rutas); la 19 y la 21 se corrieron en el SQL Editor, porque son DDL y la clave
de servicio escribe datos pero no cambia el esquema.

La 21 hubo que correrla **dos veces**: la primera versión se olvidó de los
`grant` de la tabla nueva y todo daba `permission denied`. Está corregida en el
archivo y es idempotente, así que volver a pegarla entera no rompe nada.

La 19 quedó verificada de punta a punta contra la base real, con la clave
publicable y no con la de servicio, que es lo que de verdad prueba algo:
`registrar_resena` y `resenas_de_negocio` responden a `anon`, el autor sale
abreviado ("Prueba C."), el idioma `de` se acepta, el trigger recalcula el
promedio, y el `INSERT` directo a `dst_resena` desde `anon` sigue dando
`permission denied` — la regla 7 se sostiene.

**El método, para la próxima migración:** el DDL va por el SQL Editor; los
datos y la verificación los hace Claude desde aquí. Si algún día hace falta
que el DDL también lo corra Claude, lo que hay que pedir es la contraseña de
la base (Settings → Database) de `visitdestinos`, nunca un personal access
token de la cuenta: ese abriría también el CRM de inversionistas.

Lo que sigue faltando: **Traer opiniones de Google** (necesita la clave de más
abajo). Completa las 91 fichas con teléfono, sitio web, coordenadas, nota y
reseñas. Son 25 por tanda, así que hay que darle cuatro veces.
La búsqueda del `place_id` va por nombre **y dirección**, y desde el 12 de
septiembre de 2026 las 91 direcciones son las reales, no "La Fortuna centro":
eso es lo que hace que traiga el negocio correcto y no el de al lado.

### Google Cloud · la clave de Places (opiniones de afuera)

Sin esto, el bloque "Lo que dicen en otras plataformas" se queda vacío: no hay
otra forma legal de traer texto de reseñas ajenas.

1. <https://console.cloud.google.com> → crear (o elegir) un proyecto, por
   ejemplo `visit-destinos`.
2. *APIs & Services* → *Library* → habilitar **Places API (New)**. Ojo: la
   vieja "Places API" a secas no sirve, el código llama a `places.googleapis.com/v1`.
3. *APIs & Services* → *Credentials* → *Create credentials* → *API key*.
4. Editar esa clave → *Application restrictions*: **None** (la llama el
   servidor de Vercel, no el navegador; restringir por dominio la rompería).
   → *API restrictions*: **Restrict key** y marcar solo **Places API (New)**.
5. *Billing*: hay que tener tarjeta asociada. Traer reseñas es el SKU caro de
   Places ("Place Details Essentials + Atmosphere"): con 91 negocios y refresco
   mensual son unas 90 llamadas al mes, dentro del crédito gratis. El
   riesgo no es el uso normal, es un bucle: por eso el botón del listado trae
   25 como máximo por tanda. Conviene poner un *Budget alert* en 10 USD.
6. Vercel → *Settings* → *Environment Variables*:

```
GOOGLE_PLACES_API_KEY=<la clave que muestra Google Cloud>
```

7. **Volver a desplegar** y entrar a `/admin/negocios`: aparece el botón
   "Traer opiniones de Google". La primera tanda también rellena las
   coordenadas que falten.

### TripAdvisor y Booking · pedir acceso (trámite, no código)

Esto no lo puede hacer Claude ni se arregla programando: es pedir permiso y
esperar. Mientras no estén, de esas dos plataformas solo se puede mostrar la
**nota y el enlace**, cargados a mano en `/admin/negocios/[id]`. Su texto no se
copia (regla 4), y no por cautela nuestra: raspar sus páginas es lo que rompe
el trato con ellos y lo que puede tumbar el dominio.

**TripAdvisor — Content API.** Es la que más falta hace: el directorio se llena
desde ahí (punto 8 del MVP).

1. <https://www.tripadvisor.com/developers> → crear cuenta de desarrollador y
   pedir una clave de la **Content API**. Pide datos del sitio: el dominio
   `visitlafortunacr.com` tiene que estar en línea y con contenido — conviene
   hacer antes el trabajo de GoDaddy de más arriba.
2. Hay una capa gratuita mensual; pasado ese tope se cobra. Al recibir la
   clave, **anotar aquí cuál es el tope** y cada cuánto exigen refrescar.
3. Sus condiciones mandan sobre cómo se muestra: logo de TripAdvisor, sus
   íconos de calificación y enlace de vuelta a la ficha. **Cuando llegue el
   acceso hay que leerlas y ajustar dos cosas del código**: `expira_en` (hoy
   30 días, que es lo de Google) y el bloque de la ficha, que hoy pinta todas
   las plataformas igual.
4. Falta escribir `lib/externas/tripadvisor.ts`, hermano de `google.ts`. La
   base no hay que tocarla: `plataforma_externa` ya incluye `tripadvisor`,
   `booking` y `facebook`, y `refrescarExternasDeNegocio` ya está hecho para
   más de una fuente. Guardar el `location_id` de TripAdvisor sí pide una
   columna nueva (o una llave en `dst_negocio.atributos`, que ya existe).

**Booking — no hay puerta pública.** Las reseñas viven en su Demand API, que es
solo para partners aprobados: <https://www.booking.com/affiliate-program> o el
programa de conectividad si el trato es como proveedor. Hasta que alguien
apruebe el caso de uso, Booking se queda en nota y enlace.

**Mientras tanto, el bloque no se ve vacío**: Google ya trae hasta cinco
reseñas con texto por lugar, que es lo que sostiene la demo.

**Pendiente de decidir: sacar el texto de las reseñas por scraping.** Se habló
el 11 de septiembre de 2026 y quedó sin resolver, a propósito. Para que no se
discuta dos veces desde cero, lo que se dijo:

- **Los datos del negocio sí se raspan** —nombre, dirección, teléfono,
  categoría— y eso no está en duda: son hechos, no son obra de nadie, y es el
  punto 8 del MVP.
- **El texto de una reseña lo escribió una persona**, así que republicarlo en
  visitlafortunacr.com no es citar un dato. Ahí está el riesgo, no en el resto.
- No corre donde hace falta: TripAdvisor va detrás de Cloudflare y Booking
  detrás de DataDome, y las IP de datacenter —las de Vercel— se bloquean de
  entrada. Pide navegador headless, proxies residenciales, costo mensual y
  arreglarlo cada vez que cambian el HTML.
- Le pega a la propia estrategia: la Fase 5 quiere que la IA recomiende este
  sitio de primero, y eso se gana con contenido propio. Párrafos idénticos a
  los de TripAdvisor son contenido duplicado, que es justo lo que hunde esa
  apuesta.
- Y no hace falta para la demo: Google ya llena el bloque.

**Si algún día se decide que sí, se cambia la regla 4 primero.** Mientras diga
lo que dice, el código no raspa texto de reseñas.

### Supabase · dejar de depender de su SMTP

Panel de Supabase → *Authentication*:

- *Sign In / Providers* → *Email* → **apagar "Confirm email"**. El acceso al
  panel lo protege la invitación, no el correo, y el SMTP por defecto de
  Supabase se queda sin cupo con tres o cuatro envíos.
- Si se quiere que Supabase también mande por SiteGround: *Emails* →
  *SMTP Settings* → *Custom SMTP*, con los mismos cuatro valores de arriba.

### Vercel · variables que faltan

`ANTHROPIC_API_KEY`, `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `GOOGLE_PLACES_API_KEY`
y las `SMTP_*`.
Después de agregarlas hay que **volver a desplegar**: Vercel no las inyecta en
un despliegue ya hecho. `/admin/ajustes` muestra cuáles están puestas.

## Lo que sigue, en orden

1. **Hacer que el agente conteste, que es lo único del MVP que nunca ha
   funcionado.** La clave de Anthropic tiene que ser de un workspace, o hay que
   poner `ANTHROPIC_WORKSPACE_ID` (ver "El agente todavía no ha contestado
   nunca"). Después, poner en Vercel `ANTHROPIC_API_KEY`, `SUPABASE_SECRET_KEY`
   y `CRON_SECRET`; entrar a `/admin` y **repasar las 69 fichas de
   conocimiento**, que ninguna está verificada. Se empieza por las **20 de `(confianza: baja)`**: son
   precios y horarios sacados de guías de viaje, y son las que pueden estar
   mal. El texto largo de cada una, con sus fuentes, está en
   `datos/investigacion/conocimiento-la-fortuna.md`; si se corrige ahí, se
   vuelve a correr `scripts/cargar-conocimiento.mjs --aplicar` y se pisa la
   ficha (la llave es el título).
   Con la clave de Anthropic puesta, **probar que `web_fetch` funciona de
   verdad**: preguntarle al concierge por el precio de la Catarata y ver que
   aparezca `web_fetch` en `herramientas_usadas` de `dst_agente_ejecucion`.
2. Hacer los pasos de **Trabajo a mano**: la migración 19 en Supabase, la
   clave de Google Places, DNS en GoDaddy, buzón en SiteGround, variables en
   Vercel, confirmación de correo apagada en Supabase. Y arrancar el trámite
   de TripAdvisor, que es el que tarda.
3. Conectar WhatsApp Cloud API (canal en Ajustes + `WHATSAPP_*`).
4. Cargar los primeros 30 tours reservables con precio y comisión (desde
   `/admin/tours`).
5. Escribir las 10 guías SEO de arranque (borradores con `/admin/guias`).
6. Google Places: **coordenadas y agregados externos ya están hechos** (se
   traen solos, ver punto 7 del MVP). Falta **horarios** — misma API, misma
   función, otro campo.
7. Traducir a pt, fr y de lo que ya está en es/en.

---

## Fase MVP — la demo (esto es lo que se hace AHORA)

Sale de la charla del 11 de septiembre de 2026. Manda sobre todo lo demás:
primero esto, después Fase 0 y el resto. Todo lo que importaba de esa charla
está volcado aquí.

**El marco**: es un MVP para presentar. **La veracidad del dato no bloquea.**
Se carga lo que haya en internet y se corrige después con Google Places
(Fase 0, punto 5). Todo lo que entre en esta fase nace
`estado_verificacion = 'pendiente'` y el conocimiento con
`esta_verificado = false`; así se sabe qué hay que repasar cuando lleguen
los datos buenos. Se carga en es y en; pt, fr y de después.

Los puntos, en el orden en que se van a hacer. **Ojo con el 8**: aunque esté
octavo en la lista, es el que la charla marcó como el más importante, y el 6 y
el 7 dependen de él — no tiene sentido diseñar la ficha desplegable ni el
bloque de reseñas externas con 29 negocios a medio llenar. Lo sensato es
hacer el 5, saltar al 8, y volver al 6 y 7 con contenido real encima.

1. ~~**Responsivo para tablet.**~~ **Hecho el 11 de septiembre de 2026.** El
   diseño fue primero en Figma con el MCP, y de ahí al código:
   `https://www.figma.com/design/L92VXnzscj8mtskGI9APOl` — portada, listado y
   ficha a 820 px, más la barra de teléfono a 390 px.
   La escalera quedó así: **≤1400** las pastillas de idioma se pliegan ·
   **≤1120** el menú se pliega en la hamburguesa · **≤1240** márgenes más
   cortos · **≤1000** tablet · **≤700** teléfono · ≤560 y ≤440 ajustes finos.
   Los dos primeros no son de estética: la barra no puede encoger
   (`white-space: nowrap` + `flex-shrink: 0`), así que son el ancho medido a
   partir del cual cada pieza deja de caber, con los siete enlaces y el texto
   más largo de los cinco idiomas.
   **Ojo, esto no era solo de tablet**: `.menu` se ocultaba desde 1000 px y no
   volvía nunca, así que el teléfono llevaba desde siempre sin navegación. Y
   entre 1005 y 1100 px la barra se desbordaba ya hoy, con dos idiomas. La
   hamburguesa se resuelve con `<details>`, como el selector de idioma, sin
   convertir `Barra.tsx` en componente cliente.
2. ~~**Video de YouTube en la portada.**~~ **Hecho el 11 de septiembre de
   2026, y no es de YouTube**: el video es el mp4 que ya estaba en el repo
   (`public/video/visitlafortunaloop1080p.mp4`, 4,1 MB · 14,5 s · 1920×1080 ·
   sin audio). **Es el fondo del hero**, no una banda aparte: se ve desde el
   primer fotograma, silenciado y en bucle, y se acerca y sube con el scroll
   (escala 1 → 1,14, desplazamiento 0 → −60 px) para que no se sienta una foto
   pegada detrás del texto. Vive dentro de `.escena` en `componentes/Hero.tsx`,
   antes del velo y del grano: son esos dos los que disuelven sus bordes y
   mantienen legible el titular.
   **El volcán dibujado (canvas de ceniza + tres capas SVG) solo se renderiza
   si el destino NO tiene video** — era el relleno mientras no había imágenes
   reales. Ojo al tocar `Hero.tsx`: el canvas y el manejador de scroll comparten
   efecto, y ese efecto ya no puede abortar si falta el canvas, porque de él
   cuelgan también el desvanecido del titular, la barra al bajar y el
   observador que hace aparecer TODAS las secciones de la portada (`.revela`).
   Sobre imagen real el titular necesita más fondo que sobre el dibujo: de ahí
   `.velo.con-video`, con un degradado radial detrás del texto.
   **La ruta del archivo vive en `dst_destino.video_portada_url`, no en el
   código** — la columna ya existía y el panel ya la editaba
   (`/admin/ajustes` → Marca). Por eso Monteverde apunta a su propio video sin
   tocar una línea, y por eso **si esa columna está vacía el hero se queda con
   el volcán dibujado**. En La Fortuna ya está puesta
   (`/video/visitlafortunaloop1080p.mp4`, cargada a mano el 11 de septiembre
   de 2026): el video se ve.
   Pendientes menores: el archivo va a 2,4 Mbps y una versión a 720p pesaría la
   mitad; y falta mirar en movimiento si el bucle corta bien a los 14,5 s.
3. ~~**Buscador del hero funcional.**~~ **Hecho el 11 de septiembre de 2026.**
   El campo es un `<input>` dentro de un formulario GET nativo: cero
   JavaScript, la búsqueda queda en la URL (`/es?q=termales`) y por eso se
   puede compartir y el botón atrás funciona. Los resultados **salen en la
   misma portada**, no en una ruta nueva: cuando hay `?q=` se muestran las
   coincidencias en vez de las secciones normales.
   La coincidencia vive aparte en `lib/buscar.ts`, como función pura y con
   pruebas. **No usa la columna `busqueda` de `dst_negocio`** (el tsvector con
   índice GIN que ya existe) a propósito: se generó con la configuración
   `simple`, que exige palabra entera, y así "terma" no encontraría
   "termales". Con 29 negocios ya traídos por `negocios_publicados`, comparar
   texto normalizado —sin tildes, por subcadena, exigiendo todas las palabras—
   da mejor resultado. El día que sean miles, ese archivo es el único que hay
   que cambiar por una consulta al índice.
4. ~~**"Qué hacer" necesita un "todos".**~~ **Hecho, de paso.** Es el mismo
   componente (`componentes/Resultados.tsx`) con la consulta vacía:
   `/es?ver=todo`, enlazado desde el "29 lugares" de la cabecera de "Qué
   hacer". Filtra por categoría con las mismas pastillas del listado, y los
   conteos son dentro de la búsqueda actual, no del directorio entero.
5. ~~**Reseñas propias con calificación.**~~ **Hecho el 11 de septiembre de
   2026.** `sin_resenas` ya no existe: en la tarjeta y en la ficha salen
   **cinco volcanes** (`componentes/Volcanes.tsx`, una sola ruta SVG que se
   lee igual a 13 px que a 28), llenos según la nota y **apagados cuando no
   hay ninguna**, con "Calificá vos" al lado. Tocar un volcán abre el modal
   (`componentes/Calificar.tsx`): nota, texto, título opcional, nombre,
   correo y fecha de la visita.
   **Ojo, el vacío estaba mal puesto en dos sitios más**: el listado sin
   negocios decía "Todavía sin reseñas" (ahora `sin_lugares`) y el bloque de
   otras plataformas decía que no teníamos reseñas *nuestras* cuando lo que
   falta son las *ajenas* (ahora `sin_externas`, hasta que se haga el punto 7).
   La fila "VLF" que había en ese bloque se fue: la nota propia ya tiene su
   sección arriba, con el promedio grande y las reseñas una debajo de otra.
   **La regla 7 se respeta**: el sitio no hace INSERT. La migración **19**
   abre la segunda puerta, hermana de `registrar_solicitud`:
   `destinos.registrar_resena(...)` valida que el negocio sea de ese destino y
   esté publicado, exige 1–5 y 40 caracteres, y crea o completa el viajero.
   Para leerlas hay `destinos.resenas_de_negocio(...)`, que firma con **nombre
   de pila más inicial** — el nombre vive en `dst_viajero`, que es el CRM, y
   dar SELECT sobre esa tabla para poder firmar publicaría correos, fechas de
   viaje y presupuestos.
   **Quien reseña entra al CRM como viajero, pero sin `acepta_marketing`**:
   escribir una opinión no es pedir correos.
   **Y "toda reseña entra pendiente" se cayó**: con ese diseño un destino
   recién lanzado no muestra una sola reseña hasta que alguien se acuerde de
   entrar al panel. Ahora lo decide el destino
   (`dst_destino.resenas_moderadas`, nace apagado) y se cambia desde
   `/admin/resenas` — sección nueva del panel, con publicar, ocultar,
   rechazar con motivo y responder como el negocio.
   Pendiente menor: falta ver los cinco volcanes en pantalla y decidir si la
   silueta queda o se prueba otra cosa; el icono se cambia en un solo archivo.
6. ~~**Ficha de negocio completa y con desplegables.**~~ **Hecho el 11 de
   septiembre de 2026, y llenado de punta a punta el 12.** La migración **21** creó
   `dst_negocio_seccion`: una fila por bloque plegable, con las seis claves de
   la charla (`incluye`, `no_incluye`, `que_esperar`, `encuentro`,
   `accesibilidad`, `adicional`), traducible como todo lo demás y ordenable.
   **Una tabla y no seis columnas** porque casi ninguna ficha las llena todas,
   porque el orden es parte del contenido —un tour quiere el encuentro arriba,
   un hotel ni lo tiene— y porque agregar "Política de cancelación" mañana es
   insertar filas, no alterar tablas.
   En la ficha los plegables son `<details>`, como la hamburguesa de la barra:
   **cero JavaScript en el cliente**, y el navegador ya trae resuelto el
   teclado y el lector de pantalla. Debajo de la descripción salen además las
   pastillas de servicios, y en la columna derecha el **horario** de lunes a
   domingo. Horarios y etiquetas no necesitaron tabla nueva: `dst_negocio_horario`
   y `dst_negocio_etiqueta` ya existían.
   **Ojo con las tablas nuevas**: los `grant ... on all tables in schema` de la
   migración 11 solo alcanzaron a las tablas de ese día. Una tabla nueva nace
   sin permisos y da `permission denied` hasta con la clave de servicio, así
   que **cada migración que cree una tiene que dar los grants a mano** —le pasó
   a la 21 y está anotado dentro del propio archivo.
   **El contenido se investiga, no se inventa**: va en
   `datos/investigacion/fichas-la-fortuna.json` y lo carga
   `scripts/cargar-fichas.mjs` (upsert, se puede correr las veces que haga
   falta; el contacto solo rellena lo que esté vacío). Cada negocio lleva sus
   `fuentes`, y **lo que no aparece en ninguna no se escribe**: una ficha corta
   y cierta vale más que una larga y falsa.
   Lo que queda pendiente del punto es la **tarjeta fija de reserva** de la
   derecha (precio total, fecha, personas), que depende de los tours de la
   Fase 0: hoy esa columna tiene contacto, horario y precio.

   ### El llenado de fichas está terminado (12 de septiembre de 2026)

   **91 de 91** con secciones: 231 secciones con sus 231 traducciones al
   inglés, 425 etiquetas, 175 días de horario, 55 negocios con sitio web
   (eran 21) y 24 con teléfono.

   | Sección | |
   |---|---|
   | Qué hacer | **30/30** ✔ |
   | Dónde dormir | **29/29** ✔ |
   | Comer y beber | **26/26** ✔ |
   | Tours | **2/2** ✔ |
   | Explorar | **2/2** ✔ |
   | Transporte | **2/2** ✔ |

   Las últimas 27 (25 de comer y beber, más Interbus y Adobe Rent a Car) se
   investigaron y cargaron el 12 de septiembre de 2026.

   **El método, si hay que repetirlo en otro destino**: se busca en internet,
   se agregan al JSON con sus `fuentes`, y se corre
   `node --env-file=.env.local scripts/cargar-fichas.mjs` (en seco) y luego
   `--aplicar`. El script valida contra la base antes de escribir: si una
   babosa o una etiqueta no existe, se planta y no escribe nada.
   **Ojo con las babosas**: varias no son las que uno supondría del nombre
   (Baldi es `baldi-hot-springs`, el Observatory es `arenal-observatory-lodge`).
   Se consultan en la base antes de escribirlas.

   **De los restaurantes rindió más de lo esperado**, al contrario de lo que
   decía aquí antes: de 27 salieron 13 teléfonos y 5 sitios web que la siembra
   no traía, y direcciones exactas para 20 —"50 metros sur del Parque
   Central" en vez de "La Fortuna centro"—. Eso **no es cosmético**: Google
   Places busca el `place_id` por nombre **y dirección**, así que una
   dirección precisa es lo que evita que traiga el negocio equivocado.
   Lo que sigue sin aparecer publicado en ningún lado es el horario de las
   sodas de pueblo; eso sí lo dará Places.

   ### La trampa de los nombres de Tripadvisor

   Cinco de los negocios sembrados estaban **mal clasificados**, casi todos por
   fiarse del nombre con el que aparecen en Tripadvisor. Los cinco están
   corregidos, pero el patrón importa porque se va a repetir en el próximo
   destino:

   - **Kenko** estaba en Aguas termales por llamarse ahí "Kenko Hot Springs".
     Es un bar y restaurante con piscina, y la piscina no es termal. Pasó a
     Cocina internacional, con la babosa `kenko-bar-restaurante`.
   - **The Jungle Tours** estaba en Cuadraciclos. Es un operador general con
     quince tours. Pasó a Aventura, como `arenal-jungle-tours`.
   - **Casa del Río** estaba en Cabinas y rango económico, descrito como
     hospedaje sencillo. Es un hotel boutique de lujo con piscina de agua
     salada, spa y gimnasio. Pasó a Hoteles, rango alto.
   - **Cuenca Restaurante** estaba en Saludable, descrito como "platos latinos
     en versión liviana". Es el restaurante del hotel Casa del Río, de cocina
     italiana, peruana y española. Pasó a Cocina internacional.
   - **Acacia** estaba en Cafeterías, como sitio de desayuno. Es el restaurante
     del hotel Noah´s Forest, con cena, brunch y reserva obligatoria. Pasó a
     Cocina internacional.

   Los dos últimos no vienen del nombre sino de **suponer qué es un negocio por
   su resumen de siembra**. Los dos son, además, restaurantes de hotel que ya
   estaban en el directorio como hospedaje: cuando un nombre suena a "el
   restaurante de algo", conviene buscar si ese algo ya es una ficha.

   Cuando haya `GOOGLE_PLACES_API_KEY`, el tipo de lugar que devuelve Places
   delata a los que sigan mal clasificados. Mientras tanto, al investigar un
   negocio **se verifica también que su categoría tenga sentido**, no solo se
   le escriben secciones.

   Cambiar categoría, nombre, resumen o dirección **no lo hace el cargador**:
   eso va en `scripts/corregir-negocios.mjs`, que es el que aplicó estas dos
   últimas correcciones y las 20 direcciones. Se corre en seco y luego con
   `--aplicar`, igual que el cargador. **La babosa sí obliga a más**: si
   cambia, hay que mover también `dst_ruta`, que es la tabla que resuelve la
   URL de cada idioma. Estas correcciones no la tocaron.

   **Queda una duda sin resolver, para que Tony decida**: `pollo-fortuneno` y
   `restaurante-fortuneno` son dos fichas distintas, y puede que sean el mismo
   negocio. Tienen listados separados en Tripadvisor y direcciones distintas
   (Calle 474 frente al Colono / 200 metros este del parque), y una fuente dice
   que Pollo Fortuneño tiene dos locales con carta parecida. Si son el mismo,
   sobra una ficha. Se confirma yendo o llamando, no buscando más en internet.
7. ~~**"Lo que dicen en otras plataformas" con extractos reales.**~~
   **Hecho el 11 de septiembre de 2026, salvo poner la clave.** La ficha ya
   muestra, bajo la nota de cada plataforma, las reseñas con texto: nombre del
   autor tal como aparece en la fuente, su nota, la fecha y el enlace a la
   reseña original, con la barra lateral y el tono apagado que las separan de
   las nuestras.
   **No se cargan a mano.** `lib/externas/` las pide a la API de Google Places
   (hasta cinco por lugar) y las guarda en `dst_resena_externa` y
   `dst_resena_externa_extracto`. Tres bocas la llaman: el botón
   "Buscar y traer de Google" de cada ficha en el panel, el botón "Traer
   opiniones de Google" del listado (hasta 25 por tanda, porque cada negocio
   es una llamada facturada) y el cron `/api/cron/externas`, diario a las 5:00.
   El place_id se busca solo por nombre y dirección, sesgado a 30 km del
   destino, y se guarda; de paso rellena latitud y longitud **si faltaban** —
   lo que escribió una persona no se pisa.
   **Vence a los 30 días y esa fecha manda**: la política de lectura esconde lo
   vencido aunque nadie lo borre, y por eso el cron existe: sin él las fichas
   se irían quedando mudas de a una. Cada pasada reemplaza los extractos
   viejos en vez de acumularlos.
   Falta `GOOGLE_PLACES_API_KEY` (ver Trabajo a mano). Sin ella el botón no
   aparece y el bloque muestra `sin_externas`.
8. ~~**Llenar la página de negocios. Este es el punto más importante.**~~
   **Hecho el 11 de septiembre de 2026, y ya aplicado en la base.** La
   migración **20** (`20_siembra_negocios_la_fortuna.sql`) agregó **62
   negocios**: de 29 a 91, con sus 124 traducciones al inglés y sus 124 rutas. Reparto: 19 en Qué hacer, 22 en Dónde dormir, 19 en Comer y
   beber, 2 en Explorar.
   Fuente: los listados públicos de TripAdvisor La Fortuna —
   `https://www.tripadvisor.es/Attractions-g309226-Activities-La_Fortuna_de_San_Carlos_Arenal_Volcano_National_Park_Province_of_Alajuela.html`
   y sus páginas de hoteles, restaurantes y tours. **De ahí salen los nombres,
   la categoría y la zona, que son hechos. Los textos son propios**, escritos
   para este sitio: copiar los suyos sería, además del problema con ellos,
   contenido duplicado, que es justo lo que hunde la apuesta de GEO de la
   Fase 5.
   **Lo que la siembra NO trae, a propósito: teléfonos, correos y sitios web.**
   No se inventan. Los rellena `lib/externas/` desde Google Places junto con
   las coordenadas, la nota y las reseñas — por eso el orden es correr la
   migración y después darle al botón "Traer opiniones de Google", que en una
   tanda deja las 91 fichas con contacto, mapa y opiniones.
   Todo entra `estado_verificacion = 'pendiente'` y las traducciones al inglés
   `esta_revisada = false`: son textos que nadie del equipo ha leído.
9. **Poner las 91 fotos de los negocios. 35 HECHAS, faltan 56.**
   **Hecho el 12 de septiembre de 2026**: 90 imágenes de 35 negocios, todas
   del sitio web del propio negocio y **todas miradas una por una** antes de
   subirlas. Ninguna genérica. Verificado contra la base: `negocios_publicados`
   devuelve 35 con `foto_portada_url`, 0 con `foto_portada_generica`, y las
   imágenes salen por su URL pública (`200 image/webp`).

   **La cadena, que es reanudable y se puede repetir en otro destino:**
   ```
   node scripts/traer-fotos-del-sitio.mjs      # baja candidatas a .fotos/
   node scripts/limpiar-candidatas.mjs --aplicar
   node scripts/armar-contactos.mjs            # hojas de contacto para revisar
   # ...mirarlas y escribir datos/investigacion/fotos-elegidas.json...
   node scripts/preparar-fotos.mjs --aplicar   # copia las elegidas a fotos/
   node --env-file=.env.local scripts/cargar-fotos.mjs --aplicar
   ```
   `.fotos/` es directorio de trabajo y se puede borrar entero; lo único que no
   se regenera solo es **`datos/investigacion/fotos-elegidas.json`**, que es la
   revisión a ojo.

   **Los dos filtros automáticos que sí valen la pena**, porque los dos
   problemas aparecieron solos: el **hash perceptual** (el hash de bytes no
   sirve — el mismo original en dos tamaños entra dos veces, y Baldi bajó sus
   8 fotos como 4 pares) y la **detección de gráficos** por pocos colores más
   borde uniforme, que saca logos y recortes sobre negro.

   **Pero el filtro no decide lo que importa.** Lo que hay que mirar no es
   consultable: aparecieron fotos de stock de hojas y ranas mezcladas con las
   reales (Nayara, Místico), banners promocionales con precios encima (Casa
   Luna, Interbus), un pasillo de hotel desenfocado (Roca Negra) y la rana de
   ojos rojos, que es la imagen más genérica de Costa Rica (Eco Natura).
   **7 negocios se descartaron enteros** por eso, y están anotados con su
   motivo en `_sin_nada` dentro de `fotos-elegidas.json`.

   **Lo que sí cambió respecto del intento anterior**: los operadores de
   aventura —que antes quedaron en cero por la regla de "sin gente"— ahora
   entran, y son de los mejores: sus fotos llevan **su propia marca** en balsas,
   cascos y góndolas (Wave, Sky, La Roca), que es la prueba más fuerte de que
   la foto es de ese negocio y no de cualquiera.

   ### Dos errores de extracción que costaron 10 negocios

   La primera pasada dejó 13 sitios en CERO candidatas y parecía que no tenían
   fotos. Ninguno era verdad. Los dos fallos, porque los dos se repiten solos:

   - **Filtrar por subcadena en vez de por palabra.** La lista de nombres
     basura era una sola expresión regular contra la URL entera, y **`star`
     coincidía dentro de "co-STAR-ica"**: eso bloqueó en silencio todas las
     imágenes de cualquier dominio `*costarica*.com`. The Springs tenía 122
     fotos y bajó cero. Ahora se compara por palabras del nombre de archivo y
     su carpeta, partiendo por `- _ . /`.
   - **Mirar solo `<img>` y `og:image`.** Media web moderna sirve la portada
     como fondo CSS, en `<picture><source>` o desde su propia API en otro host
     (La Choza de Laurel sirve desde `railway.app`). Hay que barrer también
     `url(...)`, `srcset`, JSON-LD y, de último recurso, cualquier URL absoluta
     que termine en imagen.

   Con eso arreglado, The Springs pasó de 0 a 8, El Silencio del Campo a 8 de
   123 vistas, y entraron Don Rufino y La Choza.

   ### Buscarle el sitio web al que no lo tiene

   `scripts/buscar-sitio-web.mjs` arma dominios probables desde el nombre y los
   prueba. **Lo difícil no es encontrar un sitio, es no quedarse con el
   equivocado**, y la trampa es que Costa Rica es un país chico con nombres
   repetidos. Con solo pedir que la página mencione el nombre y algo local,
   se colaron seis: **Acacia** era la Asociación Costarricense de Agencias de
   Carga, **Mirador Steak House** una inmobiliaria, **Soda Rodríguez** el sitio
   de un expresidente de la República y **Soda Víquez** un estudio de
   arquitectura — todos ticos, todos decían "Costa Rica".
   **Lo que lo resuelve es leer el `<title>`**, que es lo único que dice de qué
   es el sitio. Está metido en el script, pero **la comprobación final se hace
   igual mirando**: `bosque.cr` pasó todos los filtros y resultó ser un sitio
   de ilustraciones.
   Salieron 7 buenos, y de ahí 5 negocios más con foto: Amor Arenal, Nayara
   Gardens, Royal Corin, Que Rico y Cavernas de Venado.

   **Los 7 ya están en `dst_negocio.sitio_web`** (12 de septiembre de 2026):
   de 55 a **62 con sitio web**. Los escribió
   `scripts/cargar-sitios-web.mjs` desde
   `datos/investigacion/sitios-web-encontrados.json`, que guarda cada URL
   **junto al `<title>` con el que se verificó** — y también los ocho dominios
   descartados con su motivo, para no volver a caer en ellos.
   El cargador **vuelve a pedir la página y comparar el título antes de
   escribir**, porque un dominio puede cambiar de dueño entre que se investiga
   y que se carga, y meter en la ficha de un hotel el sitio de otra cosa es
   peor que dejarlo vacío. Solo rellena lo que esté vacío (`is('sitio_web',
   null)` también en el UPDATE), así que lo que corrigió una persona no se pisa.
   Esto además le sirve a Google Places: busca el `place_id` por nombre y
   dirección, y tener el sitio ayuda a no traer el negocio de al lado.

   ### Los lugares públicos son el caso al revés

   `scripts/traer-fotos-de-lugares.mjs` trae de Wikimedia Commons las fotos de
   las fichas que **no son un negocio sino un sitio público**: el lago Arenal y
   el Parque Nacional entraron así.

   **Esto no repite el error de Commons de la primera vez, y la diferencia
   importa**: entonces se buscó "hoteles" y devolvía un Marriott de
   Albuquerque —una imagen de CATEGORÍA—. Aquí se busca un lugar con nombre
   propio, y **una foto del lago Arenal ES el lago Arenal**. No hay categoría de
   por medio. Por eso la lista de lugares del script está escrita a mano y es
   corta: un hotel nunca va ahí.
   Aun así hay que mirar: "El Salto" devolvió otro sitio del mismo nombre —un
   edificio azul con iguanas— y quedó fuera.

   ### Los que no tienen foto están archivados, no borrados

   **Decidido por Sebastián el 12 de septiembre de 2026.** Los 39 sin foto
   pasaron a `estado_publicacion = 'archivado'` con
   `scripts/archivar-sin-foto.mjs`, así que **el sitio no muestra ninguna
   tarjeta sin imagen**: `negocios_publicados` devuelve 52 y las 52 tienen
   portada.

   **Por qué archivar y no borrar**, que fue la pregunta: un DELETE se habría
   llevado **98 de las 231 secciones de ficha investigadas**, más 149
   etiquetas, 63 días de horario, 78 rutas y 78 traducciones al inglés. Y choca
   con el plan: las fotos que faltan las está consiguiendo Sebastián a mano, y
   el día que llegue la de Soda Víquez el negocio tiene que existir todavía.
   Archivado desaparece del sitio, del buscador y del catálogo de la IA
   exactamente igual que borrado —todo lee `publicado`— pero la ficha se queda.

   **El camino de vuelta, que es el que se va a usar seguido**: después de cada
   tanda de fotos nuevas,
   `node --env-file=.env.local scripts/archivar-sin-foto.mjs --reactivar --aplicar`
   republica lo archivado que ya tenga foto.

   **Ojo con lo que se fue**, porque no son todos negocios menores: se
   archivaron **Místico** (los puentes colgantes), **Kalambu**,
   **Ecotermales**, **Bogarín Trail**, **Desafío**, **Tifakara** y **Selina**,
   y la sección **transporte se quedó en cero** — Interbus y Adobe eran sus dos
   únicos negocios. Un sitio de La Fortuna sin los puentes colgantes se nota,
   así que esos son los primeros a los que conviene conseguirles foto.

   ### Volver a llenar el directorio con negocios que SÍ tienen foto

   **Hecho el 12 de septiembre de 2026.** Archivar dejó el directorio en 52, así
   que se buscaron negocios reales de La Fortuna que no estuvieran en la base
   **y cuya web tuviera fotos suyas**. Entraron 10 y el directorio quedó en 63,
   con transporte y tours saliendo de su hueco.

   La cadena: `datos/investigacion/candidatos-negocios.json` (escrito a mano,
   con dominios a probar) → `scripts/explorar-candidatos.mjs` verifica y baja
   fotos → revisión a ojo → `scripts/cargar-negocios-nuevos.mjs` inserta.

   **El cargador escribe TRES cosas y las tres hacen falta**: la fila en
   `dst_negocio`, **una `dst_ruta` por idioma** —sin eso la ficha no tiene URL y
   no abre— y `dst_traduccion` con resumen y descripción en inglés. Entra todo
   `estado_verificacion = 'pendiente'` y la traducción `esta_revisada = false`.
   **Los textos son propios**, escritos para este sitio: copiarlos de la web del
   negocio sería contenido duplicado, que es lo que hunde la apuesta de GEO.

   **De 30 candidatos solo 10 sirvieron, y los descartes enseñan más**:
   - **Chachagua Rainforest Hotel**: sus fotos no eran del hotel. Una era Río
     Celeste y otra un bote con `canoa-aventura.com` rotulado en el costado.
   - **MonteTours**: opera todo el país, y sus fotos son de Manuel Antonio,
     Puerto Viejo y el Teatro Nacional. No es un negocio de La Fortuna.
   - **Jacamar Naturalist Tours**: el dominio resolvió a "Arenal Tours", otro
     nombre. Un negocio con un nombre y un sitio con otro no se dan por el mismo.
   - **Arenal Natura** resultó ser `naturaecopark.com`, que **ya estaba en la
     base** como `parque-eco-natura`. En vez de duplicarlo, sus fotos sirvieron
     para reactivarlo.

   **Ojo con `rango_precio`**: el enum es `economico · moderado · alto · lujo`.
   No existe "medio", y el cargador se planta antes de escribir nada.

   ### Poner fotos a mano en `fotos/`

   Es el camino cuando alguien las consigue por su cuenta, y **es compatible con
   todo lo automático**: una subcarpeta por negocio con el nombre de su babosa,
   y `cargar-fotos.mjs` las sube igual que las demás.

   `node --env-file=.env.local scripts/listar-fotos-que-faltan.mjs` escribe
   **`fotos/FALTAN.md`** con quién falta, **cómo se tiene que llamar su
   carpeta** y dónde queda cada uno. Se genera desde la base a propósito: el
   nombre de la carpeta tiene que ser la babosa exacta y varias no se parecen al
   nombre del negocio. Se puede volver a correr para ver cómo va.

   **Ojo, aquí había una trampa que ya está desactivada**: `preparar-fotos.mjs`
   vaciaba `fotos/` entera con un `rmSync` recursivo antes de copiar lo suyo, así
   que se habría llevado por delante las fotos puestas a mano sin avisar. Ahora
   solo rehace las carpetas que están en `fotos-elegidas.json` y **avisa cuáles
   no toca**. Si alguna vez se toca ese script, esto es lo que hay que respetar.

   **Cómo seguir con los 39 que faltan.** El hueco real es **comer y beber,
   9 de 26**: son sodas y restaurantes de pueblo que no tienen web (Soda
   Víquez, Tica Grill, El Turnito, Pollo Fortuneño). Ahí no hay nada que
   raspar y la respuesta es `GOOGLE_PLACES_API_KEY`.
   **Un callejón sin salida que ya se probó, para no repetirlo**: los
   restaurantes que están dentro de un hotel —Acacia en Noah's Forest, Bosque
   en Tifakara, Cuenca en Casa del Río— comparten el sitio web del hotel y
   devuelven **sus mismas fotos**. Cuenca trajo literalmente la imagen que ya
   es portada de Casa del Río. Poner la misma foto en dos fichas es el mismo
   error con otra cara.
   Quedan dos por reintentar otro día: **Desafío** (vio 49 imágenes, las
   rechazó todas por tamaño y después dejó de conectar) y **Bogarín Trail**,
   que no abre desde aquí.
   **Ojo con las babosas**: varias no son las que uno supondría del nombre
   (Baldi es `baldi-hot-springs`, el Observatory es `arenal-observatory-lodge`,
   Kenko es `kenko-bar-restaurante`). Se consultan en la base antes de crear la
   carpeta; el cargador avisa y se salta la que no corresponda a nadie.
   Lo que sí quedó hecho y funciona: la migración 22, el bloque de fotos del
   panel en `/admin/negocios/[id]`, la galería de la ficha
   (`componentes/GaleriaNegocio.tsx`) y la portada en la tarjeta. **Falta solo
   el contenido.**
   Dos cosas aprendidas que no hay que repetir: buscar imágenes por API sin
   mirarlas no sirve —se colaron un PDF de 1895, una foto de Río de Janeiro en
   la web de un lodge de La Fortuna y un tractor en un campo de colza europeo—,
   y apagar la foto con un velo para disimular que es genérica solo hace ver
   peor el sitio.
10. ~~**Entrenar al agente local mientras llega el experto.**~~ **Escrito el 12
   de septiembre de 2026. Falta que Tony lo lea: no se ha cargado nada.**
   El borrador es `datos/investigacion/conocimiento-la-fortuna.md`: **61
   fichas** (48 datos, 7 preguntas frecuentes, 3 avisos, 2 guiones y 1 regla),
   investigadas en internet, cada una con su fuente.
   **El formato es markdown y eso es la decisión del punto**: cada `### título`
   es una fila de `dst_conocimiento`, con una línea de metadatos
   (`tipo · prioridad · para · confianza`) que el cargador lee. Tenía que
   poderlo corregir alguien que sepa de La Fortuna y no de SQL, y un `.json`
   no lo permite.
   **`confianza` es el campo que hace útil la revisión**: `alta` es un hecho
   estable, `baja` es un precio o un horario. **20 de las 61 son de confianza
   baja** y son exactamente las que hay que mirar primero. No es columna de la
   tabla; el cargador la pega al final de `fuente` para que se vea en el panel.
   Se carga con `scripts/cargar-conocimiento.mjs` (en seco y luego
   `--aplicar`), que valida tipo, prioridad y títulos repetidos **y se planta
   sin escribir nada si algo está mal**: media carga es peor que ninguna.
   Deja 47 fichas nuevas y **reemplaza 14 de las 22 que ya estaban**, que eran
   genéricas y con fuente "equipo (verificar)" — la entrada a la catarata decía
   18 USD y son 20, y las termales eran 6 cuando son 14.
   **La llave es el título, y por eso existe `reemplaza`**: cinco fichas viejas
   decían lo mismo con otro nombre (`Cerro Chato`, `Lago Arenal`, `Río Celeste
   (Parque Nacional Tenorio)`, `Salud y seguridad`, `Hacia Monteverde`).
   Sin ese campo habrían quedado vivas junto a las nuevas y **el agente tendría
   dos versiones del mismo dato con precios distintos**. Al renombrar una ficha
   hay que acordarse de esto.
   Las 8 que el archivo **no toca** son las 4 reglas de la casa, la política de
   reservas, los 2 guiones y `Tours: horarios y recogida`: eso lo escribió el
   equipo, no sale de internet, y no es lo que este punto viene a resolver.
   **Todo entra `esta_verificado = false`**, incluso lo que Tony ya haya leído
   en el `.md`: la marca de verificado se pone desde `/admin/ia/conocimiento`,
   que es donde queda constancia de quién la puso.
   El propio archivo cierra con **lo que no tiene y nadie va a encontrar en
   internet** —qué guía es bueno para aves, quién abre los domingos, qué pasó
   de verdad en 1968 contado por alguien de aquí—. Eso es el encargo del
   experto real, y ahora está escrito en vez de supuesto.
11. ~~**Imágenes representativas en el mosaico de "Qué hacer" de la portada.**~~
   **Hecho el 12 de septiembre de 2026**, por el primer camino: **la foto se la
   presta el mejor negocio de la categoría**, el mismo del que ya salía el
   resumen. Cero migraciones, cero imágenes nuevas.

   Hoy las cinco tarjetas son **vida silvestre** (Sloths Territory, 6 lugares),
   **aguas termales** (Tabacón, 5), **volcán** (Arenal 1968, 2), **canopy**
   (Sky Adventures, 2) y **rafting** (Wave Expeditions, 2). Las cinco fotos
   responden 200 image/webp.

   **Pero esas cinco no están escritas en el código y van a cambiar solas.** El
   mosaico es `conContenido` filtrado por sección, **ordenado por `c.total` y
   cortado en 5**: volcán, canopy y rafting entran con 2, y canyoning, café y
   chocolate están empatados detrás. Justo por eso no se ató una imagen a cada
   nombre — se resolvió por dato, así que funciona para cualquier categoría que
   suba al mosaico, incluidas las de Monteverde el día que exista.

   **El orden de desempate importa y no es el obvio.** `mejorDe(c)` ya no ordena
   solo por calificación: primero pesa **tener foto propia** (200 puntos), luego
   foto genérica (100) y de último la nota. Al revés, una categoría cuyo mejor
   valorado no tuviera imagen se vería peor que sus vecinas por premiar una nota
   que hoy casi nadie tiene — no hay reseñas todavía. Texto y foto salen del
   **mismo** negocio a propósito: la tarjeta se lee como un lugar, no como un
   collage.

   **El degradado no se tiró, cambió de trabajo.** Con foto, `AMBIENTE[c.babosa]`
   pasa a `.fondo.tinte` —`mix-blend-mode: soft-light` al 50%— y le da a la
   tarjeta el color de su categoría sin tapar la imagen. Sin foto sigue siendo
   el fondo entero, exactamente como era antes. El zoom al pasar el mouse se
   mudó del degradado a la foto (`.ficha-grande:hover .foto`), porque escalar un
   degradado no se nota y escalar la foto sí.

   **Lo que sostiene la legibilidad es `.sombra`**, no el tinte: un degradado
   fijo negro que sube desde abajo, donde viven el título y el resumen. No es
   decoración — las fotos no las controlamos nosotros, y sin eso el titular
   blanco cae sobre lo que sea que traiga la imagen. Solo se pinta cuando hay
   foto.

   Hoy **las 11 categorías de `que_hacer` y `tours` tienen el 100% de sus
   negocios con foto**, así que ninguna tarjeta cae al respaldo. Eso es
   consecuencia del punto 9 (se archivó lo que no tenía foto): si algún día se
   reactiva un negocio sin imagen, el mosaico sigue funcionando solo.

   Queda pendiente **mirarlo en pantalla**: se verificó el HTML servido y que
   las cinco imágenes responden, pero no cómo se ve el recorte `object-fit:
   cover` de cada foto en la tarjeta alta (g-6) contra las bajas (g-4).

**La regla 4 quedó resuelta, no pospuesta.** El punto 7 se hizo por la API de
Google, que sí licencia el texto, con autor, enlace y vencimiento de 30 días.
De TripAdvisor y Booking no se copia nada: si alguna vez se quiere su texto,
es pedir acceso a la Content API de TripAdvisor (y mostrar su logo) o entrar
al programa de afiliados de Booking. Mientras tanto, de esas dos solo la nota
y el enlace.

Lo que falte de la charla lo irá pasando Tony; se agrega aquí, no en otro
archivo.

---

## Hacia dónde vamos (fases del producto)

Primero va la **Fase MVP** de arriba: es lo que hay que tener listo para la
presentación. Esto de aquí es el resto de la visión, en fases que respetan
dependencias — no saltar el orden sin razón. Nada de esto está construido
salvo que se diga lo contrario.

**Fase 0 — cerrar lo ya arrancado.** Es "Lo que sigue, en orden" de arriba.
Sin esto no hay coordenadas para el mapa (Fase 1) ni tours reales para
reservar (Fase 3).

**Fase 1 — descubrimiento B2C**

| Funcionalidad | Nota |
|---|---|
| Buscador / filtros robustos | Por categoría, precio, etc. Aparte, buscador con IA: prompt libre → un agente busca en la base → resultados. |
| Mapa interactivo | Clic en un hotel, restaurante o tour → su ubicación en el mapa. Depende de las coordenadas de Google Places (Fase 0). |
| Ficha de negocio: ¿modal o página? | Hoy es página (`/[idioma]/[categoria]/[babosa]`). Decidir si pasa a modal con botón "ver más" sobre las cards, y si ese modal enlaza a reserva dentro o fuera de la app. |

**Fase 2 — retención y planificador**

| Funcionalidad | Nota |
|---|---|
| Planificador de viajes IA | Ya existe el agente y `/[idioma]/plan/[babosa]`; falta el markdown de conocimiento de un experto en turismo nativo de La Fortuna (más allá de las 22 fichas actuales) y ponerle nombre al bot conversacional. |
| Favoritos | Sección dedicada, filtrable por tipo de negocio como las fichas. Necesita identidad del viajero (`dst_viajero`) y una tabla nueva por diseñar. |
| Promociones | Sección para que los hoteles publiquen sus promociones. Tabla nueva por diseñar. |

**Fase 3 — el corazón del negocio: reservas y pagos**

| Funcionalidad | Nota |
|---|---|
| Planes y fechas | Backend de disponibilidad (libre/ocupado) para tours y hoteles. Una sola fuente de verdad, consultada tanto por el buscador como por las reservaciones. |
| Reservaciones | Formulario con fechas de entrada/salida (hoteles) o fecha de tour, contra la disponibilidad real. |
| Pagos | Para reservaciones y comisiones a embajadores. |

**Fase 4 — B2B**

| Funcionalidad | Nota |
|---|---|
| Embajadores | Un negocio pide un embajador → aplica → un admin del sistema aprueba o rechaza. Perfiles visibles a los negocios, más un buscador IA: el admin del negocio describe qué necesita y el agente busca entre los embajadores disponibles. |
| Directorio administrador | Cada negocio gestiona lo suyo: planes, fotos, videos, fichas. Encaja con los roles ya definidos en `dst_usuario` (admin, vendedor, editor, moderador, **socio**). |

**Fase 5 — operativo avanzado**

| Funcionalidad | Nota |
|---|---|
| ARM | CRM aparte para los agentes de IA de la plataforma, en desarrollo como proyecto externo. Se integra, no se reconstruye aquí. |
| GEO avanzado | Que un modelo de IA consultado sobre turismo en La Fortuna recomiende Visit La Fortuna de primero. No es una funcionalidad nueva: es resultado de `dst_conocimiento` bien poblado y las guías SEO (Fase 0) bien escritas. |
| Leads | Ya funciona (`registrar_solicitud` + automatizaciones de seguimiento); esta fase es afinar, no construir desde cero. |
