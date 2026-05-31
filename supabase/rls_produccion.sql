-- Kilvio FIT - RLS de produccion
-- Ejecutar DESPUES de schema_produccion.sql y solo cuando el sistema funcione correctamente.
-- Activa Row Level Security y crea politicas por gimnasio/rol.

alter table public.gimnasios enable row level security;
alter table public."Miembros" enable row level security;
alter table public.pagos enable row level security;
alter table public.perfiles enable row level security;
alter table public.asistencias enable row level security;
alter table public.ingresos_diarios enable row level security;
alter table public.productos enable row level security;
alter table public.proveedores enable row level security;
alter table public.compras_proveedores enable row level security;
alter table public.ventas enable row level security;
alter table public.venta_detalles enable row level security;
alter table public.movimientos_inventario enable row level security;
alter table public.configuracion_mensualidad enable row level security;
alter table public.facturas enable row level security;
alter table public.notificaciones enable row level security;
alter table public.contadores_recibos enable row level security;

do $$
begin
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'gimnasios' and policyname = 'Gimnasios visibles por perfil') then
        create policy "Gimnasios visibles por perfil"
        on public.gimnasios for select
        to authenticated
        using (id = public.current_gimnasio_id());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'perfiles' and policyname = 'Usuarios ven perfiles de su gimnasio') then
        create policy "Usuarios ven perfiles de su gimnasio"
        on public.perfiles for select
        to authenticated
        using (user_id = auth.uid() or gimnasio_id = public.current_gimnasio_id());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'Miembros' and policyname = 'Miembros visibles por gimnasio') then
        create policy "Miembros visibles por gimnasio"
        on public."Miembros" for select
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'Miembros' and policyname = 'Miembros administrados por gimnasio') then
        create policy "Miembros administrados por gimnasio"
        on public."Miembros" for insert
        to authenticated
        with check (gimnasio_id = public.current_gimnasio_id());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'Miembros' and policyname = 'Miembros actualizados por gimnasio') then
        create policy "Miembros actualizados por gimnasio"
        on public."Miembros" for update
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id())
        with check (gimnasio_id = public.current_gimnasio_id());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pagos' and policyname = 'Pagos visibles por gimnasio') then
        create policy "Pagos visibles por gimnasio"
        on public.pagos for select
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'asistencias' and policyname = 'Asistencias por gimnasio') then
        create policy "Asistencias por gimnasio"
        on public.asistencias for all
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id())
        with check (gimnasio_id = public.current_gimnasio_id());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'productos' and policyname = 'Productos visibles por gimnasio') then
        create policy "Productos visibles por gimnasio"
        on public.productos for select
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'proveedores' and policyname = 'Proveedores administrados por gimnasio') then
        create policy "Proveedores administrados por gimnasio"
        on public.proveedores for all
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id() and public.is_admin())
        with check (gimnasio_id = public.current_gimnasio_id() and public.is_admin());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'compras_proveedores' and policyname = 'Compras visibles por gimnasio') then
        create policy "Compras visibles por gimnasio"
        on public.compras_proveedores for select
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ventas' and policyname = 'Ventas visibles por gimnasio') then
        create policy "Ventas visibles por gimnasio"
        on public.ventas for select
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'venta_detalles' and policyname = 'Detalles visibles por gimnasio') then
        create policy "Detalles visibles por gimnasio"
        on public.venta_detalles for select
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'movimientos_inventario' and policyname = 'Movimientos visibles por gimnasio') then
        create policy "Movimientos visibles por gimnasio"
        on public.movimientos_inventario for select
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'configuracion_mensualidad' and policyname = 'Configuracion visible por gimnasio') then
        create policy "Configuracion visible por gimnasio"
        on public.configuracion_mensualidad for select
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'facturas' and policyname = 'Facturas visibles por gimnasio') then
        create policy "Facturas visibles por gimnasio"
        on public.facturas for select
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notificaciones' and policyname = 'Notificaciones por gimnasio') then
        create policy "Notificaciones por gimnasio"
        on public.notificaciones for select
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id());
    end if;
end $$;

