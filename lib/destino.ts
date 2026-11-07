import { headers } from 'next/headers';
import { supabase } from './supabase';
import type { Idioma } from './idiomas';

export type Destino = {
  id: string;
  babosa: string;
  nombre: string;
  nombre_largo: string | null;
  dominio: string;
  pais_nombre: string;
  region: string | null;
  marca_nombre: string;
  marca_sigla: string | null;
  lema: string | null;
  idioma_principal: Idioma;
  idiomas: Idioma[];
  moneda_iso: string;
  moneda_visitante: string | null;
  latitud: number | null;
  longitud: number | null;
  zoom_mapa: number;
  color_tinta: string;
  color_acento: string;
  color_naturaleza: string;
  color_gris: string;
  tipografia: string;
  logo_url: string | null;
  /* El ícono de la pestaña. La columna existía desde el principio; el tipo
     se la había saltado, así que el sitio no podía ni verla. */
  favicon_url: string | null;
  video_portada_url: string | null;
  imagen_portada_url: string | null;
  whatsapp: string | null;
  /* El buzon del equipo. Es a donde llegan los avisos de solicitudes de
     reserva: sin esto, una solicitud entra y nadie se entera. */
  email_contacto: string | null;
  /* De donde SALEN los correos (el From). Vacio = se usa el del canal.
     Ojo: esto NO es adonde se responde — ver `remitenteDe` en
     lib/correo/enviar.ts, que las mantiene separadas a proposito. */
  email_noreply: string | null;
  /* INTERNO: adonde le caen los avisos al equipo. Vacio = `email_contacto`.
     ⚠️ Son DOS cosas distintas y no se pueden juntar: `email_contacto` es
     PUBLICO —el concierge se lo dice a los viajeros— y este no se le muestra a
     nadie de afuera. */
  email_avisos: string | null;
  /* El crédito de quien hizo el sitio, en el pie. Por destino y no fijo en el
     código: este lo hizo LIDERAX10, el próximo lo puede hacer otro. */
  pie_credito_texto: string | null;
  pie_credito_url: string | null;
  /* Si la burbuja del concierge sale en el sitio. Por destino: uno puede
     querer chat y el de al lado no. */
  chat_activo: boolean;
  /** 'automatico' | 'manual'. Decide si la IA arma el itinerario sola cuando
   *  cae el lead, y de paso qué promete el titular de la portada.
   *  Ver lib/itinerario-modo.ts, que tiene los dos valores. */
  itinerario_modo: string;
  /* El ID del pixel de Meta. En la fila y no en el codigo: se cambia desde
     Ajustes sin desplegar, y cada destino lleva el suyo. Vacio = no se carga
     nada. */
  pixel_meta: string | null;
  /* El tema del sitio publico y si la barra de arriba se queda oscura
     aunque el resto sea claro. Salen de Ajustes. */
  tema: 'claro' | 'oscuro';
  barra_oscura: boolean;
  /* El titulo del bloque de piezas de la columna del blog. */
  lateral_titulo: string | null;
  /* Si el telefono y el sitio de las fichas salen tapados hasta que el
     visitante deja sus datos. En true el directorio genera leads; en false
     es una guia telefonica. */
  contacto_bloqueado: boolean;
  /* La oferta premium: video + historias + mes destacado. El precio cambia,
     asi que vive en la fila y se edita desde Ajustes, no en el codigo. */
  premium_activo: boolean;
  premium_titulo: string | null;
  premium_gancho: string | null;
  premium_precio_usd: number | null;
  premium_precio_antes: number | null;
  premium_incluye: string[];
  premium_cupos: number | null;
  premium_ejemplo_babosa: string | null;
  /* Que ocupa la columna destacada del mega menu. Se elige en Ajustes
     porque lo que vale la pena empujar cambia cada temporada, y un
     destacado fijo en el codigo envejece sin que nadie lo note. */
  menu_destacado_tipo: 'ninguno' | 'experiencia' | 'negocio';
  menu_destacado_babosa: string | null;
  /* El interruptor maestro del motor de reservas. Apagado, el sitio es el
     directorio de siempre y el modulo no existe para nadie. */
  reservas_activas: boolean;
  /* El candado que protege plata: sin pasarela probada no se le cobra a
     nadie, diga lo que diga el contrato. */
  pasarela_lista: boolean;
  /* El descuento de lanzamiento y su fecha de corte. La fecha viaja al
     navegador para poder mostrar una cuenta regresiva DE VERDAD: una urgencia
     inventada se descubre volviendo al día siguiente, y entonces el sitio
     entero pierde credibilidad, no solo el descuento. */
  descuento_lanzamiento_pct: number | null;
  descuento_lanzamiento_hasta: string | null;
  /* La frase que acompaña al descuento. Vacía = no se muestra: una leyenda es
     una afirmación, y ninguna afirmación se enciende sola. */
  leyenda_precio: string | null;
};

