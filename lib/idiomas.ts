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
  concierge_boton:   { es: 'Preguntale a alguien de aquí', en: 'Ask a local', pt: 'Pergunte a alguém daqui', fr: 'Demandez à quelqu’un d’ici', de: 'Frag jemanden von hier' },
  concierge_titulo:  { es: 'Preguntanos lo que quieras', en: 'Ask us anything', pt: 'Pergunte o que quiser', fr: 'Posez-nous vos questions', de: 'Frag uns alles' },
  concierge_saludo:  { es: '¡Hola! Soy del equipo local. ¿Qué querés saber de tu viaje?', en: 'Hi! I am part of the local team. What would you like to know about your trip?', pt: 'Olá! Faço parte da equipe local. O que você quer saber sobre a sua viagem?', fr: 'Bonjour ! Je fais partie de l’équipe locale. Que voulez-vous savoir sur votre voyage ?', de: 'Hallo! Ich gehöre zum lokalen Team. Was möchtest du über deine Reise wissen?' },
  concierge_escribe: { es: 'Escribí tu pregunta…', en: 'Type your question…', pt: 'Escreva sua pergunta…', fr: 'Écrivez votre question…', de: 'Schreib deine Frage…' },
  concierge_enviar:  { es: 'Enviar', en: 'Send', pt: 'Enviar', fr: 'Envoyer', de: 'Senden' },
  concierge_humano:  { es: 'Una persona del equipo sigue esta conversación.', en: 'A member of our team is on this conversation.', pt: 'Uma pessoa da equipe acompanha esta conversa.', fr: 'Une personne de l’équipe suit cette conversation.', de: 'Jemand aus dem Team übernimmt dieses Gespräch.' },
  concierge_error:   { es: 'No pude responder ahora. Probá de nuevo en un momento.', en: 'I could not answer right now. Please try again in a moment.', pt: 'Não consegui responder agora. Tente de novo em instantes.', fr: 'Je n’ai pas pu répondre. Réessayez dans un instant.', de: 'Ich konnte gerade nicht antworten. Versuch es gleich noch einmal.' },
  plan_dia:          { es: 'Día', en: 'Day', pt: 'Dia', fr: 'Jour', de: 'Tag' },
  plan_consejos:     { es: 'Consejos prácticos', en: 'Practical tips', pt: 'Dicas práticas', fr: 'Conseils pratiques', de: 'Praktische Tipps' },
  plan_estimado:     { es: 'Estimado por persona', en: 'Estimate per person', pt: 'Estimativa por pessoa', fr: 'Estimation par personne', de: 'Schätzung pro Person' },
  plan_reservar:     { es: 'Reservá con el equipo', en: 'Book with our team', pt: 'Reserve com a equipe', fr: 'Réservez avec l’équipe', de: 'Mit dem Team buchen' },
  plan_ajustar:      { es: '¿Querés cambiar algo? Escribinos y lo ajustamos.', en: 'Want to change something? Message us and we will adjust it.', pt: 'Quer mudar algo? Fale conosco e ajustamos.', fr: 'Envie de changer quelque chose ? Écrivez-nous.', de: 'Möchtest du etwas ändern? Schreib uns.' },
  plan_ver_ficha:    { es: 'Ver ficha', en: 'See details', pt: 'Ver ficha', fr: 'Voir la fiche', de: 'Details ansehen' },
  momento_manana:    { es: 'Mañana', en: 'Morning', pt: 'Manhã', fr: 'Matin', de: 'Morgen' },
  momento_mediodia:  { es: 'Mediodía', en: 'Midday', pt: 'Meio-dia', fr: 'Midi', de: 'Mittag' },
  momento_tarde:     { es: 'Tarde', en: 'Afternoon', pt: 'Tarde', fr: 'Après-midi', de: 'Nachmittag' },
  momento_noche:     { es: 'Noche', en: 'Evening', pt: 'Noite', fr: 'Soir', de: 'Abend' },
  empecemos:         { es: 'Empecemos', en: 'Let us start', pt: 'Vamos começar', fr: 'Commençons', de: 'Los geht es' },
  armar_itinerario:  { es: 'Armar mi itinerario', en: 'Build my itinerary', pt: 'Montar meu roteiro', fr: 'Créer mon itinéraire', de: 'Route erstellen' },
  tu_viaje_a:        { es: 'Tu viaje a', en: 'Your trip to', pt: 'Sua viagem a', fr: 'Votre voyage à', de: 'Ihre Reise nach' },
  en_60:             { es: 'en 60 segundos', en: 'in 60 seconds', pt: 'em 60 segundos', fr: 'en 60 secondes', de: 'in 60 Sekunden' },
  planifica:         { es: 'Planificá', en: 'Plan', pt: 'Planeje', fr: 'Planifiez', de: 'Planen' },
  comer:             { es: 'Comer', en: 'Eat', pt: 'Comer', fr: 'Manger', de: 'Essen' },
  int_termales:      { es: 'Termales', en: 'Hot springs', pt: 'Termas', fr: 'Sources chaudes', de: 'Thermalquellen' },
  int_rafting:       { es: 'Rafting', en: 'Rafting', pt: 'Rafting', fr: 'Rafting', de: 'Rafting' },
  int_naturaleza:    { es: 'Naturaleza', en: 'Nature', pt: 'Natureza', fr: 'Nature', de: 'Natur' },
  int_bienestar:     { es: 'Bienestar', en: 'Wellness', pt: 'Bem-estar', fr: 'Bien-être', de: 'Wellness' },
  int_ciclismo:      { es: 'Ciclismo', en: 'Cycling', pt: 'Ciclismo', fr: 'Vélo', de: 'Radfahren' },
  int_comida:        { es: 'Comida', en: 'Food', pt: 'Comida', fr: 'Cuisine', de: 'Essen' },
  int_aventura:      { es: 'Aventura', en: 'Adventure', pt: 'Aventura', fr: 'Aventure', de: 'Abenteuer' },
  int_fauna:         { es: 'Fauna', en: 'Wildlife', pt: 'Fauna', fr: 'Faune', de: 'Tierwelt' },
  te_espera:         { es: 'te espera', en: 'is waiting', pt: 'te espera', fr: 'vous attend', de: 'wartet auf Sie' },
  desliza:           { es: 'Deslizá', en: 'Scroll', pt: 'Deslize', fr: 'Faites défiler', de: 'Scrollen' },
  nadie_se_salta:    { es: 'Lo que nadie se salta', en: 'What no one skips', pt: 'O que ninguém pula', fr: 'Ce que personne ne manque', de: 'Was niemand auslässt' },
  de_hostal_a_villa: { es: 'De hostal a villa privada', en: 'From hostel to private villa', pt: 'De hostel a villa privada', fr: 'De l auberge à la villa privée', de: 'Vom Hostel zur privaten Villa' },
  en_60_segundos:    { es: 'Tu viaje, en 60 segundos', en: 'Your trip, in 60 seconds', pt: 'Sua viagem, em 60 segundos', fr: 'Votre voyage, en 60 secondes', de: 'Ihre Reise, in 60 Sekunden' },
  plan_explica:      { es: 'Contanos cuándo venís, con quién y qué te gusta. Te armamos el itinerario día por día, con horarios que sí calzan y precios reales.', en: 'Tell us when you are coming, with whom and what you like. We build your day-by-day itinerary, with timings that actually work and real prices.', pt: 'Conte quando vem, com quem e do que gosta. Montamos seu roteiro dia a dia, com horários que funcionam e preços reais.', fr: 'Dites-nous quand vous venez, avec qui et ce que vous aimez. Nous construisons votre itinéraire jour par jour, avec des horaires réalistes et de vrais prix.', de: 'Sagen Sie uns wann, mit wem und was Sie mögen. Wir bauen Ihre Route Tag für Tag, mit Zeiten die passen und echten Preisen.' },
  paso_1:            { es: 'Decinos tus fechas y con quién viajás', en: 'Tell us your dates and who travels with you', pt: 'Diga suas datas e com quem viaja', fr: 'Donnez vos dates et vos compagnons', de: 'Nennen Sie Daten und Begleitung' },
  paso_2:            { es: 'Elegí lo que te mueve', en: 'Pick what moves you', pt: 'Escolha o que te move', fr: 'Choisissez ce qui vous motive', de: 'Wählen Sie was Sie begeistert' },
  paso_3:            { es: 'Recibí tu itinerario y reservá lo que quieras', en: 'Get your itinerary and book what you want', pt: 'Receba seu roteiro e reserve o que quiser', fr: 'Recevez votre itinéraire et réservez', de: 'Route erhalten und buchen' },
  negocios_dir:      { es: 'Negocios en el directorio', en: 'Businesses listed', pt: 'Negócios no diretório', fr: 'Établissements référencés', de: 'Einträge im Verzeichnis' },
  categorias_expl:   { es: 'Categorías para explorar', en: 'Categories to explore', pt: 'Categorias para explorar', fr: 'Catégories à explorer', de: 'Kategorien zum Entdecken' },
  idiomas_cuenta:    { es: 'Idiomas', en: 'Languages', pt: 'Idiomas', fr: 'Langues', de: 'Sprachen' },
  gratis_negocios:   { es: 'Gratis para los negocios', en: 'Free for businesses', pt: 'Grátis para os negócios', fr: 'Gratuit pour les établissements', de: 'Kostenlos für Betriebe' },
  naturaleza:        { es: 'Naturaleza', en: 'Nature', pt: 'Natureza', fr: 'Nature', de: 'Natur' },
  naturaleza_lema:   { es: 'Conectate con lo esencial.', en: 'Connect with what matters.', pt: 'Conecte-se com o essencial.', fr: 'Reconnectez-vous à l essentiel.', de: 'Zurück zum Wesentlichen.' },
  aventura:          { es: 'Aventura', en: 'Adventure', pt: 'Aventura', fr: 'Aventure', de: 'Abenteuer' },
  aventura_lema:     { es: 'Explorá sin límites.', en: 'Explore without limits.', pt: 'Explore sem limites.', fr: 'Explorez sans limites.', de: 'Grenzenlos entdecken.' },
  sostenibilidad:    { es: 'Sostenibilidad', en: 'Sustainability', pt: 'Sustentabilidade', fr: 'Durabilité', de: 'Nachhaltigkeit' },
  sostenibilidad_lema:{ es: 'Viajá hoy, cuidá mañana.', en: 'Travel today, protect tomorrow.', pt: 'Viaje hoje, cuide do amanhã.', fr: 'Voyagez aujourd hui, préservez demain.', de: 'Heute reisen, morgen bewahren.' },
  comunidad:         { es: 'Comunidad', en: 'Community', pt: 'Comunidade', fr: 'Communauté', de: 'Gemeinschaft' },
  comunidad_lema:    { es: 'Compartimos la misma pasión.', en: 'We share the same passion.', pt: 'Compartilhamos a mesma paixão.', fr: 'Nous partageons la même passion.', de: 'Uns verbindet dieselbe Leidenschaft.' },
  para_negocios:     { es: 'Para negocios de acá', en: 'For local businesses', pt: 'Para negócios locais', fr: 'Pour les établissements locaux', de: 'Für örtliche Betriebe' },
  tu_negocio:        { es: 'Tu negocio, encontrado', en: 'Your business, found', pt: 'Seu negócio, encontrado', fr: 'Votre établissement, trouvé', de: 'Ihr Betrieb, gefunden' },
  negocio_explica:   { es: 'Tu ficha es gratis: corregís tus datos, respondés reseñas y subís tus fotos.', en: 'Your listing is free: fix your details, answer reviews and upload your photos.', pt: 'Sua ficha é grátis: corrija seus dados, responda avaliações e envie fotos.', fr: 'Votre fiche est gratuite : corrigez vos données, répondez aux avis et ajoutez vos photos.', de: 'Ihr Eintrag ist kostenlos: Daten korrigieren, Bewertungen beantworten, Fotos hochladen.' },
  sumar_negocio:     { es: 'Sumar mi negocio, gratis', en: 'Add my business, free', pt: 'Adicionar meu negócio, grátis', fr: 'Ajouter mon établissement, gratuit', de: 'Betrieb eintragen, kostenlos' },
  pareja:            { es: 'Pareja', en: 'Couple', pt: 'Casal', fr: 'En couple', de: 'Paar' },
  familia:           { es: 'Familia', en: 'Family', pt: 'Família', fr: 'Famille', de: 'Familie' },
  amigos:            { es: 'Amigos', en: 'Friends', pt: 'Amigos', fr: 'Amis', de: 'Freunde' },
  solo:              { es: 'Solo', en: 'Solo', pt: 'Sozinho', fr: 'Seul', de: 'Allein' },
};

export function t(clave: string, idioma: Idioma): string {
  return T[clave]?.[idioma] ?? T[clave]?.es ?? clave;
}
