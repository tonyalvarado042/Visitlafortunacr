-- Plataforma de destinos | 06: lanzar un destino
-- Esta funcion ES el "un clic". Lanzar VisitMonteverdeCR no es desplegar otro
-- proyecto ni copiar tablas: es una llamada.

create or replace function destinos.lanzar_destino(
  p_babosa        text,
  p_nombre        text,
  p_dominio       text,
  p_pais_iso      char(2),
  p_pais_nombre   text,
  p_zona_horaria  text,
  p_marca_nombre  text,
  p_marca_sigla   text,
  p_moneda_iso    char(3),
  p_nombre_largo  text     default null,
  p_region        text     default null,
  p_lema_es       text     default null,
  p_lema_en       text     default null,
  p_idiomas       text[]   default array['es','en'],
  p_moneda_visitante char(3) default 'USD',
  p_latitud       numeric  default null,
  p_longitud      numeric  default null,
  p_secciones     text[]   default array['que_hacer','tours','donde_dormir','comer_beber','explorar','transporte'],
  p_categorias_excluidas text[] default '{}',
  p_color_tinta      text default '#0B0B0B',
  p_color_acento     text default '#FF6A00',
  p_color_naturaleza text default '#66BB2E',
  p_color_gris       text default '#333333',
  p_tipografia       text default 'Montserrat'
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_destino_id uuid;
  v_encendidas integer;
begin
  insert into destinos.dst_destino (
    babosa, nombre, nombre_largo, dominio, pais_iso, pais_nombre, region,
    zona_horaria, marca_nombre, marca_sigla, lema_es, lema_en,
    idioma_principal, idiomas, moneda_iso, moneda_visitante, latitud, longitud,
    color_tinta, color_acento, color_naturaleza, color_gris, tipografia, esta_activo
  ) values (
    p_babosa, p_nombre, p_nombre_largo, p_dominio, p_pais_iso, p_pais_nombre, p_region,
    p_zona_horaria, p_marca_nombre, p_marca_sigla, p_lema_es, p_lema_en,
    p_idiomas[1], p_idiomas, p_moneda_iso, p_moneda_visitante, p_latitud, p_longitud,
    p_color_tinta, p_color_acento, p_color_naturaleza, p_color_gris, p_tipografia, false
  )
  returning id into v_destino_id;

  insert into destinos.dst_destino_categoria (destino_id, categoria_id, orden)
  select v_destino_id, c.id, c.orden
    from destinos.dst_categoria c
   where c.seccion = any (p_secciones)
     and not (c.babosa_es = any (p_categorias_excluidas));

  get diagnostics v_encendidas = row_count;
  raise notice 'Destino % creado con % categorias encendidas.', p_dominio, v_encendidas;
  return v_destino_id;
end;
$$;

comment on function destinos.lanzar_destino is
  'Lanza un destino nuevo en una llamada: crea la fila y le enciende las categorias del catalogo global que le correspondan. Nace apagado a proposito: un destino sin contenido no debe servirse al publico.';
