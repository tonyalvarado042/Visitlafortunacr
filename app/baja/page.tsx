import { destinoActual } from '@/lib/destino';
import { supabase } from '@/lib/supabase';
import { LogoVLF } from '@/componentes/Marca';

export const dynamic = 'force-dynamic';

/*
 * Darse de baja.
 *
 * Vive fuera de /<idioma>/ a propósito: el enlace sale en correos de cinco
 * idiomas y no vale la pena que una persona que ya decidió irse tenga que
 * aterrizar en el idioma correcto para poder irse.
 *
 * Un clic y listo. Sin "¿estás seguro?", sin pedirle el correo, sin ofrecerle
 * "recibir menos en vez de nada". Poner trabas ahí no retiene a nadie: hace
 * que marquen el correo como spam, y eso sí cuesta — se lleva por delante la
 * reputación del dominio y los correos que la gente SÍ pidió.
 *
 * El testigo va en la dirección y no el id de la fila: un uuid de fila suelto
 * deja adivinar el de otra persona.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata = { title: 'Baja', robots: { index: false, follow: false } };

export default async function PaginaBaja({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const destino = await destinoActual();

  /* Con el cliente publico y NO con la llave de servicio: `darse_de_baja`
     es SECURITY DEFINER y acepta el testigo, asi que no hace falta. Y eso
     importa: si esta pagina dependiera de la llave, el dia que falte la
     gente no podria darse de baja — que es justo lo que no puede pasar. */
  let listo = false;
  if (t && UUID.test(t)) {
    const { data, error } = await supabase.rpc('darse_de_baja', { p_token: t });
    if (error) console.error('darse_de_baja:', error.message);
    listo = data === true;
  }

  return (
    <main className="baja">
      <div className="baja-caja">
        {destino.logo_url
          /* eslint-disable-next-line @next/next/no-img-element */
          ? <img src={destino.logo_url} width={48} height={48} alt={destino.marca_nombre} />
          : <LogoVLF tamano={48} sigla={destino.marca_sigla ?? 'VLF'} />}

        {listo ? (
          <>
            <h1>Listo, no te escribimos más</h1>
            <p>
              Te sacamos de los correos automáticos de {destino.marca_nombre}. Si
              alguna vez nos escribís vos, te contestamos — eso no cuenta como
              publicidad.
            </p>
          </>
        ) : (
          <>
            <h1>Ese enlace ya no sirve</h1>
            <p>
              Puede que ya te hayas dado de baja, o que el enlace esté cortado por
              el programa de correo. Si seguís recibiendo correos nuestros,
              respondé cualquiera de ellos y lo arreglamos a mano.
            </p>
          </>
        )}

        <a className="boton" href={`/${destino.idioma_principal}`}>
          Ir a {destino.marca_nombre}
        </a>
      </div>
    </main>
  );
}
