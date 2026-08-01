-- =============================================
-- MÓDULOS NUEVOS: Cuadratura de caja + Control de horas
-- Ejecuta esto en: supabase.com → SQL Editor
-- =============================================

-- ─────────────────────────────────────────────
-- 1) CUADRATURA DE CAJA (sencillo)
-- ─────────────────────────────────────────────
CREATE TABLE cuadraturas_caja (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id        UUID REFERENCES empresas(id) NOT NULL,
  fecha             DATE NOT NULL,
  sencillo_inicial  NUMERIC DEFAULT 0,   -- fondo fijo de cambio con el que parte la caja
  monto_esperado    NUMERIC NOT NULL,    -- lo que debería haber (sencillo + ventas efectivo, ingresado a mano)
  monto_contado     NUMERIC NOT NULL,    -- lo que se contó físicamente
  responsable       TEXT,                -- quién hizo la cuadratura
  observaciones     TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cuadraturas_caja ENABLE ROW LEVEL SECURITY;

-- Igual que el resto del sistema: cualquier usuario autenticado puede
-- leer/escribir (el filtro real por empresa ya lo hace el front-end,
-- igual que en movimientos/documentos). Si tu proyecto usa políticas
-- más estrictas por usuario, reemplaza esta por la misma que uses en
-- "movimientos".
CREATE POLICY "auth_all_cuadraturas_caja" ON cuadraturas_caja
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');


-- ─────────────────────────────────────────────
-- 2) CONTROL DE HORAS — trabajadoras por hora
-- ─────────────────────────────────────────────
CREATE TABLE empleadas_hora (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id  UUID REFERENCES empresas(id) NOT NULL,
  nombre      TEXT NOT NULL,
  valor_hora  NUMERIC NOT NULL,          -- valor fijo por hora trabajada
  pin         TEXT NOT NULL,             -- PIN de 4 dígitos para marcar en el kiosco
  activa      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE empleadas_hora ENABLE ROW LEVEL SECURITY;

-- El panel de administración (autenticado) puede hacer todo
CREATE POLICY "auth_all_empleadas_hora" ON empleadas_hora
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- El kiosco de marcaje (app/asistencia/marcar) NO inicia sesión, así que
-- necesita poder leer la lista de trabajadoras activas para el selector
-- y validar el PIN. Esto expone nombre+pin a quien tenga la anon key,
-- igual de expuesto que el resto de las tablas de este proyecto.
CREATE POLICY "anon_lee_empleadas_activas" ON empleadas_hora
  FOR SELECT USING (activa = true);


-- ─────────────────────────────────────────────
-- 3) CONTROL DE HORAS — registros de entrada/salida
-- ─────────────────────────────────────────────
CREATE TABLE registros_asistencia (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empleada_id       UUID REFERENCES empleadas_hora(id) NOT NULL,
  empresa_id        UUID REFERENCES empresas(id) NOT NULL,
  fecha             DATE NOT NULL,
  hora_entrada      TIMESTAMPTZ NOT NULL,
  hora_salida       TIMESTAMPTZ,
  horas_trabajadas  NUMERIC,             -- se calcula al marcar la salida
  valor_hora        NUMERIC NOT NULL,    -- snapshot del valor hora al momento de marcar
  monto_calculado   NUMERIC,             -- horas_trabajadas * valor_hora, calculado al marcar salida
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE registros_asistencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_registros_asistencia" ON registros_asistencia
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- El kiosco necesita poder crear su propio registro de entrada
CREATE POLICY "anon_marca_entrada" ON registros_asistencia
  FOR INSERT WITH CHECK (true);

-- ...y actualizarlo para marcar su salida
CREATE POLICY "anon_marca_salida" ON registros_asistencia
  FOR UPDATE USING (true) WITH CHECK (true);

-- El kiosco también necesita poder ver si ya hay un turno abierto hoy
CREATE POLICY "anon_lee_registros" ON registros_asistencia
  FOR SELECT USING (true);


-- ─────────────────────────────────────────────
-- 4) CONTROL DE HORAS — cierre mensual (para marcar como pagado)
-- ─────────────────────────────────────────────
CREATE TABLE cierres_horas (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id    UUID REFERENCES empresas(id) NOT NULL,
  empleada_id   UUID REFERENCES empleadas_hora(id) NOT NULL,
  anio          INTEGER NOT NULL,
  mes           INTEGER NOT NULL,        -- 1-12
  total_horas   NUMERIC NOT NULL,
  total_pagar   NUMERIC NOT NULL,
  pagado        BOOLEAN DEFAULT false,
  fecha_pago    DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, empleada_id, anio, mes)
);

ALTER TABLE cierres_horas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_cierres_horas" ON cierres_horas
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');


-- =============================================
-- NOTA IMPORTANTE
-- =============================================
-- Si tu proyecto de Supabase tiene RLS deshabilitado en las tablas
-- existentes (movimientos, documentos, etc.) o usa políticas distintas
-- a "auth.role() = 'authenticated'", ajusta las políticas de arriba
-- para que sean consistentes. Puedes revisar tus políticas actuales en
-- Supabase → Authentication → Policies, o Database → Tables → [tabla] → RLS.
