import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { destinoActual } from '@/lib/destino';
import { enviarCorreo } from '@/lib/correo/enviar';
import { secreto } from '@/lib/secretos';
import { esIdioma, type Idioma } from '@/lib/idiomas';

export const runtime = 'nodejs';

/*
 * Los correos de la cuenta, mandados por NOSOTROS y no por Supabase.
 *
 * Supabase manda por su cuenta el "confirmá tu cuenta", el enlace mágico y el
 * "olvidé mi contraseña", con una plantilla suya que no se parece en nada al
 * sitio. Con el Send Email Hook prendido, Supabase deja de mandarlos y llama
 * a esta ruta; acá se arma el correo con la marca del destino, en el idioma de
 * la persona, y sale por Resend como todos los demás.
 *
 * Para prenderlo (lo hace Tony, pide su sesión):
 *   Supabase → Authentication → Emails → Send Email Hook
 *   URL:     https://www.visitlafortunacr.com/api/auth/correo
 *   Secreto: el que genere ahí, pegado después en Ajustes → Llaves
 *            como AUTH_HOOK_SECRET.
 *
 * Mientras el hook esté apagado, esta ruta simplemente no se llama y Supabase
 * sigue mandando los suyos: no hay nada que romper mientras tanto.
 */

const LLAVE_HOOK = 'AUTH_HOOK_SECRET';

/* Lo que manda Supabase. Es dato de entrada, no instrucciones. */
type Carga = {
  user?: { email?: string; user_metadata?: Record<string, unknown> };
  email_data?: {
    token_hash?: string;
    redirect_to?: string;
    email_action_type?: string;
    site_url?: string;
  };
};

/**
 * Verificar la firma, formato Standard Webhooks.
 *
 * Sin esto, cualquiera que encuentre la dirección puede hacer que el sitio
 * mande correos a quien quiera, con nuestro dominio. La firma es HMAC-SHA256
 * de "<id>.<timestamp>.<cuerpo>".
 */
