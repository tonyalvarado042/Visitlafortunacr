/*
 * Las plantillas que faltaban para contestarle a un lead de un solo clic.
 *
 * ⚠️ POR QUE ESTO EXISTE.
 *
 * El 13 de noviembre de 2026 habia **9 leads y los 9 en etapa `nuevo`**.
 * Ninguno contestado. Entre ellos gente de verdad: Amir (11 de noviembre) y
 * Hannah (10 de noviembre). No era falta de ganas: contestar costaba elegir
 * canal, apretar «Redactar con IA», ESPERAR a que la IA escribiera, leerlo y
 * recien ahi mandar. Cuatro pasos y una espera por cada persona.
 *
 * Tony lo pidio asi: «una pantalla en la parte de los leads donde yo le pueda
 * enviar un correo a la persona con un solo boton, automaticamente un correo
 * respondiendole sobre el tour como prearmado».
 *
 * Las cuatro plantillas que ya existian —bienvenida, itinerario_listo,
 * antes_de_llegar, despues_de_salir— son del motor automatico y ninguna sirve
 * para CONTESTAR una consulta. Estas cuatro si:
 *
 *   respuesta_tour   la respuesta a quien pregunto por un tour o un negocio
 *   seguimiento_1    el recordatorio amable a los pocos dias
 *   seguimiento_2    el ultimo intento, con algo util adentro
 *   cierre_suave     cerrar sin portazo, dejando la puerta abierta
 *
 * ⚠️ NINGUNA INVENTA UN DATO. No hay precios, ni horarios, ni disponibilidad:
 * eso no lo sabe el sistema y un correo que miente cuesta mas que uno que no
 * se manda. Todas preguntan lo que falta en vez de suponerlo.
 *
 * Variables nuevas que usan: {{negocio}} y {{enlace_negocio}}, que salen de
 * `dst_solicitud.negocio_id`. Si la consulta no traia negocio quedan vacias y
 * `rellenarPlantilla` limpia lo que la ausencia deja.
 *
 * Idiomas: es y en, los mismos que las plantillas que ya estaban y los unicos
 * que hoy tienen viajeros. Falta pt, igual que faltaba antes.
 */

insert into destinos.dst_plantilla_mensaje (destino_id, clave, canal, idioma, asunto, cuerpo, esta_activa)
select d.id, v.clave, 'email'::destinos.canal_mensaje, v.idioma, v.asunto, v.cuerpo, true
from destinos.dst_destino d
cross join (values

/* ── La respuesta sobre el tour ──────────────────────────────────────────── */
('respuesta_tour', 'es',
 'Sobre {{negocio}} — {{marca}}',
 'Hola {{nombre}},

Gracias por escribirnos sobre {{negocio}}. Con gusto te ayudamos.

{{enlace_negocio}}

Contanos dos cosas y te mandamos todo de una:

· ¿Qué día lo harías?
· ¿Cuántas personas van?

Con eso te confirmamos la disponibilidad y el precio exacto, sin vueltas.

{{marca}}'),

('respuesta_tour', 'en',
 'About {{negocio}} — {{marca}}',
 'Hi {{nombre}},

Thanks for reaching out about {{negocio}}. We are happy to help.

{{enlace_negocio}}

Tell us two things and we will send everything at once:

· What day would you like to go?
· How many people?

With that we can confirm availability and the exact price, no back and forth.

{{marca}}'),

/* ── Primer seguimiento ──────────────────────────────────────────────────── */
('seguimiento_1', 'es',
 '¿Seguimos con lo de {{destino}}?',
 'Hola {{nombre}},

Te escribimos hace unos días por tu consulta para {{destino}} y no queremos dejarte colgado.

¿Seguís con la idea? Decime las fechas y cuántos van, y te armo la opción concreta hoy mismo.

Y si ya lo resolviste por otro lado, decímelo nomás y no te escribo más.

{{marca}}'),

('seguimiento_1', 'en',
 'Still thinking about {{destino}}?',
 'Hi {{nombre}},

We wrote to you a few days ago about your request for {{destino}} and we do not want to leave you hanging.

Are you still planning it? Send us your dates and how many people, and we will put together a concrete option today.

And if you already sorted it out somewhere else, just tell us and we will stop writing.

{{marca}}'),

/* ── Segundo seguimiento ─────────────────────────────────────────────────── */
('seguimiento_2', 'es',
 'Una última idea para tu viaje a {{destino}}',
 'Hola {{nombre}},

Es la última vez que te molesto con esto.

Si todavía estás viendo {{destino}}, lo que mejor le funciona a casi todo el mundo es cerrar primero la actividad principal y acomodar el resto alrededor: los días buenos se llenan y el resto del viaje se arma solo.

Decime qué te gustaría hacer y te mando la opción. Vos decidís.

Si no es el momento, igual de bien. Buen viaje.

{{marca}}'),

('seguimiento_2', 'en',
 'One last idea for your trip to {{destino}}',
 'Hi {{nombre}},

This is the last time we will bother you about this.

If you are still considering {{destino}}, what works best for almost everyone is to lock in the main activity first and build the rest around it: the good days fill up, and the rest of the trip falls into place on its own.

Tell us what you would like to do and we will send you the option. Your call.

If this is not the right time, that is perfectly fine. Have a great trip.

{{marca}}'),

/* ── Cierre suave ────────────────────────────────────────────────────────── */
('cierre_suave', 'es',
 'Cierro tu consulta de {{destino}}',
 'Hola {{nombre}},

Como no supe más de vos, voy a cerrar tu consulta para no seguir llenándote el correo.

Si más adelante retomás el viaje, respondé este mismo correo y lo abrimos de nuevo — no hay que empezar de cero.

Que estés bien,
{{marca}}'),

('cierre_suave', 'en',
 'Closing your {{destino}} request',
 'Hi {{nombre}},

Since we have not heard back, we are closing your request so we stop filling up your inbox.

If you pick the trip up again later, just reply to this same email and we will reopen it — no need to start over.

All the best,
{{marca}}')

) as v(clave, idioma, asunto, cuerpo)
where d.dominio = 'visitlafortunacr.com'
on conflict (destino_id, clave, canal, idioma) do nothing;
