'use client'
import { useState } from 'react'
import Link from 'next/link'

const MESES_PROY = ['Jul','Ago','Sep','Oct','Nov','Dic']
const MESES_ALL  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const NAV = [
  { href:'/',             label:'Dashboard',    icon:'▦'  },
  { href:'/movimientos',  label:'Movimientos',  icon:'↕'  },
  { href:'/presupuesto',  label:'Presupuesto',  icon:'🎯' },
  { href:'/alertas',      label:'Alertas',      icon:'🔔' },
  { href:'/reportes',     label:'Reportes',     icon:'📄' },
  { href:'/bancos',       label:'Bancos',       icon:'🏦' },
  { href:'/tributario',   label:'Documentos',   icon:'🧾' },
  { href:'/proyecciones', label:'Proyecciones', icon:'📈', active:true },
  { href:'/usuarios',     label:'Usuarios',     icon:'👥' },
  { href:'/kpis',         label:'KPIs',         icon:'📊' },
  { href:'/ia',           label:'Análisis IA',  icon:'🧠' },
]

const EMPRESAS_DATA = {
  A: { nombre:'Empresa A', color:'#3266ad', cajaInicial:8450000,
       ingBase:[7200,7600,7000,7400,8100,8500].map(v=>v*1000),
       gasBase:[4300,4500,4100,4400,4800,5200].map(v=>v*1000) },
  B: { nombre:'Empresa B', color:'#1D9E75', cajaInicial:4380000,
       ingBase:[4400,4700,4300,4500,5000,5300].map(v=>v*1000),
       gasBase:[3000,3200,2900,3100,3400,3600].map(v=>v*1000) },
  C: { nombre:'Empresa C', color:'#BA7517', cajaInicial:1850000,
       ingBase:[2700,2900,2600,2800,3100,3300].map(v=>v*1000),
       gasBase:[1900,2000,1800,1900,2100,2200].map(v=>v*1000) },
}

type EmpKey = 'A'|'B'|'C'|'all'

function fmtM(n: number) {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e6) return sign + '$' + (Math.round(abs/1e5)/10) + 'M'
  if (abs >= 1000) return sign + '$' + Math.round(abs/1000) + 'K'
  return sign + '$' + Math.round(abs)
}
function fmtCLP(n: number) { return (n<0?'-':'') + '$' + Math.round(Math.abs(n)).toLocaleString('es-CL') }

function getEmpData(key: EmpKey) {
  if (key === 'all') {
    const keys = ['A','B','C'] as const
    return {
      nombre: 'Grupo consolidado', color: '#7F77DD',
      cajaInicial: keys.reduce((a,k) => a + EMPRESAS_DATA[k].cajaInicial, 0),
      ingBase: MESES_PROY.map((_,i) => keys.reduce((a,k) => a + EMPRESAS_DATA[k].ingBase[i], 0)),
      gasBase: MESES_PROY.map((_,i) => keys.reduce((a,k) => a + EMPRESAS_DATA[k].gasBase[i], 0)),
    }
  }
  return EMPRESAS_DATA[key]
}

function calcFlujos(emp: ReturnType<typeof getEmpData>, varIng: number, varGas: number, h: number) {
  const ing = emp.ingBase.slice(0,h).map(v => Math.round(v*(1+varIng/100)))
  const gas = emp.gasBase.slice(0,h).map(v => Math.round(v*(1+varGas/100)))
  const flujo = ing.map((v,i) => v - gas[i])
  let caja = emp.cajaInicial
  const cajaAcum = flujo.map(f => { caja += f; return caja })
  return { ing, gas, flujo, cajaAcum }
}

