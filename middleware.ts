import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { IDIOMAS, idiomaPreferido } from './lib/idiomas';
import { credencialesPublicas } from './lib/credenciales-publicas';

/**
 * Dos trabajos:
 * 1. Toda página pública vive bajo /<idioma>/. Una visita a la raíz se manda
 *    al idioma que pide el navegador, para que un alemán no aterrice en
 *    español y se vaya.
 * 2. Bajo /admin se refresca la sesión de Supabase (la cookie) y se manda a
 *    ingresar a quien no la tenga.
 */
export async function middleware(peticion: NextRequest) {
  const { pathname } = peticion.nextUrl;

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return sesionDelPanel(peticion);
  }

  const yaTieneIdioma = IDIOMAS.some(
    (i) => pathname === `/${i}` || pathname.startsWith(`/${i}/`)
  );
  if (yaTieneIdioma) return NextResponse.next();

  const idioma = idiomaPreferido(peticion.headers.get('accept-language'));
  const destino = new URL(`/${idioma}${pathname === '/' ? '' : pathname}`, peticion.url);
  return NextResponse.redirect(destino);
}

async function sesionDelPanel(peticion: NextRequest) {
  const { pathname } = peticion.nextUrl;
  let respuesta = NextResponse.next({ request: peticion });
  const { url, clave } = credencialesPublicas();

  const supabase = createServerClient(url, clave, {
    cookies: {
      getAll() {
        return peticion.cookies.getAll();
      },
      setAll(lista) {
        for (const { name, value } of lista) peticion.cookies.set(name, value);
        respuesta = NextResponse.next({ request: peticion });
        for (const { name, value, options } of lista) respuesta.cookies.set(name, value, options);
      },
    },
  });

  // getUser valida el token con Supabase; getSession solo leería la cookie.
  const { data: { user } } = await supabase.auth.getUser();
  const enIngreso = pathname.startsWith('/admin/ingresar');

  if (!user && !enIngreso) {
    const destino = new URL('/admin/ingresar', peticion.url);
    if (pathname !== '/admin') destino.searchParams.set('volver', pathname);
    return NextResponse.redirect(destino);
  }
  if (user && enIngreso) {
    return NextResponse.redirect(new URL('/admin', peticion.url));
  }
  return respuesta;
}

export const config = {
  matcher: ['/((?!api|_next|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)'],
};
