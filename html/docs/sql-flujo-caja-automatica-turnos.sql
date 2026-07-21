-- Flujo de caja automático por turnos para Kilvio FIT
-- Ejecutar en Supabase SQL Editor como complemento del schema existente de caja.
-- No modifica Auth, no expone service_role y no cambia políticas RLS existentes.
--
-- IMPORTANTE:
-- - Las migraciones de supabase/migrations/ son la fuente canónica.
-- - Los SQL dentro de html/docs/ son documentación o referencia.
-- - No ejecutar SQL antiguos si contradicen las migraciones normalizadas.

begin;

alter table public.cajas_turno
    add column if not exists turno text,
    add column if not exists hora_cuadre time,
    add column if not exists fecha_cuadre date,
    add column if not exists total_transferencia numeric(12,2) default 0,
    add column if not exists cuadrado_por uuid references auth.users(id),
    add column if not exists reabierta_por uuid references auth.users(id),
    add column if not exists motivo_reapertura text,
    add column if not exists reabierta_at timestamptz,
    add column if not exists updated_at timestamptz default now();

do $$
begin
    if exists (
        select 1
        from pg_constraint
        where conrelid = 'public.cajas_turno'::regclass
          and conname = 'cajas_turno_estado_check'
    ) then
        alter table public.cajas_turno drop constraint cajas_turno_estado_check;
    end if;

    alter table public.cajas_turno
        add constraint cajas_turno_estado_check
        check (estado in ('abierta', 'cerrada', 'finalizada'));
end $$;

create unique index if not exists cajas_turno_usuario_fecha_turno_unq
on public.cajas_turno (gimnasio_id, usuario_id, fecha, turno);

create or replace function public.kilvio_turno_actual(p_momento timestamptz default now())
returns table(turno text, fecha date, hora_inicio time, hora_fin time)
language sql
stable
set search_path = public
as $$
    select
        case
            when (p_momento at time zone 'America/Santo_Domingo')::time >= time '14:00'
            then 'B'
            else 'A'
        end as turno,
        (p_momento at time zone 'America/Santo_Domingo')::date as fecha,
        case
            when (p_momento at time zone 'America/Santo_Domingo')::time >= time '14:00'
            then time '14:00'
            else time '06:00'
        end as hora_inicio,
        case
            when (p_momento at time zone 'America/Santo_Domingo')::time >= time '14:00'
            then time '22:00'
            else time '14:00'
        end as hora_fin;
$$;

create or replace function public.activar_caja_turno_automatica()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_profile record;
    v_turno record;
    v_caja public.cajas_turno%rowtype;
    v_ahora_local timestamp := now() at time zone 'America/Santo_Domingo';
begin
    if auth.uid() is null then
        raise exception 'No autenticado';
    end if;

    select * into v_profile from public.kilvio_current_user_profile();

    if v_profile.rol not in ('administrador', 'recepcion') then
        raise exception 'Rol no autorizado para caja';
    end if;

    select * into v_turno from public.kilvio_turno_actual(now()) limit 1;

    -- Cierra operativamente turnos vencidos del mismo usuario/gimnasio, pero quedan pendientes si no tienen monto contado.
    update public.cajas_turno
       set estado = 'finalizada',
           hora_cierre = coalesce(hora_cierre, v_ahora_local::time),
           updated_at = now(),
           observaciones = trim(both ' | ' from concat_ws(' | ', nullif(observaciones, ''), 'Finalizada automáticamente por fin de turno.'))
     where gimnasio_id = v_profile.gimnasio_id
       and usuario_id = auth.uid()
       and estado = 'abierta'
       and (
           fecha <> v_turno.fecha
        or coalesce(turno, '') <> v_turno.turno
        or v_ahora_local::time >= v_turno.hora_fin
       );

    select * into v_caja
      from public.cajas_turno
     where gimnasio_id = v_profile.gimnasio_id
       and usuario_id = auth.uid()
       and fecha = v_turno.fecha
       and turno = v_turno.turno
     order by id desc
     limit 1;

    if v_caja.id is null then
        insert into public.cajas_turno (
            gimnasio_id, usuario_id, usuario_nombre, fecha, turno, hora_apertura,
            monto_inicial, estado, observaciones
        ) values (
            v_profile.gimnasio_id, auth.uid(), coalesce(v_profile.nombre, (auth.jwt() ->> 'email')),
            v_turno.fecha, v_turno.turno, v_turno.hora_inicio, 0, 'abierta',
            'Caja creada automáticamente al iniciar sesión.'
        ) returning * into v_caja;
    elsif v_caja.estado <> 'abierta' and v_caja.monto_entregado is not null then
        update public.cajas_turno
           set estado = 'abierta',
               hora_apertura = coalesce(hora_apertura, v_turno.hora_inicio),
               updated_at = now()
         where id = v_caja.id
         returning * into v_caja;
    end if;

    return jsonb_build_object('ok', true, 'caja_id', v_caja.id, 'turno', v_turno.turno, 'fecha', v_turno.fecha);
end;
$$;