/**
 * Qué destino sirve esta petición. Se resuelve por el Host, que es lo que
 * permite que un solo despliegue atienda visitlafortunacr.com y
 * visitmonteverdecr.com sin ramas ni variables por destino.
 */
export async function destinoActual(): Promise<Destino> {
  const cabeceras = await headers();
  const host = (cabeceras.get('host') ?? '').split(':')[0].replace(/^www\./, '');

  // Solo se acepta si parece un dominio de verdad: al importar el repo, Vercel
  // puede haber tomado un marcador del archivo de ejemplo.
  const desdeEntorno = process.env.NEXT_PUBLIC_DOMINIO_POR_DEFECTO?.trim();
  const porDefecto = desdeEntorno && desdeEntorno.includes('.') && !desdeEntorno.includes('...')
    ? desdeEntorno
    : 'visitlafortunacr.com';

  // En desarrollo y en las URLs de vista previa (*.vercel.app, *.workers.dev) el
  // Host no es un dominio real.
  const esLocal = !host || host === 'localhost' || host.endsWith('.vercel.app') || host.endsWith('.workers.dev');
  const dominio = esLocal ? porDefecto : host;

  const { data, error } = await supabase
    .from('dst_destino')
    .select('*')
    .eq('dominio', dominio)
    .eq('esta_activo', true)
    .maybeSingle();

  if (error) throw new Error(`No se pudo leer el destino ${dominio}: ${error.message}`);
  if (!data) throw new Error(`No hay ningún destino activo para el dominio ${dominio}.`);

  return data as Destino;
}

export type Categoria = {
  categoria_id: string;
  babosa: string;
  nombre: string;
  seccion: string;
  orden: number;
  total: number;
};

/** Las categorías encendidas del destino, en el idioma pedido y con su conteo. */
export async function categoriasDe(destino: Destino, idioma: Idioma): Promise<Categoria[]> {
  const { data, error } = await supabase.rpc('categorias_del_destino', {
    p_destino_id: destino.id,
    p_idioma: idioma,
  });
  if (error) throw new Error(`No se pudieron leer las categorías: ${error.message}`);
  return (data ?? []) as Categoria[];
}

export type Negocio = {
  id: string;
  categoria_id: string;
  categoria_babosa: string;
  categoria_nombre: string;
  seccion: string;
  nombre: string;
  babosa: string;
  resumen: string | null;
  descripcion: string | null;
  logo_url: string | null;
  email: string | null;
  telefono: string | null;
  telefono_whatsapp: string | null;
  sitio_web: string | null;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
  rango_precio: 'economico' | 'moderado' | 'alto' | 'lujo' | null;
  precio_desde_usd: number | null;
  estado_verificacion: 'pendiente' | 'parcial' | 'verificado' | 'reclamado';
  es_destacado: boolean;
  membresia: 'gratis' | 'pro' | 'destacado';
  atributos: Record<string, unknown>;
  total_resenas: number;
  promedio_calificacion: number | null;
  /* La portada, desde la migración 22. `generica` en true significa que la
     foto ilustra la categoría y no retrata a este negocio: la tarjeta la usa
     de fondo y nunca la presenta como una imagen del lugar. */
  foto_portada_url: string | null;
  foto_portada_generica: boolean | null;
  /* Lo devuelve negocios_publicados desde la migracion del premium: la
     tarjeta puede marcar cual tiene video sin pedir la ficha entera. */
  video_url: string | null;
};

/** Los negocios publicados del destino, ya resueltos al idioma pedido. */
export async function negociosDe(destino: Destino, idioma: Idioma): Promise<Negocio[]> {
  const { data, error } = await supabase.rpc('negocios_publicados', {
    p_dominio: destino.dominio,
    p_idioma: idioma,
  });
  if (error) throw new Error(`No se pudieron leer los negocios: ${error.message}`);
  return (data ?? []) as Negocio[];
}

