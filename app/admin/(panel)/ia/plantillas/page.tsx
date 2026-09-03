import Link from 'next/link';
import { contextoPanel } from '@/lib/admin/contexto';
import { truncar } from '@/lib/admin/formato';
import { Cabecera, Etiqueta, Vacio } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { guardarPlantilla } from '../acciones';

export const dynamic = 'force-dynamic';

export default async function PaginaPlantillas() {
  const { destino, db } = await contextoPanel('ia');
  const { data } = await db.from('dst_plantilla_mensaje').select('id, clave, canal, idioma, asunto, cuerpo, esta_activa').eq('destino_id', destino.id).order('clave').order('canal').order('idioma');
  return (
    <>
      <Cabecera titulo="Plantillas" migas={[{ ruta: '/admin/ia', nombre: 'Inteligencia' }]} sub="Mensajes fijos que mandan las automatizaciones. Variables: {{nombre}} {{destino}} {{marca}} {{llega_el}} {{enlace_itinerario}} {{whatsapp_destino}}. Si falta un idioma, se usa el principal." />
      <div className="lado">
        <div className="tarjeta desliza">
          {!data?.length ? <Vacio texto="Sin plantillas." /> : (
            <table className="tabla">
              <thead><tr><th>Clave</th><th>Canal</th><th>Idioma</th><th>Texto</th><th></th></tr></thead>
              <tbody>{data.map((p) => (
                <tr key={p.id} style={{ opacity: p.esta_activa ? 1 : .5 }}>
                  <td><Link className="fuerte" href={`/admin/ia/plantillas/${p.id}`}>{p.clave}</Link></td>
                  <td>{p.canal}</td><td>{p.idioma}</td>
                  <td>{p.asunto && <strong>{p.asunto} · </strong>}{truncar(p.cuerpo, 110)}</td>
                  <td>{!p.esta_activa && <Etiqueta color="#B42318">inactiva</Etiqueta>}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
        <div className="tarjeta">
          <h2>Nueva plantilla</h2>
          <form action={guardarPlantilla} className="campos" style={{ gridTemplateColumns: '1fr' }}>
            <div className="campo"><label>Clave</label><input name="clave" placeholder="recordatorio_pago" required /></div>
            <div className="campos" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="campo"><label>Canal</label><select name="canal" defaultValue="whatsapp"><option value="whatsapp">WhatsApp</option><option value="email">Correo</option></select></div>
              <div className="campo"><label>Idioma</label><select name="idioma" defaultValue={destino.idioma_principal}>{destino.idiomas.map((i) => <option key={i} value={i}>{i}</option>)}</select></div>
            </div>
            <div className="campo"><label>Asunto (correo)</label><input name="asunto" /></div>
            <div className="campo"><label>Cuerpo</label><textarea name="cuerpo" required style={{ minHeight: 110 }} /></div>
            <BotonAccion>Guardar</BotonAccion>
          </form>
        </div>
      </div>
    </>
  );
}
