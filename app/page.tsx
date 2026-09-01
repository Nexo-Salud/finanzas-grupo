'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

const NAV = [
  { href:'/',             label:'Dashboard',    icon:'▦', active:true },
  { href:'/movimientos',  label:'Movimientos',  icon:'↕'  },
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

const MESES_NOMBRE = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

type Empresa = { id: string; nombre_corto: string; color: string }
type Mov     = { empresa_id: string; tipo: string; monto: number; fecha: string; categoria: string; descripcion?: string }

function fmtM(n: number) {
  const a=Math.abs(n),s=n<0?'-':''
  if(a>=1e6) return s+'$'+(Math.round(a/1e5)/10)+'M'
  if(a>=1000) return s+'$'+Math.round(a/1000)+'K'
  return s+'$'+Math.round(a)
}
function fmtCLP(n: number) {
  return (n<0?'-':'')+'$'+Math.round(Math.abs(n)).toLocaleString('es-CL')
}

export default function DashboardPage() {
  const [empresas,         setEmpresas]         = useState<Empresa[]>([])
  const [empresasPermitidas, setEmpresasPermitidas] = useState<string[]>([]) // IDs permitidos
  const [movimientos,      setMovimientos]      = useState<Mov[]>([])
  const [cargando,         setCargando]         = useState(true)
  const [empresa,          setEmpresa]          = useState('all')
  const [userEmail,        setUserEmail]        = useState('')
  const [esAdmin,          setEsAdmin]          = useState(false)
  const router = useRouter()

  const hoy        = new Date()
  const mesActual  = hoy.getMonth() + 1
  const anioActual = hoy.getFullYear()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      
      const email = session.user.email || ''
      setUserEmail(email)

      // Buscar permisos del usuario en usuarios_plataforma
      const { data: perfil } = await supabase
        .from('usuarios_plataforma')
        .select('rol, empresas_permitidas, modulos_permitidos')
        .eq('email', email)
        .single()
      if (perfil?.modulos_permitidos && perfil.modulos_permitidos.length > 0 && !perfil.modulos_permitidos.includes('/')) {
        router.push(perfil.modulos_permitidos[0]); return
      }

      let empPermitidas: string[] = []
      
      if (perfil) {
        const rol = perfil.rol
        const empsPerms = perfil.empresas_permitidas || []
        
        // Admin o sin restricción → ve todo
        if (rol === 'admin' || empsPerms.length === 0) {
          setEsAdmin(true)
          empPermitidas = [] // vacío = todas
        } else {
          setEsAdmin(false)
          empPermitidas = empsPerms
          setEmpresasPermitidas(empsPerms)
        }
      } else {
        // Si no está en usuarios_plataforma, verificar si es el dueño (admin)
        setEsAdmin(true)
        empPermitidas = []
      }

      await cargarDatos(empPermitidas)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push('/login')
    })
    return () => subscription.unsubscribe()
  }, [])

  async function cargarDatos(empPermitidas: string[]) {
    setCargando(true)
    try {
      // Cargar empresas filtradas
      let queryEmps = supabase.from('empresas').select('id,nombre_corto,color').eq('activa', true)
      
      if (empPermitidas.length > 0) {
        queryEmps = queryEmps.in('id', empPermitidas)
      }
      
      const { data: emps } = await queryEmps.order('nombre_corto')

      // Cargar movimientos filtrados
      let queryMovs = supabase.from('movimientos').select('empresa_id,tipo,monto,fecha,categoria,descripcion').order('fecha', { ascending: false }).limit(1000)
      
      if (empPermitidas.length > 0) {
        queryMovs = queryMovs.in('empresa_id', empPermitidas)
      }

      const { data: movs } = await queryMovs

      setEmpresas(emps || [])
      setMovimientos(movs || [])
    } catch(e) { console.error(e) }
    finally { setCargando(false) }
  }

  async function cerrarSesion() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Filtrado adicional por selector de empresa
  const scope = movimientos.filter(m => empresa === 'all' || m.empresa_id === empresa)
  const scopeMes = scope.filter(m => {
    const [y,mo] = m.fecha.split('-')
    return parseInt(y)===anioActual && parseInt(mo)===mesActual
  })

  const ingTotal = scope.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)
  const gasTotal = scope.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0)
  const utilidad = ingTotal - gasTotal
  const margen   = ingTotal>0 ? Math.round(utilidad/ingTotal*100) : 0
  const ingMes   = scopeMes.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)
  const gasMes   = scopeMes.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0)
  const utilMes  = ingMes - gasMes

  const porMes: Record<string,{ing:number;gas:number}> = {}
  scope.forEach(m => {
    const key = m.fecha.slice(0,7)
    if (!porMes[key]) porMes[key] = {ing:0,gas:0}
    if (m.tipo==='ingreso') porMes[key].ing += m.monto
    else porMes[key].gas += m.monto
  })
  const mesesData = Object.entries(porMes).sort((a,b)=>a[0].localeCompare(b[0])).slice(-6)
  const maxBar    = Math.max(...mesesData.map(([,v])=>Math.max(v.ing,v.gas)), 1)

  const rankingEmpresas = empresas.map(emp => {
    const movEmp = movimientos.filter(m=>m.empresa_id===emp.id)
    const ing = movEmp.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)
    const gas = movEmp.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0)
    const util = ing - gas
    const mg   = ing>0 ? Math.round(util/ing*100) : 0
    return { ...emp, ing, gas, util, mg }
  }).sort((a,b)=>b.util-a.util)
  const maxUtil = Math.max(...rankingEmpresas.map(e=>e.util), 1)

  const topGastos: Record<string,number> = {}
  scopeMes.filter(m=>m.tipo==='gasto').forEach(m => {
    topGastos[m.categoria] = (topGastos[m.categoria]||0) + m.monto
  })
  const topGastosArr = Object.entries(topGastos).sort((a,b)=>b[1]-a[1]).slice(0,5)
  const maxGasto = Math.max(...topGastosArr.map(([,v])=>v), 1)
  const ultimos  = scope.slice(0,6)

  const empColor  = (id: string) => empresas.find(e=>e.id===id)?.color || '#888780'
  const empNombre = (id: string) => empresas.find(e=>e.id===id)?.nombre_corto || id

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
        {/* Usuario y logout */}
        <div style={{ marginTop:'auto', paddingTop:12, borderTop:'1px solid rgba(255,255,255,0.08)' }}>
          {!esAdmin && empresasPermitidas.length > 0 && (
            <div style={{ fontSize:10, color:'#BA7517', padding:'4px 10px', background:'rgba(186,117,23,0.18)', borderRadius:6, marginBottom:8, textAlign:'center' }}>
              🔒 Acceso restringido
            </div>
          )}
          <div style={{ fontSize:11, color:'#767676', marginBottom:4, padding:'0 10px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>
            {userEmail}
          </div>
          <button onClick={cerrarSesion} style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'8px 10px', borderRadius:8, fontSize:13, color:'#E24B4A', background:'transparent', border:'none', cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
            🚪 Cerrar sesión
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className="app-content" style={{ marginLeft:220 }}>
        {/* Header */}
        <div className="app-header" style={{ height:56, background:'#161616', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 28px', position:'sticky', top:0, zIndex:50 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:15, fontWeight:600 }}>Dashboard</div>
            {!cargando && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:'rgba(29,158,117,0.16)', color:'#1D9E75', fontWeight:500 }}>🟢 Datos reales</span>}
            {!esAdmin && empresasPermitidas.length > 0 && (
              <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:'rgba(186,117,23,0.18)', color:'#BA7517', fontWeight:500 }}>
                🔒 Vista restringida
              </span>
            )}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <select value={empresa} onChange={e=>setEmpresa(e.target.value)} style={{ fontSize:13, padding:'6px 10px', border:'1px solid rgba(255,255,255,0.14)', borderRadius:8, background:'#161616' }}>
              <option value="all">{esAdmin || empresasPermitidas.length===0 ? 'Grupo completo' : 'Mis empresas'}</option>
              {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre_corto}</option>)}
            </select>
          </div>
        </div>

        <div className="app-main" style={{ padding:'24px 28px' }}>
          {/* Métricas */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:20 }}>
            {[
              { label:'Ingresos totales', value:fmtM(ingTotal),  delta:`Mes: ${fmtM(ingMes)}`,  color:'#1D9E75', bg:'rgba(29,158,117,0.16)' },
              { label:'Gastos totales',   value:fmtM(gasTotal),  delta:`Mes: ${fmtM(gasMes)}`,  color:'#E24B4A', bg:'rgba(226,75,74,0.16)' },
              { label:'Utilidad neta',    value:fmtM(utilidad),  delta:`Margen ${margen}%`,      color:'#B8912E', bg:'rgba(184,145,46,0.16)' },
              { label:'Resultado mes',    value:fmtM(utilMes),   delta:MESES_NOMBRE[mesActual-1]+' '+anioActual, color:utilMes>=0?'#1D9E75':'#E24B4A', bg:utilMes>=0?'rgba(29,158,117,0.16)':'rgba(226,75,74,0.16)' },
              { label:'Movimientos',      value:scope.length.toString(), delta:'registrados', color:'#BA7517', bg:'rgba(186,117,23,0.18)' },
            ].map(m=>(
              <div key={m.label} style={{ background:m.bg, borderRadius:12, padding:'14px 16px' }}>
                <div style={{ fontSize:11, color:m.color, fontWeight:500, marginBottom:4, opacity:0.8 }}>{m.label}</div>
                <div style={{ fontSize:22, fontWeight:700, color:m.color }}>{cargando?'—':m.value}</div>
                <div style={{ fontSize:11, color:m.color, opacity:0.7, marginTop:2 }}>{m.delta}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
            {/* Gráfico */}
            <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:20 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#9A9A9A', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:14 }}>Ingresos vs gastos — últimos 6 meses</div>
              <div style={{ display:'flex', gap:10, marginBottom:12 }}>
                {[{l:'Ingresos',c:'#1D9E75'},{l:'Gastos',c:'#E24B4A'}].map(e=>(
                  <span key={e.l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#9A9A9A' }}>
                    <span style={{ width:10, height:10, borderRadius:2, background:e.c, display:'inline-block' }}/>{e.l}
                  </span>
                ))}
              </div>
              {cargando ? (
                <div style={{ height:140, display:'flex', alignItems:'center', justifyContent:'center', color:'#767676' }}>Cargando...</div>
              ) : mesesData.length === 0 ? (
                <div style={{ height:140, display:'flex', alignItems:'center', justifyContent:'center', color:'#767676', fontSize:13 }}>Sin datos</div>
              ) : (
                <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:140 }}>
                  {mesesData.map(([key,val])=>{
                    const [y,m] = key.split('-')
                    const hI = Math.round(val.ing/maxBar*120)
                    const hG = Math.round(val.gas/maxBar*120)
                    const neto = val.ing - val.gas
                    return (
                      <div key={key} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                        <div style={{ fontSize:9, color:neto>=0?'#1D9E75':'#E24B4A', fontWeight:600 }}>{fmtM(neto)}</div>
                        <div style={{ width:'100%', display:'flex', gap:2, alignItems:'flex-end' }}>
                          <div style={{ flex:1, height:Math.max(hI,2), background:'#1D9E75', borderRadius:'2px 2px 0 0' }}/>
                          <div style={{ flex:1, height:Math.max(hG,2), background:'#E24B4A', borderRadius:'2px 2px 0 0' }}/>
                        </div>
                        <div style={{ fontSize:9, color:'#767676' }}>{MESES_NOMBRE[parseInt(m)-1]} {y.slice(2)}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Ranking empresas */}
            <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:20 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#9A9A9A', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:14 }}>Resultado por empresa</div>
              {cargando ? (
                <div style={{ color:'#767676', fontSize:13 }}>Cargando...</div>
              ) : rankingEmpresas.length === 0 ? (
                <div style={{ color:'#767676', fontSize:13, textAlign:'center', padding:'2rem' }}>Sin datos</div>
              ) : rankingEmpresas.map((e,i)=>(
                <div key={e.id} style={{ marginBottom:16 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                    <span style={{ fontSize:16, fontWeight:700, color:'#3A3A3A', width:20 }}>{i+1}</span>
                    <span style={{ width:9, height:9, borderRadius:'50%', background:e.color, flexShrink:0 }}/>
                    <span style={{ flex:1, fontSize:13, fontWeight:500, color:'#F0EFEA' }}>{e.nombre_corto}</span>
                    <span style={{ fontSize:12, color:'#9A9A9A' }}>Margen {e.mg}%</span>
                    <span style={{ fontSize:14, fontWeight:700, color:e.util>=0?'#1D9E75':'#E24B4A' }}>{fmtM(e.util)}</span>
                  </div>
                  <div style={{ height:6, background:'#1F1F1F', borderRadius:3, overflow:'hidden', marginLeft:28 }}>
                    <div style={{ height:'100%', width:`${Math.max(0,Math.min(100,Math.round(e.util/maxUtil*100)))}%`, background:e.color, borderRadius:3 }}/>
                  </div>
                </div>
              ))}

              {topGastosArr.length > 0 && (
                <div style={{ borderTop:'1px solid rgba(255,255,255,0.08)', paddingTop:12, marginTop:4 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'#767676', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Top gastos del mes</div>
                  {topGastosArr.map(([cat,val])=>(
                    <div key={cat} style={{ marginBottom:6 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                        <span style={{ color:'#C9C9C9' }}>{cat}</span>
                        <span style={{ color:'#E24B4A', fontWeight:500 }}>{fmtCLP(val)}</span>
                      </div>
                      <div style={{ height:4, background:'#1F1F1F', borderRadius:2, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${Math.round(val/maxGasto*100)}%`, background:'#E24B4A', borderRadius:2 }}/>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Últimos movimientos */}
          <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:20, marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#9A9A9A', textTransform:'uppercase', letterSpacing:'0.06em' }}>Últimos movimientos</div>
              <Link href="/movimientos" style={{ fontSize:12, color:'#B8912E', textDecoration:'none' }}>Ver todos →</Link>
            </div>
            {ultimos.length === 0 ? (
              <div style={{ textAlign:'center', padding:'1rem', color:'#767676', fontSize:13 }}>Sin movimientos</div>
            ) : ultimos.map((m,i)=>(
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:i<ultimos.length-1?'1px solid rgba(255,255,255,0.05)':'none' }}>
                <div style={{ width:28, height:28, borderRadius:8, background:m.tipo==='ingreso'?'rgba(29,158,117,0.16)':'rgba(226,75,74,0.16)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, flexShrink:0 }}>
                  {m.tipo==='ingreso'?'↑':'↓'}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:500, color:'#F0EFEA', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{m.descripcion || m.categoria}</div>
                  <div style={{ fontSize:10, color:'#767676' }}>{empNombre(m.empresa_id)} · {m.fecha}</div>
                </div>
                <span style={{ fontSize:12, fontWeight:600, color:m.tipo==='ingreso'?'#1D9E75':'#E24B4A', flexShrink:0 }}>
                  {m.tipo==='ingreso'?'+':'-'}{fmtM(m.monto)}
                </span>
              </div>
            ))}
          </div>

          {/* Acceso rápido */}
          <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:20 }}>
            <div style={{ fontSize:12, fontWeight:600, color:'#9A9A9A', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:14 }}>Acceso rápido</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))', gap:8 }}>
              {[
                { href:'/movimientos',  icon:'↕',  label:'Movimientos'  },
                { href:'/tributario',   icon:'🧾', label:'Documentos'   },
                { href:'/bancos',       icon:'🏦', label:'Bancos'       },
                { href:'/estados',      icon:'📑', label:'Est. Financ.' },
                { href:'/reportes',     icon:'📄', label:'Reportes'     },
                { href:'/proyecciones', icon:'📈', label:'Proyecciones' },
                { href:'/kpis',         icon:'📊', label:'KPIs'         },
                { href:'/ia',           icon:'🧠', label:'IA'           },
                { href:'/alertas',      icon:'🔔', label:'Alertas'      },
              ].map(m=>(
                <Link key={m.href} href={m.href} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, padding:'14px 8px', borderRadius:10, border:'1px solid rgba(255,255,255,0.08)', background:'#1A1A1A', textDecoration:'none' }}>
                  <span style={{ fontSize:22 }}>{m.icon}</span>
                  <span style={{ fontSize:12, fontWeight:500, color:'#C9C9C9', textAlign:'center' }}>{m.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