export const SIMBOLO_PRECIO: Record<string, string> = {
  economico: '$',
  moderado: '$$',
  alto: '$$$',
  lujo: '$$$$',
};

export type FichaNegocio = Negocio & {
  como_llegar: string | null;
  /* El video de la ficha: lo que se vende en el plan premium. Puede ser un
     archivo del bucket o un enlace de YouTube/Vimeo; la ficha decide. */
  video_url: string | null;
  video_portada_url: string | null;
};

/** Un negocio por su babosa en cualquier idioma. Devuelve null si no existe. */
export async function negocioPorBabosa(
  destino: Destino,
  babosa: string,
  idioma: Idioma
): Promise<FichaNegocio | null> {
  const { data, error } = await supabase.rpc('negocio_por_babosa', {
    p_dominio: destino.dominio,
    p_babosa: babosa,
    p_idioma: idioma,
  });
  if (error) throw new Error(`No se pudo leer la ficha: ${error.message}`);
  const filas = (data ?? []) as FichaNegocio[];
  return filas[0] ?? null;
}

/**
 * ¿La babosa vieja de una ficha lleva a una nueva?
 *
 * POR QUE EXISTE ESTO: `dst_redireccion` estaba en la base desde siempre, con
 * sus políticas de lectura pública y todo, pero **ningún código la leía**. Se
 * buscó en todo `app/` y `lib/` y no aparecía. O sea: cambiar la babosa de una
 * ficha mataba sus enlaces viejos en silencio. Para un sitio que vive del SEO
 * eso es perder de un día para otro el posicionamiento que costó meses, sin un
 * error en ningún lado que avise.
 *
 * Se consulta SOLO cuando la ficha no apareció, así que no cuesta nada en las
 * visitas normales.
 *
 * Sigue hasta 3 saltos: si A quedó apuntando a B y despues B a C, el que tenía
 * el enlace de A llega a C igual. El tope corta cualquier cadena circular; sin
 * él, dos filas que se apunten entre sí cuelgan la petición para siempre.
 */
export async function babosaNuevaDe(
  destino: Destino,
  babosaVieja: string,
  idioma: Idioma
): Promise<string | null> {
  let actual = babosaVieja;

  for (let salto = 0; salto < 3; salto += 1) {
    const { data, error } = await supabase
      .from('dst_redireccion')
      .select('babosa_nueva')
      .eq('destino_id', destino.id)
      .eq('babosa_vieja', actual)
      .eq('idioma', idioma)
      .maybeSingle();

    /* Un fallo acá NO debe tumbar la página: lo peor que puede pasar es que no
       haya redirección y se muestre el 404 que ya se iba a mostrar. */
    if (error) {
      console.error('babosaNuevaDe:', error.message);
      return null;
    }
    if (!data?.babosa_nueva) return salto === 0 ? null : actual;

    actual = data.babosa_nueva;
  }

  return actual;
}

export type Seccion = { clave: string; orden: number; contenido: string };

/**
 * Los bloques plegables de la ficha, ya resueltos al idioma pedido. El título
 * visible no viene de la base: lo pone `lib/idiomas.ts`, para que salga
 * traducido a los cinco idiomas sin repetir el texto en cada negocio.
 */
export async function seccionesDe(negocioId: string, idioma: Idioma): Promise<Seccion[]> {
  const { data, error } = await supabase.rpc('secciones_de_negocio', {
    p_negocio_id: negocioId,
    p_idioma: idioma,
  });
  if (error) return [];
  return (data ?? []) as Seccion[];
}

export type FotoNegocio = {
  url: string;
  texto_alternativo: string | null;
  credito: string | null;
  licencia: string | null;
  fuente_url: string | null;
  es_generica: boolean;
  es_portada: boolean;
};

/**
 * La galería de una ficha: primero las fotos reales del negocio y al final las
 * genéricas de categoría. Devuelve crédito, licencia y enlace de origen porque
 * CC BY y CC BY-SA exigen mostrarlos junto a la imagen, no en una página
 * aparte.
 */
export async function fotosDe(negocioId: string, idioma: Idioma): Promise<FotoNegocio[]> {
  const { data, error } = await supabase.rpc('fotos_de_negocio', {
    p_negocio_id: negocioId,
    p_idioma: idioma,
  });
  if (error) return [];
  return (data ?? []) as FotoNegocio[];
}

export type Horario = { dia_semana: number; abre_a: string | null; cierra_a: string | null; esta_cerrado: boolean };

