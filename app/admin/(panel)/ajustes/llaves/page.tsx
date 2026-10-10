import Link from 'next/link';
import { contextoPanel } from '@/lib/admin/contexto';
import { relativo } from '@/lib/admin/formato';
import { Cabecera, Etiqueta } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { FormularioLlave } from './FormularioLlave';
import { olvidarLlave } from './acciones';

export const dynamic = 'force-dynamic';

/* Las que el sitio sabe usar. Agregar una es agregarla acá: el guardado es el
   mismo para todas. */
const LLAVES = [
  {
    nombre: 'RESEND_API_KEY',
    titulo: 'Resend',
    paraQue: 'Manda todos los correos del sitio: confirmaciones, avisos y respuestas.',
    ejemplo: 're_…',
  },
  {
    nombre: 'ANTHROPIC_API_KEY',
    titulo: 'Anthropic',
    paraQue: 'El chat del sitio y lo que arma la IA. Sin esto, la burbuja contesta 503.',
    ejemplo: 'sk-ant-…',
  },
  {
    nombre: 'GOOGLE_PLACES_API_KEY',
    titulo: 'Google Places',
    paraQue: 'Trae reseñas y fotos reales de los negocios del directorio.',
  },
  {
    nombre: 'AUTH_HOOK_SECRET',
    titulo: 'Correos de cuenta (Supabase → Resend)',
    paraQue: 'Con esto puesto, los correos de confirmar cuenta y recuperar contraseña salen con nuestra marca en vez de la plantilla genérica de Supabase.',
    ejemplo: 'v1,whsec_…',
  },
  {
    nombre: 'CRON_SECRET',
    titulo: 'Clave del cron',
    paraQue: 'Protege las tareas automáticas para que nadie más las dispare.',
  },
];

type Estado = {
  nombre: string;
  pista: string | null;
  actualizado_en: string;
  quien: string | null;
};

export default async function PaginaLlaves() {
  const { db, usuario } = await contextoPanel('ajustes');

  if (usuario.rol !== 'admin') {
    return (
      <>
        <Cabecera titulo="Llaves" sub="Solo un administrador puede ver esta pantalla." />
        <div className="tarjeta"><p className="gris">No tenés permiso para administrar llaves.</p></div>
      </>
    );
  }

  const { data } = await db.rpc('estado_de_secretos');
  const puestas = new Map((((data ?? []) as Estado[])).map((s) => [s.nombre, s]));

  return (
    <>
      <Cabecera
        titulo="Llaves"
        sub={`${puestas.size} de ${LLAVES.length} puestas · se ingresan, no se consultan`}
      />

      <div className="lado">
        <div style={{ display: 'grid', gap: 16 }}>
          {LLAVES.map((llave) => {
            const estado = puestas.get(llave.nombre);
            return (
              <div className="tarjeta" key={llave.nombre}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                  <h2 style={{ margin: 0 }}>{llave.titulo}</h2>
                  <Etiqueta color={estado ? '#66BB2E' : '#9CA3AF'}>
                    {estado ? 'puesta' : 'falta'}
                  </Etiqueta>
                </div>

                {estado ? (
                  <p className="gris" style={{ fontSize: 13, margin: '0 0 16px' }}>
                    Termina en <strong>···{estado.pista}</strong> · guardada {relativo(estado.actualizado_en)}
                    {estado.quien ? ` por ${estado.quien}` : ''}.
                    {' '}Para cambiarla, escribí una nueva encima.
                  </p>
                ) : (
                  <p className="gris" style={{ fontSize: 13, margin: '0 0 16px' }}>
                    Todavía no está puesta.
                  </p>
                )}

                <FormularioLlave
                  nombre={llave.nombre}
                  titulo={estado ? 'Reemplazarla' : 'Pegá la llave'}
                  paraQue={llave.paraQue}
                  ejemplo={llave.ejemplo}
                />

                {estado && (
                  <form action={olvidarLlave} style={{ marginTop: 12 }}>
                    <input type="hidden" name="nombre" value={llave.nombre} />
                    <BotonAccion
                      clase="enlace-flojo peligro"
                      confirmar={`¿Borrar ${llave.titulo}? Lo que dependa de ella deja de funcionar.`}
                    >
                      Borrar esta llave
                    </BotonAccion>
                  </form>
                )}
              </div>
            );
          })}
        </div>

        <div>
          <div className="tarjeta">
            <h2>Entran, no salen</h2>
            <p className="gris" style={{ fontSize: 13, lineHeight: 1.6 }}>
              Las llaves quedan cifradas en la bóveda de Supabase. Esta pantalla
              <strong> no las puede leer</strong>: la función que devuelve el valor
              está concedida solo al servidor del sitio, no al panel. Ni vos como
              administrador podés sacarlas de acá.
            </p>
            <p className="gris" style={{ fontSize: 13, lineHeight: 1.6 }}>
              Lo que se ve son los últimos cuatro caracteres, lo justo para saber
              si la que está puesta es la de prueba o la de producción.
            </p>
          </div>

          <div className="tarjeta">
            <h2>La que no vive acá</h2>
            <p className="gris" style={{ fontSize: 13, lineHeight: 1.6 }}>
              <strong>SUPABASE_SECRET_KEY</strong> va en Vercel y no acá. Es la llave
              que abre la base, así que no puede guardarse dentro de lo que ella
              misma abre: sin ella el sitio no podría ni leer esta pantalla.
            </p>
            <Link className="enlace-flojo" href="/admin/ajustes">← Volver a Ajustes</Link>
          </div>
        </div>
      </div>
    </>
  );
}
