-- 002_auth_profiles_users.sql
-- Auth/profile helpers and user administration. Single canonical definitions only.

create or replace function app_private.current_profile()
returns public.perfiles
language sql
stable
security definer
set search_path = public, app_private
as $$
  select p
  from public.perfiles p
  where p.user_id = auth.uid()
    and p.estado = 'activo'
  limit 1;
$$;

create or replace function app_private.current_gimnasio_id()
returns uuid
language sql
stable
security definer
set search_path = public, app_private
as $$
  select p.gimnasio_id
  from public.perfiles p
  where p.user_id = auth.uid()
    and p.estado = 'activo'
  limit 1;
$$;

create or replace function app_private.current_role()
returns text
language sql
stable
security definer
set search_path = public, app_private
as $$
  select p.rol
  from public.perfiles p
  where p.user_id = auth.uid()
    and p.estado = 'activo'
  limit 1;
$$;

create or replace function app_private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select exists (
    select 1
    from public.perfiles p
    where p.user_id = auth.uid()
      and p.rol = 'administrador'
      and p.estado = 'activo'
      and p.gimnasio_id is not null
  );
$$;

create or replace function app_private.is_super_admin_saas()
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select exists (
    select 1
    from public.perfiles p
    where p.user_id = auth.uid()
      and p.rol = 'super_admin_saas'
      and p.estado = 'activo'
  );
$$;

create or replace function app_private.current_admin_gimnasio_id()
returns uuid
language sql
stable
security definer
set search_path = public, app_private
as $$
  select p.gimnasio_id
  from public.perfiles p
  where p.user_id = auth.uid()
    and p.rol = 'administrador'
    and p.estado = 'activo'
    and p.gimnasio_id is not null
  limit 1;
$$;

create or replace function public.listar_usuarios_gimnasio()
returns table (
  id uuid,
  user_id uuid,
  gimnasio_id uuid,
  nombre text,
  telefono text,
  email text,
  rol text,
  estado text,
  permisos jsonb,
  created_at timestamptz,
  ultimo_acceso timestamptz
)
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_admin public.perfiles;
begin
  if auth.uid() is null then
    raise exception 'Usuario no autenticado';
  end if;

  select * into v_admin
  from public.perfiles p
  where p.user_id = auth.uid()
    and p.rol = 'administrador'
    and p.estado = 'activo'
    and p.gimnasio_id is not null
  limit 1;

  if v_admin.id is null then
    raise exception 'Solo administradores activos pueden listar usuarios del gimnasio';
  end if;

  return query
  select
    p.id,
    p.user_id,
    p.gimnasio_id,
    coalesce(p.nombre, au.email) as nombre,
    p.telefono,
    au.email,
    p.rol,
    p.estado,
    p.permisos,
    p.created_at,
    p.ultimo_acceso
  from public.perfiles p
  left join auth.users au on au.id = p.user_id
  where p.gimnasio_id = v_admin.gimnasio_id
    and p.rol in ('administrador','recepcion')
  order by p.created_at desc;
end;
$$;

create or replace function public.cambiar_estado_usuario(p_perfil_id uuid, p_estado text)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_admin public.perfiles;
  v_target public.perfiles;
begin
  if auth.uid() is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_estado not in ('activo','inactivo','suspendido') then
    raise exception 'Estado inválido: %', p_estado;
  end if;

  select * into v_admin
  from public.perfiles p
  where p.user_id = auth.uid()
    and p.rol = 'administrador'
    and p.estado = 'activo'
    and p.gimnasio_id is not null
  limit 1;

  if v_admin.id is null then
    raise exception 'Solo administradores activos pueden cambiar estado de usuarios';
  end if;

  select * into v_target
  from public.perfiles p
  where p.id = p_perfil_id
  for update;

  if v_target.id is null then
    raise exception 'Perfil no encontrado';
  end if;

  if v_target.gimnasio_id is distinct from v_admin.gimnasio_id then
    raise exception 'No puede modificar usuarios de otro gimnasio';
  end if;

  if v_target.user_id = auth.uid() and p_estado <> 'activo' then
    raise exception 'No puede desactivar o suspender su propio usuario';
  end if;

  update public.perfiles
  set estado = p_estado,
      updated_at = now()
  where id = p_perfil_id;

  insert into public.auditoria_eventos(gimnasio_id, usuario_id, entidad, entidad_id, accion, datos)
  values (
    v_admin.gimnasio_id,
    auth.uid(),
    'perfiles',
    p_perfil_id::text,
    'cambiar_estado_usuario',
    jsonb_build_object('estado', p_estado)
  );

  return jsonb_build_object('success', true, 'perfil_id', p_perfil_id, 'estado', p_estado);
end;
$$;

revoke all on function app_private.current_profile() from public;
revoke all on function app_private.current_gimnasio_id() from public;
revoke all on function app_private.current_role() from public;
revoke all on function app_private.is_admin() from public;
revoke all on function app_private.is_super_admin_saas() from public;
revoke all on function app_private.current_admin_gimnasio_id() from public;
revoke all on function public.listar_usuarios_gimnasio() from public;
revoke all on function public.cambiar_estado_usuario(uuid, text) from public;

grant execute on function public.listar_usuarios_gimnasio() to authenticated;
grant execute on function public.cambiar_estado_usuario(uuid, text) to authenticated;
