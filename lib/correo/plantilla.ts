import 'server-only';
import type { Destino } from '@/lib/destino';
import type { Idioma } from '@/lib/idiomas';

/*
 * La plantilla de todo correo que sale del sitio.
 *
 * Por qué tablas y estilos pegados a cada etiqueta, que es feo: porque
 * Outlook y Gmail no leen <style> en el <head> ni flexbox. Un correo que se
 * ve lindo en el navegador y roto en Outlook es un correo roto.
 *
 * La marca sale del destino, igual que el sitio: el día que exista
 * visitmonteverdecr.com, sus correos salen con SU logo y SU color sin tocar
 * una línea de esto.
 */

export type Boton = { texto: string; url: string };

type Pieza = {
  destino: Destino;
  idioma: Idioma;
  titulo: string;
  /** Párrafos. Van como texto, no como HTML: se escapan. */
  parrafos: string[];
  boton?: Boton;
  /** Datos en dos columnas: "Negocio", "Hotel Tal". */
  datos?: { rotulo: string; valor: string }[];
  /** La línea chica del final, sobre por qué recibe esto. */
  nota?: string;
  /* Por qué reservar con nosotros. Una por línea, salen con palomita.
     Se configuran en Ajustes → Textos del sitio, por idioma. */
  razones?: string[];
  /* La línea de escasez o urgencia, en banda de color arriba del botón.
     Vacía = no sale la banda: una urgencia inventada se nota y quema. */
  urgencia?: string;
  /* Por qué le llega el correo, cuando el motivo de siempre no aplica. El
     genérico dice "porque escribiste a", que es cierto para quien mandó una
     consulta pero no para el dueño de un hotel al que le avisan de una
     reseña: ese nunca nos escribió. */
  pie?: string;
  /* El testigo de baja de la persona. Lo llevan SOLO los correos de cadena:
     uno que la persona pidió —la confirmación de la rifa, los datos de un
     negocio— no necesita puerta de salida, pero uno que llega porque sí
     SIEMPRE. Sin esto una cadena no es nutrición, es spam. */
  tokenBaja?: string | null;
};

const BAJA: Record<Idioma, string> = {
  es: 'No quiero recibir más correos',
  en: 'Unsubscribe',
  pt: 'Não quero receber mais e-mails',
  fr: 'Me désabonner',
  de: 'Keine E-Mails mehr',
};

/* El encabezado del bloque de razones. El CONTENIDO lo escribe Tony en
   Ajustes → Textos del sitio (clave `correo_razones`), por idioma; esto es
   solo el rótulo, que no tiene por qué configurarse. */
const PORQUE: Record<Idioma, string> = {
  es: 'Por qué reservar con nosotros',
  en: 'Why book with us',
  pt: 'Por que reservar conosco',
  fr: 'Pourquoi réserver avec nous',
  de: 'Warum bei uns buchen',
};

const PIE: Record<Idioma, string> = {
  es: 'Recibís este correo porque escribiste a',
  en: 'You are getting this email because you wrote to',
  pt: 'Você recebeu este e-mail porque escreveu para',
  fr: 'Vous recevez cet e-mail parce que vous avez écrit à',
  de: 'Du bekommst diese E-Mail, weil du geschrieben hast an',
};

/** Nada de lo que escribe una persona entra al HTML sin pasar por acá. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/*
 * Los saltos de línea de un dato, convertidos en saltos de verdad.
 *
 * En HTML un "
" es un espacio. Sin esto, una reseña con párrafos le llega
 * al dueño como un solo bloque corrido, con el título pegado al cuerpo — que
 * es exactamente como NO se lee algo que uno tiene que contestar.
 *
 * Va DESPUÉS de escapar, nunca antes: si no, el <br> que mete se escaparía
 * también y saldría escrito.
 */
function conSaltos(escapado: string): string {
  return escapado.replace(/\r?\n/g, '<br>');
}

