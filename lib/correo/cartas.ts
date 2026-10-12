import 'server-only';
import type { Destino } from '@/lib/destino';
import type { Idioma } from '@/lib/idiomas';
import { enviarCorreo, type Envio } from './enviar';

/*
 * Los correos que manda el sitio, uno por cada cosa que pasa.
 *
 * Regla de la casa: TODO registro lleva su correo de confirmación, con la
 * marca y en el idioma que la persona tenía elegido. No hay que pedirlo.
 *
 * Si no se puede mandar —falta la llave, falta el remitente— el correo se
 * pierde pero la operación sigue. Nadie debería no poder registrar su negocio
 * porque se venció una clave de API.
 */

type Texto = Record<Idioma, string>;
const d = (t: Texto, i: Idioma) => t[i] ?? t.es;

/* ---- Alguien sumó su negocio al directorio ---- */

const NEG_ASUNTO: Texto = {
  es: 'Recibimos tu negocio',
  en: 'We got your business',
  pt: 'Recebemos o seu negócio',
  fr: 'Nous avons bien reçu votre établissement',
  de: 'Wir haben deinen Betrieb erhalten',
};
const NEG_TITULO: Texto = {
  es: '¡Listo! Ya tenemos tu negocio',
  en: 'Done. We have your business',
  pt: 'Pronto! Já temos o seu negócio',
  fr: 'C’est fait, nous avons votre établissement',
  de: 'Fertig! Wir haben deinen Betrieb',
};
const NEG_P1: Texto = {
  es: 'Gracias por sumarte. Tu ficha ya quedó guardada y la está revisando alguien del equipo antes de publicarla en el directorio.',
  en: 'Thanks for joining. Your listing is saved and someone on the team is reviewing it before it goes live in the directory.',
  pt: 'Obrigado por se juntar. Sua ficha está salva e alguém da equipe está revisando antes de publicá-la no diretório.',
  fr: 'Merci de nous rejoindre. Votre fiche est enregistrée et un membre de l’équipe la vérifie avant sa mise en ligne.',
  de: 'Danke fürs Mitmachen. Dein Eintrag ist gespeichert und jemand aus dem Team prüft ihn, bevor er im Verzeichnis erscheint.',
};
const NEG_P2: Texto = {
  es: 'Mientras tanto podés entrar a tu panel y sumarle fotos. Una ficha con fotos se mira mucho más que una sin, así que vale la pena hacerlo hoy.',
  en: 'In the meantime you can open your panel and add photos. A listing with photos gets far more looks than one without, so it is worth doing today.',
  pt: 'Enquanto isso, entre no seu painel e adicione fotos. Uma ficha com fotos é muito mais vista do que uma sem, então vale a pena fazer hoje.',
  fr: 'En attendant, connectez-vous à votre espace et ajoutez des photos. Une fiche avec photos est bien plus consultée, cela vaut la peine de le faire aujourd’hui.',
  de: 'In der Zwischenzeit kannst du dich einloggen und Fotos hinzufügen. Ein Eintrag mit Fotos wird viel öfter angesehen — mach es am besten heute.',
};
const NEG_BOTON: Texto = {
  es: 'Subir mis fotos', en: 'Add my photos', pt: 'Enviar minhas fotos',
  fr: 'Ajouter mes photos', de: 'Fotos hinzufügen',
};
const NEG_ROT_NEGOCIO: Texto = { es: 'Negocio', en: 'Business', pt: 'Negócio', fr: 'Établissement', de: 'Betrieb' };
const NEG_ROT_CAT: Texto = { es: 'Categoría', en: 'Category', pt: 'Categoria', fr: 'Catégorie', de: 'Kategorie' };
const NEG_PREMIUM: Texto = {
  es: 'Y una cosa más, por si te sirve: le hacemos un video a tu negocio, te armamos las historias para redes y te damos un mes de ficha destacada. Hay cupos a precio de lanzamiento.',
  en: 'One more thing, in case it helps: we film a video of your business, put together stories for your social media, and give you a month as a featured listing. There are launch-price spots.',
  pt: 'Mais uma coisa: filmamos um vídeo do seu negócio, montamos as histórias para as suas redes e damos um mês de ficha destacada. Há vagas a preço de lançamento.',
  fr: 'Encore une chose : nous filmons une vidéo de votre établissement, préparons vos stories et vous offrons un mois en vedette. Des places au prix de lancement sont disponibles.',
  de: 'Noch etwas: Wir drehen ein Video von deinem Betrieb, machen Stories für deine Kanäle und geben dir einen Monat als hervorgehobener Eintrag. Es gibt Plätze zum Startpreis.',
};

