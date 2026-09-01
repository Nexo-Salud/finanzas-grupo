-- =============================================
-- Agrega permisos de módulo por usuario (independiente del rol)
-- Ejecuta esto en: supabase.com → SQL Editor
-- =============================================

ALTER TABLE usuarios_plataforma
  ADD COLUMN IF NOT EXISTS modulos_permitidos TEXT[] DEFAULT NULL;

-- NULL o arreglo vacío = acceso a todos los módulos (igual que empresas_permitidas)
-- Ejemplo para restringir a solo Asistencia:
--   UPDATE usuarios_plataforma SET modulos_permitidos = ARRAY['/asistencia'] WHERE email = 'correo@ejemplo.cl';
