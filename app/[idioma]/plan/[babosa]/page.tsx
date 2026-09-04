import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import { destinoActual, enTeaser, categoriasDe } from '@/lib/destino';
import { t, type Idioma } from '@/lib/idiomas';
import { Barra } from '@/componentes/Barra';
import { Pie } from '@/componentes/Pie';
import { BotonReservarPlan } from '@/componentes/BotonReservarPlan';

/*
 * La página pública de un plan armado por el planificador. Se lee con la
 * clave publicable: solo salen itinerarios marcados como públicos, y solo
 * los negocios publicados. Es la URL que recibe el viajero por WhatsApp.
 */
export const dynamic = 'force-dynamic';

type Parametros = Promise<{ idioma: Idioma; babosa: string }>;

type Parada = {
  dia: number; orden: number; momento: string | null; titulo_libre: string | null; nota: string | null;
  porque: string | null; duracion_horas: number | null; costo_estimado_usd: number | null;
  negocio: { nombre: string; babosa: string; categoria: { babosa: string } | { babosa: string }[] | null } | { nombre: string; babosa: string; categoria: { babosa: string } | { babosa: string }[] | null }[] | null;
  tour: { nombre: string; precio_adulto_usd: number | null } | { nombre: string; precio_adulto_usd: number | null }[] | null;
};

async function planPorBabosa(babosa: string) {
  const { data } = await supabase
    .from('dst_itinerario')
    .select('id, destino_id, titulo, resumen, consejos, dias, empieza_el, personas, tipo_viajero, presupuesto, intereses, total_usd, idioma, creado_en')
    .eq('babosa', babosa)
    .eq('es_publico', true)
    .maybeSingle();
  if (!data) return null;
  const { data: paradas } = await supabase
    .from('dst_itinerario_parada')
    .select('dia, orden, momento, titulo_libre, nota, porque, duracion_horas, costo_estimado_usd, negocio:dst_negocio(nombre, babosa, categoria:dst_categoria(babosa)), tour:dst_tour(nombre, precio_adulto_usd)')
    .eq('itinerario_id', data.id)
    .order('dia')
    .order('orden');
  return { ...data, paradas: (paradas ?? []) as Parada[] };
}

const uno = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? x[0] ?? null : x ?? null);

export async function generateMetadata({ params }: { params: Parametros }): Promise<Metadata> {
  const { babosa } = await params;
  const plan = await planPorBabosa(babosa);
  if (!plan) return {};
  return { title: plan.titulo, description: plan.resumen ?? undefined, robots: { index: false } };
}

export default async function PaginaPlan({ params }: { params: Parametros }) {
  const { idioma, babosa } = await params;
  const [destino, plan] = await Promise.all([destinoActual(), planPorBabosa(babosa)]);
  // En prelanzamiento no se publican itinerarios.
  if (enTeaser(destino)) redirect(`/${idioma}`);
  if (!plan || plan.destino_id !== destino.id) notFound();
  const categorias = await categoriasDe(destino, idioma);

  const dias = new Map<number, Parada[]>();
  for (const p of plan.paradas) dias.set(p.dia, [...(dias.get(p.dia) ?? []), p]);
  const consejos = (plan.consejos ?? '').split('\n').map((c: string) => c.trim()).filter(Boolean);
  const url = `/${idioma}/plan/${babosa}`;

  return (
    <>
      <Barra destino={destino} idioma={idioma} categorias={categorias} rutaActual={url} />
      <main className="caja">
        <header className="plan-cabecera">
          <h1>{plan.titulo}</h1>
          {plan.resumen && <p>{plan.resumen}</p>}
          <div className="plan-datos">
            <span>{plan.dias} {t('plan_dia', idioma).toLowerCase()}{plan.dias > 1 ? 's' : ''}</span>
            {plan.empieza_el && <span>{plan.empieza_el}</span>}
            {plan.personas && <span>{plan.personas} 👤</span>}
            {plan.total_usd != null && <span>{t('plan_estimado', idioma)}: ${Math.round(plan.total_usd)} USD</span>}
          </div>
        </header>

        {[...dias.entries()].sort((a, b) => a[0] - b[0]).map(([dia, paradas]) => (
          <section key={dia} className="plan-dia">
            <h2><i>{t('plan_dia', idioma)} {dia}</i></h2>
            {paradas.map((p, i) => {
              const negocio = uno(p.negocio);
              const tour = uno(p.tour);
              const categoria = negocio ? uno(negocio.categoria) : null;
              const enlace = negocio && categoria ? `/${idioma}/${categoria.babosa}/${negocio.babosa}` : null;
              return (
                <article key={i} className="plan-parada">
                  <div className="momento">{p.momento ? t(`momento_${p.momento}`, idioma) : ''}</div>
                  <div>
                    <h3>{p.titulo_libre ?? negocio?.nombre ?? tour?.nombre}</h3>
                    {p.nota && <p>{p.nota}</p>}
                    {p.porque && <p className="porque">{p.porque}</p>}
                    <div className="meta">
                      {p.duracion_horas != null && <span>{p.duracion_horas} h</span>}
                      {p.costo_estimado_usd != null && <span>≈ ${Math.round(p.costo_estimado_usd)} USD</span>}
                      {enlace && <Link href={enlace}>{t('plan_ver_ficha', idioma)} →</Link>}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        ))}

        {consejos.length > 0 && (
          <aside className="plan-consejos">
            <h2>{t('plan_consejos', idioma)}</h2>
            <ul>{consejos.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>
          </aside>
        )}

        <div className="plan-cierre">
          <p>{t('plan_ajustar', idioma)}</p>
          <BotonReservarPlan texto={t('plan_reservar', idioma)} mensaje={`${plan.titulo} · https://${destino.dominio}${url}`} />
        </div>
      </main>
      <Pie destino={destino} />
    </>
  );
}
