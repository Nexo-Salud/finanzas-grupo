'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

type Movimiento = {
  id: string
  empresa_id: string
  tipo: 'ingreso' | 'gasto'
  descripcion: string
  categoria: string
  monto: number
  fecha: string
  referencia: string
  conciliado: boolean
  created_at?: string
}
type Empresa = { id: string; nombre_corto: string; color: string }

const CATEGORIAS_INGRESO = ['Ventas','Servicios','Arriendos cobrados','Otros ingresos']
const CATEGORIAS_GASTO   = ['Remuneraciones','Proveedores','Arriendos pagados','Servicios básicos','Marketing','Gastos generales']

const NAV = [
  { href:'/',             label:'Dashboard',    icon:'▦'  },
  { href:'/movimientos',  label:'Movimientos',  icon:'↕', active:true },
  { href:'/presupuesto',  label:'Presupuesto',  icon:'🎯' },
  { href:'/alertas',      label:'Alertas',      icon:'🔔' },
  { href:'/reportes',     label:'Reportes',     icon:'📄' },
  { href:'/bancos',       label:'Bancos',       icon:'🏦' },
  { href:'/tributario',   label:'Documentos',   icon:'🧾' },
  { href:'/proyecciones', label:'Proyecciones', icon:'📈' },
  { href:'/usuarios',     label:'Usuarios',     icon:'👥' },
  { href:'/kpis',         label:'KPIs',         icon:'📊' },
  { href:'/ia',           label:'Análisis IA',  icon:'🧠' },
]

function fmtM(n: number) {
  const a = Math.abs(n), s = n < 0 ? '-' : ''
  if (a >= 1e6) return s+'$'+(Math.round(a/1e5)/10)+'M'
  if (a >= 1000) return s+'$'+Math.round(a/1000)+'K'
  return s+'$'+Math.round(a)
}
function fmtCLP(n: number) {
  return (n<0?'-':'')+'$'+Math.round(Math.abs(n)).toLocaleString('es-CL')
}

const EMPRESAS_DEFAULT: Empresa[] = [
  { id:'A', nombre_corto:'Empresa A', color:'#3266ad' },
]

