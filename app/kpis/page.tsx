'use client'
import { useState } from 'react'
import Link from 'next/link'

const NAV = [
  { href:'/',             label:'Dashboard',    icon:'▦'  },
  { href:'/movimientos',  label:'Movimientos',  icon:'↕'  },
  { href:'/presupuesto',  label:'Presupuesto',  icon:'🎯' },
  { href:'/alertas',      label:'Alertas',      icon:'🔔' },
  { href:'/reportes',     label:'Reportes',     icon:'📄' },
  { href:'/bancos',       label:'Bancos',       icon:'🏦' },
  { href:'/tributario',   label:'Documentos',   icon:'🧾' },
  { href:'/proyecciones', label:'Proyecciones', icon:'📈' },
  { href:'/usuarios',     label:'Usuarios',     icon:'👥' },
  { href:'/kpis',         label:'KPIs',         icon:'📊', active:true },
  { href:'/ia',           label:'Análisis IA',  icon:'🧠' },
]

const MESES = ['Ene','Feb','Mar','Abr','May','Jun']

const EMP_DATA = {
  A: { nombre:'Empresa A', color:'#3266ad',
    ing:[4200,5100,4800,6200,5900,7100],
    gas:[3100,3400,3200,4100,3800,4200],
    clientes:[12,14,13,17,16,19],
    metas:{ ingresos:80000, margen:38, ebitda:35, crecimiento:15, gastoIng:58, cobranza:30 } },
  B: { nombre:'Empresa B', color:'#1D9E75',
    ing:[2800,3200,3500,3100,4000,4400],
    gas:[2100,2400,2200,2600,2900,3000],
    clientes:[8,9,10,9,11,12],
    metas:{ ingresos:48000, margen:32, ebitda:28, crecimiento:12, gastoIng:68, cobranza:25 } },
  C: { nombre:'Empresa C', color:'#BA7517',
    ing:[1500,1800,2100,1900,2400,2800],
    gas:[1200,1400,1600,1500,1800,2000],
    clientes:[4,5,6,5,7,8],
    metas:{ ingresos:24000, margen:28, ebitda:25, crecimiento:10, gastoIng:72, cobranza:20 } },
}

type EmpKey = 'A'|'B'|'C'|'all'

function fmtM(n: number) {
  const a = Math.abs(n)
  const s = n < 0 ? '-' : ''
  if (a >= 1e6) return s+'$'+(Math.round(a/1e5)/10)+'M'
  if (a >= 1000) return s+'$'+Math.round(a/1000)+'K'
  return s+'$'+Math.round(a)
}

function getEmpData(key: EmpKey) {
  if (key === 'all') {
    const keys = ['A','B','C'] as const
    return {
      nombre:'Grupo', color:'#7F77DD',
      ing: MESES.map((_,i) => keys.reduce((a,k)=>a+EMP_DATA[k].ing[i],0)),
      gas: MESES.map((_,i) => keys.reduce((a,k)=>a+EMP_DATA[k].gas[i],0)),
      clientes: MESES.map((_,i) => keys.reduce((a,k)=>a+EMP_DATA[k].clientes[i],0)),
      metas:{ ingresos:152000, margen:38, ebitda:33, crecimiento:14, gastoIng:62, cobranza:28 },
    }
  }
  return EMP_DATA[key]
}

function semColor(pct: number, invert = false) {
  if (invert) return pct > 100 ? '#E24B4A' : pct > 85 ? '#EF9F27' : '#1D9E75'
  return pct >= 100 ? '#1D9E75' : pct >= 75 ? '#EF9F27' : '#E24B4A'
}
function semLabel(pct: number, invert = false) {
  if (invert) return pct > 100 ? 'Excedido' : pct > 85 ? 'En límite' : 'Óptimo'
  return pct >= 100 ? 'Logrado' : pct >= 75 ? 'En curso' : 'Bajo meta'
}

