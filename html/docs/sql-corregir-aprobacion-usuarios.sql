-- Correccion puntual para aprobar usuarios desde Kilvio FIT.
-- Ejecutar en Supabase SQL Editor.

create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

create or replace function app_private.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.perfiles p
    where p.user_id = (select auth.uid())
      and p.rol = 'administrador'
      and lower(coalesce(p.estado, '')) = 'activo'
  );
$$;

create or replace function app_private.current_admin_gimnasio_id()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select p.gimnasio_id::text
  from public.perfiles p
  where p.user_id = (select auth.uid())
    and p.rol = 'administrador'
    and lower(coalesce(p.estado, '')) = 'activo'
  limit 1;
$$;

revoke all on function app_private.is_admin() from public;
revoke all on function app_private.current_admin_gimnasio_id() from public;
grant execute on function app_private.is_admin() to authenticated;
grant execute on function app_private.current_admin_gimnasio_id() to authenticated;

grant insert on public.perfiles to authenticated;

drop policy if exists "perfiles_insert_admin_gimnasio" on public.perfiles;
drop policy if exists "perfiles_admin_insertar_autorizados" on public.perfiles;

create policy "perfiles_insert_admin_gimnasio"
on public.perfiles
for insert
to authenticated
with check (
  app_private.is_admin()
  and gimnasio_id::text = app_private.current_admin_gimnasio_id()
);

notify pgrst, 'reload schema';
