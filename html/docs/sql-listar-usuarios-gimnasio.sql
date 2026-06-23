-- RPC segura para listar usuarios activos del gimnasio del administrador.
-- Ejecutar en Supabase SQL Editor.

create or replace function public.listar_usuarios_gimnasio()
returns table (
  id uuid,
  user_id uuid,
  nombre text,
  rol text,
  estado text,
  gimnasio_id uuid,
  permisos text[],
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gimnasio_id uuid;
begin
  select p.gimnasio_id
  into v_gimnasio_id
  from public.perfiles p
  where p.user_id = auth.uid()
    and p.rol = 'administrador'
    and lower(coalesce(p.estado,'')) = 'activo'
  limit 1;

  if v_gimnasio_id is null then
    raise exception 'No autorizado';
  end if;

  return query
  select
    p.id,
    p.user_id,
    p.nombre,
    p.rol,
    p.estado,
    p.gimnasio_id,
    p.permisos,
    p.created_at
  from public.perfiles p
  where p.gimnasio_id = v_gimnasio_id
  order by p.created_at desc;
end;
$$;

revoke all on function public.listar_usuarios_gimnasio() from public;
grant execute on function public.listar_usuarios_gimnasio() to authenticated;

notify pgrst, 'reload schema';
