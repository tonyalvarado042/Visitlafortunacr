import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { IDIOMAS, idiomaPreferido } from './lib/idiomas';
import { credencialesPublicas } from './lib/credenciales-publicas';

/**
 * Dos trabajos:
 * 1. Toda página pública vive bajo /<idioma>/. Una visita a la raíz se manda
 *    al idioma que pide el navegador, para que un alemán no aterrice en
 *    español y se vaya.
 * 2. Bajo /admin y bajo /negocio se refresca la sesión de Supabase (la
 *    cookie) y se manda a ingresar a quien no la tenga.
 *
 * ⚠️ Toda área con sesión tiene que estar en ÁREAS. Si no, el punto 1 se la
 * come: /negocio se convertía en /es/negocio, caía en la ruta de fichas de
 * negocio y daba 404 — el panel del comerciante no abría nunca.
 */
const AREAS = [
  { base: '/admin',   ingreso: '/admin/ingresar' },
  { base: '/negocio', ingreso: '/negocio/ingresar' },
];

export async function middleware(peticion: NextRequest) {
  const { pathname } = peticion.nextUrl;

  const area = AREAS.find((a) => pathname === a.base || pathname.startsWith(`${a.base}/`));
  if (area) return sesionDelPanel(peticion, area.base, area.ingreso);

  const yaTieneIdioma = IDIOMAS.some(
    (i) => pathname === `/${i}` || pathname.startsWith(`/${i}/`)
  );
  if (yaTieneIdioma) return NextResponse.next();

  const idioma = idiomaPreferido(peticion.headers.get('accept-language'));
  const destino = new URL(`/${idioma}${pathname === '/' ? '' : pathname}`, peticion.url);
  return NextResponse.redirect(destino);
}

async function sesionDelPanel(peticion: NextRequest, base: string, ingreso: string) {
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
  const enIngreso = pathname.startsWith(ingreso);

  if (!user && !enIngreso) {
    const destino = new URL(ingreso, peticion.url);
    if (pathname !== base) destino.searchParams.set('volver', pathname);
    return NextResponse.redirect(destino);
  }
  if (user && enIngreso) {
    return NextResponse.redirect(new URL(base, peticion.url));
  }
  return respuesta;
}

export const config = {
  matcher: ['/((?!api|_next|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)'],
};
