import { NextRequest, NextResponse } from 'next/server';
import { hayClaveDeServicio } from '@/lib/supabase-servidor';
import { secreto } from '@/lib/secretos';
import { recibirCorreo } from '@/lib/correo/entrante';
import { firmaValida } from '@/lib/correo/firma-svix';

/*
 * El correo que ENTRA, por Resend.
 *
 * Resend avisa con `email.received` a esta ruta. El aviso trae SOLO los datos
 * de alrededor —quién escribió, a quién, el asunto— y **no trae el cuerpo**:
 * su documentación lo dice expresamente, para que un adjunto grande no haga
 * explotar el webhook. Así que el cuerpo se va a buscar aparte, con el
 * `email_id` que viene en el aviso:
 *
 *   GET https://api.resend.com/emails/receiving/{id}
 *
 * ⚠️ POR QUÉ UN SUBDOMINIO Y NO EL DOMINIO RAÍZ.
 *
 * `visitlafortunacr.com` tiene el correo en SiteGround, con buzones de verdad
 * (webmail, IMAP, autoconfiguración). Si se le cambia el MX al dominio raíz se
 * pierde todo eso y no hay forma documentada de volver atrás. El MX de Resend
 * va en `correo.visitlafortunacr.com`, al lado, y el apex queda intacto.
 * La documentación de Resend recomienda exactamente esto cuando el dominio ya
 * tiene correo de otro proveedor. Ver el cerebro:
 * `el-correo-del-dominio-es-de-siteground-y-no-se-quema`.
 *
 * ⚠️ SIN SECRETO NO SE ACEPTA NADA. El webhook de WhatsApp, cuando no hay
 * secreto configurado, acepta igual y lo anota. Acá NO: una ruta de correo
 * entrante sin firma deja que cualquiera invente un correo de un viajero que
 * no existe, le abra conversación en el CRM y dispare una respuesta nuestra.
 * Es peor fallar callado que rebotar.
 */
export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

/* La revisión de la firma vive en `lib/correo/firma-svix.ts`, sin una sola
   dependencia del proyecto, para que `scripts/probar-firma-svix.mts` pueda
   correr LA MISMA función que corre acá y meterle firmas malas a propósito.
   Una revisión de firma falla callada en las dos direcciones: o rechaza todo
   (y no entra un correo sin que nadie se entere) o acepta todo (y cualquiera
   inventa un correo de un viajero y nos hace contestarle). */

type AvisoRecibido = {
  type?: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string[];
    cc?: string[];
    received_for?: string[];
    message_id?: string;
    subject?: string;
  };
};

type CorreoDeResend = {
  from?: string;
  to?: string[];
  subject?: string | null;
  text?: string | null;
  html?: string | null;
  message_id?: string | null;
};

/* El cuerpo plano manda; si vino solo en HTML se le quitan las etiquetas a lo
   bruto, que para leerlo y contestarlo alcanza. Mismo criterio que el handler
   `email()` del Worker, para que un correo se lea igual por los dos caminos. */
