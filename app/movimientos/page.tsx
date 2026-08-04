'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

type Movimiento = {
  id: string; empresa_id: string; tipo: 'ingreso'|'gasto'
  descripcion: string; categoria: string; monto: number
  fecha: string; referencia: string; conciliado: boolean; created_at?: string
}
type Empresa = { id: string; nombre_corto: string; color: string }

const CATEGORIAS_INGRESO = ['Ventas contado','Ventas crédito','Ventas débito','Transferencias recibidas','Otros ingresos']
const CATEGORIAS_GASTO   = ['Proveedores','Remuneraciones','Leyes sociales','Arriendos pagados','Impuestos','Tarjeta de crédito','Préstamos','Boletas de honorarios','Asesoría contable','Mantención','Comisión TUU','Controlfarma software','Seguridad','Agua Antofagasta','Servicios básicos','Gastos generales']
const MESES_NOMBRE = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const NAV = [
  { href:'/',             label:'Dashboard',    icon:'▦'  },
  { href:'/movimientos',  label:'Movimientos',  icon:'↕',  active:true },
  { href:'/caja',           label:'Caja',         icon:'💵' },
  { href:'/presupuesto',  label:'Presupuesto',  icon:'🎯' },
  { href:'/alertas',      label:'Alertas',      icon:'🔔' },
  { href:'/reportes',     label:'Reportes',     icon:'📄' },
  { href:'/estados',      label:'Est. Financ.', icon:'📑' },
  { href:'/bancos',       label:'Bancos',       icon:'🏦' },
  { href:'/tributario',   label:'Documentos',   icon:'🧾' },
  { href:'/proyecciones', label:'Proyecciones', icon:'📈' },
  { href:'/usuarios',     label:'Usuarios',     icon:'👥' },
  { href:'/asistencia',     label:'Asistencia',   icon:'🕐' },
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
  const router = useRouter()
  // ── Auth & Permisos ──
  const [userEmail,          setUserEmail]          = useState('')
  const [esAdmin,            setEsAdmin]            = useState(true)
  const [empresasPermitidas, setEmpresasPermitidas] = useState<string[]>([])
  const [authListo,          setAuthListo]          = useState(false)

  // ── Datos ──
  const [movimientos,   setMovimientos]   = useState<Movimiento[]>([])
  const [empresas,      setEmpresas]      = useState<Empresa[]>([])
  const [cargando,      setCargando]      = useState(false)
  const [guardando,     setGuardando]     = useState(false)
  const [empresaFiltro, setEmpresaFiltro] = useState('all')
  const [tipoFiltro,    setTipoFiltro]    = useState('all')
  const [busqueda,      setBusqueda]      = useState('')
  const [showForm,      setShowForm]      = useState(false)
  const [showImport,    setShowImport]    = useState(false)
  const [editId,        setEditId]        = useState<string|null>(null)
  const [tab,           setTab]           = useState<'lista'|'mensual'|'categorias'>('lista')
  const [error,         setError]         = useState('')

  // Período
  const hoy = new Date()
  const [periodoTipo, setPeriodoTipo] = useState<'mes'|'rango'|'todo'>('mes')
  const [mesSelec,    setMesSelec]    = useState(hoy.getMonth()+1)
  const [anioSelec,   setAnioSelec]   = useState(hoy.getFullYear())
  const [fechaDesde,  setFechaDesde]  = useState(`${hoy.getFullYear()}-01-01`)
  const [fechaHasta,  setFechaHasta]  = useState(hoy.toISOString().split('T')[0])

  // Import CSV
  const [csvPreview,   setCsvPreview]   = useState<any[]>([])
  const [csvError,     setCsvError]     = useState('')
  const [importando,   setImportando]   = useState(false)
  const [importResult, setImportResult] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Form
  const [fEmpresa, setFEmpresa] = useState('')
  const [fTipo,    setFTipo]    = useState<'ingreso'|'gasto'>('ingreso')
  const [fDesc,    setFDesc]    = useState('')
  const [fCat,     setFCat]     = useState(CATEGORIAS_INGRESO[0])
  const [fMonto,   setFMonto]   = useState('')
  const [fFecha,   setFFecha]   = useState(hoy.toISOString().split('T')[0])
  const [fRef,     setFRef]     = useState('')

  // ── STEP 1: Auth ──
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/login'); return }

      const email = session.user.email || ''
      setUserEmail(email)

      // Leer permisos
      const { data: perfil } = await supabase
        .from('usuarios_plataforma')
        .select('rol, empresas_permitidas')
        .eq('email', email)
        .single()
      const MODULOS_RESTRINGIDOS: Record<string,string[]> = { quimico: ['/caja','/asistencia'], auxiliar: ['/asistencia'] }
      if (perfil?.rol && MODULOS_RESTRINGIDOS[perfil.rol] && !MODULOS_RESTRINGIDOS[perfil.rol].includes('/movimientos')) {
        router.push(MODULOS_RESTRINGIDOS[perfil.rol][0]); return
      }

      let perms: string[] = []
      if (perfil && perfil.rol !== 'admin' && perfil.empresas_permitidas?.length > 0) {
        perms = perfil.empresas_permitidas
        setEsAdmin(false)
        setEmpresasPermitidas(perms)
      } else {
        setEsAdmin(true)
        setEmpresasPermitidas([])
      }

      // Auth listo → cargar datos con permisos
      setAuthListo(true)
      await cargarDatos(perms)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.push('/login')
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── STEP 2: Cargar datos con permisos ──
  async function cargarDatos(perms: string[]) {
    setCargando(true)
    setError('')
    try {
      // Empresas filtradas
      let qEmps = supabase.from('empresas').select('id,nombre_corto,color').eq('activa',true)
      if (perms.length > 0) qEmps = qEmps.in('id', perms)
      const { data: emps } = await qEmps.order('nombre_corto')

      if (emps && emps.length > 0) {
        setEmpresas(emps)
        setFEmpresa(emps[0].id)
      }

      // Movimientos filtrados
      let qMovs = supabase.from('movimientos').select('*')
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1000)
      if (perms.length > 0) qMovs = qMovs.in('empresa_id', perms)

      const { data: movs, error: errMovs } = await qMovs
      if (errMovs) throw errMovs
      setMovimientos(movs || [])
    } catch(e: any) {
      setError('Error conectando con la base de datos.')
    } finally { setCargando(false) }
  }

  async function cerrarSesion() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ── Filtrado período ──
  function enPeriodo(fecha: string) {
    if (periodoTipo==='todo') return true
    if (periodoTipo==='mes') {
      const [y,m] = fecha.split('-')
      return parseInt(y)===anioSelec && parseInt(m)===mesSelec
    }
    return fecha>=fechaDesde && fecha<=fechaHasta
  }

  const scope = movimientos.filter(m => {
    if (empresaFiltro!=='all' && m.empresa_id!==empresaFiltro) return false
    if (!enPeriodo(m.fecha)) return false
    return true
  })
  const lista = scope.filter(m => {
    if (tipoFiltro!=='all' && m.tipo!==tipoFiltro) return false
    if (busqueda && !m.descripcion.toLowerCase().includes(busqueda.toLowerCase()) &&
        !m.categoria.toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  })

  const totalIngresos = scope.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)
  const totalGastos   = scope.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0)
  const utilidad      = totalIngresos - totalGastos
  const margen        = totalIngresos>0 ? Math.round(utilidad/totalIngresos*100) : 0

  // Resumen mensual
  const porMes: Record<string,{ing:number;gas:number}> = {}
  movimientos.filter(m=>empresaFiltro==='all'||m.empresa_id===empresaFiltro).forEach(m => {
    const key = m.fecha.slice(0,7)
    if (!porMes[key]) porMes[key] = {ing:0,gas:0}
    if (m.tipo==='ingreso') porMes[key].ing += m.monto
    else porMes[key].gas += m.monto
  })
  const mensual = Object.entries(porMes).sort((a,b)=>a[0].localeCompare(b[0]))

  // Categorías
  const catMap: Record<string,{tipo:string;total:number;count:number}> = {}
  scope.forEach(m => {
    if (!catMap[m.categoria]) catMap[m.categoria] = {tipo:m.tipo,total:0,count:0}
    catMap[m.categoria].total += m.monto; catMap[m.categoria].count++
  })
  const cats = Object.entries(catMap).sort((a,b)=>b[1].total-a[1].total)
  const maxCat = Math.max(...cats.map(([,v])=>v.total),1)

  // CSV
  function parsearCSV(texto: string, empId: string) {
    setCsvError('')
    const lineas = texto.trim().split('\n').filter(l=>l.trim())
    if (lineas.length<2) { setCsvError('Archivo vacío'); return }
    const enc = lineas[0].split(',').map(h=>h.trim().toLowerCase().replace(/"/g,''))
    const filas: any[] = [], errs: string[] = []
    for (let i=1; i<lineas.length; i++) {
      const cols = lineas[i].split(',').map(c=>c.trim().replace(/"/g,''))
      const f: any = {}; enc.forEach((h,j)=>{ f[h]=cols[j]||'' })
      const tipo = f.tipo?.toLowerCase()
      const monto = parseFloat(f.monto)
      const desc = f.descripcion||f.desc||''
      if (!tipo||!['ingreso','gasto'].includes(tipo)) { errs.push(`Fila ${i+1}: tipo inválido`); continue }
      if (!monto||isNaN(monto)) { errs.push(`Fila ${i+1}: monto inválido`); continue }
      if (!desc) { errs.push(`Fila ${i+1}: sin descripción`); continue }
      filas.push({ empresa_id:f.empresa_id||empId, tipo, descripcion:desc, categoria:f.categoria||(tipo==='ingreso'?'Ventas contado':'Gastos generales'), monto:Math.abs(monto), fecha:f.fecha||hoy.toISOString().split('T')[0], referencia:f.referencia||'', conciliado:false })
    }
    if (errs.length>0) setCsvError(errs.slice(0,3).join(' · '))
    setCsvPreview(filas)
  }
  function handleArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => parsearCSV(ev.target?.result as string, fEmpresa)
    reader.readAsText(file)
  }
  async function importarCSV() {
    if (!csvPreview.length) return
    setImportando(true)
    try {
      for (let i=0; i<csvPreview.length; i+=50) {
        const { error } = await supabase.from('movimientos').insert(csvPreview.slice(i,i+50))
        if (error) throw error
      }
      setImportResult(`✅ ${csvPreview.length} movimientos importados`)
      setCsvPreview([]); if (fileRef.current) fileRef.current.value=''
      await cargarDatos(empresasPermitidas)
      setTimeout(()=>{ setShowImport(false); setImportResult('') },3000)
    } catch(e: any) { setImportResult('❌ Error: '+e.message) }
    finally { setImportando(false) }
  }
  function descargarPlantilla() {
    const empId = empresas[0]?.id||'UUID'
    const csv = ['empresa_id,tipo,descripcion,categoria,monto,fecha,referencia',
      `${empId},ingreso,Venta local,Ventas contado,150000,2026-06-01,BOL-001`,
      `${empId},gasto,Pago proveedor,Proveedores,80000,2026-06-02,F-1023`,
    ].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}))
    a.download = 'plantilla_movimientos.csv'; a.click()
  }

  // CRUD
  async function handleGuardar() {
    if (!fDesc||!fMonto) return
    setGuardando(true)
    const mov = { empresa_id:fEmpresa, tipo:fTipo, descripcion:fDesc, categoria:fCat, monto:parseFloat(fMonto)||0, fecha:fFecha, referencia:fRef, conciliado:false }
    try {
      if (editId) { const {error}=await supabase.from('movimientos').update(mov).eq('id',editId); if(error) throw error }
      else { const {error}=await supabase.from('movimientos').insert(mov); if(error) throw error }
      await cargarDatos(empresasPermitidas); resetForm()
    } catch(e: any) { setError('Error: '+e.message) }
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

  if (!authListo) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'DM Sans, sans-serif', color:'#767676' }}>
      ⏳ Verificando acceso...
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#0B0B0C', fontFamily:'DM Sans, sans-serif' }}>

      {/* Sidebar */}
      <input type="checkbox" id="sidebarToggle" className="sidebar-toggle-input no-print" />
      <label htmlFor="sidebarToggle" className="sidebar-toggle-btn no-print" aria-label="Abrir menu">☰</label>
      <label htmlFor="sidebarToggle" className="sidebar-overlay no-print"></label>
      <div className="app-sidebar" style={{ position:'fixed', top:0, left:0, width:220, height:'100vh', background:'#161616', borderRight:'1px solid rgba(255,255,255,0.08)', display:'flex', flexDirection:'column', padding:'0 12px 16px', zIndex:100, overflowY:'auto' }}>
        <div style={{ height:56, display:'flex', alignItems:'center', borderBottom:'1px solid rgba(255,255,255,0.08)', marginBottom:12, marginLeft:-12, marginRight:-12, paddingLeft:20, fontSize:15, fontWeight:600, color:'#B8912E' }}>
          📊 Finanzas Grupo
        </div>
        {NAV.map(item=>(
          <Link key={item.href} href={item.href} style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px', borderRadius:8, fontSize:13.5, color:(item as any).active?'#B8912E':'#9A9A9A', background:(item as any).active?'rgba(184,145,46,0.16)':'transparent', fontWeight:(item as any).active?500:400, textDecoration:'none', marginBottom:2 }}>
            <span style={{ fontSize:15 }}>{item.icon}</span>{item.label}
          </Link>
        ))}
        <div style={{ marginTop:'auto', paddingTop:12, borderTop:'1px solid rgba(255,255,255,0.08)' }}>
          {!esAdmin && empresasPermitidas.length>0 && (
            <div style={{ fontSize:10, color:'#BA7517', padding:'4px 10px', background:'rgba(186,117,23,0.18)', borderRadius:6, marginBottom:6, textAlign:'center' }}>🔒 Vista restringida</div>
          )}
          <div style={{ fontSize:11, color:'#767676', marginBottom:4, padding:'0 10px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{userEmail}</div>
          <button onClick={cerrarSesion} style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'8px 10px', borderRadius:8, fontSize:13, color:'#E24B4A', background:'transparent', border:'none', cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
            🚪 Cerrar sesión
          </button>
        </div>
      </div>

      <div className="app-content" style={{ marginLeft:220 }}>
        {/* Header */}
        <div className="app-header" style={{ height:56, background:'#161616', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 28px', position:'sticky', top:0, zIndex:50 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:15, fontWeight:600 }}>Movimientos</div>
            {!cargando && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:'rgba(29,158,117,0.16)', color:'#1D9E75', fontWeight:500 }}>🟢 Supabase</span>}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <select value={empresaFiltro} onChange={e=>setEmpresaFiltro(e.target.value)} style={sel}>
              <option value="all">{esAdmin?'Todas las empresas':'Mis empresas'}</option>
              {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre_corto}</option>)}
            </select>
            <button onClick={()=>{ setShowImport(!showImport); setShowForm(false) }} style={{ ...btnSec, width:'auto', padding:'7px 12px', fontSize:12 }}>📥 CSV</button>
            <button onClick={()=>{ resetForm(); setShowForm(true); setShowImport(false) }} style={btnP}>+ Nuevo</button>
          </div>
        </div>

        <div className="app-main" style={{ padding:'24px 28px' }}>
          {error && (
            <div style={{ background:'rgba(226,75,74,0.16)', border:'1px solid rgba(226,75,74,0.22)', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#E24B4A', marginBottom:16, display:'flex', justifyContent:'space-between' }}>
              <span>⚠️ {error}</span>
              <button onClick={()=>setError('')} style={{ background:'transparent', border:'none', cursor:'pointer', color:'#E24B4A' }}>✕</button>
            </div>
          )}

          {/* Filtro período */}
          <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:'14px 18px', marginBottom:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              <span style={{ fontSize:12, fontWeight:600, color:'#9A9A9A' }}>📅 Período:</span>
              <div style={{ display:'flex', gap:4 }}>
                {([{k:'mes',l:'Por mes'},{k:'rango',l:'Rango'},{k:'todo',l:'Todo'}] as const).map(p=>(
                  <button key={p.k} onClick={()=>setPeriodoTipo(p.k)} style={{ padding:'4px 10px', borderRadius:6, fontSize:12, cursor:'pointer', border:'1px solid rgba(255,255,255,0.1)', background:periodoTipo===p.k?'#B8912E':'#161616', color:periodoTipo===p.k?'#fff':'#9A9A9A' }}>
                    {p.l}
                  </button>
                ))}
              </div>
              {periodoTipo==='mes' && (
                <>
                  <select value={mesSelec} onChange={e=>setMesSelec(parseInt(e.target.value))} style={sel}>
                    {MESES_NOMBRE.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                  <select value={anioSelec} onChange={e=>setAnioSelec(parseInt(e.target.value))} style={sel}>
                    {[2024,2025,2026,2027].map(a=><option key={a}>{a}</option>)}
                  </select>
                  <div style={{ display:'flex', gap:4, marginLeft:'auto', flexWrap:'wrap' }}>
                    {['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].map((m,i)=>(
                      <button key={i} onClick={()=>{ setMesSelec(i+1); setAnioSelec(2026) }} style={{ padding:'3px 7px', borderRadius:5, fontSize:11, cursor:'pointer', border:'1px solid rgba(255,255,255,0.1)', background:mesSelec===i+1&&anioSelec===2026?'rgba(184,145,46,0.16)':'#161616', color:mesSelec===i+1&&anioSelec===2026?'#B8912E':'#767676', fontWeight:mesSelec===i+1&&anioSelec===2026?600:400 }}>
                        {m}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {periodoTipo==='rango' && (
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <input type="date" value={fechaDesde} onChange={e=>setFechaDesde(e.target.value)} style={{ ...sel, padding:'5px 8px' }}/>
                  <span style={{ fontSize:12, color:'#9A9A9A' }}>hasta</span>
                  <input type="date" value={fechaHasta} onChange={e=>setFechaHasta(e.target.value)} style={{ ...sel, padding:'5px 8px' }}/>
                </div>
              )}
            </div>
          </div>

          {/* Métricas */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12, marginBottom:20 }}>
            {[
              { label:'Ingresos', value:fmtM(totalIngresos), sub:labelPeriodo(), color:'#1D9E75', bg:'rgba(29,158,117,0.16)' },
              { label:'Gastos',   value:fmtM(totalGastos),   sub:labelPeriodo(), color:'#E24B4A', bg:'rgba(226,75,74,0.16)' },
              { label:'Utilidad', value:fmtM(utilidad),      sub:`Margen ${margen}%`, color:utilidad>=0?'#B8912E':'#E24B4A', bg:'rgba(184,145,46,0.16)' },
              { label:'Registros',value:scope.length.toString(), sub:`${scope.filter(m=>!m.conciliado).length} pendientes`, color:'#BA7517', bg:'rgba(186,117,23,0.18)' },
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
            <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:20, marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{ fontSize:14, fontWeight:600 }}>📥 Importar CSV</div>
                <button onClick={()=>{ setShowImport(false); setCsvPreview([]) }} style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:18, color:'#767676' }}>✕</button>
              </div>
              <div style={{ background:'rgba(184,145,46,0.16)', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#B8912E', marginBottom:12 }}>
                Columnas: <strong>tipo</strong> (ingreso/gasto), <strong>descripcion</strong>, <strong>monto</strong>, <strong>fecha</strong> (AAAA-MM-DD)
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                <div><label style={lbl}>Empresa por defecto</label>
                  <select value={fEmpresa} onChange={e=>setFEmpresa(e.target.value)} style={inp}>
                    {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre_corto}</option>)}
                  </select>
                </div>
                <div style={{ display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
                  <button onClick={descargarPlantilla} style={{ ...btnSec, width:'100%' }}>⬇️ Descargar plantilla</button>
                </div>
              </div>
              <input ref={fileRef} type="file" accept=".csv" onChange={handleArchivo}
                style={{ display:'block', fontSize:13, padding:8, border:'1px dashed #4A4A4A', borderRadius:8, width:'100%', background:'#1A1A1A', cursor:'pointer', marginBottom:10 }}/>
              {csvError && <div style={{ background:'rgba(186,117,23,0.18)', borderRadius:8, padding:'6px 10px', fontSize:12, color:'#BA7517', marginBottom:10 }}>⚠️ {csvError}</div>}
              {csvPreview.length>0 && (
                <>
                  <div style={{ fontSize:13, fontWeight:500, marginBottom:8 }}>{csvPreview.length} movimientos listos</div>
                  {importResult && <div style={{ background:importResult.startsWith('✅')?'rgba(29,158,117,0.14)':'rgba(226,75,74,0.16)', borderRadius:8, padding:'7px 10px', fontSize:13, color:importResult.startsWith('✅')?'#1D9E75':'#E24B4A', marginBottom:10 }}>{importResult}</div>}
                  <button onClick={importarCSV} disabled={importando} style={{ ...btnP, width:'100%', justifyContent:'center', opacity:importando?0.7:1 }}>
                    {importando?'⏳ Importando...': `✅ Importar ${csvPreview.length} movimientos`}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Form */}
          {showForm && (
            <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:20, marginBottom:20 }}>
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
                <div><label style={lbl}>Referencia</label><input value={fRef} onChange={e=>setFRef(e.target.value)} placeholder="F-1023..." style={inp}/></div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={handleGuardar} disabled={guardando} style={{ ...btnP, flex:1, justifyContent:'center', opacity:guardando?0.7:1 }}>
                  {guardando?'Guardando...':editId?'💾 Guardar':'✅ Agregar'}
                </button>
                <button onClick={resetForm} style={{ ...btnSec, width:'auto', padding:'8px 16px' }}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
            {([{k:'lista',l:'≡ Lista'},{k:'mensual',l:'📅 Resumen mensual'},{k:'categorias',l:'⬛ Por categoría'}] as const).map(t=>(
              <button key={t.k} onClick={()=>setTab(t.k)} style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer', border:'1px solid rgba(255,255,255,0.1)', background:tab===t.k?'rgba(184,145,46,0.16)':'#161616', color:tab===t.k?'#B8912E':'#9A9A9A', fontWeight:tab===t.k?500:400 }}>
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

          {cargando && <div style={{ textAlign:'center', padding:'3rem', color:'#767676' }}>⏳ Cargando...</div>}

          {/* Lista */}
          {!cargando && tab==='lista' && (
            <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, overflow:'hidden' }}>
              {lista.length===0 ? (
                <div style={{ textAlign:'center', padding:'3rem', color:'#767676', fontSize:14 }}>
                  {movimientos.length===0 ? '📭 Sin movimientos — agrega uno o importa un CSV' : 'Sin resultados'}
                </div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:'#1A1A1A' }}>
                      {['Fecha','Empresa','Descripción','Categoría','Monto','Estado',''].map(h=>(
                        <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontWeight:500, color:'#9A9A9A', borderBottom:'1px solid rgba(255,255,255,0.08)', whiteSpace:'nowrap' as const }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((m,i)=>(
                      <tr key={m.id} style={{ borderBottom:i<lista.length-1?'1px solid rgba(255,255,255,0.06)':'none' }}>
                        <td style={{ padding:'10px 14px', color:'#9A9A9A', whiteSpace:'nowrap' as const }}>{m.fecha}</td>
                        <td style={{ padding:'10px 14px' }}>
                          <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
                            <span style={{ width:8, height:8, borderRadius:'50%', background:empColor(m.empresa_id), flexShrink:0 }}/>
                            <span style={{ fontSize:12, fontWeight:500, color:empColor(m.empresa_id) }}>{empNombre(m.empresa_id)}</span>
                          </span>
                        </td>
                        <td style={{ padding:'10px 14px' }}>
                          <div style={{ fontWeight:500, color:'#F0EFEA' }}>{m.descripcion}</div>
                          {m.referencia && <div style={{ fontSize:11, color:'#767676' }}>{m.referencia}</div>}
                        </td>
                        <td style={{ padding:'10px 14px', color:'#9A9A9A', fontSize:12 }}>{m.categoria}</td>
                        <td style={{ padding:'10px 14px', fontWeight:600, color:m.tipo==='ingreso'?'#1D9E75':'#E24B4A', whiteSpace:'nowrap' as const }}>
                          {m.tipo==='ingreso'?'+':'-'}{fmtCLP(m.monto)}
                        </td>
                        <td style={{ padding:'10px 14px' }}>
                          <button onClick={()=>handleConciliar(m.id,m.conciliado)} style={{ fontSize:11, padding:'2px 8px', borderRadius:999, fontWeight:500, cursor:'pointer', border:'none', background:m.conciliado?'rgba(29,158,117,0.16)':'rgba(186,117,23,0.18)', color:m.conciliado?'#1D9E75':'#BA7517' }}>
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
                    <tr style={{ background:'#0B0B0C', borderTop:'1px solid rgba(255,255,255,0.08)' }}>
                      <td colSpan={4} style={{ padding:'10px 14px', fontSize:12, color:'#9A9A9A', fontWeight:500 }}>{lista.length} movimientos</td>
                      <td style={{ padding:'10px 14px', fontWeight:700, fontSize:13, color:'#F0EFEA' }}>
                        {fmtCLP(lista.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)-lista.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0))}
                      </td>
                      <td colSpan={2}/>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          )}

          {/* Resumen mensual */}
          {!cargando && tab==='mensual' && (
            <>
              <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:20, marginBottom:14 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#9A9A9A', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:14 }}>Ingresos vs gastos por mes</div>
                <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:140, overflowX:'auto' }}>
                  {mensual.map(([key,val])=>{
                    const [y,m] = key.split('-')
                    const maxV = Math.max(...mensual.map(([,v])=>Math.max(v.ing,v.gas)),1)
                    const hI = Math.round(val.ing/maxV*120)
                    const hG = Math.round(val.gas/maxV*120)
                    const neto = val.ing-val.gas
                    return (
                      <div key={key} style={{ flex:'0 0 auto', width:56, display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'pointer' }}
                        onClick={()=>{ const mo=parseInt(m); setMesSelec(mo); setAnioSelec(parseInt(y)); setPeriodoTipo('mes'); setTab('lista') }}>
                        <div style={{ fontSize:9, color:neto>=0?'#1D9E75':'#E24B4A', fontWeight:600 }}>{fmtM(neto)}</div>
                        <div style={{ width:'100%', display:'flex', gap:2, alignItems:'flex-end' }}>
                          <div style={{ flex:1, height:Math.max(hI,2), background:'#1D9E75', borderRadius:'2px 2px 0 0' }}/>
                          <div style={{ flex:1, height:Math.max(hG,2), background:'#E24B4A', borderRadius:'2px 2px 0 0' }}/>
                        </div>
                        <div style={{ fontSize:9, color:'#767676', textAlign:'center' }}>{MESES_NOMBRE[parseInt(m)-1].slice(0,3)} {y.slice(2)}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, overflow:'hidden' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:'#1A1A1A' }}>
                      {['Mes','Ingresos','Gastos','Utilidad','Margen'].map(h=>(
                        <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontWeight:500, color:'#9A9A9A', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mensual.map(([key,val],i)=>{
                      const [y,m] = key.split('-')
                      const neto = val.ing-val.gas
                      const mg = val.ing>0 ? Math.round(neto/val.ing*100) : 0
                      return (
                        <tr key={key} style={{ borderBottom:i<mensual.length-1?'1px solid rgba(255,255,255,0.06)':'none', cursor:'pointer' }}
                          onClick={()=>{ setMesSelec(parseInt(m)); setAnioSelec(parseInt(y)); setPeriodoTipo('mes'); setTab('lista') }}>
                          <td style={{ padding:'10px 14px', fontWeight:500 }}>{MESES_NOMBRE[parseInt(m)-1]} {y}</td>
                          <td style={{ padding:'10px 14px', color:'#1D9E75', fontWeight:600 }}>{fmtCLP(val.ing)}</td>
                          <td style={{ padding:'10px 14px', color:'#E24B4A' }}>{fmtCLP(val.gas)}</td>
                          <td style={{ padding:'10px 14px', fontWeight:700, color:neto>=0?'#B8912E':'#E24B4A' }}>{fmtCLP(neto)}</td>
                          <td style={{ padding:'10px 14px' }}>
                            <span style={{ fontSize:12, fontWeight:500, color:mg>=30?'#1D9E75':mg>=15?'#EF9F27':'#E24B4A' }}>{mg}%</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background:'#0B0B0C', borderTop:'2px solid rgba(255,255,255,0.08)' }}>
                      <td style={{ padding:'10px 14px', fontWeight:700 }}>Total</td>
                      <td style={{ padding:'10px 14px', fontWeight:700, color:'#1D9E75' }}>{fmtCLP(mensual.reduce((a,[,v])=>a+v.ing,0))}</td>
                      <td style={{ padding:'10px 14px', fontWeight:700, color:'#E24B4A' }}>{fmtCLP(mensual.reduce((a,[,v])=>a+v.gas,0))}</td>
                      <td style={{ padding:'10px 14px', fontWeight:700, color:'#B8912E' }}>{fmtCLP(mensual.reduce((a,[,v])=>a+v.ing-v.gas,0))}</td>
                      <td/>
                    </tr>
                  </tfoot>
                </table>
                <div style={{ padding:'8px 14px', fontSize:11, color:'#767676', background:'#141414' }}>💡 Clic en un mes para ver su detalle</div>
              </div>
            </>
          )}

          {/* Por categoría */}
          {!cargando && tab==='categorias' && (
            <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:20 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#9A9A9A', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:16 }}>
                Desglose por categoría — {labelPeriodo()}
              </div>
              {cats.length===0 ? (
                <div style={{ textAlign:'center', padding:'2rem', color:'#767676' }}>Sin datos para este período</div>
              ) : cats.map(([cat,val])=>(
                <div key={cat} style={{ marginBottom:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:11, padding:'1px 7px', borderRadius:999, fontWeight:500, background:val.tipo==='ingreso'?'rgba(29,158,117,0.16)':'rgba(226,75,74,0.16)', color:val.tipo==='ingreso'?'#1D9E75':'#E24B4A' }}>{val.tipo}</span>
                      <span style={{ fontSize:13, fontWeight:500, color:'#F0EFEA' }}>{cat}</span>
                      <span style={{ fontSize:11, color:'#767676' }}>{val.count} mov.</span>
                    </div>
                    <span style={{ fontSize:14, fontWeight:600, color:val.tipo==='ingreso'?'#1D9E75':'#E24B4A' }}>{fmtCLP(val.total)}</span>
                  </div>
                  <div style={{ height:7, background:'#1F1F1F', borderRadius:4, overflow:'hidden' }}>
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

const sel: React.CSSProperties     = { fontSize:13, padding:'6px 10px', border:'1px solid rgba(255,255,255,0.14)', borderRadius:8, background:'#161616' }
const btnP: React.CSSProperties    = { display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, border:'none', background:'#B8912E', color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer' }
const btnSec: React.CSSProperties  = { display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'7px 14px', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', border:'1px solid rgba(255,255,255,0.14)', background:'#161616', color:'#C9C9C9', width:'100%' }
const lbl: React.CSSProperties     = { display:'block', fontSize:12, fontWeight:500, color:'#9A9A9A', marginBottom:4 }
const inp: React.CSSProperties     = { width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid rgba(255,255,255,0.16)', borderRadius:8, background:'#161616', color:'#F0EFEA', fontFamily:'DM Sans, sans-serif' }
const iconBtn: React.CSSProperties = { background:'transparent', border:'none', cursor:'pointer', padding:'4px 6px', borderRadius:6, fontSize:14 }
