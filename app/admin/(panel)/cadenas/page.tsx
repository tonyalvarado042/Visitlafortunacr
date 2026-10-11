import { contextoPanel } from '@/lib/admin/contexto';
import { Aviso, Cabecera, Etiqueta, Vacio } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { cambiarCadena, guardarPaso } from './acciones';
import { Pruebas } from './Pruebas';

export const dynamic = 'force-dynamic';

type Paso = {
  id: string; orden: number; dias_desde_alta: number;
  asunto_es: string; cuerpo_es: string;
  asunto_en: string | null; cuerpo_en: string | null;
  boton_texto_es: string | null; boton_texto_en: string | null;
  boton_ruta: string | null; esta_activo: boolean;
};

type Cadena = {
  id: string; clave: string; nombre: string; descripcion: string | null;
  publico: string; esta_activa: boolean;
  pasos: Paso[];
};

const DE_DONDE: Record<string, string> = {
  sorteo: 'Entra cuando alguien se apunta a la rifa.',
  contacto_negocio: 'Entra cuando alguien pide los datos de un negocio.',
  comerciante_gratis: 'Entra el dueño de un negocio que sigue en el plan gratis.',
};

export default async function PaginaCadenas() {
  const { destino, db, usuario } = await contextoPanel('cadenas');
  const esAdmin = usuario.rol === 'admin';

  const { data } = await db
    .from('dst_cadena')
    .select('*, pasos:dst_cadena_paso(*)')
    .eq('destino_id', destino.id)
    .order('clave');

  const cadenas = ((data ?? []) as Cadena[]).map((c) => ({
    ...c, pasos: [...(c.pasos ?? [])].sort((a, b) => a.orden - b.orden),
  }));

  const { data: inscritos } = await db
    .from('dst_cadena_inscrito')
    .select('cadena_id, paso_actual, salio_por, salio_en')
    .in('cadena_id', cadenas.map((c) => c.id).concat('00000000-0000-0000-0000-000000000000'));

  const cuenta = (id: string, dentro: boolean) =>
    (inscritos ?? []).filter((i) => i.cadena_id === id && (dentro ? !i.salio_en : !!i.salio_en)).length;

  return (
    <>
      <Cabecera
        titulo="Cadenas"
        sub={`${cadenas.length} cadenas · ${(inscritos ?? []).filter((i) => !i.salio_en).length} personas adentro`}
      />

      {!esAdmin && <Aviso tipo="info">Solo un administrador puede tocar las cadenas.</Aviso>}

      <Aviso tipo="info">
        Los días de cada paso se cuentan <strong>desde que la persona entró</strong>,
        no desde el correo anterior. Una cadena escrita +2 +7 +15 tarda quince días
        en total, no veinticuatro.
      </Aviso>

      {esAdmin && <Pruebas />}

      {!cadenas.length ? <Vacio texto="No hay cadenas." /> : cadenas.map((c) => (
        <div className="tarjeta" key={c.id}>
          <h2>
            {c.nombre}{' '}
            <small>
              {c.pasos.length} correos · {cuenta(c.id, true)} adentro · {cuenta(c.id, false)} salieron
            </small>
          </h2>
          <p className="gris" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 0 }}>
            {DE_DONDE[c.publico]} {c.descripcion}
          </p>

          <form action={cambiarCadena} style={{ marginBottom: 16 }}>
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="activa" value={c.esta_activa ? '0' : '1'} />
            <Etiqueta color={c.esta_activa ? '#66BB2E' : '#9CA3AF'}>
              {c.esta_activa ? 'encendida' : 'apagada'}
            </Etiqueta>
            {esAdmin && (
              <BotonAccion clase={c.esta_activa ? 'boton peligro chico' : 'boton chico'}>
                {c.esta_activa ? 'Apagar' : 'Encender'}
              </BotonAccion>
            )}
          </form>

          {c.pasos.map((p) => (
            <details key={p.id} style={{ borderTop: '1px solid #E6E6E2', padding: '10px 0' }}>
              <summary style={{ cursor: 'pointer', fontSize: 14 }}>
                <strong>+{p.dias_desde_alta} días</strong> · {p.asunto_es}
                {!p.esta_activo && ' · (apagado)'}
              </summary>

              <form action={guardarPaso} className="campos" style={{ marginTop: 12 }}>
                <input type="hidden" name="id" value={p.id} />
                <div className="campo"><label>Días desde que entró</label>
                  <input name="dias_desde_alta" type="number" min={0} max={365}
                         defaultValue={p.dias_desde_alta} disabled={!esAdmin} /></div>
                <div className="campo"><label>
                  <input type="checkbox" name="esta_activo" value="1"
                         defaultChecked={p.esta_activo} disabled={!esAdmin} /> Paso encendido</label></div>

                <div className="campo ancho"><label>Asunto (español)</label>
                  <input name="asunto_es" defaultValue={p.asunto_es} disabled={!esAdmin} /></div>
                <div className="campo ancho"><label>Cuerpo (español) <small>una línea en blanco separa párrafos</small></label>
                  <textarea name="cuerpo_es" rows={7} defaultValue={p.cuerpo_es} disabled={!esAdmin} /></div>

                <div className="campo ancho"><label>Asunto (inglés)</label>
                  <input name="asunto_en" defaultValue={p.asunto_en ?? ''} disabled={!esAdmin} /></div>
                <div className="campo ancho"><label>Cuerpo (inglés)</label>
                  <textarea name="cuerpo_en" rows={7} defaultValue={p.cuerpo_en ?? ''} disabled={!esAdmin} />
                  <small>Si queda vacío, quien tenga el sitio en inglés recibe el español.</small></div>

                <div className="campo"><label>Texto del botón (es)</label>
                  <input name="boton_texto_es" defaultValue={p.boton_texto_es ?? ''} disabled={!esAdmin} /></div>
                <div className="campo"><label>Texto del botón (en)</label>
                  <input name="boton_texto_en" defaultValue={p.boton_texto_en ?? ''} disabled={!esAdmin} /></div>
                <div className="campo ancho"><label>Adónde lleva el botón</label>
                  <input name="boton_ruta" defaultValue={p.boton_ruta ?? ''} placeholder="/experiencias" disabled={!esAdmin} />
                  <small>Ruta del sitio, sin dominio ni idioma. Vacío = la portada.</small></div>

                {esAdmin && <BotonAccion>Guardar el paso</BotonAccion>}
              </form>
            </details>
          ))}
        </div>
      ))}
    </>
  );
}
