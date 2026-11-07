import 'server-only';
import type { Destino } from '@/lib/destino';
import { NOMBRE_PROPIO, type Idioma } from '@/lib/idiomas';
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
const RES_ROT_PAGO: Texto = { es: 'Cómo se paga', en: 'How to pay', pt: 'Como se paga', fr: 'Comment payer', de: 'Bezahlung' };
const RES_ROT_LLEVAR: Texto = { es: 'Qué llevar', en: 'What to bring', pt: 'O que levar', fr: 'À apporter', de: 'Was mitbringen' };
const RES_ROT_CANCELA: Texto = { es: 'Si necesitás cancelar', en: 'If you need to cancel', pt: 'Se precisar cancelar', fr: 'En cas d’annulation', de: 'Wenn Sie stornieren müssen' };
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
  /* Lo que el operador firmó y el viajero tiene que saber ANTES de llegar.
     Sale del contrato y lo aprobó una persona en el panel — nunca se arma
     acá ni se completa con algo plausible: ver lib/ia/contrato.ts. */
  politicaCancelacion?: string | null;
  condicionesPago?: string | null;
  queLlevar?: string | null;
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
      /* Cada uno solo si está. Un rótulo «Cancelación» seguido de nada es
         peor que no ponerlo: parece que no hay política. */
      ...(opciones.condicionesPago
        ? [{ rotulo: d(RES_ROT_PAGO, idioma), valor: opciones.condicionesPago }] : []),
      ...(opciones.queLlevar
        ? [{ rotulo: d(RES_ROT_LLEVAR, idioma), valor: opciones.queLlevar }] : []),
      ...(opciones.politicaCancelacion
        ? [{ rotulo: d(RES_ROT_CANCELA, idioma), valor: opciones.politicaCancelacion }] : []),
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
/* El pie propio. El genérico dice "porque escribiste a", y el dueño de un
   hotel nunca nos escribió: tiene un negocio en el directorio. */
const REV_PIE: Texto = {
  es: 'Recibís este correo porque tenés un negocio publicado en',
  en: 'You are getting this email because you have a business listed on',
  pt: 'Você recebe este e-mail porque tem um negócio publicado em',
  fr: 'Vous recevez cet e-mail parce que vous avez un établissement référencé sur',
  de: 'Du bekommst diese E-Mail, weil du einen Betrieb eingetragen hast auf',
};
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
    pie: d(REV_PIE, idioma),
    tokenBaja,
  });
}

/* ---- Al negocio le falta la descripción o las fotos ---------------------
 *
 * EL AGUJERO QUE TAPA: el dueño recibía UN correo en toda su vida —el de
 * «recibimos tu negocio»— y después silencio. Si no completaba la ficha,
 * nadie se lo decía nunca. Dreamlike Adventures se inscribió, no subió ni
 * descripción ni fotos, y así se quedó: no es que el dueño no quisiera, es
 * que nunca se le pidió.
 *
 * Dice QUÉ falta, no «completá tu perfil». Un pedido genérico se pospone; uno
 * que dice «faltan las fotos» se puede hacer en cinco minutos desde el
 * teléfono.
 *
 * Y dice por qué conviene, sin amenazar: una ficha sin foto se ve menos. Es
 * verdad y es lo que mueve.
 */

const FAL_ASUNTO: Texto = {
  es: 'Le faltan las fotos a tu ficha',
  en: 'Your listing is missing photos',
  pt: 'Falta as fotos na sua ficha',
  fr: 'Il manque des photos à votre fiche',
  de: 'Deinem Eintrag fehlen Fotos',
};
const FAL_ASUNTO_DESC: Texto = {
  es: 'Le falta la descripción a tu ficha',
  en: 'Your listing is missing its description',
  pt: 'Falta a descrição na sua ficha',
  fr: 'Il manque la description de votre fiche',
  de: 'Deinem Eintrag fehlt die Beschreibung',
};
const FAL_ASUNTO_TOURS: Texto = {
  es: 'Te faltan los tours',
  en: 'Your tours are missing',
  pt: 'Faltam os seus tours',
  fr: 'Il manque vos excursions',
  de: 'Deine Touren fehlen',
};
const FAL_P2_TOURS: Texto = {
  es: 'Como operador no llevás ficha propia en el directorio: lo que se publica son tus tours, cada uno con su foto, su precio y qué incluye. Sin tours cargados no hay nada que mostrar.',
  en: 'As an operator you do not get your own listing in the directory: what gets published are your tours, each with its photo, price and what is included. With no tours loaded there is nothing to show.',
  pt: 'Como operador não tem ficha própria no diretório: o que se publica são os seus tours, cada um com a sua foto, o preço e o que inclui. Sem tours carregados não há nada para mostrar.',
  fr: 'En tant que prestataire vous n’avez pas de fiche propre dans l’annuaire : ce qui est publié, ce sont vos excursions, chacune avec sa photo, son prix et ce qu’elle comprend. Sans excursions, il n’y a rien à montrer.',
  de: 'Als Anbieter hast du keinen eigenen Eintrag im Verzeichnis: veröffentlicht werden deine Touren, jede mit Foto, Preis und Leistungen. Ohne Touren gibt es nichts zu zeigen.',
};
const FAL_TOURS: Texto = {
  es: 'los tours', en: 'the tours', pt: 'os tours', fr: 'les excursions', de: 'die Touren',
};
const FAL_BOTON_TOURS: Texto = {
  es: 'Cargar mis tours', en: 'Add my tours', pt: 'Carregar os meus tours',
  fr: 'Ajouter mes excursions', de: 'Touren hinzufügen',
};