/** El horario de atención, ordenado de lunes a domingo y no de domingo a sábado. */
export async function horarioDe(negocioId: string): Promise<Horario[]> {
  const { data, error } = await supabase
    .from('dst_negocio_horario')
    .select('dia_semana, abre_a, cierra_a, esta_cerrado')
    .eq('negocio_id', negocioId);
  if (error) return [];
  // dia_semana 0 es domingo en la base; aquí se muestra al final de la semana.
  return ((data ?? []) as Horario[]).sort(
    (a, b) => ((a.dia_semana + 6) % 7) - ((b.dia_semana + 6) % 7)
  );
}

export type EtiquetaNegocio = { babosa: string; grupo: string; nombre: string };

/** Servicios, ambiente, accesibilidad, público y formas de pago del negocio. */
export async function etiquetasDe(negocioId: string, idioma: Idioma): Promise<EtiquetaNegocio[]> {
  const { data, error } = await supabase
    .from('dst_negocio_etiqueta')
    .select('etiqueta:dst_etiqueta(id, babosa, grupo, nombre)')
    .eq('negocio_id', negocioId);
  if (error || !data) return [];

  const etiquetas = data
    .map((f) => (Array.isArray(f.etiqueta) ? f.etiqueta[0] : f.etiqueta))
    .filter(Boolean) as { id: string; babosa: string; grupo: string; nombre: string }[];
  if (!etiquetas.length || idioma === 'es') {
    return etiquetas.map(({ babosa, grupo, nombre }) => ({ babosa, grupo, nombre }));
  }

  // El nombre del catálogo está en español; los demás idiomas en dst_traduccion.
  const { data: trad } = await supabase
    .from('dst_traduccion')
    .select('entidad_id, texto')
    .eq('entidad', 'etiqueta')
    .eq('campo', 'nombre')
    .eq('idioma', idioma)
    .in('entidad_id', etiquetas.map((e) => e.id));

  const porId = Object.fromEntries((trad ?? []).map((t) => [t.entidad_id, t.texto]));
  return etiquetas.map((e) => ({ babosa: e.babosa, grupo: e.grupo, nombre: porId[e.id] ?? e.nombre }));
}

export type ExtractoExterno = {
  autor_nombre: string;
  autor_url: string | null;
  autor_avatar_url: string | null;
  calificacion: number | null;
  texto: string;
  publicada_en: string | null;
  url_original: string;
  /* Si sube a las tres que se muestran en la ficha. Es un ORDEN, no un filtro:
     la nota y el conteo publicados siguen siendo los reales. */
  destacado: boolean;
};

export type NotaExterna = {
  plataforma: string;
  calificacion: number | null;
  total_resenas: number | null;
  url_fuente: string;
  extractos: ExtractoExterno[];
};

/**
 * Lo que dicen en otras plataformas: la nota, el conteo y —cuando la fuente da
 * licencia para mostrarlo— las reseñas con texto, cada una con su autor y su
 * enlace al original.
 *
 * Solo las vigentes. El vencimiento no es cosmético: Google no permite guardar
 * su contenido de forma indefinida, así que una fila vencida deja de verse
 * aunque nadie la borre. Los extractos cuelgan de la fila, de modo que vencen
 * con ella.
 */
export async function notasExternasDe(negocioId: string): Promise<NotaExterna[]> {
  const { data, error } = await supabase
    .from('dst_resena_externa')
    .select(`plataforma, calificacion, total_resenas, url_fuente,
             extractos:dst_resena_externa_extracto(autor_nombre, autor_url, autor_avatar_url, calificacion, texto, publicada_en, url_original, destacado)`)
    .eq('negocio_id', negocioId)
    .gt('expira_en', new Date().toISOString());
  if (error) return [];
  return (data ?? []).map((fila) => ({
    ...fila,
    extractos: (fila.extractos ?? []) as ExtractoExterno[],
  })) as NotaExterna[];
}

export type CuposPremium = { cupos: number | null; tomados: number; quedan: number };

/**
 * Cuántos cupos quedan al precio de lanzamiento.
 *
 * El número sale de contar los negocios que ya no son gratis, no de un texto
 * que alguien se olvida de bajar. Una escasez inventada se nota, y cuesta
 * más confianza de la que gana.
 */