export default function ProyeccionesPage() {
  const [empresa,    setEmpresa]    = useState<EmpKey>('A')
  const [horizonte,  setHorizonte]  = useState(6)
  const [tab,        setTab]        = useState<'grafico'|'supuestos'|'tabla'>('grafico')
  const [escenario,  setEscenario]  = useState<'opt'|'base'|'pes'>('base')

  // Supuestos ajustables
  const [varIngOpt,  setVarIngOpt]  = useState(12)
  const [varGasOpt,  setVarGasOpt]  = useState(-8)
  const [varIngPes,  setVarIngPes]  = useState(-15)
  const [varGasPes,  setVarGasPes]  = useState(12)
  const [minCaja,    setMinCaja]    = useState(1000000)

  const emp   = getEmpData(empresa)
  const h     = horizonte
  const base  = calcFlujos(emp, 0,          0,          h)
  const opt   = calcFlujos(emp, varIngOpt,  varGasOpt,  h)
  const pes   = calcFlujos(emp, varIngPes,  varGasPes,  h)
  const labels = MESES_PROY.slice(0, h)

  const cajaFinalBase = base.cajaAcum[h-1]
  const minCajaBase   = Math.min(...base.cajaAcum)
  const minCajaPes    = Math.min(...pes.cajaAcum)
  const hayRiesgo     = minCajaPes < minCaja

  const selData = escenario === 'opt' ? opt : escenario === 'pes' ? pes : base
  const maxBar  = Math.max(...selData.ing, ...selData.gas, 1)

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
          <div style={{ fontSize:15, fontWeight:600 }}>Proyección de caja</div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <select value={empresa} onChange={e=>setEmpresa(e.target.value as EmpKey)} style={sel}>
              <option value="A">Empresa A</option>
              <option value="B">Empresa B</option>
              <option value="C">Empresa C</option>
              <option value="all">Grupo consolidado</option>
            </select>
            <div style={{ display:'flex', gap:4 }}>
              {([3,6] as const).map(h => (
                <button key={h} onClick={()=>setHorizonte(h)} style={{ padding:'5px 12px', borderRadius:7, fontSize:12, cursor:'pointer', border:'1px solid rgba(0,0,0,0.1)', background:horizonte===h?'#3266ad':'#fff', color:horizonte===h?'#fff':'#6b7280', fontWeight:horizonte===h?500:400 }}>
                  {h} meses
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding:'24px 28px' }}>

          {/* Métricas */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:24 }}>
            {[
              { label:'Caja inicial',      value:fmtM(emp.cajaInicial),          color:'#3266ad', bg:'#E6F1FB' },
              { label:'Caja final (base)', value:fmtM(cajaFinalBase),            color:cajaFinalBase>=0?'#1D9E75':'#E24B4A', bg:cajaFinalBase>=0?'#E1F5EE':'#FCEBEB' },
              { label:'Escenario opt.',    value:fmtM(opt.cajaAcum[h-1]),        color:'#1D9E75', bg:'#E1F5EE' },
              { label:'Escenario pes.',    value:fmtM(pes.cajaAcum[h-1]),        color:'#E24B4A', bg:'#FCEBEB' },
            ].map(m => (
              <div key={m.label} style={{ background:m.bg, borderRadius:12, padding:'14px 16px' }}>
                <div style={{ fontSize:11, color:m.color, fontWeight:500, marginBottom:4, opacity:0.8 }}>{m.label}</div>
                <div style={{ fontSize:20, fontWeight:700, color:m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Alerta de riesgo */}
          {hayRiesgo && (
            <div style={{ background:'#FAEEDA', border:'1px solid #EF9F27', borderRadius:10, padding:'10px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10, fontSize:13 }}>
              <span style={{ fontSize:18 }}>⚠️</span>
              <span style={{ color:'#633806' }}>
                <strong>Alerta:</strong> En escenario pesimista, la caja baja de {fmtM(minCaja)} en {labels[pes.cajaAcum.findIndex(v=>v<minCaja)]}. Considera una línea de crédito preventiva.
              </span>
            </div>
          )}
          {!hayRiesgo && (
            <div style={{ background:'#EAF3DE', border:'1px solid #97C459', borderRadius:10, padding:'10px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10, fontSize:13 }}>
              <span style={{ fontSize:18 }}>✅</span>
              <span style={{ color:'#27500A' }}>Caja proyectada positiva en todos los escenarios durante el horizonte analizado.</span>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display:'flex', gap:6, marginBottom:20 }}>
            {([
              { key:'grafico',   label:'📈 Proyección' },
              { key:'supuestos', label:'⚙️ Supuestos'  },
              { key:'tabla',     label:'📋 Tabla'       },
            ] as const).map(t => (
              <button key={t.key} onClick={()=>setTab(t.key)} style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer', border:'1px solid rgba(0,0,0,0.1)', background:tab===t.key?'#eff4ff':'#fff', color:tab===t.key?'#3266ad':'#6b7280', fontWeight:tab===t.key?500:400 }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Tab: Gráfico ── */}
          {tab === 'grafico' && (
            <>
              {/* Selector escenario */}
              <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                {([
                  { k:'opt',  label:'Optimista',  color:'#1D9E75' },
                  { k:'base', label:'Base',        color:'#3266ad' },
                  { k:'pes',  label:'Pesimista',   color:'#E24B4A' },
                ] as const).map(e => (
                  <button key={e.k} onClick={()=>setEscenario(e.k)} style={{ padding:'6px 14px', borderRadius:999, fontSize:12, cursor:'pointer', fontWeight:500, border:`1.5px solid ${e.color}`, background:escenario===e.k?e.color:'transparent', color:escenario===e.k?'#fff':e.color }}>
                    {e.label}
                  </button>
                ))}
              </div>

              {/* Gráfico caja acumulada */}
              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:12, padding:20, marginBottom:16 }}>
                <div style={sectionTitle}>Caja acumulada proyectada — 3 escenarios</div>
                <div style={{ display:'flex', gap:16, marginBottom:14 }}>
                  {[{l:'Optimista',c:'#1D9E75'},{l:'Base',c:'#3266ad'},{l:'Pesimista',c:'#E24B4A'},{l:'Mínimo',c:'#d1d5db'}].map(e=>(
                    <span key={e.l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#6b7280' }}>
                      <span style={{ width:10, height:e.l==='Mínimo'?2:10, borderRadius:e.l==='Mínimo'?0:2, background:e.c, display:'inline-block' }}/>
                      {e.l}
                    </span>
                  ))}
                </div>
                {/* Gráfico líneas SVG simple */}
                <div style={{ position:'relative', height:180 }}>
                  <svg width="100%" height="180" viewBox={`0 0 ${labels.length*80+60} 180`} preserveAspectRatio="none">
                    {(() => {
                      const allVals = [...opt.cajaAcum, ...base.cajaAcum, ...pes.cajaAcum]
                      const maxV = Math.max(...allVals)
                      const minV = Math.min(...allVals, 0)
                      const range = maxV - minV || 1
                      const W = labels.length*80+60
                      const H = 160
                      const pad = 10
                      const toX = (i:number) => pad + 30 + i*(W-pad-30)/(labels.length-1||1)
                      const toY = (v:number) => H - pad - (v-minV)/range*(H-2*pad)
                      const line = (arr:number[], color:string) => (
                        <polyline key={color} points={arr.slice(0,h).map((v,i)=>`${toX(i)},${toY(v)}`).join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round"/>
                      )
                      const minY = toY(minCaja)
                      return (
                        <>
                          {/* Línea mínimo */}
                          <line x1={pad+30} y1={minY} x2={W-pad} y2={minY} stroke="#d1d5db" strokeWidth="1" strokeDasharray="4,3"/>
                          {line(opt.cajaAcum,  '#1D9E75')}
                          {line(base.cajaAcum, '#3266ad')}
                          {line(pes.cajaAcum,  '#E24B4A')}
                          {/* Labels eje X */}
                          {labels.map((l,i) => (
                            <text key={l} x={toX(i)} y={H+8} textAnchor="middle" fontSize="10" fill="#9ca3af">{l}</text>
                          ))}
                          {/* Puntos escenario seleccionado */}
                          {selData.cajaAcum.slice(0,h).map((v,i) => (
                            <circle key={i} cx={toX(i)} cy={toY(v)} r="4" fill={escenario==='opt'?'#1D9E75':escenario==='pes'?'#E24B4A':'#3266ad'}/>
                          ))}
                        </>
                      )
                    })()}
                  </svg>
                </div>
              </div>

              {/* Gráfico flujo mensual */}
              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:12, padding:20 }}>
                <div style={sectionTitle}>Flujo neto mensual — escenario {escenario==='opt'?'optimista':escenario==='pes'?'pesimista':'base'}</div>
                <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:120 }}>
                  {selData.ing.slice(0,h).map((ing,i) => {
                    const gas = selData.gas[i]
                    const hIng = Math.round(ing/maxBar*100)
                    const hGas = Math.round(gas/maxBar*100)
                    return (
                      <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                        <div style={{ width:'100%', display:'flex', gap:2, alignItems:'flex-end' }}>
                          <div style={{ flex:1, height:hIng, background:'#3266ad', borderRadius:'2px 2px 0 0' }}/>
                          <div style={{ flex:1, height:hGas, background:'#E24B4A', borderRadius:'2px 2px 0 0' }}/>
                        </div>
                        <div style={{ fontSize:10, color:'#9ca3af' }}>{labels[i]}</div>
                        <div style={{ fontSize:10, color: selData.flujo[i]>=0?'#1D9E75':'#E24B4A', fontWeight:500 }}>
                          {fmtM(selData.flujo[i])}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div style={{ display:'flex', gap:12, marginTop:10 }}>
                  {[{l:'Ingresos',c:'#3266ad'},{l:'Gastos',c:'#E24B4A'}].map(e=>(
                    <span key={e.l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#6b7280' }}>
                      <span style={{ width:10, height:10, borderRadius:2, background:e.c, display:'inline-block' }}/>
                      {e.l}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Tab: Supuestos ── */}
          {tab === 'supuestos' && (
            <>
              {[
                { title:'🟢 Escenario optimista', items:[
                  { label:'Crecimiento de ingresos', value:varIngOpt, set:setVarIngOpt, min:0,   max:40, step:1, suffix:'%', color:'#1D9E75' },
                  { label:'Reducción de gastos',     value:varGasOpt, set:setVarGasOpt, min:-20, max:0,  step:1, suffix:'%', color:'#1D9E75' },
                ]},
                { title:'🔴 Escenario pesimista', items:[
                  { label:'Caída de ingresos',    value:varIngPes, set:setVarIngPes, min:-40, max:0,  step:1, suffix:'%', color:'#E24B4A' },
                  { label:'Aumento de gastos',    value:varGasPes, set:setVarGasPes, min:0,   max:30, step:1, suffix:'%', color:'#E24B4A' },
                ]},
              ].map(grupo => (
                <div key={grupo.title} style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:12, padding:20, marginBottom:14 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:'#111827', marginBottom:16 }}>{grupo.title}</div>
                  {grupo.items.map(item => (
                    <div key={item.label} style={{ marginBottom:16 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6 }}>
                        <span style={{ color:'#374151' }}>{item.label}</span>
                        <span style={{ fontWeight:600, color:item.color }}>{item.value > 0 ? '+' : ''}{item.value}{item.suffix}</span>
                      </div>
                      <input type="range" min={item.min} max={item.max} step={item.step} value={item.value}
                        onChange={e => item.set(parseInt(e.target.value))}
                        style={{ width:'100%', accentColor:item.color }}/>
                    </div>
                  ))}
                </div>
              ))}

              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:12, padding:20 }}>
                <div style={{ fontSize:14, fontWeight:600, color:'#111827', marginBottom:16 }}>⚙️ Parámetros generales</div>
                <div style={{ marginBottom:16 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6 }}>
                    <span style={{ color:'#374151' }}>Caja mínima requerida</span>
                    <span style={{ fontWeight:600, color:'#3266ad' }}>{fmtM(minCaja)}</span>
                  </div>
                  <input type="range" min={500000} max={5000000} step={100000} value={minCaja}
                    onChange={e=>setMinCaja(parseInt(e.target.value))}
                    style={{ width:'100%', accentColor:'#3266ad' }}/>
                </div>
              </div>

              <button onClick={()=>setTab('grafico')} style={{ width:'100%', padding:10, borderRadius:9, border:'none', background:'#3266ad', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', marginTop:4 }}>
                Ver proyección actualizada →
              </button>
            </>
          )}

          {/* ── Tab: Tabla ── */}
          {tab === 'tabla' && (
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:12, overflow:'hidden' }}>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:600 }}>
                  <thead>
                    <tr style={{ background:'#fafafa' }}>
                      <th style={th}>Concepto</th>
                      {labels.map(m => <th key={m} style={{ ...th, textAlign:'right' }}>{m}</th>)}
                      <th style={{ ...th, textAlign:'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label:'Ingresos (opt)',       data:opt.ing,      color:'#1D9E75' },
                      { label:'Ingresos (base)',      data:base.ing,     color:'#3266ad' },
                      { label:'Ingresos (pes)',       data:pes.ing,      color:'#E24B4A' },
                      { label:'Gastos (base)',        data:base.gas,     color:'#6b7280' },
                      { label:'Flujo neto (opt)',     data:opt.flujo,    color:'#1D9E75', bold:true, bg:'#f0fdf4' },
                      { label:'Flujo neto (base)',    data:base.flujo,   color:'#3266ad', bold:true, bg:'#eff4ff' },
                      { label:'Flujo neto (pes)',     data:pes.flujo,    color:'#E24B4A', bold:true, bg:'#fff5f5' },
                      { label:'Caja acum. (opt)',     data:opt.cajaAcum, color:'#1D9E75', bg:'#f0fdf4' },
                      { label:'Caja acum. (base)',    data:base.cajaAcum,color:'#3266ad', bg:'#eff4ff' },
                      { label:'Caja acum. (pes)',     data:pes.cajaAcum, color:'#E24B4A', bg:'#fff5f5' },
                    ].map(row => {
                      const total = row.data.slice(0,h).reduce((a,b)=>a+b,0)
                      return (
                        <tr key={row.label} style={{ background: row.bg || 'transparent' }}>
                          <td style={{ padding:'8px 12px', fontWeight:row.bold?600:400, color:row.color, fontSize:12 }}>{row.label}</td>
                          {row.data.slice(0,h).map((v,i) => (
                            <td key={i} style={{ padding:'8px 8px', textAlign:'right', color: v<0?'#E24B4A':'#374151' }}>{fmtM(v)}</td>
                          ))}
                          <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:600, color: total<0?'#E24B4A':row.color }}>{fmtM(total)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

const sel: React.CSSProperties = { fontSize:13, padding:'6px 10px', border:'1px solid rgba(0,0,0,0.12)', borderRadius:8, background:'#fff' }
const sectionTitle: React.CSSProperties = { fontSize:12, fontWeight:600, color:'#6b7280', textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:12 }
const th: React.CSSProperties = { textAlign:'left' as const, padding:'9px 8px', fontWeight:500, color:'#6b7280', borderBottom:'1px solid rgba(0,0,0,0.07)', whiteSpace:'nowrap' as const, fontSize:12 }
