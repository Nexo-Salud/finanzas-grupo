'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

// ── Cliente Supabase ───────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// ── Tipos ──────────────────────────────────────────────────────
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

// ── Helpers ────────────────────────────────────────────────────
function fmtM(n: number) {
  const a = Math.abs(n), s = n < 0 ? '-' : ''
  if (a >= 1e6) return s+'$'+(Math.round(a/1e5)/10)+'M'
  if (a >= 1000) return s+'$'+Math.round(a/1000)+'K'
  return s+'$'+Math.round(a)
}
function fmtCLP(n: number) {
  return (n<0?'-':'')+'$'+Math.round(Math.abs(n)).toLocaleString('es-CL')
}

// ── Empresas por defecto si Supabase está vacío ────────────────
const EMPRESAS_DEFAULT: Empresa[] = [
  { id:'A', nombre_corto:'Empresa A', color:'#3266ad' },
  { id:'B', nombre_corto:'Empresa B', color:'#1D9E75' },
  { id:'C', nombre_corto:'Empresa C', color:'#BA7517' },
]

// ── Componente principal ───────────────────────────────────────
export default function MovimientosPage() {
  const [movimientos,  setMovimientos]  = useState<Movimiento[]>([])
  const [empresas,     setEmpresas]     = useState<Empresa[]>(EMPRESAS_DEFAULT)
  const [cargando,     setCargando]     = useState(true)
  const [guardando,    setGuardando]    = useState(false)
  const [empresaFiltro,setEmpresaFiltro]= useState('all')
  const [tipoFiltro,   setTipoFiltro]   = useState('all')
  const [busqueda,     setBusqueda]     = useState('')
  const [showForm,     setShowForm]     = useState(false)
  const [editId,       setEditId]       = useState<string|null>(null)
  const [tab,          setTab]          = useState<'lista'|'resumen'>('lista')
  const [error,        setError]        = useState('')

  // Form state
  const [fEmpresa, setFEmpresa] = useState('A')
  const [fTipo,    setFTipo]    = useState<'ingreso'|'gasto'>('ingreso')
  const [fDesc,    setFDesc]    = useState('')
  const [fCat,     setFCat]     = useState(CATEGORIAS_INGRESO[0])
  const [fMonto,   setFMonto]   = useState('')
  const [fFecha,   setFFecha]   = useState(new Date().toISOString().split('T')[0])
  const [fRef,     setFRef]     = useState('')

  // ── Cargar datos al inicio ──
  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setCargando(true)
    setError('')
    try {
      // Cargar empresas
      const { data: emps, error: errEmps } = await supabase
        .from('empresas')
        .select('id, nombre_corto, color')
        .eq('activa', true)
        .order('nombre_corto')

      if (!errEmps && emps && emps.length > 0) {
        setEmpresas(emps)
        setFEmpresa(emps[0].id)
      }

      // Cargar movimientos
      const { data: movs, error: errMovs } = await supabase
        .from('movimientos')
        .select('*')
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200)

      if (errMovs) throw errMovs
      setMovimientos(movs || [])
    } catch (e: any) {
      setError('Error conectando con la base de datos. Verifica las variables de entorno en Vercel.')
      console.error(e)
    } finally {
      setCargando(false)
    }
  }

  // ── Filtrado ──
  const lista = movimientos.filter(m => {
    if (empresaFiltro !== 'all' && m.empresa_id !== empresaFiltro) return false
    if (tipoFiltro !== 'all' && m.tipo !== tipoFiltro) return false
    if (busqueda && !m.descripcion.toLowerCase().includes(busqueda.toLowerCase()) &&
        !m.categoria.toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  })

  // ── Métricas ──
  const scope = empresaFiltro === 'all' ? movimientos : movimientos.filter(m => m.empresa_id === empresaFiltro)
  const totalIngresos = scope.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)
  const totalGastos   = scope.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0)
  const utilidad      = totalIngresos - totalGastos
  const pendientes    = scope.filter(m=>!m.conciliado).length

  // ── Guardar movimiento ──
  async function handleGuardar() {
    if (!fDesc || !fMonto) return
    setGuardando(true)
    const mov = {
      empresa_id:  fEmpresa,
      tipo:        fTipo,
      descripcion: fDesc,
      categoria:   fCat,
      monto:       parseFloat(fMonto) || 0,
      fecha:       fFecha,
      referencia:  fRef,
      conciliado:  false,
    }
    try {
      if (editId) {
        const { error } = await supabase.from('movimientos').update(mov).eq('id', editId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('movimientos').insert(mov)
        if (error) throw error
      }
      await cargarDatos()
      resetForm()
    } catch (e: any) {
      setError('Error guardando: ' + e.message)
    } finally {
      setGuardando(false)
    }
  }

  // ── Eliminar ──
  async function handleEliminar(id: string) {
    try {
      const { error } = await supabase.from('movimientos').delete().eq('id', id)
      if (error) throw error
      setMovimientos(prev => prev.filter(m => m.id !== id))
    } catch (e: any) {
      setError('Error eliminando: ' + e.message)
    }
  }

  // ── Conciliar ──
  async function handleConciliar(id: string, actual: boolean) {
    try {
      const { error } = await supabase.from('movimientos').update({ conciliado: !actual }).eq('id', id)
      if (error) throw error
      setMovimientos(prev => prev.map(m => m.id === id ? {...m, conciliado: !actual} : m))
    } catch (e: any) {
      setError('Error actualizando: ' + e.message)
    }
  }

  function handleEditar(m: Movimiento) {
    setEditId(m.id)
    setFEmpresa(m.empresa_id)
    setFTipo(m.tipo)
    setFDesc(m.descripcion)
    setFCat(m.categoria)
    setFMonto(m.monto.toString())
    setFFecha(m.fecha)
    setFRef(m.referencia || '')
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setShowForm(false); setEditId(null)
    setFDesc(''); setFMonto(''); setFRef('')
    setFTipo('ingreso'); setFCat(CATEGORIAS_INGRESO[0])
    setFFecha(new Date().toISOString().split('T')[0])
  }

  // ── Resumen por categoría ──
  const resumenCats = () => {
    const map: Record<string,{tipo:string;total:number;count:number}> = {}
    scope.forEach(m => {
      if (!map[m.categoria]) map[m.categoria] = { tipo: m.tipo, total: 0, count: 0 }
      map[m.categoria].total += m.monto
      map[m.categoria].count++
    })
    return Object.entries(map).sort((a,b) => b[1].total - a[1].total)
  }
  const maxCat = Math.max(...resumenCats().map(([,v])=>v.total), 1)

  const empColor = (id: string) => empresas.find(e=>e.id===id)?.color || '#888780'
  const empNombre = (id: string) => empresas.find(e=>e.id===id)?.nombre_corto || id

  return (
    <div style={{ minHeight:'100vh', background:'#f8f9fb', fontFamily:'DM Sans, sans-serif' }}>

      {/* Sidebar */}
      <div style={{ position:'fixed', top:0, left:0, width:220, height:'100vh', background:'#fff', borderRight:'1px solid rgba(0,0,0,0.08)', display:'flex', flexDirection:'column', padding:'0 12px 16px', zIndex:100, overflowY:'auto' }}>
        <div style={{ height:56, display:'flex', alignItems:'center', borderBottom:'1px solid rgba(0,0,0,0.08)', marginBottom:12, marginLeft:-12, marginRight:-12, paddingLeft:20, fontSize:15, fontWeight:600, color:'#3266ad' }}>
          📊 Finanzas Grupo
        </div>
        {NAV.map(item => (
          <Link key={item.href} href={item.href} style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px', borderRadius:8, fontSize:13.5, color:(item as any).active?'#3266ad':'#6b7280', background:(item as any).active?'#eff4ff':'transparent', fontWeight:(item as any).active?500:400, textDecoration:'none', marginBottom:2 }}>
            <span style={{ fontSize:15 }}>{item.icon}</span>{item.label}
          </Link>
        ))}
      </div>

      {/* Contenido */}
      <div style={{ marginLeft:220 }}>

        {/* Header */}
        <div style={{ height:56, background:'#fff', borderBottom:'1px solid rgba(0,0,0,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 28px', position:'sticky', top:0, zIndex:50 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:15, fontWeight:600 }}>Movimientos</div>
            {cargando && <span style={{ fontSize:12, color:'#9ca3af' }}>Cargando...</span>}
            {!cargando && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:'#E1F5EE', color:'#085041', fontWeight:500 }}>🟢 Conectado a Supabase</span>}
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <select value={empresaFiltro} onChange={e=>setEmpresaFiltro(e.target.value)} style={sel}>
              <option value="all">Todas las empresas</option>
              {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre_corto}</option>)}
            </select>
            <button onClick={()=>{ resetForm(); setShowForm(true) }} style={btnP}>+ Nuevo movimiento</button>
          </div>
        </div>

        <div style={{ padding:'24px 28px' }}>

          {/* Error */}
          {error && (
            <div style={{ background:'#FCEBEB', border:'1px solid #F09595', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#791F1F', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>⚠️ {error}</span>
              <button onClick={()=>setError('')} style={{ background:'transparent', border:'none', cursor:'pointer', color:'#791F1F', fontSize:16 }}>✕</button>
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

          {/* Formulario */}
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
                  <input value={fDesc} onChange={e=>setFDesc(e.target.value)} placeholder="Descripción del movimiento" style={inp}/>
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
                  <input value={fRef} onChange={e=>setFRef(e.target.value)} placeholder="F-1023, BOL-055..." style={inp}/>
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={handleGuardar} disabled={guardando} style={{ ...btnP, flex:1, justifyContent:'center', opacity:guardando?0.7:1 }}>
                  {guardando ? 'Guardando...' : editId ? '💾 Guardar cambios' : '✅ Agregar movimiento'}
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

          {/* Estado cargando */}
          {cargando && (
            <div style={{ textAlign:'center', padding:'3rem', color:'#9ca3af', fontSize:14 }}>
              ⏳ Cargando movimientos desde Supabase...
            </div>
          )}

          {/* ── Lista ── */}
          {!cargando && tab==='lista' && (
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, overflow:'hidden' }}>
              {lista.length===0 ? (
                <div style={{ textAlign:'center', padding:'3rem', color:'#9ca3af', fontSize:14 }}>
                  {movimientos.length===0 ? '📭 Sin movimientos aún — agrega el primero' : 'Sin resultados para los filtros seleccionados'}
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
                          {m.referencia && <div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>{m.referencia}</div>}
                        </td>
                        <td style={{ padding:'10px 14px', color:'#6b7280' }}>{m.categoria}</td>
                        <td style={{ padding:'10px 14px', fontWeight:600, color:m.tipo==='ingreso'?'#1D9E75':'#E24B4A', whiteSpace:'nowrap' as const }}>
                          {m.tipo==='ingreso'?'+':'-'}{fmtCLP(m.monto)}
                        </td>
                        <td style={{ padding:'10px 14px' }}>
                          <button onClick={()=>handleConciliar(m.id, m.conciliado)} style={{ fontSize:11, padding:'2px 8px', borderRadius:999, fontWeight:500, cursor:'pointer', border:'none', background:m.conciliado?'#E1F5EE':'#FAEEDA', color:m.conciliado?'#085041':'#633806' }}>
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
                      <td colSpan={4} style={{ padding:'10px 14px', fontSize:12, color:'#6b7280', fontWeight:500 }}>
                        {lista.length} movimientos
                      </td>
                      <td style={{ padding:'10px 14px', fontWeight:600, fontSize:13, color:'#111827' }}>
                        {fmtCLP(lista.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0) - lista.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0))}
                      </td>
                      <td colSpan={2}/>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          )}

          {/* ── Resumen por categoría ── */}
          {!cargando && tab==='resumen' && (
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:16 }}>
                Desglose por categoría
              </div>
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
