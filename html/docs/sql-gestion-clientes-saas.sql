-- FitControl Pro - Datos comerciales del gimnasio y propietario
-- No modifica RLS ni concede acceso adicional.

alter table public.gimnasios_clientes
    add column if not exists propietario_nombre_completo text,
    add column if not exists propietario_cedula text,
    add column if not exists propietario_telefono text,
    add column if not exists propietario_whatsapp text,
    add column if not exists propietario_email text,
    add column if not exists propietario_direccion text,
    add column if not exists nombre_comercial_gimnasio text,
    add column if not exists rnc_o_cedula_negocio text,
    add column if not exists telefono_gimnasio text,
    add column if not exists email_gimnasio text,
    add column if not exists direccion_gimnasio text,
    add column if not exists ciudad text,
    add column if not exists provincia text,
    add column if not exists contacto_principal_nombre text,
    add column if not exists contacto_principal_telefono text,
    add column if not exists contacto_principal_email text,
    add column if not exists notas_comerciales text,
    add column if not exists fecha_ultima_actualizacion_contacto timestamptz;

update public.gimnasios_clientes
set nombre_comercial_gimnasio = coalesce(nullif(nombre_comercial_gimnasio, ''), nombre_gimnasio),
    propietario_nombre_completo = coalesce(nullif(propietario_nombre_completo, ''), propietario),
    propietario_telefono = coalesce(nullif(propietario_telefono, ''), telefono),
    propietario_email = coalesce(nullif(propietario_email, ''), email),
    fecha_ultima_actualizacion_contacto = coalesce(fecha_ultima_actualizacion_contacto, updated_at, now())
where nombre_comercial_gimnasio is null
   or propietario_nombre_completo is null
   or propietario_telefono is null
   or propietario_email is null
   or fecha_ultima_actualizacion_contacto is null;

notify pgrst, 'reload schema';
