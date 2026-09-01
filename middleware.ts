import { NextRequest, NextResponse } from 'next/server';
import { IDIOMAS, idiomaPreferido } from './lib/idiomas';

/**
 * Toda página vive bajo /<idioma>/. Una visita a la raíz se manda al idioma
 * que pide el navegador, para que un alemán no aterrice en español y se vaya.
 */
export function middleware(peticion: NextRequest) {
  const { pathname } = peticion.nextUrl;

  const yaTieneIdioma = IDIOMAS.some(
    (i) => pathname === `/${i}` || pathname.startsWith(`/${i}/`)
  );
  if (yaTieneIdioma) return NextResponse.next();

  const idioma = idiomaPreferido(peticion.headers.get('accept-language'));
  const destino = new URL(`/${idioma}${pathname === '/' ? '' : pathname}`, peticion.url);
  return NextResponse.redirect(destino);
}

export const config = {
  matcher: ['/((?!api|_next|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)'],
};
