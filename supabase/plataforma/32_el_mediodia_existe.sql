/*
 * 32 — El mediodía existe.
 *
 * 6 de noviembre de 2026.
 *
 * LA CAUSA RAÍZ de que un itinerario quedara público y vacío el 14 de octubre
 * de 2026. El desajuste era de un solo valor:
 *
 *   El esquema que `lib/ia/planificador.ts` le pide al modelo (línea ~20):
 *     z.enum(['manana', 'mediodia', 'tarde', 'noche'])     ← CUATRO
 *
 *   El CHECK de esta tabla:
 *     momento = ANY (ARRAY['manana', 'tarde', 'noche'])    ← TRES
 *
 * `mediodia` estaba previsto en todas partes MENOS acá: está en el enum de
 * zod, lo pinta la página pública con `t('momento_' + p.momento)`, y
 * `momento_mediodia` está traducido a los cinco idiomas en `lib/idiomas.ts`
 * («Mediodía / Midday / Meio-dia / Midi / Mittag»). O sea: es un valor que
 * FALTA en la restricción, no uno de más en el código.
 *
 * Lo que costó: el insert de paradas va por lote, y **una sola parada de
 * almuerzo tumbaba el lote completo**. El `throw` que seguía se llevó el
 * enlace al lead y el correo al viajero, y dejó la fila del itinerario —ya
 * insertada— pública y sin una sola parada.
 *
 * El código ya no deja fila a medias pase lo que pase (ver el comentario
 * grande en `planificador.ts`), pero esto es lo que arregla la causa.
 *
 * CÓMO COMPROBAR que quedó bien, sin tocar datos de verdad:
 *
 *   begin;
 *     insert into destinos.dst_itinerario_parada (itinerario_id, dia, momento, titulo_libre)
 *     select id, 1, 'mediodia', 'prueba del mediodia'
 *       from destinos.dst_itinerario limit 1;
 *     -- antes de esta migración: viola ck_dst_parada_momento
 *     -- después: entra sin chistar
 *   rollback;
 */
alter table destinos.dst_itinerario_parada
  drop constraint if exists ck_dst_parada_momento;

alter table destinos.dst_itinerario_parada
  add constraint ck_dst_parada_momento
  check (momento is null or momento in ('manana', 'mediodia', 'tarde', 'noche'));

comment on column destinos.dst_itinerario_parada.momento is
  'manana | mediodia | tarde | noche. Tiene que coincidir EXACTAMENTE con el z.enum de lib/ia/planificador.ts: si el modelo devuelve un valor que el CHECK no acepta, se cae el insert del lote entero y se pierde el itinerario completo. Pasó el 14 de octubre de 2026 con mediodia.';

notify pgrst, 'reload schema';