export async function cuposPremium(destino: Destino): Promise<CuposPremium> {
  const { data, error } = await supabase.rpc('cupos_premium', { p_dominio: destino.dominio });
  if (error) {
    console.error('cupos_premium:', error.message);
    return { cupos: destino.premium_cupos, tomados: 0, quedan: destino.premium_cupos ?? 0 };
  }
  const fila = ((data ?? []) as CuposPremium[])[0];
  return fila ?? { cupos: destino.premium_cupos, tomados: 0, quedan: destino.premium_cupos ?? 0 };
}

export type Destacado = {
  id: string;
  nombre: string;
  babosa: string;
  categoria_babosa: string;
  categoria_nombre: string;
  resumen: string | null;
  foto_portada_url: string | null;
  membresia: string;
  video_url: string | null;
  total_resenas: number;
};

/**
 * Los destacados para la fila de la portada.
 *
 * Es lo que se compra con el plan premium y tiene que notarse: si "destacado"
 * no se ve distinto en ninguna pantalla, el plan no vende.
 */
export async function destacadosDe(destino: Destino, idioma: Idioma, limite = 10): Promise<Destacado[]> {
  const { data, error } = await supabase.rpc('negocios_destacados', {
    p_dominio: destino.dominio,
    p_idioma: idioma,
    p_limite: limite,
  });
  if (error) {
    console.error('negocios_destacados:', error.message);
    return [];
  }
  return (data ?? []) as Destacado[];
}

export type DestacadoMenu = {
  tipo: string;
  babosa: string;
  titulo: string;
  bajada: string | null;
  imagen_url: string | null;
  ruta: string;
};

/**
 * El destacado del mega menú, ya resuelto al idioma de la página.
 *
 * Lo elige Tony en Ajustes: experiencia o negocio, por babosa. Si lo
 * apuntado no existe o se despublicó, la consulta vuelve vacía y la
 * columna simplemente no se pinta — vale más un menú de cuatro columnas
 * que un enlace roto en TODAS las páginas del sitio.
 *
 * Va en una sola consulta porque la barra se pinta en cada carga: dos
 * viajes a Supabase por página para una tarjeta es caro.
 */
export async function destacadoDelMenu(
  destino: Destino, idioma: Idioma,
): Promise<DestacadoMenu | null> {
  if (destino.menu_destacado_tipo === 'ninguno' || !destino.menu_destacado_babosa) return null;

  const { data, error } = await supabase.rpc('destacado_del_menu', {
    p_dominio: destino.dominio,
    p_idioma: idioma,
  });
  if (error) {
    console.error('destacado_del_menu:', error.message);
    return null;
  }
  return ((data ?? []) as DestacadoMenu[])[0] ?? null;
}

export type TourDeNegocio = {
  id: string;
  babosa: string;
  nombre: string;
  resumen: string | null;
  duracion_horas: number | null;
  hora_inicio: string | null;
  dificultad: string | null;
  precio_adulto_usd: number;
  recoge_en_hotel: boolean;
  imagen_url: string | null;
  /* El video del tour. Hasta noviembre de 2026 solo los negocios tenian uno:
     un operador con video de su tour no tenia donde ponerlo. */
  video_url: string | null;
  video_portada_url: string | null;
};

/*
 * Las tours que opera este negocio.
 *
 * Un operador tiene varias: la relación vive en `dst_tour.negocio_id`. Solo
 * salen las publicadas, y de eso se encarga la RLS de la tabla —no un filtro
 * de acá—, así que una tour en borrador no se escapa ni por descuido.
 *
 * Si falla, devuelve vacío y la ficha sigue: una tour que no carga no puede
 * tumbar la página del negocio.
 */
export async function toursDe(negocioId: string): Promise<TourDeNegocio[]> {
  const { data, error } = await supabase
    .from('dst_tour')
    .select('id, babosa, nombre, resumen, duracion_horas, hora_inicio, dificultad, precio_adulto_usd, recoge_en_hotel, imagen_url')
    .eq('negocio_id', negocioId)
    .eq('estado', 'publicado')
    .order('es_destacado', { ascending: false })
    .order('precio_adulto_usd');
  if (error) return [];
  return (data ?? []) as TourDeNegocio[];
}

