/*
 * Por dónde le escribe al equipo quien está mirando una página pública.
 *
 * ⚠️ POR QUÉ EXISTE ESTO.
 *
 * El botón «Reservá con el equipo» de la página de un plan disparaba un
 * evento (`abrir-concierge`) que ESCUCHA EL CHAT. Y el chat solo se monta
 * cuando `destino.chat_activo` está encendido — se apaga desde Ajustes.
 *
 * Con el chat apagado, el botón quedaba vivo, se podía tocar, y **no pasaba
 * nada**: el evento se disparaba al vacío. Lo encontró Tony el 10 de
 * noviembre de 2026 mirando un plan en inglés.
 *
 * Es el caso de manual de su propia regla: lo que puede fallar tiene que poder
 * decirlo, y lo que se sabe de antemano que va a rebotar no se ofrece. Acá hay
 * algo mejor que esconder el botón: **darle a dónde ir**.
 *
 * LA CASCADA, de lo mejor a lo que sea:
 *   1. el chat, si está encendido — es el único que contesta en el momento;
 *   2. WhatsApp, si el destino tiene número;
 *   3. el correo del equipo;
 *   4. nada: ahí sí, el botón NO se ofrece. Un botón que no lleva a ninguna
 *      parte es peor que ninguno.
 *
 * El correo que se usa es `email_contacto`, el PÚBLICO — nunca `email_avisos`,
 * que es el interno del equipo y no se le muestra a nadie de afuera.
 */

export type CanalDelEquipo =
  | { tipo: 'chat' }
  | { tipo: 'whatsapp' | 'correo'; href: string }
  | null;

type DestinoParaContacto = {
  chat_activo: boolean;
  whatsapp: string | null;
  email_contacto: string | null;
};

export function contactoDelEquipo(
  destino: DestinoParaContacto,
  asunto: string,
  cuerpo: string,
): CanalDelEquipo {
  if (destino.chat_activo) return { tipo: 'chat' };

  /* wa.me quiere solo dígitos: ni +, ni espacios, ni guiones. Con cualquiera
     de esos el enlace abre WhatsApp en blanco, que es otra manera de no hacer
     nada. */
  const numero = (destino.whatsapp ?? '').replace(/\D/g, '');
  if (numero.length >= 8) {
    return { tipo: 'whatsapp', href: `https://wa.me/${numero}?text=${encodeURIComponent(cuerpo)}` };
  }

  const correo = (destino.email_contacto ?? '').trim();
  if (correo.includes('@')) {
    return {
      tipo: 'correo',
      href: `mailto:${correo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`,
    };
  }

  return null;
}
