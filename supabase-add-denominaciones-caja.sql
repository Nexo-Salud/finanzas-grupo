-- =============================================
-- Agrega el desglose de sencillo por denominación a cuadraturas_caja
-- Ejecuta esto en: supabase.com → SQL Editor
-- (Solo si ya ejecutaste antes supabase-schema-caja-asistencia.sql)
-- =============================================

ALTER TABLE cuadraturas_caja
  ADD COLUMN IF NOT EXISTS d20000 INTEGER DEFAULT 0,  -- cantidad de billetes de $20.000
  ADD COLUMN IF NOT EXISTS d10000 INTEGER DEFAULT 0,  -- cantidad de billetes de $10.000
  ADD COLUMN IF NOT EXISTS d5000  INTEGER DEFAULT 0,  -- cantidad de billetes de $5.000
  ADD COLUMN IF NOT EXISTS d2000  INTEGER DEFAULT 0,  -- cantidad de billetes de $2.000
  ADD COLUMN IF NOT EXISTS d1000  INTEGER DEFAULT 0,  -- cantidad de billetes de $1.000
  ADD COLUMN IF NOT EXISTS d500   INTEGER DEFAULT 0,  -- cantidad de monedas de $500
  ADD COLUMN IF NOT EXISTS d100   INTEGER DEFAULT 0,  -- cantidad de monedas de $100
  ADD COLUMN IF NOT EXISTS d50    INTEGER DEFAULT 0,  -- cantidad de monedas de $50
  ADD COLUMN IF NOT EXISTS d10    INTEGER DEFAULT 0;  -- cantidad de monedas de $10
