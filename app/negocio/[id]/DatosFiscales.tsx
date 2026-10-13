'use client';

import { useActionState, useState } from 'react';
import type { MisDatosFiscales } from '@/lib/comercio';
import { cedulaConForma } from '@/lib/cedula';
import { guardarMisDatosFiscales, type EstadoComercio } from '../acciones';

const NADA: EstadoComercio = {};

/*
 * Los datos legales del negocio.
 *
 * Van en su propia tarjeta y no mezclados con el teléfono y la dirección: son
 * de otra naturaleza —no se muestran en el sitio, los usa el equipo para
 * facturar y contratar— y conviene que quien los llena entienda eso de una.
 *
 * El NOMBRE COMERCIAL sale acá para que se vean los cuatro datos juntos, pero
 * no es un campo de esta tarjeta: es el nombre de la ficha, se cambia arriba.
 * Tenerlo editable en dos lugares termina en dos nombres distintos.
 */

const TIPOS = [
  { valor: '',           texto: 'Elegí uno…',                      ayuda: '' },
  { valor: 'fisica',     texto: 'Cédula física',                   ayuda: 'A nombre de una persona. 9 dígitos: 1-0234-0567.' },
  { valor: 'dimex',      texto: 'DIMEX (residente extranjero)',    ayuda: '11 o 12 dígitos.' },
  { valor: 'juridica',   texto: 'Cédula jurídica (S.A., S.R.L.)',  ayuda: '10 dígitos y empieza con 3: 3-101-118638.' },
  { valor: 'asociacion', texto: 'Asociación o fundación',          ayuda: 'También es jurídica: 10 dígitos, empieza con 3.' },
];

export function DatosFiscales({
  negocioId, nombreComercial, datos,
}: {
  negocioId: string;
  nombreComercial: string;
  datos: MisDatosFiscales | null;
}) {
  const [estado, accion, pendiente] = useActionState(guardarMisDatosFiscales, NADA);
  /* Lo que vale es lo que devolvió la acción; las propiedades son el respaldo
     para el primer pintado. Sin esto, al guardar el formulario mostraba los
     datos ANTERIORES —cédula jurídica guardada, select diciendo «física»— y
     parecía que no había servido de nada. */
  const actual = (estado.guardados as MisDatosFiscales | null | undefined) ?? datos;

  const [tipo, setTipo] = useState(actual?.tipo_cedula ?? '');
  const [patente, setPatente] = useState(
    actual?.tiene_patente == null ? '' : actual.tiene_patente ? '1' : '0',
  );
  /* Y los rótulos siguen a lo guardado cuando llega algo nuevo del servidor. */
  const [visto, setVisto] = useState('');
  const llaveActual = `${actual?.tipo_cedula ?? ''}|${actual?.tiene_patente ?? ''}`;
  if (visto !== llaveActual) {
    setVisto(llaveActual);
    setTipo(actual?.tipo_cedula ?? '');
    setPatente(actual?.tiene_patente == null ? '' : actual.tiene_patente ? '1' : '0');
  }

  /* Una llave que cambia cuando cambia lo guardado: obliga a los campos a
     volver a nacer con el valor nuevo. Sin ella, `defaultValue` se queda con
     el del primer montaje. */
  const llave = `${actual?.tipo_cedula ?? ''}|${actual?.cedula ?? ''}|${actual?.tiene_patente ?? ''}`;

  const esPersona = tipo === 'fisica' || tipo === 'dimex';
  const ayuda = TIPOS.find((t) => t.valor === tipo)?.ayuda ?? '';

  return (
    <form action={accion} className="forma comercio-forma comercio-bloque">
      <input type="hidden" name="negocio_id" value={negocioId} />

      <h2>Datos de la empresa</h2>
      <p className="forma-nota">
        Esto <strong>no sale en el sitio</strong>. Lo necesitamos para la factura
        y el contrato, y lo ve solo el equipo.
      </p>

      {/* El nombre comercial, a la vista pero no editable acá. */}
      <label>
        <span>Nombre comercial</span>
        <input type="text" value={nombreComercial} readOnly disabled />
        <small>Es el nombre de tu ficha. Si querés cambiarlo, se hace arriba.</small>
      </label>

      <label>
        <span>¿Con qué cédula factura? *</span>
        <select key={llave} name="tipo_cedula" required defaultValue={actual?.tipo_cedula ?? ''}
                onChange={(e) => setTipo(e.target.value as typeof tipo)}>
          {TIPOS.map((t) => (
            <option key={t.valor} value={t.valor} disabled={t.valor === ''}>{t.texto}</option>
          ))}
        </select>
        {ayuda && <small>{ayuda}</small>}
      </label>

      <label>
        <span>Número de cédula *</span>
        <input key={llave} name="cedula" type="text" required inputMode="numeric" maxLength={20}
               defaultValue={cedulaConForma(actual?.cedula ?? null, actual?.tipo_cedula ?? null)} />
        <small>Con guiones o sin guiones, como te sea más cómodo.</small>
      </label>

      <label>
        <span>{esPersona ? 'Nombre completo del titular' : 'Razón social'}</span>
        <input key={llave} name="razon_social" type="text" maxLength={160}
               defaultValue={actual?.razon_social ?? ''}
               placeholder={esPersona ? 'Como aparece en la cédula' : 'Como aparece en la personería'} />
        <small>
          {esPersona
            ? 'El nombre de la persona dueña de esa cédula.'
            : 'El nombre legal de la sociedad, que casi nunca es el comercial.'}
        </small>
      </label>

      <label>
        <span>¿Tiene patente comercial?</span>
        <select key={llave} name="tiene_patente" defaultValue={patente}
                onChange={(e) => setPatente(e.target.value)}>
          <option value="">Prefiero no decirlo todavía</option>
          <option value="1">Sí, al día</option>
          <option value="0">Todavía no</option>
        </select>
        <small>La licencia de la municipalidad. No tenerla no te saca del directorio.</small>
      </label>

      {patente === '1' && (
        <label>
          <span>Número de patente</span>
          <input key={llave} name="patente_numero" type="text" maxLength={60}
                 defaultValue={actual?.patente_numero ?? ''} />
        </label>
      )}

      {estado.error && <p className="forma-error" role="alert">{estado.error}</p>}
      {estado.ok && <p className="forma-ok" role="status">{estado.ok}</p>}

      <button className="boton" type="submit" disabled={pendiente}>
        {pendiente ? 'Guardando…' : 'Guardar los datos de la empresa'}
      </button>
    </form>
  );
}
