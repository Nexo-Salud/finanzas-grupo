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
  { href:'/presupuesto',  label:'Presupuesto',  icon:'🎯' },
  { href:'/alertas',      label:'Alertas',      icon:'🔔' },
  { href:'/reportes',     label:'Reportes',     icon:'📄' },
  { href:'/estados',      label:'Est. Financ.', icon:'📑' },
  { href:'/bancos',       label:'Bancos',       icon:'🏦' },
  { href:'/tributario',   label:'Documentos',   icon:'🧾' },
  { href:'/proyecciones', label:'Proyecciones', icon:'📈', active:true },
  { href:'/usuarios',     label:'Usuarios',     icon:'👥' },
  { href:'/kpis',         label:'KPIs',         icon:'📊' },
  { href:'/ia',           label:'Análisis IA',  icon:'🧠' },
]

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

type Empresa = { id: string; nombre_corto: string; color: string }
type Mov     = { empresa_id: string; tipo: string; monto: number; fecha: string }

function fmtM(n: number) {
  const a=Math.abs(n),s=n<0?'-':''
  if(a>=1e6) return s+'$'+(Math.round(a/1e5)/10)+'M'
  if(a>=1000) return s+'$'+Math.round(a/1000)+'K'
  return s+'$'+Math.round(a)
}
function fmtCLP(n: number) { return (n<0?'-':'')+'$'+Math.round(Math.abs(n)).toLocaleString('es-CL') }

