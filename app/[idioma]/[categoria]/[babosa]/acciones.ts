'use server';

import { after } from 'next/server';
import { supabase } from '@/lib/supabase';
import { servicio } from '@/lib/supabase-servidor';
import { destinoActual } from '@/lib/destino';
import { correoPidieronTusDatos } from '@/lib/correo/cartas';
import { esIdioma, type Idioma } from '@/lib/idiomas';
import type { ContactoReal } from '@/lib/contacto-tapado';

export type EstadoContacto = {
  error?: string | null;
  contacto?: ContactoReal | null;
};

/**
 * Desbloquear el contacto de un negocio.
 *
 * El teléfono completo NO está en la página: llega solo acá, después de que
 * la persona dijo quién es. Si estuviera en el HTML con una nube encima, el
 * muro sería un adorno que se salta con ver-código.
 *
 * Lo que pasa de una: se crea o se reusa el viajero, queda la solicitud con
 * negocio_id —o sea, entra al mismo embudo que todo lo demás— y al negocio le
 * sale un correo avisándole que alguien preguntó por él.
 */
export async function verContacto(_previo: EstadoContacto, datos: FormData): Promise<EstadoContacto> {
  const negocioId = String(datos.get('negocio_id') ?? '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(negocioId)) return { error: 'Falta el negocio.' };

  const nombre = String(datos.get('nombre') ?? '').trim();
  const email = String(datos.get('email') ?? '').trim().toLowerCase();
  const whatsapp = String(datos.get('whatsapp') ?? '').trim();
  const crudo = String(datos.get('idioma') ?? 'es');
  const idioma: Idioma = esIdioma(crudo) ? crudo : 'es';

  if (!email && !whatsapp) {
    return { error: 'Dejanos un correo o un WhatsApp para poder contestarte.' };
  }

  const destino = await destinoActual();

  const { data, error } = await supabase.rpc('pedir_contacto_de_negocio', {
    p_dominio: destino.dominio,
    p_negocio: negocioId,
    p_nombre: nombre || null,
    p_email: email || null,
    p_whatsapp: whatsapp || null,
    p_idioma: idioma,
    p_origen: 'ficha',
  });

  if (error) {
    console.error('pedir_contacto_de_negocio:', error.message);
    /* Los mensajes de la función están escritos para la persona, así que se
       pasan tal cual; cualquier otra cosa, un texto genérico. */
    const suyo = /correo|WhatsApp|disponible|se ve bien/i.test(error.message);
    return { error: suyo ? error.message : 'No se pudo. Probá de nuevo.' };
  }

  const filas = (data ?? []) as ContactoReal[];
  const contacto = filas[0] ?? null;
  if (!contacto) return { error: 'No se pudo. Probá de nuevo.' };

  /* El aviso al negocio va después de contestarle a la persona: nadie debería
     esperar a que salga un correo para ver un teléfono. */
  after(async () => {
    try {
      const { data: n } = await servicio()
        .from('dst_negocio')
        .select('nombre, email, babosa')
        .eq('id', negocioId)
        .maybeSingle();

      const paraElNegocio = (n?.email as string | undefined)?.trim();
      if (!paraElNegocio) return; // Sin correo del negocio no hay a quién avisarle.

      const envio = await correoPidieronTusDatos({
        destino,
        idioma: (destino.idioma_principal ?? 'es') as Idioma,
        para: paraElNegocio,
        nombreNegocio: (n?.nombre as string) ?? '',
        quien: nombre || null,
        correoDeQuien: email || null,
        whatsappDeQuien: whatsapp || null,
      });
      if (!envio.ok) console.error('aviso al negocio no salió:', envio.error);
    } catch (fallo) {
      console.error('aviso al negocio:', fallo instanceof Error ? fallo.message : fallo);
    }
  });

  return { contacto };
}
