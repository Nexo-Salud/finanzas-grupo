-- =============================================
-- MÓDULO ALERTAS: conectar a datos reales, dividido por empresa
-- Ejecuta esto en: supabase.com → SQL Editor
-- =============================================

-- ─────────────────────────────────────────────
-- 1) REGLAS DE ALERTA (configuración, aplica a todas las empresas)
-- ─────────────────────────────────────────────
CREATE TABLE reglas_alertas (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre        TEXT NOT NULL,
  descripcion   TEXT,
  tipo_regla    TEXT NOT NULL,   -- 'variacion_gasto' | 'variacion_ingreso' | 'descuadre_caja' | 'facturas_vencidas' | 'facturas_por_vencer'
  umbral        NUMERIC NOT NULL,
  tipo_umbral   TEXT NOT NULL,   -- '%' | '$' | 'dias'
  nivel         TEXT NOT NULL,   -- 'crit' | 'warn' | 'info' | 'ok'
  activa        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reglas_alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_reglas_alertas" ON reglas_alertas
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Reglas iniciales, basadas en datos que el sistema ya tiene (movimientos,
-- cuadraturas de caja y el calendario de pago). No incluye reglas de
-- presupuesto porque el módulo Presupuesto todavía no guarda datos en
-- Supabase (funciona con datos de ejemplo) — se pueden agregar cuando
-- ese módulo también se conecte.
INSERT INTO reglas_alertas (nombre, descripcion, tipo_regla, umbral, tipo_umbral, nivel) VALUES
  ('Aumento de gasto por categoría', 'Avisa cuando una categoría de gasto sube más del umbral vs. el mes anterior', 'variacion_gasto', 25, '%', 'warn'),
  ('Caída de ingresos',              'Avisa cuando los ingresos totales del mes bajan más del umbral vs. el mes anterior', 'variacion_ingreso', 15, '%', 'warn'),
  ('Descuadre de caja',              'Avisa cuando la última cuadratura de caja tiene una diferencia (contado vs esperado) mayor al umbral', 'descuadre_caja', 20000, '$', 'crit'),
  ('Facturas de proveedores vencidas', 'Avisa cuando hay facturas del Calendario de pago vencidas y sin pagar por más del umbral', 'facturas_vencidas', 100000, '$', 'crit'),
  ('Facturas por vencer pronto',     'Avisa de facturas del Calendario de pago que vencen dentro de los próximos días (umbral en días)', 'facturas_por_vencer', 7, 'dias', 'warn');


-- ─────────────────────────────────────────────
-- 2) ALERTAS GENERADAS (por empresa)
-- ─────────────────────────────────────────────
CREATE TABLE alertas (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id    UUID REFERENCES empresas(id) NOT NULL,
  regla_id      UUID REFERENCES reglas_alertas(id),
  nivel         TEXT NOT NULL,   -- 'crit' | 'warn' | 'info' | 'ok'
  titulo        TEXT NOT NULL,
  descripcion   TEXT NOT NULL,
  categoria     TEXT,
  periodo       TEXT,            -- ej. '2026-08' o una fecha, según el tipo de regla
  leida         BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, regla_id, categoria, periodo)
);

ALTER TABLE alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_alertas" ON alertas
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
