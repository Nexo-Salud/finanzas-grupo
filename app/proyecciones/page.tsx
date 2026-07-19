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

const MESES_NOMBRE = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

type Empresa = { id: string; nombre_corto: string; color: string }
type Mov     = { empresa_id: string; tipo: string; monto: number; fecha: string }

function fmtM(n: number) {
  const a=Math.abs(n),s=n<0?'-':''
  if(a>=1e6) return s+'$'+(Math.round(a/1e5)/10)+'M'
  if(a>=1000) return s+'$'+Math.round(a/1000)+'K'
  return s+'$'+Math.round(a)
}
function fmtCLP(n: number) {
  return (n<0?'-':'')+'$'+Math.round(Math.abs(n)).toLocaleString('es-CL')
}

export default function ProyeccionesPage() {
  const [empresas,    setEmpresas]    = useState<Empresa[]>([])
  const [movimientos, setMovimientos] = useState<Mov[]>([])
  const [cargando,    setCargando]    = useState(true)
  const [empresa,     setEmpresa]     = useState('all')
  const [horizonte,   setHorizonte]   = useState(6)
  const [tab,         setTab]         = useState<'grafico'|'supuestos'|'tabla'>('grafico')
  const [escenario,   setEscenario]   = useState<'opt'|'base'|'pes'>('base')

  // Supuestos ajustables
  const [varIngOpt, setVarIngOpt] = useState(10)
  const [varGasOpt, setVarGasOpt] = useState(-5)
  const [varIngPes, setVarIngPes] = useState(-10)
  const [varGasPes, setVarGasPes] = useState(10)
  const [minCaja,   setMinCaja]   = useState(1000000)

  const hoy = new Date()

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setCargando(true)
    try {
      const [{ data: emps }, { data: movs }] = await Promise.all([
        supabase.from('empresas').select('id,nombre_corto,color').eq('activa',true).order('nombre_corto'),
        supabase.from('movimientos').select('empresa_id,tipo,monto,fecha').order('fecha').limit(1000),
      ])
      setEmpresas(emps || [])
      setMovimientos(movs || [])
    } catch(e) { console.error(e) }
    finally { setCargando(false) }
  }

  // ── Calcular promedios históricos ──
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
  const ultimos6  = historial.slice(-6)

  // Promedio mensual últimos 3 meses
  const promedioIng = ultimos3.length > 0
    ? Math.round(ultimos3.reduce((a,[,v])=>a+v.ing,0) / ultimos3.length)
    : 0
  const promedioGas = ultimos3.length > 0
    ? Math.round(ultimos3.reduce((a,[,v])=>a+v.gas,0) / ultimos3.length)
    : 0

  // Tendencia (crecimiento mes a mes promedio)
  const tendenciaIng = ultimos6.length >= 2
    ? Math.round((ultimos6[ultimos6.length-1][1].ing - ultimos6[0][1].ing) / ultimos6[0][1].ing * 100 / ultimos6.length)
    : 0

  // Caja inicial = último saldo calculado
  const cajaInicial = historial.reduce((a,[,v])=>a+v.ing-v.gas, 0)

  // ── Generar meses futuros ──
  function getMesesFuturos(h: number) {
    const meses = []
    for (let i=1; i<=h; i++) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1)
      meses.push(`${MESES_NOMBRE[d.getMonth()]} ${d.getFullYear()}`)
    }
    return meses
  }

  function calcEscenario(varIng: number, varGas: number, h: number) {
    const ing: number[] = []
    const gas: number[] = []
    const flujo: number[] = []
    const cajaAcum: number[] = []
    let caja = cajaInicial

    for (let i=0; i<h; i++) {
      const ingMes = Math.round(promedioIng * (1 + varIng/100) * (1 + tendenciaIng/100 * i))
      const gasMes = Math.round(promedioGas * (1 + varGas/100))
      const fl     = ingMes - gasMes
      caja += fl
      ing.push(ingMes)
      gas.push(gasMes)
      flujo.push(fl)
      cajaAcum.push(caja)
    }
    return { ing, gas, flujo, cajaAcum }
  }

  const mesesFuturos = getMesesFuturos(horizonte)
  const base = calcEscenario(0,          0,          horizonte)
  const opt  = calcEscenario(varIngOpt,  varGasOpt,  horizonte)
  const pes  = calcEscenario(varIngPes,  varGasPes,  horizonte)

  const selData  = escenario==='opt' ? opt : escenario==='pes' ? pes : base
  const hayRiesgo = Math.min(...pes.cajaAcum) < minCaja
  const maxCaja   = Math.max(...opt.cajaAcum, ...base.cajaAcum, ...pes.cajaAcum, minCaja*2, 1)
  const minCajaVal= Math.min(...pes.cajaAcum, cajaInicial, 0)

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
            <div style={{ fontSize:15, fontWeight:600 }}>Proyección de caja</div>
            {!cargando && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:'#E1F5EE', color:'#085041', fontWeight:500 }}>🟢 Basado en historial real</span>}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <select value={empresa} onChange={e=>setEmpresa(e.target.value)} style={sel}>
              <option value="all">Grupo completo</option>
              {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre_corto}</option>)}
            </select>
            <div style={{ display:'flex', gap:4 }}>
              {([3,6] as const).map(h=>(
                <button key={h} onClick={()=>setHorizonte(h)} style={{ padding:'5px 12px', borderRadius:7, fontSize:12, cursor:'pointer', border:'1px solid rgba(0,0,0,0.1)', background:horizonte===h?'#3266ad':'#fff', color:horizonte===h?'#fff':'#6b7280' }}>
                  {h} meses
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding:'24px 28px' }}>

          {cargando && <div style={{ textAlign:'center', padding:'4rem', color:'#9ca3af' }}>⏳ Cargando historial real...</div>}

          {!cargando && (
            <>
              {/* Info base de proyección */}
              <div style={{ background:'#eff4ff', border:'1px solid #c7d7f5', borderRadius:10, padding:'10px 16px', marginBottom:20, fontSize:12, color:'#3266ad' }}>
                <strong>Base de proyección:</strong> Promedio de los últimos {ultimos3.length} meses históricos —
                Ingreso promedio: <strong>{fmtM(promedioIng)}/mes</strong> ·
                Gasto promedio: <strong>{fmtM(promedioGas)}/mes</strong> ·
                Tendencia: <strong>{tendenciaIng>0?'+':''}{tendenciaIng}% mensual</strong>
              </div>

              {/* Métricas */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12, marginBottom:20 }}>
                {[
                  { label:'Caja actual',         value:fmtM(cajaInicial),           color:'#3266ad', bg:'#E6F1FB' },
                  { label:'Proyección base',      value:fmtM(base.cajaAcum[horizonte-1]), color:'#3266ad', bg:'#E6F1FB' },
                  { label:'Escenario optimista',  value:fmtM(opt.cajaAcum[horizonte-1]),  color:'#1D9E75', bg:'#E1F5EE' },
                  { label:'Escenario pesimista',  value:fmtM(pes.cajaAcum[horizonte-1]),  color:'#E24B4A', bg:'#FCEBEB' },
                ].map(m=>(
                  <div key={m.label} style={{ background:m.bg, borderRadius:12, padding:'14px 16px' }}>
                    <div style={{ fontSize:11, color:m.color, fontWeight:500, marginBottom:4, opacity:0.8 }}>{m.label}</div>
                    <div style={{ fontSize:20, fontWeight:700, color:m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Alerta riesgo */}
              {hayRiesgo ? (
                <div style={{ background:'#FAEEDA', border:'1px solid #EF9F27', borderRadius:10, padding:'10px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10, fontSize:13, color:'#633806' }}>
                  <span style={{ fontSize:18 }}>⚠️</span>
                  <span><strong>Alerta:</strong> En escenario pesimista la caja baja de {fmtM(minCaja)}. Considera una línea de crédito preventiva.</span>
                </div>
              ) : (
                <div style={{ background:'#EAF3DE', border:'1px solid #97C459', borderRadius:10, padding:'10px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10, fontSize:13, color:'#27500A' }}>
                  <span style={{ fontSize:18 }}>✅</span>
                  <span>Caja proyectada positiva en todos los escenarios durante los próximos {horizonte} meses.</span>
                </div>
              )}

              {/* Tabs */}
              <div style={{ display:'flex', gap:6, marginBottom:20 }}>
                {([
                  {k:'grafico',   l:'📈 Proyección'},
                  {k:'supuestos', l:'⚙️ Supuestos'},
                  {k:'tabla',     l:'📋 Tabla'},
                ] as const).map(t=>(
                  <button key={t.k} onClick={()=>setTab(t.k)} style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer', border:'1px solid rgba(0,0,0,0.1)', background:tab===t.k?'#eff4ff':'#fff', color:tab===t.k?'#3266ad':'#6b7280', fontWeight:tab===t.k?500:400 }}>
                    {t.l}
                  </button>
                ))}
              </div>

              {/* ── Gráfico ── */}
              {tab==='grafico' && (
                <>
                  {/* Selector escenario */}
                  <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                    {([
                      {k:'opt', l:'Optimista', c:'#1D9E75'},
                      {k:'base',l:'Base',      c:'#3266ad'},
                      {k:'pes', l:'Pesimista', c:'#E24B4A'},
                    ] as const).map(e=>(
                      <button key={e.k} onClick={()=>setEscenario(e.k)} style={{ padding:'6px 14px', borderRadius:999, fontSize:12, cursor:'pointer', fontWeight:500, border:`1.5px solid ${e.c}`, background:escenario===e.k?e.c:'transparent', color:escenario===e.k?'#fff':e.c }}>
                        {e.l}
                      </button>
                    ))}
                  </div>

                  {/* Gráfico caja acumulada */}
                  <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20, marginBottom:16 }}>
                    <div style={sTitle}>Caja proyectada — 3 escenarios</div>
                    <div style={{ display:'flex', gap:12, marginBottom:14 }}>
                      {[{l:'Optimista',c:'#1D9E75'},{l:'Base',c:'#3266ad'},{l:'Pesimista',c:'#E24B4A'},{l:'Mínimo',c:'#d1d5db'}].map(e=>(
                        <span key={e.l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#6b7280' }}>
                          <span style={{ width:10, height:e.l==='Mínimo'?2:10, background:e.c, display:'inline-block', borderRadius:e.l==='Mínimo'?0:2 }}/>{e.l}
                        </span>
                      ))}
                    </div>
                    <div style={{ position:'relative', height:180 }}>
                      <svg width="100%" height="180" viewBox={`0 0 ${horizonte*90+60} 180`} preserveAspectRatio="none">
                        {(() => {
                          const allVals = [...opt.cajaAcum, ...base.cajaAcum, ...pes.cajaAcum, minCaja, cajaInicial]
                          const maxV = Math.max(...allVals)
                          const minV = Math.min(...allVals, 0)
                          const range = maxV - minV || 1
                          const W = horizonte*90+60
                          const H = 160
                          const pad = 10
                          const toX = (i: number) => pad+30 + i*(W-pad-30)/(horizonte-1||1)
                          const toY = (v: number) => H - pad - (v-minV)/range*(H-2*pad)
                          const mkLine = (arr: number[], color: string, width=2) => (
                            <polyline key={color} points={arr.map((v,i)=>`${toX(i)},${toY(v)}`).join(' ')} fill="none" stroke={color} strokeWidth={width} strokeLinejoin="round"/>
                          )
                          const minY = toY(minCaja)
                          return (
                            <>
                              <line x1={pad+30} y1={minY} x2={W-pad} y2={minY} stroke="#d1d5db" strokeWidth="1" strokeDasharray="4,3"/>
                              {mkLine(opt.cajaAcum,  '#1D9E75')}
                              {mkLine(base.cajaAcum, '#3266ad')}
                              {mkLine(pes.cajaAcum,  '#E24B4A')}
                              {selData.cajaAcum.map((v,i)=>(
                                <circle key={i} cx={toX(i)} cy={toY(v)} r="4" fill={escenario==='opt'?'#1D9E75':escenario==='pes'?'#E24B4A':'#3266ad'}/>
                              ))}
                              {mesesFuturos.map((m,i)=>(
                                <text key={m} x={toX(i)} y={H+12} textAnchor="middle" fontSize="9" fill="#9ca3af">{m.slice(0,6)}</text>
                              ))}
                            </>
                          )
                        })()}
                      </svg>
                    </div>
                  </div>

                  {/* Gráfico flujo mensual */}
                  <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20 }}>
                    <div style={sTitle}>Flujo neto mensual proyectado — escenario {escenario==='opt'?'optimista':escenario==='pes'?'pesimista':'base'}</div>
                    <div style={{ display:'flex', alignItems:'flex-end', gap:10, height:120 }}>
                      {selData.ing.map((ing,i)=>{
                        const gas = selData.gas[i]
                        const maxV = Math.max(...selData.ing, ...selData.gas, 1)
                        const hI = Math.round(ing/maxV*100)
                        const hG = Math.round(gas/maxV*100)
                        return (
                          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                            <div style={{ fontSize:10, color:selData.flujo[i]>=0?'#1D9E75':'#E24B4A', fontWeight:500 }}>{fmtM(selData.flujo[i])}</div>
                            <div style={{ width:'100%', display:'flex', gap:2, alignItems:'flex-end' }}>
                              <div style={{ flex:1, height:Math.max(hI,2), background:'#3266ad', borderRadius:'2px 2px 0 0' }}/>
                              <div style={{ flex:1, height:Math.max(hG,2), background:'#E24B4A', borderRadius:'2px 2px 0 0' }}/>
                            </div>
                            <div style={{ fontSize:9, color:'#9ca3af', textAlign:'center' }}>{mesesFuturos[i]?.slice(0,6)}</div>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ display:'flex', gap:12, marginTop:8 }}>
                      {[{l:'Ingresos',c:'#3266ad'},{l:'Gastos',c:'#E24B4A'}].map(e=>(
                        <span key={e.l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#6b7280' }}>
                          <span style={{ width:10, height:10, borderRadius:2, background:e.c, display:'inline-block' }}/>{e.l}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ── Supuestos ── */}
              {tab==='supuestos' && (
                <>
                  {[
                    { title:'🟢 Escenario optimista', items:[
                      { label:'Aumento de ingresos', value:varIngOpt, set:setVarIngOpt, min:0, max:40, color:'#1D9E75' },
                      { label:'Reducción de gastos', value:varGasOpt, set:setVarGasOpt, min:-20, max:0, color:'#1D9E75' },
                    ]},
                    { title:'🔴 Escenario pesimista', items:[
                      { label:'Caída de ingresos',  value:varIngPes, set:setVarIngPes, min:-40, max:0,  color:'#E24B4A' },
                      { label:'Aumento de gastos',  value:varGasPes, set:setVarGasPes, min:0,   max:30, color:'#E24B4A' },
                    ]},
                  ].map(grupo=>(
                    <div key={grupo.title} style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:12, padding:20, marginBottom:14 }}>
                      <div style={{ fontSize:14, fontWeight:600, color:'#111827', marginBottom:16 }}>{grupo.title}</div>
                      {grupo.items.map(item=>(
                        <div key={item.label} style={{ marginBottom:16 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6 }}>
                            <span style={{ color:'#374151' }}>{item.label}</span>
                            <span style={{ fontWeight:600, color:item.color }}>{item.value>0?'+':''}{item.value}%</span>
                          </div>
                          <input type="range" min={item.min} max={item.max} value={item.value}
                            onChange={e=>item.set(parseInt(e.target.value))}
                            style={{ width:'100%', accentColor:item.color }}/>
                        </div>
                      ))}
                    </div>
                  ))}
                  <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:12, padding:20 }}>
                    <div style={{ fontSize:14, fontWeight:600, marginBottom:16 }}>⚙️ Parámetros generales</div>
                    <div style={{ fontSize:13, color:'#374151', marginBottom:6, display:'flex', justifyContent:'space-between' }}>
                      <span>Caja mínima requerida</span>
                      <span style={{ fontWeight:600, color:'#3266ad' }}>{fmtM(minCaja)}</span>
                    </div>
                    <input type="range" min={500000} max={10000000} step={100000} value={minCaja}
                      onChange={e=>setMinCaja(parseInt(e.target.value))}
                      style={{ width:'100%', accentColor:'#3266ad' }}/>
                  </div>
                  <button onClick={()=>setTab('grafico')} style={{ width:'100%', padding:10, borderRadius:9, border:'none', background:'#3266ad', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', marginTop:8 }}>
                    Ver proyección actualizada →
                  </button>
                </>
              )}

              {/* ── Tabla ── */}
              {tab==='tabla' && (
                <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, overflow:'hidden' }}>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:600 }}>
                      <thead>
                        <tr style={{ background:'#fafafa' }}>
                          <th style={th}>Concepto</th>
                          {mesesFuturos.map(m=><th key={m} style={{ ...th, textAlign:'right' }}>{m.slice(0,6)}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label:'Ingresos (opt)',    data:opt.ing,      color:'#1D9E75', bg:'#f0fdf4' },
                          { label:'Ingresos (base)',   data:base.ing,     color:'#3266ad', bg:'#eff4ff' },
                          { label:'Ingresos (pes)',    data:pes.ing,      color:'#E24B4A', bg:'#fff5f5' },
                          { label:'Gastos (base)',     data:base.gas,     color:'#6b7280', bg:'' },
                          { label:'Flujo (opt)',       data:opt.flujo,    color:'#1D9E75', bg:'#f0fdf4', bold:true },
                          { label:'Flujo (base)',      data:base.flujo,   color:'#3266ad', bg:'#eff4ff', bold:true },
                          { label:'Flujo (pes)',       data:pes.flujo,    color:'#E24B4A', bg:'#fff5f5', bold:true },
                          { label:'Caja acum. (opt)',  data:opt.cajaAcum, color:'#1D9E75', bg:'#f0fdf4' },
                          { label:'Caja acum. (base)', data:base.cajaAcum,color:'#3266ad', bg:'#eff4ff' },
                          { label:'Caja acum. (pes)',  data:pes.cajaAcum, color:'#E24B4A', bg:'#fff5f5' },
                        ].map(row=>(
                          <tr key={row.label} style={{ background:row.bg||'transparent' }}>
                            <td style={{ padding:'8px 12px', fontWeight:row.bold?600:400, color:row.color, fontSize:12 }}>{row.label}</td>
                            {row.data.map((v,i)=>(
                              <td key={i} style={{ padding:'8px 8px', textAlign:'right', color:v<0?'#E24B4A':'#374151' }}>{fmtM(v)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Historial real */}
              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20, marginTop:16 }}>
                <div style={sTitle}>Historial real — base de la proyección</div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead>
                      <tr style={{ background:'#fafafa' }}>
                        {['Mes','Ingresos','Gastos','Flujo neto'].map(h=>(
                          <th key={h} style={{ textAlign:'left', padding:'8px 12px', fontWeight:500, color:'#6b7280', borderBottom:'1px solid rgba(0,0,0,0.07)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {historial.map(([key,val],i)=>{
                        const [y,m] = key.split('-')
                        const flujo = val.ing - val.gas
                        return (
                          <tr key={key} style={{ borderBottom:i<historial.length-1?'1px solid rgba(0,0,0,0.06)':'none' }}>
                            <td style={{ padding:'8px 12px', fontWeight:500 }}>{MESES_NOMBRE[parseInt(m)-1]} {y}</td>
                            <td style={{ padding:'8px 12px', color:'#1D9E75', fontWeight:600 }}>{fmtCLP(val.ing)}</td>
                            <td style={{ padding:'8px 12px', color:'#E24B4A', fontWeight:600 }}>{fmtCLP(val.gas)}</td>
                            <td style={{ padding:'8px 12px', fontWeight:700, color:flujo>=0?'#3266ad':'#E24B4A' }}>{fmtCLP(flujo)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const sel: React.CSSProperties = { fontSize:13, padding:'6px 10px', border:'1px solid rgba(0,0,0,0.12)', borderRadius:8, background:'#fff' }
const sTitle: React.CSSProperties = { fontSize:12, fontWeight:600, color:'#6b7280', textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:14 }
const th: React.CSSProperties = { textAlign:'left' as const, padding:'9px 8px', fontWeight:500, color:'#6b7280', borderBottom:'1px solid rgba(0,0,0,0.07)', whiteSpace:'nowrap' as const }
