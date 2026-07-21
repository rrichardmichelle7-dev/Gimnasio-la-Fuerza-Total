-- FitControl Pro - Flujo de soporte autorizado y temporal
-- Ejecutar después de sql-fitcontrol-pro-saas.sql y sql-fitcontrol-pro-saas-fase2.sql.
-- Este script modifica RLS de tickets/soporte y reemplaza las políticas operativas amplias
-- por políticas de solo lectura limitadas al módulo autorizado y a una ventana vigente.

alter table public.tickets_soporte
    drop constraint if exists tickets_soporte_categoria_check,
    drop constraint if exists tickets_soporte_prioridad_check;

alter table public.tickets_soporte
    add constraint tickets_soporte_categoria_check
        check (categoria in (
            'general', 'billing', 'tecnico', 'capacitacion',
            'dashboard', 'miembros', 'asistencia', 'pagos', 'pos',
            'inventario', 'caja', 'facturas', 'usuarios', 'otro'
        )),
    add constraint tickets_soporte_prioridad_check
        check (prioridad in ('baja', 'media', 'alta', 'critica', 'urgente'));

alter table public.soporte_accesos
    add column if not exists ticket_id uuid;

alter table public.soporte_accesos
    drop constraint if exists soporte_accesos_estado_check;

alter table public.soporte_accesos
    add constraint soporte_accesos_estado_check
        check (estado in ('pendiente', 'activo', 'vencido', 'cerrado', 'revocado'));

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'soporte_accesos_ticket_id_fkey'
          and conrelid = 'public.soporte_accesos'::regclass
    ) then
        alter table public.soporte_accesos
            add constraint soporte_accesos_ticket_id_fkey
            foreign key (ticket_id) references public.tickets_soporte (id) on delete cascade;
    end if;
end $$;

create index if not exists idx_soporte_accesos_ticket
    on public.soporte_accesos (ticket_id, estado, fecha_inicio, fecha_fin);

alter table public.tickets_soporte enable row level security;
alter table public.soporte_accesos enable row level security;

-- El administrador del gimnasio solo puede leer/crear tickets propios.
drop policy if exists "Gimnasio gestiona sus tickets soporte" on public.tickets_soporte;
drop policy if exists "Admin gimnasio lee tickets propios" on public.tickets_soporte;
create policy "Admin gimnasio lee tickets propios"
on public.tickets_soporte
for select
to authenticated
using (
    gimnasio_id = app_private.current_gimnasio_id()
    and app_private.current_role() = 'administrador'
);

drop policy if exists "Admin gimnasio crea tickets propios" on public.tickets_soporte;
create policy "Admin gimnasio crea tickets propios"
on public.tickets_soporte
for insert
to authenticated
with check (
    gimnasio_id = app_private.current_gimnasio_id()
    and creado_por = (select auth.uid())
    and app_private.current_role() = 'administrador'
);

-- Permite deshacer un ticket recién creado si falla la creación de su autorización.
drop policy if exists "Admin gimnasio elimina ticket abierto propio" on public.tickets_soporte;
create policy "Admin gimnasio elimina ticket abierto propio"
on public.tickets_soporte
for delete
to authenticated
using (
    gimnasio_id = app_private.current_gimnasio_id()
    and creado_por = (select auth.uid())
    and estado = 'abierto'
    and app_private.current_role() = 'administrador'
);

-- El administrador solo consulta y crea ventanas para su gimnasio y su propia sesión.
drop policy if exists "Admin gimnasio gestiona soporte propio" on public.soporte_accesos;
drop policy if exists "Admin gimnasio lee soporte propio" on public.soporte_accesos;
create policy "Admin gimnasio lee soporte propio"
on public.soporte_accesos
for select
to authenticated
using (
    gimnasio_id = app_private.current_gimnasio_id()
    and app_private.current_role() = 'administrador'
);

drop policy if exists "Admin gimnasio autoriza soporte propio" on public.soporte_accesos;
create policy "Admin gimnasio autoriza soporte propio"
on public.soporte_accesos
for insert
to authenticated
with check (
    gimnasio_id = app_private.current_gimnasio_id()
    and autorizado_por = (select auth.uid())
    and app_private.current_role() = 'administrador'
    and ticket_id is not null
    and fecha_fin > fecha_inicio
);