create or replace function public.guardar_cuadre_caja_turno(
    p_caja_id bigint,
    p_monto_contado numeric,
    p_observaciones text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_profile record;
    v_caja public.cajas_turno%rowtype;
    v_efectivo numeric(12,2) := 0;
    v_tarjeta numeric(12,2) := 0;
    v_transferencia numeric(12,2) := 0;
    v_total numeric(12,2) := 0;
    v_esperado numeric(12,2) := 0;
    v_diferencia numeric(12,2) := 0;
    v_ahora_local timestamp := now() at time zone 'America/Santo_Domingo';
begin
    if auth.uid() is null then
        raise exception 'No autenticado';
    end if;

    if p_monto_contado is null or p_monto_contado < 0 then
        raise exception 'Monto contado inválido';
    end if;

    select * into v_profile from public.kilvio_current_user_profile();

    select * into v_caja
      from public.cajas_turno
     where id = p_caja_id
       and gimnasio_id = v_profile.gimnasio_id
       and (usuario_id = auth.uid() or v_profile.rol = 'administrador')
     for update;

    if v_caja.id is null then
        raise exception 'Caja no encontrada o no autorizada';
    end if;

    select coalesce(sum(case when lower(metodo_pago) = 'efectivo' then monto else 0 end), 0),
           coalesce(sum(case when lower(metodo_pago) = 'tarjeta' then monto else 0 end), 0),
           coalesce(sum(case when lower(metodo_pago) = 'transferencia' then monto else 0 end), 0)
      into v_efectivo, v_tarjeta, v_transferencia
      from public.pagos
     where caja_turno_id = p_caja_id
       and lower(estado) = 'pagado';

    select v_efectivo + coalesce(sum(case when lower(metodo_pago) = 'efectivo' then total else 0 end), 0),
           v_tarjeta + coalesce(sum(case when lower(metodo_pago) = 'tarjeta' then total else 0 end), 0),
           v_transferencia + coalesce(sum(case when lower(metodo_pago) = 'transferencia' then total else 0 end), 0)
      into v_efectivo, v_tarjeta, v_transferencia
      from public.ventas
     where caja_turno_id = p_caja_id
       and lower(coalesce(estado, 'confirmada')) <> 'anulada';

    select v_efectivo + coalesce(sum(total), 0)
      into v_efectivo
      from public.ingresos_diarios
     where caja_turno_id = p_caja_id;

    v_total := v_efectivo + v_tarjeta + v_transferencia;
    v_esperado := coalesce(v_caja.monto_inicial, 0) + v_efectivo;
    v_diferencia := p_monto_contado - v_esperado;

    update public.cajas_turno
       set estado = 'finalizada',
           hora_cierre = coalesce(hora_cierre, v_ahora_local::time),
           hora_cuadre = v_ahora_local::time,
           fecha_cuadre = v_ahora_local::date,
           total_efectivo = v_efectivo,
           total_tarjeta = v_tarjeta,
           total_transferencia = v_transferencia,
           total_generado = v_total,
           monto_entregado = p_monto_contado,
           diferencia = v_diferencia,
           observaciones = nullif(trim(coalesce(p_observaciones, '')), ''),
           cuadrado_por = auth.uid(),
           updated_at = now()
     where id = p_caja_id;

    insert into public.auditoria_eventos (gimnasio_id, usuario_id, usuario_email, modulo, accion, datos_modificados)
    values (
        v_profile.gimnasio_id, auth.uid(), (auth.jwt() ->> 'email'), 'caja', 'guardar_cuadre',
        jsonb_build_object('caja_id', p_caja_id, 'turno', v_caja.turno, 'fecha', v_caja.fecha, 'monto_contado', p_monto_contado, 'esperado_efectivo', v_esperado, 'diferencia', v_diferencia)
    );

    return jsonb_build_object('ok', true, 'caja_id', p_caja_id, 'esperado_efectivo', v_esperado, 'diferencia', v_diferencia);
end;
$$;

create or replace function public.reabrir_cuadre_caja_turno(
    p_caja_id bigint,
    p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_profile record;
    v_caja public.cajas_turno%rowtype;
begin
    if auth.uid() is null then
        raise exception 'No autenticado';
    end if;

    if nullif(trim(coalesce(p_motivo, '')), '') is null then
        raise exception 'Debes indicar el motivo de reapertura';
    end if;

    select * into v_profile from public.kilvio_current_user_profile();

    if v_profile.rol <> 'administrador' then
        raise exception 'Solo administrador puede reabrir cuadres';
    end if;

    select * into v_caja
      from public.cajas_turno
     where id = p_caja_id
       and gimnasio_id = v_profile.gimnasio_id
     for update;

    if v_caja.id is null then
        raise exception 'Caja no encontrada';
    end if;

    update public.cajas_turno
       set estado = 'abierta',
           reabierta_por = auth.uid(),
           motivo_reapertura = trim(p_motivo),
           reabierta_at = now(),
           updated_at = now()
     where id = p_caja_id;

    insert into public.auditoria_eventos (gimnasio_id, usuario_id, usuario_email, modulo, accion, datos_modificados)
    values (
        v_profile.gimnasio_id, auth.uid(), (auth.jwt() ->> 'email'), 'caja', 'reabrir_cuadre',
        jsonb_build_object('caja_id', p_caja_id, 'motivo', trim(p_motivo))
    );

    return jsonb_build_object('ok', true, 'caja_id', p_caja_id);
end;
$$;

revoke all on function public.activar_caja_turno_automatica() from public, anon;
revoke all on function public.guardar_cuadre_caja_turno(bigint, numeric, text) from public, anon;
revoke all on function public.reabrir_cuadre_caja_turno(bigint, text) from public, anon;

grant execute on function public.activar_caja_turno_automatica() to authenticated;
grant execute on function public.guardar_cuadre_caja_turno(bigint, numeric, text) to authenticated;
grant execute on function public.reabrir_cuadre_caja_turno(bigint, text) to authenticated;

commit;
