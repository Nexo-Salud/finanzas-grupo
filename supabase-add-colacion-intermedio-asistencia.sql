-- =============================================
-- Agrega los punteos intermedios de colación a registros_asistencia
-- Ejecuta esto en: supabase.com → SQL Editor
-- (Solo si ya ejecutaste antes supabase-schema-caja-asistencia.sql
--  y supabase-add-colacion-asistencia.sql)
-- =============================================
-- Ahora la jornada tiene 4 punteos: Entrada, Salida a colación,
-- Entrada de la tarde (regreso de colación) y Salida final.
-- colacion_minutos se sigue guardando, pero ahora se calcula
-- automáticamente a partir de estos dos horarios cuando existen.

ALTER TABLE registros_asistencia
  ADD COLUMN IF NOT EXISTS hora_salida_colacion TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hora_entrada_tarde   TIMESTAMPTZ;
