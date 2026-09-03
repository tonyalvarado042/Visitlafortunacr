/*
 * La URL y la clave publicable del proyecto. La clave publicable NO es un
 * secreto: viaja al navegador por diseño y solo puede hacer lo que permitan
 * las políticas de acceso. Vive aquí, sin 'server-only', porque la usan el
 * middleware (edge), el cliente del sitio y el cliente de sesión del panel.
 */
const URL_POR_DEFECTO = 'https://eulkufetcymallfbpone.supabase.co';
const CLAVE_POR_DEFECTO = 'sb_publishable_1xWCcuzd0tCpcYCo8O5Ceg_nMnxx6pt';

function utilizable(valor: string | undefined): valor is string {
  if (!valor) return false;
  const limpio = valor.trim();
  return limpio.length >= 30 && !limpio.includes('...') && !limpio.endsWith('…');
}

export function credencialesPublicas() {
  return {
    url: utilizable(process.env.NEXT_PUBLIC_SUPABASE_URL)
      ? process.env.NEXT_PUBLIC_SUPABASE_URL!.trim()
      : URL_POR_DEFECTO,
    clave: utilizable(process.env.NEXT_PUBLIC_SUPABASE_KEY)
      ? process.env.NEXT_PUBLIC_SUPABASE_KEY!.trim()
      : CLAVE_POR_DEFECTO,
  };
}
