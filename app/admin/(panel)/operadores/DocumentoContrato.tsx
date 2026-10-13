'use client';

import { useRef, useState } from 'react';
import { navegador } from '@/lib/supabase-navegador';
import { verElContrato, borrarElContrato } from './acciones';

/*
 * El contrato firmado y el tarifario, con botón de subir.
 *
 * REGLA DE LA CASA: ningún archivo se pide pegando una dirección. Nadie tiene
 * a mano la URL de un PDF; lo que tiene a mano es el PDF.
 *
 * Va al bucket PRIVADO `contratos` porque un tarifario trae los IBANs del
 * negocio y las tarifas netas negociadas. Lo que se guarda en la base es la
 * RUTA, no una dirección: para verlo se pide una url firmada que caduca a los
 * diez minutos, así que no sirve reenviada ni guardada en un favorito.
 *
 * El enlace externo sigue aceptándose para lo que ya estaba en un Drive, pero
 * queda plegado: no es el camino que se quiere.
 */

const ACEPTA = 'application/pdf,image/jpeg,image/png,image/webp';
const TOPE = 20 * 1024 * 1024;

/** Limpio para una ruta: sin tildes, sin espacios, sin sorpresas. */
function nombreLimpio(original: string): string {
  const punto = original.lastIndexOf('.');
  const base = (punto > 0 ? original.slice(0, punto) : original)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  const ext = punto > 0 ? original.slice(punto + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : 'pdf';
  return `${base || 'contrato'}-${Date.now().toString(36)}.${ext}`;
}

export function DocumentoContrato({
  contratoId, negocioBabosa, valor, puedeEditar,
}: {
  contratoId: string;
  negocioBabosa: string;
  valor: string | null;
  puedeEditar: boolean;
}) {
  const [ruta, setRuta] = useState(valor ?? '');
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  const esExterno = ruta.startsWith('http');
  const nombre = ruta ? ruta.split('/').pop() : '';

  async function elegido(lista: FileList | null) {
    const archivo = lista?.[0];
    if (!archivo) return;
    setError(null);
    setSubiendo(true);
    try {
      if (archivo.size > TOPE) throw new Error('Ese archivo pasa de 20 MB.');

      const destino = `${negocioBabosa}/${contratoId}/${nombreLimpio(archivo.name)}`;
      const db = navegador();
      const { error: eSubida } = await db.storage
        .from('contratos')
        .upload(destino, archivo, { contentType: archivo.type || 'application/pdf' });
      if (eSubida) throw new Error(eSubida.message);

      setRuta(destino);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo subir.');
    } finally {
      setSubiendo(false);
      if (campo.current) campo.current.value = '';
    }
  }

  async function abrir() {
    setError(null);
    const r = await verElContrato(ruta);
    if (r.error) { setError(r.error); return; }
    if (r.url) window.open(r.url, '_blank', 'noopener,noreferrer');
  }

  async function quitar() {
    setError(null);
    if (!esExterno && ruta) {
      const r = await borrarElContrato(ruta);
      if (r.error) { setError(r.error); return; }
    }
    setRuta('');
  }

  return (
    <div className="campo ancho">
      <label>Contrato firmado y tarifario <small className="gris">privado, no sale en el sitio</small></label>

      {/* Lo que viaja al formulario del contrato. */}
      <input type="hidden" name="documento_url" value={ruta} />

      {ruta ? (
        <div className="doc-contrato">
          <span className="doc-contrato-nombre">
            {esExterno ? ruta : nombre}
          </span>
          {esExterno ? (
            <a className="boton chico" href={ruta} target="_blank" rel="noreferrer">Abrir ↗</a>
          ) : (
            <button type="button" className="boton chico" onClick={abrir}>Ver ↗</button>
          )}
          {puedeEditar && (
            <button type="button" className="boton peligro chico" onClick={quitar}>Quitar</button>
          )}
        </div>
      ) : (
        <div className="doc-contrato vacio">
          <span>Sin contrato cargado.</span>
        </div>
      )}

      {puedeEditar && (
        <div className="doc-contrato-botones">
          <label className="boton tenue chico">
            {subiendo ? 'Subiendo…' : ruta ? 'Reemplazar' : 'Subir el PDF'}
            <input ref={campo} type="file" accept={ACEPTA} disabled={subiendo}
                   onChange={(e) => elegido(e.target.files)} hidden />
          </label>

          {/* Para lo que ya vive en un Drive. Plegado: no es el camino normal. */}
          <details className="doc-contrato-enlace">
            <summary>…o pegar un enlace</summary>
            <input type="url" placeholder="https://…" defaultValue={esExterno ? ruta : ''}
                   onChange={(e) => setRuta(e.target.value.trim())} />
          </details>
        </div>
      )}

      {error && <p className="forma-error" role="alert">{error}</p>}
      <small className="gris">
        Guardalo acá y no en un correo: es la prueba de lo que se acordó, y el
        tarifario trae cuentas bancarias y precios netos. Se abre con un enlace
        que caduca a los diez minutos.
      </small>
    </div>
  );
}
