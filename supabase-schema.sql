-- =============================================
-- PLATAFORMA FINANCIERA — Schema Supabase
-- Ejecuta esto en: supabase.com → SQL Editor
-- =============================================

-- Empresas del grupo
CREATE TABLE empresas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  nombre_corto TEXT NOT NULL,
  rut TEXT,
  rubro TEXT,
  moneda TEXT DEFAULT 'CLP',
  color TEXT DEFAULT '#3266ad',
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usuarios y roles
CREATE TABLE perfiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'lectura', -- admin | contador | gerente | lectura
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Acceso de usuarios a empresas
CREATE TABLE usuario_empresa (
  usuario_id UUID REFERENCES perfiles(id),
  empresa_id UUID REFERENCES empresas(id),
  PRIMARY KEY (usuario_id, empresa_id)
);

-- Plan de cuentas
CREATE TABLE categorias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES empresas(id),
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL, -- ingreso | gasto
  codigo TEXT,
  color TEXT DEFAULT '#888780',
  parent_id UUID REFERENCES categorias(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Movimientos financieros
CREATE TABLE movimientos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES empresas(id) NOT NULL,
  categoria_id UUID REFERENCES categorias(id),
  tipo TEXT NOT NULL,        -- ingreso | gasto
  descripcion TEXT NOT NULL,
  monto NUMERIC NOT NULL,
  fecha DATE NOT NULL,
  referencia TEXT,
  conciliado BOOLEAN DEFAULT false,
  cuenta_bancaria_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Presupuestos anuales
CREATE TABLE presupuestos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES empresas(id) NOT NULL,
  categoria_id UUID REFERENCES categorias(id) NOT NULL,
  anio INTEGER NOT NULL,
  meta_anual NUMERIC NOT NULL,
  distribucion JSONB, -- [8.33, 8.33, ...] porcentajes mensuales
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, categoria_id, anio)
);

-- Cuentas bancarias
CREATE TABLE cuentas_bancarias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES empresas(id) NOT NULL,
  banco TEXT NOT NULL,
  tipo TEXT NOT NULL,
  numero TEXT,
  moneda TEXT DEFAULT 'CLP',
  saldo NUMERIC DEFAULT 0,
  saldo_banco NUMERIC DEFAULT 0,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documentos tributarios
CREATE TABLE documentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES empresas(id) NOT NULL,
  tipo TEXT NOT NULL,        -- FE | FR | BE | RET
  folio TEXT NOT NULL,
  contraparte TEXT,
  rut_contraparte TEXT,
  fecha DATE NOT NULL,
  neto NUMERIC DEFAULT 0,
  iva NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL,
  estado TEXT DEFAULT 'pendiente', -- pagada | pendiente | vencida
  vence DATE,
  sistema_origen TEXT,       -- bsale | manual | api
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alertas
CREATE TABLE alertas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES empresas(id),
  nivel TEXT NOT NULL,       -- crit | warn | info | ok
  titulo TEXT NOT NULL,
  descripcion TEXT,
  categoria TEXT,
  leida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================
ALTER TABLE empresas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuestos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas           ENABLE ROW LEVEL SECURITY;

-- Política: usuario solo ve empresas a las que tiene acceso
CREATE POLICY "usuario_ve_sus_empresas" ON empresas
  FOR SELECT USING (
    id IN (
      SELECT empresa_id FROM usuario_empresa
      WHERE usuario_id = auth.uid()
    )
  );

-- Política: movimientos solo de empresas del usuario
CREATE POLICY "movimientos_por_empresa" ON movimientos
  FOR ALL USING (
    empresa_id IN (
      SELECT empresa_id FROM usuario_empresa
      WHERE usuario_id = auth.uid()
    )
  );

-- =============================================
-- DATOS DE EJEMPLO (opcional)
-- =============================================
INSERT INTO empresas (nombre, nombre_corto, rut, rubro, color) VALUES
  ('Inversiones ABC Ltda.', 'Empresa A', '76.100.001-1', 'Comercio y retail', '#3266ad'),
  ('Servicios Beta SpA',    'Empresa B', '76.100.002-2', 'Servicios profesionales', '#1D9E75'),
  ('Inmobiliaria Gamma',    'Empresa C', '76.100.003-3', 'Inmobiliario y arriendos', '#BA7517');
