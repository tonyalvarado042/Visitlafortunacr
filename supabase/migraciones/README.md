# Migraciones de visitlafortunacr

Estas migraciones estan **aplicadas** en el proyecto Supabase
`tonyalvarado042's Project` (ref `mlhhhwbgymobcxiklnoz`), dentro del esquema
`directorio`.

## Por que en un esquema y no en un proyecto aparte

La cuenta llego al limite de dos proyectos gratuitos, ambos con datos reales:
GraceDay y el proyecto general con el CRM, Humaya y prospectos. Un esquema de
Postgres es un espacio de nombres aislado: `directorio` no comparte ni una tabla
con `public`, tiene sus propios permisos y sus propias politicas RLS. El CRM no
se toco.

Si en algun momento se quiere proyecto propio, se migra entero:

```bash
pg_dump --schema=directorio "$CADENA_ORIGEN" > directorio.sql
psql "$CADENA_DESTINO" < directorio.sql
```

## Orden

Se aplican en orden numerico. Cada una depende de la anterior.

| Archivo | Que crea |
|---|---|
| `01_fundamentos.sql` | Esquema, 9 tipos enumerados, `categoria`, `etiqueta`, `perfil` |
| `02_negocio.sql` | `negocio` y sus tablas hijas: etiquetas, horarios y fotos |
| `03_resenas_y_reclamos.sql` | Resenas propias, resenas externas, reclamos y redirecciones |
| `04_funciones_triggers_rls.sql` | 4 funciones, 7 triggers, la vista publica, permisos y RLS |
| `../semillas/05_catalogos.sql` | 7 categorias, 18 subcategorias, 22 etiquetas |
| `../semillas/06_negocios.sql` | 29 negocios reales de La Fortuna |

## Aplicar desde cero

```bash
for f in 01_*.sql 02_*.sql 03_*.sql 04_*.sql; do psql "$CADENA" -f "$f"; done
psql "$CADENA" -f ../semillas/05_catalogos.sql
psql "$CADENA" -f ../semillas/06_negocios.sql
```

## Antes de conectar el sitio

En el panel de Supabase, **Settings > API > Exposed schemas**, hay que agregar
`directorio`. Sin eso PostgREST no lo sirve y el cliente no ve ninguna tabla,
aunque los permisos y las politicas esten bien puestos.
