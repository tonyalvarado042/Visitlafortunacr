import 'server-only';
import { cookies } from 'next/headers';

/**
 * ¿Parece que hay alguien con sesión?
 *
 * Mira SOLO si existe la cookie de Supabase. Cero red, cero base de datos.
 *
 * Esto se usa en la barra, que se pinta en TODAS las páginas públicas. Hacer
 * la comprobación de verdad ahí —`auth.getUser()`, que valida el token contra
 * Supabase— le agregaría una llamada de red a cada carga del sitio. En un
 * directorio que vive de que Google lo encuentre rápido, eso se paga caro.
 *
 * No valida nada y no pretende hacerlo: solo decide si se dibuja el ícono de
 * perfil. Quien entra a /negocio pasa por la comprobación completa. El peor
 * error posible es un ícono de más mientras la cookie está vencida, y al
 * tocarlo va a parar a la pantalla de ingreso.
 */
/* ⚠️ El nombre tiene que terminar ahí, o en .0 / .1 cuando el token es largo
   y Supabase lo parte en pedazos.
   Lo que NO puede entrar son las `sb-…-auth-token-code-verifier`, que Supabase
   deja apenas alguien ABRE la pantalla de ingreso aunque no complete nada.
   Con un patrón abierto, cualquiera que tocó "entrar" una vez vería el ícono
   de perfil para siempre sin tener sesión. */
const COOKIE_DE_SESION = /^sb-.+-auth-token(\.\d+)?$/;

export async function pareceHaberSesion(): Promise<boolean> {
  const almacen = await cookies();
  return almacen.getAll().some((c) => COOKIE_DE_SESION.test(c.name) && Boolean(c.value));
}
