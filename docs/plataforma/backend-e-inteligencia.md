# El backend: CRM, IA y panel

Cómo está armado lo que pasa detrás del sitio. Leé primero `CLAUDE.md`.

## Las piezas

| Pieza | Dónde vive | Qué hace |
|---|---|---|
| Panel `/admin` | `app/admin/**` | Tablero, leads, conversaciones, viajeros, reservas, tareas, negocios, tours, guías, inteligencia, reportes, equipo, ajustes. |
| Sesión y permisos | `lib/supabase-sesion.ts`, `lib/admin/*` | El panel usa la sesión del usuario: las políticas de acceso (RLS) y la auditoría saben quién hizo qué. Roles en `lib/admin/permisos.ts`. |
| Cliente de servicio | `lib/supabase-servidor.ts` | Solo servidor (`server-only`). Lo usan la IA, los webhooks y el cron. |
| Capa de IA | `lib/ia/*` | Cinco agentes con `@anthropic-ai/sdk`. Todo pasa por `ejecutar()` en `lib/ia/cliente.ts`, que registra tokens y costo en `dst_agente_ejecucion`. |
| Motor de seguimiento | `lib/automatizaciones.ts` | Ejecuta lo que la base programó (`programar_automatizaciones`). |
| Rutas | `app/api/**` | `solicitud` (leads), `ia/conversar` (chat web), `ia/planificar`, `webhooks/whatsapp`, `cron/automatizaciones`. |
| Chat del sitio | `componentes/Concierge.tsx` | "Preguntale a alguien de aquí". Abre en todas las páginas públicas. |
| Plan público | `app/[idioma]/plan/[babosa]` | La URL que recibe el viajero con su itinerario. |

## Los cinco agentes (`dst_agente`)

| Clave | Hace | Cómo |
|---|---|---|
| `concierge` | Conversa por chat web, WhatsApp y correo. | Tool runner con herramientas: `buscar_conocimiento`, `buscar_lugares`, `buscar_tours`, `guardar_datos_viajero`, `crear_solicitud`, `escalar_a_humano`, `no_molestar`. |
| `planificador` | Arma itinerarios con negocios y tours reales. | Salida estructurada (`zodOutputFormat`); los ids se validan contra el catálogo antes de guardar. |
| `seguimiento` | Puntúa leads (0-100, frío/tibio/caliente, siguiente acción) y redacta seguimientos. | Salida estructurada. Nunca envía: lo hacen las automatizaciones o una persona. |
| `analista` | Resume conversaciones, sentimiento, intención, calidad 1-5, mejoras. | Salida estructurada. Marca `requiere_revision`. |
| `redactor` | Borradores de guías SEO con el catálogo. | Salida estructurada. Nace en borrador. |

El modelo, el esfuerzo, las instrucciones y el tono de cada agente se cambian
desde `/admin/ia/agentes/<clave>` sin desplegar. El prompt base vive en el
código; lo del panel se suma.

## Cómo se alimenta la IA

`dst_conocimiento`: fichas por destino (dato, faq, política, guion, regla,
aviso). Prioridad 7 o más va siempre en el prompt; el resto lo busca el agente
con `buscar_conocimiento` (texto completo es/en/simple + trigramas, con "o"
entre palabras). Se editan en `/admin/ia/conocimiento`, donde también se puede
probar qué encontraría la IA para una pregunta. Las fichas nacen sin verificar:
el equipo las marca.

## Cómo entran y salen los mensajes

- Entrada: `destinos.registrar_mensaje_entrante(...)`. Encuentra o crea la
  conversación y el viajero (por WhatsApp o correo), guarda el mensaje. Es
  idempotente por `id_externo`, así que los reintentos de Meta no duplican.
- Salida: `lib/ia/mensajeria.ts` elige el canal (WhatsApp si tiene, si no
  correo), manda por Meta Cloud API o Resend, y registra con
  `registrar_mensaje_saliente`. Si el canal no está configurado, el mensaje
  queda `pendiente` y aparece en `/admin/ia/aprobaciones` para mandarlo a mano.
- La configuración del canal está en `dst_canal` (Ajustes). El secreto nunca
  vive en la base: está en la variable de entorno cuyo nombre dice el canal.

## Quién atiende

Cada conversación tiene `atendida_por`: `ia` o `humano`. Cuando una persona
responde desde el panel, se queda con la conversación y la IA no contesta
hasta que la devuelva. La IA escala sola ante quejas, salud, dinero o cuando no
encuentra la respuesta: la conversación pasa a `escalada`, se crea una tarea
y se marca para revisión.

## Automatizaciones

`dst_automatizacion` define reglas (disparador + condiciones → acción +
parámetros). `programar_automatizaciones(destino)` deja filas en
`dst_automatizacion_envio` (una por lead e intento: nunca se manda dos veces).
El cron (`vercel.json`, cada hora, con `CRON_SECRET`) las ejecuta con
`correrAutomatizaciones()`: plantillas, mensajes de la IA (con aprobación si la
regla lo pide), tareas, cambios de etapa, puntuación. Entre 21:00 y 8:00 del
destino no se escribe a nadie. `no_molestar` en el viajero apaga todo.

Las diez reglas de arranque se crean con `preparar_inteligencia_destino`, que
también corre sola cuando nace un destino (trigger en `dst_destino`).

## Control de usuarios

Al panel se entra por invitación (`dst_invitacion`). Cuando la persona crea su
cuenta con ese correo, un trigger en `auth.users` la vuelve `dst_usuario` con
el rol y los destinos de la invitación. Roles: admin, vendedor, editor,
moderador, socio (`lib/admin/permisos.ts`). `destinos_ids` vacío = todos los
destinos. Todo cambio sensible queda en `dst_auditoria`.

## Variables de entorno

Ver `.env.example`. Sin `ANTHROPIC_API_KEY` y `SUPABASE_SECRET_KEY` el panel
funciona pero la IA no; sin `WHATSAPP_*` o `RESEND_API_KEY` los mensajes quedan
pendientes de envío manual. `/admin/ajustes` muestra cuáles están puestas.

## Probar

- `/admin/ia`: "Probar el concierge" corre el agente real y deja la
  conversación en `/admin/conversaciones` con las herramientas que usó.
- `/admin/ia`: "Correr automatizaciones ahora" ejecuta el motor para el
  destino actual y muestra el resumen.
- `/admin/ia/ejecuciones`: cada llamada al modelo con tokens, costo y error.
