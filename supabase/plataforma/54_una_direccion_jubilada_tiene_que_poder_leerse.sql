-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Una dirección jubilada tiene que poder leerse, o el 301 no existe.  ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- 21 de noviembre de 2026, probando la pantalla nueva de editar categorías:
-- se le cambió la dirección a una categoría, la vieja quedó guardada con
-- `es_vigente = false` como corresponde… y `/es/culturales` devolvió **404**.
--
-- `es_vigente = false` significa «esta dirección ya no es la buena, pero
-- todavía tiene que llevar a la nueva». Para eso hay que poder LEERLA. Y
-- había dos capas tapándola, las dos con la misma idea equivocada:
--
--   1. `categoriaEnCualquierIdioma()` filtraba `.eq('es_vigente', true)`.
--   2. Esta política: `using (es_vigente)`.
--
-- O sea que **jubilar una dirección nunca sirvió de nada** en este sitio.
-- Arreglar solo la consulta no alcanzaba: la política la habría seguido
-- escondiendo, y el 404 se habría visto igual sin pista de por qué.
--
-- ⚠️ NO HAY NADA QUE ESCONDER ACÁ. Una babosa jubilada es una dirección
-- pública que ya estuvo en internet: compartida, guardada en marcadores,
-- indexada por Google. Taparla no protege nada — solo convierte un «esta
-- página se mudó» en un «esta página ya no existe», que es la forma de
-- perder la posición que esa página tenía.
--
-- La escritura sigue siendo solo del equipo: esa política no se toca.

drop policy if exists "cualquiera lee rutas vigentes" on destinos.dst_ruta;
create policy "cualquiera lee rutas, jubiladas incluidas"
  on destinos.dst_ruta for select to anon, authenticated
  using (true);
