import 'server-only';
import { servicio } from '@/lib/supabase-servidor';
import { rellenarPlantilla } from '@/lib/plantillas';
import { rutaDe, type EnElDirectorio } from '@/lib/directorio';
import type { Idioma } from '@/lib/idiomas';

/*
 * Los correos de un clic para contestarle a un lead.
 *
 * ⚠️ UNA SOLA FUNCIÓN ARMA EL CORREO, Y LA USAN LOS DOS LADOS.
 *
 * La pantalla muestra el texto y el botón lo manda. Si fueran dos funciones,
 * lo que Tony lee en la pantalla no sería lo que le llega al viajero —y la
 * regla del cerebro es justamente esa: «el correo se ve en pantalla ANTES de
 * armarlo». Una sola función la cumple de verdad; dos la cumplen de mentira.
 *
 * Por eso `correosDeUnClic` devuelve el asunto y el cuerpo YA RELLENADOS, y
 * `mandarCorreoRapido` vuelve a llamarla en vez de recibir el texto del
 * navegador. Recibirlo del navegador sería más fácil y además dejaría que
 * cualquiera mandara cualquier cosa por ese botón.
 *
 * ⚠️ Y SI UN CORREO NO SE PUEDE MANDAR, NO SE OFRECE EL BOTÓN: se explica por
 * qué no está. Un botón que se aprieta y rebota cuesta más que uno ausente.
 */

/** Lo que la pantalla necesita para pintar un correo y su botón. */
export type CorreoDeUnClic = {
  clave: string;
  /** El nombre del botón, en español, para Tony. */
  titulo: string;
  /** Cuándo usarlo. Una línea. */
  cuando: string;
  asunto: string;
  cuerpo: string;
  /** Si no se puede mandar, por qué. La pantalla lo dice en vez del botón. */
  porQueNo: string | null;
};

export type CorreosDeUnLead = {
  /** A quién le llegaría, tal cual, para que se vea antes de apretar. */
  para: string | null;
  nombre: string | null;
  idioma: string;
  /** Lo que impide mandar CUALQUIERA de ellos (sin correo, por ejemplo). */
  problema: string | null;
  /** Avisos que no impiden mandar pero hay que ver antes. */
  avisos: string[];
  correos: CorreoDeUnClic[];
};

/* El orden en que salen en la pantalla, y qué es cada uno. Los textos viven
   en `dst_plantilla_mensaje` (migración 49), no acá: así se cambian sin
   desplegar, desde IA → Plantillas. */
const CATALOGO: { clave: string; titulo: string; cuando: string; necesitaFicha?: boolean }[] = [
  { clave: 'respuesta_tour', titulo: 'Responderle sobre el tour', cuando: 'La primera respuesta a quien preguntó por algo concreto.', necesitaFicha: true },
  { clave: 'seguimiento_1', titulo: 'Seguimiento', cuando: 'A los pocos días, si no contestó.' },
  { clave: 'seguimiento_2', titulo: 'Último intento', cuando: 'La segunda y última insistencia.' },
  { clave: 'cierre_suave', titulo: 'Cerrar sin portazo', cuando: 'Cuando ya no contestó, dejando la puerta abierta.' },
];

type Fila = { clave: string; idioma: string; asunto: string | null; cuerpo: string };

/**
 * Arma los correos de un clic para una solicitud.
 *
 * No manda nada. Solo deja listo lo que se vería y lo que saldría.
 */
