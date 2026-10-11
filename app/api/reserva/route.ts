import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { dominioDeHost } from '@/lib/dominio';
import { esIdioma, t, type Idioma } from '@/lib/idiomas';

/**
 * Pedir una reserva. Hermana de /api/resena, /api/solicitud y /api/sorteo.
 *
 * No cobra NADA y no confirma nada: deja una solicitud y crea el lead. La
 * confirma una persona desde el panel, con la referencia que da el operador
 * — que es la única prueba de que el cupo existe.
 *
 * El precio que mande el navegador se ignora por completo. El total lo
 * calcula `pedir_reserva` con la tarifa vigente, y solo si está verificada.
 * Un total que venga del cliente es un total que el cliente puede cambiar.
 */
export const runtime = 'nodejs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CORREO = /^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const cadena = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const entero = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : 0;
};

export async function POST(peticion: NextRequest) {
  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }

  const idioma: Idioma = esIdioma(cadena(cuerpo.idioma)) ? (cadena(cuerpo.idioma) as Idioma) : 'es';
  const mal = (mensaje: string) => NextResponse.json({ error: mensaje }, { status: 400 });

  const producto = cadena(cuerpo.producto_id);
  const paraEl = cadena(cuerpo.para_el);
  const adultos = entero(cuerpo.adultos);
  const ninos = entero(cuerpo.ninos);
  const nombre = cadena(cuerpo.nombre);
  const email = cadena(cuerpo.email).toLowerCase();

  if (!UUID.test(producto)) return mal(t('reserva_error', idioma));
  if (!FECHA.test(paraEl)) return mal(t('reserva_falta_fecha', idioma));
  if (adultos < 1 || adultos > 40) return mal(t('reserva_falta_personas', idioma));
  if (ninos < 0 || ninos > 40) return mal(t('reserva_falta_personas', idioma));
  if (nombre.length < 2) return mal(t('sorteo_falta_nombre', idioma));
  if (!CORREO.test(email)) return mal(t('correo_invalido', idioma));

  const { data, error } = await supabase.rpc('pedir_reserva', {
    p_dominio:  dominioDeHost(peticion.headers.get('host')),
    p_producto: producto,
    p_para_el:  paraEl,
    p_adultos:  adultos,
    p_ninos:    ninos,
    p_nombre:   nombre,
    p_email:    email,
    p_whatsapp: cadena(cuerpo.whatsapp) || null,
    p_notas:    cadena(cuerpo.notas).slice(0, 1000) || null,
    p_idioma:   idioma,
  });

  if (error) {
    /* Los motivos que la base levanta a propósito —sin cupo, fecha pasada,
       poca antelación— son útiles para quien reserva y no revelan nada. Los
       demás se tragan: un fallo de conexión no tiene por qué contarle al
       visitante cómo se llama una tabla. */
    const suyo = /cupo|fecha|antelaci|nombre|correo|adulto|niño|nino|disponible|abiertas|venta/i
      .test(error.message);
    console.error('pedir_reserva falló:', error.message);
    return NextResponse.json(
      { error: suyo ? error.message : t('reserva_error', idioma) },
      { status: suyo ? 400 : 500 },
    );
  }

  const fila = ((data ?? []) as { ok: boolean; codigo: string; accion: string }[])[0];
  return NextResponse.json(
    { ok: true, codigo: fila?.codigo, accion: fila?.accion },
    { status: 201 },
  );
}