const NEG_NOTA: Texto = {
  es: 'Si algo no cuadra, respondé este correo y lo arreglamos.',
  en: 'If something looks off, reply to this email and we will fix it.',
  pt: 'Se algo não estiver certo, responda este e-mail e resolvemos.',
  fr: 'Si quelque chose ne va pas, répondez à cet e-mail et nous corrigerons.',
  de: 'Wenn etwas nicht stimmt, antworte einfach auf diese E-Mail.',
};

export async function correoNegocioRecibido(opciones: {
  destino: Destino;
  idioma: Idioma;
  para: string;
  negocioId: string;
  nombreNegocio: string;
  categoria?: string | null;
}): Promise<Envio> {
  const { destino, idioma, para, negocioId, nombreNegocio, categoria } = opciones;

  /* El premium se menciona al final y en una sola línea. Este correo es
     para confirmarle que lo recibimos; si lo primero que lee es una oferta,
     el mensaje deja de ser una confirmación y pasa a ser publicidad. */
  const ofrecer = destino.premium_activo && Boolean(destino.premium_precio_usd);

  return enviarCorreo({
    destino,
    idioma,
    para,
    asunto: `${d(NEG_ASUNTO, idioma)}: ${nombreNegocio}`,
    motivo: 'negocio_recibido',
    titulo: d(NEG_TITULO, idioma),
    parrafos: ofrecer
      ? [d(NEG_P1, idioma), d(NEG_P2, idioma), d(NEG_PREMIUM, idioma)]
      : [d(NEG_P1, idioma), d(NEG_P2, idioma)],
    datos: [
      { rotulo: d(NEG_ROT_NEGOCIO, idioma), valor: nombreNegocio },
      ...(categoria ? [{ rotulo: d(NEG_ROT_CAT, idioma), valor: categoria }] : []),
    ],
    boton: { texto: d(NEG_BOTON, idioma), url: `https://${destino.dominio}/negocio/${negocioId}` },
    nota: d(NEG_NOTA, idioma),
  });
}

/* ---- Alguien consultó una experiencia ---- */

const EXP_ASUNTO: Texto = {
  es: 'Recibimos tu consulta',
  en: 'We got your enquiry',
  pt: 'Recebemos a sua consulta',
  fr: 'Nous avons bien reçu votre demande',
  de: 'Wir haben deine Anfrage erhalten',
};
const EXP_TITULO: Texto = {
  es: 'Un asesor te escribe dentro de 24 horas',
  en: 'An advisor writes back within 24 hours',
  pt: 'Um consultor responde em até 24 horas',
  fr: 'Un conseiller vous répond sous 24 heures',
  de: 'Ein Berater meldet sich innerhalb von 24 Stunden',
};
const EXP_P1: Texto = {
  es: 'Gracias por escribirnos. Esto no es una compra ni reserva nada todavía: alguien de acá va a revisar fechas y disponibilidad de verdad con los operadores, y después te escribe con el precio firme.',
  en: 'Thanks for writing. This is not a purchase and books nothing yet: someone here will check real dates and availability with the operators, then write back with a firm price.',
  pt: 'Obrigado por escrever. Isto não é uma compra nem reserva nada ainda: alguém daqui vai verificar datas e disponibilidade reais com os operadores e depois responde com o preço firme.',
  fr: 'Merci de nous avoir écrit. Ceci n’est pas un achat et ne réserve encore rien : quelqu’un ici vérifiera les dates et la disponibilité réelles auprès des prestataires, puis vous écrira avec le prix ferme.',
  de: 'Danke für deine Nachricht. Das ist kein Kauf und bucht noch nichts: jemand von uns prüft echte Termine und Verfügbarkeit bei den Anbietern und meldet sich dann mit dem festen Preis.',
};
const EXP_P2: Texto = {
  es: 'Escribimos desde Costa Rica, así que si consultaste de noche puede que la respuesta te llegue a la mañana siguiente.',
  en: 'We write from Costa Rica, so if you asked at night the reply may land the next morning.',
  pt: 'Escrevemos da Costa Rica, então se você consultou à noite a resposta pode chegar na manhã seguinte.',
  fr: 'Nous écrivons depuis le Costa Rica : si vous avez écrit la nuit, la réponse peut arriver le lendemain matin.',
  de: 'Wir schreiben aus Costa Rica — wenn du nachts angefragt hast, kommt die Antwort womöglich am nächsten Morgen.',
};
const EXP_BOTON: Texto = {
  es: 'Volver a ver el viaje', en: 'See the trip again', pt: 'Ver a viagem de novo',
  fr: 'Revoir le voyage', de: 'Reise nochmal ansehen',
};
const EXP_ROT_VIAJE: Texto = { es: 'Viaje', en: 'Trip', pt: 'Viagem', fr: 'Voyage', de: 'Reise' };
const EXP_ROT_FECHA: Texto = { es: 'Para la fecha', en: 'For', pt: 'Para a data', fr: 'Pour le', de: 'Für den' };
const EXP_ROT_PERSONAS: Texto = { es: 'Personas', en: 'Travellers', pt: 'Pessoas', fr: 'Voyageurs', de: 'Personen' };
const EXP_NOTA: Texto = {
  es: 'Podés responder este correo con cualquier cosa que se te haya quedado por fuera.',
  en: 'Feel free to reply to this email with anything you left out.',
  pt: 'Pode responder este e-mail com qualquer coisa que tenha ficado de fora.',
  fr: 'Vous pouvez répondre à cet e-mail pour tout ce que vous auriez oublié.',
  de: 'Du kannst auf diese E-Mail antworten, falls noch etwas fehlt.',
};

