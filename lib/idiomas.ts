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
  menu:              { es: 'Menú', en: 'Menu', pt: 'Menu', fr: 'Menu', de: 'Menü' },
  lugar:             { es: 'lugar', en: 'place', pt: 'lugar', fr: 'lieu', de: 'Ort' },
  resultados:        { es: 'Resultados', en: 'Results', pt: 'Resultados', fr: 'Résultats', de: 'Ergebnisse' },
  todo_el_directorio:{ es: 'Todo el directorio', en: 'The whole directory', pt: 'Todo o diretório', fr: 'Tout le répertoire', de: 'Das ganze Verzeichnis' },
  todas:             { es: 'Todas', en: 'All', pt: 'Todas', fr: 'Toutes', de: 'Alle' },
  limpiar:           { es: 'Limpiar', en: 'Clear', pt: 'Limpar', fr: 'Effacer', de: 'Zurücksetzen' },
  sin_resultados:    { es: 'Nada con esas palabras', en: 'Nothing matches those words', pt: 'Nada com essas palavras', fr: 'Rien avec ces mots', de: 'Nichts mit diesen Wörtern' },
  sin_resultados_pista: { es: 'Probá con menos palabras, o mirá todo el directorio.', en: 'Try fewer words, or browse the whole directory.', pt: 'Tente menos palavras, ou veja todo o diretório.', fr: 'Essayez avec moins de mots, ou parcourez tout le répertoire.', de: 'Versuchen Sie weniger Wörter, oder sehen Sie das ganze Verzeichnis.' },
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
  escribi_primera:   { es: 'Escribí la primera', en: 'Write the first one', pt: 'Escreva a primeira', fr: 'Écrivez le premier', de: 'Schreiben Sie die erste' },

  /* ---- Ficha: secciones plegables, horario y servicios ---- */
  sec_incluye:       { es: 'Qué incluye', en: 'What is included', pt: 'O que inclui', fr: 'Ce qui est inclus', de: 'Inbegriffen' },
  sec_no_incluye:    { es: 'Qué no incluye', en: 'What is not included', pt: 'O que não inclui', fr: 'Ce qui n’est pas inclus', de: 'Nicht inbegriffen' },
  sec_que_esperar:   { es: 'Qué esperar', en: 'What to expect', pt: 'O que esperar', fr: 'À quoi s’attendre', de: 'Was dich erwartet' },
  sec_encuentro:     { es: 'Encuentro y recogida', en: 'Meeting and pickup', pt: 'Encontro e transporte', fr: 'Point de rencontre et navette', de: 'Treffpunkt und Abholung' },
  sec_accesibilidad: { es: 'Accesibilidad', en: 'Accessibility', pt: 'Acessibilidade', fr: 'Accessibilité', de: 'Barrierefreiheit' },
  sec_adicional:     { es: 'Información adicional', en: 'Additional information', pt: 'Informações adicionais', fr: 'Informations complémentaires', de: 'Weitere Informationen' },
  horario:           { es: 'Horario', en: 'Opening hours', pt: 'Horário', fr: 'Horaires', de: 'Öffnungszeiten' },
  cerrado:           { es: 'Cerrado', en: 'Closed', pt: 'Fechado', fr: 'Fermé', de: 'Geschlossen' },
  servicios:         { es: 'Servicios y ambiente', en: 'Amenities and atmosphere', pt: 'Serviços e ambiente', fr: 'Services et ambiance', de: 'Ausstattung und Ambiente' },
  consultar:         { es: 'Consultar disponibilidad', en: 'Ask about availability', pt: 'Consultar disponibilidade', fr: 'Demander les disponibilités', de: 'Verfügbarkeit anfragen' },

  /* ---- Reseñas propias ---- */
  resenas_titulo:    { es: 'Lo que dice quien ya fue', en: 'What people who went say', pt: 'O que diz quem já foi', fr: 'Ce qu’en disent ceux qui y sont allés', de: 'Was Besucher sagen' },
  resena_una:        { es: 'reseña', en: 'review', pt: 'avaliação', fr: 'avis', de: 'Bewertung' },
  resena_varias:     { es: 'reseñas', en: 'reviews', pt: 'avaliações', fr: 'avis', de: 'Bewertungen' },
  se_el_primero:     { es: 'Calificá vos', en: 'Rate it yourself', pt: 'Avalie você', fr: 'Donnez votre avis', de: 'Jetzt bewerten' },
  tu_calificacion:   { es: '¿Cuántos volcanes le das?', en: 'How many volcanoes would you give it?', pt: 'Quantos vulcões você dá?', fr: 'Combien de volcans lui donnez-vous ?', de: 'Wie viele Vulkane gibst du?' },
  calificar_con:     { es: 'Calificar con', en: 'Rate it', pt: 'Avaliar com', fr: 'Noter', de: 'Bewerten mit' },
  de_cinco:          { es: 'de 5', en: 'out of 5', pt: 'de 5', fr: 'sur 5', de: 'von 5' },
  escribi_resena:    { es: 'Contanos cómo te fue', en: 'Tell us how it went', pt: 'Conte como foi', fr: 'Racontez-nous', de: 'Erzähl uns davon' },
  contanos:          { es: 'Tu reseña', en: 'Your review', pt: 'Sua avaliação', fr: 'Votre avis', de: 'Deine Bewertung' },
  contanos_pista:    { es: 'Qué hiciste, qué te sorprendió y qué le dirías a alguien que va por primera vez.', en: 'What you did, what surprised you, and what you would tell someone going for the first time.', pt: 'O que fez, o que surpreendeu e o que diria a quem vai pela primeira vez.', fr: 'Ce que vous avez fait, ce qui vous a surpris, et ce que vous diriez à quelqu’un qui y va pour la première fois.', de: 'Was du gemacht hast, was dich überrascht hat und was du jemandem beim ersten Mal sagen würdest.' },
  titulo_opcional:   { es: 'Un título (opcional)', en: 'A title (optional)', pt: 'Um título (opcional)', fr: 'Un titre (facultatif)', de: 'Ein Titel (optional)' },
  tu_nombre:         { es: 'Tu nombre', en: 'Your name', pt: 'Seu nome', fr: 'Votre nom', de: 'Dein Name' },
  tu_email:          { es: 'Tu correo', en: 'Your email', pt: 'Seu e-mail', fr: 'Votre e-mail', de: 'Deine E-Mail' },
  email_privado:     { es: 'No se publica. Sirve para verificar la reseña y para escribirte si el negocio responde.', en: 'Not published. We use it to verify the review and to reach you if the business replies.', pt: 'Não é publicado. Serve para verificar a avaliação e avisar se o negócio responder.', fr: 'Non publié. Il sert à vérifier l’avis et à vous prévenir si l’établissement répond.', de: 'Wird nicht veröffentlicht. Nur zur Prüfung der Bewertung und für eine Antwort des Betriebs.' },
  cuando_fuiste:     { es: '¿Cuándo fuiste?', en: 'When did you go?', pt: 'Quando você foi?', fr: 'Quand y êtes-vous allé ?', de: 'Wann warst du dort?' },
  faltan:            { es: 'Faltan', en: 'Still need', pt: 'Faltam', fr: 'Encore', de: 'Es fehlen' },
  asi_esta_bien:     { es: 'Así está bien', en: 'That works', pt: 'Assim está bom', fr: 'C’est bon', de: 'So passt es' },
  publicar_resena:   { es: 'Publicar mi reseña', en: 'Publish my review', pt: 'Publicar minha avaliação', fr: 'Publier mon avis', de: 'Bewertung veröffentlichen' },
  una_por_persona:   { es: 'Una reseña por persona y por lugar. Si ya escribiste una, esta la reemplaza.', en: 'One review per person and place. If you already wrote one, this replaces it.', pt: 'Uma avaliação por pessoa e por lugar. Se já escreveu uma, esta a substitui.', fr: 'Un avis par personne et par lieu. Si vous en avez déjà écrit un, celui-ci le remplace.', de: 'Eine Bewertung pro Person und Ort. Eine frühere wird ersetzt.' },
  resena_gracias:    { es: '¡Gracias! Tu reseña ya está publicada.', en: 'Thank you! Your review is live.', pt: 'Obrigado! Sua avaliação já está publicada.', fr: 'Merci ! Votre avis est en ligne.', de: 'Danke! Deine Bewertung ist online.' },
  resena_en_revision:{ es: '¡Gracias! La leemos y la publicamos en cuanto podamos.', en: 'Thank you! We will read it and publish it shortly.', pt: 'Obrigado! Vamos ler e publicar em breve.', fr: 'Merci ! Nous la lisons et la publions bientôt.', de: 'Danke! Wir lesen sie und veröffentlichen sie bald.' },
  resena_error:      { es: 'No se pudo guardar la reseña. Probá de nuevo en un momento.', en: 'We could not save your review. Please try again in a moment.', pt: 'Não foi possível salvar a avaliação. Tente de novo em instantes.', fr: 'Impossible d’enregistrer votre avis. Réessayez dans un instant.', de: 'Die Bewertung konnte nicht gespeichert werden. Versuch es gleich noch einmal.' },
  resena_invalida:   { es: 'Revisá los datos: algo quedó incompleto.', en: 'Check the form: something is missing.', pt: 'Revise os dados: falta algo.', fr: 'Vérifiez le formulaire : il manque quelque chose.', de: 'Bitte prüfen: etwas fehlt noch.' },
  resena_corta:      { es: 'Contanos un poco más: al menos 40 caracteres.', en: 'Tell us a bit more: at least 40 characters.', pt: 'Conte um pouco mais: ao menos 40 caracteres.', fr: 'Dites-nous en un peu plus : 40 caractères minimum.', de: 'Erzähl etwas mehr: mindestens 40 Zeichen.' },
  correo_invalido:   { es: 'Ese correo no parece válido.', en: 'That email does not look valid.', pt: 'Esse e-mail não parece válido.', fr: 'Cet e-mail ne semble pas valide.', de: 'Diese E-Mail sieht nicht gültig aus.' },
  respuesta_negocio: { es: 'Respuesta del negocio', en: 'Reply from the business', pt: 'Resposta do negócio', fr: 'Réponse de l’établissement', de: 'Antwort des Betriebs' },
  visito_en:         { es: 'Fue en', en: 'Visited', pt: 'Foi em', fr: 'Visite en', de: 'Besuch im' },
  cerrar:            { es: 'Cerrar', en: 'Close', pt: 'Fechar', fr: 'Fermer', de: 'Schließen' },
  sin_lugares:       { es: 'Todavía no hay lugares en esta categoría.', en: 'No places in this category yet.', pt: 'Ainda não há lugares nesta categoria.', fr: 'Aucun lieu dans cette catégorie pour l’instant.', de: 'In dieser Kategorie gibt es noch nichts.' },
  ver_en:            { es: 'Ver en', en: 'See on', pt: 'Ver em', fr: 'Voir sur', de: 'Ansehen auf' },
  datos_de_google:   { es: 'Calificaciones y reseñas de Google, mostradas con enlace a su fuente.', en: 'Ratings and reviews from Google, shown with a link to the source.', pt: 'Notas e avaliações do Google, exibidas com link para a fonte.', fr: 'Notes et avis de Google, affichés avec un lien vers la source.', de: 'Bewertungen von Google, mit Link zur Quelle.' },
  sin_externas:      { es: 'Todavía no traemos opiniones de otras plataformas para este lugar.', en: 'We have not pulled in other platforms for this place yet.', pt: 'Ainda não trouxemos opiniões de outras plataformas para este lugar.', fr: 'Nous n’avons pas encore repris les avis d’autres plateformes pour ce lieu.', de: 'Für diesen Ort haben wir noch keine Bewertungen anderer Plattformen.' },
  lugares:           { es: 'lugares', en: 'places', pt: 'lugares', fr: 'lieux', de: 'Orte' },
  fotos:             { es: 'Fotos', en: 'Photos', pt: 'Fotos', fr: 'Photos', de: 'Fotos' },
  /* Va en el pie de la foto, junto al crédito, no en un aviso aparte. Corto a
     propósito: dice lo que hay que decir sin sonar a advertencia legal. */
  foto_generica:     { es: 'Imagen ilustrativa', en: 'Illustrative image', pt: 'Imagem ilustrativa', fr: 'Image d’illustration', de: 'Illustrationsbild' },
  foto_de:           { es: 'Foto de', en: 'Photo by', pt: 'Foto de', fr: 'Photo de', de: 'Foto von' },
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

/** "1 lugar" y no "1 lugares". Devuelve solo la palabra, no el número. */
export function lugares(cuantos: number, idioma: Idioma): string {
  return t(cuantos === 1 ? 'lugar' : 'lugares', idioma);
}

/** Igual que lugares, para "1 reseña" / "12 reseñas". */
export function resenas(cuantas: number, idioma: Idioma): string {
  return t(cuantas === 1 ? 'resena_una' : 'resena_varias', idioma);
}