const FAL_ASUNTO_AMBOS: Texto = {
  es: 'Te falta poco para que tu ficha salga',
  en: 'Your listing is almost ready',
  pt: 'Falta pouco para a sua ficha sair',
  fr: 'Votre fiche est presque prête',
  de: 'Dein Eintrag ist fast fertig',
};
const FAL_TITULO: Texto = {
  es: 'Nos falta esto para terminar tu ficha',
  en: 'We need this to finish your listing',
  pt: 'Precisamos disto para terminar a sua ficha',
  fr: 'Il nous faut ceci pour terminer votre fiche',
  de: 'Das brauchen wir noch für deinen Eintrag',
};
const FAL_P1: Texto = {
  es: 'Tu negocio ya está en el directorio, pero le falta algo para quedar completo. Se arregla desde el teléfono en unos minutos: tocá el botón de abajo y listo.',
  en: 'Your business is already in the directory, but something is missing. You can sort it from your phone in a few minutes: tap the button below.',
  pt: 'O seu negócio já está no diretório, mas falta algo. Resolve-se pelo telemóvel em poucos minutos: toque no botão abaixo.',
  fr: 'Votre établissement est déjà dans l’annuaire, mais il manque quelque chose. Cela se règle depuis votre téléphone en quelques minutes : appuyez sur le bouton ci-dessous.',
  de: 'Dein Betrieb ist schon im Verzeichnis, aber es fehlt noch etwas. Das geht in wenigen Minuten vom Handy aus: tippe unten auf den Button.',
};
const FAL_P2_FOTOS: Texto = {
  es: 'Las fotos son lo que más mueve: una ficha con fotos la abre mucha más gente que una sin. Con tres o cuatro buenas ya se nota — no hace falta un fotógrafo, las del teléfono sirven.',
  en: 'Photos move the needle most: a listing with photos gets opened far more than one without. Three or four good ones already make a difference — no photographer needed, phone photos work.',
  pt: 'As fotos são o que mais pesa: uma ficha com fotos é aberta por muito mais gente. Três ou quatro boas já fazem diferença — não precisa de fotógrafo, as do telemóvel servem.',
  fr: 'Les photos comptent le plus : une fiche avec photos est bien plus consultée. Trois ou quatre bonnes suffisent — pas besoin de photographe, celles du téléphone conviennent.',
  de: 'Fotos bringen am meisten: ein Eintrag mit Fotos wird viel öfter geöffnet. Drei oder vier gute reichen schon — kein Fotograf nötig, Handyfotos genügen.',
};
const FAL_P2_DESC: Texto = {
  es: 'Con la descripción contanos en pocas líneas qué hacés y qué tenés de distinto. Escribila como se la contarías a alguien que llega preguntando: eso es lo que lee el viajero.',
  en: 'For the description, tell us in a few lines what you do and what makes you different. Write it the way you would tell someone who walks in asking: that is what the traveller reads.',
  pt: 'Na descrição, conte em poucas linhas o que faz e o que tem de diferente. Escreva como contaria a alguém que chega a perguntar: é isso que o viajante lê.',
  fr: 'Pour la description, dites-nous en quelques lignes ce que vous faites et ce qui vous distingue. Écrivez-la comme vous la raconteriez à quelqu’un qui entre : c’est ce que lit le voyageur.',
  de: 'Bei der Beschreibung: erzähl in wenigen Zeilen, was du machst und was dich ausmacht. Schreib sie so, wie du es jemandem erzählen würdest, der hereinkommt — genau das liest der Reisende.',
};
const FAL_BOTON: Texto = {
  es: 'Completar mi ficha', en: 'Complete my listing', pt: 'Completar a minha ficha',
  fr: 'Compléter ma fiche', de: 'Eintrag vervollständigen',
};
const FAL_ROT_FALTA: Texto = {
  es: 'Lo que falta', en: 'What is missing', pt: 'O que falta',
  fr: 'Ce qui manque', de: 'Was noch fehlt',
};
/* En minuscula, porque se unen: «las fotos y la descripcion». Con mayuscula
   quedaba «Las fotos y La descripción», con una L a media frase. La primera
   letra se pone en mayuscula al final, una sola vez. */
const FAL_FOTOS: Texto = {
  es: 'las fotos', en: 'photos', pt: 'as fotos', fr: 'les photos', de: 'die Fotos',
};
const FAL_DESC: Texto = {
  es: 'la descripción', en: 'the description', pt: 'a descrição',
  fr: 'la description', de: 'die Beschreibung',
};
const FAL_Y: Texto = { es: 'y', en: 'and', pt: 'e', fr: 'et', de: 'und' };
const FAL_NOTA: Texto = {
  es: 'Si preferís que lo hagamos nosotros, respondé este correo y lo vemos.',
  en: 'If you would rather we did it, reply to this email and we will sort it out.',
  pt: 'Se preferir que façamos nós, responda este e-mail e vemos isso.',
  fr: 'Si vous préférez que nous nous en chargions, répondez à cet e-mail.',
  de: 'Wenn wir das lieber übernehmen sollen, antworte einfach auf diese E-Mail.',
};

/**
 * Las piezas de la carta, SIN mandarla.
 *
 * Va separado del envio por la regla de la casa: el correo se lee en pantalla
 * antes de que salga. Si armar y mandar fueran lo mismo, la unica forma de ver
 * como quedo seria mandarselo a alguien — o copiar los textos a una vista
 * previa aparte, que es peor, porque al primer cambio la vista previa empieza
 * a mentir.
 */
