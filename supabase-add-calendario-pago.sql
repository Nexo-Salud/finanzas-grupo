-- =============================================
-- MÓDULO NUEVO: Calendario de pago (cuentas por pagar / proveedores)
-- Ejecuta esto en: supabase.com → SQL Editor
-- =============================================

CREATE TABLE pagos_proveedores (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id            UUID REFERENCES empresas(id) NOT NULL,
  proveedor             TEXT NOT NULL,
  documento             TEXT,               -- tipo de documento (ej. "FACTURA COMPRA ELECTRONICA (33)")
  numero                TEXT,               -- número/folio del documento
  fecha_emision         DATE,
  fecha_vencimiento     DATE NOT NULL,
  monto_total           NUMERIC NOT NULL,
  monto_pagado          NUMERIC DEFAULT 0,
  saldo                 NUMERIC NOT NULL,   -- monto_total - monto_pagado (lo que falta pagar)
  centro_costo          TEXT,
  origen_archivo        TEXT,               -- nombre del archivo importado, para trazabilidad
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, proveedor, numero, fecha_vencimiento, monto_total)
);

ALTER TABLE pagos_proveedores ENABLE ROW LEVEL SECURITY;

-- Igual que el resto del sistema: cualquier usuario autenticado puede
-- leer/escribir (el filtro real por empresa lo hace el front-end,
-- igual que en movimientos/documentos).
CREATE POLICY "auth_all_pagos_proveedores" ON pagos_proveedores
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
