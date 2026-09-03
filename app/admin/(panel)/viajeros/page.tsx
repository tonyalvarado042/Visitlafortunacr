import Link from 'next/link';
import { contextoPanel } from '@/lib/admin/contexto';
import { relativo } from '@/lib/admin/formato';
import { Cabecera, Etiqueta, Vacio } from '@/componentes/admin/ui';

export const dynamic = 'force-dynamic';

export default async function PaginaViajeros({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { destino, db } = await contextoPanel('viajeros');

  let consulta = db
    .from('dst_viajero')
    .select('id, nombre, apellidos, email, whatsapp, pais_iso, idioma, llega_el, personas, tipo_viajero, origen, ultimo_contacto_en, no_molestar, creado_en, resumen_ia')
    .eq('destino_id', destino.id)
    .order('ultimo_contacto_en', { ascending: false, nullsFirst: false })
    .order('creado_en', { ascending: false })
    .limit(200);
  const limpio = q?.replace(/[,()%*]/g, ' ').trim();
  if (limpio) consulta = consulta.or(`nombre.ilike.%${limpio}%,apellidos.ilike.%${limpio}%,email.ilike.%${limpio}%,whatsapp.ilike.%${limpio}%`);
  const { data } = await consulta;

  return (
    <>
      <Cabecera titulo="Viajeros" sub={`${data?.length ?? 0} personas · ${destino.nombre}`} />
      <div className="filtros">
        <form action="/admin/viajeros" method="get"><input type="search" name="q" placeholder="Buscar por nombre, correo o WhatsApp" defaultValue={q ?? ''} /></form>
      </div>
      <div className="tarjeta desliza">
        {!data?.length ? <Vacio texto="Todavía no hay viajeros." /> : (
          <table className="tabla">
            <thead><tr><th>Nombre</th><th>Contacto</th><th>País · idioma</th><th>Llega</th><th>Viaja</th><th>Origen</th><th>Último contacto</th></tr></thead>
            <tbody>
              {data.map((v) => (
                <tr key={v.id}>
                  <td><Link className="fuerte" href={`/admin/viajeros/${v.id}`}>{[v.nombre, v.apellidos].filter(Boolean).join(' ') || v.email || v.whatsapp}</Link>{v.no_molestar && <> <Etiqueta color="#B42318">no molestar</Etiqueta></>}{v.resumen_ia && <div className="gris">{v.resumen_ia}</div>}</td>
                  <td className="gris">{v.email ?? ''}<br />{v.whatsapp ?? ''}</td>
                  <td>{v.pais_iso ?? '—'} · {v.idioma ?? '—'}</td>
                  <td>{v.llega_el ?? '—'}</td>
                  <td>{v.personas ?? '—'}{v.tipo_viajero ? ` · ${v.tipo_viajero}` : ''}</td>
                  <td className="gris">{v.origen ?? '—'}</td>
                  <td className="gris">{relativo(v.ultimo_contacto_en ?? v.creado_en)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
