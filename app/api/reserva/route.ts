import { NextRequest, NextResponse, after } from 'next/server';
import { supabase } from '@/lib/supabase';
import { dominioDeHost } from '@/lib/dominio';
import { esIdioma, t, type Idioma } from '@/lib/idiomas';
import { destinoActual } from '@/lib/destino';
import { servicio, hayClaveDeServicio } from '@/lib/supabase-servidor';
import { correoReservaPedida, correoReservaAlEquipo } from '@/lib/correo/cartas';

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

  /* Un producto O una tour, nunca las dos. La base lo vuelve a comprobar: lo
     que llega del navegador es un dato, no una decisión. */
  const producto = cadena(cuerpo.producto_id);
  const tour = cadena(cuerpo.tour_id);
  const paraEl = cadena(cuerpo.para_el);
  const adultos = entero(cuerpo.adultos);
  const ninos = entero(cuerpo.ninos);
  const nombre = cadena(cuerpo.nombre);
  const email = cadena(cuerpo.email).toLowerCase();

  const esProducto = UUID.test(producto);
  const esTour = UUID.test(tour);
  if (esProducto === esTour) return mal(t('reserva_error', idioma));
  if (!FECHA.test(paraEl)) return mal(t('reserva_falta_fecha', idioma));
  if (adultos < 1 || adultos > 40) return mal(t('reserva_falta_personas', idioma));
  if (ninos < 0 || ninos > 40) return mal(t('reserva_falta_personas', idioma));
  if (nombre.length < 2) return mal(t('sorteo_falta_nombre', idioma));
  if (!CORREO.test(email)) return mal(t('correo_invalido', idioma));

  const { data, error } = await supabase.rpc('pedir_reserva', {
    p_dominio:  dominioDeHost(peticion.headers.get('host')),
    p_producto: esProducto ? producto : null,
    p_tour:     esTour ? tour : null,
    p_cupon:    cadena(cuerpo.cupon).slice(0, 40) || null,
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
    const suyo = /cup[oó]n|cupo|fecha|antelaci|nombre|correo|adulto|niño|nino|disponible|abiertas|venta/i
      .test(error.message);
    console.error('pedir_reserva falló:', error.message);
    return NextResponse.json(
      { error: suyo ? error.message : t('reserva_error', idioma) },
      { status: suyo ? 400 : 500 },
    );
  }

  const fila = ((data ?? []) as {
    ok: boolean; codigo: string; accion: string;
    total_usd: number | null; descuento_usd: number | null;
  }[])[0];

  /* Los dos correos van DESPUES de responder: el visitante ya vio su codigo
     y no tiene por que esperar a Resend. Y si el correo falla, la reserva
     sigue existiendo — que es lo que importa.

     El del equipo no es un adorno: es la unica razon por la que alguien va a
     mirar el panel. Una solicitud que nadie ve es peor que no tener boton. */
  if (fila?.codigo && hayClaveDeServicio()) {
    after(async () => {
      try {
        const destino = await destinoActual();
        const { data: r } = await servicio()
          .from('dst_reserva')
          .select('id, codigo, para_el, adultos, ninos, total_usd, descuento_usd, nombre_titular, email_titular, whatsapp_titular, notas, producto:dst_producto(nombre), operador:dst_negocio(nombre), lineas:dst_reserva_linea(descripcion)')
          .eq('codigo', fila.codigo).maybeSingle();
        if (!r) return;

        const uno = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);
        /* El nombre de lo reservado. Si fue una tour no hay producto, así que
           sale de la primera línea — a la que se le quita el " · adulto" que
           la función le pone para distinguirla de la de niños. */
        const lineas = (r.lineas ?? []) as { descripcion: string }[];
        const prod = uno(r.producto as { nombre: string } | { nombre: string }[] | null)?.nombre
          ?? lineas[0]?.descripcion?.replace(/\s·\s(adulto|nino|niño)$/i, '')
          ?? '';
        const oper = uno(r.operador as { nombre: string } | { nombre: string }[] | null)?.nombre ?? '';
        const total = r.total_usd == null ? null : Number(r.total_usd);

        await correoReservaPedida({
          destino, idioma, para: r.email_titular as string,
          codigo: r.codigo as string, producto: prod, operador: oper,
          paraEl: r.para_el as string,
          personas: Number(r.adultos ?? 0) + Number(r.ninos ?? 0),
          totalUsd: total,
        });

        /* Al equipo solo si hay a quien escribirle. Sin correo de contacto
           no se inventa un destinatario. */
        const equipo = destino.email_contacto?.trim();
        if (equipo) {
          await correoReservaAlEquipo({
            destino, para: equipo,
            codigo: r.codigo as string, producto: prod, operador: oper,
            paraEl: r.para_el as string,
            adultos: Number(r.adultos ?? 0), ninos: Number(r.ninos ?? 0),
            totalUsd: total,
            nombre: r.nombre_titular as string, email: r.email_titular as string,
            whatsapp: (r.whatsapp_titular as string | null) ?? null,
            notas: (r.notas as string | null) ?? null,
            reservaId: r.id as string,
          });
        }
      } catch (error) {
        console.error('correos de reserva:', error instanceof Error ? error.message : error);
      }
    });
  }

  /* El total y el descuento se devuelven para que la pantalla de "listo"
     muestre lo que de verdad se guardó, no lo que el navegador calculó. Si
     entró un cupón, el número de antes ya no sirve: era el de sin cupón. */
  return NextResponse.json(
    {
      ok: true, codigo: fila?.codigo, accion: fila?.accion,
      total_usd: fila?.total_usd == null ? null : Number(fila.total_usd),
      descuento_usd: fila?.descuento_usd == null ? null : Number(fila.descuento_usd),
    },
    { status: 201 },
  );
}
