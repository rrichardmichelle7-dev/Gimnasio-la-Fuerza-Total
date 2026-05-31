-- Kilvio FIT - Supabase Storage Setup
-- Ejecutar desde Supabase SQL Editor DESPUÉS de crear el proyecto

-- ========================================
-- 1. Crear bucket para imágenes de productos
-- ========================================
-- Nota: Los buckets en Supabase se crean generalmente desde la UI,
-- pero este script documenta la configuración necesaria.
-- 
-- PASOS en la UI de Supabase:
-- 1. Ve a Storage > Buckets
-- 2. Click en "New Bucket"
-- 3. Nombre: "productos"
-- 4. Public (marcar) - para acceso público a las imágenes
-- 5. Click "Create Bucket"

-- ========================================
-- 2. Configurar políticas RLS para Storage (opcional)
-- ========================================
-- Si deseas restringir acceso, descomenta y ajusta:

-- CREATE POLICY "Permitir lectura pública de imágenes de productos"
-- ON storage.objects FOR SELECT
-- USING (bucket_id = 'productos');

-- CREATE POLICY "Permitir upload de imágenes a usuarios autenticados"
-- ON storage.objects FOR INSERT
-- WITH CHECK (
--     bucket_id = 'productos'
--     AND auth.role() = 'authenticated'
-- );

-- CREATE POLICY "Permitir actualizar imágenes propias"
-- ON storage.objects FOR UPDATE
-- USING (bucket_id = 'productos')
-- WITH CHECK (bucket_id = 'productos');

-- CREATE POLICY "Permitir eliminar imágenes propias"
-- ON storage.objects FOR DELETE
-- USING (bucket_id = 'productos');

-- ========================================
-- 3. Verificar que la tabla productos tenga imagen_url
-- ========================================

-- ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS imagen_url text;

-- Comentario: El campo imagen_url ya existe en el schema.sql
-- pero este script lo documenta para referencia.
