'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { navegador } from '@/lib/supabase-navegador';
import { anotarMiFoto, ponerMiPortada, quitarMiFoto } from '../acciones';
import { aWebp, nombreLimpio, TOPE_BYTES, ACEPTA } from '@/lib/foto-navegador';

export type Foto = { id: string; url: string; es_portada: boolean };

const MAX_FOTOS = 8;

export function Fotos({
  negocioId, destinoBabosa, negocioBabosa, fotos,
}: {
  negocioId: string;
  destinoBabosa: string;
  negocioBabosa: string;
  fotos: Foto[];
}) {
  /* La lista la manda el servidor y no se copia a un estado local: si se
     copiara, las fotos recién subidas no tendrían id de verdad y no se
     podrían ni borrar ni marcar de portada hasta recargar a mano. */
  const router = useRouter();
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  const quedan = MAX_FOTOS - fotos.length;

  async function elegidas(lista: FileList | null) {
    if (!lista?.length) return;
    setError(null);

    const archivos = Array.from(lista).slice(0, quedan);
    if (lista.length > quedan) {
      setError(`Solo caben ${quedan} más, así que subimos esas y las otras no.`);
    }

    const db = navegador();
    let subidas = 0;

    for (const [i, archivo] of archivos.entries()) {
      setSubiendo(`Subiendo ${i + 1} de ${archivos.length}…`);
      try {
        if (archivo.size > TOPE_BYTES) {
          throw new Error(`"${archivo.name}" pesa más de 10 MB. Esa sí está muy grande.`);
        }

        const webp = await aWebp(archivo);
        const ruta = `${destinoBabosa}/${negocioBabosa}/${nombreLimpio(archivo.name)}.webp`;

        const { error: eSubida } = await db.storage
          .from('negocios')
          .upload(ruta, webp, { contentType: 'image/webp' });
        if (eSubida) throw new Error(eSubida.message);

        const { data: publica } = db.storage.from('negocios').getPublicUrl(ruta);
        const resultado = await anotarMiFoto(negocioId, publica.publicUrl);
        if (resultado.error) throw new Error(resultado.error);
        subidas += 1;
      } catch (fallo) {
        setError(fallo instanceof Error ? fallo.message : 'No se pudo subir esa foto.');
        break;
      }
    }

    setSubiendo(null);
    if (campo.current) campo.current.value = '';
    // Trae la lista de nuevo del servidor, ya con los ids de verdad.
    if (subidas) router.refresh();
  }

  return (
    <section className="comercio-bloque">
      <h2>Fotos de tu negocio</h2>
      <p className="comercio-sub">
        Hasta {MAX_FOTOS}. La portada es la que sale en el directorio, y la
        cambiás cuando querrás. Subilas como están: las encogemos nosotros.
      </p>

      {fotos.length > 0 && (
        <div className="galeria-fotos">
          {fotos.map((f) => (
            <figure key={f.id} className={f.es_portada ? 'foto portada' : 'foto'}>
              {/* Es una url de Storage: next/image no aporta nada acá —la foto
                  ya viene encogida— y obligaría a configurar el dominio. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt="" loading="lazy" />
              {f.es_portada && <span className="marca-portada">Portada</span>}

              <figcaption>
                {!f.es_portada && (
                  <form action={ponerMiPortada}>
                    <input type="hidden" name="negocio_id" value={negocioId} />
                    <input type="hidden" name="foto_id" value={f.id} />
                    <button type="submit" className="enlace-flojo">Hacerla portada</button>
                  </form>
                )}
                <form action={quitarMiFoto}>
                  <input type="hidden" name="negocio_id" value={negocioId} />
                  <input type="hidden" name="foto_id" value={f.id} />
                  <button type="submit" className="enlace-flojo peligro">Borrar</button>
                </form>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {error && <p className="forma-error">{error}</p>}
      {subiendo && <p className="forma-ok">{subiendo}</p>}

      {quedan > 0 ? (
        <>
          <input
            ref={campo}
            type="file"
            accept={ACEPTA}
            multiple
            disabled={Boolean(subiendo)}
            onChange={(e) => elegidas(e.target.files)}
            className="campo-fotos"
          />
          <small className="comercio-dato">
            JPG, PNG, WebP o HEIC (el del iPhone). Te quedan {quedan}.
          </small>
        </>
      ) : (
        <p className="comercio-dato">Ya tenés las {MAX_FOTOS}. Borrá una si querés cambiarla.</p>
      )}
    </section>
  );
}
