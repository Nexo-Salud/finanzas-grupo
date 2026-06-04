import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

// ── Tipos principales ──────────────────────────────────────────

export type Empresa = {
  id: string
  nombre: string
  nombre_corto: string
  rut: string
  rubro: string
  moneda: string
  color: string
  activa: boolean
}

export type Movimiento = {
  id: string
  empresa_id: string
  categoria_id?: string
  tipo: 'ingreso' | 'gasto'
  descripcion: string
  monto: number
  fecha: string
  referencia?: string
  conciliado: boolean
}

export type Categoria = {
  id: string
  empresa_id: string
  nombre: string
  tipo: 'ingreso' | 'gasto'
  codigo?: string
  color: string
  parent_id?: string
}

export type Presupuesto = {
  id: string
  empresa_id: string
  categoria_id: string
  anio: number
  meta_anual: number
  distribucion: number[]
}

export type CuentaBancaria = {
  id: string
  empresa_id: string
  banco: string
  tipo: string
  numero: string
  moneda: string
  saldo: number
  saldo_banco: number
  activa: boolean
}

export type Documento = {
  id: string
  empresa_id: string
  tipo: 'FE' | 'FR' | 'BE' | 'RET'
  folio: string
  contraparte: string
  rut_contraparte?: string
  fecha: string
  neto: number
  iva: number
  total: number
  estado: 'pagada' | 'pendiente' | 'vencida'
  vence?: string
}

// ── Helpers de consulta ───────────────────────────────────────

export async function getEmpresas() {
  const { data, error } = await supabase
    .from('empresas')
    .select('*')
    .eq('activa', true)
    .order('nombre_corto')
  if (error) throw error
  return data as Empresa[]
}

export async function getMovimientos(empresaId: string, limite = 100) {
  const { data, error } = await supabase
    .from('movimientos')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('fecha', { ascending: false })
    .limit(limite)
  if (error) throw error
  return data as Movimiento[]
}

export async function getCategorias(empresaId: string) {
  const { data, error } = await supabase
    .from('categorias')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('tipo').order('nombre')
  if (error) throw error
  return data as Categoria[]
}

export async function getPresupuestos(empresaId: string, anio: number) {
  const { data, error } = await supabase
    .from('presupuestos')
    .select('*, categorias(nombre, tipo, color)')
    .eq('empresa_id', empresaId)
    .eq('anio', anio)
  if (error) throw error
  return data
}

export async function getCuentasBancarias(empresaId: string) {
  const { data, error } = await supabase
    .from('cuentas_bancarias')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('banco')
  if (error) throw error
  return data as CuentaBancaria[]
}

export async function getDocumentos(empresaId: string, mes?: string) {
  let query = supabase
    .from('documentos')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('fecha', { ascending: false })

  if (mes) query = query.gte('fecha', `${mes}-01`).lte('fecha', `${mes}-31`)
  const { data, error } = await query
  if (error) throw error
  return data as Documento[]
}

export async function insertMovimiento(mov: Omit<Movimiento, 'id'>) {
  const { data, error } = await supabase.from('movimientos').insert(mov).select()
  if (error) throw error
  return data[0] as Movimiento
}

export async function updateMovimiento(id: string, updates: Partial<Movimiento>) {
  const { error } = await supabase.from('movimientos').update(updates).eq('id', id)
  if (error) throw error
}
