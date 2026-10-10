'use client';

import { useActionState, useState } from 'react';
import { t, type Idioma } from '@/lib/idiomas';
import { crearCuenta, entrar, olvideMiClaveSumar, sumarNegocio, type EstadoCuenta, type EstadoNegocio } from './acciones';

const NADA_CUENTA: EstadoCuenta = {};
const NADA_NEGOCIO: EstadoNegocio = {};

export function FormularioSumar({
  idioma, conSesion, correoCuenta, categorias,
}: {
  idioma: Idioma;
  conSesion: boolean;
  correoCuenta: string | null;
  categorias: { id: string; nombre: string }[];
}) {
  if (!conSesion) return <PasoCuenta idioma={idioma} />;
  return <PasoNegocio idioma={idioma} correoCuenta={correoCuenta} categorias={categorias} />;
}

/* ---- Paso 1: la cuenta ---------------------------------------------- */

function PasoCuenta({ idioma }: { idioma: Idioma }) {
  const [esNuevo, setEsNuevo] = useState(true);
  /* "olvidé" es un paso DENTRO de "ya tengo cuenta", no una tercera pestaña:
     uno se da cuenta de que no se acuerda justo cuando va a escribirla. */
  const [olvidado, setOlvidado] = useState(false);
  const [estadoNuevo, accionNueva, pendienteNuevo] = useActionState(crearCuenta, NADA_CUENTA);
  const [estadoEntrar, accionEntrar, pendienteEntrar] = useActionState(entrar, NADA_CUENTA);
  const [estadoOlvide, accionOlvide, pendienteOlvide] = useActionState(olvideMiClaveSumar, NADA_CUENTA);

  const estado = olvidado ? estadoOlvide : esNuevo ? estadoNuevo : estadoEntrar;
  const pendiente = olvidado ? pendienteOlvide : esNuevo ? pendienteNuevo : pendienteEntrar;

  return (
    <div className="tarjeta-forma">
      <div className="pasos-forma">
        <span className="paso-activo">1. {t('sumar_paso_cuenta', idioma)}</span>
        <span>2. {t('sumar_paso_negocio', idioma)}</span>
      </div>

      <div className="pestanas">
        <button type="button" className={esNuevo && !olvidado ? 'on' : ''}
                onClick={() => { setEsNuevo(true); setOlvidado(false); }}>
          {t('sumar_crear_cuenta', idioma)}
        </button>
        <button type="button" className={!esNuevo || olvidado ? 'on' : ''}
                onClick={() => { setEsNuevo(false); setOlvidado(false); }}>
          {t('sumar_ya_tengo', idioma)}
        </button>
      </div>

      <form action={olvidado ? accionOlvide : esNuevo ? accionNueva : accionEntrar} className="forma">
        {olvidado && <p className="forma-nota">{t('sumar_olvide_ayuda', idioma)}</p>}

        {esNuevo && !olvidado && (
          <label>
            <span>{t('sumar_tu_nombre', idioma)}</span>
            <input name="nombre" type="text" autoComplete="name" required />
          </label>
        )}
        <label>
          <span>{t('sumar_tu_correo', idioma)}</span>
          <input name="email" type="email" autoComplete="email" required />
        </label>
        {!olvidado && (
          <label>
            <span>{t('sumar_tu_clave', idioma)}</span>
            <input name="clave" type="password" minLength={8}
                   autoComplete={esNuevo ? 'new-password' : 'current-password'} required />
            {esNuevo && <small>{t('sumar_clave_minimo', idioma)}</small>}
          </label>
        )}

        {estado.error && <p className="forma-error">{estado.error}</p>}
        {estado.mensaje && <p className="forma-ok">{estado.mensaje}</p>}

        <button type="submit" className="boton" disabled={pendiente}>
          {pendiente ? t('sumar_enviando', idioma)
            : olvidado ? t('sumar_mandar_enlace', idioma)
            : esNuevo ? t('sumar_crear_cuenta', idioma) : t('sumar_entrar', idioma)}
        </button>

        {/* Solo cuando ya tiene cuenta: al crear una no hay nada que olvidar. */}
        {!esNuevo && !olvidado && (
          <button type="button" className="enlace-flojo" onClick={() => setOlvidado(true)}>
            {t('sumar_olvide', idioma)}
          </button>
        )}
        {olvidado && (
          <button type="button" className="enlace-flojo" onClick={() => setOlvidado(false)}>
            ← {t('sumar_volver_entrar', idioma)}
          </button>
        )}
      </form>
    </div>
  );
}

