'use client';

import { useState } from 'react';
import type { OpcionDeTour } from '@/lib/destino';
import { t, type Idioma } from '@/lib/idiomas';

/*
 * El selector de opciones de una tour, con el desglose del impuesto debajo.
 *
 * ⚠️ POR QUÉ ESTO EXISTE: el catálogo de Outback no cabe en un campo.
 * El jet ski doble no cuesta $119 × 2 = $238; cuesta $139, porque son dos
 * personas en el MISMO jet ski. Antes eso vivía en `precio_nota`, seis líneas
 * de letra chica debajo de un $119 en grande. Quien no las leía, se enteraba
 * al final.
 *
 * ⚠️ ES UN COMPONENTE DE CLIENTE y no un truco de CSS con `:checked`, que es
 * como está hecho el visor de fotos. La diferencia: el visor solo muestra y
 * esconde, acá hay que CALCULAR —subtotal, impuesto, total— y la cuenta cambia
 * con cada opción. Hacerlo en CSS obligaría a pintar las tres cifras de cada
 * opción escondidas, y el día que alguien agregue una opción y se olvide de
 * una cifra, la ficha muestra un total en blanco sin decir nada.
 * React lo pinta igual en el servidor, así que el primer estado se ve sin
 * esperar a que hidrate.
 *
 * El «desde» de la cabecera es LA MÁS BARATA, calculada. Ver la nota de
 * `opcionesDeTour` en lib/destino.ts.
 */

const COMO_SE_COBRA = {
  por_persona: 'opcion_por_persona',
  por_vehiculo: 'opcion_por_vehiculo',
  por_reserva: 'opcion_por_reserva',
} as const;

/** $109 cuando es redondo, $109.50 cuando no. Nadie escribe «$109.00». */
function plata(n: number): string {
  return `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

/**
 * «de 2 a 6 personas», «hasta 6 personas», «desde 2 personas».
 *
 * Es la pregunta que llega antes de reservar un privado —«¿me lo hacen si
 * vamos dos?»— y la respuesta estaba en un correo, no en la ficha. Sale solo
 * en lo que se cobra por vehículo o por reserva: en «por persona» decir «hasta
 * 1 persona» no informa nada.
 */
function cuantosCaben(min: number | null, max: number | null): string | null {
  if (min && max && min !== max) return `de ${min} a ${max} personas`;
  if (min && max && min === max) return `${max} personas`;
  if (max) return `hasta ${max} personas`;
  if (min) return `desde ${min} personas`;
  return null;
}

export function OpcionesDeTour({
  opciones, idioma, ivaPct, incluyeIva,
}: {
  opciones: OpcionDeTour[];
  idioma: Idioma;
  ivaPct: number;
  /* Si el precio cargado YA trae el impuesto. En `true` no hay desglose: el
     precio ES el total, y sumarle un 13% encima sería cobrar de más. */
  incluyeIva: boolean;
}) {
  const [elegida, setElegida] = useState(() => {
    /* Arranca en la más barata, que es la misma que da el «desde» de arriba.
       Arrancar en la primera de la lista haría que el total de entrada no
       cuadrara con el precio grande. */
    const barata = opciones.reduce((a, b) =>
      Number(b.precio_rack_usd) < Number(a.precio_rack_usd) ? b : a);
    return barata.id;
  });

  const opcion = opciones.find((o) => o.id === elegida) ?? opciones[0];
  const base = Number(opcion.precio_rack_usd);
  const impuesto = incluyeIva ? 0 : base * (ivaPct / 100);
  const total = base + impuesto;

  return (
    <div className="tour-opciones">
      <fieldset className="opciones-lista">
        <legend>{t('opcion_elegi', idioma)}</legend>
        {opciones.map((o) => {
          const activa = o.id === elegida;
          return (
            <label key={o.id} className={`opcion-fila${activa ? ' activa' : ''}`}>
              <input
                type="radio"
                name="opcion-de-tour"
                value={o.id}
                checked={activa}
                onChange={() => setElegida(o.id)}
              />
              <span className="opcion-texto">
                <strong>{o.nombre}</strong>
                {o.que_cubre && <small>{o.que_cubre}</small>}
                {/* El cupo, solo donde significa algo: lo que se cobra por
                    vehículo o por la reserva entera. */}
                {o.cobro !== 'por_persona' && cuantosCaben(o.personas_min, o.personas) && (
                  <small className="opcion-cupo">{cuantosCaben(o.personas_min, o.personas)}</small>
                )}
              </span>
              <span className="opcion-plata">
                <strong>{plata(Number(o.precio_rack_usd))}</strong>
                <small>{t(COMO_SE_COBRA[o.cobro], idioma)}</small>
              </span>
            </label>
          );
        })}
      </fieldset>

      {/* El desglose. Si el precio ya trae el impuesto, acá solo va el total:
          inventar una línea de «IVA incluido» con una cifra calculada hacia
          atrás es decirle al viajero un número que el operador nunca dio. */}
      <dl className="opciones-cuenta">
        {!incluyeIva && (
          <>
            <div>
              <dt>{t('precio_subtotal', idioma)}</dt>
              <dd>{plata(base)}</dd>
            </div>
            <div>
              <dt>{t('precio_iva', idioma)} {ivaPct}%</dt>
              <dd>{plata(Number(impuesto.toFixed(2)))}</dd>
            </div>
          </>
        )}
        <div className="cuenta-total">
          <dt>{t('precio_total', idioma)}</dt>
          <dd>{plata(Number(total.toFixed(2)))}</dd>
        </div>
      </dl>
    </div>
  );
}