export type TourPublico = TourDeNegocio & {
  descripcion: string | null;
  incluye: string | null;
  no_incluye: string | null;
  que_llevar: string | null;
  edad_minima: number | null;
  cupo_maximo: number | null;
  idiomas_guia: string[];
  cancelacion_libre_horas: number;
  precio_nino_usd: number | null;
  precio_nota: string | null;
  categoria_id: string | null;
  /* Los mantiene el disparador de `dst_resena`. Cuentan SOLO las reseñas de
     esta tour, no las del negocio: la nota de un operador con diez tours no
     dice nada de la que uno está mirando. */
  total_resenas: number;
  promedio_calificacion: number | null;
  /* El operador, por id. El objeto `negocio` de abajo trae lo que se PINTA
     (nombre, babosa); esto es lo que hace falta para ESCRIBIR: toda reseña
     lleva negocio_id, también las de una tour. */
  negocio_id: string;
  /* La galeria. `imagen_url` sigue existiendo como respaldo: la foto vieja se
     copio a la galeria como portada, asi que lo normal es que `fotos[0]` sea
     la misma. */
  fotos: FotoDeTour[];
  /* `es_operador`: vende tours pero no tiene ficha. Su nombre sale como TEXTO,
     nunca como enlace — la pagina no existe y el enlace daria 404. */
  negocio: {
    nombre: string; babosa: string; categoria_babosa: string | null; es_operador: boolean;
  } | null;
};

/*
 * Una tour por su babosa, para su página pública.
 *
 * Solo publicadas: lo decide la RLS de la tabla, no un filtro de acá. Y trae
 * el operador porque una tour sin saber quién la lleva no se puede vender —
 * ni reservar, ni reclamar.
 */
export type FotoDeTour = {
  id: string;
  url: string;
  texto_alternativo_es: string | null;
  texto_alternativo_en: string | null;
  credito: string | null;
  licencia: string | null;
  fuente_url: string | null;
  es_portada: boolean;
  orden: number;
};

/*
 * Los campos de una tour que se traducen.
 *
 * ⚠️ Tiene que coincidir con la lista blanca de
 * `destinos.guardar_traducciones_de_mi_tour`, que es la que decide qué puede
 * escribir el operador. Si acá sobrara uno, se leería una traducción que
 * nadie puede escribir; si allá sobrara, el operador escribiría algo que la
 * ficha nunca muestra — trabajo suyo tirado a la basura, y en silencio.
 *
 * `precio_nota` NO está, y es a propósito: ese campo lo pone el equipo desde
 * el panel, no el operador. Se traduce desde `/admin`, como el de un negocio.
 */
const CAMPOS_TRADUCIBLES_DE_TOUR = [
  'nombre', 'resumen', 'descripcion', 'incluye', 'no_incluye', 'que_llevar',
] as const;

