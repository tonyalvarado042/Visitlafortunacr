export const IDIOMAS = ['es', 'en', 'pt', 'fr', 'de'] as const;
export type Idioma = (typeof IDIOMAS)[number];

export const NOMBRE_PROPIO: Record<Idioma, string> = {
  es: 'Español',
  en: 'English',
  pt: 'Português',
  fr: 'Français',
  de: 'Deutsch',
};

export function esIdioma(valor: string): valor is Idioma {
  return (IDIOMAS as readonly string[]).includes(valor);
}

/** Elige el mejor idioma soportado a partir de la cabecera Accept-Language. */
export function idiomaPreferido(cabecera: string | null, respaldo: Idioma = 'es'): Idioma {
  if (!cabecera) return respaldo;
  const pedidos = cabecera
    .split(',')
    .map((parte) => {
      const [etiqueta, q] = parte.trim().split(';q=');
      return { codigo: etiqueta.slice(0, 2).toLowerCase(), peso: q ? parseFloat(q) : 1 };
    })
    .sort((a, b) => b.peso - a.peso);

  for (const { codigo } of pedidos) {
    if (esIdioma(codigo)) return codigo;
  }
  return respaldo;
}

type Diccionario = Record<Idioma, string>;

/**
 * Textos de la interfaz. El contenido (negocios, guías) se traduce en la base;
 * esto es solo el andamiaje: botones, etiquetas y encabezados.
 */
