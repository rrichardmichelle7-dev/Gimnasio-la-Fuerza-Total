-- Pruebas RLS / multi-gimnasio para FitControl Pro / Kilvio FIT
-- Fecha de preparación: 2026-06-25
--
-- IMPORTANTE:
-- - Ejecutar solo en staging.
-- - No ejecutar en producción.
-- - No reemplazar placeholders con usuarios reales productivos.
-- - Este archivo está diseñado para SELECT/read-only y termina con ROLLBACK.
-- - En Supabase SQL Editor, el rol postgres puede bypass RLS. Para simular RLS
--   se usa SET LOCAL ROLE authenticated y claims JWT por transacción.
--
-- Placeholders:
--   :ADMIN_GYM_A_USER_ID
--   :RECEPCION_GYM_A_USER_ID
--   :ADMIN_GYM_B_USER_ID
--   :SUPER_ADMIN_SAAS_USER_ID
--   :GIMNASIO_A_ID
--   :GIMNASIO_B_ID

begin;

-- ============================================================
-- Helper visual: confirmar que los placeholders fueron cambiados
-- ============================================================
select
  'REEMPLAZA LOS PLACEHOLDERS ANTES DE EJECUTAR EN STAGING' as aviso;

-- ============================================================
-- 1. Administrador Gimnasio A solo ve datos del Gimnasio A
-- ============================================================
set local role authenticated;
set local request.jwt.claim.sub = ':ADMIN_GYM_A_USER_ID';
set local request.jwt.claim.role = 'authenticated';

select 'RLS-ADMIN-A-MIEMBROS-OTRO-GYM' as prueba, count(*) as filas_no_permitidas
from public.miembros
where gimnasio_id = ':GIMNASIO_B_ID';

select 'RLS-ADMIN-A-PAGOS-OTRO-GYM' as prueba, count(*) as filas_no_permitidas
from public.pagos
where gimnasio_id = ':GIMNASIO_B_ID';

select 'RLS-ADMIN-A-VENTAS-OTRO-GYM' as prueba, count(*) as filas_no_permitidas
from public.ventas_pos
where gimnasio_id = ':GIMNASIO_B_ID';

select 'RLS-ADMIN-A-CAJA-OTRO-GYM' as prueba, count(*) as filas_no_permitidas
from public.cajas_turno
where gimnasio_id = ':GIMNASIO_B_ID';

-- Esperado para todas las pruebas anteriores: 0 filas.

-- ============================================================
-- 2. Recepción Gimnasio A solo ve datos del Gimnasio A
-- ============================================================
set local request.jwt.claim.sub = ':RECEPCION_GYM_A_USER_ID';

select 'RLS-RECEPCION-A-MIEMBROS-OTRO-GYM' as prueba, count(*) as filas_no_permitidas
from public.miembros
where gimnasio_id = ':GIMNASIO_B_ID';

select 'RLS-RECEPCION-A-FACTURAS-OTRO-GYM' as prueba, count(*) as filas_no_permitidas
from public.facturas
where gimnasio_id = ':GIMNASIO_B_ID';

select 'RLS-RECEPCION-A-INVENTARIO-OTRO-GYM' as prueba, count(*) as filas_no_permitidas
from public.productos
where gimnasio_id = ':GIMNASIO_B_ID';

-- Esperado: 0 filas.

-- ============================================================
-- 3. super_admin_saas no ve datos privados del gimnasio
-- ============================================================
set local request.jwt.claim.sub = ':SUPER_ADMIN_SAAS_USER_ID';

select 'RLS-SAAS-MIEMBROS-PRIVADOS' as prueba, count(*) as filas_no_permitidas
from public.miembros;

select 'RLS-SAAS-PAGOS-PRIVADOS' as prueba, count(*) as filas_no_permitidas
from public.pagos;

select 'RLS-SAAS-POS-PRIVADO' as prueba, count(*) as filas_no_permitidas
from public.ventas_pos;

select 'RLS-SAAS-CAJA-PRIVADA' as prueba, count(*) as filas_no_permitidas
from public.cajas_turno;

select 'RLS-SAAS-FACTURAS-PRIVADAS' as prueba, count(*) as filas_no_permitidas
from public.facturas;

-- Esperado: 0 filas, salvo que exista soporte autorizado y la política permita
-- un subconjunto explícito de solo lectura para un módulo concreto.

-- ============================================================
-- 4. super_admin_saas solo ve metadatos SaaS esperados
-- ============================================================
select 'RLS-SAAS-CLIENTES-SAAS' as prueba, count(*) as filas_visibles
from public.gimnasios_clientes;

select 'RLS-SAAS-FACTURAS-SAAS' as prueba, count(*) as filas_visibles
from public.facturas_saas;

select 'RLS-SAAS-TICKETS' as prueba, count(*) as filas_visibles
from public.tickets_soporte;

-- Esperado: puede ver metadatos SaaS necesarios para operar Michel Soft.

-- ============================================================
-- 5. Soporte autorizado: validar ventana temporal y módulo
-- ============================================================
select
  'RLS-SOPORTE-ACTIVO-MODULO' as prueba,
  count(*) as accesos_activos
from public.soporte_accesos
where gimnasio_id = ':GIMNASIO_A_ID'
  and estado = 'activo'
  and now() between fecha_inicio and fecha_fin;

select
  'RLS-SOPORTE-VENCIDO-CERRADO' as prueba,
  count(*) as accesos_no_vigentes
from public.soporte_accesos
where gimnasio_id = ':GIMNASIO_A_ID'
  and (
    estado <> 'activo'
    or fecha_fin < now()
  );

-- Esperado:
-- - Un soporte activo permite solo el módulo autorizado.
-- - Soporte vencido/cerrado no permite acceder a datos privados.
-- - Validar en UI/API con pruebas SUPPORT-01, SUPPORT-02 y SUPPORT-03.

rollback;