export async function tourPorBabosa(
  destino: Destino, babosa: string, idioma?: Idioma,
): Promise<TourPublico | null> {
  const { data, error } = await supabase
    .from('dst_tour')
    .select(`id, categoria_id, negocio_id, babosa, nombre, resumen, descripcion, incluye, no_incluye, que_llevar,
             duracion_horas, hora_inicio, dificultad, edad_minima, cupo_maximo,
             idiomas_guia, recoge_en_hotel, cancelacion_libre_horas,
             precio_adulto_usd, precio_nino_usd, precio_nota, imagen_url, video_url, video_portada_url,
             total_resenas, promedio_calificacion,
             fotos:dst_tour_foto(id, url, texto_alternativo_es, texto_alternativo_en, credito, licencia, fuente_url, es_portada, orden),
             negocio:dst_negocio(nombre, babosa, es_operador, categoria:dst_categoria(babosa))`)
    .eq('destino_id', destino.id)
    .eq('babosa', babosa)
    .eq('estado', 'publicado')
    .maybeSingle();
  /* El motivo al registro. Devolver null a secas convierte CUALQUIER fallo
     —una columna mal escrita, una tabla que PostgREST todavía no conoce— en
     un 404 idéntico al de una tour que no existe, y buscar la diferencia a
     ciegas cuesta una tarde. */
  if (error) {
    console.error('tourPorBabosa:', babosa, error.message);
    return null;
  }
  if (!data) return null;

  const uno = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);
  const n = uno(data.negocio as never) as { nombre: string; babosa: string; es_operador: boolean; categoria: unknown } | null;
  const cat = n ? uno(n.categoria as never) as { babosa: string } | null : null;

  /* La galeria, ordenada con la PORTADA primero y el resto por su `orden`.
     Postgres no garantiza el orden de una relacion anidada, asi que si no se
     ordena aca la cabecera de la ficha podria mostrar cualquiera. */
  const fotos = ((data.fotos ?? []) as FotoDeTour[])
    .slice()
    .sort((a, b) => (Number(b.es_portada) - Number(a.es_portada)) || (a.orden - b.orden));

  const tour: TourPublico = {
    ...(data as unknown as TourPublico),
    fotos,
    negocio: n
      ? { nombre: n.nombre, babosa: n.babosa, categoria_babosa: cat?.babosa ?? null, es_operador: Boolean(n.es_operador) }
      : null,
  };

  /* En el idioma principal no se consulta nada: es el texto de la fila, y la
     mayoría del tráfico pasa por acá. Una consulta de más en cada visita para
     no encontrar nunca nada sería pagar el caso raro en el caso común. */
  if (!idioma || idioma === destino.idioma_principal) return tour;

  const { data: traducciones, error: falloLaTraduccion } = await supabase
    .from('dst_traduccion')
    .select('campo, texto')
    .eq('entidad', 'tour')
    .eq('entidad_id', tour.id)
    .eq('idioma', idioma)
    .in('campo', CAMPOS_TRADUCIBLES_DE_TOUR as unknown as string[]);

  /* Si la consulta falla, la ficha sale en español y NO se cae. Media ficha
     traducida es mejor que media ficha vacía — la misma regla que `lemaDe`.
     Pero se grita al registro: una tour que de pronto deja de verse traducida
     no se nota mirándola, porque el español se lee igual de bien. */
  if (falloLaTraduccion) {
    console.error('tourPorBabosa: no se pudieron leer las traducciones de', babosa,
      falloLaTraduccion.message);
    return tour;
  }

  for (const { campo, texto } of (traducciones ?? []) as { campo: string; texto: string }[]) {
    const limpio = (texto ?? '').trim();
    if (limpio) (tour as unknown as Record<string, unknown>)[campo] = limpio;
  }
  return tour;
}

export type RazonDeNegocio = {
  id: string;
  titulo: string;
  texto: string | null;
  foto_url: string | null;
};

/*
 * Las razones para elegir este negocio y no otro.
 *
 * Tres frases con foto que responden la única pregunta que importa cuando
 * alguien compara: por qué esta. Si el negocio no tiene ninguna escrita, se
 * devuelve vacío y el bloque no sale — mejor eso que una razón genérica, que
 * no convence a nadie y ensucia a los negocios que sí escribieron las suyas.
 *
 * Va por función de la base y no por consulta directa para que pase por
 * `texto_en()`: así se muestran en el idioma de quien mira, y `dst_traduccion`
 * no tiene que estar abierta al sitio público. Si falta la traducción, sale el
 * texto original — media ficha traducida es mejor que media ficha vacía.
 *
 * El corte en tres lo hace la función, no este archivo: el límite es del
 * diseño de la ficha y vive donde se consulta.
 */
export async function razonesDe(negocioId: string, idioma: Idioma): Promise<RazonDeNegocio[]> {
  const { data, error } = await supabase.rpc('razones_de_negocio', {
    p_negocio_id: negocioId,
    p_idioma: idioma,
  });
  if (error) return [];
  return (data ?? []) as RazonDeNegocio[];
}

export type NegocioCombina = {
  id: string;
  motivo: string | null;
  nombre: string;
  babosa: string;
  categoria_babosa: string | null;
  categoria_nombre: string | null;
  foto_url: string | null;
  /* Si la puso el equipo o la rellenó la base. En la ficha no se distingue
     —ambas son sugerencias nuestras y ninguna afirma nada falso—; en el panel
     sí, para saber a cuáles les falta mano. */
  es_automatica: boolean;
};

/*
 * Con qué se combina este negocio.
 *
 * Lo elige el equipo a mano: calcularlo por categoría recomendaría al
 * competidor de al lado, que es justo lo contrario de lo que el negocio espera
 * de nosotros.
 *
 * La función exige que LOS DOS estén publicados, así que una recomendación a
 * una ficha archivada no llega hasta acá — nadie termina en un 404 por una
 * sugerencia nuestra. Y pasa por `texto_en()`, para que el "por qué va junto"
 * salga en el idioma de quien mira.
 *
 * Si el negocio no tiene ninguna a mano, la base rellena con tres de OTRAS
 * categorías —nunca del mismo rubro, que sería pagarle la publicidad al
 * competidor— y una sola por categoría, para que cubran el día en vez de
 * competir entre ellas. Lo manual, cuando existe, le gana al relleno.
 */
