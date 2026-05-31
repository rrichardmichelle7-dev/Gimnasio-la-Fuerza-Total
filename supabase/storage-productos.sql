-- Kilvio FIT - Supabase Storage para imagenes de productos.
-- Ejecutar en Supabase SQL Editor con permisos de administrador.
-- TODO SECURITY: ajustar las politicas por gimnasio_id/carpeta cuando perfiles.gimnasio_id este activo en RLS.

insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'productos',
    'productos',
    true,
    5242880,
    array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "productos_select_public" on storage.objects;
create policy "productos_select_public"
on storage.objects
for select
using (bucket_id = 'productos');

drop policy if exists "productos_insert_authenticated" on storage.objects;
create policy "productos_insert_authenticated"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'productos');

drop policy if exists "productos_update_authenticated" on storage.objects;
create policy "productos_update_authenticated"
on storage.objects
for update
to authenticated
using (bucket_id = 'productos')
with check (bucket_id = 'productos');

drop policy if exists "productos_delete_authenticated" on storage.objects;
create policy "productos_delete_authenticated"
on storage.objects
for delete
to authenticated
using (bucket_id = 'productos');
