-- 48. Los GRANT que faltaban: siete tablas y una secuencia que nadie podia tocar.
--
-- ⚠️ EL PATRON DEL BUG, que se repite siete veces:
--
-- Se activa RLS, se escriben politicas preciosas... y NO se hace el GRANT. En
-- Postgres el permiso de tabla se revisa ANTES que la politica, asi que la
-- consulta muere sin llegar nunca a la politica:
--
--     permission denied for table dst_tour_opcion
--
-- Las politicas quedan ahi, correctas, sin ejecutarse jamas. Y como el codigo
-- no miraba el error, la pantalla mostraba una lista vacia en vez de decir
-- «no puedo leer esto» — un fallo callado de manual, porque una lista vacia
-- se lee como «no hay nada» y uno vuelve a cargar lo que ya estaba.
--
-- Encontrado el 10 de noviembre de 2026 en los registros de Postgres, con
-- estas marcas en 24 horas:
--
--     dst_tour_opcion       23 veces
--     dst_viajero_etiqueta  22 veces
--     dst_ruta               2 veces   <- la mas cara, ver abajo
--     dst_comerciante        2 veces
--     sq_codigo_tour         2 veces
--
-- ────────────────────────────────────────────────────────────────────────────
-- LO QUE ESTO ARREGLA, en orden de lo que costaba:
--
-- 1. CREAR UN TOUR DESDE EL PANEL NO FUNCIONABA. El codigo del tour sale de
--    `sq_codigo_tour`, y nadie tenia USAGE sobre esa secuencia. El insert
--    reventaba entero. Probado el mismo dia: el panel ahora lo dice en
--    pantalla («permission denied for sequence sq_codigo_tour») y antes no
--    decia absolutamente nada.
--
-- 2. LOS NEGOCIOS NACIAN SIN DIRECCION PUBLICA. `crearNegocio` inserta el
--    negocio y despues sus `dst_ruta` —una por idioma—, pero `authenticated`
--    solo tenia SELECT sobre esa tabla. El negocio se creaba y las rutas no,
--    en silencio. **Bike & Bed Hotel Arenal quedo asi**: creado el 10 de
--    noviembre desde el panel, sin una sola ruta, o sea sin URL publica.
--
-- 3. Las opciones de precio de los tours eran invisibles: 11 opciones
--    cargadas en 4 tours que el panel no podia ni leer ni tocar.
--
-- 4. El itinerario del tour (`dst_tour_parada`) no se podia leer **desde el
--    sitio publico**.
--
-- 5. Las etiquetas de viajeros, la ficha del comerciante en su portal y los
--    avisos de resennas: lo mismo.
--
-- ────────────────────────────────────────────────────────────────────────────
-- CADA GRANT SALE DE LAS POLITICAS QUE YA EXISTEN, no al reves. Las politicas
-- siguen decidiendo QUE filas ve cada quien; el grant solo abre la puerta de
-- la tabla. Sin el, la cerradura no llega a probarse.

-- 1. La secuencia del codigo de tour. Sin esto no se crea ni un tour.
grant usage, select on sequence destinos.sq_codigo_tour to authenticated, service_role;

-- 2. dst_ruta: el panel CREA rutas al dar de alta un negocio o un tour.
--    Tenia SELECT y nada mas. El INSERT es lo que faltaba.
grant insert, update, delete on destinos.dst_ruta to authenticated;

-- 3. dst_tour_opcion — politicas: lectura publica de tours publicados,
--    lectura del duenno, administracion del equipo.
grant select on destinos.dst_tour_opcion to anon;
grant select, insert, update, delete on destinos.dst_tour_opcion to authenticated;
grant all on destinos.dst_tour_opcion to service_role;

-- 4. dst_tour_parada — mismas tres politicas. La lectura publica es la que
--    dibuja el itinerario en la pagina del tour.
grant select on destinos.dst_tour_parada to anon;
grant select, insert, update, delete on destinos.dst_tour_parada to authenticated;
grant all on destinos.dst_tour_parada to service_role;

-- 5. dst_comerciante — politicas: cada quien ve y edita SU ficha. Sin INSERT
--    ni DELETE: esas filas las crea el alta del portal, con la clave de
--    servicio.
grant select, update on destinos.dst_comerciante to authenticated;
grant all on destinos.dst_comerciante to service_role;

-- 6. dst_negocio_comerciante — politica: cada quien ve sus negocios ligados.
--    Solo lectura: quien liga un negocio a un duenno es el equipo, no el
--    navegador.
grant select on destinos.dst_negocio_comerciante to authenticated;
grant all on destinos.dst_negocio_comerciante to service_role;

-- 7. dst_viajero_etiqueta — politica: el equipo administra las de sus
--    viajeros. Nada para anon: son datos de personas.
grant select, insert, update, delete on destinos.dst_viajero_etiqueta to authenticated;
grant all on destinos.dst_viajero_etiqueta to service_role;

-- 8. dst_resena_acceso — SIN politicas a proposito: solo la toca el servidor
--    con la clave de servicio (lib/aviso-resena.ts). Por eso aca NO se le da
--    nada a anon ni a authenticated.
grant all on destinos.dst_resena_acceso to service_role;

comment on table destinos.dst_tour_opcion is
  'Opciones de precio de un tour. OJO: RLS + politicas NO alcanzan sin GRANT — ver 48_los_permisos_que_faltaban.sql.';