export default function ProyeccionesPage() {
  const router = useRouter()
  const [userEmail,          setUserEmail]          = useState('')
  const [esAdmin,            setEsAdmin]            = useState(true)
  const [empresasPermitidas, setEmpresasPermitidas] = useState<string[]>([])
  const [authListo,          setAuthListo]          = useState(false)
  const [empresas,    setEmpresas]    = useState<Empresa[]>([])
  const [movimientos, setMovimientos] = useState<Mov[]>([])
  const [cargando,    setCargando]    = useState(false)
  const [empresa,     setEmpresa]     = useState('all')
  const [horizonte,   setHorizonte]   = useState(6)
  const [tab,         setTab]         = useState<'grafico'|'supuestos'|'tabla'>('grafico')
  const [escenario,   setEscenario]   = useState<'opt'|'base'|'pes'>('base')
  const [varIngOpt,   setVarIngOpt]   = useState(10)
  const [varGasOpt,   setVarGasOpt]   = useState(-5)
  const [varIngPes,   setVarIngPes]   = useState(-10)
  const [varGasPes,   setVarGasPes]   = useState(10)
  const [minCaja,     setMinCaja]     = useState(1000000)
  const hoy = new Date()

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
      let qE = supabase.from('empresas').select('id,nombre_corto,color').eq('activa',true)
      if (perms.length > 0) qE = qE.in('id', perms)
      const { data: emps } = await qE.order('nombre_corto')
      let qM = supabase.from('movimientos').select('empresa_id,tipo,monto,fecha').order('fecha').limit(1000)
      if (perms.length > 0) qM = qM.in('empresa_id', perms)
      const { data: movs } = await qM
      setEmpresas(emps || [])
      setMovimientos(movs || [])
    } catch(e) { console.error(e) }
    finally { setCargando(false) }
  }

  const scope = movimientos.filter(m => empresa==='all' || m.empresa_id===empresa)
  const porMes: Record<string,{ing:number;gas:number}> = {}
  scope.forEach(m => {
    const key = m.fecha.slice(0,7)
    if (!porMes[key]) porMes[key] = {ing:0,gas:0}
    if (m.tipo==='ingreso') porMes[key].ing += m.monto
    else porMes[key].gas += m.monto
  })
  const historial = Object.entries(porMes).sort((a,b)=>a[0].localeCompare(b[0]))
  const ultimos3  = historial.slice(-3)
  const promedioIng = ultimos3.length>0 ? Math.round(ultimos3.reduce((a,[,v])=>a+v.ing,0)/ultimos3.length) : 0
  const promedioGas = ultimos3.length>0 ? Math.round(ultimos3.reduce((a,[,v])=>a+v.gas,0)/ultimos3.length) : 0
  const cajaInicial = historial.reduce((a,[,v])=>a+v.ing-v.gas, 0)

  function getMesesFuturos(h: number) {
    const meses = []
    for (let i=1; i<=h; i++) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth()+i, 1)
      meses.push(`${MESES[d.getMonth()]} ${d.getFullYear()}`)
    }
    return meses
  }

  function calcEsc(vI: number, vG: number, h: number) {
    const ing: number[] = [], gas: number[] = [], flujo: number[] = [], acum: number[] = []
    let caja = cajaInicial
    for (let i=0; i<h; i++) {
      const ingM = Math.round(promedioIng*(1+vI/100))
      const gasM = Math.round(promedioGas*(1+vG/100))
      const fl   = ingM - gasM
      caja += fl
      ing.push(ingM); gas.push(gasM); flujo.push(fl); acum.push(caja)
    }
    return { ing, gas, flujo, acum }
  }

  const mesesFuturos = getMesesFuturos(horizonte)
  const base = calcEsc(0, 0, horizonte)
  const opt  = calcEsc(varIngOpt, varGasOpt, horizonte)
  const pes  = calcEsc(varIngPes, varGasPes, horizonte)
  const sel  = escenario==='opt'?opt:escenario==='pes'?pes:base
  const hayRiesgo = Math.min(...pes.acum) < minCaja

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
        <div style={{ height:56, display:'flex', alignItems:'center', borderBottom:'1px solid rgba(255,255,255,0.08)', marginBottom:12, marginLeft:-12, marginRight:-12, paddingLeft:20, fontSize:15, fontWeight:600, color:'#B8912E' }}>📊 Finanzas Grupo</div>
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
            <div style={{ fontSize:15, fontWeight:600 }}>Proyección de caja</div>
            {!cargando && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:'rgba(29,158,117,0.16)', color:'#1D9E75', fontWeight:500 }}>🟢 Historial real</span>}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <select value={empresa} onChange={e=>setEmpresa(e.target.value)} style={{ fontSize:13, padding:'6px 10px', border:'1px solid rgba(255,255,255,0.14)', borderRadius:8, background:'#161616' }}>
              <option value="all">{esAdmin?'Grupo completo':'Mis empresas'}</option>
              {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre_corto}</option>)}
            </select>
            {([3,6] as const).map(h=>(
              <button key={h} onClick={()=>setHorizonte(h)} style={{ padding:'5px 12px', borderRadius:7, fontSize:12, cursor:'pointer', border:'1px solid rgba(255,255,255,0.1)', background:horizonte===h?'#B8912E':'#161616', color:horizonte===h?'#fff':'#9A9A9A' }}>{h} meses</button>
            ))}
          </div>
        </div>

        <div className="app-main" style={{ padding:'24px 28px' }}>
          {cargando && <div style={{ textAlign:'center', padding:'4rem', color:'#767676' }}>⏳ Cargando...</div>}

          {!cargando && (
            <>
              <div style={{ background:'rgba(184,145,46,0.16)', border:'1px solid rgba(184,145,46,0.4)', borderRadius:10, padding:'10px 16px', marginBottom:20, fontSize:12, color:'#B8912E' }}>
                <strong>Base:</strong> Promedio últimos {ultimos3.length} meses — Ing: <strong>{fmtM(promedioIng)}/mes</strong> · Gas: <strong>{fmtM(promedioGas)}/mes</strong>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12, marginBottom:20 }}>
                {[
                  { label:'Caja actual',        value:fmtM(cajaInicial),              color:'#B8912E', bg:'rgba(184,145,46,0.16)' },
                  { label:'Proyección base',     value:fmtM(base.acum[horizonte-1]),   color:'#B8912E', bg:'rgba(184,145,46,0.16)' },
                  { label:'Optimista',           value:fmtM(opt.acum[horizonte-1]),    color:'#1D9E75', bg:'rgba(29,158,117,0.16)' },
                  { label:'Pesimista',           value:fmtM(pes.acum[horizonte-1]),    color:'#E24B4A', bg:'rgba(226,75,74,0.16)' },
                ].map(m=>(
                  <div key={m.label} style={{ background:m.bg, borderRadius:12, padding:'14px 16px' }}>
                    <div style={{ fontSize:11, color:m.color, fontWeight:500, marginBottom:4, opacity:0.8 }}>{m.label}</div>
                    <div style={{ fontSize:20, fontWeight:700, color:m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {hayRiesgo ? (
                <div style={{ background:'rgba(186,117,23,0.18)', border:'1px solid #EF9F27', borderRadius:10, padding:'10px 16px', marginBottom:16, fontSize:13, color:'#BA7517' }}>
                  ⚠️ En escenario pesimista la caja baja de {fmtM(minCaja)}. Considera una línea de crédito preventiva.
                </div>
              ) : (
                <div style={{ background:'rgba(29,158,117,0.14)', border:'1px solid rgba(29,158,117,0.4)', borderRadius:10, padding:'10px 16px', marginBottom:16, fontSize:13, color:'#1D9E75' }}>
                  ✅ Caja proyectada positiva en todos los escenarios durante los próximos {horizonte} meses.
                </div>
              )}

              <div style={{ display:'flex', gap:6, marginBottom:20 }}>
                {([{k:'grafico',l:'📈 Proyección'},{k:'supuestos',l:'⚙️ Supuestos'},{k:'tabla',l:'📋 Tabla'}] as const).map(t=>(
                  <button key={t.k} onClick={()=>setTab(t.k)} style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer', border:'1px solid rgba(255,255,255,0.1)', background:tab===t.k?'rgba(184,145,46,0.16)':'#161616', color:tab===t.k?'#B8912E':'#9A9A9A', fontWeight:tab===t.k?500:400 }}>{t.l}</button>
                ))}
              </div>

              {tab==='grafico' && (
                <>
                  <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                    {([{k:'opt',l:'Optimista',c:'#1D9E75'},{k:'base',l:'Base',c:'#B8912E'},{k:'pes',l:'Pesimista',c:'#E24B4A'}] as const).map(e=>(
                      <button key={e.k} onClick={()=>setEscenario(e.k)} style={{ padding:'6px 14px', borderRadius:999, fontSize:12, cursor:'pointer', fontWeight:500, border:`1.5px solid ${e.c}`, background:escenario===e.k?e.c:'transparent', color:escenario===e.k?'#fff':e.c }}>{e.l}</button>
                    ))}
                  </div>
                  <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:20, marginBottom:16 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'#9A9A9A', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:14 }}>Flujo neto mensual proyectado</div>
                    <div style={{ display:'flex', alignItems:'flex-end', gap:10, height:120 }}>
                      {sel.ing.map((ing,i)=>{
                        const gas = sel.gas[i]
                        const maxV = Math.max(...sel.ing,...sel.gas,1)
                        const hI = Math.round(ing/maxV*100)
                        const hG = Math.round(gas/maxV*100)
                        return (
                          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                            <div style={{ fontSize:10, color:sel.flujo[i]>=0?'#1D9E75':'#E24B4A', fontWeight:500 }}>{fmtM(sel.flujo[i])}</div>
                            <div style={{ width:'100%', display:'flex', gap:2, alignItems:'flex-end' }}>
                              <div style={{ flex:1, height:Math.max(hI,2), background:'#B8912E', borderRadius:'2px 2px 0 0' }}/>
                              <div style={{ flex:1, height:Math.max(hG,2), background:'#E24B4A', borderRadius:'2px 2px 0 0' }}/>
                            </div>
                            <div style={{ fontSize:9, color:'#767676', textAlign:'center' }}>{mesesFuturos[i]?.slice(0,6)}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}

              {tab==='supuestos' && (
                <>
                  {[
                    { title:'🟢 Escenario optimista', items:[
                      { label:'Aumento ingresos', value:varIngOpt, set:setVarIngOpt, min:0, max:40, color:'#1D9E75' },
                      { label:'Reducción gastos',  value:varGasOpt, set:setVarGasOpt, min:-20, max:0, color:'#1D9E75' },
                    ]},
                    { title:'🔴 Escenario pesimista', items:[
                      { label:'Caída ingresos',   value:varIngPes, set:setVarIngPes, min:-40, max:0, color:'#E24B4A' },
                      { label:'Aumento gastos',   value:varGasPes, set:setVarGasPes, min:0, max:30, color:'#E24B4A' },
                    ]},
                  ].map(grupo=>(
                    <div key={grupo.title} style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:20, marginBottom:14 }}>
                      <div style={{ fontSize:14, fontWeight:600, marginBottom:16 }}>{grupo.title}</div>
                      {grupo.items.map(item=>(
                        <div key={item.label} style={{ marginBottom:16 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6 }}>
                            <span>{item.label}</span>
                            <span style={{ fontWeight:600, color:item.color }}>{item.value>0?'+':''}{item.value}%</span>
                          </div>
                          <input type="range" min={item.min} max={item.max} value={item.value}
                            onChange={e=>item.set(parseInt(e.target.value))}
                            style={{ width:'100%', accentColor:item.color }}/>
                        </div>
                      ))}
                    </div>
                  ))}
                  <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:20 }}>
                    <div style={{ fontSize:14, fontWeight:600, marginBottom:16 }}>⚙️ Caja mínima requerida</div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6 }}>
                      <span>Mínimo</span><span style={{ fontWeight:600, color:'#B8912E' }}>{fmtM(minCaja)}</span>
                    </div>
                    <input type="range" min={500000} max={10000000} step={100000} value={minCaja}
                      onChange={e=>setMinCaja(parseInt(e.target.value))}
                      style={{ width:'100%', accentColor:'#B8912E' }}/>
                  </div>
                </>
              )}

              {tab==='tabla' && (
                <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, overflow:'hidden' }}>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:600 }}>
                      <thead>
                        <tr style={{ background:'#1A1A1A' }}>
                          <th style={{ textAlign:'left', padding:'9px 12px', fontWeight:500, color:'#9A9A9A', borderBottom:'1px solid rgba(255,255,255,0.08)', whiteSpace:'nowrap' as const }}>Concepto</th>
                          {mesesFuturos.map(m=><th key={m} style={{ textAlign:'right', padding:'9px 8px', fontWeight:500, color:'#9A9A9A', borderBottom:'1px solid rgba(255,255,255,0.08)', whiteSpace:'nowrap' as const }}>{m.slice(0,6)}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label:'Ingresos (opt)',   data:opt.ing,  color:'#1D9E75', bg:'rgba(29,158,117,0.12)' },
                          { label:'Ingresos (base)',  data:base.ing, color:'#B8912E', bg:'rgba(184,145,46,0.16)' },
                          { label:'Ingresos (pes)',   data:pes.ing,  color:'#E24B4A', bg:'rgba(226,75,74,0.12)' },
                          { label:'Gastos (base)',    data:base.gas, color:'#9A9A9A', bg:'' },
                          { label:'Flujo (opt)',      data:opt.flujo, color:'#1D9E75', bg:'rgba(29,158,117,0.12)', bold:true },
                          { label:'Flujo (base)',     data:base.flujo,color:'#B8912E', bg:'rgba(184,145,46,0.16)', bold:true },
                          { label:'Flujo (pes)',      data:pes.flujo, color:'#E24B4A', bg:'rgba(226,75,74,0.12)', bold:true },
                          { label:'Caja (opt)',       data:opt.acum,  color:'#1D9E75', bg:'rgba(29,158,117,0.12)' },
                          { label:'Caja (base)',      data:base.acum, color:'#B8912E', bg:'rgba(184,145,46,0.16)' },
                          { label:'Caja (pes)',       data:pes.acum,  color:'#E24B4A', bg:'rgba(226,75,74,0.12)' },
                        ].map(row=>(
                          <tr key={row.label} style={{ background:row.bg||'transparent' }}>
                            <td style={{ padding:'8px 12px', color:row.color, fontWeight:(row as any).bold?600:400, fontSize:12 }}>{row.label}</td>
                            {row.data.map((v,i)=>(
                              <td key={i} style={{ padding:'8px 8px', textAlign:'right', color:v<0?'#E24B4A':'#C9C9C9' }}>{fmtM(v)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Historial real */}
              <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:20, marginTop:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#9A9A9A', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:14 }}>Historial real — base de la proyección</div>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead><tr style={{ background:'#1A1A1A' }}>
                    {['Mes','Ingresos','Gastos','Flujo neto'].map(h=>(
                      <th key={h} style={{ textAlign:'left', padding:'8px 12px', fontWeight:500, color:'#9A9A9A', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {historial.map(([key,val],i)=>{
                      const [y,m] = key.split('-')
                      const fl = val.ing-val.gas
                      return (
                        <tr key={key} style={{ borderBottom:i<historial.length-1?'1px solid rgba(255,255,255,0.06)':'none' }}>
                          <td style={{ padding:'8px 12px', fontWeight:500 }}>{MESES[parseInt(m)-1]} {y}</td>
                          <td style={{ padding:'8px 12px', color:'#1D9E75', fontWeight:600 }}>{fmtCLP(val.ing)}</td>
                          <td style={{ padding:'8px 12px', color:'#E24B4A' }}>{fmtCLP(val.gas)}</td>
                          <td style={{ padding:'8px 12px', fontWeight:700, color:fl>=0?'#B8912E':'#E24B4A' }}>{fmtCLP(fl)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
