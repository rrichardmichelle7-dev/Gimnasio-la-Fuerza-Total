-- Kilvio FIT - RLS de produccion
-- Ejecutar DESPUES de supabase/schema_produccion.sql.
-- Este script NO borra datos, NO elimina tablas y NO renombra public."Miembros".
-- Requisito critico: cada usuario de Supabase Auth debe tener un registro activo
-- en public.perfiles con user_id = auth.users.id y gimnasio_id asignado.

begin;

-- Las funciones auxiliares son usadas por las politicas RLS.
-- Se evita exponerlas a anon. Los usuarios autenticados pueden invocarlas
-- para que las politicas evaluen su gimnasio y rol.
revoke execute on function public.current_gimnasio_id() from public, anon;
revoke execute on function public.current_user_role() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.current_gimnasio_id() to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;

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
    -- Gimnasios: cada usuario autenticado solo ve su gimnasio activo.
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'gimnasios' and policyname = 'gimnasios_select_mi_gimnasio') then
        create policy "gimnasios_select_mi_gimnasio"
        on public.gimnasios for select
        to authenticated
        using (id = public.current_gimnasio_id());
    end if;

    -- Perfiles: el usuario ve su propio perfil; administradores ven perfiles de su gimnasio.
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'perfiles' and policyname = 'perfiles_select_propios_o_admin_gimnasio') then
        create policy "perfiles_select_propios_o_admin_gimnasio"
        on public.perfiles for select
        to authenticated
        using (
            user_id = (select auth.uid())
            or (gimnasio_id = public.current_gimnasio_id() and public.is_admin())
        );
    end if;

    -- Miembros: conservar tabla real public."Miembros" con mayuscula.
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'Miembros' and policyname = 'miembros_select_por_gimnasio') then
        create policy "miembros_select_por_gimnasio"
        on public."Miembros" for select
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'Miembros' and policyname = 'miembros_insert_admin_recepcion') then
        create policy "miembros_insert_admin_recepcion"
        on public."Miembros" for insert
        to authenticated
        with check (
            gimnasio_id = public.current_gimnasio_id()
            and public.current_user_role() in ('administrador', 'recepcion')
        );
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'Miembros' and policyname = 'miembros_update_admin_recepcion') then
        create policy "miembros_update_admin_recepcion"
        on public."Miembros" for update
        to authenticated
        using (
            gimnasio_id = public.current_gimnasio_id()
            and public.current_user_role() in ('administrador', 'recepcion')
        )
        with check (
            gimnasio_id = public.current_gimnasio_id()
            and public.current_user_role() in ('administrador', 'recepcion')
        );
    end if;

    -- Pagos: recepcion puede registrar/actualizar; eliminar queda solo para administrador.
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pagos' and policyname = 'pagos_select_por_gimnasio') then
        create policy "pagos_select_por_gimnasio"
        on public.pagos for select
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pagos' and policyname = 'pagos_insert_admin_recepcion') then
        create policy "pagos_insert_admin_recepcion"
        on public.pagos for insert
        to authenticated
        with check (
            gimnasio_id = public.current_gimnasio_id()
            and public.current_user_role() in ('administrador', 'recepcion')
        );
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pagos' and policyname = 'pagos_update_admin_recepcion') then
        create policy "pagos_update_admin_recepcion"
        on public.pagos for update
        to authenticated
        using (
            gimnasio_id = public.current_gimnasio_id()
            and public.current_user_role() in ('administrador', 'recepcion')
        )
        with check (
            gimnasio_id = public.current_gimnasio_id()
            and public.current_user_role() in ('administrador', 'recepcion')
        );
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pagos' and policyname = 'pagos_delete_admin') then
        create policy "pagos_delete_admin"
        on public.pagos for delete
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id() and public.is_admin());
    end if;

    -- Asistencias: administrador, recepcion y entrenador pueden operar dentro de su gimnasio.
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'asistencias' and policyname = 'asistencias_select_por_gimnasio') then
        create policy "asistencias_select_por_gimnasio"
        on public.asistencias for select
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'asistencias' and policyname = 'asistencias_insert_roles_operativos') then
        create policy "asistencias_insert_roles_operativos"
        on public.asistencias for insert
        to authenticated
        with check (
            gimnasio_id = public.current_gimnasio_id()
            and public.current_user_role() in ('administrador', 'recepcion', 'entrenador')
        );
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'asistencias' and policyname = 'asistencias_update_roles_operativos') then
        create policy "asistencias_update_roles_operativos"
        on public.asistencias for update
        to authenticated
        using (
            gimnasio_id = public.current_gimnasio_id()
            and public.current_user_role() in ('administrador', 'recepcion', 'entrenador')
        )
        with check (
            gimnasio_id = public.current_gimnasio_id()
            and public.current_user_role() in ('administrador', 'recepcion', 'entrenador')
        );
    end if;

    -- Ingresos diarios: caja puede insertar/actualizar la fila diaria de su gimnasio.
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ingresos_diarios' and policyname = 'ingresos_diarios_select_por_gimnasio') then
        create policy "ingresos_diarios_select_por_gimnasio"
        on public.ingresos_diarios for select
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ingresos_diarios' and policyname = 'ingresos_diarios_insert_admin_recepcion') then
        create policy "ingresos_diarios_insert_admin_recepcion"
        on public.ingresos_diarios for insert
        to authenticated
        with check (
            gimnasio_id = public.current_gimnasio_id()
            and public.current_user_role() in ('administrador', 'recepcion')
        );
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ingresos_diarios' and policyname = 'ingresos_diarios_update_admin_recepcion') then
        create policy "ingresos_diarios_update_admin_recepcion"
        on public.ingresos_diarios for update
        to authenticated
        using (
            gimnasio_id = public.current_gimnasio_id()
            and public.current_user_role() in ('administrador', 'recepcion')
        )
        with check (
            gimnasio_id = public.current_gimnasio_id()
            and public.current_user_role() in ('administrador', 'recepcion')
        );
    end if;

    -- Productos: todos los usuarios del gimnasio pueden leer; solo administrador modifica inventario.
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'productos' and policyname = 'productos_select_por_gimnasio') then
        create policy "productos_select_por_gimnasio"
        on public.productos for select
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'productos' and policyname = 'productos_insert_admin') then
        create policy "productos_insert_admin"
        on public.productos for insert
        to authenticated
        with check (gimnasio_id = public.current_gimnasio_id() and public.is_admin());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'productos' and policyname = 'productos_update_admin') then
        create policy "productos_update_admin"
        on public.productos for update
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id() and public.is_admin())
        with check (gimnasio_id = public.current_gimnasio_id() and public.is_admin());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'productos' and policyname = 'productos_delete_admin') then
        create policy "productos_delete_admin"
        on public.productos for delete
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id() and public.is_admin());
    end if;

    -- Configuracion de mensualidad: visible por gimnasio; solo administrador la modifica.
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'configuracion_mensualidad' and policyname = 'configuracion_mensualidad_select_por_gimnasio') then
        create policy "configuracion_mensualidad_select_por_gimnasio"
        on public.configuracion_mensualidad for select
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'configuracion_mensualidad' and policyname = 'configuracion_mensualidad_insert_admin') then
        create policy "configuracion_mensualidad_insert_admin"
        on public.configuracion_mensualidad for insert
        to authenticated
        with check (gimnasio_id = public.current_gimnasio_id() and public.is_admin());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'configuracion_mensualidad' and policyname = 'configuracion_mensualidad_update_admin') then
        create policy "configuracion_mensualidad_update_admin"
        on public.configuracion_mensualidad for update
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id() and public.is_admin())
        with check (gimnasio_id = public.current_gimnasio_id() and public.is_admin());
    end if;

    -- Tablas POS/inventario complementarias.
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'proveedores' and policyname = 'proveedores_select_por_gimnasio') then
        create policy "proveedores_select_por_gimnasio"
        on public.proveedores for select
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'proveedores' and policyname = 'proveedores_admin_all') then
        create policy "proveedores_admin_all"
        on public.proveedores for all
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id() and public.is_admin())
        with check (gimnasio_id = public.current_gimnasio_id() and public.is_admin());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'compras_proveedores' and policyname = 'compras_proveedores_select_por_gimnasio') then
        create policy "compras_proveedores_select_por_gimnasio"
        on public.compras_proveedores for select
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ventas' and policyname = 'ventas_select_por_gimnasio') then
        create policy "ventas_select_por_gimnasio"
        on public.ventas for select
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'venta_detalles' and policyname = 'venta_detalles_select_por_gimnasio') then
        create policy "venta_detalles_select_por_gimnasio"
        on public.venta_detalles for select
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'movimientos_inventario' and policyname = 'movimientos_inventario_select_por_gimnasio') then
        create policy "movimientos_inventario_select_por_gimnasio"
        on public.movimientos_inventario for select
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id());
    end if;

    -- Facturas: visibles por gimnasio. Insert directo queda permitido para compatibilidad
    -- temporal; la meta de produccion es generarlas via RPC.
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'facturas' and policyname = 'facturas_select_por_gimnasio') then
        create policy "facturas_select_por_gimnasio"
        on public.facturas for select
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'facturas' and policyname = 'facturas_insert_admin_recepcion') then
        create policy "facturas_insert_admin_recepcion"
        on public.facturas for insert
        to authenticated
        with check (
            gimnasio_id = public.current_gimnasio_id()
            and public.current_user_role() in ('administrador', 'recepcion')
        );
    end if;

    -- Notificaciones y contadores: lectura limitada por gimnasio. Escritura debe pasar por RPC/procesos controlados.
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notificaciones' and policyname = 'notificaciones_select_por_gimnasio') then
        create policy "notificaciones_select_por_gimnasio"
        on public.notificaciones for select
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id());
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'contadores_recibos' and policyname = 'contadores_recibos_select_por_gimnasio_admin') then
        create policy "contadores_recibos_select_por_gimnasio_admin"
        on public.contadores_recibos for select
        to authenticated
        using (gimnasio_id = public.current_gimnasio_id() and public.is_admin());
    end if;
end $$;

commit;
