-- =========================================================================
-- 20 · El crédito de quien construyó el sitio, en el pie de página
--
-- Va en dst_destino y no fijo en el código porque visitlafortunacr.com lo
-- hizo LIDERAX10, pero el próximo destino lo puede hacer otro. Es la misma
-- regla que los colores y el logo: la marca de cada destino vive en su fila,
-- y se cambia desde Ajustes sin desplegar.
-- =========================================================================

alter table destinos.dst_destino
  add column if not exists pie_credito_texto text,
  add column if not exists pie_credito_url   text;

comment on column destinos.dst_destino.pie_credito_texto is
  'El texto del crédito en el pie, por ejemplo "Desarrollado por LIDERAX10.COM". '
  'Vacío = no se muestra nada.';

comment on column destinos.dst_destino.pie_credito_url is
  'A dónde lleva ese crédito. Vacío = el texto se muestra sin enlace. Solo http '
  'y https: el panel rechaza cualquier otro esquema para que nadie pueda colar '
  'un javascript: en un enlace que ve todo el público.';

update destinos.dst_destino
   set pie_credito_texto = 'Desarrollado por LIDERAX10.COM',
       pie_credito_url   = 'https://liderax10.com'
 where dominio = 'visitlafortunacr.com';
