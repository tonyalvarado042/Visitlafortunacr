# Cómo lanzar un destino nuevo

Replicar no es copiar el proyecto. Es **una llamada a la base y un dominio
apuntado**. Todo lo demás ya existe: el código del sitio es uno solo y lee de
`dst_destino` qué destino está sirviendo, con qué marca y en qué idiomas.

---

## Los 4 pasos

### 1. La llamada (30 segundos)

```sql
select destinos.lanzar_destino(
  p_babosa       => 'monteverde',
  p_nombre       => 'Monteverde',
  p_dominio      => 'visitmonteverdecr.com',
  p_pais_iso     => 'CR',
  p_pais_nombre  => 'Costa Rica',
  p_zona_horaria => 'America/Costa_Rica',
  p_marca_nombre => 'Visit Monteverde CR',
  p_marca_sigla  => 'VMV',
  p_moneda_iso   => 'CRC',
  p_region       => 'Puntarenas',
  p_lema_es      => 'El bosque nuboso te espera.',
  p_lema_en      => 'The cloud forest is waiting.',
  p_latitud      => 10.3009,
  p_longitud     => -84.8225,
  p_categorias_excluidas => array['aguas-termales','volcan']
);
```

Eso crea el destino y le enciende **47 categorías** del catálogo global. Nace
apagado (`esta_activo = false`): un destino sin contenido no se sirve.

**Para otro país** cambian cuatro cosas: `p_pais_iso`, `p_zona_horaria`,
`p_moneda_iso` y `p_idiomas`. Un destino en Portugal sería
`p_idiomas => array['pt','en']` y `p_moneda_iso => 'EUR'`. La plataforma no
supone Costa Rica en ninguna parte.

**Para otra paleta**, se pasan los colores. El código del sitio no trae colores
propios: los lee de `dst_destino`.

### 2. El dominio (10 minutos)

Apuntar el dominio a Vercel. El sitio resuelve el destino por el `Host` de cada
petición contra `dst_destino.dominio`. No hay despliegue nuevo, ni variable de
entorno por destino, ni rama aparte.

### 3. El contenido (la parte que sí toma tiempo)

Es lo único que no se automatiza, y es a propósito: **el contenido es la
ventaja competitiva**. Un destino se abre al público con:

| Mínimo para encender | Cantidad |
|---|---|
| Negocios con ficha completa | 80–100 |
| Tours reservables | 25–30 |
| Guías SEO escritas | 8–10 |
| Fotos de portada por categoría | 1 por categoría encendida |

Se carga con el panel en `/admin`, con importación masiva, o con el mismo
método que se usó en La Fortuna: investigación de fuentes oficiales y siembra
por SQL, marcando honestamente el `estado_verificacion` de cada ficha.

### 4. Encender

```sql
update destinos.dst_destino
   set esta_activo = true, lanzado_el = current_date
 where babosa = 'monteverde';
```

---

## Qué se comparte y qué no

| Se comparte entre todos los destinos | Es propio de cada destino |
|---|---|
| El código del sitio y del panel | Dominio, marca, colores, tipografía |
| El catálogo de 48 categorías | Cuáles enciende y con qué nombre local |
| Las 26 etiquetas | Negocios, tours, guías, fotos |
| Las funciones y las políticas de acceso | Viajeros, solicitudes, reservas, comisiones |
| El planificador y las secuencias de correo | Idiomas, moneda, zona horaria |

**Los datos nunca se cruzan.** Cada política de acceso filtra por
`destino_id`, y `destinos.tiene_acceso_a()` decide qué destinos ve cada
miembro del equipo. Un vendedor de Monteverde no puede leer la cartera de
La Fortuna aunque comparta base.

---

## Por qué una sola base y no una por destino

| | Una base (elegido) | Una por destino |
|---|---|---|
| Lanzar un destino | Una llamada SQL | Migración completa |
| Corregir un error del esquema | Una vez | N veces |
| Un viajero que consulta 3 destinos | Se ve en un panel | Invisible entre bases |
| Panel del equipo | Uno | N |
| Radio de un fallo de permisos | Todos los destinos | Uno |

El último punto es el precio real, y por eso las políticas llevan `destino_id`
desde el primer día en vez de agregarse después.

---

## El caso de un país nuevo

Cuando un país llegue a mucho volumen, o su ley de datos lo exija (la UE, por
ejemplo), el esquema se mueve entero sin rediseñar nada:

```bash
pg_dump --schema=destinos "$ORIGEN" > destinos.sql
psql "$DESTINO" < destinos.sql
delete from destinos.dst_destino where pais_iso <> 'PT';   -- en la copia
delete from destinos.dst_destino where pais_iso  = 'PT';   -- en el original
```

Como todo cuelga de `destino_id` con borrado en cascada, partir la base es
borrar destinos en cada lado.
