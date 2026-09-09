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
| Migraciones | 16, todas guardadas en `supabase/plataforma/` |
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
`*.supabase.co`, así que desde el contenedor no se puede llamar a la API REST.
La base se trabaja por el conector de Supabase, y el sitio y el panel se
prueban desplegados. `npx tsc --noEmit` y `npm run build` sí corren aquí.

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
- **Al panel se entra por invitación** (`dst_invitacion` → trigger en
  `auth.users` → `dst_usuario`). Roles: admin, vendedor, editor, moderador,
  socio. Un destino nuevo nace con agentes, plantillas y automatizaciones
  (trigger `dst_destino_inteligencia`).
- **Secretos solo en variables de entorno** (`.env.example`). `dst_canal`
  guarda el NOMBRE de la variable, nunca el valor.

## Lo que sigue, en orden

1. Poner en Vercel `ANTHROPIC_API_KEY`, `SUPABASE_SECRET_KEY` y `CRON_SECRET`;
   entrar a `/admin` con el correo invitado y verificar las 22 fichas de
   conocimiento.
2. Conectar WhatsApp Cloud API (canal en Ajustes + `WHATSAPP_*`) y correo
   (`RESEND_API_KEY`).
3. Cargar los primeros 30 tours reservables con precio y comisión (desde
   `/admin/tours`).
4. Escribir las 10 guías SEO de arranque (borradores con `/admin/guias`).
5. Google Places para coordenadas, horarios y agregados externos.
6. Traducir a pt, fr y de lo que ya está en es/en.

---

## Hacia dónde vamos (fases del producto)

La lista de arriba es lo inmediato. Esto es el resto de la visión, en fases
que respetan dependencias — no saltar el orden sin razón. Nada de esto está
construido salvo que se diga lo contrario.

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
