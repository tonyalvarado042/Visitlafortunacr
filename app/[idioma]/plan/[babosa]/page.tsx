import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import { destinoActual, categoriasDe } from '@/lib/destino';
import { t, type Idioma } from '@/lib/idiomas';
import { Barra } from '@/componentes/Barra';
import { Pie } from '@/componentes/Pie';
import { BotonReservarPlan } from '@/componentes/BotonReservarPlan';
import { contactoDelEquipo } from '@/lib/contacto-del-equipo';

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
  if (!plan || plan.destino_id !== destino.id) notFound();
  const categorias = await categoriasDe(destino, idioma);

  const dias = new Map<number, Parada[]>();
  for (const p of plan.paradas) dias.set(p.dia, [...(dias.get(p.dia) ?? []), p]);
  const consejos = (plan.consejos ?? '').split('\n').map((c: string) => c.trim()).filter(Boolean);
  const url = `/${idioma}/plan/${babosa}`;
  /* El mensaje se arma UNA vez: lo usan los tres canales —el chat, WhatsApp y
     el correo— y si cada uno armara el suyo, el día que cambie uno los otros
     dos quedan diciendo otra cosa. */
  const mensajeDelPlan = `${t('plan_escribimos', idioma)}\n\n${plan.titulo}\nhttps://${destino.dominio}${url}`;
  const canal = contactoDelEquipo(destino, plan.titulo, mensajeDelPlan);

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

        {/* ⚠️ EL BOTÓN SE DECIDE ACÁ, EN EL SERVIDOR, y no siempre es el mismo.
            Antes era siempre `BotonReservarPlan`, que dispara el evento que
            escucha el CHAT. Pero el chat solo se monta si `chat_activo` está
            encendido en Ajustes — y con el chat apagado el botón quedaba vivo,
            se podía tocar y NO PASABA NADA: el evento se disparaba al vacío.
            Lo encontró Tony el 10 de noviembre de 2026.
            Ahora cae a WhatsApp o al correo, y si no hay ninguno de los tres
            no se ofrece: un botón que no lleva a ninguna parte es peor que
            ninguno. Ver `lib/contacto-del-equipo.ts`. */}
        {canal && (
          <div className="plan-cierre">
            <p>{t('plan_ajustar', idioma)}</p>
            {canal.tipo === 'chat' ? (
              <BotonReservarPlan texto={t('plan_reservar', idioma)} mensaje={mensajeDelPlan} />
            ) : (
              /* Un <a> y nada más: sin JavaScript no hay nada que pueda fallar
                 callado, que es justo lo que pasaba antes. */
              <a className="boton" href={canal.href}
                 {...(canal.tipo === 'whatsapp' ? { target: '_blank', rel: 'noreferrer' } : {})}>
                {t('plan_reservar', idioma)}
              </a>
            )}
          </div>
        )}
      </main>
      <Pie destino={destino} categorias={categorias} idioma={idioma} />
    </>
  );
}
