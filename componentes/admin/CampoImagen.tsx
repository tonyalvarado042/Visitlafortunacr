'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { subirImagen, type ResultadoSubida } from '@/lib/admin/subir-imagen';

/*
 * Un campo de imagen DE VERDAD: vista previa, botón de subir y la dirección.
 *
 * Existe por una regla de Tony, y la regla es correcta: un campo que pide una
 * imagen y solo acepta una dirección le pasa el trabajo al usuario —subir el
 * archivo a otra parte, copiar la url, pegarla—. Si pide una imagen, lleva su
 * botón.
 *
 * El campo de texto NO desaparece: sigue ahí, de solo lectura mientras no se
 * toque, para poder pegar una dirección que ya exista y para ver qué se
 * guardó. Lo que se envía al formulario de afuera es siempre este input, se
 * haya llenado subiendo o pegando.
 *
 * Sube por su cuenta, sin enviar el formulario grande: se sube la foto, vuelve
 * la dirección, y el formulario grande se guarda cuando la persona quiera.
 */

const vacio: ResultadoSubida = {};

export function CampoImagen({
  nombre, etiqueta, valor, carpeta, ayuda, desactivado,
}: {
  nombre: string;
  etiqueta: string;
  valor: string | null;
  carpeta: 'rifa' | 'marca' | 'portadas' | 'experiencias' | 'guias';
  ayuda?: string;
  desactivado?: boolean;
}) {
  const [estado, subir, subiendo] = useActionState(subirImagen, vacio);
  const [url, setUrl] = useState(valor ?? '');
  const archivo = useRef<HTMLInputElement>(null);

  /* Cuando vuelve del servidor con una dirección, se escribe en el campo. Es
     lo único que el formulario de afuera va a mandar. */
  useEffect(() => {
    if (estado.url) {
      setUrl(estado.url);
      if (archivo.current) archivo.current.value = '';
    }
  }, [estado.url]);

  return (
    <div className="campo ancho campo-imagen">
      <label htmlFor={`ci-${nombre}`}>{etiqueta}</label>

      <div className="campo-imagen-caja">
        {url
          /* eslint-disable-next-line @next/next/no-img-element */
          ? <img src={url} alt="" className="campo-imagen-vista" />
          : <span className="campo-imagen-vacia" aria-hidden="true">sin imagen</span>}

        <div className="campo-imagen-acciones">
          <input ref={archivo} type="file" id={`ci-${nombre}`}
                 accept="image/jpeg,image/png,image/webp,image/avif"
                 disabled={desactivado || subiendo}
                 /* Sube apenas se elige el archivo: un segundo botón "ahora sí
                    subila" es un paso que nadie entiende para qué está. */
                 onChange={(e) => {
                   const f = e.currentTarget.files?.[0];
                   if (!f) return;
                   const datos = new FormData();
                   datos.set('carpeta', carpeta);
                   datos.set('archivo', f);
                   subir(datos);
                 }} />
          {subiendo && <span className="gris" style={{ fontSize: 12.5 }}>Subiendo…</span>}
          {estado.error && <span style={{ fontSize: 12.5, color: '#B42318' }}>{estado.error}</span>}
          {url && !subiendo && !desactivado && (
            <button type="button" className="boton chico tenue" onClick={() => setUrl('')}>
              Quitar
            </button>
          )}
        </div>
      </div>

      {/* La dirección, siempre visible: para pegar una que ya exista y para
          ver qué quedó guardado. Es el campo que viaja al formulario. */}
      <input id={`ci-url-${nombre}`} name={nombre} value={url} disabled={desactivado}
             onChange={(e) => setUrl(e.target.value)}
             placeholder="…o pegá una dirección" />
      {ayuda && <small>{ayuda}</small>}
    </div>
  );
}