export function piezasFaltaCompletarFicha(opciones: {
  destino: Destino;
  idioma: Idioma;
  negocioId: string;
  nombreNegocio: string;
  faltaDescripcion: boolean;
  faltanFotos: boolean;
  /* ⚠️ UN OPERADOR NO TIENE FICHA. No sale en el directorio: lo que se publica
     son sus tours. Pedirle «las fotos de tu ficha» a un operador es pedirle
     algo que no existe, y el que lo recibe entra al portal, no encuentra
     dónde ponerlas y se va. Lo que le falta a un operador son TOURS. */
  faltanTours?: boolean;
  esOperador?: boolean;
}) {
  const {
    destino, idioma, negocioId, nombreNegocio,
    faltaDescripcion, faltanFotos, faltanTours = false, esOperador = false,
  } = opciones;

  /* El asunto dice QUÉ falta. «Completá tu perfil» se ignora; «le faltan las
     fotos a tu ficha» se abre, porque ya dice qué hay que hacer. */
  const cuantas = [faltaDescripcion, faltanFotos, faltanTours].filter(Boolean).length;
  const asunto = cuantas > 1
    ? d(FAL_ASUNTO_AMBOS, idioma)
    : faltanTours ? d(FAL_ASUNTO_TOURS, idioma)
    : faltanFotos ? d(FAL_ASUNTO, idioma)
    : d(FAL_ASUNTO_DESC, idioma);

  const lista = [
    faltanTours ? d(FAL_TOURS, idioma) : null,
    faltanFotos ? d(FAL_FOTOS, idioma) : null,
    faltaDescripcion ? d(FAL_DESC, idioma) : null,
  ].filter(Boolean).join(` ${d(FAL_Y, idioma)} `);
  const queFalta = lista.charAt(0).toUpperCase() + lista.slice(1);

  /* Un párrafo por cosa que falte, y solo por lo que falte: explicarle las
     fotos a quien ya las subió es ruido, y el ruido es lo que hace que el
     próximo correo no se abra. */
  const parrafos = [
    d(FAL_P1, idioma),
    ...(faltanTours ? [d(FAL_P2_TOURS, idioma)] : []),
    ...(faltanFotos ? [d(FAL_P2_FOTOS, idioma)] : []),
    ...(faltaDescripcion ? [d(FAL_P2_DESC, idioma)] : []),
  ];

  return {
    asunto: `${asunto} — ${nombreNegocio}`,
    motivo: 'falta_completar_ficha',
    titulo: d(FAL_TITULO, idioma),
    parrafos,
    datos: [{ rotulo: d(FAL_ROT_FALTA, idioma), valor: queFalta }],
    /* El boton lleva adonde se arregla. A un operador al que le faltan tours
       mandarlo a la pantalla de su ficha es mandarlo al lugar equivocado. */
    boton: esOperador && faltanTours
      ? { texto: d(FAL_BOTON_TOURS, idioma), url: `https://${destino.dominio}/negocio/${negocioId}/tours` }
      : { texto: d(FAL_BOTON, idioma), url: `https://${destino.dominio}/negocio/${negocioId}` },
    nota: d(FAL_NOTA, idioma),
  };
}

/* El tipo sale de la funcion que arma las piezas, no copiado a mano. Copiarlo
   fue justo lo que rompio: se le agregaron `faltanTours` y `esOperador` a las
   piezas y esta firma se quedo vieja. */
export async function correoFaltaCompletarFicha(
  opciones: Parameters<typeof piezasFaltaCompletarFicha>[0] & { para: string },
): Promise<Envio> {
  const { destino, idioma, para } = opciones;
  return enviarCorreo({ destino, idioma, para, ...piezasFaltaCompletarFicha(opciones) });
}

/* ---- Avisos INTERNOS al equipo -----------------------------------------
 *
 * Van en castellano siempre: los lee quien opera, no el viajero.
 *
 * EL AGUJERO QUE TAPAN: hasta hoy el unico aviso al equipo era el de
 * solicitud de reserva. Un lead entraba, el viajero recibia su confirmacion
 * y en el panel aparecia una fila... que nadie veia hasta que alguien se
 * acordara de entrar a mirar. **Un lead que nadie ve es un lead perdido.** Lo
 * mismo con los negocios nuevos: se inscribian, recibian su correo, y se
 * quedaban ahi.
 *
 * Son cortos a proposito. Un aviso interno no se lee, se escanea: quien es,
 * como se le contesta, y un boton para abrirlo. Todo lo demas esta en el
 * panel y repetirlo aca solo hace que la proxima vez no se mire.
 */

type PiezasLead = {
  destino: Destino;
  solicitudId: string;
  tipo: string;
  nombre: string | null;
  email: string | null;
  whatsapp: string | null;
  llegaEl: string | null;
  personas: number | null;
  mensaje: string | null;
  origen: string | null;
  idiomaDelViajero: string | null;
};

export function piezasLeadNuevoAlEquipo(o: PiezasLead) {
  const quien = o.nombre?.trim() || 'sin nombre';

  return {
    asunto: `Lead nuevo: ${quien}${o.origen ? ` · ${o.origen}` : ''}`,
    motivo: 'lead_al_equipo',
    titulo: 'Entró un lead',
    parrafos: [
      o.mensaje?.trim()
        ? `Escribió: «${o.mensaje.trim()}»`
        : 'No dejó mensaje, solo sus datos.',
    ],
    datos: [
      { rotulo: 'Quién', valor: quien },
      ...(o.email ? [{ rotulo: 'Correo', valor: o.email }] : []),
      ...(o.whatsapp ? [{ rotulo: 'WhatsApp', valor: o.whatsapp }] : []),
      { rotulo: 'Tipo', valor: o.tipo },
      ...(o.origen ? [{ rotulo: 'De dónde', valor: o.origen }] : []),
      ...(o.llegaEl ? [{ rotulo: 'Llega', valor: o.llegaEl }] : []),
      ...(o.personas ? [{ rotulo: 'Personas', valor: String(o.personas) }] : []),
      /* El idioma importa para contestarle: si escribio en ingles y se le
         responde en castellano, el lead se enfria ahi mismo. Con el nombre y
         no con el codigo: «Escribe en: en» hace dudar dos segundos cada vez,
         y esto se escanea, no se lee. */
      ...(o.idiomaDelViajero
        ? [{ rotulo: 'Escribe en', valor: NOMBRE_PROPIO[o.idiomaDelViajero as Idioma] ?? o.idiomaDelViajero }]
        : []),
    ],
    boton: { texto: 'Abrir el lead', url: `https://${o.destino.dominio}/admin/leads/${o.solicitudId}` },
    nota: 'Aviso interno. Nadie más lo recibió.',
    /* El pie por omision dice «recibís este correo porque escribiste a…», que
       en un aviso interno es falso: nadie escribio a ningun lado, lo disparo
       el sitio. Un correo que explica mal por que llego entrena a no creerle
       al pie de los demas. */
    pie: 'Aviso automático del panel de',
  };
}

