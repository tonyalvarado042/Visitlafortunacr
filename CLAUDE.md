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
4. **Las reseñas ajenas no se copian.** Se muestra la nota y el conteo con
   enlace a la fuente. Solo Google Places entrega texto, y con vencimiento
   (`expira_en`), que además está metido en la política de lectura.
5. **Neutralidad editorial.** Bike & Bed y los hoteles propios llevan
   `es_casa = true`, que es **interno y nunca se muestra**. Aparecen donde
   genuinamente corresponden ("mejores hoteles para ciclistas"). La ventaja
   viene de controlar el canal, no de decir que somos los dueños.
6. **El dinero no mueve la nota.** Un destacado se ve arriba y se rotula como
   pagado. Su calificación es la que sea.
7. **El sitio público escribe por una sola puerta**: la función
   `destinos.registrar_solicitud(...)`. No hay INSERT directo desde la llave
   pública a ninguna tabla.
8. **Dos sesiones trabajan a la vez, dos personas.** La rama
   `claude/la-fortuna-directory-design-l8qnxg` la empuja más de uno. Antes de
   publicar: `git fetch` y **rebase** sobre el remoto, nunca `push --force` ni
   descartar lo ajeno. Si el rebase choca, se avisa y se resuelve a mano; el
   trabajo del otro no se pisa.
9. **Lo que se hace a mano se anota aquí, no se pregunta.** Claude no tiene
   acceso a GoDaddy, Vercel, el panel de Supabase, Meta ni SiteGround. Cuando
   Tony diga "entrá a GoDaddy" (o a cualquiera de esas), la respuesta NO es
   pedir permiso ni explicar que no se puede: es dejar escrito en
   **Trabajo a mano** de este archivo el paso exacto, con los valores exactos
   que hay que pegar, y avisar que quedó anotado. Si un valor lo decide el
   proveedor en pantalla, se dice cuál manda.

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

## Estado actual (3 de septiembre de 2026)

