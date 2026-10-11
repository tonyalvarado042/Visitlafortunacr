'use client';

import { useActionState } from 'react';
import { verQueSaldria, mandarAhora, type Estado } from './acciones';

/*
 * Los dos botones que Tony pidió para el CRM y que acá valen igual: ver qué
 * saldría sin mandar nada, y mandar ahora sin esperar al reloj.
 *
 * El de "ver" llama al mismo recorrido que el cron, solo que sin enviar. Si
 * mirara otra consulta que el envío, no probaría nada.
 */

const vacio: Estado = {};

export function Pruebas() {
  const [prueba, verAccion, viendo] = useActionState(verQueSaldria, vacio);
  const [envio, mandarAccion, mandando] = useActionState(mandarAhora, vacio);
  const estado = envio.ok || envio.error ? envio : prueba;

  return (
    <div className="tarjeta">
      <h2>Probar <small>antes de que salga nada</small></h2>
      <p className="gris" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 0 }}>
        El reloj corre cada hora por su cuenta. Estos dos botones son para
        mirar: el primero <strong>no manda nada</strong>, solo dice a quién le
        tocaría y qué recibiría.
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <form action={verAccion}>
          <button className="boton secundario" type="submit" disabled={viendo}>
            {viendo ? 'Mirando…' : 'Ver qué saldría'}
          </button>
        </form>
        <form action={mandarAccion}>
          <button className="boton" type="submit" disabled={mandando}>
            {mandando ? 'Mandando…' : 'Mandar ahora, de verdad'}
          </button>
        </form>
      </div>

      {estado.error && (
        <p style={{ marginTop: 14, color: '#B42318', fontSize: 13.5 }}>{estado.error}</p>
      )}
      {estado.ok && (
        <pre style={{
          marginTop: 14, padding: 12, background: '#F6F6F2', borderRadius: 8,
          fontSize: 12.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, monospace',
        }}>{estado.ok}</pre>
      )}
    </div>
  );
}