export async function correoConsultaRecibida(opciones: {
  destino: Destino;
  idioma: Idioma;
  para: string;
  tituloViaje: string;
  babosa: string;
  fecha?: string | null;
  personas?: number | null;
}): Promise<Envio> {
  const { destino, idioma, para, tituloViaje, babosa, fecha, personas } = opciones;
  return enviarCorreo({
    destino,
    idioma,
    para,
    asunto: `${d(EXP_ASUNTO, idioma)}: ${tituloViaje}`,
    motivo: 'consulta_recibida',
    titulo: d(EXP_TITULO, idioma),
    parrafos: [d(EXP_P1, idioma), d(EXP_P2, idioma)],
    datos: [
      { rotulo: d(EXP_ROT_VIAJE, idioma), valor: tituloViaje },
      ...(fecha ? [{ rotulo: d(EXP_ROT_FECHA, idioma), valor: fecha }] : []),
      ...(personas ? [{ rotulo: d(EXP_ROT_PERSONAS, idioma), valor: String(personas) }] : []),
    ],
    boton: {
      texto: d(EXP_BOTON, idioma),
      url: `https://${destino.dominio}/${idioma}/experiencias/${babosa}`,
    },
    nota: d(EXP_NOTA, idioma),
  });
}

/* ---- Alguien pidio los datos de un negocio ---- */
/*
 * Este correo va al NEGOCIO, no al visitante. Es la mitad que hace que el
 * muro valga la pena: el dueno se entera de que alguien pregunto por el, con
 * nombre y forma de contestarle. Sin esto, tapar el telefono solo molesta.
 */