export default function KpisPage() {
  const [empresa, setEmpresa] = useState<EmpKey>('A')
  const [tab,     setTab]     = useState<'panel'|'tendencias'|'metas'>('panel')

  const d    = getEmpData(empresa)
  const ingT = d.ing.reduce((a,b)=>a+b,0)
  const gasT = d.gas.reduce((a,b)=>a+b,0)
  const util = ingT - gasT
  const margenR   = Math.round(util/ingT*100)
  const ebitdaR   = Math.round(margenR*0.92)
  const gasIngR   = Math.round(gasT/ingT*100)
  const crecR     = Math.round((d.ing[5]-d.ing[4])/d.ing[4]*100)
  const cobranzaR = 28

  const [metas, setMetas] = useState({ ...d.metas })

  const kpis = [
    { icon:'📈', label:'Ingresos YTD',       val:fmtM(ingT),          metaV:metas.ingresos*1000, realV:ingT,         pct:Math.round(ingT/metas.ingresos/1000*100),          invert:false, delta:`+14% vs 2024`,           deltaUp:true   },
    { icon:'💹', label:'Margen neto',         val:margenR+'%',         metaV:metas.margen,        realV:margenR,      pct:Math.round(margenR/metas.margen*100),              invert:false, delta:`Meta ${metas.margen}%`,  deltaUp:margenR>=metas.margen },
    { icon:'🏢', label:'EBITDA',              val:ebitdaR+'%',         metaV:metas.ebitda,        realV:ebitdaR,      pct:Math.round(ebitdaR/metas.ebitda*100),              invert:false, delta:`Meta ${metas.ebitda}%`,  deltaUp:ebitdaR>=metas.ebitda },
    { icon:'🚀', label:'Crecimiento ing.',    val:(crecR>0?'+':'')+crecR+'%', metaV:metas.crecimiento, realV:crecR,  pct:Math.round(Math.max(0,crecR)/metas.crecimiento*100), invert:false, delta:'vs mes anterior',       deltaUp:crecR>0 },
    { icon:'💰', label:'Gasto / Ingreso',     val:gasIngR+'%',         metaV:metas.gastoIng,      realV:gasIngR,      pct:Math.round(metas.gastoIng/gasIngR*100),            invert:true,  delta:`Límite ${metas.gastoIng}%`, deltaUp:gasIngR<=metas.gastoIng },
    { icon:'⏱️', label:'Días cobranza',       val:cobranzaR+' días',   metaV:metas.cobranza,      realV:cobranzaR,    pct:Math.round(metas.cobranza/cobranzaR*100),          invert:true,  delta:`Meta ≤${metas.cobranza} días`, deltaUp:cobranzaR<=metas.cobranza },
  ]

  const maxBar = Math.max(...d.ing, ...d.gas)

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
          <div style={{ fontSize:15, fontWeight:600 }}>KPIs ejecutivos</div>
          <select value={empresa} onChange={e=>{ setEmpresa(e.target.value as EmpKey); setMetas(getEmpData(e.target.value as EmpKey).metas) }} style={sel}>
            <option value="A">Empresa A</option>
            <option value="B">Empresa B</option>
            <option value="C">Empresa C</option>
            <option value="all">Grupo completo</option>
          </select>
        </div>

        <div style={{ padding:'24px 28px' }}>

          {/* Tabs */}
          <div style={{ display:'flex', gap:6, marginBottom:24 }}>
            {([
              { key:'panel',     label:'📊 Panel'      },
              { key:'tendencias',label:'📈 Tendencias'  },
              { key:'metas',     label:'🎯 Metas'       },
            ] as const).map(t => (
              <button key={t.key} onClick={()=>setTab(t.key)} style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer', border:'1px solid rgba(0,0,0,0.1)', background:tab===t.key?'#eff4ff':'#fff', color:tab===t.key?'#3266ad':'#6b7280', fontWeight:tab===t.key?500:400 }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Tab: Panel ── */}
          {tab === 'panel' && (
            <>
              {/* Grid KPIs */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:14, marginBottom:24 }}>
                {kpis.map(k => {
                  const pct = Math.min(100, k.pct)
                  const color = semColor(k.pct, k.invert)
                  const bg = color==='#1D9E75'?'#E1F5EE':color==='#EF9F27'?'#FAEEDA':'#FCEBEB'
                  return (
                    <div key={k.label} style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:16, position:'relative' }}>
                      {/* Semáforo */}
                      <div style={{ position:'absolute', top:12, right:12, width:10, height:10, borderRadius:'50%', background:color, boxShadow:`0 0 0 3px ${color}33` }}/>
                      <div style={{ fontSize:20, marginBottom:8 }}>{k.icon}</div>
                      <div style={{ fontSize:11, color:'#6b7280', marginBottom:3 }}>{k.label}</div>
                      <div style={{ fontSize:22, fontWeight:700, color:'#111827', marginBottom:4 }}>{k.val}</div>
                      <div style={{ fontSize:11, color:'#9ca3af', marginBottom:8 }}>{k.delta}</div>
                      {/* Barra progreso */}
                      <div style={{ height:5, background:'#f1f5f9', borderRadius:3, overflow:'hidden', marginBottom:6 }}>
                        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:3, transition:'width 0.5s' }}/>
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:10, color:'#9ca3af' }}>{k.pct}% de meta</span>
                        <span style={{ fontSize:10, padding:'1px 6px', borderRadius:999, fontWeight:600, background:bg, color:color }}>
                          {semLabel(k.pct, k.invert)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Resumen estado */}
              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20 }}>
                <div style={sectionTitle}>Estado general de indicadores</div>
                {kpis.map((k,i) => {
                  const color = semColor(k.pct, k.invert)
                  return (
                    <div key={k.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:i<kpis.length-1?'1px solid rgba(0,0,0,0.06)':'none', flexWrap:'wrap', gap:8 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <span style={{ fontSize:18 }}>{k.icon}</span>
                        <span style={{ fontSize:13, fontWeight:500, color:'#111827' }}>{k.label}</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <span style={{ fontSize:14, fontWeight:600, color:'#374151' }}>{k.val}</span>
                        <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, fontWeight:600,
                          background:color==='#1D9E75'?'#E1F5EE':color==='#EF9F27'?'#FAEEDA':'#FCEBEB',
                          color }}>
                          {semLabel(k.pct, k.invert)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* ── Tab: Tendencias ── */}
          {tab === 'tendencias' && (
            <>
              {/* Gráfico ingresos vs gastos */}
              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20, marginBottom:16 }}>
                <div style={sectionTitle}>Ingresos vs gastos — H1 2025</div>
                <div style={{ display:'flex', gap:12, marginBottom:14 }}>
                  {[{l:'Ingresos',c:'#3266ad'},{l:'Gastos',c:'#E24B4A'},{l:'Utilidad',c:'#1D9E75'}].map(e=>(
                    <span key={e.l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#6b7280' }}>
                      <span style={{ width:10, height:10, borderRadius:2, background:e.c, display:'inline-block' }}/>
                      {e.l}
                    </span>
                  ))}
                </div>
                <div style={{ display:'flex', alignItems:'flex-end', gap:10, height:160 }}>
                  {d.ing.map((ing,i) => {
                    const gas = d.gas[i]
                    const ut  = ing - gas
                    const hI  = Math.round(ing/maxBar*140)
                    const hG  = Math.round(gas/maxBar*140)
                    const hU  = Math.round(ut/maxBar*140)
                    return (
                      <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                        <div style={{ width:'100%', display:'flex', gap:2, alignItems:'flex-end' }}>
                          <div style={{ flex:1, height:hI, background:'#3266ad', borderRadius:'2px 2px 0 0' }}/>
                          <div style={{ flex:1, height:hG, background:'#E24B4A', borderRadius:'2px 2px 0 0' }}/>
                          <div style={{ flex:1, height:hU, background:'#1D9E75', borderRadius:'2px 2px 0 0' }}/>
                        </div>
                        <div style={{ fontSize:10, color:'#9ca3af' }}>{MESES[i]}</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Gráfico margen */}
              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20, marginBottom:16 }}>
                <div style={sectionTitle}>Evolución margen neto % — meta {metas.margen}%</div>
                <div style={{ display:'flex', alignItems:'flex-end', gap:10, height:100 }}>
                  {d.ing.map((ing,i) => {
                    const m = Math.round((ing-d.gas[i])/ing*100)
                    const h = Math.round(m/50*80)
                    const onMeta = m >= metas.margen
                    return (
                      <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                        <div style={{ fontSize:10, fontWeight:600, color:onMeta?'#1D9E75':'#E24B4A' }}>{m}%</div>
                        <div style={{ width:'100%', height:h, background:onMeta?'#1D9E75':'#E24B4A', borderRadius:'3px 3px 0 0' }}/>
                        <div style={{ fontSize:10, color:'#9ca3af' }}>{MESES[i]}</div>
                      </div>
                    )
                  })}
                </div>
                {/* Línea meta */}
                <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:8 }}>
                  <div style={{ flex:1, height:1, borderTop:'1px dashed #d1d5db' }}/>
                  <span style={{ fontSize:10, color:'#9ca3af' }}>Meta {metas.margen}%</span>
                </div>
              </div>

              {/* Clientes */}
              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20 }}>
                <div style={sectionTitle}>Clientes activos por mes</div>
                <div style={{ display:'flex', alignItems:'flex-end', gap:10, height:80 }}>
                  {d.clientes.map((c,i) => {
                    const maxC = Math.max(...d.clientes)
                    const h = Math.round(c/maxC*70)
                    return (
                      <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                        <div style={{ fontSize:10, fontWeight:600, color:'#BA7517' }}>{c}</div>
                        <div style={{ width:'100%', height:h, background:'#BA7517', borderRadius:'3px 3px 0 0', opacity:0.8 }}/>
                        <div style={{ fontSize:10, color:'#9ca3af' }}>{MESES[i]}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* ── Tab: Metas ── */}
          {tab === 'metas' && (
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20 }}>
              <div style={{ fontSize:13, color:'#6b7280', marginBottom:16 }}>
                Edita las metas haciendo clic en el valor numérico
              </div>
              {[
                { label:'Ingresos anuales (miles)', key:'ingresos',   real:fmtM(ingT),          pct:Math.round(ingT/metas.ingresos/1000*100),              invert:false, sufijo:' K' },
                { label:'Margen neto',              key:'margen',     real:margenR+'%',          pct:Math.round(margenR/metas.margen*100),                  invert:false, sufijo:'%'  },
                { label:'EBITDA',                   key:'ebitda',     real:ebitdaR+'%',          pct:Math.round(ebitdaR/metas.ebitda*100),                  invert:false, sufijo:'%'  },
                { label:'Crecimiento ingresos',     key:'crecimiento',real:(crecR>0?'+':'')+crecR+'%', pct:Math.round(Math.max(0,crecR)/metas.crecimiento*100), invert:false, sufijo:'%'  },
                { label:'Gasto / Ingreso (límite)', key:'gastoIng',   real:gasIngR+'%',          pct:Math.round(metas.gastoIng/gasIngR*100),                invert:true,  sufijo:'%'  },
                { label:'Días cobranza (límite)',   key:'cobranza',   real:cobranzaR+' días',    pct:Math.round(metas.cobranza/cobranzaR*100),              invert:true,  sufijo:' días' },
              ].map((row, i) => {
                const color = semColor(row.pct, row.invert)
                const bg = color==='#1D9E75'?'#E1F5EE':color==='#EF9F27'?'#FAEEDA':'#FCEBEB'
                return (
                  <div key={row.key} style={{ marginBottom:18 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6, flexWrap:'wrap', gap:8 }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:500, color:'#111827' }}>{row.label}</div>
                        <div style={{ fontSize:12, color:'#6b7280', marginTop:1 }}>Real: <strong style={{ color:'#374151' }}>{row.real}</strong></div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:10, color:'#9ca3af', marginBottom:2 }}>Meta</div>
                          <input
                            type="number"
                            value={(metas as any)[row.key]}
                            onChange={e => setMetas(prev => ({ ...prev, [row.key]: parseFloat(e.target.value)||0 }))}
                            style={{ width:90, fontSize:14, fontWeight:600, textAlign:'right', border:'none', borderBottom:'1.5px solid #e5e7eb', background:'transparent', color:'#111827', padding:'2px 4px' }}
                          />
                          <span style={{ fontSize:11, color:'#6b7280' }}>{row.sufijo}</span>
                        </div>
                        <div style={{ textAlign:'center', minWidth:60 }}>
                          <div style={{ fontSize:16, fontWeight:700, color }}>{Math.min(999,row.pct)}%</div>
                          <span style={{ fontSize:10, padding:'1px 6px', borderRadius:999, fontWeight:600, background:bg, color }}>{semLabel(row.pct,row.invert)}</span>
                        </div>
                      </div>
                    </div>
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
const sectionTitle: React.CSSProperties = { fontSize:12, fontWeight:600, color:'#6b7280', textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:14 }
