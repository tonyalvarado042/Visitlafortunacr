import 'server-only';
import { createClient } from '@supabase/supabase-js';

/*
 * El cliente de SERVICIO: salta las políticas de acceso y por eso solo vive en
 * el servidor (import 'server-only' hace que el build falle si alguien lo
 * importa desde un componente de cliente). Lo usan la IA, los webhooks y el
 * cron. El panel NO lo usa para leer ni editar datos: ahí manda la sesión del
 * usuario, para que las políticas y la auditoría sepan quién hizo qué.
 *
 * La clave viene de SUPABASE_SECRET_KEY (o SUPABASE_SERVICE_ROLE_KEY). No hay
 * respaldo en el código a propósito: un secreto nunca se escribe en el repo.
 */
const URL_POR_DEFECTO = 'https://eulkufetcymallfbpone.supabase.co';

function utilizable(valor: string | undefined): valor is string {
  if (!valor) return false;
  const limpio = valor.trim();
  return limpio.length >= 30 && !limpio.includes('...') && !limpio.endsWith('…');
}

export function hayClaveDeServicio(): boolean {
  return utilizable(process.env.SUPABASE_SECRET_KEY) || utilizable(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function crear() {
  const url = utilizable(process.env.NEXT_PUBLIC_SUPABASE_URL)
    ? process.env.NEXT_PUBLIC_SUPABASE_URL!.trim()
    : URL_POR_DEFECTO;

  const clave = utilizable(process.env.SUPABASE_SECRET_KEY)
    ? process.env.SUPABASE_SECRET_KEY!.trim()
    : utilizable(process.env.SUPABASE_SERVICE_ROLE_KEY)
      ? process.env.SUPABASE_SERVICE_ROLE_KEY!.trim()
      : null;

  if (!clave) {
    throw new Error(
      'Falta SUPABASE_SECRET_KEY en el entorno. Sin ella la IA, los webhooks y el cron no pueden escribir en la base.'
    );
  }

  return createClient(url, clave, {
    db: { schema: 'destinos' },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type ClienteServicio = ReturnType<typeof crear>;

let cliente: ClienteServicio | null = null;

/** Cliente con la clave de servicio. Se crea al primer uso, no al importar. */
export function servicio(): ClienteServicio {
  cliente ??= crear();
  return cliente;
}