const PID_ASUNTO: Texto = {
  es: 'Alguien pidio tus datos en el directorio',
  en: 'Someone asked for your contact details',
  pt: 'Alguém pediu os seus dados',
  fr: 'Quelqu’un a demandé vos coordonnées',
  de: 'Jemand hat nach deinen Kontaktdaten gefragt',
};
const PID_TITULO: Texto = {
  es: 'Alguien pregunto por vos',
  en: 'Someone asked about you',
  pt: 'Alguém perguntou por você',
  fr: 'Quelqu’un s’est renseigné sur vous',
  de: 'Jemand hat nach dir gefragt',
};
const PID_P1: Texto = {
  es: 'Una persona acaba de desbloquear tus datos de contacto en el directorio. Aca abajo estan los suyos: escribile vos primero.',
  en: 'Someone just unlocked your contact details in the directory. Theirs are below: write to them first.',
  pt: 'Alguém acabou de desbloquear os seus dados no diretório. Os dados dessa pessoa estão abaixo: escreva primeiro.',
  fr: 'Quelqu’un vient de débloquer vos coordonnées dans l’annuaire. Voici les siennes : écrivez-lui en premier.',
  de: 'Jemand hat gerade deine Kontaktdaten im Verzeichnis freigeschaltet. Hier sind seine: schreib du zuerst.',
};
const PID_P2: Texto = {
  es: 'Quien contesta rapido cierra. En turismo la primera respuesta se lleva la reserva casi siempre.',
  en: 'Whoever answers first usually gets the booking. In tourism, speed closes.',
  pt: 'Quem responde primeiro costuma fechar. No turismo, a rapidez fecha a reserva.',
  fr: 'Celui qui répond en premier emporte presque toujours la réservation.',
  de: 'Wer zuerst antwortet, bekommt meist die Buchung. Im Tourismus entscheidet die Geschwindigkeit.',
};
const PID_ROT_QUIEN: Texto = { es: 'Quien pregunto', en: 'Who asked', pt: 'Quem perguntou', fr: 'Qui a demandé', de: 'Wer gefragt hat' };
const PID_ROT_CORREO: Texto = { es: 'Su correo', en: 'Their email', pt: 'E-mail', fr: 'Son e-mail', de: 'E-Mail' };
const PID_ROT_WA: Texto = { es: 'Su WhatsApp', en: 'Their WhatsApp', pt: 'WhatsApp', fr: 'Son WhatsApp', de: 'WhatsApp' };
const PID_ROT_NEG: Texto = { es: 'Tu ficha', en: 'Your listing', pt: 'Sua ficha', fr: 'Votre fiche', de: 'Dein Eintrag' };
const PID_BOTON: Texto = {
  es: 'Ver mi ficha', en: 'See my listing', pt: 'Ver minha ficha',
  fr: 'Voir ma fiche', de: 'Eintrag ansehen',
};
const PID_NOTA: Texto = {
  es: 'Te llega este aviso porque tu negocio esta en el directorio. Si no queres recibirlos, respondé este correo.',
  en: 'You get this because your business is in the directory. If you would rather not, reply to this email.',
  pt: 'Você recebe isto porque seu negócio está no diretório. Se preferir não receber, responda este e-mail.',
  fr: 'Vous recevez ceci car votre établissement est dans l’annuaire. Si vous préférez ne plus les recevoir, répondez à cet e-mail.',
  de: 'Du bekommst das, weil dein Betrieb im Verzeichnis steht. Wenn du das nicht möchtest, antworte auf diese E-Mail.',
};
const PID_SIN_NOMBRE: Texto = {
  es: 'No dejo nombre', en: 'Left no name', pt: 'Não deixou nome',
  fr: 'N’a pas laissé de nom', de: 'Hat keinen Namen hinterlassen',
};

export async function correoPidieronTusDatos(opciones: {
  destino: Destino;
  idioma: Idioma;
  para: string;
  nombreNegocio: string;
  quien: string | null;
  correoDeQuien: string | null;
  whatsappDeQuien: string | null;
}): Promise<Envio> {
  const { destino, idioma, para, nombreNegocio, quien, correoDeQuien, whatsappDeQuien } = opciones;
  return enviarCorreo({
    destino,
    idioma,
    para,
    asunto: `${d(PID_ASUNTO, idioma)} — ${nombreNegocio}`,
    motivo: 'pidieron_tus_datos',
    titulo: d(PID_TITULO, idioma),
    parrafos: [d(PID_P1, idioma), d(PID_P2, idioma)],
    datos: [
      { rotulo: d(PID_ROT_NEG, idioma), valor: nombreNegocio },
      { rotulo: d(PID_ROT_QUIEN, idioma), valor: quien ?? d(PID_SIN_NOMBRE, idioma) },
      ...(correoDeQuien ? [{ rotulo: d(PID_ROT_CORREO, idioma), valor: correoDeQuien }] : []),
      ...(whatsappDeQuien ? [{ rotulo: d(PID_ROT_WA, idioma), valor: whatsappDeQuien }] : []),
    ],
    boton: { texto: d(PID_BOTON, idioma), url: `https://${destino.dominio}/negocio` },
    nota: d(PID_NOTA, idioma),
    /* Que el negocio le pueda responder directo a la persona con "Responder". */
    responder_a: correoDeQuien ?? undefined,
  });
}

