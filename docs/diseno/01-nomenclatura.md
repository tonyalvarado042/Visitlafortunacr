# Reglas de nomenclatura de visitlafortunacr

Regla que manda sobre todas las demas: **un nombre se lee y se entiende sin
abrir la definicion**. Si hace falta un comentario para saber que guarda una
columna, el nombre esta mal puesto.

El proyecto es bilingue de cara al visitante, pero **el codigo y la base de datos
se escriben en espanol**, igual que el resto de los proyectos de Tony
(`personas`, `actividades`, `prospectos`, `crm_tony_alvarado_contactos`). La
excepcion son las palabras que Postgres, Supabase o el framework ya imponen en
ingles (`id`, `created_at` de Supabase Auth, `select`, `public`).

---

## 1. Base de datos

### 1.1 Esquemas

| Esquema | Que vive ahi |
|---|---|
| `directorio` | Todo lo de visitlafortunacr. Aislado del resto del proyecto. |
| `public` | No se toca. Ahi vive el CRM y Humaya, que no son de este sitio. |
| `auth` | Gestionado por Supabase. No se modifica. |

Todo objeto de este sitio se crea calificado: `directorio.negocio`, nunca
`negocio` a secas.

### 1.2 Tablas

- `snake_case`, **singular**: `negocio`, `resena`, `categoria`.
  Singular porque una fila es un negocio, y `negocio.nombre` se lee mejor que
  `negocios.nombre`.
- Tabla puente entre dos entidades: nombre de las dos en orden alfabetico,
  `negocio_etiqueta`, `negocio_servicio`.
- Toda tabla lleva `COMMENT ON TABLE` en espanol explicando **para que sirve y
  que NO es**. Un comentario que solo repite el nombre de la tabla sobra.

### 1.3 Columnas

- `snake_case`, sin prefijo del nombre de la tabla.
  Bien: `negocio.nombre`. Mal: `negocio.negocio_nombre`.
- Clave primaria: siempre `id`, tipo `uuid` con `gen_random_uuid()`.
- Clave foranea: `<tabla_referida>_id`. `resena.negocio_id` apunta a
  `negocio.id`. Si hay dos FK a la misma tabla, se cualifica el rol:
  `resena.autor_id` y `resena.moderador_id`, ambas a `perfil.id`.
- Booleanos: se leen como afirmacion, con prefijo `es_`, `tiene_` o `esta_`.
  `es_destacado`, `tiene_estacionamiento`, `esta_publicado`.
  Nunca en negativo: `esta_publicado` si, `no_publicado` no.
- Fechas y horas: `timestamptz` con sufijo `_en` para el instante en que algo
  paso (`creado_en`, `actualizado_en`, `publicado_en`, `verificado_en`) y
  sufijo `_el` para fechas sueltas tipo `date`.
- Cantidades: prefijo `total_` para acumulados (`total_resenas`) y `promedio_`
  para promedios (`promedio_calificacion`).
- Dinero: sufijo con la moneda, `precio_usd`, `precio_crc`. Tipo `numeric(10,2)`,
  nunca `float`.
- Identificador legible en la URL: `babosa`. Es el termino que usa este proyecto
  para lo que en ingles se llama *slug*.

### 1.4 Campos bilingues

Un campo traducible se guarda en dos columnas hermanas con sufijo de idioma:

```
nombre_es      nombre_en
descripcion_es descripcion_en
babosa_es      babosa_en
```

Se eligio esto sobre una tabla `traduccion` aparte porque solo hay dos idiomas
fijos y evita un `join` en todas las consultas de listado, que son las que mas
se ejecutan. Si algun dia entra un tercer idioma, se migra a tabla aparte.

Regla: **el espanol es obligatorio, el ingles puede estar vacio**. Cuando falta
el ingles, el sitio cae al espanol y marca la ficha como pendiente de traducir.

### 1.5 Tipos enumerados