export async function correoLeadNuevoAlEquipo(o: PiezasLead & { para: string }): Promise<Envio> {
  return enviarCorreo({ destino: o.destino, idioma: 'es', para: o.para, ...piezasLeadNuevoAlEquipo(o) });
}

type PiezasNegocioNuevo = {
  destino: Destino;
  negocioId: string;
  nombreNegocio: string;
  categoria: string | null;
  esOperador: boolean;
  email: string | null;
  telefono: string | null;
  quien: string | null;
  nota: string | null;
};

export function piezasNegocioNuevoAlEquipo(o: PiezasNegocioNuevo) {
  return {
    asunto: `Negocio nuevo: ${o.nombreNegocio}`,
    motivo: 'negocio_nuevo_al_equipo',
    titulo: o.esOperador ? 'Se inscribió un operador' : 'Se inscribió un negocio',
    parrafos: [
      o.esOperador
        ? 'Es un operador de tours: no lleva ficha propia, lo que se publica son sus tours.'
        : 'Entra como pendiente. Nace sin descripción ni fotos: desde su ficha en el panel se le pueden pedir.',
      ...(o.nota?.trim() ? [`Dejó esta nota: «${o.nota.trim()}»`] : []),
    ],
    datos: [
      { rotulo: 'Negocio', valor: o.nombreNegocio },
      ...(o.categoria ? [{ rotulo: 'Categoría', valor: o.categoria }] : []),
      ...(o.quien ? [{ rotulo: 'Lo inscribió', valor: o.quien }] : []),
      ...(o.email ? [{ rotulo: 'Correo', valor: o.email }] : []),
      ...(o.telefono ? [{ rotulo: 'Teléfono', valor: o.telefono }] : []),
    ],
    boton: { texto: 'Abrir la ficha', url: `https://${o.destino.dominio}/admin/negocios/${o.negocioId}` },
    nota: 'Aviso interno. Nadie más lo recibió.',
    /* El pie por omision dice «recibís este correo porque escribiste a…», que
       en un aviso interno es falso: nadie escribio a ningun lado, lo disparo
       el sitio. Un correo que explica mal por que llego entrena a no creerle
       al pie de los demas. */
    pie: 'Aviso automático del panel de',
  };
}

export async function correoNegocioNuevoAlEquipo(o: PiezasNegocioNuevo & { para: string }): Promise<Envio> {
  return enviarCorreo({ destino: o.destino, idioma: 'es', para: o.para, ...piezasNegocioNuevoAlEquipo(o) });
}

/* ---- Se rechazó un negocio ---------------------------------------------
 *
 * Solo sale si alguien del equipo marca la casilla Y escribió un motivo. No
 * se manda por archivar: a una prueba o a un duplicado no se le escribe a
 * nadie.
 *
 * Lleva el motivo TAL CUAL lo escribió el equipo, sin suavizarlo. Un rechazo
 * con el motivo envuelto en algodón obliga al dueño a escribir preguntando
 * qué pasó, y eso es trabajo para los dos. Y deja la puerta abierta: casi
 * siempre lo que falta se arregla.
 */

const RECH_ASUNTO: Texto = {
  es: 'Sobre tu ficha en', en: 'About your listing on', pt: 'Sobre a sua ficha em',
  fr: 'À propos de votre fiche sur', de: 'Zu deinem Eintrag auf',
};
const RECH_TITULO: Texto = {
  es: 'Por ahora no vamos a publicar tu ficha',
  en: 'We are not publishing your listing for now',
  pt: 'Por agora não vamos publicar a sua ficha',
  fr: 'Nous ne publions pas votre fiche pour le moment',
  de: 'Wir veröffentlichen deinen Eintrag vorerst nicht',
};
const RECH_P1: Texto = {
  es: 'Revisamos lo que cargaste y por ahora no la vamos a publicar. Te contamos por qué, para que sepas a qué atenerte y no quedes esperando.',
  en: 'We reviewed what you uploaded and we are not going to publish it for now. Here is why, so you are not left waiting.',
  pt: 'Revisámos o que carregou e por agora não vamos publicar. Dizemos-lhe porquê, para não ficar à espera.',
  fr: 'Nous avons examiné ce que vous avez déposé et nous ne le publierons pas pour le moment. Voici pourquoi, pour que vous ne restiez pas à attendre.',
  de: 'Wir haben uns angesehen, was du hochgeladen hast, und veröffentlichen es vorerst nicht. Hier der Grund, damit du nicht im Ungewissen bleibst.',
};
const RECH_P2: Texto = {
  es: 'Esto no es definitivo. Si lo que falta se puede arreglar, escribinos respondiendo este correo y lo vemos — la mayoría de las veces se resuelve rápido.',
  en: 'This is not final. If what is missing can be sorted out, reply to this email and we will look at it — most of the time it is quick to fix.',
  pt: 'Isto não é definitivo. Se o que falta tiver arranjo, responda a este e-mail e vemos — na maioria das vezes resolve-se rápido.',
  fr: 'Ce n’est pas définitif. Si ce qui manque peut être corrigé, répondez à cet e-mail et nous verrons — le plus souvent cela se règle vite.',
  de: 'Das ist nicht endgültig. Wenn sich das Fehlende beheben lässt, antworte auf diese E-Mail und wir schauen es uns an — meist ist es schnell gelöst.',
};
const RECH_ROT_MOTIVO: Texto = {
  es: 'El motivo', en: 'The reason', pt: 'O motivo', fr: 'La raison', de: 'Der Grund',
};

