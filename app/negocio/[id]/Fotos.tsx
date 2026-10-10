'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { navegador } from '@/lib/supabase-navegador';
import { anotarMiFoto, ponerMiPortada, quitarMiFoto } from '../acciones';

export type Foto = { id: string; url: string; es_portada: boolean };

const MAX_FOTOS = 8;
const ANCHO_MAX = 1600;
const CALIDAD = 0.82;
/* El tope del bucket. Es generoso a propósito: una foto de iPhone pasa los
   4 MB sin esfuerzo, y rechazarla sería perder la ficha de un negocio por
   algo que el navegador puede arreglar solo. Lo que termina guardado pesa
   ~200 KB venga de 2 MB o de 9. */
const TOPE_BYTES = 10 * 1024 * 1024;

const ACEPTA = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';

/**
 * Encoger y pasar a WebP ANTES de subir.
 *
 * Primero en el navegador, con un canvas: así lo que viaja son ~200 KB en vez
 * de 6 MB, que en el 3G de La Fortuna es la diferencia entre que funcione y
 * que no.
 *
 * Si el navegador no sabe leer el archivo —HEIC en Chrome y Firefox, que es
 * el formato con el que fotografía un iPhone— esa foto sola se manda al
 * servidor, donde sharp sí la lee.
 */
async function aWebp(archivo: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
    const escala = Math.min(1, ANCHO_MAX / bitmap.width);
    const ancho = Math.round(bitmap.width * escala);
    const alto = Math.round(bitmap.height * escala);

    const lienzo = document.createElement('canvas');
    lienzo.width = ancho;
    lienzo.height = alto;
    const pincel = lienzo.getContext('2d');
    if (!pincel) throw new Error('sin canvas');
    pincel.drawImage(bitmap, 0, 0, ancho, alto);
    bitmap.close();

    const blob = await new Promise<Blob | null>((listo) =>
      lienzo.toBlob(listo, 'image/webp', CALIDAD),
    );
    if (blob) return blob;
  } catch {
    // Todavía no es un error: cae al servidor.
  }

  const cuerpo = new FormData();
  cuerpo.append('archivo', archivo);
  const respuesta = await fetch('/api/foto/webp', { method: 'POST', body: cuerpo });
  if (!respuesta.ok) {
    const dicho = await respuesta.json().catch(() => ({}));
    throw new Error(dicho.error ?? 'No pudimos leer esa foto.');
  }
  return await respuesta.blob();
}

/** El nombre del archivo, limpio: la base solo acepta letras, números y guiones. */
function nombreLimpio(original: string): string {
  const base = original
    .replace(/\.[^.]+$/, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return `${base || 'foto'}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

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
