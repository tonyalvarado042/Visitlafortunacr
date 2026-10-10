'use server';

import { revalidatePath } from 'next/cache';
import { contextoPanel } from '@/lib/admin/contexto';
import { destinoActual } from '@/lib/destino';
import { enviarCorreo } from '@/lib/correo/enviar';

export type EstadoLlave = { ok?: string | null; error?: string | null };

/*
 * Las llaves de API, desde el panel.
 *
 * Solo se ESCRIBEN. No hay ninguna acción que devuelva el valor, ni para un
 * administrador: la función de la base que lo lee está concedida únicamente a
 * service_role. Lo que se ve es si está puesta, cuándo y sus últimos 4.
 */

/*
 * Qué forma tiene cada llave.
 *
 * Esto existe porque pasó: se pegó la dirección del panel de Resend en vez de
 * la llave, el campo lo aceptó sin chistar, y el error recién apareció al
 * intentar mandar un correo. Revisar la forma acá convierte un misterio de
 * media hora en un mensaje de una línea.
 */
const FORMA: Record<string, { prueba: RegExp; esperado: string }> = {
  RESEND_API_KEY: { prueba: /^re_[A-Za-z0-9_-]{10,}$/, esperado: 'empieza con re_' },
  ANTHROPIC_API_KEY: { prueba: /^sk-ant-[A-Za-z0-9_-]{20,}$/, esperado: 'empieza con sk-ant-' },
  AUTH_HOOK_SECRET: { prueba: /^(v1,)?whsec_[A-Za-z0-9+/=_-]{10,}$/, esperado: 'empieza con v1,whsec_' },
};

function queLeFalta(nombre: string, valor: string): string | null {
  if (/^https?:\/\//i.test(valor)) {
    return 'Eso es una dirección web, no la llave. La llave está dentro de esa página, '
      + 'en la sección de API keys — es una tira larga de letras y números.';
  }
  if (/\s/.test(valor)) {
    return 'La llave trae espacios o saltos de línea. Copiala de nuevo, completa y sin nada alrededor.';
  }
  if (valor.includes('…') || valor.includes('...')) {
    return 'Esa llave trae puntos suspensivos: se copió recortada. Copiala completa.';
  }

  const forma = FORMA[nombre];
  if (forma && !forma.prueba.test(valor)) {
    return `Eso no parece la llave de ${nombre}: la de verdad ${forma.esperado}. Revisá que copiaste la correcta.`;
  }
  return null;
}

export async function guardarLlave(_previo: EstadoLlave, datos: FormData): Promise<EstadoLlave> {
  const { db, usuario } = await contextoPanel('ajustes');
  if (usuario.rol !== 'admin') return { error: 'Solo un administrador puede guardar llaves.' };

  const nombre = String(datos.get('nombre') ?? '').trim().toUpperCase();
  const valor = String(datos.get('valor') ?? '').trim();
  const descripcion = String(datos.get('descripcion') ?? '').trim() || null;

  if (!nombre) return { error: '¿Cuál llave?' };
  if (!valor) return { error: 'Pegá la llave en el campo.' };

  const problema = queLeFalta(nombre, valor);
  if (problema) return { error: problema };

  const { error } = await db.rpc('guardar_secreto', {
    p_nombre: nombre,
    p_valor: valor,
    p_descripcion: descripcion,
  });
  if (error) {
    console.error('guardar_secreto:', error.message);
    return { error: error.message };
  }

  revalidatePath('/admin/ajustes/llaves');
  return { ok: `${nombre} quedó guardada. Termina en ${valor.slice(-4)}.` };
}

export async function olvidarLlave(datos: FormData) {
  const { db, usuario } = await contextoPanel('ajustes');
  if (usuario.rol !== 'admin') return;

  const nombre = String(datos.get('nombre') ?? '').trim().toUpperCase();
  if (!nombre) return;

  const { error } = await db.rpc('olvidar_secreto', { p_nombre: nombre });
  if (error) console.error('olvidar_secreto:', error.message);
  revalidatePath('/admin/ajustes/llaves');
}

/**
 * Mandarse un correo de prueba.
 *
 * Va por el mismo camino que todos: misma llave, mismo remitente, misma
 * plantilla. Si este llega, llegan todos; si falla, el motivo que devuelve
 * Resend se muestra tal cual — "domain not verified" dicho así se arregla en
 * dos minutos, y adivinando, en media tarde.
 *
 * Se manda SOLO al correo de quien está en sesión. No hay campo de
 * destinatario a propósito: esto es para probar, no para escribirle a nadie.
 */
export async function mandarCorreoDePrueba(_previo: EstadoLlave, _datos: FormData): Promise<EstadoLlave> {
  const { usuario } = await contextoPanel('ajustes');
  if (usuario.rol !== 'admin') return { error: 'Solo un administrador puede mandar la prueba.' };
  if (!usuario.email) return { error: 'Tu cuenta no tiene correo, así que no hay adónde mandarla.' };

  const destino = await destinoActual();

  const envio = await enviarCorreo({
    destino,
    idioma: (destino.idioma_principal ?? 'es') as 'es',
    para: usuario.email,
    asunto: `Prueba de correo · ${destino.marca_nombre}`,
    titulo: 'Si estás leyendo esto, el correo funciona',
    parrafos: [
      `Esta prueba salió del panel de ${destino.marca_nombre} y pasó por todo el camino de verdad: la llave de Resend guardada en la bóveda, el remitente del canal de correo y la plantilla con la marca.`,
      'O sea que las confirmaciones de negocio y las respuestas a consultas también van a llegar.',
    ],
    datos: [
      { rotulo: 'Para', valor: usuario.email },
      { rotulo: 'Mandada', valor: new Date().toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' }) },
    ],
    boton: { texto: 'Ver el sitio', url: `https://${destino.dominio}` },
    nota: 'Este correo lo pediste vos desde Ajustes → Llaves. Nadie más lo recibió.',
  });

  if (!envio.ok) {
    return { error: `No salió: ${envio.error}` };
  }
  return { ok: `Mandada a ${usuario.email}. Revisá la bandeja (y la carpeta de spam la primera vez).` };
}