export function piezasNegocioRechazado(o: {
  destino: Destino;
  idioma: Idioma;
  nombreNegocio: string;
  motivo: string;
}) {
  return {
    asunto: `${d(RECH_ASUNTO, o.idioma)} ${o.destino.marca_nombre}: ${o.nombreNegocio}`,
    motivo: 'negocio_rechazado',
    titulo: d(RECH_TITULO, o.idioma),
    parrafos: [d(RECH_P1, o.idioma), d(RECH_P2, o.idioma)],
    /* El motivo tal cual lo escribió el equipo. */
    datos: [{ rotulo: d(RECH_ROT_MOTIVO, o.idioma), valor: o.motivo }],
  };
}

export async function correoNegocioRechazado(
  o: Parameters<typeof piezasNegocioRechazado>[0] & { para: string },
): Promise<Envio> {
  return enviarCorreo({ destino: o.destino, idioma: o.idioma, para: o.para, ...piezasNegocioRechazado(o) });
}

/* ---- Al operador le falta algo en UN tour ------------------------------
 *
 * Distinto del de la ficha de un negocio, y no es duplicar por duplicar: lo
 * que le falta a un tour es otra cosa (fotos DEL TOUR, su precio, qué
 * incluye) y sobre todo **el botón tiene que llevar a otro lado** — a la
 * pantalla de ESE tour en el portal, no a la del negocio. Mandarlo a la raíz
 * de su cuenta y que busque cuál de sus cuatro tours es, es como se pierde a
 * alguien que estaba dispuesto a hacerlo.
 *
 * Dice qué falta y qué hacer, en ese orden, porque es lo que decide si la
 * persona lo hace ahora o lo deja para después.
 */

const TUR_ASUNTO: Texto = {
  es: 'Nos falta algo de tu tour', en: 'Something is missing from your tour',
  pt: 'Falta algo no seu tour', fr: 'Il manque quelque chose à votre excursion',
  de: 'Deiner Tour fehlt noch etwas',
};
const TUR_TITULO: Texto = {
  es: 'Para publicar tu tour nos falta esto',
  en: 'We need this to publish your tour',
  pt: 'Para publicar o seu tour precisamos disto',
  fr: 'Il nous faut ceci pour publier votre excursion',
  de: 'Das brauchen wir noch, um deine Tour zu veröffentlichen',
};
const TUR_P1: Texto = {
  es: 'El botón de abajo abre directamente la pantalla de este tour en tu cuenta — no hay que buscar nada. Se hace desde el teléfono en unos minutos.',
  en: 'The button below opens this tour’s screen in your account directly — nothing to search for. It takes a few minutes from your phone.',
  pt: 'O botão abaixo abre diretamente o ecrã deste tour na sua conta — não há nada para procurar. Faz-se pelo telemóvel em poucos minutos.',
  fr: 'Le bouton ci-dessous ouvre directement l’écran de cette excursion dans votre compte — rien à chercher. Cela prend quelques minutes depuis votre téléphone.',
  de: 'Der Button unten öffnet direkt die Seite dieser Tour in deinem Konto — nichts zu suchen. Vom Handy aus in wenigen Minuten erledigt.',
};
const TUR_FOTOS: Texto = {
  es: 'Las fotos son lo que más mueve: subí tres o cuatro del tour en marcha — gente haciéndolo, no solo el paisaje. Las del teléfono sirven, se achican solas.',
  en: 'Photos move the needle most: upload three or four of the tour in action — people doing it, not just scenery. Phone photos work, they get resized automatically.',
  pt: 'As fotos são o que mais pesa: carregue três ou quatro do tour a decorrer — pessoas a fazê-lo, não só a paisagem. As do telemóvel servem.',
  fr: 'Les photos comptent le plus : ajoutez-en trois ou quatre de l’excursion en cours — des gens qui la font, pas seulement le paysage. Celles du téléphone conviennent.',
  de: 'Fotos bringen am meisten: lade drei oder vier von der Tour in Aktion hoch — Leute, die sie machen, nicht nur Landschaft. Handyfotos genügen.',
};
/* El mismo pedido, pero para quien YA subió alguna. Decirle «subí fotos» a
   alguien que ya puso una suena a que no le miramos la ficha, y es la forma
   más rápida de que el próximo correo no se abra. Dice cuántas tiene y
   cuántas hacen falta, porque «más» sin número no se sabe si es una o diez. */
/* ⚠️ «{n} de {min} fotos» y no «tenés {n} foto»: el sustantivo concuerda con
   el mínimo, que siempre es plural, así que la frase sale bien con 1 o con 2
   sin tener que cargar singular y plural en cinco idiomas. Y de paso se lee
   como progreso —«vas 1 de 3»—, que empuja más que un reclamo. */
