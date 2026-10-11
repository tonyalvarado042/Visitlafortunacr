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

  const deLaRuta = IDIOMAS.find(
    (i) => pathname === `/${i}` || pathname.startsWith(`/${i}/`)
  );
  if (deLaRuta) {
    /* El idioma viaja al layout RAIZ en una cabecera de la peticion. Suena
       rebuscado, pero no hay otra via: en el App Router solo el layout raiz
       pinta <html>, y ese layout no recibe los parametros de la ruta. Sin
       esto, /de y /fr se servian con lang="es" — Google lo lee como el idioma
       de la pagina y tira abajo el hreflang que si esta bien puesto. */
    const cabeceras = new Headers(peticion.headers);
    cabeceras.set('x-idioma', deLaRuta);
    return NextResponse.next({ request: { headers: cabeceras } });
  }

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
  /* La vuelta del enlace mágico y del correo de confirmación pasa por
     <base>/auth/callback SIN sesión todavía: el código está justo por
     canjearse. Si el portero la trata como una página más, la rebota a
     ingresar y el callback NUNCA llega a ejecutarse — que es exactamente lo
     que hacía que el enlace mágico "no hiciera nada" y te devolviera a la
     pantalla de entrar sin decir por qué. */
  const enRetorno = pathname.startsWith(`${base}/auth/`);
  if (enRetorno) return respuesta;

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
