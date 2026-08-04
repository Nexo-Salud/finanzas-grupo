-- =============================================
-- Agrega minutos de colación (no pagados) a registros_asistencia
-- Ejecuta esto en: supabase.com → SQL Editor
-- (Solo si ya ejecutaste antes supabase-schema-caja-asistencia.sql)
-- =============================================

ALTER TABLE registros_asistencia
  ADD COLUMN IF NOT EXISTS colacion_minutos INTEGER DEFAULT 0;
