'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { t, type Idioma } from '@/lib/idiomas';
import { Fotos } from '@/app/negocio/[id]/Fotos';
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
      {/* Los tres pasos se anuncian desde el principio: si las fotos aparecen
          de sorpresa al final, se sienten un extra y se saltan. */}
      <div className="pasos-forma">
        <span className="paso-activo">1. {t('sumar_paso_cuenta', idioma)}</span>
        <span>2. {t('sumar_paso_negocio', idioma)}</span>
        <span>3. {t('sumar_paso_fotos', idioma)}</span>
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
  /* Solo para cambiar los rotulos mientras escribe. Lo que vale es el radio
     que viaja en el formulario, no este estado. */
  const [esOperador, setEsOperador] = useState(false);

  /* Las fotos van ACA y no en una pantalla aparte despues. Redirigiendo al
     panel, la gente daba el tramite por terminado y la ficha se quedaba sin
     una sola foto — que es justo lo que hace que nadie la mire. */
  if (estado.creado) {
    return <PasoFotos idioma={idioma} creado={estado.creado} />;
  }

  /* Cuando la base devuelve parecidos, el formulario no se vacía: se le
     muestran arriba y se le pide que confirme. El campo oculto "confirmado"
     es lo que deja pasar el segundo intento. */
  const hayParecidos = Boolean(estado.parecidos?.length);

  return (
    <div className="tarjeta-forma">
      <div className="pasos-forma">
        <span>1. {t('sumar_paso_cuenta', idioma)} ✓</span>
        <span className="paso-activo">2. {t('sumar_paso_negocio', idioma)}</span>
        <span>3. {t('sumar_paso_fotos', idioma)}</span>
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

        {/* ---- La pregunta que parte el camino ----
            Un hotel y un operador de tours no son lo mismo: el hotel es un
            lugar que la gente visita y tiene ficha; el operador vende tours y
            no tiene local que mostrar. Preguntarlo acá evita que Jacamar
            termine listado entre los hoteles sin nada que poner en la ficha.
            Lo que decide de verdad es `es_operador` en la base. */}
        <fieldset className="sumar-que-sos">
          <legend>¿Qué tenés? *</legend>
          <label className="sumar-opcion">
            <input type="radio" name="es_operador" value="0" defaultChecked
                   onChange={() => setEsOperador(false)} />
            <span>
              <strong>Un lugar que la gente visita</strong>
              Hotel, restaurante, termales, tienda. Tenés tu ficha en el directorio.
            </span>
          </label>
          <label className="sumar-opcion">
            <input type="radio" name="es_operador" value="1"
                   onChange={() => setEsOperador(true)} />
            <span>
              <strong>Vendo tours</strong>
              Sos operador. Lo que sale en el sitio son tus tours, una por una,
              no una ficha tuya.
            </span>
          </label>
        </fieldset>

        <label>
          <span>{esOperador ? '¿Cómo se llama tu empresa?' : t('sumar_nombre_negocio', idioma)} *</span>
          <input name="nombre" type="text" required maxLength={120} />
        </label>

        <label>
          <span>{t('sumar_categoria', idioma)} *</span>
          <select name="categoria_id" required defaultValue="">
            <option value="" disabled>{t('sumar_elegi', idioma)}</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <small>
            {esOperador
              ? 'De qué son la mayoría de tus tours. Cada tour después lleva la suya.'
              : t('sumar_categoria_fija', idioma)}
          </small>
        </label>

        <label>
          <span>{t('sumar_resumen', idioma)}</span>
          <textarea name="resumen" rows={3} maxLength={300} />
          <small>{t('sumar_resumen_ayuda', idioma)}</small>
        </label>

        <div className="forma-fila">
          <label>
            <span>{t('sumar_telefono', idioma)} *</span>
            <input name="telefono" type="tel" inputMode="tel" placeholder="+506…" required />
            <small>{t('sumar_telefono_porque', idioma)}</small>
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

/* ---- Paso 3: las fotos, antes de soltarlo ---------------------------- */

function PasoFotos({
  idioma, creado,
}: {
  idioma: Idioma;
  creado: { id: string; babosa: string; destinoBabosa: string; esOperador?: boolean };
}) {
  /* El operador no tiene ficha, asi que no hay galeria que llenar: lo suyo
     son las tours, y mandarlo a subir fotos de un local que no existe es
     pedirle algo que no tiene. */
  if (creado.esOperador) {
    return (
      <div className="tarjeta-forma">
        <div className="pasos-forma">
          <span>1. {t('sumar_paso_cuenta', idioma)} ✓</span>
          <span>2. {t('sumar_paso_negocio', idioma)} ✓</span>
          <span className="paso-activo">3. Tus tours</span>
        </div>

        <div className="aviso-logro">
          <strong>Listo, ya quedaste registrado.</strong>
          <p>
            Ahora cargá tus tours: una por una, con su precio, qué incluye y una
            foto. Las revisamos y las publicamos. Podés cargar una hoy y el resto
            cuando querrás — lo que escribas se guarda.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginTop: 26 }}>
          <Link className="boton" href={`/negocio/${creado.id}/tours`}>
            Cargar mi primera tour
          </Link>
          <Link className="enlace-flojo" href={`/negocio/${creado.id}`}>
            Después
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="tarjeta-forma">
      <div className="pasos-forma">
        <span>1. {t('sumar_paso_cuenta', idioma)} ✓</span>
        <span>2. {t('sumar_paso_negocio', idioma)} ✓</span>
        <span className="paso-activo">3. {t('sumar_paso_fotos', idioma)}</span>
      </div>

      <div className="aviso-logro">
        <strong>{t('sumar_listo_titulo', idioma)}</strong>
        <p>{t('sumar_listo_fotos', idioma)}</p>
      </div>

      <Fotos
        negocioId={creado.id}
        destinoBabosa={creado.destinoBabosa}
        negocioBabosa={creado.babosa}
        fotos={[]}
      />

      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginTop: 26 }}>
        <Link className="boton" href={`/negocio/${creado.id}`}>
          {t('sumar_listo_panel', idioma)}
        </Link>
        <Link className="enlace-flojo" href={`/negocio/${creado.id}`}>
          {t('sumar_fotos_despues', idioma)}
        </Link>
      </div>
    </div>
  );
}
