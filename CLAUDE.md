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
3. **Bilingüe desde el día uno**: columnas hermanas `_es` / `_en`. Excepción:
   `dst_negocio.nombre` no se traduce (Don Rufino se llama igual en inglés).
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

## Estado actual (1 de septiembre de 2026)

| | |
|---|---|
| Tablas | 32 |
| Políticas de acceso | 54 |
| Avisos de seguridad | 0 |
| Destinos | 1 (La Fortuna, apagado hasta cargar contenido) |
| Categorías en catálogo | 48 globales, 47 encendidas en La Fortuna |
| Etiquetas | 26 |
| Negocios | 29 publicados, 9 con datos verificados en fuente oficial |
| Tours cargados | 0 |
| Guías escritas | 0 |

---

## Lo que sigue, en orden

1. Exponer el esquema `destinos` en la API (Settings → API → Exposed schemas).
2. Cargar los primeros 30 tours reservables con precio y comisión.
3. Escribir las 10 guías SEO de arranque.
4. Google Places para coordenadas, horarios y agregados externos.
5. Construir el sitio y el panel en `/admin`.
