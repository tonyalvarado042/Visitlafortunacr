-- Plataforma de destinos | 14: un mensaje puede ir a una conversacion anonima
-- El chat web empieza sin saber quien es el viajero. Antes un mensaje tenia
-- que apuntar a un viajero o a un negocio; ahora tambien vale apuntar a una
-- conversacion, que es como entra un visitante anonimo.

alter table destinos.dst_mensaje drop constraint ck_dst_mensaje_a_alguien;
alter table destinos.dst_mensaje add constraint ck_dst_mensaje_a_alguien
  check (viajero_id is not null or negocio_id is not null or conversacion_id is not null);