| | |
|---|---|
| Tablas | 46 (35 del directorio y CRM + 11 de inteligencia) |
| Migraciones | 18, todas guardadas en `supabase/plataforma/` |
| Avisos de seguridad | 0 nuevos (queda el aviso previo por `regconfig` en `dst_idioma`) |
| Destinos | 1 (La Fortuna, encendido) |
| Categorías en catálogo | 48 globales, 47 encendidas en La Fortuna |
| Idiomas | 5 · es, en, pt, fr, de |
| Negocios | 29 publicados, 9 con datos verificados en fuente oficial |
| Tours cargados | 0 |
| Guías escritas | 0 |
| Conocimiento de la IA | 22 fichas de La Fortuna, sin verificar por el equipo |
| Agentes | 5 por destino (concierge, planificador, seguimiento, analista, redactor) |
| Automatizaciones | 10 de arranque, encendidas |
| Panel `/admin` | Completo; el primer administrador entra con la invitación de `aalvarado@gmail.com` |
| Sitio | Next.js 15, compila, lee de la base, chat concierge en todas las páginas |

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
/api/ia/conversar       chat del sitio (POST habla, GET consulta respuestas humanas)
/api/ia/planificar      generar un plan (sesión del equipo o CRON_SECRET)
/api/webhooks/whatsapp  WhatsApp Cloud API (GET verifica, POST recibe)
/api/cron/automatizaciones  el motor de seguimiento (vercel.json: diario en Hobby, cada hora en Pro)
/admin                  el panel (CRM + IA + contenido + equipo)
```

El destino se resuelve por el `Host` de cada petición contra
`dst_destino.dominio`. Un solo despliegue sirve todos los destinos.

**Ojo con el entorno de Claude Code**: el proxy de egress deniega
`*.supabase.co` y `*.vercel.app`, así que desde el contenedor no se puede
llamar a la API REST ni abrir el sitio. La base se trabaja por el conector de
Supabase, y el sitio y el panel se prueban desplegados. `npx tsc --noEmit` y
`npm run build` sí corren aquí.

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

Pasos fuera del código y de la base. Claude no puede ejecutarlos: los deja
escritos aquí con los valores exactos, y Tony los pega.

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

### Supabase · dejar de depender de su SMTP

Panel de Supabase → *Authentication*:

- *Sign In / Providers* → *Email* → **apagar "Confirm email"**. El acceso al
  panel lo protege la invitación, no el correo, y el SMTP por defecto de
  Supabase se queda sin cupo con tres o cuatro envíos.
- Si se quiere que Supabase también mande por SiteGround: *Emails* →
  *SMTP Settings* → *Custom SMTP*, con los mismos cuatro valores de arriba.

### Vercel · variables que faltan

`ANTHROPIC_API_KEY`, `SUPABASE_SECRET_KEY`, `CRON_SECRET` y las `SMTP_*`.
Después de agregarlas hay que **volver a desplegar**: Vercel no las inyecta en
un despliegue ya hecho. `/admin/ajustes` muestra cuáles están puestas.

## Lo que sigue, en orden

1. Poner en Vercel `ANTHROPIC_API_KEY`, `SUPABASE_SECRET_KEY` y `CRON_SECRET`;
   entrar a `/admin` con el correo invitado y verificar las 22 fichas de
   conocimiento.
2. Hacer los pasos de **Trabajo a mano**: DNS en GoDaddy, buzón en SiteGround,
   variables en Vercel, confirmación de correo apagada en Supabase.
3. Conectar WhatsApp Cloud API (canal en Ajustes + `WHATSAPP_*`).
4. Cargar los primeros 30 tours reservables con precio y comisión (desde
   `/admin/tours`).
5. Escribir las 10 guías SEO de arranque (borradores con `/admin/guias`).
6. Google Places para coordenadas, horarios y agregados externos.
7. Traducir a pt, fr y de lo que ya está en es/en.

---

## Fase MVP — la demo (esto es lo que se hace AHORA)

Sale de la charla del 11 de septiembre de 2026 (`CHARLA2.md`). Manda sobre
todo lo demás: primero esto, después Fase 0 y el resto.

**El marco**: es un MVP para presentar. **La veracidad del dato no bloquea.**
Se carga lo que haya en internet y se corrige después con Google Places
(Fase 0, punto 5). Todo lo que entre en esta fase nace
`estado_verificacion = 'pendiente'` y el conocimiento con
`esta_verificado = false`; así se sabe qué hay que repasar cuando lleguen
los datos buenos. Se carga en es y en; pt, fr y de después.

Los puntos, en el orden en que se van a hacer:

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
   el volcán dibujado**.
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
5. **Reseñas propias con calificación.** Fuera el "Todavía sin reseñas"
   (`sin_resenas` en `lib/idiomas.ts`, usado en la tarjeta, el listado y la
   ficha). En su lugar, cinco íconos para calificar — **no estrellas**:
   volcanes u otra cosa, se va probando. Al calificar se abre un modal para
   dejar el comentario, como en cualquier sistema de reseñas. La tabla es
   `dst_resena` y ya existe.
6. **Ficha de negocio completa y con desplegables.** Conforme entran los
   negocios se llena su ficha con toda la información. Referencia de
   maquetación: `ref/REFERENCIA_INFO_NEGOCIO.png` (TripAdvisor) — secciones
   plegables ("Servicios incluidos", "Qué esperar", "Encuentro y recogida",
   "Información adicional") para que quepa todo sin que se vea denso.
7. **"Lo que dicen en otras plataformas" con extractos reales.** Hoy ese
   bloque muestra `sin_resenas`. Debe mostrar opiniones de Google, Booking y
   demás, cada una con el nombre del usuario tal como aparece en la fuente,
   la nota y el enlace. Las tablas ya existen: `dst_resena_externa` (nota y
   conteo por plataforma) y `dst_resena_externa_extracto` (autor, texto,
   enlace). Las nuestras se mezclan ahí cuando las haya.
8. **Llenar la página de negocios. Este es el punto más importante.** Fuente:
   TripAdvisor La Fortuna —
   `https://www.tripadvisor.es/Attractions-g309226-Activities-La_Fortuna_de_San_Carlos_Arenal_Volcano_National_Park_Province_of_Alajuela.html`.
   Cada negocio entra con su ficha llena (punto 6), no solo con el nombre.
9. **Entrenar al agente local mientras llega el experto.** Recopilar de
   internet todo lo que haya sobre La Fortuna y dejarlo en un `.md` de
   entrenamiento, **para revisión de Tony antes de cargarlo** a
   `dst_conocimiento`. Es el puente hasta que el experto real pase su archivo.

**Ojo con la regla 4** (las reseñas ajenas no se copian). El punto 7 la roza:
para la demo se cargan extractos con autor y enlace a la fuente, y se guardan
con `expira_en` como cualquier otro dato externo. Antes de producción hay que
resolverlo de verdad — Google Places sí entrega texto con licencia;
TripAdvisor y Booking no. No se olvida.

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
