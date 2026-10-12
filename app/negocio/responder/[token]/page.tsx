import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import { Volcanes } from '@/componentes/Volcanes';
import { Responder } from './Responder';

/*
 * Responder una reseña desde el enlace del correo, sin entrar a la cuenta.
 *
 * Pedirle la contraseña a un dueño de hotel para contestar dos líneas es
 * perder la respuesta. El enlace trae un token de un solo uso que sirve para
 * ESA reseña y nada más: no es un inicio de sesión y no abre ninguna otra
 * pantalla.
 *
 * La página entra como anónima y toda la comprobación está en la base —
 * `resena_por_token` devuelve el motivo exacto cuando dice que no, para que
 * el dueño sepa si esperar, pedir otro correo o entrar a su cuenta.
 */

export const dynamic = 'force-dynamic';

/* Fuera de los buscadores: es una dirección privada de un solo uso. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

type Fila = {
  resena_id: string | null;
  negocio_nombre: string | null;
  calificacion: number | null;
  titulo: string | null;
  cuerpo: string | null;
  autor: string | null;
  creado_en: string | null;
  respuesta_negocio: string | null;
  motivo: string;
};

const EXCUSAS: Record<string, { titulo: string; texto: string }> = {
  usado: {
    titulo: 'Este enlace ya se usó',
    texto: 'La reseña ya tiene respuesta. Si querés cambiarla, entrá a tu cuenta.',
  },
  vencido: {
    titulo: 'Este enlace venció',
    texto: 'Los enlaces duran siete días. Entrá a tu cuenta para responder la reseña.',
  },
  desconocido: {
    titulo: 'Este enlace no es válido',
    texto: 'Puede estar incompleto. Copialo entero desde el correo, o entrá a tu cuenta.',
  },
};

export default async function PaginaResponder({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const { data, error } = await supabase.rpc('resena_por_token', { p_token: token });
  const fila = ((data ?? []) as Fila[])[0];

  if (error || !fila || fila.motivo !== 'ok') {
    const excusa = EXCUSAS[fila?.motivo ?? 'desconocido'] ?? EXCUSAS.desconocido;
    return (
      <div className="caja responder-caja">
        <div className="bloque">
          <h1 style={{ fontSize: 22, marginBottom: 10 }}>{excusa.titulo}</h1>
          <p style={{ color: 'var(--humo)', margin: 0 }}>{excusa.texto}</p>
          <a className="boton" href="/negocio" style={{ display: 'inline-block', marginTop: 20 }}>
            Entrar a mi cuenta
          </a>
        </div>
      </div>
    );
  }

  const cuando = fila.creado_en
    ? new Date(fila.creado_en).toLocaleDateString('es-CR', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <div className="caja responder-caja">
      <p className="responder-rotulo">{fila.negocio_nombre}</p>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>Respondé esta reseña</h1>

      <article className="bloque">
        <div className="resena-quien">
          <Volcanes nota={Number(fila.calificacion ?? 0)} tamano={15}
                    etiqueta={`${fila.calificacion} de 5`} />
          <strong>{fila.autor}</strong>
          {cuando && <span>{cuando}</span>}
        </div>
        {fila.titulo && <h2 style={{ fontSize: 17, margin: '12px 0 0' }}>{fila.titulo}</h2>}
        <p style={{ margin: '10px 0 0', lineHeight: 1.6, color: 'var(--txt-0)' }}>{fila.cuerpo}</p>
      </article>

      <div className="bloque" style={{ marginTop: 16 }}>
        <Responder token={token} yaTiene={fila.respuesta_negocio} />
      </div>

      <p className="responder-pie">
        Este enlace sirve una sola vez. Para lo demás —tus fotos, tu ficha, las otras
        reseñas— entrá a <a href="/negocio">tu cuenta</a>.
      </p>
    </div>
  );
}
