'use client';

import { useRef, useState } from 'react';
import { aWebp, ACEPTA } from '@/lib/foto-navegador';
import { LIMITE_ACCION_BYTES, enMegas } from '@/lib/limites';

/*
 * El campo para elegir fotos en el PANEL, que las encoge antes de mandarlas.
 *
 * ⚠️ NO ES UNA OPTIMIZACIÓN. ES EL ARREGLO DE UN BUG QUE ROMPÍA LA PANTALLA.
 *
 * Tony, 10 de noviembre de 2026, primera foto de Bike & Bed: la pantalla
 * entera se cambió por «Algo se rompió — An unexpected response was received
 * from the server», con un «Reintentar» que reintentaba lo mismo. La acción de
 * servidor tiene un tope de cuerpo de 1 MB por omisión y el servidor CANCELA
 * la petición antes de que la acción corra: sin log, sin error de Supabase,
 * sin nada que mirar. Ver `lib/limites.ts`, que cuenta el hallazgo entero.
 *
 * ⚠️ Y LO MÁS FEO DEL ASUNTO: ESTO YA ESTABA RESUELTO EN LA CASA.
 * `lib/foto-navegador.ts` existe desde antes y hace exactamente esto —encoge
 * a 1600 px webp y, si el navegador no sabe leer el archivo, lo manda a
 * `/api/foto/webp` donde sharp sí lo lee—. Lo usan las dos pantallas del
 * PORTAL DEL DUEÑO. Al panel nunca se le puso, así que el dueño de un negocio
 * podía subir fotos desde su teléfono y Tony, desde el panel, no.
 *
 * Por eso este archivo no trae su propio encogedor: llama al que ya hay. Una
 * tercera copia de «1600 px, calidad 82» es la forma garantizada de que el día
 * que se cambie el número, una de las tres se quede atrás.
 *
 * Lo que sí es nuevo acá, y el portal no necesita, es la TANDA: el panel sube
 * varias de un saque y el tope es sobre el cuerpo entero, no por foto. Ocho
 * fotos de 200 KB también se pasaban del megabyte. Por eso se suma y, si aun
 * así no entra, EL BOTÓN SE APAGA Y SE DICE POR QUÉ, antes de mandar: lo que
 * se sabe de antemano que va a rebotar no se ofrece.
 *
 * Y heredamos HEIC de regalo: el panel aceptaba `jpeg,png,webp,avif` y un
 * iPhone fotografía en HEIC, así que sus fotos ni siquiera se podían elegir.
 */

type Estado =
  | { fase: 'quieto' }
  | { fase: 'trabajando'; hecha: number; total: number }
  | { fase: 'listo'; cuantas: number; antes: number; despues: number; rotas: string[] };

export function ElegirFotos({ nombre = 'archivo' }: { nombre?: string }) {
  const campo = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<Estado>({ fase: 'quieto' });

  /* Mientras se encoge, el botón de enviar se apaga: si no, se puede mandar
     el formulario a mitad del trabajo y viaja una tanda a medio hacer. */
  function botones(encendidos: boolean) {
    campo.current?.form
      ?.querySelectorAll<HTMLButtonElement>('button[type="submit"]')
      .forEach((b) => { b.disabled = !encendidos; });
  }

  async function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const elegidas = Array.from(e.currentTarget.files ?? []);
    if (!elegidas.length) { setEstado({ fase: 'quieto' }); botones(true); return; }

    /* Sin DataTransfer no se puede reemplazar lo que lleva el campo, así que no
       se toca nada: viajan los originales y los 12 MB del tope las amparan. */
    if (typeof DataTransfer === 'undefined') { setEstado({ fase: 'quieto' }); return; }

    botones(false);
    setEstado({ fase: 'trabajando', hecha: 0, total: elegidas.length });

    const salida: File[] = [];
    const rotas: string[] = [];
    let antes = 0;
    let despues = 0;

    for (const [i, foto] of elegidas.entries()) {
      antes += foto.size;
      try {
        const chica = await aWebp(foto);
        /* Una foto ya optimizada puede salir más pesada al reconvertirla; en
           ese caso se queda la original. El objetivo es que pese menos, no
           que sea webp. */
        if (chica.size < foto.size) {
          const base = foto.name.replace(/\.[^.]+$/, '') || 'foto';
          salida.push(new File([chica], `${base}.webp`, { type: 'image/webp' }));
          despues += chica.size;
        } else {
          salida.push(foto);
          despues += foto.size;
        }
      } catch {
        /* Ni el navegador ni el servidor pudieron leerla. No se manda: el
           server action la iba a tirar igual, y así se dice cuál fue. */
        rotas.push(foto.name);
      }
      setEstado({ fase: 'trabajando', hecha: i + 1, total: elegidas.length });
    }

    const bolsa = new DataTransfer();
    salida.forEach((f) => bolsa.items.add(f));
    if (campo.current) campo.current.files = bolsa.files;

    setEstado({ fase: 'listo', cuantas: salida.length, antes, despues, rotas });
    botones(salida.length > 0 && despues <= LIMITE_ACCION_BYTES);
  }

  const pasada = estado.fase === 'listo' && estado.despues > LIMITE_ACCION_BYTES;
  const ninguna = estado.fase === 'listo' && estado.cuantas === 0;

  return (
    <div className="campo">
      <label htmlFor="fotos-nuevas">
        Agregar fotos{' '}
        <small style={{ fontWeight: 400, color: '#8B8B87' }}>podés elegir varias de un solo</small>
      </label>
      <input
        ref={campo}
        id="fotos-nuevas"
        type="file"
        name={nombre}
        /* El `accept` sale de `lib/foto-navegador.ts` para que el panel acepte
           lo mismo que el portal del dueño. `avif` se suma porque el panel ya
           lo aceptaba y nadie gana nada con quitárselo. */
        accept={`${ACEPTA},image/avif`}
        multiple
        required
        onChange={alElegir}
      />

      {estado.fase === 'trabajando' && (
        <small style={{ display: 'block', marginTop: 6, color: '#8B8B87' }}>
          Preparando {estado.hecha} de {estado.total}…
        </small>
      )}

      {estado.fase === 'listo' && !pasada && !ninguna && (
        <small style={{ display: 'block', marginTop: 6, color: '#2E7D32' }}>
          {estado.cuantas === 1 ? 'Lista 1 foto' : `Listas ${estado.cuantas} fotos`}
          {estado.despues < estado.antes && (
            <> · {enMegas(estado.antes)} → <strong>{enMegas(estado.despues)}</strong></>
          )}
        </small>
      )}

      {estado.fase === 'listo' && estado.rotas.length > 0 && (
        <small style={{ display: 'block', marginTop: 6, color: '#B42318' }}>
          No se pudo leer {estado.rotas.length === 1 ? 'esta' : 'estas'}:{' '}
          {estado.rotas.join(', ')}. {ninguna ? 'Elegí otras.' : 'Las demás sí van.'}
        </small>
      )}

      {pasada && (
        <small style={{ display: 'block', marginTop: 6, color: '#B42318' }}>
          <strong>Son demasiadas de un saque:</strong> {enMegas(estado.despues)} y el máximo
          es {enMegas(LIMITE_ACCION_BYTES)}. Subilas en dos tandas.
        </small>
      )}
    </div>
  );
}
