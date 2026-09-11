-- Plataforma de destinos | 17: reclamar una invitacion ya registrado
-- El trigger de alta solo corre al INSERT en auth.users. Si la persona ya
-- habia creado su cuenta ANTES de que la invitaran, el trigger nunca vuelve a
-- correr y se queda sin acceso para siempre, aunque la invitacion exista.
-- Esta funcion cierra ese hueco: al entrar al panel, quien no tiene ficha de
-- equipo reclama su invitacion pendiente. Sirve en los dos ordenes.

create or replace function destinos.reclamar_invitacion() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_id     uuid := (select auth.uid());
  v_email  text;
  v_nombre text;
  v_inv    destinos.dst_invitacion%rowtype;
begin
  if v_id is null then
    return false;
  end if;

  -- Ya es del equipo: nada que reclamar.
  if exists (select 1 from destinos.dst_usuario u where u.id = v_id) then
    return false;
  end if;

  select u.email, u.raw_user_meta_data ->> 'nombre'
    into v_email, v_nombre
    from auth.users u where u.id = v_id;

  if v_email is null then
    return false;
  end if;

  select * into v_inv
    from destinos.dst_invitacion
   where lower(email) = lower(v_email)
     and aceptada_en is null
     and vence_el > now()
   order by creado_en desc
   limit 1;

  if not found then
    return false;
  end if;

  insert into destinos.dst_usuario (id, nombre, email, rol, destinos_ids, esta_activo, invitado_por)
  values (v_id,
          coalesce(nullif(trim(v_inv.nombre), ''), nullif(trim(v_nombre), ''), split_part(v_email, '@', 1)),
          lower(v_email), v_inv.rol, v_inv.destinos_ids, true, v_inv.invitado_por)
  on conflict (id) do nothing;

  update destinos.dst_invitacion
     set aceptada_en = now(), usuario_id = v_id
   where id = v_inv.id;

  return true;
end;
$$;

comment on function destinos.reclamar_invitacion is
  'Quien entra al panel sin ficha de equipo reclama su invitacion pendiente. Cubre el caso de haberse registrado antes de ser invitado, que el trigger de auth.users no puede atender. Solo mira invitaciones al correo de la propia cuenta: nadie puede reclamar la de otro.';

revoke all on function destinos.reclamar_invitacion() from public, anon;
grant execute on function destinos.reclamar_invitacion() to authenticated;
