'use client'
import { useState, useEffect } from 'react'
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
  { href:'/kpis',         label:'KPIs',         icon:'📊', active:true },
  { href:'/ia',           label:'Análisis IA',  icon:'🧠' },
]

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

type Empresa = { id: string; nombre_corto: string; color: string }
type Mov     = { empresa_id: string; tipo: string; monto: number; fecha: string; categoria: string }

function fmtM(n: number) {
  const a=Math.abs(n),s=n<0?'-':''
  if(a>=1e6) return s+'$'+(Math.round(a/1e5)/10)+'M'
  if(a>=1000) return s+'$'+Math.round(a/1000)+'K'
  return s+'$'+Math.round(a)
}
function fmtCLP(n: number) {
  return (n<0?'-':'')+'$'+Math.round(Math.abs(n)).toLocaleString('es-CL')
}
function semColor(pct: number, inv=false) {
  if (inv) return pct>100?'#E24B4A':pct>85?'#EF9F27':'#1D9E75'
  return pct>=100?'#1D9E75':pct>=75?'#EF9F27':'#E24B4A'
}
function semLabel(pct: number, inv=false) {
  if (inv) return pct>100?'Excedido':pct>85?'En límite':'Óptimo'
  return pct>=100?'Logrado':pct>=75?'En curso':'Bajo meta'
}

