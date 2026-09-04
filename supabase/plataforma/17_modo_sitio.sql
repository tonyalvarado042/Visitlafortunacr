-- =========================================================================
-- 17 · Modo del sitio: teaser o completo
--
-- Un destino puede estar encendido (esta_activo) pero todavia no tener
-- contenido que valga la pena mostrar. Antes de esto solo habia dos estados:
-- apagado (el sitio revienta con un error) o completo. Faltaba el de en medio.
--
-- Ojo con la diferencia, que no es la misma cosa:
--   esta_activo = false  -> la politica RLS ni deja leer la fila del destino.
--                           El sitio no puede pintar NADA, ni los colores.
--   modo_sitio  = teaser -> el destino se lee normal, con su marca y su
--                           paleta, pero el sitio publico muestra una sola
--                           pantalla de prelanzamiento y esconde el
--                           directorio, las fichas y el planificador.
--
-- Volver al sitio completo es cambiar este campo desde Ajustes. No hay que
-- desplegar nada.
-- =========================================================================

alter table destinos.dst_destino
  add column if not exists modo_sitio text not null default 'completo';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ck_dst_destino_modo_sitio'
  ) then
    alter table destinos.dst_destino
      add constraint ck_dst_destino_modo_sitio
      check (modo_sitio in ('completo', 'teaser'));
  end if;
end $$;

comment on column destinos.dst_destino.modo_sitio is
  'Que muestra el sitio publico: "completo" el directorio entero, "teaser" una '
  'sola pantalla de prelanzamiento con captura de correos. NO es un interruptor '
  'de encendido: para eso esta esta_activo, que ademas corta el acceso de '
  'lectura. En teaser el destino se lee normal y su marca se sigue usando.';

comment on column destinos.dst_destino.lanzado_el is
  'Fecha de apertura al publico. En modo teaser es a donde apunta la cuenta '
  'regresiva, a las 00:00 de la zona_horaria del destino. En null, el teaser '
  'dice "muy pronto" sin numeros: nunca se inventa una fecha.';