export const T: Record<string, Diccionario> = {
  buscar:            { es: 'Buscar', en: 'Search', pt: 'Buscar', fr: 'Rechercher', de: 'Suchen' },
  que_buscas:        { es: '¿Qué te gustaría vivir?', en: 'What would you like to experience?', pt: 'O que gostaria de viver?', fr: 'Que souhaitez-vous vivre ?', de: 'Was möchten Sie erleben?' },
  armar_viaje:       { es: 'Armar mi viaje', en: 'Plan my trip', pt: 'Planear a viagem', fr: 'Créer mon voyage', de: 'Reise planen' },
  que_hacer:         { es: 'Qué hacer', en: 'Things to do', pt: 'O que fazer', fr: 'À faire', de: 'Aktivitäten' },
  tours:             { es: 'Tours', en: 'Tours', pt: 'Passeios', fr: 'Excursions', de: 'Touren' },
  donde_dormir:      { es: 'Dónde dormir', en: 'Where to stay', pt: 'Onde ficar', fr: 'Où dormir', de: 'Unterkünfte' },
  comer_beber:       { es: 'Comer y beber', en: 'Eat and drink', pt: 'Comer e beber', fr: 'Manger et boire', de: 'Essen und Trinken' },
  explorar:          { es: 'Explorar', en: 'Explore', pt: 'Explorar', fr: 'Explorer', de: 'Entdecken' },
  transporte:        { es: 'Transporte', en: 'Transport', pt: 'Transporte', fr: 'Transport', de: 'Transport' },
  ver_todo:          { es: 'Ver todo', en: 'See all', pt: 'Ver tudo', fr: 'Tout voir', de: 'Alle ansehen' },
  verificado:        { es: 'Verificado', en: 'Verified', pt: 'Verificado', fr: 'Vérifié', de: 'Verifiziert' },
  por_confirmar:     { es: 'Datos por confirmar', en: 'Details to confirm', pt: 'Dados a confirmar', fr: 'Données à confirmer', de: 'Angaben unbestätigt' },
  destacado:         { es: 'Destacado pagado', en: 'Paid listing', pt: 'Destaque pago', fr: 'Annonce sponsorisée', de: 'Bezahlte Anzeige' },
  llamar:            { es: 'Llamar', en: 'Call', pt: 'Ligar', fr: 'Appeler', de: 'Anrufen' },
  sitio_web:         { es: 'Sitio web', en: 'Website', pt: 'Site', fr: 'Site web', de: 'Webseite' },
  como_llegar:       { es: 'Cómo llegar', en: 'Directions', pt: 'Como chegar', fr: 'Itinéraire', de: 'Anfahrt' },
  contacto:          { es: 'Contacto', en: 'Contact', pt: 'Contato', fr: 'Contact', de: 'Kontakt' },
  precio:            { es: 'Rango de precio', en: 'Price range', pt: 'Faixa de preço', fr: 'Gamme de prix', de: 'Preisklasse' },
  sobre:             { es: 'Sobre', en: 'About', pt: 'Sobre', fr: 'À propos de', de: 'Über' },
  otras_plataformas: { es: 'Lo que dicen en otras plataformas', en: 'What other platforms say', pt: 'O que dizem outras plataformas', fr: "Ce que disent les autres plateformes", de: 'Was andere Plattformen sagen' },
  sin_resenas:       { es: 'Todavía sin reseñas nuestras', en: 'No reviews here yet', pt: 'Ainda sem avaliações nossas', fr: 'Pas encore d’avis chez nous', de: 'Noch keine eigenen Bewertungen' },
  escribi_primera:   { es: 'Escribí la primera', en: 'Write the first one', pt: 'Escreva a primeira', fr: 'Écrivez le premier', de: 'Schreiben Sie die erste' },
  lugares:           { es: 'lugares', en: 'places', pt: 'lugares', fr: 'lieux', de: 'Orte' },
  volver:            { es: 'Volver', en: 'Back', pt: 'Voltar', fr: 'Retour', de: 'Zurück' },
  inicio:            { es: 'Inicio', en: 'Home', pt: 'Início', fr: 'Accueil', de: 'Start' },
  cuando_llegas:     { es: '¿Cuándo llegás?', en: 'When do you arrive?', pt: 'Quando chega?', fr: 'Quand arrivez-vous ?', de: 'Wann kommen Sie an?' },
  con_quien:         { es: '¿Con quién venís?', en: 'Who is coming?', pt: 'Com quem vem?', fr: 'Avec qui venez-vous ?', de: 'Mit wem reisen Sie?' },
  que_te_mueve:      { es: '¿Qué te mueve?', en: 'What moves you?', pt: 'O que te move?', fr: 'Qu’est-ce qui vous motive ?', de: 'Was begeistert Sie?' },
  tu_correo:         { es: 'Tu correo o WhatsApp', en: 'Your email or WhatsApp', pt: 'Seu e-mail ou WhatsApp', fr: 'Votre e-mail ou WhatsApp', de: 'E-Mail oder WhatsApp' },
  ver_itinerario:    { es: 'Ver mi itinerario', en: 'See my itinerary', pt: 'Ver meu roteiro', fr: 'Voir mon itinéraire', de: 'Meine Route ansehen' },
  sin_costo:         { es: 'Te lo mandamos por correo o WhatsApp. Sin costo.', en: 'We send it by email or WhatsApp. Free.', pt: 'Enviamos por e-mail ou WhatsApp. Grátis.', fr: 'Envoyé par e-mail ou WhatsApp. Gratuit.', de: 'Per E-Mail oder WhatsApp. Kostenlos.' },
  gracias:           { es: '¡Listo! Te escribimos pronto.', en: 'Done! We will write to you soon.', pt: 'Pronto! Escrevemos em breve.', fr: 'C’est fait ! Nous vous écrirons bientôt.', de: 'Fertig! Wir melden uns bald.' },
  pareja:            { es: 'Pareja', en: 'Couple', pt: 'Casal', fr: 'En couple', de: 'Paar' },
  familia:           { es: 'Familia', en: 'Family', pt: 'Família', fr: 'Famille', de: 'Familie' },
  amigos:            { es: 'Amigos', en: 'Friends', pt: 'Amigos', fr: 'Amis', de: 'Freunde' },
  solo:              { es: 'Solo', en: 'Solo', pt: 'Sozinho', fr: 'Seul', de: 'Allein' },
  para_negocios:     { es: 'Sumá tu negocio, gratis', en: 'Add your business, free', pt: 'Adicione seu negócio, grátis', fr: 'Ajoutez votre entreprise, gratuit', de: 'Ihr Unternehmen eintragen, kostenlos' },
};

export function t(clave: string, idioma: Idioma): string {
  return T[clave]?.[idioma] ?? T[clave]?.es ?? clave;
}