export default function KpisPage() {
  const router = useRouter()
  const [userEmail,          setUserEmail]          = useState('')
  const [esAdmin,            setEsAdmin]            = useState(true)
  const [empresasPermitidas, setEmpresasPermitidas] = useState<string[]>([])
  const [authListo,          setAuthListo]          = useState(false)
  const [empresas,    setEmpresas]    = useState<Empresa[]>([])
  const [movimientos, setMovimientos] = useState<Mov[]>([])
  const [cargando,    setCargando]    = useState(false)
  const [empresa,     setEmpresa]     = useState('all')
  const [tab,         setTab]         = useState<'panel'|'tendencias'|'metas'>('panel')
  const [metaMargen,   setMetaMargen]   = useState(30)
  const [metaGastoIng, setMetaGastoIng] = useState(70)
  const [metaCrec,     setMetaCrec]     = useState(10)
  const hoy = new Date()
  const mesActual  = hoy.getMonth() + 1
  const anioActual = hoy.getFullYear()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      const email = session.user.email || ''
      setUserEmail(email)
      const { data: perfil } = await supabase
        .from('usuarios_plataforma').select('rol, empresas_permitidas, modulos_permitidos').eq('email',email).single()
      if (perfil?.modulos_permitidos && perfil.modulos_permitidos.length > 0 && !perfil.modulos_permitidos.includes('/kpis')) {
        router.push(perfil.modulos_permitidos[0]); return
      }
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
      let qE = supabase.from('empresas').select('id,nombre_corto,color').eq('activa',true)
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
  const scopeMes = scope.filter(m => { const [y,mo]=m.fecha.split('-'); return parseInt(y)===anioActual&&parseInt(mo)===mesActual })
  const mesAnt   = mesActual===1?12:mesActual-1
  const anioAnt  = mesActual===1?anioActual-1:anioActual
  const scopeAnt = scope.filter(m => { const [y,mo]=m.fecha.split('-'); return parseInt(y)===anioAnt&&parseInt(mo)===mesAnt })

  const ingTotal  = scope.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)
  const gasTotal  = scope.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0)
  const util      = ingTotal - gasTotal
  const margenR   = ingTotal>0 ? Math.round(util/ingTotal*100) : 0
  const gasIngR   = ingTotal>0 ? Math.round(gasTotal/ingTotal*100) : 0
  const ingMes    = scopeMes.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)
  const gasMes    = scopeMes.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0)
  const ingAnt    = scopeAnt.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)
  const crecR     = ingAnt>0 ? Math.round((ingMes-ingAnt)/ingAnt*100) : 0
  const utilMes   = ingMes - gasMes
  const margenMes = ingMes>0 ? Math.round(utilMes/ingMes*100) : 0

  const porMes: Record<string,{ing:number;gas:number}> = {}
  scope.forEach(m => {
    const key = m.fecha.slice(0,7)
    if (!porMes[key]) porMes[key] = {ing:0,gas:0}
    if (m.tipo==='ingreso') porMes[key].ing += m.monto
    else porMes[key].gas += m.monto
  })
  const mesesData = Object.entries(porMes).sort((a,b)=>a[0].localeCompare(b[0]))
  const maxBar    = Math.max(...mesesData.map(([,v])=>Math.max(v.ing,v.gas)),1)

  const topGastos: Record<string,number> = {}
  scope.filter(m=>m.tipo==='gasto').forEach(m => { topGastos[m.categoria]=(topGastos[m.categoria]||0)+m.monto })
  const topArr = Object.entries(topGastos).sort((a,b)=>b[1]-a[1]).slice(0,5)
  const maxTop = Math.max(...topArr.map(([,v])=>v),1)

  const ranking = empresas.map(emp => {
    const movEmp = movimientos.filter(m=>m.empresa_id===emp.id)
    const ing = movEmp.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)
    const gas = movEmp.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0)
    const ut  = ing - gas
    const mg  = ing>0 ? Math.round(ut/ing*100) : 0
    return { ...emp, ing, gas, ut, mg }
  }).sort((a,b)=>b.ut-a.ut)

  const kpis = [
    { icon:'📈', label:'Ingresos totales',   val:fmtM(ingTotal),              sub:`Mes: ${fmtM(ingMes)}`,     pct:100,                                         inv:false, color:'#1D9E75', bg:'rgba(29,158,117,0.16)' },
    { icon:'💹', label:'Margen neto',         val:margenR+'%',                  sub:`Meta: ${metaMargen}%`,      pct:Math.round(margenR/metaMargen*100),           inv:false, color:'', bg:'' },
    { icon:'🏢', label:'Margen mes actual',   val:margenMes+'%',                sub:MESES[mesActual-1]+' '+anioActual, pct:Math.round(margenMes/metaMargen*100),  inv:false, color:'', bg:'' },
    { icon:'🚀', label:'Crecimiento',         val:(crecR>0?'+':'')+crecR+'%',   sub:'vs mes anterior',           pct:ingAnt>0?Math.round(Math.max(0,crecR)/metaCrec*100):0, inv:false, color:'', bg:'' },
    { icon:'💰', label:'Gasto / Ingreso',     val:gasIngR+'%',                  sub:`Límite: ${metaGastoIng}%`,  pct:Math.round(metaGastoIng/Math.max(gasIngR,1)*100), inv:true, color:'', bg:'' },
    { icon:'📊', label:'Utilidad total',      val:fmtM(util),                   sub:`Mes: ${fmtM(utilMes)}`,     pct:100,                                         inv:false, color:util>=0?'#B8912E':'#E24B4A', bg:util>=0?'rgba(184,145,46,0.16)':'rgba(226,75,74,0.16)' },
  ]

  if (!authListo) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'DM Sans, sans-serif', color:'#767676' }}>
      ⏳ Verificando acceso...
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#0B0B0C', fontFamily:'DM Sans, sans-serif' }}>
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
          {!esAdmin && empresasPermitidas.length>0 && <div style={{ fontSize:10, color:'#BA7517', padding:'4px 10px', background:'rgba(186,117,23,0.18)', borderRadius:6, marginBottom:6, textAlign:'center' }}>🔒 Vista restringida</div>}
          <div style={{ fontSize:11, color:'#767676', marginBottom:4, padding:'0 10px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{userEmail}</div>
          <button onClick={cerrarSesion} style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'8px 10px', borderRadius:8, fontSize:13, color:'#E24B4A', background:'transparent', border:'none', cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>🚪 Cerrar sesión</button>
        </div>
      </div>

      <div className="app-content" style={{ marginLeft:220 }}>
        <div className="app-header" style={{ height:56, background:'#161616', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 28px', position:'sticky', top:0, zIndex:50 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:15, fontWeight:600 }}>KPIs ejecutivos</div>
            {!cargando && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:'rgba(29,158,117,0.16)', color:'#1D9E75', fontWeight:500 }}>🟢 Datos reales</span>}
          </div>
          <select value={empresa} onChange={e=>setEmpresa(e.target.value)} style={{ fontSize:13, padding:'6px 10px', border:'1px solid rgba(255,255,255,0.14)', borderRadius:8, background:'#161616' }}>
            <option value="all">{esAdmin?'Grupo completo':'Mis empresas'}</option>
            {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre_corto}</option>)}
          </select>
        </div>

        <div className="app-main" style={{ padding:'24px 28px' }}>
          <div style={{ display:'flex', gap:6, marginBottom:24 }}>
            {([{k:'panel',l:'📊 Panel'},{k:'tendencias',l:'📈 Tendencias'},{k:'metas',l:'🎯 Metas'}] as const).map(t=>(
              <button key={t.k} onClick={()=>setTab(t.k)} style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer', border:'1px solid rgba(255,255,255,0.1)', background:tab===t.k?'rgba(184,145,46,0.16)':'#161616', color:tab===t.k?'#B8912E':'#9A9A9A', fontWeight:tab===t.k?500:400 }}>{t.l}</button>
            ))}
          </div>

          {cargando && <div style={{ textAlign:'center', padding:'4rem', color:'#767676' }}>⏳ Cargando...</div>}

          {!cargando && tab==='panel' && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:14, marginBottom:24 }}>
                {kpis.map(k=>{
                  const pct   = Math.min(100,k.pct)
                  const color = k.color || semColor(k.pct,k.inv)
                  const bg    = k.bg || (color==='#1D9E75'?'rgba(29,158,117,0.16)':color==='#EF9F27'?'rgba(186,117,23,0.18)':'rgba(226,75,74,0.16)')
                  return (
                    <div key={k.label} style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:16, position:'relative' }}>
                      <div style={{ position:'absolute', top:12, right:12, width:10, height:10, borderRadius:'50%', background:color, boxShadow:`0 0 0 3px ${color}33` }}/>
                      <div style={{ fontSize:20, marginBottom:8 }}>{k.icon}</div>
                      <div style={{ fontSize:11, color:'#9A9A9A', marginBottom:3 }}>{k.label}</div>
                      <div style={{ fontSize:22, fontWeight:700, color:'#F0EFEA', marginBottom:4 }}>{k.val}</div>
                      <div style={{ fontSize:11, color:'#767676', marginBottom:8 }}>{k.sub}</div>
                      <div style={{ height:5, background:'#1F1F1F', borderRadius:3, overflow:'hidden', marginBottom:6 }}>
                        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:3 }}/>
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between' }}>
                        <span style={{ fontSize:10, color:'#767676' }}>{k.pct}%</span>
                        <span style={{ fontSize:10, padding:'1px 6px', borderRadius:999, fontWeight:600, background:bg, color }}>{semLabel(k.pct,k.inv)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:20, marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#9A9A9A', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:14 }}>Ranking por utilidad neta</div>
                {ranking.map((e,i)=>(
                  <div key={e.id} style={{ marginBottom:16 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                      <span style={{ fontSize:18, fontWeight:700, color:'#3A3A3A', width:20 }}>{i+1}</span>
                      <span style={{ width:9, height:9, borderRadius:'50%', background:e.color, flexShrink:0 }}/>
                      <span style={{ flex:1, fontSize:13, fontWeight:500, color:'#F0EFEA' }}>{e.nombre_corto}</span>
                      <span style={{ fontSize:12, color:'#9A9A9A' }}>Ing: {fmtM(e.ing)}</span>
                      <span style={{ fontSize:12, color:'#9A9A9A' }}>Margen {e.mg}%</span>
                      <span style={{ fontSize:14, fontWeight:700, color:e.ut>=0?'#1D9E75':'#E24B4A' }}>{fmtM(e.ut)}</span>
                    </div>
                    <div style={{ height:6, background:'#1F1F1F', borderRadius:3, overflow:'hidden', marginLeft:28 }}>
                      <div style={{ height:'100%', width:`${Math.max(0,Math.min(100,e.ing>0?Math.round(e.ut/e.ing*100*2):0))}%`, background:e.color, borderRadius:3 }}/>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:20 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#9A9A9A', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:14 }}>Top categorías de gasto</div>
                {topArr.map(([cat,val])=>(
                  <div key={cat} style={{ marginBottom:12 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:13, color:'#C9C9C9', fontWeight:500 }}>{cat}</span>
                      <span style={{ fontSize:13, fontWeight:600, color:'#E24B4A' }}>{fmtCLP(val)}</span>
                    </div>
                    <div style={{ height:6, background:'#1F1F1F', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${Math.round(val/maxTop*100)}%`, background:'#E24B4A', borderRadius:3 }}/>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {!cargando && tab==='tendencias' && (
            <>
              <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:20, marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#9A9A9A', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:14 }}>Ingresos vs gastos por mes</div>
                <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:160, overflowX:'auto' }}>
                  {mesesData.map(([key,val])=>{
                    const [y,m] = key.split('-')
                    const hI = Math.round(val.ing/maxBar*140)
                    const hG = Math.round(val.gas/maxBar*140)
                    const neto = val.ing-val.gas
                    return (
                      <div key={key} style={{ flex:'0 0 auto', width:52, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                        <div style={{ fontSize:9, color:neto>=0?'#1D9E75':'#E24B4A', fontWeight:600 }}>{fmtM(neto)}</div>
                        <div style={{ width:'100%', display:'flex', gap:2, alignItems:'flex-end' }}>
                          <div style={{ flex:1, height:Math.max(hI,2), background:'#1D9E75', borderRadius:'2px 2px 0 0' }}/>
                          <div style={{ flex:1, height:Math.max(hG,2), background:'#E24B4A', borderRadius:'2px 2px 0 0' }}/>
                        </div>
                        <div style={{ fontSize:9, color:'#767676' }}>{MESES[parseInt(m)-1]} {y.slice(2)}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, overflow:'hidden' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead><tr style={{ background:'#1A1A1A' }}>
                    {['Mes','Ingresos','Gastos','Utilidad','Margen'].map(h=>(
                      <th key={h} style={{ textAlign:'left', padding:'9px 12px', fontWeight:500, color:'#9A9A9A', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {mesesData.map(([key,val],i)=>{
                      const [y,m] = key.split('-')
                      const neto = val.ing-val.gas
                      const mg   = val.ing>0 ? Math.round(neto/val.ing*100) : 0
                      return (
                        <tr key={key} style={{ borderBottom:i<mesesData.length-1?'1px solid rgba(255,255,255,0.06)':'none' }}>
                          <td style={{ padding:'9px 12px', fontWeight:500 }}>{MESES[parseInt(m)-1]} {y}</td>
                          <td style={{ padding:'9px 12px', color:'#1D9E75', fontWeight:600 }}>{fmtCLP(val.ing)}</td>
                          <td style={{ padding:'9px 12px', color:'#E24B4A' }}>{fmtCLP(val.gas)}</td>
                          <td style={{ padding:'9px 12px', fontWeight:700, color:neto>=0?'#B8912E':'#E24B4A' }}>{fmtCLP(neto)}</td>
                          <td style={{ padding:'9px 12px', color:mg>=30?'#1D9E75':mg>=15?'#EF9F27':'#E24B4A', fontWeight:500 }}>{mg}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {!cargando && tab==='metas' && (
            <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:20 }}>
              <div style={{ fontSize:13, color:'#9A9A9A', marginBottom:20 }}>Ajusta tus metas — los indicadores del panel se actualizan en tiempo real.</div>
              {[
                { label:'Margen neto objetivo',     real:margenR+'%',  meta:metaMargen,   setMeta:setMetaMargen,   min:5,  max:60, color:'#1D9E75', pct:Math.round(margenR/metaMargen*100),                       inv:false },
                { label:'Gasto/Ingreso máximo',     real:gasIngR+'%',  meta:metaGastoIng, setMeta:setMetaGastoIng, min:40, max:95, color:'#E24B4A', pct:Math.round(metaGastoIng/Math.max(gasIngR,1)*100),          inv:true  },
                { label:'Crecimiento mensual obj.', real:(crecR>0?'+':'')+crecR+'%', meta:metaCrec, setMeta:setMetaCrec, min:1, max:50, color:'#B8912E', pct:Math.round(Math.max(0,crecR)/metaCrec*100), inv:false },
              ].map(row=>{
                const color = semColor(row.pct, row.inv)
                const bg    = color==='#1D9E75'?'rgba(29,158,117,0.16)':color==='#EF9F27'?'rgba(186,117,23,0.18)':'rgba(226,75,74,0.16)'
                return (
                  <div key={row.label} style={{ marginBottom:24 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:500, color:'#F0EFEA' }}>{row.label}</div>
                        <div style={{ fontSize:12, color:'#9A9A9A', marginTop:2 }}>Real: <strong>{row.real}</strong></div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:10, color:'#767676', marginBottom:2 }}>Meta</div>
                          <div style={{ fontSize:20, fontWeight:700, color:row.color }}>{row.meta}%</div>
                        </div>
                        <div style={{ textAlign:'center', minWidth:60 }}>
                          <div style={{ fontSize:16, fontWeight:700, color }}>{Math.min(999,row.pct)}%</div>
                          <span style={{ fontSize:10, padding:'1px 6px', borderRadius:999, fontWeight:600, background:bg, color }}>{semLabel(row.pct,row.inv)}</span>
                        </div>
                      </div>
                    </div>
                    <input type="range" min={row.min} max={row.max} value={row.meta}
                      onChange={e=>row.setMeta(parseInt(e.target.value))}
                      style={{ width:'100%', accentColor:row.color, marginBottom:6 }}/>
                    <div style={{ height:7, background:'#1F1F1F', borderRadius:4, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${Math.min(100,row.pct)}%`, background:color, borderRadius:4 }}/>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