const TUR_MAS_FOTOS: Texto = {
  /* Sin «con una sola»: con dos fotos esa frase es falsa, y una frase falsa en
     el correo que pide confianza es lo último que uno quiere. */
  es: 'Vas {n} de {min} fotos. Subí las que falten del tour en marcha — gente haciéndolo, no solo el paisaje. Las del teléfono sirven, se achican solas.',
  en: 'You are at {n} of {min} photos. Add the missing ones from the tour in action — people doing it, not just scenery. Phone photos work, they get resized automatically.',
  pt: 'Vai {n} de {min} fotos. Carregue as que faltam do tour a decorrer — pessoas a fazê-lo, não só a paisagem. As do telemóvel servem.',
  fr: 'Vous en êtes à {n} sur {min} photos. Ajoutez celles qui manquent de l’excursion en cours — des gens qui la font, pas seulement le paysage.',
  de: 'Du bist bei {n} von {min} Fotos. Lade die fehlenden von der Tour in Aktion hoch — Leute, die sie machen, nicht nur Landschaft.',
};
const TUR_DESC: Texto = {
  es: 'En la descripción contá cómo es el día: qué se ve, cuánto se camina, para quién es y para quién no.',
  en: 'In the description, tell us what the day is like: what you see, how much walking, who it suits and who it does not.',
  pt: 'Na descrição conte como é o dia: o que se vê, quanto se caminha, para quem é e para quem não é.',
  fr: 'Dans la description, racontez la journée : ce qu’on voit, combien on marche, à qui elle convient et à qui non.',
  de: 'Beschreib den Tag: was man sieht, wie viel gelaufen wird, für wen sie passt und für wen nicht.',
};
const TUR_PRECIO: Texto = {
  es: 'Sin precio el tour no se puede reservar desde el sitio: es el dato que falta para que alguien pueda apretar el botón.',
  en: 'Without a price the tour cannot be booked from the site: it is the one thing missing for someone to press the button.',
  pt: 'Sem preço o tour não pode ser reservado pelo site: é o dado que falta para alguém carregar no botão.',
  fr: 'Sans prix, l’excursion ne peut pas être réservée depuis le site : c’est la donnée qui manque pour que quelqu’un puisse cliquer.',
  de: 'Ohne Preis kann die Tour auf der Seite nicht gebucht werden: genau das fehlt, damit jemand den Button drücken kann.',
};
const TUR_BOTON: Texto = {
  es: 'Abrir mi tour y completarlo', en: 'Open my tour and complete it',
  pt: 'Abrir o meu tour e completá-lo', fr: 'Ouvrir mon excursion et la compléter',
  de: 'Meine Tour öffnen und ergänzen',
};
const TUR_ROT_TOUR: Texto = { es: 'Tour', en: 'Tour', pt: 'Tour', fr: 'Excursion', de: 'Tour' };
const TUR_ROT_FALTA: Texto = {
  es: 'Lo que falta', en: 'What is missing', pt: 'O que falta',
  fr: 'Ce qui manque', de: 'Was noch fehlt',
};
const TUR_FOTOS_C: Texto = { es: 'las fotos', en: 'photos', pt: 'as fotos', fr: 'les photos', de: 'die Fotos' };
const TUR_MAS_FOTOS_C: Texto = { es: 'más fotos', en: 'more photos', pt: 'mais fotos', fr: 'plus de photos', de: 'mehr Fotos' };
const TUR_DESC_C: Texto = { es: 'la descripción', en: 'the description', pt: 'a descrição', fr: 'la description', de: 'die Beschreibung' };
const TUR_PRECIO_C: Texto = { es: 'el precio', en: 'the price', pt: 'o preço', fr: 'le prix', de: 'der Preis' };
/* ⚠️ El pie genérico dice «porque escribiste a», y el operador NUNCA nos
   escribió: lo cargamos nosotros. Decirle eso en el primer correo que recibe
   es empezar mintiéndole. Sirve para los dos correos de tour, y dice «de este
   tour» y no «publicado» porque los de Outback son borradores: el pie tiene
   que ser cierto también cuando todavía no se ve en el sitio. */
const TUR_PIE: Texto = {
  es: 'Recibís este correo porque sos el operador de este tour en',
  en: 'You are getting this email because you are the operator of this tour on',
  pt: 'Você recebe este e-mail porque é o operador deste tour em',
  fr: 'Vous recevez cet e-mail parce que vous êtes l’opérateur de cette excursion sur',
  de: 'Du bekommst diese E-Mail, weil du der Anbieter dieser Tour bist auf',
};
const TUR_NOTA: Texto = {
  es: 'Si preferís mandarnos las fotos por WhatsApp y que las subamos nosotros, respondé este correo y lo arreglamos.',
  en: 'If you would rather send the photos by WhatsApp and have us upload them, reply to this email.',
  pt: 'Se preferir enviar as fotos por WhatsApp e que as carreguemos nós, responda a este e-mail.',
  fr: 'Si vous préférez nous envoyer les photos par WhatsApp pour qu’on les ajoute, répondez à cet e-mail.',
  de: 'Wenn du uns die Fotos lieber per WhatsApp schickst und wir sie hochladen, antworte auf diese E-Mail.',
};

export function piezasFaltaCompletarTour(o: {
  destino: Destino;
  idioma: Idioma;
  negocioId: string;
  tourId: string;
  nombreTour: string;
  faltanFotos: boolean;
  /** Cuántas tiene ya. Decide si se le pide «fotos» o «más fotos». */
  cuantasFotos: number;
  /** El mínimo que se le pide. Entra como dato y no se importa de
      `lib/comercio` a propósito: las cartas no deberían depender del portal
      del comercio para armar una frase. */
  minimoFotos: number;
  faltaDescripcion: boolean;
  faltaPrecio: boolean;
}) {
  const yaTieneAlgunas = o.cuantasFotos > 0;
  const lista = [
    o.faltanFotos ? d(yaTieneAlgunas ? TUR_MAS_FOTOS_C : TUR_FOTOS_C, o.idioma) : null,
    o.faltaDescripcion ? d(TUR_DESC_C, o.idioma) : null,
    o.faltaPrecio ? d(TUR_PRECIO_C, o.idioma) : null,
  ].filter(Boolean);
  const queFalta = lista.join(` ${d(FAL_Y, o.idioma)} `);

  return {
    asunto: `${d(TUR_ASUNTO, o.idioma)}: ${o.nombreTour}`,
    motivo: 'falta_completar_tour',
    titulo: d(TUR_TITULO, o.idioma),
    /* Un párrafo por cosa que falte, y solo por lo que falte: explicarle las
       fotos a quien ya las subió es ruido, y el ruido hace que el próximo
       correo no se abra. */
    parrafos: [
      d(TUR_P1, o.idioma),
      ...(o.faltanFotos
        ? [
            yaTieneAlgunas
              ? d(TUR_MAS_FOTOS, o.idioma)
                  .replace('{n}', String(o.cuantasFotos))
                  .replace('{min}', String(o.minimoFotos))
              : d(TUR_FOTOS, o.idioma),
          ]
        : []),
      ...(o.faltaDescripcion ? [d(TUR_DESC, o.idioma)] : []),
      ...(o.faltaPrecio ? [d(TUR_PRECIO, o.idioma)] : []),
    ],
    datos: [
      { rotulo: d(TUR_ROT_TOUR, o.idioma), valor: o.nombreTour },
      { rotulo: d(TUR_ROT_FALTA, o.idioma), valor: queFalta.charAt(0).toUpperCase() + queFalta.slice(1) },
    ],
    /* ⚠️ DIRECTO A LA PANTALLA DE ESE TOUR. Mandarlo a la raíz de su cuenta y
       que busque cuál de sus cuatro tours es, es como se pierde a alguien que
       estaba dispuesto a hacerlo. */
    boton: {
      texto: d(TUR_BOTON, o.idioma),
      url: `https://${o.destino.dominio}/negocio/${o.negocioId}/tours/${o.tourId}`,
    },
    nota: d(TUR_NOTA, o.idioma),
    pie: d(TUR_PIE, o.idioma),
  };
}

