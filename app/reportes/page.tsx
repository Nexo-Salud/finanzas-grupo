'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

const NAV = [
  { href:'/',             label:'Dashboard',    icon:'▦'  },
  { href:'/movimientos',  label:'Movimientos',  icon:'↕'  },
  { href:'/presupuesto',  label:'Presupuesto',  icon:'🎯' },
  { href:'/alertas',      label:'Alertas',      icon:'🔔' },
  { href:'/reportes',     label:'Reportes',     icon:'📄', active:true },
  { href:'/estados',      label:'Est. Financ.', icon:'📑' },
  { href:'/bancos',       label:'Bancos',       icon:'🏦' },
  { href:'/tributario',   label:'Documentos',   icon:'🧾' },
  { href:'/proyecciones', label:'Proyecciones', icon:'📈' },
  { href:'/usuarios',     label:'Usuarios',     icon:'👥' },
  { href:'/kpis',         label:'KPIs',         icon:'📊' },
  { href:'/ia',           label:'Análisis IA',  icon:'🧠' },
]

const MESES_NOMBRE = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

type Empresa = { id: string; nombre_corto: string; nombre: string; color: string; rut?: string }
type Mov     = { empresa_id: string; tipo: string; monto: number; fecha: string; categoria: string }

function fmtM(n: number) {
  const a=Math.abs(n),s=n<0?'-':''
  if(a>=1e6) return s+'$'+(Math.round(a/1e5)/10)+'M'
  if(a>=1000) return s+'$'+Math.round(a/1000)+'K'
  return s+'$'+Math.round(a)
}
function fmtCLP(n: number) { return (n<0?'-':'')+'$'+Math.round(Math.abs(n)).toLocaleString('es-CL') }