-- Michel Soft conserva lectura comercial y puede actualizar únicamente desde su rol SaaS.
drop policy if exists "Michel Soft actualiza soporte autorizado" on public.soporte_accesos;
create policy "Michel Soft actualiza soporte autorizado"
on public.soporte_accesos
for update
to authenticated
using (app_private.is_super_admin_saas())
with check (app_private.is_super_admin_saas());

create or replace function app_private.soporte_activo_para_modulo(
    p_gimnasio_id uuid,
    p_modulos text[]
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
    select exists (
        select 1
        from public.soporte_accesos sa
        join public.tickets_soporte ts on ts.id = sa.ticket_id
        where sa.gimnasio_id = p_gimnasio_id
          and ts.gimnasio_id = p_gimnasio_id
          and sa.estado in ('activo', 'pendiente')
          and now() between sa.fecha_inicio and sa.fecha_fin
          and ts.estado not in ('resuelto', 'cerrado')
          and ts.categoria = any (p_modulos)
    )
$$;

revoke all on function app_private.soporte_activo_para_modulo(uuid, text[]) from public;
grant execute on function app_private.soporte_activo_para_modulo(uuid, text[]) to authenticated;

-- Sustituye el acceso operativo amplio por alcance explícito por módulo.
do $$
declare
    regla record;
begin
    for regla in
        select * from (values
            ('miembros', array['miembros']::text[]),
            ('asistencias', array['asistencia']::text[]),
            ('pagos', array['pagos']::text[]),
            ('productos', array['inventario', 'pos']::text[]),
            ('ventas', array['pos']::text[]),
            ('venta_detalles', array['pos']::text[]),
            ('facturas', array['facturas']::text[]),
            ('cajas_turno', array['caja']::text[]),
            ('ingresos_diarios', array['caja']::text[])
        ) as alcance(tabla, modulos)
    loop
        if exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = regla.tabla
              and column_name = 'gimnasio_id'
        ) then
            execute format(
                'drop policy if exists %I on public.%I',
                'Michel Soft soporte temporal ' || regla.tabla,
                regla.tabla
            );
            execute format(
                'create policy %I on public.%I for select to authenticated using (app_private.is_super_admin_saas() and app_private.soporte_activo_para_modulo(gimnasio_id::uuid, %L::text[]))',
                'Michel Soft soporte temporal ' || regla.tabla,
                regla.tabla,
                regla.modulos
            );
        end if;
    end loop;
end $$;

-- Impide que soporte amplíe el alcance autorizado o cambie el módulo elegido por el cliente.
create or replace function app_private.proteger_alcance_ticket_soporte()
returns trigger
language plpgsql
security invoker
set search_path = public, auth
as $$
begin
    if new.gimnasio_id is distinct from old.gimnasio_id
       or new.creado_por is distinct from old.creado_por
       or new.categoria is distinct from old.categoria
       or new.titulo is distinct from old.titulo
       or new.descripcion is distinct from old.descripcion
       or new.prioridad is distinct from old.prioridad then
        raise exception 'No se puede modificar el alcance autorizado por el gimnasio';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_proteger_alcance_ticket_soporte on public.tickets_soporte;
create trigger trg_proteger_alcance_ticket_soporte
before update on public.tickets_soporte
for each row execute function app_private.proteger_alcance_ticket_soporte();

create or replace function app_private.proteger_ventana_soporte()
returns trigger
language plpgsql
security invoker
set search_path = public, auth
as $$
begin
    if new.gimnasio_id is distinct from old.gimnasio_id
       or new.autorizado_por is distinct from old.autorizado_por
       or new.ticket_id is distinct from old.ticket_id
       or new.fecha_inicio is distinct from old.fecha_inicio
       or new.motivo is distinct from old.motivo
       or new.fecha_fin > old.fecha_fin then
        raise exception 'No se puede ampliar ni cambiar la autorización del gimnasio';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_proteger_ventana_soporte on public.soporte_accesos;
create trigger trg_proteger_ventana_soporte
before update on public.soporte_accesos
for each row execute function app_private.proteger_ventana_soporte();

revoke all on function app_private.proteger_alcance_ticket_soporte() from public;
revoke all on function app_private.proteger_ventana_soporte() from public;
-- Privilegios Data API mínimos; RLS decide qué filas puede usar cada sesión.
grant select, insert, delete, update on public.tickets_soporte to authenticated;
grant select, insert, update on public.soporte_accesos to authenticated;

notify pgrst, 'reload schema';
