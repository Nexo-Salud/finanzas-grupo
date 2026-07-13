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

const CATEGORIAS_INGRESO = ["Ventas contado","Ventas crédito","Ventas débito","Transferencias recibidas","Otros ingresos"]
const CATEGORIAS_GASTO   = ["Proveedores","Remuneraciones","Leyes sociales","Arriendos pagados","Impuestos","Tarjeta de crédito","Préstamos","Boletas de honorarios","Asesoría contable","Mantención","Comisión TUU","Controlfarma software","Seguridad","Agua Antofagasta","Servicios básicos","Gastos generales"]
const MESES_NOMBRE = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

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
  const a=Math.abs(n),s=n<0?'-':''
  if(a>=1e6) return s+'$'+(Math.round(a/1e5)/10)+'M'
  if(a>=1000) return s+'$'+Math.round(a/1000)+'K'
  return s+'$'+Math.round(a)
}
function fmtCLP(n: number) {
  return (n<0?'-':'')+'$'+Math.round(Math.abs(n)).toLocaleString('es-CL')
}

export default function MovimientosPage() {
  const [movimientos,   setMovimientos]   = useState<Movimiento[]>([])
  const [empresas,      setEmpresas]      = useState<Empresa[]>([])
  const [cargando,      setCargando]      = useState(true)
  const [guardando,     setGuardando]     = useState(false)
  const [empresaFiltro, setEmpresaFiltro] = useState('all')
  const [tipoFiltro,    setTipoFiltro]    = useState('all')
  const [busqueda,      setBusqueda]      = useState('')
  const [showForm,      setShowForm]      = useState(false)
  const [showImport,    setShowImport]    = useState(false)
  const [editId,        setEditId]        = useState<string|null>(null)
  const [tab,           setTab]           = useState<'lista'|'mensual'|'categorias'>('lista')
  const [error,         setError]         = useState('')

  // Filtros de período
  const hoy = new Date()
  const [periodoTipo, setPeriodoTipo] = useState<'mes'|'rango'|'todo'>('mes')
  const [mesSelec,    setMesSelec]    = useState(hoy.getMonth() + 1)
  const [anioSelec,   setAnioSelec]   = useState(hoy.getFullYear())
  const [fechaDesde,  setFechaDesde]  = useState(`${hoy.getFullYear()}-01-01`)
  const [fechaHasta,  setFechaHasta]  = useState(hoy.toISOString().split('T')[0])

  // Import
  const [csvPreview,  setCsvPreview]  = useState<any[]>([])
  const [csvError,    setCsvError]    = useState('')
  const [importando,  setImportando]  = useState(false)
  const [importResult,setImportResult]= useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Form
  const [fEmpresa, setFEmpresa] = useState('')
  const [fTipo,    setFTipo]    = useState<'ingreso'|'gasto'>('ingreso')
  const [fDesc,    setFDesc]    = useState('')
  const [fCat,     setFCat]     = useState(CATEGORIAS_INGRESO[0])
  const [fMonto,   setFMonto]   = useState('')
  const [fFecha,   setFFecha]   = useState(hoy.toISOString().split('T')[0])
  const [fRef,     setFRef]     = useState('')

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setCargando(true)
    try {
      const { data: emps } = await supabase
        .from('empresas').select('id,nombre_corto,color')
        .eq('activa', true).order('nombre_corto')
      if (emps && emps.length > 0) { setEmpresas(emps); setFEmpresa(emps[0].id) }

      const { data: movs, error: errMovs } = await supabase
        .from('movimientos').select('*')
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1000)
      if (errMovs) throw errMovs
      setMovimientos(movs || [])
    } catch(e: any) {
      setError('Error conectando con la base de datos.')
    } finally { setCargando(false) }
  }

  // ── Filtrado por período ──
  function enPeriodo(fecha: string) {
    if (periodoTipo === 'todo') return true
    if (periodoTipo === 'mes') {
      const [y, m] = fecha.split('-')
      return parseInt(y) === anioSelec && parseInt(m) === mesSelec
    }
    return fecha >= fechaDesde && fecha <= fechaHasta
  }

  const scope = movimientos.filter(m => {
    if (empresaFiltro !== 'all' && m.empresa_id !== empresaFiltro) return false
    if (!enPeriodo(m.fecha)) return false
    return true
  })

  const lista = scope.filter(m => {
    if (tipoFiltro !== 'all' && m.tipo !== tipoFiltro) return false
    if (busqueda && !m.descripcion.toLowerCase().includes(busqueda.toLowerCase()) &&
        !m.categoria.toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  })

  const totalIngresos = scope.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)
  const totalGastos   = scope.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0)
  const utilidad      = totalIngresos - totalGastos
  const margen        = totalIngresos > 0 ? Math.round(utilidad/totalIngresos*100) : 0

  // ── Resumen mensual ──
  function getResumenMensual() {
    const todos = movimientos.filter(m => empresaFiltro==='all' || m.empresa_id===empresaFiltro)
    const map: Record<string, {ing:number;gas:number}> = {}
    todos.forEach(m => {
      const key = m.fecha.slice(0,7) // YYYY-MM
      if (!map[key]) map[key] = { ing:0, gas:0 }
      if (m.tipo==='ingreso') map[key].ing += m.monto
      else map[key].gas += m.monto
    })
    return Object.entries(map).sort((a,b)=>a[0].localeCompare(b[0]))
  }

  // ── Resumen categorías ──
  function getResumenCats() {
    const map: Record<string,{tipo:string;total:number;count:number}> = {}
    scope.forEach(m => {
      if (!map[m.categoria]) map[m.categoria] = { tipo:m.tipo, total:0, count:0 }
      map[m.categoria].total += m.monto
      map[m.categoria].count++
    })
    return Object.entries(map).sort((a,b)=>b[1].total-a[1].total)
  }
  const maxCat = Math.max(...getResumenCats().map(([,v])=>v.total), 1)
  const mensual = getResumenMensual()
  const maxMes  = Math.max(...mensual.map(([,v])=>v.ing+v.gas), 1)

  // ── CSV Import ──
  function parsearCSV(texto: string, empId: string) {
    setCsvError('')
    const lineas = texto.trim().split('\n').filter(l=>l.trim())
    if (lineas.length < 2) { setCsvError('El archivo está vacío.'); return }
    const encabezados = lineas[0].split(',').map(h=>h.trim().toLowerCase().replace(/"/g,''))
    const filas = [], errores = []
    for (let i=1; i<lineas.length; i++) {
      const cols = lineas[i].split(',').map(c=>c.trim().replace(/"/g,''))
      const fila: any = {}
      encabezados.forEach((h,j)=>{ fila[h]=cols[j]||'' })
      const tipo = fila.tipo?.toLowerCase()
      const monto = parseFloat(fila.monto)
      const desc = fila.descripcion || fila.desc || ''
      if (!tipo||!['ingreso','gasto'].includes(tipo)) { errores.push(`Fila ${i+1}: tipo inválido`); continue }
      if (!monto||isNaN(monto)) { errores.push(`Fila ${i+1}: monto inválido`); continue }
      if (!desc) { errores.push(`Fila ${i+1}: sin descripción`); continue }
      filas.push({ empresa_id:fila.empresa_id||empId, tipo, descripcion:desc, categoria:fila.categoria||(tipo==='ingreso'?'Ventas':'Gastos generales'), monto:Math.abs(monto), fecha:fila.fecha||hoy.toISOString().split('T')[0], referencia:fila.referencia||'', conciliado:false })
    }
    if (errores.length>0) setCsvError(errores.slice(0,3).join(' · '))
    setCsvPreview(filas)
  }

  function handleArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => parsearCSV(ev.target?.result as string, fEmpresa)
    reader.readAsText(file)
  }

  async function importarCSV() {
    if (csvPreview.length===0) return
    setImportando(true)
    try {
      for (let i=0; i<csvPreview.length; i+=50) {
        const { error } = await supabase.from('movimientos').insert(csvPreview.slice(i,i+50))
        if (error) throw error
      }
      setImportResult(`✅ ${csvPreview.length} movimientos importados`)
      setCsvPreview([]); if (fileRef.current) fileRef.current.value = ''
      await cargarDatos()
      setTimeout(()=>{ setShowImport(false); setImportResult('') },3000)
    } catch(e: any) { setImportResult('❌ Error: '+e.message) }
    finally { setImportando(false) }
  }

  function descargarPlantilla() {
    const empId = empresas[0]?.id||'UUID'
    const csv = ['empresa_id,tipo,descripcion,categoria,monto,fecha,referencia',
      `${empId},ingreso,Venta local,Ventas,150000,2026-06-01,BOL-001`,
      `${empId},gasto,Pago proveedor,Proveedores,80000,2026-06-02,F-1023`,
    ].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}))
    a.download = 'plantilla_movimientos.csv'; a.click()
  }

  // ── CRUD ──
  async function handleGuardar() {
    if (!fDesc||!fMonto) return
    setGuardando(true)
    const mov = { empresa_id:fEmpresa, tipo:fTipo, descripcion:fDesc, categoria:fCat, monto:parseFloat(fMonto)||0, fecha:fFecha, referencia:fRef, conciliado:false }
    try {
      if (editId) { const {error}=await supabase.from('movimientos').update(mov).eq('id',editId); if(error) throw error }
      else { const {error}=await supabase.from('movimientos').insert(mov); if(error) throw error }
      await cargarDatos(); resetForm()
    } catch(e: any) { setError('Error guardando: '+e.message) }
    finally { setGuardando(false) }
  }

  async function handleEliminar(id: string) {
    try { await supabase.from('movimientos').delete().eq('id',id); setMovimientos(prev=>prev.filter(m=>m.id!==id)) }
    catch(e: any) { setError('Error eliminando.') }
  }

  async function handleConciliar(id: string, actual: boolean) {
    try { await supabase.from('movimientos').update({conciliado:!actual}).eq('id',id); setMovimientos(prev=>prev.map(m=>m.id===id?{...m,conciliado:!actual}:m)) }
    catch(e: any) { setError('Error actualizando.') }
  }

  function handleEditar(m: Movimiento) {
    setEditId(m.id); setFEmpresa(m.empresa_id); setFTipo(m.tipo)
    setFDesc(m.descripcion); setFCat(m.categoria); setFMonto(m.monto.toString())
    setFFecha(m.fecha); setFRef(m.referencia||'')
    setShowForm(true); setShowImport(false)
    window.scrollTo({top:0,behavior:'smooth'})
  }

  function resetForm() {
    setShowForm(false); setEditId(null); setFDesc(''); setFMonto(''); setFRef('')
    setFTipo('ingreso'); setFCat(CATEGORIAS_INGRESO[0])
    setFFecha(hoy.toISOString().split('T')[0])
  }

  const empColor  = (id: string) => empresas.find(e=>e.id===id)?.color||'#888780'
  const empNombre = (id: string) => empresas.find(e=>e.id===id)?.nombre_corto||id

  const labelPeriodo = () => {
    if (periodoTipo==='todo') return 'Todo el período'
    if (periodoTipo==='mes') return `${MESES_NOMBRE[mesSelec-1]} ${anioSelec}`
    return `${fechaDesde} → ${fechaHasta}`
  }

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
            {!cargando && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:'#E1F5EE', color:'#085041', fontWeight:500 }}>🟢 Supabase</span>}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <select value={empresaFiltro} onChange={e=>setEmpresaFiltro(e.target.value)} style={sel}>
              <option value="all">Todas las empresas</option>
              {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre_corto}</option>)}
            </select>
            <button onClick={()=>{ setShowImport(!showImport); setShowForm(false) }} style={{ ...btnSec, width:'auto', padding:'7px 12px', fontSize:12 }}>📥 CSV</button>
            <button onClick={()=>{ resetForm(); setShowForm(true); setShowImport(false) }} style={btnP}>+ Nuevo</button>
          </div>
        </div>

        <div style={{ padding:'24px 28px' }}>

          {error && (
            <div style={{ background:'#FCEBEB', border:'1px solid #F09595', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#791F1F', marginBottom:16, display:'flex', justifyContent:'space-between' }}>
              <span>⚠️ {error}</span>
              <button onClick={()=>setError('')} style={{ background:'transparent', border:'none', cursor:'pointer', color:'#791F1F' }}>✕</button>
            </div>
          )}

          {/* ── FILTRO DE PERÍODO ── */}
          <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:'14px 18px', marginBottom:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              <span style={{ fontSize:12, fontWeight:600, color:'#6b7280' }}>📅 Período:</span>
              {/* Tipo período */}
              <div style={{ display:'flex', gap:4 }}>
                {([
                  {k:'mes',   l:'Por mes'},
                  {k:'rango', l:'Rango'},
                  {k:'todo',  l:'Todo'},
                ] as const).map(p=>(
                  <button key={p.k} onClick={()=>setPeriodoTipo(p.k)} style={{ padding:'4px 10px', borderRadius:6, fontSize:12, cursor:'pointer', border:'1px solid rgba(0,0,0,0.1)', background:periodoTipo===p.k?'#3266ad':'#fff', color:periodoTipo===p.k?'#fff':'#6b7280', fontWeight:periodoTipo===p.k?500:400 }}>
                    {p.l}
                  </button>
                ))}
              </div>

              {/* Selector mes */}
              {periodoTipo==='mes' && (
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <select value={mesSelec} onChange={e=>setMesSelec(parseInt(e.target.value))} style={sel}>
                    {MESES_NOMBRE.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                  <select value={anioSelec} onChange={e=>setAnioSelec(parseInt(e.target.value))} style={sel}>
                    {[2024,2025,2026,2027].map(a=><option key={a}>{a}</option>)}
                  </select>
                </div>
              )}

              {/* Selector rango */}
              {periodoTipo==='rango' && (
                <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                  <input type="date" value={fechaDesde} onChange={e=>setFechaDesde(e.target.value)} style={{ ...sel, padding:'5px 8px' }}/>
                  <span style={{ fontSize:12, color:'#6b7280' }}>hasta</span>
                  <input type="date" value={fechaHasta} onChange={e=>setFechaHasta(e.target.value)} style={{ ...sel, padding:'5px 8px' }}/>
                </div>
              )}

              {/* Accesos rápidos */}
              {periodoTipo==='mes' && (
                <div style={{ display:'flex', gap:4, marginLeft:'auto', flexWrap:'wrap' }}>
                  {[
                    { l:'Ene', m:1 }, { l:'Feb', m:2 }, { l:'Mar', m:3 },
                    { l:'Abr', m:4 }, { l:'May', m:5 }, { l:'Jun', m:6 },
                    { l:'Jul', m:7 }, { l:'Ago', m:8 }, { l:'Sep', m:9 },
                    { l:'Oct', m:10 },{ l:'Nov', m:11 },{ l:'Dic', m:12 },
                  ].map(x=>(
                    <button key={x.m} onClick={()=>{ setMesSelec(x.m); setAnioSelec(2026) }} style={{ padding:'3px 7px', borderRadius:5, fontSize:11, cursor:'pointer', border:'1px solid rgba(0,0,0,0.1)', background:mesSelec===x.m&&anioSelec===2026?'#eff4ff':'#fff', color:mesSelec===x.m&&anioSelec===2026?'#3266ad':'#9ca3af', fontWeight:mesSelec===x.m&&anioSelec===2026?600:400 }}>
                      {x.l}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Métricas */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12, marginBottom:20 }}>
            {[
              { label:'Ingresos', value:fmtM(totalIngresos), color:'#1D9E75', bg:'#E1F5EE', sub:labelPeriodo() },
              { label:'Gastos',   value:fmtM(totalGastos),   color:'#E24B4A', bg:'#FCEBEB', sub:labelPeriodo() },
              { label:'Utilidad', value:fmtM(utilidad),      color:utilidad>=0?'#3266ad':'#E24B4A', bg:'#E6F1FB', sub:`Margen ${margen}%` },
              { label:'Movimientos', value:scope.length.toString(), color:'#BA7517', bg:'#FAEEDA', sub:`${scope.filter(m=>!m.conciliado).length} pendientes` },
            ].map(m=>(
              <div key={m.label} style={{ background:m.bg, borderRadius:12, padding:'14px 16px' }}>
                <div style={{ fontSize:11, color:m.color, fontWeight:500, marginBottom:4, opacity:0.8 }}>{m.label}</div>
                <div style={{ fontSize:22, fontWeight:700, color:m.color }}>{m.value}</div>
                <div style={{ fontSize:10, color:m.color, opacity:0.7, marginTop:2 }}>{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Import CSV */}
          {showImport && (
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20, marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{ fontSize:14, fontWeight:600 }}>📥 Importar CSV</div>
                <button onClick={()=>{ setShowImport(false); setCsvPreview([]) }} style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:18, color:'#9ca3af' }}>✕</button>
              </div>
              <div style={{ background:'#eff4ff', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#3266ad', marginBottom:12 }}>
                Columnas requeridas: <strong>tipo</strong> (ingreso/gasto), <strong>descripcion</strong>, <strong>monto</strong>, <strong>fecha</strong> (AAAA-MM-DD)
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                <div>
                  <label style={lbl}>Empresa por defecto</label>
                  <select value={fEmpresa} onChange={e=>setFEmpresa(e.target.value)} style={inp}>
                    {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre_corto}</option>)}
                  </select>
                </div>
                <div style={{ display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
                  <button onClick={descargarPlantilla} style={{ ...btnSec, width:'100%' }}>⬇️ Descargar plantilla</button>
                </div>
              </div>
              <input ref={fileRef} type="file" accept=".csv" onChange={handleArchivo}
                style={{ display:'block', fontSize:13, padding:8, border:'1px dashed #d1d5db', borderRadius:8, width:'100%', background:'#fafafa', cursor:'pointer', marginBottom:10 }}/>
              {csvError && <div style={{ background:'#FAEEDA', borderRadius:8, padding:'6px 10px', fontSize:12, color:'#633806', marginBottom:10 }}>⚠️ {csvError}</div>}
              {csvPreview.length>0 && (
                <>
                  <div style={{ fontSize:13, fontWeight:500, marginBottom:8 }}>{csvPreview.length} movimientos listos</div>
                  {importResult && <div style={{ background:importResult.startsWith('✅')?'#EAF3DE':'#FCEBEB', borderRadius:8, padding:'7px 10px', fontSize:13, color:importResult.startsWith('✅')?'#27500A':'#791F1F', marginBottom:10 }}>{importResult}</div>}
                  <button onClick={importarCSV} disabled={importando} style={{ ...btnP, width:'100%', justifyContent:'center', opacity:importando?0.7:1 }}>
                    {importando?'⏳ Importando...': `✅ Importar ${csvPreview.length} movimientos`}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Form */}
          {showForm && (
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20, marginBottom:20 }}>
              <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>{editId?'Editar movimiento':'Nuevo movimiento'}</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div><label style={lbl}>Empresa</label>
                  <select value={fEmpresa} onChange={e=>setFEmpresa(e.target.value)} style={inp}>
                    {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre_corto}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Tipo</label>
                  <select value={fTipo} onChange={e=>{ setFTipo(e.target.value as 'ingreso'|'gasto'); setFCat(e.target.value==='ingreso'?CATEGORIAS_INGRESO[0]:CATEGORIAS_GASTO[0]) }} style={inp}>
                    <option value="ingreso">Ingreso</option><option value="gasto">Gasto</option>
                  </select>
                </div>
                <div><label style={lbl}>Descripción</label><input value={fDesc} onChange={e=>setFDesc(e.target.value)} placeholder="Descripción" style={inp}/></div>
                <div><label style={lbl}>Categoría</label>
                  <select value={fCat} onChange={e=>setFCat(e.target.value)} style={inp}>
                    {(fTipo==='ingreso'?CATEGORIAS_INGRESO:CATEGORIAS_GASTO).map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Monto ($)</label><input type="number" value={fMonto} onChange={e=>setFMonto(e.target.value)} placeholder="0" style={inp}/></div>
                <div><label style={lbl}>Fecha</label><input type="date" value={fFecha} onChange={e=>setFFecha(e.target.value)} style={inp}/></div>
                <div><label style={lbl}>Referencia (opcional)</label><input value={fRef} onChange={e=>setFRef(e.target.value)} placeholder="F-1023..." style={inp}/></div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={handleGuardar} disabled={guardando} style={{ ...btnP, flex:1, justifyContent:'center', opacity:guardando?0.7:1 }}>
                  {guardando?'Guardando...':editId?'💾 Guardar cambios':'✅ Agregar'}
                </button>
                <button onClick={resetForm} style={{ ...btnSec, width:'auto', padding:'8px 16px' }}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
            {([
              {k:'lista',      l:'≡ Lista'},
              {k:'mensual',    l:'📅 Resumen mensual'},
              {k:'categorias', l:'⬛ Por categoría'},
            ] as const).map(t=>(
              <button key={t.k} onClick={()=>setTab(t.k)} style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer', border:'1px solid rgba(0,0,0,0.1)', background:tab===t.k?'#eff4ff':'#fff', color:tab===t.k?'#3266ad':'#6b7280', fontWeight:tab===t.k?500:400 }}>
                {t.l}
              </button>
            ))}
            {tab==='lista' && (
              <div style={{ display:'flex', gap:8, marginLeft:'auto' }}>
                <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar..." style={{ ...inp, width:180, margin:0, fontSize:12 }}/>
                <select value={tipoFiltro} onChange={e=>setTipoFiltro(e.target.value)} style={{ ...sel, fontSize:12 }}>
                  <option value="all">Todos</option><option value="ingreso">Ingresos</option><option value="gasto">Gastos</option>
                </select>
              </div>
            )}
          </div>

          {cargando && <div style={{ textAlign:'center', padding:'3rem', color:'#9ca3af' }}>⏳ Cargando...</div>}

          {/* ── Lista ── */}
          {!cargando && tab==='lista' && (
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, overflow:'hidden' }}>
              {lista.length===0 ? (
                <div style={{ textAlign:'center', padding:'3rem', color:'#9ca3af', fontSize:14 }}>
                  {scope.length===0 ? `📭 Sin movimientos en ${labelPeriodo()}` : 'Sin resultados para los filtros'}
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
                        <td style={{ padding:'10px 14px', color:'#6b7280', fontSize:12 }}>{m.categoria}</td>
                        <td style={{ padding:'10px 14px', fontWeight:600, color:m.tipo==='ingreso'?'#1D9E75':'#E24B4A', whiteSpace:'nowrap' as const }}>
                          {m.tipo==='ingreso'?'+':'-'}{fmtCLP(m.monto)}
                        </td>
                        <td style={{ padding:'10px 14px' }}>
                          <button onClick={()=>handleConciliar(m.id,m.conciliado)} style={{ fontSize:11, padding:'2px 8px', borderRadius:999, fontWeight:500, cursor:'pointer', border:'none', background:m.conciliado?'#E1F5EE':'#FAEEDA', color:m.conciliado?'#085041':'#633806' }}>
                            {m.conciliado?'✓ OK':'⏳ Pendiente'}
                          </button>
                        </td>
                        <td style={{ padding:'10px 8px' }}>
                          <div style={{ display:'flex', gap:2 }}>
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
                      <td style={{ padding:'10px 14px', fontWeight:700, fontSize:13, color:'#111827' }}>
                        {fmtCLP(lista.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)-lista.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0))}
                      </td>
                      <td colSpan={2}/>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          )}

          {/* ── Resumen Mensual ── */}
          {!cargando && tab==='mensual' && (
            <>
              {/* Gráfico de barras mensual */}
              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20, marginBottom:14 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:14 }}>Ingresos vs gastos por mes</div>
                <div style={{ display:'flex', gap:10, marginBottom:14 }}>
                  {[{l:'Ingresos',c:'#1D9E75'},{l:'Gastos',c:'#E24B4A'}].map(e=>(
                    <span key={e.l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#6b7280' }}>
                      <span style={{ width:10, height:10, borderRadius:2, background:e.c, display:'inline-block' }}/>{e.l}
                    </span>
                  ))}
                </div>
                <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:160, overflowX:'auto', paddingBottom:4 }}>
                  {mensual.map(([key, val])=>{
                    const [y,m] = key.split('-')
                    const label = `${MESES_NOMBRE[parseInt(m)-1].slice(0,3)} ${y.slice(2)}`
                    const hI = Math.round(val.ing/maxMes*140)
                    const hG = Math.round(val.gas/maxMes*140)
                    const neto = val.ing - val.gas
                    return (
                      <div key={key} style={{ flex:'0 0 auto', width:56, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                        <div style={{ fontSize:9, fontWeight:600, color:neto>=0?'#1D9E75':'#E24B4A' }}>{fmtM(neto)}</div>
                        <div style={{ width:'100%', display:'flex', gap:2, alignItems:'flex-end' }}>
                          <div style={{ flex:1, height:hI, background:'#1D9E75', borderRadius:'2px 2px 0 0', minHeight:2 }}/>
                          <div style={{ flex:1, height:hG, background:'#E24B4A', borderRadius:'2px 2px 0 0', minHeight:2 }}/>
                        </div>
                        <div style={{ fontSize:9, color:'#9ca3af', textAlign:'center' }}>{label}</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Tabla mensual */}
              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, overflow:'hidden' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:'#fafafa' }}>
                      {['Mes','Ingresos','Gastos','Utilidad','Margen'].map(h=>(
                        <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontWeight:500, color:'#6b7280', borderBottom:'1px solid rgba(0,0,0,0.07)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mensual.map(([key,val],i)=>{
                      const [y,m] = key.split('-')
                      const label = `${MESES_NOMBRE[parseInt(m)-1]} ${y}`
                      const neto = val.ing - val.gas
                      const mg = val.ing > 0 ? Math.round(neto/val.ing*100) : 0
                      return (
                        <tr key={key} style={{ borderBottom:i<mensual.length-1?'1px solid rgba(0,0,0,0.06)':'none', cursor:'pointer' }}
                          onClick={()=>{ setMesSelec(parseInt(m)); setAnioSelec(parseInt(y)); setPeriodoTipo('mes'); setTab('lista') }}>
                          <td style={{ padding:'10px 14px', fontWeight:500, color:'#111827' }}>{label}</td>
                          <td style={{ padding:'10px 14px', fontWeight:600, color:'#1D9E75' }}>{fmtCLP(val.ing)}</td>
                          <td style={{ padding:'10px 14px', fontWeight:600, color:'#E24B4A' }}>{fmtCLP(val.gas)}</td>
                          <td style={{ padding:'10px 14px', fontWeight:700, color:neto>=0?'#3266ad':'#E24B4A' }}>{fmtCLP(neto)}</td>
                          <td style={{ padding:'10px 14px' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <div style={{ width:50, height:5, background:'#f1f5f9', borderRadius:3, overflow:'hidden' }}>
                                <div style={{ height:'100%', width:`${Math.max(0,Math.min(100,mg))}%`, background:mg>=30?'#1D9E75':mg>=15?'#EF9F27':'#E24B4A', borderRadius:3 }}/>
                              </div>
                              <span style={{ fontSize:12, fontWeight:500, color:mg>=30?'#1D9E75':mg>=15?'#EF9F27':'#E24B4A' }}>{mg}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background:'#f8f9fb', borderTop:'2px solid rgba(0,0,0,0.1)' }}>
                      <td style={{ padding:'10px 14px', fontWeight:700 }}>Total</td>
                      <td style={{ padding:'10px 14px', fontWeight:700, color:'#1D9E75' }}>{fmtCLP(mensual.reduce((a,[,v])=>a+v.ing,0))}</td>
                      <td style={{ padding:'10px 14px', fontWeight:700, color:'#E24B4A' }}>{fmtCLP(mensual.reduce((a,[,v])=>a+v.gas,0))}</td>
                      <td style={{ padding:'10px 14px', fontWeight:700, color:'#3266ad' }}>
                        {fmtCLP(mensual.reduce((a,[,v])=>a+v.ing-v.gas,0))}
                      </td>
                      <td/>
                    </tr>
                  </tfoot>
                </table>
                <div style={{ padding:'8px 14px', fontSize:11, color:'#9ca3af', background:'#f8f9fb' }}>
                  💡 Clic en un mes para ver su detalle
                </div>
              </div>
            </>
          )}

          {/* ── Por categoría ── */}
          {!cargando && tab==='categorias' && (
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:16 }}>
                Desglose por categoría — {labelPeriodo()}
              </div>
              {getResumenCats().length===0 ? (
                <div style={{ textAlign:'center', padding:'2rem', color:'#9ca3af' }}>Sin datos para este período</div>
              ) : getResumenCats().map(([cat,val])=>(
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