export default function MovimientosPage() {
  const [movimientos,   setMovimientos]   = useState<Movimiento[]>([])
  const [empresas,      setEmpresas]      = useState<Empresa[]>(EMPRESAS_DEFAULT)
  const [cargando,      setCargando]      = useState(true)
  const [guardando,     setGuardando]     = useState(false)
  const [empresaFiltro, setEmpresaFiltro] = useState('all')
  const [tipoFiltro,    setTipoFiltro]    = useState('all')
  const [busqueda,      setBusqueda]      = useState('')
  const [showForm,      setShowForm]      = useState(false)
  const [showImport,    setShowImport]    = useState(false)
  const [editId,        setEditId]        = useState<string|null>(null)
  const [tab,           setTab]           = useState<'lista'|'resumen'>('lista')
  const [error,         setError]         = useState('')
  const [exito,         setExito]         = useState('')

  // Import state
  const [csvPreview,    setCsvPreview]    = useState<any[]>([])
  const [csvError,      setCsvError]      = useState('')
  const [importando,    setImportando]    = useState(false)
  const [importResult,  setImportResult]  = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Form state
  const [fEmpresa, setFEmpresa] = useState('')
  const [fTipo,    setFTipo]    = useState<'ingreso'|'gasto'>('ingreso')
  const [fDesc,    setFDesc]    = useState('')
  const [fCat,     setFCat]     = useState(CATEGORIAS_INGRESO[0])
  const [fMonto,   setFMonto]   = useState('')
  const [fFecha,   setFFecha]   = useState(new Date().toISOString().split('T')[0])
  const [fRef,     setFRef]     = useState('')

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setCargando(true)
    setError('')
    try {
      const { data: emps } = await supabase
        .from('empresas').select('id,nombre_corto,color')
        .eq('activa', true).order('nombre_corto')

      if (emps && emps.length > 0) {
        setEmpresas(emps)
        setFEmpresa(emps[0].id)
      }

      const { data: movs, error: errMovs } = await supabase
        .from('movimientos').select('*')
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500)

      if (errMovs) throw errMovs
      setMovimientos(movs || [])
    } catch(e: any) {
      setError('Error conectando con la base de datos.')
    } finally {
      setCargando(false)
    }
  }

  // ── Parsear CSV ──
  function parsearCSV(texto: string, empresaId: string) {
    setCsvError('')
    const lineas = texto.trim().split('\n').filter(l => l.trim())
    if (lineas.length < 2) { setCsvError('El archivo está vacío o solo tiene encabezados.'); return }

    const encabezados = lineas[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g,''))
    const filas = []
    const errores = []

    for (let i = 1; i < lineas.length; i++) {
      const cols = lineas[i].split(',').map(c => c.trim().replace(/"/g,''))
      const fila: any = {}
      encabezados.forEach((h, j) => { fila[h] = cols[j] || '' })

      // Validar campos mínimos
      const tipo = fila.tipo?.toLowerCase()
      const monto = parseFloat(fila.monto)
      const desc = fila.descripcion || fila.descripcion || fila.desc || ''

      if (!tipo || !['ingreso','gasto'].includes(tipo)) {
        errores.push(`Fila ${i+1}: tipo debe ser "ingreso" o "gasto"`)
        continue
      }
      if (!monto || isNaN(monto)) {
        errores.push(`Fila ${i+1}: monto inválido`)
        continue
      }
      if (!desc) {
        errores.push(`Fila ${i+1}: descripción vacía`)
        continue
      }

      filas.push({
        empresa_id:  fila.empresa_id || empresaId,
        tipo,
        descripcion: desc,
        categoria:   fila.categoria || (tipo==='ingreso'?'Ventas':'Gastos generales'),
        monto:       Math.abs(monto),
        fecha:       fila.fecha || new Date().toISOString().split('T')[0],
        referencia:  fila.referencia || '',
        conciliado:  fila.conciliado === 'true' || fila.conciliado === '1',
      })
    }

    if (errores.length > 0) setCsvError(errores.slice(0,3).join(' · '))
    setCsvPreview(filas)
  }

  function handleArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => parsearCSV(ev.target?.result as string, fEmpresa)
    reader.readAsText(file)
  }

  async function importarCSV() {
    if (csvPreview.length === 0) return
    setImportando(true)
    setImportResult('')
    try {
      const BATCH = 50
      let total = 0
      for (let i = 0; i < csvPreview.length; i += BATCH) {
        const batch = csvPreview.slice(i, i + BATCH)
        const { error } = await supabase.from('movimientos').insert(batch)
        if (error) throw error
        total += batch.length
      }
      setImportResult(`✅ ${total} movimientos importados correctamente`)
      setCsvPreview([])
      if (fileRef.current) fileRef.current.value = ''
      await cargarDatos()
      setTimeout(() => { setShowImport(false); setImportResult('') }, 3000)
    } catch(e: any) {
      setImportResult('❌ Error importando: ' + e.message)
    } finally {
      setImportando(false)
    }
  }

  function descargarPlantilla() {
    const empId = empresas[0]?.id || 'UUID-empresa'
    const csv = [
      'empresa_id,tipo,descripcion,categoria,monto,fecha,referencia',
      `${empId},ingreso,Venta local,Ventas,150000,2025-06-01,BOL-001`,
      `${empId},gasto,Pago proveedor,Proveedores,80000,2025-06-02,F-1023`,
      `${empId},ingreso,Cobro servicio,Servicios,250000,2025-06-03,`,
      `${empId},gasto,Arriendo oficina,Arriendos pagados,450000,2025-06-01,`,
    ].join('\n')
    const blob = new Blob([csv], { type:'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'plantilla_movimientos.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── CRUD ──
  const lista = movimientos.filter(m => {
    if (empresaFiltro !== 'all' && m.empresa_id !== empresaFiltro) return false
    if (tipoFiltro !== 'all' && m.tipo !== tipoFiltro) return false
    if (busqueda && !m.descripcion.toLowerCase().includes(busqueda.toLowerCase()) &&
        !m.categoria.toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  })

  const scope = empresaFiltro==='all' ? movimientos : movimientos.filter(m=>m.empresa_id===empresaFiltro)
  const totalIngresos = scope.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)
  const totalGastos   = scope.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0)
  const utilidad      = totalIngresos - totalGastos
  const pendientes    = scope.filter(m=>!m.conciliado).length

  async function handleGuardar() {
    if (!fDesc || !fMonto) return
    setGuardando(true)
    const mov = { empresa_id:fEmpresa, tipo:fTipo, descripcion:fDesc, categoria:fCat, monto:parseFloat(fMonto)||0, fecha:fFecha, referencia:fRef, conciliado:false }
    try {
      if (editId) {
        const { error } = await supabase.from('movimientos').update(mov).eq('id', editId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('movimientos').insert(mov)
        if (error) throw error
      }
      await cargarDatos(); resetForm()
    } catch(e: any) { setError('Error guardando: ' + e.message) }
    finally { setGuardando(false) }
  }

  async function handleEliminar(id: string) {
    try {
      await supabase.from('movimientos').delete().eq('id', id)
      setMovimientos(prev => prev.filter(m => m.id !== id))
    } catch(e: any) { setError('Error eliminando.') }
  }

  async function handleConciliar(id: string, actual: boolean) {
    try {
      await supabase.from('movimientos').update({ conciliado: !actual }).eq('id', id)
      setMovimientos(prev => prev.map(m => m.id===id ? {...m, conciliado:!actual} : m))
    } catch(e: any) { setError('Error actualizando.') }
  }

  function handleEditar(m: Movimiento) {
    setEditId(m.id); setFEmpresa(m.empresa_id); setFTipo(m.tipo)
    setFDesc(m.descripcion); setFCat(m.categoria); setFMonto(m.monto.toString())
    setFFecha(m.fecha); setFRef(m.referencia||'')
    setShowForm(true); setShowImport(false)
    window.scrollTo({ top:0, behavior:'smooth' })
  }

  function resetForm() {
    setShowForm(false); setEditId(null); setFDesc(''); setFMonto(''); setFRef('')
    setFTipo('ingreso'); setFCat(CATEGORIAS_INGRESO[0])
    setFFecha(new Date().toISOString().split('T')[0])
  }

  const resumenCats = () => {
    const map: Record<string,{tipo:string;total:number;count:number}> = {}
    scope.forEach(m => {
      if (!map[m.categoria]) map[m.categoria] = { tipo:m.tipo, total:0, count:0 }
      map[m.categoria].total += m.monto; map[m.categoria].count++
    })
    return Object.entries(map).sort((a,b) => b[1].total - a[1].total)
  }
  const maxCat = Math.max(...resumenCats().map(([,v])=>v.total), 1)
  const empColor  = (id: string) => empresas.find(e=>e.id===id)?.color || '#888780'
  const empNombre = (id: string) => empresas.find(e=>e.id===id)?.nombre_corto || id

  return (
    <div style={{ minHeight:'100vh', background:'#f8f9fb', fontFamily:'DM Sans, sans-serif' }}>
      {/* Sidebar */}
      <div style={{ position:'fixed', top:0, left:0, width:220, height:'100vh', background:'#fff', borderRight:'1px solid rgba(0,0,0,0.08)', display:'flex', flexDirection:'column', padding:'0 12px 16px', zIndex:100, overflowY:'auto' }}>
        <div style={{ height:56, display:'flex', alignItems:'center', borderBottom:'1px solid rgba(0,0,0,0.08)', marginBottom:12, marginLeft:-12, marginRight:-12, paddingLeft:20, fontSize:15, fontWeight:600, color:'#3266ad' }}>
          📊 Finanzas Grupo
        </div>
        {NAV.map(item=>(
          <Link key={item.href} href={item.href} style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px', borderRadius:8, fontSize:13.5, color:(item as any).active?'#3266ad':'#6b7280', background:(item as any).active?'#eff4ff':'transparent', fontWeight:(item as any).active?500:400, textDecoration:'none', marginBottom:2 }}>
            <span style={{ fontSize:15 }}>{item.icon}</span>{item.label}
          </Link>
        ))}
      </div>

      <div style={{ marginLeft:220 }}>
        {/* Header */}
        <div style={{ height:56, background:'#fff', borderBottom:'1px solid rgba(0,0,0,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 28px', position:'sticky', top:0, zIndex:50 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:15, fontWeight:600 }}>Movimientos</div>
            {!cargando && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:'#E1F5EE', color:'#085041', fontWeight:500 }}>🟢 Conectado a Supabase</span>}
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <select value={empresaFiltro} onChange={e=>setEmpresaFiltro(e.target.value)} style={sel}>
              <option value="all">Todas las empresas</option>
              {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre_corto}</option>)}
            </select>
            <button onClick={()=>{ setShowImport(!showImport); setShowForm(false) }} style={{ ...btnSec, width:'auto', padding:'7px 14px' }}>
              📥 Importar CSV
            </button>
            <button onClick={()=>{ resetForm(); setShowForm(true); setShowImport(false) }} style={btnP}>
              + Nuevo movimiento
            </button>
          </div>
        </div>

        <div style={{ padding:'24px 28px' }}>
          {/* Errores y éxitos */}
          {error && (
            <div style={{ background:'#FCEBEB', border:'1px solid #F09595', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#791F1F', marginBottom:16, display:'flex', justifyContent:'space-between' }}>
              <span>⚠️ {error}</span>
              <button onClick={()=>setError('')} style={{ background:'transparent', border:'none', cursor:'pointer', color:'#791F1F' }}>✕</button>
            </div>
          )}
          {exito && (
            <div style={{ background:'#EAF3DE', border:'1px solid #97C459', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#27500A', marginBottom:16 }}>
              {exito}
            </div>
          )}

          {/* Métricas */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:24 }}>
            {[
              { label:'Ingresos',   value:fmtM(totalIngresos), color:'#1D9E75', bg:'#E1F5EE' },
              { label:'Gastos',     value:fmtM(totalGastos),   color:'#E24B4A', bg:'#FCEBEB' },
              { label:'Utilidad',   value:fmtM(utilidad),      color:utilidad>=0?'#3266ad':'#E24B4A', bg:'#E6F1FB' },
              { label:'Pendientes', value:pendientes.toString(),color:'#BA7517', bg:'#FAEEDA' },
            ].map(m=>(
              <div key={m.label} style={{ background:m.bg, borderRadius:12, padding:'14px 16px' }}>
                <div style={{ fontSize:11, color:m.color, fontWeight:500, marginBottom:4, opacity:0.8 }}>{m.label}</div>
                <div style={{ fontSize:22, fontWeight:700, color:m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* ── Panel Importar CSV ── */}
          {showImport && (
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20, marginBottom:20 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <div style={{ fontSize:14, fontWeight:600 }}>📥 Importar movimientos desde CSV</div>
                <button onClick={()=>{ setShowImport(false); setCsvPreview([]); setCsvError('') }} style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:18, color:'#9ca3af' }}>✕</button>
              </div>

              {/* Instrucciones */}
              <div style={{ background:'#eff4ff', border:'1px solid #c7d7f5', borderRadius:10, padding:'12px 14px', marginBottom:14, fontSize:12, color:'#3266ad', lineHeight:1.7 }}>
                <div style={{ fontWeight:600, marginBottom:4 }}>Formato del CSV:</div>
                <div>Las columnas requeridas son: <strong>tipo</strong> (ingreso/gasto), <strong>descripcion</strong>, <strong>monto</strong>, <strong>fecha</strong> (AAAA-MM-DD)</div>
                <div>Opcionales: empresa_id, categoria, referencia, conciliado</div>
                <div style={{ marginTop:6 }}>Si no incluyes empresa_id, se usará la empresa seleccionada abajo.</div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <div>
                  <label style={lbl}>Empresa por defecto (si el CSV no incluye empresa_id)</label>
                  <select value={fEmpresa} onChange={e=>setFEmpresa(e.target.value)} style={inp}>
                    {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre_corto}</option>)}
                  </select>
                </div>
                <div style={{ display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
                  <button onClick={descargarPlantilla} style={{ ...btnSec, width:'100%', gap:6 }}>
                    ⬇️ Descargar plantilla CSV
                  </button>
                </div>
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={lbl}>Seleccionar archivo CSV</label>
                <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleArchivo}
                  style={{ display:'block', fontSize:13, padding:'8px', border:'1px dashed #d1d5db', borderRadius:8, width:'100%', background:'#fafafa', cursor:'pointer' }}/>
              </div>

              {csvError && (
                <div style={{ background:'#FAEEDA', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#633806', marginBottom:12 }}>
                  ⚠️ {csvError}
                </div>
              )}

              {/* Preview */}
              {csvPreview.length > 0 && (
                <>
                  <div style={{ fontSize:13, fontWeight:500, color:'#111827', marginBottom:8 }}>
                    Vista previa — {csvPreview.length} movimientos listos para importar
                  </div>
                  <div style={{ border:'1px solid rgba(0,0,0,0.08)', borderRadius:10, overflow:'hidden', marginBottom:14 }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                      <thead>
                        <tr style={{ background:'#f8fafc' }}>
                          {['Empresa','Tipo','Descripción','Categoría','Monto','Fecha'].map(h=>(
                            <th key={h} style={{ padding:'7px 10px', textAlign:'left', fontWeight:500, color:'#6b7280', borderBottom:'1px solid rgba(0,0,0,0.07)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.slice(0,5).map((r,i)=>(
                          <tr key={i} style={{ borderBottom:i<Math.min(4,csvPreview.length-1)?'1px solid rgba(0,0,0,0.06)':'none' }}>
                            <td style={{ padding:'7px 10px', color:'#6b7280', fontSize:11 }}>{empNombre(r.empresa_id)}</td>
                            <td style={{ padding:'7px 10px' }}>
                              <span style={{ fontSize:11, padding:'1px 6px', borderRadius:999, fontWeight:500, background:r.tipo==='ingreso'?'#E1F5EE':'#FCEBEB', color:r.tipo==='ingreso'?'#085041':'#791F1F' }}>{r.tipo}</span>
                            </td>
                            <td style={{ padding:'7px 10px', fontWeight:500 }}>{r.descripcion}</td>
                            <td style={{ padding:'7px 10px', color:'#6b7280' }}>{r.categoria}</td>
                            <td style={{ padding:'7px 10px', fontWeight:600, color:r.tipo==='ingreso'?'#1D9E75':'#E24B4A' }}>{fmtCLP(r.monto)}</td>
                            <td style={{ padding:'7px 10px', color:'#6b7280' }}>{r.fecha}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {csvPreview.length > 5 && (
                      <div style={{ padding:'6px 10px', fontSize:11, color:'#9ca3af', background:'#f8fafc', textAlign:'center' }}>
                        ... y {csvPreview.length - 5} más
                      </div>
                    )}
                  </div>

                  {importResult && (
                    <div style={{ background: importResult.startsWith('✅')?'#EAF3DE':'#FCEBEB', borderRadius:8, padding:'8px 12px', fontSize:13, color: importResult.startsWith('✅')?'#27500A':'#791F1F', marginBottom:12 }}>
                      {importResult}
                    </div>
                  )}

                  <button onClick={importarCSV} disabled={importando} style={{ ...btnP, width:'100%', justifyContent:'center', opacity:importando?0.7:1 }}>
                    {importando ? `⏳ Importando ${csvPreview.length} movimientos...` : `✅ Importar ${csvPreview.length} movimientos`}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Formulario nuevo/editar */}
          {showForm && (
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20, marginBottom:20 }}>
              <div style={{ fontSize:14, fontWeight:600, marginBottom:16 }}>
                {editId ? 'Editar movimiento' : 'Nuevo movimiento'}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div><label style={lbl}>Empresa</label>
                  <select value={fEmpresa} onChange={e=>setFEmpresa(e.target.value)} style={inp}>
                    {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre_corto}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Tipo</label>
                  <select value={fTipo} onChange={e=>{ setFTipo(e.target.value as 'ingreso'|'gasto'); setFCat(e.target.value==='ingreso'?CATEGORIAS_INGRESO[0]:CATEGORIAS_GASTO[0]) }} style={inp}>
                    <option value="ingreso">Ingreso</option>
                    <option value="gasto">Gasto</option>
                  </select>
                </div>
                <div><label style={lbl}>Descripción</label>
                  <input value={fDesc} onChange={e=>setFDesc(e.target.value)} placeholder="Descripción" style={inp}/>
                </div>
                <div><label style={lbl}>Categoría</label>
                  <select value={fCat} onChange={e=>setFCat(e.target.value)} style={inp}>
                    {(fTipo==='ingreso'?CATEGORIAS_INGRESO:CATEGORIAS_GASTO).map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Monto ($)</label>
                  <input type="number" value={fMonto} onChange={e=>setFMonto(e.target.value)} placeholder="0" style={inp}/>
                </div>
                <div><label style={lbl}>Fecha</label>
                  <input type="date" value={fFecha} onChange={e=>setFFecha(e.target.value)} style={inp}/>
                </div>
                <div><label style={lbl}>Referencia (opcional)</label>
                  <input value={fRef} onChange={e=>setFRef(e.target.value)} placeholder="F-1023..." style={inp}/>
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={handleGuardar} disabled={guardando} style={{ ...btnP, flex:1, justifyContent:'center', opacity:guardando?0.7:1 }}>
                  {guardando?'Guardando...':editId?'💾 Guardar cambios':'✅ Agregar movimiento'}
                </button>
                <button onClick={resetForm} style={{ ...btnSec, width:'auto', padding:'8px 16px' }}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
            {(['lista','resumen'] as const).map(t=>(
              <button key={t} onClick={()=>setTab(t)} style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer', border:'1px solid rgba(0,0,0,0.1)', background:tab===t?'#eff4ff':'#fff', color:tab===t?'#3266ad':'#6b7280', fontWeight:tab===t?500:400 }}>
                {t==='lista'?'≡ Lista':'⬛ Por categoría'}
              </button>
            ))}
            {tab==='lista' && (
              <div style={{ display:'flex', gap:8, marginLeft:'auto' }}>
                <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar..." style={{ ...inp, width:180, margin:0, fontSize:12 }}/>
                <select value={tipoFiltro} onChange={e=>setTipoFiltro(e.target.value)} style={{ ...sel, fontSize:12 }}>
                  <option value="all">Todos</option>
                  <option value="ingreso">Ingresos</option>
                  <option value="gasto">Gastos</option>
                </select>
              </div>
            )}
          </div>

          {cargando && <div style={{ textAlign:'center', padding:'3rem', color:'#9ca3af' }}>⏳ Cargando...</div>}

          {/* Lista */}
          {!cargando && tab==='lista' && (
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, overflow:'hidden' }}>
              {lista.length===0 ? (
                <div style={{ textAlign:'center', padding:'3rem', color:'#9ca3af', fontSize:14 }}>
                  {movimientos.length===0 ? '📭 Sin movimientos — agrega uno o importa un CSV' : 'Sin resultados'}
                </div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:'#fafafa' }}>
                      {['Fecha','Empresa','Descripción','Categoría','Monto','Estado',''].map(h=>(
                        <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontWeight:500, color:'#6b7280', borderBottom:'1px solid rgba(0,0,0,0.07)', whiteSpace:'nowrap' as const }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((m,i)=>(
                      <tr key={m.id} style={{ borderBottom:i<lista.length-1?'1px solid rgba(0,0,0,0.06)':'none' }}>
                        <td style={{ padding:'10px 14px', color:'#6b7280', whiteSpace:'nowrap' as const }}>{m.fecha}</td>
                        <td style={{ padding:'10px 14px' }}>
                          <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
                            <span style={{ width:8, height:8, borderRadius:'50%', background:empColor(m.empresa_id), flexShrink:0 }}/>
                            <span style={{ fontSize:12, fontWeight:500, color:empColor(m.empresa_id) }}>{empNombre(m.empresa_id)}</span>
                          </span>
                        </td>
                        <td style={{ padding:'10px 14px' }}>
                          <div style={{ fontWeight:500, color:'#111827' }}>{m.descripcion}</div>
                          {m.referencia && <div style={{ fontSize:11, color:'#9ca3af' }}>{m.referencia}</div>}
                        </td>
                        <td style={{ padding:'10px 14px', color:'#6b7280' }}>{m.categoria}</td>
                        <td style={{ padding:'10px 14px', fontWeight:600, color:m.tipo==='ingreso'?'#1D9E75':'#E24B4A', whiteSpace:'nowrap' as const }}>
                          {m.tipo==='ingreso'?'+':'-'}{fmtCLP(m.monto)}
                        </td>
                        <td style={{ padding:'10px 14px' }}>
                          <button onClick={()=>handleConciliar(m.id,m.conciliado)} style={{ fontSize:11, padding:'2px 8px', borderRadius:999, fontWeight:500, cursor:'pointer', border:'none', background:m.conciliado?'#E1F5EE':'#FAEEDA', color:m.conciliado?'#085041':'#633806' }}>
                            {m.conciliado?'✓ Conciliado':'⏳ Pendiente'}
                          </button>
                        </td>
                        <td style={{ padding:'10px 14px' }}>
                          <div style={{ display:'flex', gap:4 }}>
                            <button onClick={()=>handleEditar(m)} style={iconBtn}>✏️</button>
                            <button onClick={()=>handleEliminar(m.id)} style={iconBtn}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background:'#f8f9fb', borderTop:'1px solid rgba(0,0,0,0.08)' }}>
                      <td colSpan={4} style={{ padding:'10px 14px', fontSize:12, color:'#6b7280', fontWeight:500 }}>{lista.length} movimientos</td>
                      <td style={{ padding:'10px 14px', fontWeight:600, fontSize:13, color:'#111827' }}>
                        {fmtCLP(lista.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)-lista.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0))}
                      </td>
                      <td colSpan={2}/>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          )}

          {/* Resumen categorías */}
          {!cargando && tab==='resumen' && (
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:16 }}>Desglose por categoría</div>
              {resumenCats().length===0 ? (
                <div style={{ textAlign:'center', padding:'2rem', color:'#9ca3af' }}>Sin datos</div>
              ) : resumenCats().map(([cat,val])=>(
                <div key={cat} style={{ marginBottom:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:11, padding:'1px 7px', borderRadius:999, fontWeight:500, background:val.tipo==='ingreso'?'#E1F5EE':'#FCEBEB', color:val.tipo==='ingreso'?'#085041':'#791F1F' }}>{val.tipo}</span>
                      <span style={{ fontSize:13, fontWeight:500, color:'#111827' }}>{cat}</span>
                      <span style={{ fontSize:11, color:'#9ca3af' }}>{val.count} mov.</span>
                    </div>
                    <span style={{ fontSize:14, fontWeight:600, color:val.tipo==='ingreso'?'#1D9E75':'#E24B4A' }}>{fmtCLP(val.total)}</span>
                  </div>
                  <div style={{ height:7, background:'#f1f5f9', borderRadius:4, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${Math.round(val.total/maxCat*100)}%`, background:val.tipo==='ingreso'?'#1D9E75':'#E24B4A', borderRadius:4, transition:'width 0.4s' }}/>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const sel: React.CSSProperties     = { fontSize:13, padding:'6px 10px', border:'1px solid rgba(0,0,0,0.12)', borderRadius:8, background:'#fff' }
const btnP: React.CSSProperties    = { display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, border:'none', background:'#3266ad', color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer' }
const btnSec: React.CSSProperties  = { display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'7px 14px', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', border:'1px solid rgba(0,0,0,0.12)', background:'#fff', color:'#374151', width:'100%' }
const lbl: React.CSSProperties     = { display:'block', fontSize:12, fontWeight:500, color:'#6b7280', marginBottom:4 }
const inp: React.CSSProperties     = { width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid rgba(0,0,0,0.14)', borderRadius:8, background:'#fff', color:'#111827', fontFamily:'DM Sans, sans-serif' }
const iconBtn: React.CSSProperties = { background:'transparent', border:'none', cursor:'pointer', padding:'4px 6px', borderRadius:6, fontSize:14 }
