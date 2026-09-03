import Link from 'next/link';
import { contextoPanel } from '@/lib/admin/contexto';
import { relativo, truncar } from '@/lib/admin/formato';
import { Cabecera, Etiqueta, Vacio } from '@/componentes/admin/ui';
import { FormularioConocimiento } from './Formulario';

export const dynamic = 'force-dynamic';

const TIPOS = ['dato', 'faq', 'politica', 'guion', 'regla', 'aviso', 'negocio', 'tour'];

export default async function PaginaConocimiento({ searchParams }: { searchParams: Promise<{ q?: string; tipo?: string; estado?: string }> }) {
  const f = await searchParams;
  const { destino, db } = await contextoPanel('ia');

  let consulta = db.from('dst_conocimiento').select('id, tipo, titulo, contenido, idioma, etiquetas, prioridad, esta_verificado, esta_activo, vigente_hasta, para_concierge, para_planificador, actualizado_en').eq('destino_id', destino.id).order('prioridad', { ascending: false }).order('titulo').limit(500);
  if (f.tipo && TIPOS.includes(f.tipo)) consulta = consulta.eq('tipo', f.tipo);
  if (f.estado === 'sin_verificar') consulta = consulta.eq('esta_verificado', false);
  if (f.estado === 'inactivo') consulta = consulta.eq('esta_activo', false);
  const [{ data }, { data: negocios }, prueba] = await Promise.all([
    consulta,
    db.from('dst_negocio').select('id, nombre').eq('destino_id', destino.id).order('nombre'),
    f.q ? db.rpc('buscar_conocimiento', { p_destino_id: destino.id, p_consulta: f.q, p_limite: 8, p_uso: 'concierge' }) : Promise.resolve({ data: null }),
  ]);
  const resultados = (prueba.data ?? null) as { id: string; titulo: string; relevancia: number; tipo: string }[] | null;

  return (
    <>
      <Cabecera titulo="Conocimiento" migas={[{ ruta: '/admin/ia', nombre: 'Inteligencia' }]} sub={`${data?.length ?? 0} fichas · lo que la IA sabe de ${destino.nombre}. Sin esto, responde con generalidades.`} />

      <div className="filtros">
        <form action="/admin/ia/conocimiento" method="get"><input type="search" name="q" placeholder="Probar una búsqueda como la haría la IA" defaultValue={f.q ?? ''} /></form>
        {TIPOS.map((t) => <Link key={t} href={`/admin/ia/conocimiento?tipo=${f.tipo === t ? '' : t}`} className={f.tipo === t ? 'activo' : ''}>{t}</Link>)}
        <Link href={`/admin/ia/conocimiento?estado=${f.estado === 'sin_verificar' ? '' : 'sin_verificar'}`} className={f.estado === 'sin_verificar' ? 'activo' : ''}>Sin verificar</Link>
        <Link href={`/admin/ia/conocimiento?estado=${f.estado === 'inactivo' ? '' : 'inactivo'}`} className={f.estado === 'inactivo' ? 'activo' : ''}>Inactivos</Link>
      </div>

      {resultados && (
        <div className="tarjeta">
          <h2>Lo que encontraría la IA para “{f.q}”</h2>
          {!resultados.length ? <Vacio texto="Nada. Si un viajero pregunta esto, la IA va a decir que no sabe y escalar. Agregá una ficha." /> : (
            <ol style={{ margin: 0, paddingLeft: 20 }}>{resultados.map((r) => <li key={r.id}><Link href={`/admin/ia/conocimiento/${r.id}`}>{r.titulo}</Link> <span className="gris">{r.tipo} · relevancia {Number(r.relevancia).toFixed(2)}</span></li>)}</ol>
          )}
        </div>
      )}

      <div className="lado">
        <div className="tarjeta desliza">
          {!data?.length ? <Vacio texto="Sin fichas con esos filtros." /> : (
            <table className="tabla">
              <thead><tr><th>Ficha</th><th>Tipo</th><th className="num">Prioridad</th><th>Usa</th><th>Estado</th><th>Actualizada</th></tr></thead>
              <tbody>{data.map((k) => (
                <tr key={k.id} style={{ opacity: k.esta_activo ? 1 : .5 }}>
                  <td><Link className="fuerte" href={`/admin/ia/conocimiento/${k.id}`}>{k.titulo}</Link><div className="gris">{truncar(k.contenido, 120)}</div>{k.etiquetas?.length ? <div className="gris">{k.etiquetas.join(' · ')}</div> : null}</td>
                  <td><Etiqueta suave>{k.tipo}</Etiqueta> <span className="gris">{k.idioma}</span></td>
                  <td className="num">{k.prioridad}</td>
                  <td className="gris">{[k.para_concierge ? 'concierge' : null, k.para_planificador ? 'planificador' : null].filter(Boolean).join(', ') || '—'}</td>
                  <td>{k.esta_verificado ? <Etiqueta color="#66BB2E">verificado</Etiqueta> : <Etiqueta color="#F59E0B">por verificar</Etiqueta>}{k.vigente_hasta && <div className="gris">hasta {k.vigente_hasta}</div>}</td>
                  <td className="gris">{relativo(k.actualizado_en)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
        <div className="tarjeta">
          <h2>Nueva ficha</h2>
          <FormularioConocimiento fila={{}} idiomas={destino.idiomas} principal={destino.idioma_principal} negocios={negocios ?? []} volver="/admin/ia/conocimiento" />
        </div>
      </div>
    </>
  );
}
