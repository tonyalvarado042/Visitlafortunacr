'use server';

import { redirect } from 'next/navigation';
import { sesion } from '@/lib/supabase-sesion';
import { destinoActual, negociosDe } from '@/lib/destino';
import type { Idioma } from '@/lib/idiomas';
import { origen, pedirEnlaceDeClave } from '@/lib/recuperacion';
import { correoNegocioRecibido } from '@/lib/correo/cartas';
import { categoriasDe } from '@/lib/destino';
import { after } from 'next/server';

export type EstadoCuenta = { error?: string | null; mensaje?: string | null };
export type EstadoNegocio = {
  error?: string | null;
  /** Fichas parecidas encontradas: hay que preguntar antes de crear otra. */
  parecidos?: { nombre: string; babosa: string; categoria: string }[];
  /* Cuando se creo, en vez de redirigir se devuelve el negocio: el formulario
     sigue al paso de las fotos sin salir de la pagina. Redirigiendo, la gente
     daba por terminado el tramite y la ficha se quedaba sin una sola foto. */
  creado?: { id: string; babosa: string; destinoBabosa: string } | null;
};

const texto = (d: FormData, k: string) => String(d.get(k) ?? '').trim();

/** Un teléfono como lo pide la base: solo dígitos y con el + adelante. */
function telefono(valor: string): string | null {
  const limpio = valor.replace(/[^\d+]/g, '');
  if (!limpio) return null;
  return limpio.startsWith('+') ? limpio : `+${limpio}`;
}

/**
 * Paso 1: la cuenta.
 *
 * Primero la cuenta y después la ficha, y no todo junto, porque si el proyecto
 * tiene prendida la confirmación por correo el signUp NO devuelve sesión — y
 * sin sesión la base no sabe quién es para ligarle el negocio. Partido en dos,
 * quien tenga que confirmar vuelve y no pierde nada: todavía no había escrito
 * los datos del negocio.
 */
export async function crearCuenta(_previo: EstadoCuenta, datos: FormData): Promise<EstadoCuenta> {
  const email = texto(datos, 'email').toLowerCase();
  const clave = String(datos.get('clave') ?? '');
  const nombre = texto(datos, 'nombre');

  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return { error: 'Escribí un correo válido.' };
  if (clave.length < 8) return { error: 'La contraseña necesita al menos 8 caracteres.' };
  if (!nombre) return { error: '¿Cómo te llamás?' };

  const db = await sesion();
  const { data, error } = await db.auth.signUp({
    email,
    password: clave,
    /* Al área del COMERCIANTE, no al panel del equipo: quien suma su
         negocio no es del equipo y en /admin lo rebota sin explicación. */
    options: { data: { nombre }, emailRedirectTo: `${await origen()}/negocio/auth/callback` },
  });

  if (error) {
    // "User already registered" en inglés no le dice nada a nadie.
    const ya = /already/i.test(error.message);
    return { error: ya ? 'Ese correo ya tiene cuenta. Entrá con tu contraseña.' : error.message };
  }
  if (data.session) return {};  // la página ya lo ve adentro y pasa al paso 2
  return { mensaje: 'Te mandamos un correo para confirmar la cuenta. Confirmá y volvé a esta página para cargar tu negocio.' };
}

export async function entrar(_previo: EstadoCuenta, datos: FormData): Promise<EstadoCuenta> {
  const email = texto(datos, 'email').toLowerCase();
  const clave = String(datos.get('clave') ?? '');
  if (!email || !clave) return { error: 'Escribí tu correo y tu contraseña.' };

  const db = await sesion();
  const { error } = await db.auth.signInWithPassword({ email, password: clave });
  if (error) return { error: 'Correo o contraseña incorrectos.' };
  return {};
}

/**
 * Paso 2: la ficha.
 *
 * Entra como PENDIENTE — eso lo decide la función de la base, no esto. Si se
 * publicara sola, cualquiera llena el directorio de fichas falsas en una tarde.
 *
 * Antes de crear busca parecidos entre los que ya están publicados y, si los
 * hay, se los muestra en vez de crear. No bloquea: quien confirme que el suyo
 * es distinto sigue, y la ficha llega marcada para que el equipo la mire.
 */