/** Solo http y https. Un javascript: en un botón de correo no va a ninguna parte buena. */
function urlSegura(url: string): string | null {
  return /^https?:\/\/[^\s"'<>]+$/i.test(url) ? url : null;
}

/**
 * Una ruta del sitio, convertida en dirección completa.
 *
 * En el sitio, "/marca/emblema.png" funciona. En un correo NO: se abre en
 * Gmail, no en visitlafortunacr.com, así que una ruta relativa no apunta a
 * ninguna parte y la imagen sale rota. Por eso el logo del destino —que se
 * guarda como ruta— hay que completarlo con el dominio antes de meterlo.
 */
function direccionCompleta(ruta: string | null, dominio: string): string | null {
  if (!ruta) return null;
  const limpia = ruta.trim();
  if (!limpia) return null;
  if (/^https?:\/\//i.test(limpia)) return urlSegura(limpia);
  if (limpia.startsWith('/')) return `https://${dominio}${limpia}`;
  return null;
}

export function armarCorreo(pieza: Pieza): { html: string; texto: string } {
  const { destino, idioma, titulo, parrafos, boton, datos, nota, pie, tokenBaja, razones, urgencia } = pieza;

  const acento = destino.color_acento || '#FF6A00';
  const tinta = '#111111';
  const humo = '#6E6C68';
  const marca = escapar(destino.marca_nombre);
  const dominio = escapar(destino.dominio);
  const url = boton ? urlSegura(boton.url) : null;
  /* El enlace de baja va con el testigo, no con el id de la fila: un uuid
     suelto en una URL deja adivinar el de otra persona. */
  const urlBaja = tokenBaja
    ? `https://${destino.dominio}/baja?t=${encodeURIComponent(tokenBaja)}`
    : null;

  const urlLogo = direccionCompleta(destino.logo_url, destino.dominio);
  const logo = urlLogo
    ? `<img src="${urlLogo}" width="44" height="44" alt="${marca}" style="display:block;border:0;border-radius:50%;">`
    : `<span style="display:inline-block;width:44px;height:44px;border-radius:50%;background-color:${acento};"></span>`;

  /*
   * LA BANDA DE URGENCIA. Va ARRIBA del botón a propósito: abajo la lee quien
   * ya decidió, y para ese la urgencia sobra.
   *
   * ⚠️ Sale solo si hay texto puesto. Una urgencia que aparece en todos los
   * correos de todo el año deja de ser urgencia y pasa a ser decorado —y quien
   * la lee dos veces aprende a no creerle. Vacía, no sale la banda.
   *
   * Borde grueso a la izquierda y no fondo de color: en modo oscuro de Gmail
   * un fondo claro con texto oscuro se invierte y queda ilegible, mientras que
   * un borde sobrevive.
   */
  const bandaUrgencia = urgencia?.trim()
    ? `<tr><td style="padding:4px 28px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td bgcolor="#FFF6EF" style="background-color:#FFF6EF;border-left:4px solid ${acento};padding:12px 16px;border-radius:0 5px 5px 0;">
              <p style="margin:0;font:700 14px/1.5 Arial,Helvetica,sans-serif;color:#8A3D00;">${escapar(urgencia.trim())}</p>
            </td>
          </tr></table>
        </td></tr>`
    : '';

  /*
   * POR QUÉ RESERVAR CON NOSOTROS. Debajo del botón: el que ya hizo clic no lo
   * necesita, y el que dudó baja a buscar motivos. Ese es justo el orden.
   *
   * La palomita va como texto (✓) y no como imagen: Gmail bloquea imágenes por
   * omisión y una lista de recuadros rotos es peor que una lista sin viñeta.
   */
  const listaRazones = (razones ?? []).map((r) => r.trim()).filter(Boolean);
  const bloqueRazones = listaRazones.length
    ? `<tr><td style="padding:26px 28px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="border-top:1px solid #E6E6E2;padding-top:20px;">
              <p style="margin:0 0 12px;font:800 12px/1 Arial,Helvetica,sans-serif;color:${humo};letter-spacing:0.8px;text-transform:uppercase;">${escapar(PORQUE[idioma] ?? PORQUE.es)}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${listaRazones.map((r) => `<tr>
                  <td width="20" style="padding:3px 0;font:700 14px/1.6 Arial,Helvetica,sans-serif;color:${acento};vertical-align:top;">&#10003;</td>
                  <td style="padding:3px 0;font:400 14px/1.6 Arial,Helvetica,sans-serif;color:#3A3A38;">${escapar(r)}</td>
                </tr>`).join('')}
              </table>
            </td></tr>
          </table>
        </td></tr>`
    : '';

  const filasDatos = (datos ?? []).map((d) => `
            <tr>
              <td style="padding:7px 0;font:600 13px/1.5 Arial,Helvetica,sans-serif;color:${humo};width:40%;vertical-align:top;">${escapar(d.rotulo)}</td>
              <td style="padding:7px 0;font:400 14px/1.5 Arial,Helvetica,sans-serif;color:${tinta};vertical-align:top;">${conSaltos(escapar(d.valor))}</td>
            </tr>`).join('');

  const html = `<!doctype html>
<html lang="${idioma}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapar(titulo)}</title></head>
<body bgcolor="#F4F4F2" style="margin:0;padding:0;background-color:#F4F4F2;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapar(parrafos[0] ?? titulo)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#F4F4F2" style="background-color:#F4F4F2;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#FFFFFF" style="max-width:560px;background-color:#FFFFFF;border-radius:10px;overflow:hidden;">

        <tr><td bgcolor="#0B0B0B" style="background-color:#0B0B0B;padding:22px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:11px;">${logo}</td>
            <td style="font:800 17px/1 Arial,Helvetica,sans-serif;color:#FFFFFF;letter-spacing:-0.3px;">${marca}</td>
          </tr></table>
        </td></tr>

        <tr><td style="padding:34px 28px 10px;">
          <h1 style="margin:0 0 16px;font:800 25px/1.2 Arial,Helvetica,sans-serif;color:${tinta};letter-spacing:-0.5px;">${escapar(titulo)}</h1>
          ${parrafos.map((p) => `<p style="margin:0 0 14px;font:400 15px/1.65 Arial,Helvetica,sans-serif;color:#3A3A38;">${escapar(p)}</p>`).join('')}
        </td></tr>

        ${filasDatos ? `<tr><td style="padding:6px 28px 4px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#F7F7F5" style="background-color:#F7F7F5;border-radius:7px;padding:6px 16px;">
            ${filasDatos}
          </table>
        </td></tr>` : ''}

        ${bandaUrgencia}

        ${url ? `<tr><td style="padding:22px 28px 6px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td bgcolor="${acento}" style="background-color:${acento};border-radius:5px;">
              <a href="${url}" style="display:inline-block;padding:14px 30px;font:800 15px/1 Arial,Helvetica,sans-serif;color:#0B0B0B;text-decoration:none;">${escapar(boton!.texto)}</a>
            </td>
          </tr></table>
        </td></tr>` : ''}

        ${bloqueRazones}

        ${nota ? `<tr><td style="padding:18px 28px 0;">
          <p style="margin:0;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:${humo};">${escapar(nota)}</p>
        </td></tr>` : ''}

        <tr><td style="padding:28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #E6E6E2;padding-top:18px;">
            <p style="margin:0;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#9A9892;">
              ${escapar(pie ?? PIE[idioma] ?? PIE.es)} <a href="https://${dominio}" style="color:${acento};text-decoration:none;">${dominio}</a>.
            </p>
            ${urlBaja ? `<p style="margin:10px 0 0;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#9A9892;">
              <a href="${urlBaja}" style="color:#9A9892;text-decoration:underline;">${escapar(BAJA[idioma] ?? BAJA.es)}</a>
            </p>` : ''}
          </td></tr></table>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  /* La versión en texto no es un adorno: hay clientes que no pintan HTML, y
     mandar solo HTML es de las cosas que empujan un correo a spam. */
  const texto = [
    titulo,
    '',
    ...parrafos,
    ...(datos?.length ? ['', ...datos.map((d) => `${d.rotulo}: ${d.valor}`)] : []),
    /* La urgencia y las razones van TAMBIÉN acá. Quien lee en texto plano
       —o con el HTML apagado— tiene que recibir el mismo correo, no uno
       recortado: ya pasó que las dos versiones dijeran cosas distintas. */
    ...(urgencia?.trim() ? ['', urgencia.trim()] : []),
    ...(url ? ['', `${boton!.texto}: ${url}`] : []),
    ...(listaRazones.length ? ['', `${PORQUE[idioma] ?? PORQUE.es}:`, ...listaRazones.map((r) => `- ${r}`)] : []),
    ...(nota ? ['', nota] : []),
    '',
    /* `pie` primero, igual que en el HTML de arriba. Hasta hoy esta línea
       ignoraba el pie propio y metía el genérico: la versión HTML le decía al
       dueño de un hotel «porque tenés un negocio publicado en» y la de texto
       —la que se ve con las imágenes apagadas— le decía «porque escribiste
       a», que nunca pasó. Dos versiones del mismo correo diciendo cosas
       distintas, y la mentira en la que nadie mira. */
    `${pie ?? PIE[idioma] ?? PIE.es} ${destino.dominio}.`,
    ...(urlBaja ? [`${BAJA[idioma] ?? BAJA.es}: ${urlBaja}`] : []),
  ].join('\n');

  return { html, texto };
}
