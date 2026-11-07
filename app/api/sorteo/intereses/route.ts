import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { dominioDeHost } from '@/lib/dominio';
import { soloInteresesValidos } from '@/lib/intereses';

/**
 * Los intereses de quien acaba de apuntarse al sorteo.
 *
 * ⚠️ POR QUÉ ES UNA SEGUNDA LLAMADA Y NO UN CAMPO MÁS EN EL FORMULARIO.
 *
 * `componentes/FormularioSorteo.tsx` trae escrita esta advertencia desde que
 * se construyó:
 *
 *   «Tres campos y ni uno mas. Cada campo que se agrega cuesta participantes.»
 *
 * Y es cierto. Así que la pregunta de intereses va DESPUÉS de que la persona
 * ya quedó adentro, en la pantalla de «¡Ya estás adentro!». Con eso:
 *
 *   - no cuesta ni un participante: la conversión ya está en el banco cuando
 *     se pregunta;
 *   - si esta ruta falla, o la persona cierra sin contestar, no se pierde
 *     nada — el sorteo ya la tiene;
 *   - contesta más gente, porque ya no hay un botón de enviar que la asuste.
 *
 * El problema que resuelve: de 11 viajeros, 6 entraron por el sorteo y los 6
 * tienen `intereses` vacío. Sin interés no hay segmento, y sin segmento el
 * boletín le manda lo mismo a todo el mundo.
 *
 * Igual que `/api/sorteo`: no hace INSERT. El sitio público no tiene permiso
 * de escritura sobre ninguna tabla, y lo único que esta ruta puede hacer es
 * llamar a `etiquetar_participante_del_sorteo`, que solo toca a quien ya es
 * participante del sorteo abierto y solo pone etiquetas del grupo `interes`.
 */
export const runtime = 'nodejs';

export async function POST(peticion: NextRequest) {
  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }

  const email = (typeof cuerpo.email === 'string' ? cuerpo.email : '').trim().toLowerCase();
  const babosas = soloInteresesValidos(cuerpo.intereses);

  /* Nada que hacer no es un error: la persona pudo no marcar nada, y eso es
     una respuesta válida. Se contesta 200 con cero para que la pantalla no
     tenga que distinguir «no marcó» de «falló». */
  if (!email || !babosas.length) return NextResponse.json({ ok: true, puestas: 0 });

  const { data, error } = await supabase.rpc('etiquetar_participante_del_sorteo', {
    p_dominio: dominioDeHost(peticion.headers.get('host')),
    p_email:   email,
    p_babosas: babosas,
  });

  if (error) {
    /* No se le dice nada al visitante: ya está adentro del sorteo y esto era
       un extra. Pero NO se calla — si esto empieza a fallar, el boletín se
       queda sin segmentos y el síntoma sería «nadie tiene intereses», que es
       justo el problema que vinimos a arreglar. */
    console.error('etiquetar_participante_del_sorteo falló:', error.message);
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  return NextResponse.json({ ok: true, puestas: typeof data === 'number' ? data : 0 });
}