/* ---- Alguien pidio una reserva ----
   Dos correos y NO uno: el del viajero le dice que lo recibimos (sin
   prometer que esta reservado, porque no lo esta), y el del equipo es la
   unica razon por la que alguien va a mirar el panel. Una solicitud que
   nadie ve es peor que no tener el boton. */

const RES_ASUNTO: Texto = {
  es: 'Recibimos tu solicitud',
  en: 'We got your request',
  pt: 'Recebemos sua solicitacao',
  fr: 'Nous avons recu votre demande',
  de: 'Wir haben deine Anfrage',
};
const RES_TITULO: Texto = {
  es: 'Recibimos tu solicitud',
  en: 'We got your request',
  pt: 'Recebemos sua solicitacao',
  fr: 'Nous avons recu votre demande',
  de: 'Wir haben deine Anfrage',
};
/* Dice exactamente lo que pasa: NO esta reservado y NO se cobro. Prometer
   una confirmacion que todavia depende del operador es la forma mas rapida
   de que alguien llegue y no haya campo. */
const RES_P1: Texto = {
  es: 'Todavía no está reservado ni se cobró nada. Vamos a consultar la disponibilidad con el operador y te escribimos apenas tengamos respuesta.',
  en: 'Nothing is booked and nothing has been charged yet. We will check availability with the operator and write back as soon as we hear.',
  pt: 'Ainda não está reservado nem foi cobrado nada. Vamos consultar a disponibilidade com o operador e escrevemos assim que tivermos resposta.',
  fr: "Rien n'est encore réservé ni débité. Nous allons vérifier les disponibilités auprès de l'opérateur et vous répondrons dès que possible.",
  de: 'Es ist noch nichts gebucht und nichts abgebucht. Wir fragen die Verfügbarkeit beim Anbieter an und melden uns, sobald wir Bescheid wissen.',
};
const RES_P2: Texto = {
  es: 'Si algo cambia en tus planes, respondé este correo y lo ajustamos.',
  en: 'If your plans change, just reply to this email and we will adjust it.',
  pt: 'Se algo mudar nos seus planos, responda este e-mail e ajustamos.',
  fr: 'Si vos plans changent, répondez à cet e-mail et nous ajusterons.',
  de: 'Wenn sich deine Pläne ändern, antworte einfach auf diese E-Mail.',
};
const RES_ROT_CODIGO: Texto = { es: 'Código', en: 'Code', pt: 'Código', fr: 'Code', de: 'Code' };
const RES_ROT_QUE: Texto = { es: 'Qué', en: 'What', pt: 'O quê', fr: 'Quoi', de: 'Was' };
const RES_ROT_CUANDO: Texto = { es: 'Cuándo', en: 'When', pt: 'Quando', fr: 'Quand', de: 'Wann' };
const RES_ROT_GENTE: Texto = { es: 'Personas', en: 'People', pt: 'Pessoas', fr: 'Personnes', de: 'Personen' };
const RES_ROT_TOTAL: Texto = { es: 'Total estimado', en: 'Estimated total', pt: 'Total estimado', fr: 'Total estimé', de: 'Geschätzte Summe' };
const RES_NOTA: Texto = {
  es: 'El operador del servicio es quien presta la actividad. Nosotros gestionamos la reserva.',
  en: 'The operator provides the activity itself. We handle the booking.',
  pt: 'O operador presta a atividade. Nós cuidamos da reserva.',
  fr: "L'opérateur assure l'activité. Nous gérons la réservation.",
  de: 'Der Anbieter führt die Aktivität durch. Wir kümmern uns um die Buchung.',
};

