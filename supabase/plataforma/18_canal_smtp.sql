-- Plataforma de destinos | 18: el correo puede salir por SMTP
-- El canal de correo solo aceptaba 'resend', cuya API exige un dominio
-- verificado antes de escribirle a desconocidos. Con 'smtp' el destino puede
-- salir por Brevo, Mailjet, SendGrid, Amazon SES, Gmail o el correo del
-- hosting, y cambiar de proveedor sin tocar el codigo: solo el canal y las
-- variables de entorno.

alter table destinos.dst_canal drop constraint dst_canal_proveedor_check;
alter table destinos.dst_canal add constraint dst_canal_proveedor_check
  check (proveedor in ('meta', 'resend', 'smtp', 'web', 'manual'));

comment on column destinos.dst_canal.proveedor is
  'Por donde sale: meta (WhatsApp Cloud API), resend (API de correo), smtp (cualquier servidor de correo), web (el chat del sitio), manual (lo manda una persona a mano).';
