'use client';

import { useRef, useState } from 'react';
import { navegador } from '@/lib/supabase-navegador';
import { aWebp, nombreLimpio, TOPE_BYTES, ACEPTA } from '@/lib/foto-navegador';

/*
 * La foto de la tour: un botón, no un campo de texto.
 *
 * REGLA DE LA CASA: ningún campo de foto se deja como una caja donde pegar una
 * URL. Nadie tiene a mano la dirección de una imagen; lo que tiene a mano es
 * la foto en el teléfono. El `<input type="url">` quedó de respaldo y escondido
 * para quien ya tenga la foto publicada en otro lado.
 *
 * Lo que viaja al formulario es el campo oculto `imagen_url`. La base además
 * exige que la URL sea del almacén del sitio: una foto de un servidor ajeno se
 * cae el día que el otro la borra y deja la ficha con un hueco.
 */
export function FotoTour({
  destinoBabosa, negocioBabosa, valor,
}: {
  destinoBabosa: string;
  negocioBabosa: string;
  valor: string | null;
}) {
  const [url, setUrl] = useState(valor ?? '');
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  async function elegida(lista: FileList | null) {
    const archivo = lista?.[0];
    if (!archivo) return;
    setError(null);
    setSubiendo(true);

    try {
      if (archivo.size > TOPE_BYTES) {
        throw new Error(`"${archivo.name}" pesa más de 10 MB. Esa sí está muy grande.`);
      }
      const webp = await aWebp(archivo);
      const ruta = `${destinoBabosa}/${negocioBabosa}/tours/${nombreLimpio(archivo.name)}.webp`;

      const db = navegador();
      const { error: eSubida } = await db.storage
        .from('negocios')
        .upload(ruta, webp, { contentType: 'image/webp' });
      if (eSubida) throw new Error(eSubida.message);

      const { data: publica } = db.storage.from('negocios').getPublicUrl(ruta);
      setUrl(publica.publicUrl);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo subir esa foto.');
    } finally {
      setSubiendo(false);
      if (campo.current) campo.current.value = '';
    }
  }

  return (
    <div className="foto-tour">
      {/* Lo que de verdad se guarda. */}
      <input type="hidden" name="imagen_url" value={url} />

      <div className="foto-tour-caja">
        {url
          ? <img src={url} alt="" />
          : <span>Todavía sin foto</span>}
      </div>

      <div className="foto-tour-botones">
        <label className="boton tenue">
          {subiendo ? 'Subiendo…' : url ? 'Cambiar la foto' : 'Subir una foto'}
          <input ref={campo} type="file" accept={ACEPTA} disabled={subiendo}
                 onChange={(e) => elegida(e.target.files)} hidden />
        </label>
        {url && !subiendo && (
          <button type="button" className="boton tenue" onClick={() => setUrl('')}>
            Quitarla
          </button>
        )}
      </div>

      {error && <p className="forma-error" role="alert">{error}</p>}
      <small>
        La que mejor muestre la experiencia. Se achica sola antes de subir, así
        que no importa si viene pesada del teléfono.
      </small>
    </div>
  );
}