export async function correoReservaPedida(opciones: {
  destino: Destino;
  idioma: Idioma;
  para: string;
  codigo: string;
  producto: string;
  operador: string;
  paraEl: string;
  personas: number;
  totalUsd: number | null;
}): Promise<Envio> {
  const { destino, idioma, para, codigo, producto, operador, paraEl, personas, totalUsd } = opciones;
  return enviarCorreo({
    destino,
    idioma,
    para,
    asunto: `${d(RES_ASUNTO, idioma)} · ${codigo}`,
    motivo: 'reserva_pedida',
    titulo: d(RES_TITULO, idioma),
    parrafos: [d(RES_P1, idioma), d(RES_P2, idioma)],
    datos: [
      { rotulo: d(RES_ROT_CODIGO, idioma), valor: codigo },
      { rotulo: d(RES_ROT_QUE, idioma), valor: `${producto} — ${operador}` },
      { rotulo: d(RES_ROT_CUANDO, idioma), valor: paraEl },
      { rotulo: d(RES_ROT_GENTE, idioma), valor: String(personas) },
      /* El total solo si de verdad hay uno. Un "$0" aqui se lee como gratis. */
      ...(totalUsd != null ? [{ rotulo: d(RES_ROT_TOTAL, idioma), valor: `$${totalUsd}` }] : []),
    ],
    nota: d(RES_NOTA, idioma),
  });
}

/** Al equipo. En español siempre: lo lee quien opera, no el viajero. */
export async function correoReservaAlEquipo(opciones: {
  destino: Destino;
  para: string;
  codigo: string;
  producto: string;
  operador: string;
  paraEl: string;
  adultos: number;
  ninos: number;
  totalUsd: number | null;
  nombre: string;
  email: string;
  whatsapp: string | null;
  notas: string | null;
  reservaId: string;
}): Promise<Envio> {
  const o = opciones;
  const gente = [
    `${o.adultos} adulto${o.adultos === 1 ? '' : 's'}`,
    ...(o.ninos > 0 ? [`${o.ninos} niño${o.ninos === 1 ? '' : 's'}`] : []),
  ].join(' + ');

  return enviarCorreo({
    destino: o.destino,
    idioma: 'es',
    para: o.para,
    asunto: `Solicitud de reserva ${o.codigo} · ${o.operador}`,
    motivo: 'reserva_al_equipo',
    titulo: 'Entró una solicitud de reserva',
    parrafos: [
      `Hay que consultarle la disponibilidad a ${o.operador} y volver al panel a confirmar o rechazar.`,
      'Confirmar pide la referencia que dé el operador: sin eso no hay prueba de que el cupo exista.',
    ],
    datos: [
      { rotulo: 'Código', valor: o.codigo },
      { rotulo: 'Producto', valor: o.producto },
      { rotulo: 'Operador', valor: o.operador },
      { rotulo: 'Fecha', valor: o.paraEl },
      { rotulo: 'Personas', valor: gente },
      { rotulo: 'Total', valor: o.totalUsd != null ? `$${o.totalUsd}` : 'sin cotizar' },
      { rotulo: 'Quién', valor: `${o.nombre} · ${o.email}${o.whatsapp ? ` · ${o.whatsapp}` : ''}` },
      ...(o.notas ? [{ rotulo: 'Nota', valor: o.notas }] : []),
    ],
    boton: {
      texto: 'Abrir la reserva',
      url: `https://${o.destino.dominio}/admin/reservas/${o.reservaId}`,
    },
    /* Para que al dar "responder" se le conteste al viajero y no al buzon
       del sitio: nueve de cada diez veces lo que sigue es escribirle. */
    responder_a: o.email,
  });
}

/* ---- Le publicaron una reseña a un negocio ----------------------------
 *
 * Va al dueño, no al equipo, y lleva la reseña ENTERA: una notificación que
 * dice "tenés una reseña nueva" obliga a entrar para saber si es buena o
 * mala, y el que la recibe en el teléfono a las nueve de la noche no entra.
 *
 * El botón abre la caja de respuesta sin pedir clave, con un enlace de un
 * solo uso que sirve para ESA reseña y nada más. Pedirle la contraseña a un
 * dueño de hotel para contestar dos líneas es perder la respuesta.
 */

