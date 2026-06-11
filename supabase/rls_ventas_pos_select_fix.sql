-- Kilvio FIT - Diagnostico y correccion SELECT RLS para Historial Ventas POS.
-- Ejecutar en Supabase SQL Editor si el frontend recibe data vacia pero SQL Editor ve ventas.
-- No borra datos, no toca RPC y no desactiva RLS.

select policyname, cmd, qual
from pg_policies
where schemaname = 'public'
  and tablename in ('ventas', 'venta_detalles')
order by tablename, policyname;

drop policy if exists "ventas_select_gimnasio" on public.ventas;
drop policy if exists "venta_detalles_select_gimnasio" on public.venta_detalles;

create policy "ventas_select_gimnasio"
on public.ventas
for select
to authenticated
using (
  exists (
    select 1
    from public.perfiles p
    where p.user_id = auth.uid()
      and lower(coalesce(p.estado, '')) = 'activo'
      and p.gimnasio_id = ventas.gimnasio_id
  )
);

create policy "venta_detalles_select_gimnasio"
on public.venta_detalles
for select
to authenticated
using (
  exists (
    select 1
    from public.perfiles p
    where p.user_id = auth.uid()
      and lower(coalesce(p.estado, '')) = 'activo'
      and p.gimnasio_id = venta_detalles.gimnasio_id
  )
);

notify pgrst, 'reload schema';