`snake_case` singular, con sufijo que diga que es un enum del dominio:

```
directorio.tipo_categoria
directorio.estado_publicacion
directorio.estado_verificacion
directorio.origen_resena
```

Los valores del enum van en `snake_case` y en espanol: `pendiente`, `publicado`,
`rechazado`.

### 1.6 Indices, restricciones y triggers

| Objeto | Patron | Ejemplo |
|---|---|---|
| Indice | `idx_<tabla>_<columnas>` | `idx_negocio_categoria_id` |
| Indice unico | `uq_<tabla>_<columnas>` | `uq_negocio_babosa_es` |
| Llave foranea | `fk_<tabla>_<tabla_referida>` | `fk_resena_negocio` |
| Restriccion check | `ck_<tabla>_<regla>` | `ck_resena_calificacion_rango` |
| Funcion | verbo en infinitivo | `actualizar_promedio_calificacion()` |
| Trigger | `tg_<tabla>_<cuando>_<que_hace>` | `tg_resena_despues_insertar_recalcular` |
| Vista | `v_<lo_que_muestra>` | `v_negocio_publicado` |
| Politica RLS | frase en espanol que se lee sola | `"cualquiera lee negocios publicados"` |

### 1.7 Lo que esta prohibido

- Abreviar sin necesidad: `descripcion`, no `desc` (que ademas es palabra
  reservada de SQL).
- Mezclar idiomas en un mismo nombre: `negocio_rating` no; `negocio` y
  `calificacion` por separado si.
- `data`, `info`, `valor`, `tipo1`, `campo_extra`: no dicen nada.
- Guardar dos cosas en una columna. Si necesita separador, son dos columnas o
  una tabla hija.

---

## 2. Rutas del sitio

Estructura `/<idioma>/<categoria>/<babosa>`, con el idioma siempre explicito:

```
/es/hoteles                        listado de hoteles
/es/hoteles/tabacon-thermal-resort ficha
/es/restaurantes/don-rufino
/es/tours/desafio-adventure-company
/es/atracciones/catarata-rio-fortuna
/en/hotels/tabacon-thermal-resort  misma ficha, babosa_en y categoria en ingles
```

Reglas de la babosa: minusculas, sin tildes ni enes, palabras unidas con guion
simple, sin articulos iniciales, sin el ano ni la ciudad repetida. Una babosa
publicada **nunca cambia**; si el negocio se renombra se crea la nueva y la
vieja queda como redireccion 301 en `directorio.redireccion`.

---

## 3. Codigo

| Elemento | Convencion | Ejemplo |
|---|---|---|
| Componente | `PascalCase`, en espanol | `FichaNegocio`, `TarjetaResena` |
| Archivo de componente | igual que el componente | `FichaNegocio.tsx` |
| Hook | `use` + `PascalCase` | `useNegocio`, `useResenasDeNegocio` |
| Funcion y variable | `camelCase`, verbo primero | `obtenerNegocioPorBabosa()` |
| Constante global | `SCREAMING_SNAKE_CASE` | `RESENAS_POR_PAGINA` |
| Tipo e interfaz | `PascalCase` singular | `Negocio`, `Resena` |
| Carpeta | `kebab-case` | `componentes/ficha-negocio/` |
| Variable de entorno | `SCREAMING_SNAKE_CASE` con origen | `SUPABASE_URL`, `GOOGLE_PLACES_API_KEY` |

Los tipos de la base se generan, no se escriben a mano:
`supabase gen types typescript --schema directorio`.

---

## 4. Git

Rama: `claude/<tema-en-kebab-case>`.
Commit: `<area>: <que cambio, en imperativo y en espanol>`, con `area` en
`bd`, `web`, `docs`, `datos`, `infra`.

```
bd: crear esquema directorio con negocio, resena y categoria
datos: sembrar 30 negocios verificados de La Fortuna
docs: documentar arquitectura del directorio
```
