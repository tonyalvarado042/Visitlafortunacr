import Link from 'next/link';
import type { Metadata } from 'next';
import { destinoActual, categoriasDe, cuposPremium } from '@/lib/destino';
import { sesion } from '@/lib/supabase-sesion';
import { misNegocios } from '@/lib/comercio';
import { t, type Idioma } from '@/lib/idiomas';
import { Barra } from '@/componentes/Barra';
import { Pie } from '@/componentes/Pie';
import { FormularioSumar } from './FormularioSumar';
import { OfertaPremium } from '@/componentes/OfertaPremium';

export const dynamic = 'force-dynamic';

type Parametros = Promise<{ idioma: Idioma }>;

export async function generateMetadata({ params }: { params: Parametros }): Promise<Metadata> {
  const { idioma } = await params;
  try {
    const destino = await destinoActual();
    return {
      title: t('sumar_titulo', idioma).replace('{destino}', destino.nombre),
      description: t('sumar_bajada', idioma).replace('{destino}', destino.nombre),
    };
  } catch {
    return {};
  }
}

export default async function SumarNegocio({ params }: { params: Parametros }) {
  const { idioma } = await params;
  const destino = await destinoActual();
  const [categorias, cupos] = await Promise.all([
    categoriasDe(destino, idioma),
    cuposPremium(destino),
  ]);

  /* Quién está mirando decide qué se muestra: sin cuenta, el paso de la
     cuenta; con cuenta, el formulario del negocio. Se resuelve en el servidor
     para que nadie vea el formulario de la ficha sin estar adentro. */
  const db = await sesion();
  const { data: { user } } = await db.auth.getUser();
  const negocios = user ? await misNegocios() : [];

  return (
    <>
      <Barra destino={destino} idioma={idioma} categorias={categorias} rutaActual="/sumar-negocio" />

      <section className="zona" style={{ paddingTop: 48 }}>
        <div className="caja caja-angosta">
          <span className="rotulo">{t('para_negocios', idioma)}</span>
          <h1 style={{ maxWidth: '18ch' }}>
            {t('sumar_titulo', idioma).replace('{destino}', destino.nombre)}
          </h1>
          <p className="entrada">
            {t('sumar_bajada', idioma).replace('{destino}', destino.nombre)}
          </p>

          <ul className="lista-promesas">
            <li>{t('sumar_promesa_1', idioma)}</li>
            <li>{t('sumar_promesa_2', idioma)}</li>
            <li>{t('sumar_promesa_3', idioma)}</li>
          </ul>

          {negocios.length > 0 && (
            <div className="aviso-suave">
              {t('sumar_ya_tenes', idioma).replace('{n}', String(negocios.length))}{' '}
              <Link href="/negocio">{t('sumar_ir_al_panel', idioma)}</Link>
            </div>
          )}

          <FormularioSumar
            idioma={idioma}
            conSesion={Boolean(user)}
            correoCuenta={user?.email ?? null}
            categorias={categorias
              .filter((c) => c.babosa)
              .map((c) => ({ id: c.categoria_id, nombre: c.nombre }))}
          />
        </div>
      </section>

      {/* La oferta va DESPUES del formulario. Ofrecerle el plan pago a alguien
          que todavia no subio su ficha gratis es pedirle plata a un
          desconocido. */}

      <OfertaPremium destino={destino} cupos={cupos} idioma={idioma} compacta />

      <Pie destino={destino} />
    </>
  );
}