function soloTexto(correo: CorreoDeResend): string {
  if (correo.text?.trim()) return correo.text.trim();
  return (correo.html ?? '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export async function POST(peticion: NextRequest) {
  const crudo = await peticion.text();

  const clave = await secreto('RESEND_WEBHOOK_SECRET');
  if (!clave) {
    console.error('webhook correo: falta RESEND_WEBHOOK_SECRET; el aviso se rechaza.');
    return NextResponse.json({ error: 'Webhook sin secreto configurado.' }, { status: 503 });
  }

  const revisada = firmaValida(crudo, {
    id: peticion.headers.get('svix-id'),
    timestamp: peticion.headers.get('svix-timestamp'),
    firma: peticion.headers.get('svix-signature'),
  }, clave);
  if (!revisada.ok) {
    console.error(`webhook correo: firma rechazada — ${revisada.porque}`);
    return NextResponse.json({ error: 'Firma inválida.' }, { status: 401 });
  }

  if (!hayClaveDeServicio()) return NextResponse.json({ error: 'Falta SUPABASE_SECRET_KEY.' }, { status: 503 });

  let aviso: AvisoRecibido;
  try { aviso = JSON.parse(crudo); }
  catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }); }

  /* Resend manda otros eventos al mismo webhook si están marcados (entregado,
     rebotado...). Los que no son correo entrante se contestan 200 y se dejan
     pasar: devolver error haría que Resend reintente para siempre. */
  if (aviso.type !== 'email.received') {
    return NextResponse.json({ ok: true, ignorado: aviso.type ?? '(sin tipo)' });
  }

  const emailId = aviso.data?.email_id;
  if (!emailId) {
    console.error('webhook correo: el aviso email.received no trae data.email_id.');
    return NextResponse.json({ error: 'Sin email_id.' }, { status: 400 });
  }

  const llaveResend = await secreto('RESEND_API_KEY');
  if (!llaveResend) {
    console.error('webhook correo: falta RESEND_API_KEY, no se puede leer el cuerpo.');
    return NextResponse.json({ error: 'Falta RESEND_API_KEY.' }, { status: 503 });
  }

  /* El cuerpo. Si esto falla no se puede contestar nada útil, así que se
     devuelve error y Resend reintenta —es justo el caso en que conviene. */
  let correo: CorreoDeResend;
  try {
    const r = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
      headers: {
        Authorization: `Bearer ${llaveResend}`,
        /* La API de Resend rechaza con 403 cualquier petición sin User-Agent. */
        'User-Agent': 'visitlafortunacr-webhook',
      },
    });
    if (!r.ok) {
      const detalle = await r.text().catch(() => '');
      console.error(`webhook correo: Resend devolvió ${r.status} al pedir ${emailId}. ${detalle.slice(0, 300)}`);
      return NextResponse.json({ error: `Resend devolvió ${r.status}.` }, { status: 502 });
    }
    correo = await r.json();
  } catch (fallo) {
    const porque = fallo instanceof Error ? fallo.message : String(fallo);
    console.error(`webhook correo: no se pudo leer el cuerpo de ${emailId}: ${porque}`);
    return NextResponse.json({ error: 'No se pudo leer el correo.' }, { status: 502 });
  }

  /* A qué dirección nuestra llegó. `to` es lo normal con MX directo; con un
     reenvío, la dirección real viene en `received_for`. Se prueban en orden y
     se para en la primera que un destino nuestro reconozca: `recibirCorreo`
     no escribe nada cuando no encuentra destino, así que reintentar es sano. */
  const candidatas = [
    ...(correo.to ?? []),
    ...(aviso.data?.to ?? []),
    ...(aviso.data?.received_for ?? []),
    ...(aviso.data?.cc ?? []),
  ]
    .map((d) => (d ?? '').trim())
    .filter(Boolean)
    .filter((d, i, todas) => todas.indexOf(d) === i);

  if (!candidatas.length) {
    console.error(`webhook correo: ${emailId} no trae ninguna dirección de destino.`);
    return NextResponse.json({ error: 'Sin dirección de destino.' }, { status: 400 });
  }

  const comun = {
    de: correo.from ?? aviso.data?.from ?? '',
    asunto: correo.subject ?? aviso.data?.subject ?? null,
    texto: soloTexto(correo),
    /* El Message-Id de verdad, no el id de Resend: es la dedupe que ya usa
       `recibirCorreo` y la que comparten los dos caminos de entrada. */
    id_externo: correo.message_id ?? aviso.data?.message_id ?? emailId,
  };

  const motivos: string[] = [];
  for (const para of candidatas) {
    const r = await recibirCorreo({ ...comun, para });
    if (r.ok) {
      console.log(`webhook correo: ${para} ← ${comun.de} · ${r.motivo}${r.modo ? ` · modo ${r.modo}` : ''}`);
      /* Solo `r`: ya trae `ok: true`. Escribir `{ ok: true, ...r }` dejaba el
         `ok` dos veces y el de la derecha pisaba al de la izquierda. */
      return NextResponse.json(r);
    }
    motivos.push(`${para}: ${r.motivo}`);
  }

  /* Nadie lo reclamó. Se contesta 200 a propósito: si fuera error, Resend
     reintentaría eternamente un correo que nunca va a tener dueño. Pero queda
     escrito con nombre y apellido, porque esto no puede pasar callado. */
  console.error(`webhook correo: nadie contesta a este correo (${emailId}). ${motivos.join(' | ')}`);
  return NextResponse.json({ ok: false, motivo: 'Ningún destino reclamó este correo.', intentos: motivos });
}
