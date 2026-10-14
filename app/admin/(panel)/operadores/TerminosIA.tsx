'use client';

import { useState, useTransition } from 'react';
import { analizarContrato, aprobarTermino } from './acciones';
import { BotonAccion } from '@/componentes/admin/BotonAccion';

/*
 * Lo que la IA leyó del contrato, para aprobar uno por uno.
 *
 * CADA TÉRMINO SE APRUEBA SOLO, y eso no es un capricho de diseño: lo que se
 * aprueba acá termina en el correo que recibe quien reserva. Un botón de
 * «aceptar todo» es firmar sin leer, y lo que se firma es una promesa
 * comercial a nombre del operador.
 *
 * Por eso al lado de cada propuesta va la CITA TEXTUAL del documento. Quien
 * aprueba compara la cita, no el resumen. Si la IA inventó algo, no hay cita.
 */

type Termino = { texto: string; cita: string } | null;
export type Terminos = {
  politica_cancelacion: Termino;
  condiciones_pago: Termino;
  que_llevar: Termino;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  razon_social: string | null;
  cedula_juridica: string | null;
  avisos: string[];
} | null;

const CAMPOS: { clave: 'politica_cancelacion' | 'condiciones_pago' | 'que_llevar'; rotulo: string }[] = [
  { clave: 'politica_cancelacion', rotulo: 'Política de cancelación' },
  { clave: 'condiciones_pago', rotulo: 'Condiciones de pago' },
  { clave: 'que_llevar', rotulo: 'Qué llevar' },
];

export function TerminosIA({
  contratoId, terminos, leidoEn, modelo, hayDocumento, puedeEditar, yaPuestos,
}: {
  contratoId: string;
  terminos: Terminos;
  leidoEn: string | null;
  modelo: string | null;
  hayDocumento: boolean;
  puedeEditar: boolean;
  /* Lo que YA está aprobado, para marcar cuál falta. */
  yaPuestos: Record<string, string | null>;
}) {
  const [corriendo, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function analizar() {
    setError(null);
    empezar(async () => {
      const r = await analizarContrato(contratoId);
      if (r.error) setError(r.error);
    });
  }

  return (
    <div className="terminos-ia">
      <h3 style={{ fontSize: 15, marginBottom: 2 }}>
        Términos para el viajero{' '}
        <small className="gris">salen en el correo de la reserva</small>
      </h3>
      <p className="gris" style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 0 }}>
        La IA lee el contrato y <strong>propone</strong>; vos aprobás uno por uno comparando
        contra la cita. Nada de esto le llega a un cliente hasta que lo aprobás: una política
        de cancelación inventada es una promesa que el operador nunca hizo.
      </p>

      {puedeEditar && (
        <p className="ver-online">
          <button type="button" className="boton tenue chico" onClick={analizar}
                  disabled={corriendo || !hayDocumento}>
            {corriendo ? 'Leyendo el contrato…' : 'Leer el contrato con IA'}
          </button>
          <span className="gris">
            {!hayDocumento
              ? 'Subí primero el contrato acá arriba: no hay documento que leer.'
              : leidoEn
                ? `Leído el ${new Date(leidoEn).toLocaleString('es-CR')}${modelo ? ` · ${modelo}` : ''}.`
                : 'Todavía no se ha leído.'}
          </span>
        </p>
      )}

      {error && <p className="forma-error" role="alert">{error}</p>}

      {terminos?.avisos?.length ? (
        <div className="terminos-avisos">
          <strong>Ojo con esto</strong>
          <ul>{terminos.avisos.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      ) : null}

      {CAMPOS.map(({ clave, rotulo }) => {
        const propuesto = terminos?.[clave] ?? null;
        const puesto = yaPuestos[clave];
        const igual = propuesto && puesto && propuesto.texto.trim() === puesto.trim();
        return (
          <div className="termino" key={clave}>
            <div className="termino-cabeza">
              <strong>{rotulo}</strong>
              {puesto
                ? <span className="termino-estado puesto">{igual ? 'aprobado' : 'puesto a mano'}</span>
                : <span className="termino-estado falta">sin poner</span>}
            </div>

            {puesto && <p className="termino-actual">{puesto}</p>}

            {propuesto && !igual && (
              <div className="termino-propuesta">
                <p>{propuesto.texto}</p>
                <blockquote>«{propuesto.cita}»</blockquote>
                {puedeEditar && (
                  <form action={aprobarTermino}>
                    <input type="hidden" name="id" value={contratoId} />
                    <input type="hidden" name="campo" value={clave} />
                    <input type="hidden" name="valor" value={propuesto.texto} />
                    <BotonAccion clase="boton chico">
                      {puesto ? 'Reemplazar con esto' : 'Usar esto'}
                    </BotonAccion>
                  </form>
                )}
              </div>
            )}

            {!propuesto && terminos && (
              <p className="gris" style={{ fontSize: 12.5, margin: '4px 0 0' }}>
                La IA no encontró esto en el documento. <strong>Eso es correcto si el contrato
                no lo dice</strong> — escribilo a mano arriba, o pedíselo al operador.
              </p>
            )}
          </div>
        );
      })}

      {terminos && (terminos.razon_social || terminos.cedula_juridica
        || terminos.vigencia_desde || terminos.vigencia_hasta) && (
        <div className="termino">
          <div className="termino-cabeza"><strong>Datos duros que vio</strong></div>
          <p className="gris" style={{ fontSize: 12.5, margin: '2px 0 6px' }}>
            Para comparar con lo que ya está cargado. No se copian solos.
          </p>
          <ul className="termino-datos">
            {terminos.razon_social && <li>Razón social: <strong>{terminos.razon_social}</strong></li>}
            {terminos.cedula_juridica && <li>Cédula jurídica: <strong>{terminos.cedula_juridica}</strong></li>}
            {terminos.vigencia_desde && <li>Vigencia desde: <strong>{terminos.vigencia_desde}</strong></li>}
            {terminos.vigencia_hasta && <li>Vigencia hasta: <strong>{terminos.vigencia_hasta}</strong></li>}
          </ul>
        </div>
      )}
    </div>
  );
}