export async function sumarNegocio(_previo: EstadoNegocio, datos: FormData): Promise<EstadoNegocio> {
  const db = await sesion();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: 'Se cerró la sesión. Volvé a entrar.' };

  const idioma = (texto(datos, 'idioma') || 'es') as Idioma;
  const nombre = texto(datos, 'nombre');
  const categoriaId = texto(datos, 'categoria_id');
  if (!nombre) return { error: 'El negocio necesita un nombre.' };
  if (!/^[0-9a-f-]{36}$/i.test(categoriaId)) return { error: 'Elegí a qué categoría pertenece.' };

  /* El telefono es obligatorio. Una ficha sin telefono no se puede contactar,
     y el muro del contacto no tiene nada que destapar: el visitante deja sus
     datos a cambio de nada. Se exige ACA y no solo en el HTML, porque el
     "required" del navegador se salta. */
  const tel = telefono(texto(datos, 'telefono'));
  if (!tel) return { error: 'Falta el teléfono. Es lo primero que busca quien quiere ir.' };

  const destino = await destinoActual();

  // Parecidos: se compara sin tildes ni mayúsculas, y basta con que uno
  // contenga al otro — "Hotel Arenal" y "Arenal Hotel" son el mismo lugar.
  const llano = (v: string) =>
    v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const yoLlano = llano(nombre);

  let parecidos: EstadoNegocio['parecidos'] = [];
  if (texto(datos, 'confirmado') !== '1') {
    const existentes = await negociosDe(destino, idioma);
    parecidos = existentes
      .filter((n) => {
        const suyo = llano(n.nombre);
        return suyo === yoLlano || suyo.includes(yoLlano) || yoLlano.includes(suyo);
      })
      .slice(0, 5)
      .map((n) => ({ nombre: n.nombre, babosa: n.babosa, categoria: n.categoria_nombre }));
    if (parecidos.length) return { parecidos };
  }

  const nota = texto(datos, 'confirmado') === '1' && texto(datos, 'parecidos_vistos')
    ? `El dueño cargó esta ficha habiendo visto que ya existían: ${texto(datos, 'parecidos_vistos')}. Revisar que no sea un duplicado.`
    : null;

  const { data, error } = await db.rpc('crear_mi_negocio', {
    p_dominio: destino.dominio,
    p_categoria_id: categoriaId,
    p_nombre: nombre,
    p_resumen: texto(datos, 'resumen') || null,
    p_telefono: tel,
    p_whatsapp: telefono(texto(datos, 'telefono_whatsapp')),
    p_email: texto(datos, 'email').toLowerCase() || null,
    p_sitio_web: texto(datos, 'sitio_web') || null,
    p_direccion: texto(datos, 'direccion') || null,
    p_mi_nombre: texto(datos, 'mi_nombre') || null,
    p_mi_telefono: telefono(texto(datos, 'mi_telefono')),
    p_nota: nota,
  });

  if (error) {
    console.error('crear_mi_negocio:', error.message);
    return { error: 'No se pudo guardar el negocio. Probá de nuevo.' };
  }

  const negocioId = data as string;

  /* La babosa la arma la base (puede agregarle un sufijo si ya existia), asi
     que se lee de vuelta: las fotos se suben a una carpeta con ESE nombre. */
  const { data: creado } = await db
    .from('dst_negocio')
    .select('babosa')
    .eq('id', negocioId)
    .maybeSingle();
  const babosaNueva = (creado?.babosa as string | undefined) ?? '';

  /* El correo de confirmación. Va DESPUÉS de responder (after) y envuelto en
     try: que Resend esté caído o falte la llave no puede impedir que alguien
     registre su negocio. Si no sale, queda en el registro del servidor. */
  const correo = texto(datos, 'email').toLowerCase() || user.email || null;
  if (correo) {
    const categoria = (await categoriasDe(destino, idioma))
      .find((c) => c.categoria_id === categoriaId)?.nombre ?? null;
    after(async () => {
      try {
        const envio = await correoNegocioRecibido({
          destino, idioma, para: correo, negocioId,
          nombreNegocio: nombre, categoria,
        });
        if (!envio.ok) console.error('correo de negocio no salió:', envio.error);
      } catch (fallo) {
        console.error('correo de negocio:', fallo instanceof Error ? fallo.message : fallo);
      }
    });
  }

  return {
    creado: { id: negocioId, babosa: babosaNueva, destinoBabosa: destino.babosa },
  };
}

/**
 * "Olvidé mi contraseña" desde la pantalla pública de sumar negocio.
 *
 * Es la tercera pantalla de entrar del sitio, y también necesita salida:
 * quien ya tiene cuenta y no se acuerda de la clave queda trabado acá mismo.
 * El enlace vuelve por /negocio, que es el área que le toca.
 */
export async function olvideMiClaveSumar(
  _previo: EstadoCuenta, datos: FormData
): Promise<EstadoCuenta> {
  const r = await pedirEnlaceDeClave(texto(datos, 'email').toLowerCase(), '/negocio');
  return { error: r.error ?? null, mensaje: r.mensaje ?? null };
}