export async function correoFaltaCompletarTour(
  o: Parameters<typeof piezasFaltaCompletarTour>[0] & { para: string },
): Promise<Envio> {
  return enviarCorreo({ destino: o.destino, idioma: o.idioma, para: o.para, ...piezasFaltaCompletarTour(o) });
}

/* ---- Que el operador revise lo publicado y confirme las tarifas --------
 *
 * El otro correo pide lo que FALTA. Este pide que mire lo que YA está: el
 * texto que lee el viajero y, sobre todo, los números.
 *
 * ⚠️ LE MUESTRA LAS TRES CIFRAS: lo que paga el viajero (rack), lo que se le
 * gira a él (neto) y la comisión. No es generosidad, es lo que evita el
 * problema: un operador que descubre la comisión cuando le llega la primera
 * liquidación se enoja con razón, y ese enojo cuesta más que la comisión. Si
 * no está de acuerdo, mejor que lo diga ahora.
 *
 * Y es el momento de corregir: lo que publica el sitio sale de lo que él
 * cargó. Un precio viejo o un «qué incluye» que ya no es cierto se descubre
 * cuando el viajero llega y reclama.
 */

const RVT_ASUNTO: Texto = {
  es: 'Revisá cómo quedó tu tour y las tarifas',
  en: 'Check how your tour looks and its rates',
  pt: 'Reveja como ficou o seu tour e as tarifas',
  fr: 'Vérifiez votre excursion et ses tarifs',
  de: 'Prüf deine Tour und die Preise',
};
const RVT_TITULO: Texto = {
  es: 'Esto es lo que ve el viajero',
  en: 'This is what the traveller sees',
  pt: 'Isto é o que o viajante vê',
  fr: 'Voici ce que voit le voyageur',
  de: 'Das sieht der Reisende',
};
const RVT_P1: Texto = {
  es: 'Antes de empujarlo queremos que lo revises vos. El botón de abajo abre la pantalla de este tour en tu cuenta: lo que esté mal lo corregís ahí mismo.',
  en: 'Before we push it we want you to check it. The button below opens this tour in your account: anything wrong, you fix it right there.',
  pt: 'Antes de o promovermos queremos que o reveja. O botão abaixo abre este tour na sua conta: o que estiver errado corrige ali mesmo.',
  fr: 'Avant de le mettre en avant, nous aimerions que vous le vérifiiez. Le bouton ci-dessous ouvre cette excursion dans votre compte : ce qui ne va pas, vous le corrigez sur place.',
  de: 'Bevor wir sie bewerben, schau sie dir bitte an. Der Button unten öffnet diese Tour in deinem Konto: was nicht stimmt, korrigierst du direkt dort.',
};
const RVT_P_TARIFAS: Texto = {
  es: 'Mirá bien los números. El viajero paga la tarifa pública; a vos se te gira el neto. La diferencia es nuestra comisión, y está acá abajo para que no haya sorpresas en la primera liquidación.',
  en: 'Look closely at the numbers. The traveller pays the public rate; you receive the net. The difference is our commission, and it is right here so there are no surprises on the first payout.',
  pt: 'Veja bem os números. O viajante paga a tarifa pública; a si é transferido o líquido. A diferença é a nossa comissão, e está aqui para não haver surpresas na primeira liquidação.',
  fr: 'Regardez bien les chiffres. Le voyageur paie le tarif public ; vous recevez le net. La différence est notre commission, indiquée ici pour qu’il n’y ait pas de surprise au premier versement.',
  de: 'Schau dir die Zahlen genau an. Der Reisende zahlt den öffentlichen Preis; dir wird der Nettobetrag überwiesen. Die Differenz ist unsere Provision — hier aufgeführt, damit es bei der ersten Abrechnung keine Überraschung gibt.',
};
const RVT_P_SIN_TARIFAS: Texto = {
  es: 'Este tour todavía no tiene convenio, así que no se reserva desde el sitio: por ahora solo se muestra. Si querés que se pueda reservar, respondé este correo y lo armamos.',
  en: 'This tour has no agreement yet, so it cannot be booked from the site: for now it is only listed. If you want it bookable, reply to this email.',
  pt: 'Este tour ainda não tem acordo, por isso não se reserva pelo site: por agora só aparece. Se quiser que se possa reservar, responda a este e-mail.',
  fr: 'Cette excursion n’a pas encore d’accord : elle n’est pas réservable depuis le site, seulement visible. Si vous souhaitez la rendre réservable, répondez à cet e-mail.',
  de: 'Für diese Tour gibt es noch keine Vereinbarung, sie ist also nicht buchbar — nur sichtbar. Wenn du sie buchbar machen willst, antworte auf diese E-Mail.',
};
const RVT_BOTON: Texto = {
  es: 'Revisar mi tour', en: 'Review my tour', pt: 'Rever o meu tour',
  fr: 'Vérifier mon excursion', de: 'Meine Tour prüfen',
};
const RVT_ROT_TOUR: Texto = { es: 'Tour', en: 'Tour', pt: 'Tour', fr: 'Excursion', de: 'Tour' };
const RVT_ROT_RACK: Texto = {
  es: 'Lo que paga el viajero', en: 'What the traveller pays', pt: 'O que o viajante paga',
  fr: 'Ce que paie le voyageur', de: 'Was der Reisende zahlt',
};
const RVT_ROT_NETO: Texto = {
  es: 'Lo que recibís vos', en: 'What you receive', pt: 'O que recebe',
  fr: 'Ce que vous recevez', de: 'Was du bekommst',
};
const RVT_ROT_COM: Texto = {
  es: 'Nuestra comisión', en: 'Our commission', pt: 'A nossa comissão',
  fr: 'Notre commission', de: 'Unsere Provision',
};
const RVT_ROT_DURA: Texto = { es: 'Duración', en: 'Duration', pt: 'Duração', fr: 'Durée', de: 'Dauer' };
const RVT_ROT_ESTADO: Texto = { es: 'Estado', en: 'Status', pt: 'Estado', fr: 'Statut', de: 'Status' };
const RVT_PUBLICADO: Texto = {
  es: 'Publicado — se ve en el sitio', en: 'Published — live on the site',
  pt: 'Publicado — visível no site', fr: 'Publié — visible sur le site',
  de: 'Veröffentlicht — auf der Seite sichtbar',
};
const RVT_BORRADOR: Texto = {
  es: 'Borrador — todavía no se ve', en: 'Draft — not visible yet',
  pt: 'Rascunho — ainda não se vê', fr: 'Brouillon — pas encore visible',
  de: 'Entwurf — noch nicht sichtbar',
};
const RVT_NOTA: Texto = {
  es: 'Si algún dato no está bien —el precio, lo que incluye, los horarios— corregilo vos o respondé este correo y lo cambiamos nosotros.',
  en: 'If something is wrong — the price, what is included, the schedule — fix it yourself or reply to this email and we will change it.',
  pt: 'Se algum dado não estiver certo — o preço, o que inclui, os horários — corrija ou responda a este e-mail e alteramos nós.',
  fr: 'Si une information est erronée — le prix, ce qui est inclus, les horaires — corrigez-la ou répondez à cet e-mail.',
  de: 'Wenn etwas nicht stimmt — Preis, Leistungen, Zeiten — korrigier es selbst oder antworte auf diese E-Mail.',
};