/* ---- Paso 2: la ficha ------------------------------------------------ */

function PasoNegocio({
  idioma, correoCuenta, categorias,
}: {
  idioma: Idioma;
  correoCuenta: string | null;
  categorias: { id: string; nombre: string }[];
}) {
  const [estado, accion, pendiente] = useActionState(sumarNegocio, NADA_NEGOCIO);

  /* Cuando la base devuelve parecidos, el formulario no se vacía: se le
     muestran arriba y se le pide que confirme. El campo oculto "confirmado"
     es lo que deja pasar el segundo intento. */
  const hayParecidos = Boolean(estado.parecidos?.length);

  return (
    <div className="tarjeta-forma">
      <div className="pasos-forma">
        <span>1. {t('sumar_paso_cuenta', idioma)} ✓</span>
        <span className="paso-activo">2. {t('sumar_paso_negocio', idioma)}</span>
      </div>

      {correoCuenta && <p className="forma-nota">{t('sumar_entraste_como', idioma)} <strong>{correoCuenta}</strong></p>}

      {hayParecidos && (
        <div className="aviso-duro">
          <strong>{t('sumar_ya_existe', idioma)}</strong>
          <ul>
            {estado.parecidos!.map((p) => (
              <li key={p.babosa}>{p.nombre} <span>· {p.categoria}</span></li>
            ))}
          </ul>
          <p>{t('sumar_ya_existe_que_hacer', idioma)}</p>
        </div>
      )}

      <form action={accion} className="forma">
        <input type="hidden" name="idioma" value={idioma} />
        {hayParecidos && (
          <>
            <input type="hidden" name="confirmado" value="1" />
            <input type="hidden" name="parecidos_vistos"
                   value={estado.parecidos!.map((p) => p.nombre).join(', ')} />
          </>
        )}

        <label>
          <span>{t('sumar_nombre_negocio', idioma)} *</span>
          <input name="nombre" type="text" required maxLength={120} />
        </label>

        <label>
          <span>{t('sumar_categoria', idioma)} *</span>
          <select name="categoria_id" required defaultValue="">
            <option value="" disabled>{t('sumar_elegi', idioma)}</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <small>{t('sumar_categoria_fija', idioma)}</small>
        </label>

        <label>
          <span>{t('sumar_resumen', idioma)}</span>
          <textarea name="resumen" rows={3} maxLength={300} />
          <small>{t('sumar_resumen_ayuda', idioma)}</small>
        </label>

        <div className="forma-fila">
          <label>
            <span>{t('sumar_telefono', idioma)}</span>
            <input name="telefono" type="tel" inputMode="tel" placeholder="+506…" />
          </label>
          <label>
            <span>WhatsApp</span>
            <input name="telefono_whatsapp" type="tel" inputMode="tel" placeholder="+506…" />
          </label>
        </div>

        <div className="forma-fila">
          <label>
            <span>{t('sumar_correo_negocio', idioma)}</span>
            <input name="email" type="email" />
          </label>
          <label>
            <span>{t('sumar_sitio', idioma)}</span>
            <input name="sitio_web" type="url" placeholder="https://…" />
          </label>
        </div>

        <label>
          <span>{t('sumar_direccion', idioma)}</span>
          <input name="direccion" type="text" maxLength={200} />
        </label>

        <fieldset className="forma-grupo">
          <legend>{t('sumar_quien_atiende', idioma)}</legend>
          <div className="forma-fila">
            <label>
              <span>{t('sumar_tu_nombre', idioma)}</span>
              <input name="mi_nombre" type="text" autoComplete="name" />
            </label>
            <label>
              <span>{t('sumar_tu_telefono', idioma)}</span>
              <input name="mi_telefono" type="tel" inputMode="tel" placeholder="+506…" />
            </label>
          </div>
        </fieldset>

        {estado.error && <p className="forma-error">{estado.error}</p>}

        <p className="forma-nota">{t('sumar_revision', idioma)}</p>

        <button type="submit" className="boton" disabled={pendiente}>
          {pendiente ? t('sumar_enviando', idioma)
            : hayParecidos ? t('sumar_es_distinto', idioma) : t('sumar_enviar', idioma)}
        </button>
      </form>
    </div>
  );
}
