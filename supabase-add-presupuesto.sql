-- =============================================
-- MÓDULO PRESUPUESTO: conectar a datos reales, por empresa
-- Ejecuta esto en: supabase.com → SQL Editor
-- =============================================

CREATE TABLE presupuesto_categorias (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id    UUID REFERENCES empresas(id) NOT NULL,
  anio          INTEGER NOT NULL,
  nombre        TEXT NOT NULL,       -- debe coincidir con la categoría usada en Movimientos para que el ejecutado se calcule solo
  tipo          TEXT NOT NULL,       -- 'ingreso' | 'gasto'
  color         TEXT DEFAULT '#B8912E',
  meta_anual    NUMERIC NOT NULL DEFAULT 0,
  dist          JSONB NOT NULL DEFAULT '[8.33,8.33,8.33,8.33,8.33,8.33,8.33,8.33,8.33,8.33,8.33,8.37]',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, anio, nombre)
);

ALTER TABLE presupuesto_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_presupuesto_categorias" ON presupuesto_categorias
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