export async function combinaCon(negocioId: string, idioma: Idioma): Promise<NegocioCombina[]> {
  const { data, error } = await supabase.rpc('combina_de_negocio', {
    p_negocio_id: negocioId,
    p_idioma: idioma,
  });
  if (error) return [];
  return (data ?? []) as NegocioCombina[];
}

/**
 * El lema del destino, en el idioma de quien mira.
 *
 * EL BICHO QUE ARREGLA: el lema se leía de `dst_destino.lema` a secas, que
 * está en el idioma principal. O sea **la portada en inglés mostraba el lema
 * en español**, y la etiqueta `<meta description>` de TODAS las páginas del
 * sitio también — que es el renglón que sale debajo del título en Google. Lo
 * peor es que la traducción al inglés estaba guardada en `dst_traduccion`
 * desde siempre: existía y nadie la leía.
 *
 * Es la línea más visible del sitio y la primera que ve un extranjero. Y el
 * inglés es justo la versión que sí está traducida (64 de 65 fichas).
 *
 * Si falta la traducción, cae al lema base. Un lema en español se entiende a
 * medias; ninguno deja la página sin descripción en Google.
 */
export async function lemaDe(destino: Destino, idioma: Idioma): Promise<string | null> {
  if (idioma === destino.idioma_principal) return destino.lema;

  const { data } = await supabase
    .from('dst_traduccion')
    .select('texto')
    .eq('entidad', 'destino')
    .eq('entidad_id', destino.id)
    .eq('campo', 'lema')
    .eq('idioma', idioma)
    .maybeSingle();

  return (data?.texto as string | undefined)?.trim() || destino.lema;
}


/**
 * El id de una categoría a partir de una babosa EN CUALQUIER IDIOMA.
 *
 * Para qué: `/en/tours-aventura` daba 404 — es la babosa española sobre el
 * sitio inglés, donde la categoría se llama `adventure-tours`. El selector de
 * idiomas estuvo armando esas direcciones, así que andan sueltas: compartidas,
 * guardadas y puede que rastreadas. Con esto la página las redirige a la
 * babosa correcta en vez de darles un 404.
 *
 * Devuelve null si no es babosa de ninguna categoría en ningún idioma, que es
 * cuando el 404 sí corresponde.
 */
export async function categoriaEnCualquierIdioma(
  destino: Destino,
  babosa: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('dst_ruta')
    .select('entidad_id')
    .eq('destino_id', destino.id)
    .eq('entidad', 'categoria')
    .eq('babosa', babosa)
    .eq('es_vigente', true)
    .limit(1)
    .maybeSingle();
  return (data?.entidad_id as string | undefined) ?? null;
}

/*
 * El itinerario de una tour: sus paradas, en orden y traducidas.
 *
 * ⚠️ Va por función de la base y no por consulta directa, y no es capricho:
 * `paradas_de_tour` traduce con `texto_en`, el mismo helper que usan
 * `negocio_por_babosa` y `tour_reservable`. Leyendo la tabla directo, cada
 * parada saldría en el idioma en que la escribió el operador — que es
 * exactamente lo que Tony señaló el 7 de noviembre de 2026 mirando una ficha
 * en `/es` con el título en inglés.
 */
export type ParadaDeTour = {
  id: string;
  orden: number;
  tipo: 'salida' | 'parada' | 'paso' | 'regreso';
  titulo: string;
  descripcion: string | null;
  duracion_minutos: number | null;
  entrada_incluida: boolean | null;
  /* La ficha del directorio, si la parada apunta a una y sigue publicada. */
  negocio_babosa: string | null;
  negocio_categoria: string | null;
  negocio_foto: string | null;
};

export async function paradasDeTour(tourId: string, idioma: Idioma): Promise<ParadaDeTour[]> {
  const { data, error } = await supabase.rpc('paradas_de_tour', {
    p_tour_id: tourId, p_idioma: idioma,
  });
  if (error) {
    /* Una tour sin itinerario no es un error —la mayoría todavía no lo tiene—
       pero que la consulta FALLE sí: la ficha se vería igual de bien, sin el
       bloque, y nadie lo notaría. Por eso queda en el registro. */
    console.error('paradasDeTour:', tourId, error.message);
    return [];
  }
  return (data ?? []) as ParadaDeTour[];
}
