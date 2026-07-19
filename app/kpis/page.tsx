'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
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
  { href:'/proyecciones', label:'Proyecciones', icon:'📈' },
  { href:'/usuarios',     label:'Usuarios',     icon:'👥' },
  { href:'/kpis',         label:'KPIs',         icon:'📊' },
  { href:'/ia',           label:'Análisis IA',  icon:'🧠' },
]

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

type Empresa  = { id: string; nombre_corto: string; color: string }
type Mov      = { empresa_id: string; tipo: string; monto: number; fecha: string; categoria: string }

function fmtM(n: number) {
  const a=Math.abs(n),s=n<0?'-':''
  if(a>=1e6) return s+'$'+(Math.round(a/1e5)/10)+'M'
  if(a>=1000) return s+'$'+Math.round(a/1000)+'K'
  return s+'$'+Math.round(a)
}
function fmtCLP(n: number) {
  return (n<0?'-':'')+'$'+Math.round(Math.abs(n)).toLocaleString('es-CL')
}

function semColor(pct: number, invert=false) {
  if (invert) return pct>100?'#E24B4A':pct>85?'#EF9F27':'#1D9E75'
  return pct>=100?'#1D9E75':pct>=75?'#EF9F27':'#E24B4A'
}
function semLabel(pct: number, invert=false) {
  if (invert) return pct>100?'Excedido':pct>85?'En límite':'Óptimo'
  return pct>=100?'Logrado':pct>=75?'En curso':'Bajo meta'
}