export default function ReportesPage() {
  const router = useRouter()
  const [userEmail,          setUserEmail]          = useState('')
  const [esAdmin,            setEsAdmin]            = useState(true)
  const [empresasPermitidas, setEmpresasPermitidas] = useState<string[]>([])
  const [authListo,          setAuthListo]          = useState(false)
  const [empresas,    setEmpresas]    = useState<Empresa[]>([])
  const [movimientos, setMovimientos] = useState<Mov[]>([])
  const [cargando,    setCargando]    = useState(false)
  const [tab,         setTab]         = useState<'nuevo'|'preview'>('nuevo')
  const hoy = new Date()
  const [empresa,  setEmpresa]  = useState('all')
  const [mes,      setMes]      = useState(hoy.getMonth()+1)
  const [anio,     setAnio]     = useState(hoy.getFullYear())
  const [autor,    setAutor]    = useState('')
  const [incluirCats,    setIncluirCats]    = useState(true)
  const [incluirMensual, setIncluirMensual] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      const email = session.user.email || ''
      setUserEmail(email)
      const { data: perfil } = await supabase
        .from('usuarios_plataforma').select('rol,empresas_permitidas').eq('email',email).single()
      let perms: string[] = []
      if (perfil && perfil.rol !== 'admin' && perfil.empresas_permitidas?.length > 0) {
        perms = perfil.empresas_permitidas; setEsAdmin(false); setEmpresasPermitidas(perms)
      } else { setEsAdmin(true); setEmpresasPermitidas([]) }
      setAuthListo(true)
      await cargarDatos(perms)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.push('/login')
    })
    return () => subscription.unsubscribe()
  }, [])

  async function cerrarSesion() { await supabase.auth.signOut(); router.push('/login') }

  async function cargarDatos(perms: string[] = []) {
    setCargando(true)
    try {
      let qE = supabase.from('empresas').select('id,nombre_corto,nombre,color,rut').eq('activa',true)
      if (perms.length > 0) qE = qE.in('id', perms)
      const { data: emps } = await qE.order('nombre_corto')
      let qM = supabase.from('movimientos').select('empresa_id,tipo,monto,fecha,categoria').order('fecha').limit(1000)
      if (perms.length > 0) qM = qM.in('empresa_id', perms)
      const { data: movs } = await qM
      setEmpresas(emps || [])
      setMovimientos(movs || [])
    } catch(e) { console.error(e) }
    finally { setCargando(false) }
  }

  const scope    = movimientos.filter(m => empresa==='all' || m.empresa_id===empresa)
  const scopeMes = scope.filter(m => { const [y,mo]=m.fecha.split('-'); return parseInt(y)===anio&&parseInt(mo)===mes })
  const ingTotal = scope.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)
  const gasTotal = scope.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0)
  const utilTotal= ingTotal-gasTotal
  const mgTotal  = ingTotal>0?Math.round(utilTotal/ingTotal*100):0
  const ingMes   = scopeMes.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)
  const gasMes   = scopeMes.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0)
  const utilMes  = ingMes-gasMes
  const mgMes    = ingMes>0?Math.round(utilMes/ingMes*100):0

  const catsMes: Record<string,{tipo:string;total:number}> = {}
  scopeMes.forEach(m => {
    if (!catsMes[m.categoria]) catsMes[m.categoria] = {tipo:m.tipo,total:0}
    catsMes[m.categoria].total += m.monto
  })
  const catsArr = Object.entries(catsMes).sort((a,b)=>b[1].total-a[1].total)

  const porMes: Record<string,{ing:number;gas:number}> = {}
  scope.forEach(m => {
    const key = m.fecha.slice(0,7)
    if (!porMes[key]) porMes[key] = {ing:0,gas:0}
    if (m.tipo==='ingreso') porMes[key].ing += m.monto
    else porMes[key].gas += m.monto
  })
  const historial = Object.entries(porMes).sort((a,b)=>a[0].localeCompare(b[0]))

  const porEmpresa = empresas.map(emp => {
    const movEmp = movimientos.filter(m=>m.empresa_id===emp.id)
    const ing = movEmp.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)
    const gas = movEmp.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0)
    const ut  = ing-gas
    const mg  = ing>0?Math.round(ut/ing*100):0
    return { ...emp, ing, gas, ut, mg }
  })

  const empInfo = empresa==='all' ? null : empresas.find(e=>e.id===empresa)
  const encabezado = empInfo ? `${empInfo.nombre_corto}${empInfo.rut?' · RUT '+empInfo.rut:''}` : 'Grupo consolidado'

  if (!authListo) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'DM Sans, sans-serif', color:'#9ca3af' }}>
      ⏳ Verificando acceso...
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#f8f9fb', fontFamily:'DM Sans, sans-serif' }}>
      <style>{`@media print { .no-print { display:none!important; } body { background:white!important; } }`}</style>

      <input type="checkbox" id="sidebarToggle" className="sidebar-toggle-input no-print" />
      <label htmlFor="sidebarToggle" className="sidebar-toggle-btn no-print" aria-label="Abrir menu">☰</label>
      <label htmlFor="sidebarToggle" className="sidebar-overlay no-print"></label>
      <div className="no-print app-sidebar" style={{ position:'fixed', top:0, left:0, width:220, height:'100vh', background:'#fff', borderRight:'1px solid rgba(0,0,0,0.08)', display:'flex', flexDirection:'column', padding:'0 12px 16px', zIndex:100, overflowY:'auto' }}>
        <div style={{ height:56, display:'flex', alignItems:'center', borderBottom:'1px solid rgba(0,0,0,0.08)', marginBottom:12, marginLeft:-12, marginRight:-12, paddingLeft:20, fontSize:15, fontWeight:600, color:'#B8912E' }}>📊 Finanzas Grupo</div>
        {NAV.map(item=>(
          <Link key={item.href} href={item.href} style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px', borderRadius:8, fontSize:13.5, color:(item as any).active?'#B8912E':'#6b7280', background:(item as any).active?'#FBF1D9':'transparent', fontWeight:(item as any).active?500:400, textDecoration:'none', marginBottom:2 }}>
            <span style={{ fontSize:15 }}>{item.icon}</span>{item.label}
          </Link>
        ))}
        <div style={{ marginTop:'auto', paddingTop:12, borderTop:'1px solid rgba(0,0,0,0.08)' }}>
          {!esAdmin && empresasPermitidas.length>0 && <div style={{ fontSize:10, color:'#BA7517', padding:'4px 10px', background:'#FAEEDA', borderRadius:6, marginBottom:6, textAlign:'center' }}>🔒 Vista restringida</div>}
          <div style={{ fontSize:11, color:'#9ca3af', marginBottom:4, padding:'0 10px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{userEmail}</div>
          <button onClick={cerrarSesion} style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'8px 10px', borderRadius:8, fontSize:13, color:'#E24B4A', background:'transparent', border:'none', cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>🚪 Cerrar sesión</button>
        </div>
      </div>

      <div className="app-content" style={{ marginLeft:220 }}>
        <div className="no-print app-header" style={{ height:56, background:'#fff', borderBottom:'1px solid rgba(0,0,0,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 28px', position:'sticky', top:0, zIndex:50 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:15, fontWeight:600 }}>Reportes financieros</div>
            {!cargando && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:'#E1F5EE', color:'#085041', fontWeight:500 }}>🟢 Datos reales</span>}
          </div>
          {tab==='preview' && <button onClick={()=>window.print()} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, border:'none', background:'#B8912E', color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer' }}>🖨️ Imprimir / PDF</button>}
        </div>

        <div className="app-main" style={{ padding:'24px 28px' }}>
          {cargando && <div style={{ textAlign:'center', padding:'4rem', color:'#9ca3af' }}>⏳ Cargando...</div>}
          {!cargando && (
            <>
              <div className="no-print" style={{ display:'flex', gap:6, marginBottom:20 }}>
                {([{k:'nuevo',l:'⚙️ Configurar'},{k:'preview',l:'👁️ Vista previa'}] as const).map(t=>(
                  <button key={t.k} onClick={()=>setTab(t.k)} style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer', border:'1px solid rgba(0,0,0,0.1)', background:tab===t.k?'#FBF1D9':'#fff', color:tab===t.k?'#B8912E':'#6b7280', fontWeight:tab===t.k?500:400 }}>{t.l}</button>
                ))}
              </div>

              {tab==='nuevo' && (
                <>
                  <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20, marginBottom:16 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:14 }}>Configuración</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                      <div><label style={{ display:'block', fontSize:12, fontWeight:500, color:'#6b7280', marginBottom:4 }}>Empresa</label>
                        <select value={empresa} onChange={e=>setEmpresa(e.target.value)} style={{ width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid rgba(0,0,0,0.14)', borderRadius:8, background:'#fff' }}>
                          <option value="all">Grupo completo</option>
                          {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre_corto}</option>)}
                        </select>
                      </div>
                      <div><label style={{ display:'block', fontSize:12, fontWeight:500, color:'#6b7280', marginBottom:4 }}>Mes</label>
                        <select value={mes} onChange={e=>setMes(parseInt(e.target.value))} style={{ width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid rgba(0,0,0,0.14)', borderRadius:8, background:'#fff' }}>
                          {MESES_NOMBRE.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
                        </select>
                      </div>
                      <div><label style={{ display:'block', fontSize:12, fontWeight:500, color:'#6b7280', marginBottom:4 }}>Año</label>
                        <select value={anio} onChange={e=>setAnio(parseInt(e.target.value))} style={{ width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid rgba(0,0,0,0.14)', borderRadius:8, background:'#fff' }}>
                          {[2024,2025,2026,2027].map(a=><option key={a}>{a}</option>)}
                        </select>
                      </div>
                      <div><label style={{ display:'block', fontSize:12, fontWeight:500, color:'#6b7280', marginBottom:4 }}>Preparado por</label>
                        <input value={autor} onChange={e=>setAutor(e.target.value)} placeholder="Nombre" style={{ width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid rgba(0,0,0,0.14)', borderRadius:8, background:'#fff' }}/>
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      {[
                        { label:'Resumen ejecutivo', checked:true, disabled:true },
                        { label:'Detalle categorías', checked:incluirCats, set:setIncluirCats },
                        { label:'Historial mensual', checked:incluirMensual, set:setIncluirMensual },
                        { label:'Tabla por empresa', checked:true, disabled:true },
                      ].map(s=>(
                        <label key={s.label} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:s.disabled?'#9ca3af':'#374151', cursor:s.disabled?'default':'pointer' }}>
                          <input type="checkbox" checked={s.checked} disabled={s.disabled}
                            onChange={()=>s.set && s.set(!s.checked)} style={{ accentColor:'#B8912E' }}/>
                          {s.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10, marginBottom:16 }}>
                    {[
                      { label:'Ingresos mes',  value:fmtM(ingMes),  color:'#1D9E75', bg:'#E1F5EE' },
                      { label:'Gastos mes',    value:fmtM(gasMes),  color:'#E24B4A', bg:'#FCEBEB' },
                      { label:'Utilidad mes',  value:fmtM(utilMes), color:'#B8912E', bg:'#FBF1D9' },
                      { label:'Margen mes',    value:mgMes+'%',      color:'#B8912E', bg:'#FBF1D9' },
                    ].map(m=>(
                      <div key={m.label} style={{ background:m.bg, borderRadius:10, padding:'12px 14px' }}>
                        <div style={{ fontSize:11, color:m.color, marginBottom:3, opacity:0.8 }}>{m.label}</div>
                        <div style={{ fontSize:18, fontWeight:700, color:m.color }}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                  <button onClick={()=>setTab('preview')} style={{ width:'100%', padding:11, borderRadius:9, border:'none', background:'#B8912E', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer' }}>
                    👁️ Ver reporte completo →
                  </button>
                </>
              )}

              {tab==='preview' && (
                <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:32, maxWidth:760, margin:'0 auto' }}>
                  <div style={{ borderBottom:'3px solid #B8912E', paddingBottom:16, marginBottom:24, display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div>
                      <div style={{ fontSize:22, fontWeight:700, color:'#111827', marginBottom:4 }}>
                        {empresa==='all'?'Reporte consolidado':'Reporte '+empInfo?.nombre_corto} — {MESES_NOMBRE[mes-1]} {anio}
                      </div>
                      <div style={{ fontSize:12, color:'#6b7280' }}>{encabezado}</div>
                      <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>
                        Generado {hoy.toLocaleDateString('es-CL')}{autor&&` · Por ${autor}`}
                      </div>
                    </div>
                    <div style={{ fontSize:28 }}>📊</div>
                  </div>

                  <div style={{ fontSize:11, fontWeight:700, color:'#B8912E', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10, borderBottom:'1px solid #e5e7eb', paddingBottom:4 }}>Indicadores — {MESES_NOMBRE[mes-1]} {anio}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:24 }}>
                    {[{l:'Ingresos',v:fmtCLP(ingMes),c:'#1D9E75'},{l:'Gastos',v:fmtCLP(gasMes),c:'#E24B4A'},{l:'Utilidad',v:fmtCLP(utilMes),c:'#B8912E'},{l:'Margen',v:mgMes+'%',c:'#B8912E'}].map(k=>(
                      <div key={k.l} style={{ background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:8, padding:'10px', textAlign:'center' }}>
                        <div style={{ fontSize:10, color:'#6b7280', marginBottom:3 }}>{k.l}</div>
                        <div style={{ fontSize:14, fontWeight:700, color:k.c }}>{k.v}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize:11, fontWeight:700, color:'#B8912E', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10, borderBottom:'1px solid #e5e7eb', paddingBottom:4 }}>Acumulado total</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:24 }}>
                    {[{l:'Ingresos',v:fmtCLP(ingTotal),c:'#1D9E75'},{l:'Gastos',v:fmtCLP(gasTotal),c:'#E24B4A'},{l:'Utilidad',v:fmtCLP(utilTotal),c:'#B8912E'},{l:'Margen',v:mgTotal+'%',c:'#B8912E'}].map(k=>(
                      <div key={k.l} style={{ background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:8, padding:'10px', textAlign:'center' }}>
                        <div style={{ fontSize:10, color:'#6b7280', marginBottom:3 }}>{k.l}</div>
                        <div style={{ fontSize:14, fontWeight:700, color:k.c }}>{k.v}</div>
                      </div>
                    ))}
                  </div>

                  {incluirCats && catsArr.length>0 && (
                    <>
                      <div style={{ fontSize:11, fontWeight:700, color:'#B8912E', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10, borderBottom:'1px solid #e5e7eb', paddingBottom:4 }}>Detalle categorías — {MESES_NOMBRE[mes-1]}</div>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, marginBottom:24 }}>
                        <thead><tr style={{ background:'#B8912E' }}>
                          {['Categoría','Tipo','Monto'].map(h=><th key={h} style={{ textAlign:'left', padding:'7px 10px', color:'#fff', fontWeight:500 }}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {catsArr.map(([cat,val],i)=>(
                            <tr key={cat} style={{ background:i%2===0?'#f8fafc':'#fff', borderBottom:'1px solid #e5e7eb' }}>
                              <td style={{ padding:'7px 10px', fontWeight:500 }}>{cat}</td>
                              <td style={{ padding:'7px 10px' }}>
                                <span style={{ fontSize:10, padding:'1px 6px', borderRadius:999, fontWeight:600, background:val.tipo==='ingreso'?'#E1F5EE':'#FCEBEB', color:val.tipo==='ingreso'?'#085041':'#791F1F' }}>{val.tipo}</span>
                              </td>
                              <td style={{ padding:'7px 10px', fontWeight:600, color:val.tipo==='ingreso'?'#1D9E75':'#E24B4A' }}>{fmtCLP(val.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot><tr style={{ background:'#f1f5f9', borderTop:'2px solid #e5e7eb' }}>
                          <td colSpan={2} style={{ padding:'8px 10px', fontWeight:700 }}>Resultado neto</td>
                          <td style={{ padding:'8px 10px', fontWeight:700, color:utilMes>=0?'#1D9E75':'#E24B4A' }}>{fmtCLP(utilMes)}</td>
                        </tr></tfoot>
                      </table>
                    </>
                  )}

                  {incluirMensual && historial.length>0 && (
                    <>
                      <div style={{ fontSize:11, fontWeight:700, color:'#B8912E', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10, borderBottom:'1px solid #e5e7eb', paddingBottom:4 }}>Historial mensual</div>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, marginBottom:24 }}>
                        <thead><tr style={{ background:'#B8912E' }}>
                          {['Mes','Ingresos','Gastos','Utilidad','Margen'].map(h=><th key={h} style={{ textAlign:'left', padding:'7px 10px', color:'#fff', fontWeight:500 }}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {historial.map(([key,val],i)=>{
                            const [y,m] = key.split('-')
                            const neto  = val.ing-val.gas
                            const mg    = val.ing>0?Math.round(neto/val.ing*100):0
                            const esMes = parseInt(m)===mes&&parseInt(y)===anio
                            return (
                              <tr key={key} style={{ background:esMes?'#FBF1D9':i%2===0?'#f8fafc':'#fff', borderBottom:'1px solid #e5e7eb', fontWeight:esMes?600:400 }}>
                                <td style={{ padding:'7px 10px' }}>{MESES_NOMBRE[parseInt(m)-1]} {y}{esMes?' ←':''}</td>
                                <td style={{ padding:'7px 10px', color:'#1D9E75' }}>{fmtCLP(val.ing)}</td>
                                <td style={{ padding:'7px 10px', color:'#E24B4A' }}>{fmtCLP(val.gas)}</td>
                                <td style={{ padding:'7px 10px', color:neto>=0?'#B8912E':'#E24B4A' }}>{fmtCLP(neto)}</td>
                                <td style={{ padding:'7px 10px', color:mg>=30?'#1D9E75':mg>=15?'#EF9F27':'#E24B4A' }}>{mg}%</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </>
                  )}

                  {empresa==='all' && (
                    <>
                      <div style={{ fontSize:11, fontWeight:700, color:'#B8912E', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10, borderBottom:'1px solid #e5e7eb', paddingBottom:4 }}>Por empresa — acumulado</div>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, marginBottom:24 }}>
                        <thead><tr style={{ background:'#B8912E' }}>
                          {['Empresa','Ingresos','Gastos','Utilidad','Margen'].map(h=><th key={h} style={{ textAlign:'left', padding:'7px 10px', color:'#fff', fontWeight:500 }}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {porEmpresa.map((e,i)=>(
                            <tr key={e.id} style={{ background:i%2===0?'#f8fafc':'#fff', borderBottom:'1px solid #e5e7eb' }}>
                              <td style={{ padding:'7px 10px', fontWeight:500 }}>{e.nombre_corto}</td>
                              <td style={{ padding:'7px 10px', color:'#1D9E75', fontWeight:600 }}>{fmtCLP(e.ing)}</td>
                              <td style={{ padding:'7px 10px', color:'#E24B4A' }}>{fmtCLP(e.gas)}</td>
                              <td style={{ padding:'7px 10px', fontWeight:600, color:e.ut>=0?'#B8912E':'#E24B4A' }}>{fmtCLP(e.ut)}</td>
                              <td style={{ padding:'7px 10px', color:e.mg>=30?'#1D9E75':e.mg>=15?'#EF9F27':'#E24B4A', fontWeight:600 }}>{e.mg}%</td>
                            </tr>
                          ))}
                          <tfoot><tr style={{ background:'#f1f5f9', borderTop:'2px solid #e5e7eb', fontWeight:700 }}>
                            <td style={{ padding:'8px 10px' }}>Total grupo</td>
                            <td style={{ padding:'8px 10px', color:'#1D9E75' }}>{fmtCLP(ingTotal)}</td>
                            <td style={{ padding:'8px 10px', color:'#E24B4A' }}>{fmtCLP(gasTotal)}</td>
                            <td style={{ padding:'8px 10px', color:'#B8912E' }}>{fmtCLP(utilTotal)}</td>
                            <td style={{ padding:'8px 10px', color:'#B8912E' }}>{mgTotal}%</td>
                          </tr></tfoot>
                        </tbody>
                      </table>
                    </>
                  )}

                  <div style={{ borderTop:'1px solid #e5e7eb', paddingTop:12, display:'flex', justifyContent:'space-between', fontSize:10, color:'#9ca3af' }}>
                    <span>Plataforma Financiera Grupo Farmacias</span>
                    <span>Generado {hoy.toLocaleDateString('es-CL')}</span>
                  </div>

                  <div className="no-print" style={{ marginTop:20, display:'flex', gap:8 }}>
                    <button onClick={()=>window.print()} style={{ flex:1, padding:11, borderRadius:9, border:'none', background:'#B8912E', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer' }}>🖨️ Imprimir / PDF</button>
                    <button onClick={()=>setTab('nuevo')} style={{ padding:'11px 16px', borderRadius:9, border:'1px solid rgba(0,0,0,0.12)', background:'#fff', color:'#374151', fontSize:13, cursor:'pointer' }}>← Volver</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
