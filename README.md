# Visit La Fortuna CR

Plataforma privada de destinos: **contenido + directorio + planificador +
marketplace de tours + captación de leads + agencia**. El primer destino es
La Fortuna; está construida para replicarse a cientos de destinos en el mundo.

> **Leé `CLAUDE.md` antes de tocar nada.** Ahí están las decisiones tomadas y
> dónde vive cada base de datos.

## Qué hay aquí

```
CLAUDE.md                          El cerebro: decisiones y mapa de esquemas
sitio/portada.html                 La portada, con la marca VLF
supabase/plataforma/*.sql          El esquema de la plataforma
docs/plataforma/
  replicar-un-destino.md           Cómo lanzar VisitMonteverdeCR
docs/diseno/01-nomenclatura.md     Cómo se nombra todo
datos/investigacion/               Los 29 negocios y su fuente
```

## La base

Proyecto Supabase **`visitdestinos`** (`eulkufetcymallfbpone`), esquema
`destinos`, prefijo `dst_`. Independiente del CRM de inversionistas.

| | |
|---|---|
| Tablas | 32 |
| Políticas de acceso | 54 |
| Avisos de seguridad | 0 |
| Destinos | 1 · La Fortuna (apagado hasta cargar contenido) |
| Categorías | 48 en catálogo global, 47 encendidas |
| Negocios | 29 publicados, 9 verificados en fuente oficial |

## Lanzar otro destino

```sql
select destinos.lanzar_destino(
  'monteverde', 'Monteverde', 'visitmonteverdecr.com', 'CR', 'Costa Rica',
  'America/Costa_Rica', 'Visit Monteverde CR', 'VMV', 'CRC',
  p_categorias_excluidas => array['aguas-termales','volcan']
);
```

Eso es todo lo que hace falta del lado de la base. Ver
`docs/plataforma/replicar-un-destino.md`.

## Lo siguiente

1. Exponer el esquema `destinos` en la API de Supabase.
2. Cargar 30 tours reservables con precio y comisión.
3. Escribir las 10 guías SEO de arranque.
4. Google Places para coordenadas, horarios y agregados.
5. Construir el sitio en Next.js y el panel en `/admin`.
