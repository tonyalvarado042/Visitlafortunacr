'use client';

import { useRef, useState } from 'react';

/*
 * Un campo de imagen DE VERDAD: vista previa, botón de subir y la dirección.
 *
 * Existe por una regla de Tony, y la regla es correcta: un campo que pide una
 * imagen y solo acepta una dirección le pasa el trabajo al usuario —subir el
 * archivo a otra parte, copiar la url, pegarla—. Si pide una imagen, lleva su
 * botón.
 *
 * Sube con un `fetch` a /api/admin/imagen y NO con una acción de servidor. La
 * primera versión despachaba una acción desde el `onChange` de un campo que
 * vive dentro de OTRO formulario, y React se la tragaba sin decir nada: se
 * elegía el archivo y no pasaba absolutamente nada, ni un error. Una petición
 * normal se ve en la pestaña de red y falla a la vista.
 *
 * El campo de texto NO desaparece: sigue ahí para pegar una dirección que ya
 * exista y para ver qué se guardó. Lo que viaja al formulario de afuera es
 * siempre ese input.
 */
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
  const [url, setUrl] = useState(valor ?? '');
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const archivo = useRef<HTMLInputElement>(null);

  async function subir(f: File) {
    setError(null);
    setSubiendo(true);
    try {
      const datos = new FormData();
      datos.set('carpeta', carpeta);
      datos.set('archivo', f);
      const r = await fetch('/api/admin/imagen', { method: 'POST', body: datos });
      /* El cuerpo puede no ser JSON si algo se cayó antes de llegar a la
         ruta. Sin este try, el fallo real queda tapado por un error de
         parseo que no dice nada. */
      let cuerpo: { url?: string; error?: string } = {};
      try { cuerpo = await r.json(); } catch { /* se queda vacío */ }

      if (!r.ok || !cuerpo.url) {
        setError(cuerpo.error ?? `No se pudo subir (${r.status}).`);
        return;
      }
      setUrl(cuerpo.url);
      if (archivo.current) archivo.current.value = '';
    } catch {
      setError('No se pudo alcanzar el servidor.');
    } finally {
      setSubiendo(false);
    }
  }

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
                 onChange={(e) => { const f = e.currentTarget.files?.[0]; if (f) subir(f); }} />
          {subiendo && <span className="gris" style={{ fontSize: 12.5 }}>Subiendo…</span>}
          {error && <span style={{ fontSize: 12.5, color: '#B42318' }}>{error}</span>}
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
