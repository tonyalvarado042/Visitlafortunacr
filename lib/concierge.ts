import 'server-only';
import { supabase } from '@/lib/supabase';

/*
 * Quién contesta en el chat: cara, nombre y cargo.
 *
 * Vive aparte de `destinoActual()` a propósito. Esa función hace `select('*')`
 * sobre `dst_destino` y la llama TODA página del sitio: meterle un join sería
 * cargarle una tabla más a cada vista, incluidas las que no tienen chat.
 *
 * ⚠️ VA POR `quien_contesta`, NO POR LA TABLA.
 *
 * `dst_agente` tiene RLS cerrada al equipo, y con razón: guarda las
 * instrucciones del negocio. La primera versión de este archivo leía la tabla
 * con el cliente público y **volvía vacía sin un solo error** —RLS no se queja,
 * simplemente no devuelve filas—, así que el chat habría usado el nombre de
 * respaldo para siempre y nadie se habría enterado. La migración 51 expone
 * solo los tres campos públicos por una función `security definer`.
 *
 * ⚠️ Y ESTO NUNCA PUEDE TUMBAR UNA PÁGINA. Si falla, devuelve el respaldo y el
 * chat se abre igual con el avatar de marca. Un chat sin foto sigue sirviendo;
 * una portada en blanco porque no se pudo leer una foto, no.
 */

export type Presentacion = {
  nombre: string;
  /** Lo que es. Se muestra SIEMPRE, y por eso nunca viene vacío. */
  cargo: string;
  foto_url: string | null;
};

/* El respaldo. `cargo` dice lo que es incluso si nadie lo configuró: el día
   que esto quede vacío, el chat no puede quedar sin decirlo. */
const POR_DEFECTO: Presentacion = { nombre: 'Asistente', cargo: 'Asistente virtual', foto_url: null };

type Fila = { nombre: string | null; cargo: string | null; foto_url: string | null };

export async function presentacionDelConcierge(destinoId: string): Promise<Presentacion> {
  try {
    const { data, error } = await supabase.rpc('quien_contesta', { p_destino_id: destinoId });

    if (error) {
      console.error('presentacionDelConcierge:', error.message);
      return POR_DEFECTO;
    }

    /* La función devuelve una tabla: cero filas si el agente está apagado. */
    const fila = (Array.isArray(data) ? data[0] : data) as Fila | undefined | null;
    if (!fila) return POR_DEFECTO;

    const foto = (fila.foto_url ?? '').trim();
    return {
      nombre: (fila.nombre ?? '').trim() || POR_DEFECTO.nombre,
      cargo: (fila.cargo ?? '').trim() || POR_DEFECTO.cargo,
      /* Solo http(s). Una URL rara en la base no puede convertirse en
         `javascript:` dentro de un atributo del navegador. */
      foto_url: /^https?:\/\//i.test(foto) ? foto : null,
    };
  } catch (fallo) {
    console.error('presentacionDelConcierge:', fallo instanceof Error ? fallo.message : fallo);
    return POR_DEFECTO;
  }
}