export function piezasRevisarTour(o: {
  destino: Destino;
  idioma: Idioma;
  negocioId: string;
  tourId: string;
  nombreTour: string;
  publicado: boolean;
  duracionHoras: number | null;
  rackUsd: number | null;
  netoUsd: number | null;
  comisionPct: number | null;
}) {
  const plata = (n: number | null) => (n != null ? `$${Number(n).toFixed(2)}` : null);
  /* ⚠️ La comisión NO se redondea a entero. Outback firmó 12.60% y 22.80%:
     un `toFixed(0)` le diría «13%» a quien firmó 12.6 — y este correo es
     justo el que se manda para que confirme esa cifra. `Number` solo quita
     los ceros de más: 25.00 → «25%», 12.60 → «12.6%». */
  const pct = (n: number | null) => `${Number(n)}%`;
  /* Las tres cifras solo si hay convenio. Mostrar «comisión: —» no informa:
     deja al operador preguntándose si es cero o si falta cargarla. */
  const hayTarifas = o.netoUsd != null && o.comisionPct != null;

  return {
    asunto: `${d(RVT_ASUNTO, o.idioma)}: ${o.nombreTour}`,
    motivo: 'revisar_tour',
    titulo: d(RVT_TITULO, o.idioma),
    parrafos: [
      d(RVT_P1, o.idioma),
      hayTarifas ? d(RVT_P_TARIFAS, o.idioma) : d(RVT_P_SIN_TARIFAS, o.idioma),
    ],
    datos: [
      { rotulo: d(RVT_ROT_TOUR, o.idioma), valor: o.nombreTour },
      {
        rotulo: d(RVT_ROT_ESTADO, o.idioma),
        valor: o.publicado ? d(RVT_PUBLICADO, o.idioma) : d(RVT_BORRADOR, o.idioma),
      },
      ...(o.duracionHoras ? [{ rotulo: d(RVT_ROT_DURA, o.idioma), valor: `${o.duracionHoras} h` }] : []),
      ...(plata(o.rackUsd) ? [{ rotulo: d(RVT_ROT_RACK, o.idioma), valor: plata(o.rackUsd)! }] : []),
      ...(hayTarifas
        ? [
            { rotulo: d(RVT_ROT_NETO, o.idioma), valor: plata(o.netoUsd)! },
            { rotulo: d(RVT_ROT_COM, o.idioma), valor: pct(o.comisionPct) },
          ]
        : []),
    ],
    boton: {
      texto: d(RVT_BOTON, o.idioma),
      url: `https://${o.destino.dominio}/negocio/${o.negocioId}/tours/${o.tourId}`,
    },
    nota: d(RVT_NOTA, o.idioma),
    pie: d(TUR_PIE, o.idioma),
  };
}

export async function correoRevisarTour(
  o: Parameters<typeof piezasRevisarTour>[0] & { para: string },
): Promise<Envio> {
  return enviarCorreo({ destino: o.destino, idioma: o.idioma, para: o.para, ...piezasRevisarTour(o) });
}