const REV_ASUNTO: Texto = {
  es: 'Te dejaron una reseña',
  en: 'You got a review',
  pt: 'Deixaram uma avaliacao',
  fr: 'Vous avez recu un avis',
  de: 'Du hast eine Bewertung erhalten',
};
const REV_TITULO: Texto = {
  es: 'Una reseña nueva en tu ficha',
  en: 'A new review on your listing',
  pt: 'Uma nova avaliacao na sua ficha',
  fr: 'Un nouvel avis sur votre fiche',
  de: 'Eine neue Bewertung auf deinem Eintrag',
};
const REV_P1: Texto = {
  es: 'Esto es lo que escribieron. Podés responder desde aquí, sin entrar a tu cuenta.',
  en: 'This is what they wrote. You can reply right here, without signing in.',
  pt: 'Isto foi o que escreveram. Voce pode responder daqui, sem entrar na conta.',
  fr: 'Voici ce qu’ils ont ecrit. Vous pouvez repondre d’ici, sans vous connecter.',
  de: 'Das wurde geschrieben. Du kannst direkt hier antworten, ohne dich anzumelden.',
};
const REV_P2: Texto = {
  es: 'Tu respuesta se publica debajo de la reseña, con el nombre de tu negocio. La ve cualquiera que entre a tu ficha.',
  en: 'Your reply is published under the review, with your business name. Anyone visiting your listing can see it.',
  pt: 'Sua resposta aparece abaixo da avaliacao, com o nome do seu negocio. Qualquer pessoa que entrar na sua ficha a ve.',
  fr: 'Votre reponse s’affiche sous l’avis, avec le nom de votre etablissement. Toute personne qui consulte votre fiche la voit.',
  de: 'Deine Antwort erscheint unter der Bewertung, mit dem Namen deines Betriebs. Jeder, der deinen Eintrag besucht, sieht sie.',
};
const REV_BOTON: Texto = {
  es: 'Responder esta reseña',
  en: 'Reply to this review',
  pt: 'Responder esta avaliacao',
  fr: 'Repondre a cet avis',
  de: 'Auf diese Bewertung antworten',
};
const REV_ROT_NOTA: Texto = { es: 'Calificación', en: 'Rating', pt: 'Nota', fr: 'Note', de: 'Bewertung' };
const REV_ROT_QUIEN: Texto = { es: 'Quién la escribió', en: 'Who wrote it', pt: 'Quem escreveu', fr: 'Qui l’a ecrit', de: 'Wer sie geschrieben hat' };
const REV_ROT_QUE: Texto = { es: 'Lo que dice', en: 'What it says', pt: 'O que diz', fr: 'Ce qu’il dit', de: 'Was darin steht' };
const REV_NOTA: Texto = {
  es: 'El enlace sirve una sola vez y vence en siete días. Si se vence, podés responder entrando a tu cuenta.',
  en: 'The link works once and expires in seven days. If it expires, you can reply by signing in to your account.',
  pt: 'O link serve uma unica vez e vence em sete dias. Se vencer, voce pode responder entrando na sua conta.',
  fr: 'Le lien ne fonctionne qu’une fois et expire dans sept jours. S’il expire, vous pouvez repondre en vous connectant.',
  de: 'Der Link funktioniert einmal und lauft in sieben Tagen ab. Danach kannst du dich anmelden und antworten.',
};

export async function correoResenaNueva(opciones: {
  destino: Destino;
  idioma: Idioma;
  para: string;
  negocio: string;
  calificacion: number;
  titulo: string | null;
  cuerpo: string;
  autor: string;
  enlace: string;
  tokenBaja?: string | null;
}): Promise<Envio> {
  const { destino, idioma, para, negocio, calificacion, titulo, cuerpo, autor, enlace, tokenBaja } = opciones;
  return enviarCorreo({
    destino,
    idioma,
    para,
    asunto: `${d(REV_ASUNTO, idioma)} · ${negocio}`,
    motivo: 'resena_nueva',
    titulo: d(REV_TITULO, idioma),
    parrafos: [d(REV_P1, idioma), d(REV_P2, idioma)],
    datos: [
      { rotulo: d(REV_ROT_NOTA, idioma), valor: `${calificacion}/5` },
      { rotulo: d(REV_ROT_QUIEN, idioma), valor: autor },
      /* El cuerpo entero, no un recorte: el duenno tiene que poder decidir si
         contesta sin abrir nada. Se corta a 1200 porque un correo no es el
         lugar para una resena de cinco mil caracteres. */
      { rotulo: d(REV_ROT_QUE, idioma), valor: (titulo ? `${titulo}\n\n` : '') + cuerpo.slice(0, 1200) },
    ],
    boton: { texto: d(REV_BOTON, idioma), url: enlace },
    nota: d(REV_NOTA, idioma),
    tokenBaja,
  });
}