function firmaValida(secretoBruto: string, cabeceras: Headers, cuerpo: string): boolean {
  const id = cabeceras.get('webhook-id');
  const marca = cabeceras.get('webhook-timestamp');
  const firmas = cabeceras.get('webhook-signature');
  if (!id || !marca || !firmas) return false;

  /* Una firma vieja se puede reusar; cinco minutos de margen por el reloj. */
  const cuando = Number(marca) * 1000;
  if (!Number.isFinite(cuando) || Math.abs(Date.now() - cuando) > 5 * 60 * 1000) return false;

  const limpio = secretoBruto.startsWith('v1,whsec_')
    ? secretoBruto.slice('v1,whsec_'.length)
    : secretoBruto.replace(/^whsec_/, '');
  const llave = Buffer.from(limpio, 'base64');

  const esperada = createHmac('sha256', llave)
    .update(`${id}.${marca}.${cuerpo}`)
    .digest('base64');

  /* La cabecera puede traer varias, separadas por espacio: "v1,AAA v1,BBB". */
  return firmas.split(' ').some((entrada) => {
    const valor = entrada.includes(',') ? entrada.split(',')[1] : entrada;
    const a = Buffer.from(valor);
    const b = Buffer.from(esperada);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

/* Qué correo es cada uno. Supabase los nombra así. */
const ASUNTOS: Record<string, Record<Idioma, string>> = {
  signup: {
    es: 'Confirmá tu cuenta', en: 'Confirm your account', pt: 'Confirme a sua conta',
    fr: 'Confirmez votre compte', de: 'Bestätige dein Konto',
  },
  magiclink: {
    es: 'Tu enlace para entrar', en: 'Your sign-in link', pt: 'Seu link de acesso',
    fr: 'Votre lien de connexion', de: 'Dein Anmeldelink',
  },
  recovery: {
    es: 'Poner una contraseña nueva', en: 'Set a new password', pt: 'Definir uma nova senha',
    fr: 'Choisir un nouveau mot de passe', de: 'Neues Passwort festlegen',
  },
  email_change: {
    es: 'Confirmá tu correo nuevo', en: 'Confirm your new email', pt: 'Confirme o seu novo e-mail',
    fr: 'Confirmez votre nouvel e-mail', de: 'Bestätige deine neue E-Mail',
  },
};

const CUERPOS: Record<string, Record<Idioma, string>> = {
  signup: {
    es: 'Tocá el botón y tu cuenta queda lista. El enlace sirve una sola vez.',
    en: 'Tap the button and your account is ready. The link works once.',
    pt: 'Toque no botão e sua conta fica pronta. O link funciona uma só vez.',
    fr: 'Appuyez sur le bouton et votre compte est prêt. Le lien ne sert qu’une fois.',
    de: 'Tippe auf den Button und dein Konto ist fertig. Der Link gilt einmal.',
  },
  magiclink: {
    es: 'Tocá el botón para entrar. El enlace sirve una sola vez.',
    en: 'Tap the button to sign in. The link works once.',
    pt: 'Toque no botão para entrar. O link funciona uma só vez.',
    fr: 'Appuyez sur le bouton pour vous connecter. Le lien ne sert qu’une fois.',
    de: 'Tippe auf den Button, um dich anzumelden. Der Link gilt einmal.',
  },
  recovery: {
    es: 'Pediste cambiar tu contraseña. Tocá el botón y escribí una nueva.',
    en: 'You asked to change your password. Tap the button and set a new one.',
    pt: 'Você pediu para trocar a senha. Toque no botão e defina uma nova.',
    fr: 'Vous avez demandé à changer votre mot de passe. Appuyez et choisissez-en un nouveau.',
    de: 'Du hast eine Passwortänderung angefordert. Tippe auf den Button und setze ein neues.',
  },
  email_change: {
    es: 'Tocá el botón para confirmar tu correo nuevo.',
    en: 'Tap the button to confirm your new email.',
    pt: 'Toque no botão para confirmar o seu novo e-mail.',
    fr: 'Appuyez sur le bouton pour confirmer votre nouvel e-mail.',
    de: 'Tippe auf den Button, um deine neue E-Mail zu bestätigen.',
  },
};

const BOTONES: Record<Idioma, string> = {
  es: 'Abrir el enlace', en: 'Open the link', pt: 'Abrir o link',
  fr: 'Ouvrir le lien', de: 'Link öffnen',
};

const AVISO_MISMO_NAVEGADOR: Record<Idioma, string> = {
  es: 'Abrilo en el mismo navegador donde lo pediste. Si no lo pediste vos, ignorá este correo: no pasa nada.',
  en: 'Open it in the same browser where you asked for it. If you did not ask for this, just ignore it.',
  pt: 'Abra no mesmo navegador em que pediu. Se não foi você, ignore este e-mail.',
  fr: 'Ouvrez-le dans le même navigateur que celui de la demande. Si ce n’est pas vous, ignorez cet e-mail.',
  de: 'Öffne ihn im selben Browser, in dem du ihn angefordert hast. Falls du das nicht warst, ignoriere die E-Mail.',
};

export async function POST(peticion: NextRequest) {
  const llave = await secreto(LLAVE_HOOK);
  if (!llave) {
    console.error('Send Email Hook llamado sin AUTH_HOOK_SECRET puesta.');
    return NextResponse.json({ error: 'sin configurar' }, { status: 500 });
  }

  const cuerpo = await peticion.text();
  if (!firmaValida(llave, peticion.headers, cuerpo)) {
    return NextResponse.json({ error: 'firma inválida' }, { status: 401 });
  }

  let carga: Carga;
  try {
    carga = JSON.parse(cuerpo) as Carga;
  } catch {
    return NextResponse.json({ error: 'cuerpo inválido' }, { status: 400 });
  }

  const para = carga.user?.email;
  const datos = carga.email_data;
  if (!para || !datos?.token_hash || !datos.email_action_type) {
    return NextResponse.json({ error: 'faltan datos' }, { status: 400 });
  }

  const tipo = datos.email_action_type;
  if (!ASUNTOS[tipo]) {
    /* Un tipo que no sabemos pintar: mejor decir que no que mandar algo feo.
       Supabase lo reintenta o lo manda él. */
    console.error('Tipo de correo de cuenta no contemplado:', tipo);
    return NextResponse.json({ error: 'tipo no soportado' }, { status: 400 });
  }

  const destino = await destinoActual();

  /* El idioma que la persona tenía elegido, si el alta lo guardó. */
  const guardado = carga.user?.user_metadata?.idioma;
  const idioma: Idioma = typeof guardado === 'string' && esIdioma(guardado)
    ? guardado
    : (destino.idioma_principal as Idioma);

  /* El enlace de verificación lo arma Supabase; acá solo se compone con el
     destino al que debe volver. redirect_to viene de la petición original. */
  const base = (datos.site_url ?? `https://${destino.dominio}`).replace(/\/+$/, '');
  const vuelve = datos.redirect_to ?? `https://${destino.dominio}`;
  const url = `${base}/auth/v1/verify?token=${encodeURIComponent(datos.token_hash)}`
    + `&type=${encodeURIComponent(tipo)}&redirect_to=${encodeURIComponent(vuelve)}`;

  const envio = await enviarCorreo({
    destino,
    idioma,
    para,
    asunto: ASUNTOS[tipo][idioma] ?? ASUNTOS[tipo].es,
    motivo: `cuenta:${tipo}`,
    titulo: ASUNTOS[tipo][idioma] ?? ASUNTOS[tipo].es,
    parrafos: [CUERPOS[tipo][idioma] ?? CUERPOS[tipo].es],
    boton: { texto: BOTONES[idioma] ?? BOTONES.es, url },
    nota: AVISO_MISMO_NAVEGADOR[idioma] ?? AVISO_MISMO_NAVEGADOR.es,
  });

  if (!envio.ok) {
    /* Devolver error hace que Supabase lo reintente, que es lo que queremos:
       un correo de confirmación perdido deja a alguien afuera de su cuenta. */
    console.error('correo de cuenta no salió:', envio.error);
    return NextResponse.json({ error: envio.error }, { status: 500 });
  }

  return NextResponse.json({});
}
