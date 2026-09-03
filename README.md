# Visit La Fortuna CR

Plataforma privada de destinos: **contenido + directorio + planificador +
marketplace de tours + captación de leads + agencia**. El primer destino es
La Fortuna; está construida para replicarse a cientos de destinos en el mundo.

> **Leé `CLAUDE.md` antes de tocar nada.** Ahí están las decisiones tomadas y
> dónde vive cada base de datos.

## Qué hay aquí

```
CLAUDE.md                          El cerebro: decisiones y mapa de esquemas
app/                               El sitio (Next.js 15) y el panel /admin
lib/ia/                            Los cinco agentes de IA (Claude)
lib/automatizaciones.ts            El motor de seguimiento
supabase/plataforma/*.sql          Las 16 migraciones del esquema
docs/plataforma/
  replicar-un-destino.md           Cómo lanzar VisitMonteverdeCR
  backend-e-inteligencia.md        Cómo está armado el CRM, la IA y el panel
docs/diseno/01-nomenclatura.md     Cómo se nombra todo
datos/investigacion/               Los 29 negocios y su fuente
```

## La base

Proyecto Supabase **`visitdestinos`** (`eulkufetcymallfbpone`), esquema
`destinos`, prefijo `dst_`. Independiente del CRM de inversionistas.

| | |
|---|---|
| Tablas | 46 |
| Migraciones | 16 |
| Destinos | 1 · La Fortuna |
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

## Correr

```bash
npm install
npm run dev        # sitio en http://localhost:3000, panel en /admin
npm run build
```

Las variables de entorno están explicadas en `.env.example`. Sin
`ANTHROPIC_API_KEY` y `SUPABASE_SECRET_KEY` el sitio y el panel funcionan,
pero la IA no.

## Lo siguiente

Está en `CLAUDE.md`, sección "Lo que sigue".
