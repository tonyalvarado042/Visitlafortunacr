'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { mandarCorreoRapido, type Estado } from '../acciones';
import type { CorreoDeUnClic } from '@/lib/correo/respuestas';

const NADA: Estado = {};

/*
 * Contestarle a un lead de un solo clic.
 *
 * ⚠️ EL CORREO SE VE ENTERO ANTES DE APRETAR. No es un botón a ciegas: el
 * texto que está en pantalla es el que sale, armado por la MISMA función del
 * servidor que lo manda (`correosDeUnClic`). Por eso el formulario solo lleva
 * la clave de la plantilla, no el cuerpo: así no hay forma de que lo que se
 * lee y lo que se envía se separen.
 *
 * Y si uno no se puede mandar, en vez del botón sale el motivo.
 */
export function CorreosDeUnClic({
  id, para, nombre, problema, avisos, correos,
}: {
  id: string;
  para: string | null;
  nombre: string | null;
  problema: string | null;
  avisos: string[];
  correos: CorreoDeUnClic[];
}) {
  const router = useRouter();
  const [estado, accion, mandando] = useActionState(mandarCorreoRapido, NADA);

  /* El primero que SÍ se puede mandar es el que aparece abierto. */
  const primero = correos.find((c) => !c.porQueNo)?.clave ?? correos[0]?.clave ?? '';
  const [elegido, setElegido] = useState(primero);
  const correo = correos.find((c) => c.clave === elegido) ?? correos[0];

  useEffect(() => { if (estado.ok) router.refresh(); }, [estado, router]);

  if (!correos.length) return null;

  return (
    <div className="tarjeta">
      <h2>
        Contestarle ya <small>un clic · el texto que ves es el que sale</small>
      </h2>

      {problema && <div className="aviso mal" style={{ marginBottom: 12 }}>{problema}</div>}
      {avisos.map((a) => (
        <div key={a} className="aviso info" style={{ marginBottom: 12 }}>{a}</div>
      ))}

      {/* Las pestañas. Cambiar de una a otra no llama al servidor: los cuatro
          correos vienen ya armados desde la página. */}
      <div
        role="tablist"
        aria-label="Correos listos para mandar"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}
      >
        {correos.map((c) => {
          const activo = c.clave === elegido;
          return (
            <button
              key={c.clave}
              role="tab"
              type="button"
              aria-selected={activo}
              onClick={() => setElegido(c.clave)}
              title={c.cuando}
              style={{
                padding: '7px 13px',
                borderRadius: 999,
                /* Tinta, no verde: el unico acento de la tarjeta es el boton
                   de mandar. Dos acentos pelean y la vista no sabe adonde ir. */
                border: `1px solid ${activo ? '#2C2C28' : '#DCDCD6'}`,
                background: activo ? '#2C2C28' : '#FFF',
                color: activo ? '#FFF' : c.porQueNo ? '#A4A49E' : '#2C2C28',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: activo ? 600 : 500,
                cursor: 'pointer',
                transition: 'background .15s, border-color .15s, color .15s',
              }}
            >
              {/* Apagada se nota por el color; un signo delante se lee como
                  errata. El porque sale al elegirla. */}
              {c.titulo}
            </button>
          );
        })}
      </div>

      {correo && (
        <>
          <p className="gris" style={{ fontSize: 12.5, margin: '0 0 10px', color: '#8B8B87' }}>
            {correo.cuando}
          </p>

          {/* El sobre: a quién, con qué asunto, y el cuerpo tal cual sale. */}
          <div style={{ border: '1px solid #E6E6E1', borderRadius: 12, overflow: 'hidden', background: '#FFF' }}>
            <div style={{ padding: '11px 15px', borderBottom: '1px solid #EFEFEA', background: '#FAFAF7', fontSize: 13 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ color: '#9A9A94', minWidth: 52 }}>Para</span>
                <strong style={{ fontWeight: 600, wordBreak: 'break-all' }}>
                  {nombre ? `${nombre} · ` : ''}{para ?? '—'}
                </strong>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <span style={{ color: '#9A9A94', minWidth: 52 }}>Asunto</span>
                <strong style={{ fontWeight: 600 }}>{correo.asunto || <em className="gris">sin asunto</em>}</strong>
              </div>
            </div>
            <div style={{ padding: '15px 17px', whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.62, color: '#2C2C28' }}>
              {correo.cuerpo}
            </div>
          </div>

          <div className="pie-formulario" style={{ marginTop: 14, alignItems: 'center' }}>
            {/* ⚠️ Si no se puede mandar, NO se ofrece el botón: se dice por qué.
                Un botón que se aprieta y rebota cuesta más que uno ausente. */}
            {correo.porQueNo ? (
              <div className="aviso info" style={{ margin: 0 }}>{correo.porQueNo}</div>
            ) : problema ? null : (
              <form action={accion}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="clave" value={correo.clave} />
                <button type="submit" className="boton verde" disabled={mandando} style={{ fontSize: 14.5, padding: '11px 20px' }}>
                  {mandando ? 'Mandando…' : `Mandar este correo a ${para}`}
                </button>
              </form>
            )}
            {estado.error && <span className="aviso mal" style={{ margin: 0 }}>{estado.error}</span>}
            {estado.ok && <span className="aviso ok" style={{ margin: 0 }}>{estado.ok}</span>}
          </div>
        </>
      )}
    </div>
  );
}