export async function correosDeUnClic(solicitudId: string): Promise<CorreosDeUnLead | null> {
  const db = servicio();

  const { data: s } = await db
    .from('dst_solicitud')
    .select(`
      id, destino_id, tipo, negocio_id, tour_id, itinerario_id,
      viajero:dst_viajero(id, nombre, email, whatsapp, idioma, llega_el, no_molestar, baja)
    `)
    .eq('id', solicitudId)
    .maybeSingle();
  if (!s) return null;

  const v = (Array.isArray(s.viajero) ? s.viajero[0] : s.viajero) as {
    id: string; nombre: string | null; email: string | null; whatsapp: string | null;
    idioma: string | null; llega_el: string | null; no_molestar: boolean; baja: boolean;
  } | null | undefined;

  const { data: d } = await db
    .from('dst_destino')
    .select('id, nombre, marca_nombre, dominio, whatsapp, idioma_principal, idiomas')
    .eq('id', s.destino_id)
    .maybeSingle();

  /* El idioma del viajero manda; si no lo tiene, el del destino; y si esa
     plantilla no existe, se cae a español, que es la que siempre está. */
  const idiomasDelDestino: string[] = (d?.idiomas as string[] | null) ?? ['es'];
  const idioma = [v?.idioma, d?.idioma_principal, 'es']
    .find((i): i is string => !!i && idiomasDelDestino.includes(i)) ?? 'es';

  /* ── La ficha por la que preguntó, si preguntó por alguna ──────────────── */
  let fichaNombre = '';
  let fichaEnlace = '';
  if (s.tour_id) {
    const { data: t } = await db.from('dst_tour').select('nombre, babosa, estado').eq('id', s.tour_id).maybeSingle();
    if (t) {
      fichaNombre = t.nombre as string;
      /* Igual que con el negocio: si no esta publicado, el enlace da 404.
         ⚠️ En `dst_tour` la columna se llama `estado`, NO `estado_publicacion`
         como en `dst_negocio` — aunque las dos usan el MISMO enum. Pedir la
         columna equivocada hacia fallar la consulta entera y la tarjeta no
         habria funcionado nunca para un tour. */
      fichaEnlace = t.estado === 'publicado'
        ? enlacePublico(d?.dominio, { tipo: 'tour', babosa: t.babosa as string, categoria_babosa: null }, idioma)
        : '';
    }
  } else if (s.negocio_id) {
    const { data: n } = await db
      .from('dst_negocio')
      .select('nombre, babosa, estado_publicacion, categoria:dst_categoria(babosa)')
      .eq('id', s.negocio_id).maybeSingle();
    if (n) {
      const cat = (Array.isArray(n.categoria) ? n.categoria[0] : n.categoria) as { babosa: string } | null;
      fichaNombre = n.nombre as string;
      /* ⚠️ EL ENLACE SOLO SI DE VERDAD ABRE.
         La direccion de un negocio es /idioma/categoria/babosa. Sin categoria
         quedaba «/es/null/paradise»; y si la ficha esta archivada, el enlace
         da 404. Mandarle a un viajero un enlace roto es peor que no mandarle
         ninguno: el nombre del negocio sigue en el texto igual. */
      fichaEnlace = cat?.babosa && n.estado_publicacion === 'publicado'
        ? enlacePublico(d?.dominio, { tipo: 'negocio', babosa: n.babosa as string, categoria_babosa: cat.babosa }, idioma)
        : '';
    }
  }

  /* ── El plan, si ya tiene uno ──────────────────────────────────────────── */
  let enlacePlan = '';
  if (s.itinerario_id) {
    const { data: p } = await db.from('dst_itinerario').select('babosa, idioma').eq('id', s.itinerario_id).maybeSingle();
    if (p?.babosa && d?.dominio) enlacePlan = `https://${d.dominio}/${p.idioma ?? idioma}/plan/${p.babosa}`;
  }

  const variables = {
    nombre: v?.nombre ?? '',
    destino: d?.nombre ?? '',
    marca: d?.marca_nombre ?? '',
    llega_el: v?.llega_el ?? '',
    whatsapp_destino: d?.whatsapp ?? '',
    negocio: fichaNombre,
    enlace_negocio: fichaEnlace,
    enlace_itinerario: enlacePlan,
  };

  const { data: filas } = await db
    .from('dst_plantilla_mensaje')
    .select('clave, idioma, asunto, cuerpo')
    .eq('destino_id', s.destino_id)
    .eq('canal', 'email')
    .eq('esta_activa', true)
    .in('clave', CATALOGO.map((c) => c.clave));

  const porClave = new Map<string, Fila>();
  for (const f of (filas ?? []) as Fila[]) {
    /* El idioma que toca gana; el español es el respaldo y no pisa al que ya
       quedó puesto. */
    if (f.idioma === idioma) porClave.set(f.clave, f);
    else if (f.idioma === 'es' && !porClave.has(f.clave)) porClave.set(f.clave, f);
  }

  const correos: CorreoDeUnClic[] = [];
  for (const c of CATALOGO) {
    const f = porClave.get(c.clave);
    if (!f) continue; /* La plantilla no existe: no hay nada que ofrecer. */
    correos.push({
      clave: c.clave,
      titulo: c.titulo,
      cuando: c.cuando,
      asunto: rellenarPlantilla(f.asunto ?? '', variables),
      cuerpo: rellenarPlantilla(f.cuerpo, variables),
      /* ⚠️ Se dice ANTES de apretar, no después de que rebote. Sin ficha, la
         respuesta «sobre el tour» diría «Gracias por escribirnos sobre.» */
      porQueNo: c.necesitaFicha && !fichaNombre
        ? 'Esta consulta no trae un tour ni un negocio, así que este correo no tendría de qué hablar. Usá el de abajo o escribile a mano.'
        : null,
    });
  }

  const avisos: string[] = [];
  if (v?.baja) avisos.push('Este viajero se dio de baja de los correos automáticos. Una respuesta a mano sí le llega, pero sabelo.');
  if (v?.no_molestar) avisos.push('Este viajero pidió que no le escriban.');

  return {
    para: v?.email ?? null,
    nombre: v?.nombre ?? null,
    idioma,
    problema: !v
      ? 'Esta solicitud no tiene viajero, así que no hay a quién escribirle.'
      : !v.email
        ? 'Este viajero no tiene correo cargado. Ponele uno en la ficha y vuelve a aparecer el botón.'
        : null,
    avisos,
    correos,
  };
}

/** `rutaDe` decide la forma de la dirección; acá solo se le pone el dominio. */
function enlacePublico(
  dominio: string | null | undefined,
  ficha: { tipo: 'negocio' | 'tour'; babosa: string; categoria_babosa: string | null },
  idioma: string,
): string {
  if (!dominio || !ficha.babosa) return '';
  /* `rutaDe` solo lee `tipo`, `babosa` y `categoria_babosa`. Se le pasa eso y
     nada más, para no tener dos reglas de cómo se arma una dirección. */
  return `https://${dominio}${rutaDe(ficha as unknown as EnElDirectorio, idioma as Idioma)}`;
}