export default function KpisPage() {
  const [empresas,    setEmpresas]    = useState<Empresa[]>([])
  const [movimientos, setMovimientos] = useState<Mov[]>([])
  const [cargando,    setCargando]    = useState(true)
  const [empresa,     setEmpresa]     = useState('all')
  const [tab,         setTab]         = useState<'panel'|'tendencias'|'metas'>('panel')

  // Metas editables
  const [metaMargen,      setMetaMargen]      = useState(30)
  const [metaGastoIng,    setMetaGastoIng]    = useState(70)
  const [metaCrecimiento, setMetaCrecimiento] = useState(10)

  const hoy        = new Date()
  const mesActual  = hoy.getMonth() + 1
  const anioActual = hoy.getFullYear()

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setCargando(true)
    try {
      const [{ data: emps }, { data: movs }] = await Promise.all([
        supabase.from('empresas').select('id,nombre_corto,color').eq('activa',true).order('nombre_corto'),
        supabase.from('movimientos').select('empresa_id,tipo,monto,fecha,categoria').order('fecha').limit(1000),
      ])
      setEmpresas(emps || [])
      setMovimientos(movs || [])
    } catch(e) { console.error(e) }
    finally { setCargando(false) }
  }

  // ── Scope filtrado ──
  const scope = movimientos.filter(m => empresa==='all' || m.empresa_id===empresa)

  // ── Mes actual y anterior ──
  const scopeMes  = scope.filter(m => { const [y,mo]=m.fecha.split('-'); return parseInt(y)===anioActual&&parseInt(mo)===mesActual })
  const mesAnt    = mesActual===1 ? 12 : mesActual-1
  const anioAnt   = mesActual===1 ? anioActual-1 : anioActual
  const scopeAnt  = scope.filter(m => { const [y,mo]=m.fecha.split('-'); return parseInt(y)===anioAnt&&parseInt(mo)===mesAnt })

  // ── KPIs calculados ──
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

  // ── Datos por mes para gráfico tendencias ──
  const porMes: Record<string,{ing:number;gas:number}> = {}
  scope.forEach(m => {
    const key = m.fecha.slice(0,7)
    if (!porMes[key]) porMes[key] = {ing:0,gas:0}
    if (m.tipo==='ingreso') porMes[key].ing += m.monto
    else porMes[key].gas += m.monto
  })
  const mesesData = Object.entries(porMes).sort((a,b)=>a[0].localeCompare(b[0]))
  const maxBar    = Math.max(...mesesData.map(([,v])=>Math.max(v.ing,v.gas)), 1)

  // ── Top categorías gasto ──
  const topGastos: Record<string,number> = {}
  scope.filter(m=>m.tipo==='gasto').forEach(m => {
    topGastos[m.categoria] = (topGastos[m.categoria]||0) + m.monto
  })
  const topArr = Object.entries(topGastos).sort((a,b)=>b[1]-a[1]).slice(0,5)
  const maxTop = Math.max(...topArr.map(([,v])=>v), 1)

  // ── KPIs con metas ──
  const kpis = [
    { icon:'📈', label:'Ingresos totales',    val:fmtM(ingTotal),          sub:`Mes: ${fmtM(ingMes)}`,    pct:100, invert:false, color:'#1D9E75', bg:'#E1F5EE' },
    { icon:'💹', label:'Margen neto',          val:margenR+'%',             sub:`Meta: ${metaMargen}%`,    pct:Math.round(margenR/metaMargen*100), invert:false, color:'', bg:'' },
    { icon:'🏢', label:'Margen mes actual',    val:margenMes+'%',           sub:MESES[mesActual-1]+' '+anioActual, pct:Math.round(margenMes/metaMargen*100), invert:false, color:'', bg:'' },
    { icon:'🚀', label:'Crecimiento ingresos', val:(crecR>0?'+':'')+crecR+'%', sub:'vs mes anterior',     pct:ingAnt>0?Math.round(Math.max(0,crecR)/metaCrecimiento*100):0, invert:false, color:'', bg:'' },
    { icon:'💰', label:'Gasto / Ingreso',      val:gasIngR+'%',             sub:`Límite: ${metaGastoIng}%`, pct:Math.round(metaGastoIng/Math.max(gasIngR,1)*100), invert:true, color:'', bg:'' },
    { icon:'📊', label:'Utilidad total',       val:fmtM(util),              sub:`Mes: ${fmtM(utilMes)}`,   pct:100, invert:false, color:util>=0?'#3266ad':'#E24B4A', bg:util>=0?'#E6F1FB':'#FCEBEB' },
  ]

  // ── Ranking empresas ──
  const ranking = empresas.map(emp => {
    const movEmp = movimientos.filter(m=>m.empresa_id===emp.id)
    const ing = movEmp.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)
    const gas = movEmp.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0)
    const ut  = ing - gas
    const mg  = ing>0 ? Math.round(ut/ing*100) : 0
    return { ...emp, ing, gas, ut, mg }
  }).sort((a,b)=>b.ut-a.ut)

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
            <div style={{ fontSize:15, fontWeight:600 }}>KPIs ejecutivos</div>
            {!cargando && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:'#E1F5EE', color:'#085041', fontWeight:500 }}>🟢 Datos reales</span>}
          </div>
          <select value={empresa} onChange={e=>setEmpresa(e.target.value)} style={sel}>
            <option value="all">Grupo completo</option>
            {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre_corto}</option>)}
          </select>
        </div>

        <div style={{ padding:'24px 28px' }}>

          {/* Tabs */}
          <div style={{ display:'flex', gap:6, marginBottom:24 }}>
            {([
              {k:'panel',     l:'📊 Panel'},
              {k:'tendencias',l:'📈 Tendencias'},
              {k:'metas',     l:'🎯 Metas'},
            ] as const).map(t=>(
              <button key={t.k} onClick={()=>setTab(t.k)} style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer', border:'1px solid rgba(0,0,0,0.1)', background:tab===t.k?'#eff4ff':'#fff', color:tab===t.k?'#3266ad':'#6b7280', fontWeight:tab===t.k?500:400 }}>
                {t.l}
              </button>
            ))}
          </div>

          {cargando && <div style={{ textAlign:'center', padding:'4rem', color:'#9ca3af' }}>⏳ Cargando datos reales...</div>}

          {/* ── Panel ── */}
          {!cargando && tab==='panel' && (
            <>
              {/* KPI Cards */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:14, marginBottom:24 }}>
                {kpis.map(k=>{
                  const pct   = Math.min(100, k.pct)
                  const color = k.color || semColor(k.pct, k.invert)
                  const bg    = k.bg    || (color==='#1D9E75'?'#E1F5EE':color==='#EF9F27'?'#FAEEDA':'#FCEBEB')
                  return (
                    <div key={k.label} style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:16, position:'relative' }}>
                      <div style={{ position:'absolute', top:12, right:12, width:10, height:10, borderRadius:'50%', background:color, boxShadow:`0 0 0 3px ${color}33` }}/>
                      <div style={{ fontSize:20, marginBottom:8 }}>{k.icon}</div>
                      <div style={{ fontSize:11, color:'#6b7280', marginBottom:3 }}>{k.label}</div>
                      <div style={{ fontSize:22, fontWeight:700, color:'#111827', marginBottom:4 }}>{k.val}</div>
                      <div style={{ fontSize:11, color:'#9ca3af', marginBottom:8 }}>{k.sub}</div>
                      <div style={{ height:5, background:'#f1f5f9', borderRadius:3, overflow:'hidden', marginBottom:6 }}>
                        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:3, transition:'width 0.5s' }}/>
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between' }}>
                        <span style={{ fontSize:10, color:'#9ca3af' }}>{k.pct}%</span>
                        <span style={{ fontSize:10, padding:'1px 6px', borderRadius:999, fontWeight:600, background:bg, color }}>{semLabel(k.pct, k.invert)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Ranking empresas */}
              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20, marginBottom:16 }}>
                <div style={sTitle}>Ranking por utilidad neta</div>
                {ranking.map((e,i)=>(
                  <div key={e.id} style={{ marginBottom:16 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                      <span style={{ fontSize:18, fontWeight:700, color:'#e5e7eb', width:20 }}>{i+1}</span>
                      <span style={{ width:9, height:9, borderRadius:'50%', background:e.color, flexShrink:0 }}/>
                      <span style={{ flex:1, fontSize:13, fontWeight:500, color:'#111827' }}>{e.nombre_corto}</span>
                      <span style={{ fontSize:12, color:'#6b7280' }}>Ing: {fmtM(e.ing)}</span>
                      <span style={{ fontSize:12, color:'#6b7280' }}>Margen {e.mg}%</span>
                      <span style={{ fontSize:14, fontWeight:700, color:e.ut>=0?'#1D9E75':'#E24B4A' }}>{fmtM(e.ut)}</span>
                    </div>
                    <div style={{ height:6, background:'#f1f5f9', borderRadius:3, overflow:'hidden', marginLeft:28 }}>
                      <div style={{ height:'100%', width:`${Math.max(0,Math.min(100,e.ing>0?Math.round(e.ut/e.ing*100*2):0))}%`, background:e.color, borderRadius:3 }}/>
                    </div>
                  </div>
                ))}
              </div>

              {/* Top gastos */}
              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20 }}>
                <div style={sTitle}>Top categorías de gasto</div>
                {topArr.map(([cat, val])=>(
                  <div key={cat} style={{ marginBottom:12 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:13, color:'#374151', fontWeight:500 }}>{cat}</span>
                      <span style={{ fontSize:13, fontWeight:600, color:'#E24B4A' }}>{fmtCLP(val)}</span>
                    </div>
                    <div style={{ height:6, background:'#f1f5f9', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${Math.round(val/maxTop*100)}%`, background:'#E24B4A', borderRadius:3 }}/>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Tendencias ── */}
          {!cargando && tab==='tendencias' && (
            <>
              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20, marginBottom:16 }}>
                <div style={sTitle}>Ingresos vs gastos por mes</div>
                <div style={{ display:'flex', gap:10, marginBottom:14 }}>
                  {[{l:'Ingresos',c:'#1D9E75'},{l:'Gastos',c:'#E24B4A'}].map(e=>(
                    <span key={e.l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#6b7280' }}>
                      <span style={{ width:10, height:10, borderRadius:2, background:e.c, display:'inline-block' }}/>{e.l}
                    </span>
                  ))}
                </div>
                {mesesData.length===0 ? (
                  <div style={{ textAlign:'center', padding:'2rem', color:'#9ca3af' }}>Sin datos</div>
                ) : (
                  <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:160, overflowX:'auto' }}>
                    {mesesData.map(([key,val])=>{
                      const [y,m] = key.split('-')
                      const hI = Math.round(val.ing/maxBar*140)
                      const hG = Math.round(val.gas/maxBar*140)
                      const neto = val.ing - val.gas
                      return (
                        <div key={key} style={{ flex:'0 0 auto', width:52, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                          <div style={{ fontSize:9, color:neto>=0?'#1D9E75':'#E24B4A', fontWeight:600 }}>{fmtM(neto)}</div>
                          <div style={{ width:'100%', display:'flex', gap:2, alignItems:'flex-end' }}>
                            <div style={{ flex:1, height:Math.max(hI,2), background:'#1D9E75', borderRadius:'2px 2px 0 0' }}/>
                            <div style={{ flex:1, height:Math.max(hG,2), background:'#E24B4A', borderRadius:'2px 2px 0 0' }}/>
                          </div>
                          <div style={{ fontSize:9, color:'#9ca3af', textAlign:'center' }}>{MESES[parseInt(m)-1]} {y.slice(2)}</div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Tabla resumen mensual */}
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
                    {mesesData.map(([key,val],i)=>{
                      const [y,m] = key.split('-')
                      const neto = val.ing - val.gas
                      const mg   = val.ing>0 ? Math.round(neto/val.ing*100) : 0
                      return (
                        <tr key={key} style={{ borderBottom:i<mesesData.length-1?'1px solid rgba(0,0,0,0.06)':'none' }}>
                          <td style={{ padding:'10px 14px', fontWeight:500 }}>{MESES[parseInt(m)-1]} {y}</td>
                          <td style={{ padding:'10px 14px', color:'#1D9E75', fontWeight:600 }}>{fmtCLP(val.ing)}</td>
                          <td style={{ padding:'10px 14px', color:'#E24B4A', fontWeight:600 }}>{fmtCLP(val.gas)}</td>
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
                      <td style={{ padding:'10px 14px', fontWeight:700, color:'#1D9E75' }}>{fmtCLP(mesesData.reduce((a,[,v])=>a+v.ing,0))}</td>
                      <td style={{ padding:'10px 14px', fontWeight:700, color:'#E24B4A' }}>{fmtCLP(mesesData.reduce((a,[,v])=>a+v.gas,0))}</td>
                      <td style={{ padding:'10px 14px', fontWeight:700, color:'#3266ad' }}>{fmtCLP(mesesData.reduce((a,[,v])=>a+v.ing-v.gas,0))}</td>
                      <td style={{ padding:'10px 14px', fontWeight:700, color:'#111827' }}>{margenR}%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}

          {/* ── Metas ── */}
          {!cargando && tab==='metas' && (
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20 }}>
              <div style={{ fontSize:13, color:'#6b7280', marginBottom:20 }}>
                Ajusta tus metas con los sliders — los indicadores del panel se actualizan en tiempo real.
              </div>
              {[
                { label:'Margen neto objetivo', real:margenR+'%', meta:metaMargen, setMeta:setMetaMargen, min:5, max:60, color:'#1D9E75', pct:Math.round(margenR/metaMargen*100), sufijo:'%' },
                { label:'Gasto/Ingreso máximo', real:gasIngR+'%', meta:metaGastoIng, setMeta:setMetaGastoIng, min:40, max:95, color:'#E24B4A', pct:Math.round(metaGastoIng/Math.max(gasIngR,1)*100), invert:true, sufijo:'%' },
                { label:'Crecimiento mensual objetivo', real:(crecR>0?'+':'')+crecR+'%', meta:metaCrecimiento, setMeta:setMetaCrecimiento, min:1, max:50, color:'#3266ad', pct:Math.round(Math.max(0,crecR)/metaCrecimiento*100), sufijo:'%' },
              ].map(row=>{
                const color = semColor(row.pct, row.invert)
                const bg    = color==='#1D9E75'?'#E1F5EE':color==='#EF9F27'?'#FAEEDA':'#FCEBEB'
                return (
                  <div key={row.label} style={{ marginBottom:24 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, flexWrap:'wrap', gap:8 }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:500, color:'#111827' }}>{row.label}</div>
                        <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Real: <strong style={{ color:'#374151' }}>{row.real}</strong></div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:10, color:'#9ca3af', marginBottom:2 }}>Meta</div>
                          <div style={{ fontSize:20, fontWeight:700, color:row.color }}>{row.meta}{row.sufijo}</div>
                        </div>
                        <div style={{ textAlign:'center', minWidth:60 }}>
                          <div style={{ fontSize:16, fontWeight:700, color }}>{Math.min(999,row.pct)}%</div>
                          <span style={{ fontSize:10, padding:'1px 6px', borderRadius:999, fontWeight:600, background:bg, color }}>{semLabel(row.pct, row.invert)}</span>
                        </div>
                      </div>
                    </div>
                    <input type="range" min={row.min} max={row.max} value={row.meta}
                      onChange={e=>row.setMeta(parseInt(e.target.value))}
                      style={{ width:'100%', accentColor:row.color, marginBottom:6 }}/>
                    <div style={{ height:7, background:'#f1f5f9', borderRadius:4, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${Math.min(100,row.pct)}%`, background:color, borderRadius:4, transition:'width 0.4s' }}/>
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

const sel: React.CSSProperties = { fontSize:13, padding:'6px 10px', border:'1px solid rgba(0,0,0,0.12)', borderRadius:8, background:'#fff' }
const sTitle: React.CSSProperties = { fontSize:12, fontWeight:600, color:'#6b7280', textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:14 }
