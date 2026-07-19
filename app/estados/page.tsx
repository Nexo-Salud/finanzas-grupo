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
  { href:'/estados',      label:'Est. Financ.', icon:'📑', active:true },
  { href:'/bancos',       label:'Bancos',       icon:'🏦' },
  { href:'/tributario',   label:'Documentos',   icon:'🧾' },
  { href:'/proyecciones', label:'Proyecciones', icon:'📈' },
  { href:'/usuarios',     label:'Usuarios',     icon:'👥' },
  { href:'/kpis',         label:'KPIs',         icon:'📊' },
  { href:'/ia',           label:'Análisis IA',  icon:'🧠' },
]

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

type Empresa = { id: string; nombre_corto: string; nombre: string; color: string; rut?: string }
type Mov     = { empresa_id: string; tipo: string; monto: number; fecha: string; categoria: string; descripcion?: string }
type Doc     = { id: string; empresa_id: string; tipo: string; folio: string; contraparte: string; rut_contraparte: string; fecha: string; neto: number; iva: number; total: number; estado: string }

function fmtCLP(n: number) { return (n<0?'-':'')+'$'+Math.round(Math.abs(n)).toLocaleString('es-CL') }
function fmtM(n: number) {
  const a=Math.abs(n),s=n<0?'-':''
  if(a>=1e6) return s+'$'+(Math.round(a/1e5)/10)+'M'
  if(a>=1000) return s+'$'+Math.round(a/1000)+'K'
  return s+'$'+Math.round(a)
}

export default function EstadosPage() {
  const [empresas,    setEmpresas]    = useState<Empresa[]>([])
  const [movimientos, setMovimientos] = useState<Mov[]>([])
  const [documentos,  setDocumentos]  = useState<Doc[]>([])
  const [cargando,    setCargando]    = useState(true)
  const [empresa,     setEmpresa]     = useState('all')
  const [tab,         setTab]         = useState<'resultados'|'balance'|'flujo'|'compras'|'ventas'>('resultados')

  const hoy = new Date()
  const [mes,  setMes]  = useState(hoy.getMonth() + 1)
  const [anio, setAnio] = useState(hoy.getFullYear())

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setCargando(true)
    try {
      const [{ data: emps }, { data: movs }, { data: docs }] = await Promise.all([
        supabase.from('empresas').select('id,nombre_corto,nombre,color,rut').eq('activa',true).order('nombre_corto'),
        supabase.from('movimientos').select('empresa_id,tipo,monto,fecha,categoria,descripcion').order('fecha').limit(1000),
        supabase.from('documentos').select('*').order('fecha', { ascending: false }).limit(500),
      ])
      setEmpresas(emps || [])
      setMovimientos(movs || [])
      setDocumentos(docs || [])
    } catch(e) { console.error(e) }
    finally { setCargando(false) }
  }

  const scope    = movimientos.filter(m => empresa==='all' || m.empresa_id===empresa)
  const scopeDocs= documentos.filter(d => empresa==='all' || d.empresa_id===empresa)
  const scopeMes = scope.filter(m => {
    const [y,mo] = m.fecha.split('-')
    return parseInt(y)===anio && parseInt(mo)===mes
  })
  const docsAnio = scopeDocs.filter(d => d.fecha.startsWith(anio.toString()))

  // ── Por mes histórico ──
  const porMes: Record<string,{ing:number;gas:number}> = {}
  scope.forEach(m => {
    const key = m.fecha.slice(0,7)
    if (!porMes[key]) porMes[key] = {ing:0,gas:0}
    if (m.tipo==='ingreso') porMes[key].ing += m.monto
    else porMes[key].gas += m.monto
  })
  const historial = Object.entries(porMes).sort((a,b)=>a[0].localeCompare(b[0]))

  // ── Estado de resultados ──
  const catIngreso: Record<string,number> = {}
  const catGasto:   Record<string,number> = {}
  scopeMes.forEach(m => {
    if (m.tipo==='ingreso') catIngreso[m.categoria] = (catIngreso[m.categoria]||0) + m.monto
    else catGasto[m.categoria] = (catGasto[m.categoria]||0) + m.monto
  })
  const ingTotal   = Object.values(catIngreso).reduce((a,b)=>a+b,0)
  const gasTotal   = Object.values(catGasto).reduce((a,b)=>a+b,0)
  const utilBruta  = ingTotal - gasTotal
  const margenR    = ingTotal>0 ? Math.round(utilBruta/ingTotal*100) : 0

  // Acumulado año
  const scopeAnio  = scope.filter(m => m.fecha.startsWith(anio.toString()))
  const ingAnio    = scopeAnio.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)
  const gasAnio    = scopeAnio.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0)
  const utilAnio   = ingAnio - gasAnio
  const margenAnio = ingAnio>0 ? Math.round(utilAnio/ingAnio*100) : 0

  // ── Balance general (simplificado) ──
  const cajaDisponible = scope.reduce((a,m)=>m.tipo==='ingreso'?a+m.monto:a-m.monto,0)
  const cxcPendiente   = scopeDocs.filter(d=>['FE','BE'].includes(d.tipo)&&d.estado==='pendiente').reduce((a,d)=>a+d.total,0)
  const activoTotal    = cajaDisponible + cxcPendiente
  const cxpPendiente   = scopeDocs.filter(d=>d.tipo==='FR'&&d.estado==='pendiente').reduce((a,d)=>a+d.total,0)
  const retenPendiente = scopeDocs.filter(d=>d.tipo==='RET'&&d.estado==='pendiente').reduce((a,d)=>a+(d.total*0.115),0)
  const pasivoTotal    = cxpPendiente + retenPendiente
  const patrimonio     = activoTotal - pasivoTotal

  // ── Flujo de caja ──
  const flujoPorMes = historial.map(([key,val])=>{
    const [y,m] = key.split('-')
    return { key, label:`${MESES_CORTO[parseInt(m)-1]} ${y}`, ing:val.ing, gas:val.gas, flujo:val.ing-val.gas }
  })
  let cajaAcum = 0
  const flujoConAcum = flujoPorMes.map(f => {
    cajaAcum += f.flujo
    return { ...f, acum: cajaAcum }
  })
  const maxFlujo = Math.max(...flujoConAcum.map(f=>Math.max(f.ing,f.gas)), 1)

  // ── Libro de compras (FR) ──
  const libroCompras = docsAnio.filter(d=>d.tipo==='FR').sort((a,b)=>a.fecha.localeCompare(b.fecha))
  const totalNetoC   = libroCompras.reduce((a,d)=>a+d.neto,0)
  const totalIvaC    = libroCompras.reduce((a,d)=>a+d.iva,0)
  const totalC       = libroCompras.reduce((a,d)=>a+d.total,0)

  // ── Libro de ventas (FE + BE) ──
  const libroVentas  = docsAnio.filter(d=>['FE','BE'].includes(d.tipo)).sort((a,b)=>a.fecha.localeCompare(b.fecha))
  const totalNetoV   = libroVentas.reduce((a,d)=>a+d.neto,0)
  const totalIvaV    = libroVentas.reduce((a,d)=>a+d.iva,0)
  const totalV       = libroVentas.reduce((a,d)=>a+d.total,0)
  const ivaNeto      = totalIvaV - totalIvaC

  function imprimir() { window.print() }

  const empInfo = empresa==='all' ? null : empresas.find(e=>e.id===empresa)
  const encabezado = empInfo ? `${empInfo.nombre_corto}${empInfo.rut?' · RUT '+empInfo.rut:''}` : 'Grupo consolidado'

  return (
    <div style={{ minHeight:'100vh', background:'#f8f9fb', fontFamily:'DM Sans, sans-serif' }}>
      <style>{`@media print { .no-print { display:none!important; } body { background:white!important; } }`}</style>

      {/* Sidebar */}
      <div className="no-print" style={{ position:'fixed', top:0, left:0, width:220, height:'100vh', background:'#fff', borderRight:'1px solid rgba(0,0,0,0.08)', display:'flex', flexDirection:'column', padding:'0 12px 16px', zIndex:100, overflowY:'auto' }}>
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
        <div className="no-print" style={{ height:56, background:'#fff', borderBottom:'1px solid rgba(0,0,0,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 28px', position:'sticky', top:0, zIndex:50 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:15, fontWeight:600 }}>Estados financieros</div>
            {!cargando && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:'#E1F5EE', color:'#085041', fontWeight:500 }}>🟢 Datos reales</span>}
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <select value={empresa} onChange={e=>setEmpresa(e.target.value)} style={sel}>
              <option value="all">Grupo completo</option>
              {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre_corto}</option>)}
            </select>
            <select value={mes} onChange={e=>setMes(parseInt(e.target.value))} style={sel}>
              {MESES.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
            </select>
            <select value={anio} onChange={e=>setAnio(parseInt(e.target.value))} style={sel}>
              {[2024,2025,2026,2027].map(a=><option key={a}>{a}</option>)}
            </select>
            <button onClick={imprimir} style={btnP}>🖨️ PDF</button>
          </div>
        </div>

        <div style={{ padding:'24px 28px' }}>

          {cargando && <div style={{ textAlign:'center', padding:'4rem', color:'#9ca3af' }}>⏳ Cargando datos reales...</div>}

          {!cargando && (
            <>
              {/* Tabs */}
              <div className="no-print" style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap' }}>
                {([
                  {k:'resultados', l:'📊 Estado de resultados'},
                  {k:'balance',    l:'⚖️ Balance general'},
                  {k:'flujo',      l:'💧 Flujo de caja'},
                  {k:'compras',    l:'📥 Libro de compras'},
                  {k:'ventas',     l:'📤 Libro de ventas'},
                ] as const).map(t=>(
                  <button key={t.k} onClick={()=>setTab(t.k)} style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer', border:'1px solid rgba(0,0,0,0.1)', background:tab===t.k?'#eff4ff':'#fff', color:tab===t.k?'#3266ad':'#6b7280', fontWeight:tab===t.k?500:400 }}>
                    {t.l}
                  </button>
                ))}
              </div>

              {/* ── Estado de Resultados ── */}
              {tab==='resultados' && (
                <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:28, maxWidth:720, margin:'0 auto' }}>
                  <div style={{ borderBottom:'3px solid #3266ad', paddingBottom:14, marginBottom:20 }}>
                    <div style={{ fontSize:18, fontWeight:700, color:'#111827' }}>Estado de resultados</div>
                    <div style={{ fontSize:12, color:'#6b7280', marginTop:3 }}>{encabezado} · {MESES[mes-1]} {anio} · Generado {hoy.toLocaleDateString('es-CL')}</div>
                  </div>

                  {/* Ingresos */}
                  <div style={{ marginBottom:16 }}>
                    <div style={secTitle('🟢')}>Ingresos operacionales</div>
                    {Object.entries(catIngreso).sort((a,b)=>b[1]-a[1]).map(([cat,val])=>(
                      <div key={cat} style={lineaEstado}>
                        <span style={{ color:'#374151' }}>{cat}</span>
                        <span style={{ color:'#1D9E75', fontWeight:500 }}>{fmtCLP(val)}</span>
                      </div>
                    ))}
                    {Object.keys(catIngreso).length===0 && <div style={{ fontSize:12, color:'#9ca3af', padding:'8px 0' }}>Sin ingresos en este período</div>}
                    <div style={{ ...lineaEstado, borderTop:'1.5px solid #e5e7eb', marginTop:6, paddingTop:8, fontWeight:700 }}>
                      <span style={{ color:'#111827' }}>Total ingresos</span>
                      <span style={{ color:'#1D9E75', fontSize:15 }}>{fmtCLP(ingTotal)}</span>
                    </div>
                  </div>

                  {/* Gastos */}
                  <div style={{ marginBottom:16 }}>
                    <div style={secTitle('🔴')}>Gastos operacionales</div>
                    {Object.entries(catGasto).sort((a,b)=>b[1]-a[1]).map(([cat,val])=>(
                      <div key={cat} style={lineaEstado}>
                        <span style={{ color:'#374151' }}>{cat}</span>
                        <span style={{ color:'#E24B4A', fontWeight:500 }}>({fmtCLP(val)})</span>
                      </div>
                    ))}
                    {Object.keys(catGasto).length===0 && <div style={{ fontSize:12, color:'#9ca3af', padding:'8px 0' }}>Sin gastos en este período</div>}
                    <div style={{ ...lineaEstado, borderTop:'1.5px solid #e5e7eb', marginTop:6, paddingTop:8, fontWeight:700 }}>
                      <span style={{ color:'#111827' }}>Total gastos</span>
                      <span style={{ color:'#E24B4A', fontSize:15 }}>({fmtCLP(gasTotal)})</span>
                    </div>
                  </div>

                  {/* Resultado */}
                  <div style={{ background:utilBruta>=0?'#E1F5EE':'#FCEBEB', borderRadius:10, padding:'14px 16px', marginBottom:20 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div>
                        <div style={{ fontSize:14, fontWeight:700, color:'#111827' }}>Utilidad neta del período</div>
                        <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Margen: {margenR}%</div>
                      </div>
                      <div style={{ fontSize:24, fontWeight:700, color:utilBruta>=0?'#1D9E75':'#E24B4A' }}>{fmtCLP(utilBruta)}</div>
                    </div>
                  </div>

                  {/* Acumulado año */}
                  <div style={{ borderTop:'1px solid #e5e7eb', paddingTop:16 }}>
                    <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Acumulado {anio}</div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                      {[
                        { l:'Ingresos', v:fmtCLP(ingAnio), c:'#1D9E75' },
                        { l:'Gastos',   v:fmtCLP(gasAnio), c:'#E24B4A' },
                        { l:'Utilidad', v:fmtCLP(utilAnio),c:utilAnio>=0?'#3266ad':'#E24B4A' },
                      ].map(k=>(
                        <div key={k.l} style={{ background:'#f8fafc', borderRadius:8, padding:'10px', textAlign:'center' }}>
                          <div style={{ fontSize:10, color:'#6b7280', marginBottom:3 }}>{k.l}</div>
                          <div style={{ fontSize:13, fontWeight:700, color:k.c }}>{k.v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize:11, color:'#6b7280', marginTop:8, textAlign:'right' }}>Margen acumulado: {margenAnio}%</div>
                  </div>
                </div>
              )}

              {/* ── Balance General ── */}
              {tab==='balance' && (
                <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:28, maxWidth:720, margin:'0 auto' }}>
                  <div style={{ borderBottom:'3px solid #3266ad', paddingBottom:14, marginBottom:20 }}>
                    <div style={{ fontSize:18, fontWeight:700, color:'#111827' }}>Balance general</div>
                    <div style={{ fontSize:12, color:'#6b7280', marginTop:3 }}>{encabezado} · Al {hoy.toLocaleDateString('es-CL')}</div>
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                    {/* ACTIVOS */}
                    <div>
                      <div style={secTitle('🟢')}>Activos</div>
                      {[
                        { l:'Caja y equivalentes',      v:cajaDisponible, desc:'Saldo acumulado de movimientos' },
                        { l:'Cuentas por cobrar',        v:cxcPendiente,  desc:'Facturas emitidas pendientes' },
                      ].map(row=>(
                        <div key={row.l} style={{ marginBottom:10 }}>
                          <div style={lineaEstado}>
                            <div>
                              <div style={{ fontSize:13, color:'#374151' }}>{row.l}</div>
                              <div style={{ fontSize:10, color:'#9ca3af' }}>{row.desc}</div>
                            </div>
                            <span style={{ color:'#1D9E75', fontWeight:500 }}>{fmtCLP(row.v)}</span>
                          </div>
                        </div>
                      ))}
                      <div style={{ ...lineaEstado, borderTop:'2px solid #e5e7eb', paddingTop:8, fontWeight:700 }}>
                        <span style={{ color:'#111827', fontSize:14 }}>Total activos</span>
                        <span style={{ color:'#1D9E75', fontSize:16 }}>{fmtCLP(activoTotal)}</span>
                      </div>
                    </div>

                    {/* PASIVOS Y PATRIMONIO */}
                    <div>
                      <div style={secTitle('🔴')}>Pasivos</div>
                      {[
                        { l:'Cuentas por pagar',       v:cxpPendiente,   desc:'Facturas recibidas pendientes' },
                        { l:'Retenciones por pagar',   v:retenPendiente, desc:'Honorarios pendientes de pago' },
                      ].map(row=>(
                        <div key={row.l} style={{ marginBottom:10 }}>
                          <div style={lineaEstado}>
                            <div>
                              <div style={{ fontSize:13, color:'#374151' }}>{row.l}</div>
                              <div style={{ fontSize:10, color:'#9ca3af' }}>{row.desc}</div>
                            </div>
                            <span style={{ color:'#E24B4A', fontWeight:500 }}>({fmtCLP(row.v)})</span>
                          </div>
                        </div>
                      ))}
                      <div style={{ ...lineaEstado, borderTop:'2px solid #e5e7eb', paddingTop:8, fontWeight:700, marginBottom:20 }}>
                        <span style={{ color:'#111827', fontSize:14 }}>Total pasivos</span>
                        <span style={{ color:'#E24B4A', fontSize:16 }}>({fmtCLP(pasivoTotal)})</span>
                      </div>

                      <div style={secTitle('🔵')}>Patrimonio</div>
                      <div style={{ background:patrimonio>=0?'#E6F1FB':'#FCEBEB', borderRadius:10, padding:'14px 16px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <span style={{ fontSize:13, fontWeight:600, color:'#111827' }}>Patrimonio neto</span>
                          <span style={{ fontSize:18, fontWeight:700, color:patrimonio>=0?'#3266ad':'#E24B4A' }}>{fmtCLP(patrimonio)}</span>
                        </div>
                        <div style={{ fontSize:11, color:'#6b7280', marginTop:4 }}>Activos − Pasivos = {fmtCLP(activoTotal)} − {fmtCLP(pasivoTotal)}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ background:'#FAEEDA', borderRadius:8, padding:'8px 12px', fontSize:11, color:'#633806', marginTop:20 }}>
                    ⚠️ Balance simplificado basado en movimientos y documentos registrados. Para un balance contable oficial consulta a tu contador.
                  </div>
                </div>
              )}

              {/* ── Flujo de Caja ── */}
              {tab==='flujo' && (
                <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:28 }}>
                  <div style={{ borderBottom:'3px solid #3266ad', paddingBottom:14, marginBottom:20 }}>
                    <div style={{ fontSize:18, fontWeight:700, color:'#111827' }}>Flujo de caja</div>
                    <div style={{ fontSize:12, color:'#6b7280', marginTop:3 }}>{encabezado} · Histórico completo</div>
                  </div>

                  {/* Gráfico */}
                  {flujoConAcum.length > 0 && (
                    <div style={{ marginBottom:24 }}>
                      <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>Ingresos vs egresos por mes</div>
                      <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:140, overflowX:'auto', paddingBottom:4 }}>
                        {flujoConAcum.map(f=>{
                          const hI = Math.round(f.ing/maxFlujo*120)
                          const hG = Math.round(f.gas/maxFlujo*120)
                          return (
                            <div key={f.key} style={{ flex:'0 0 auto', width:52, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                              <div style={{ fontSize:9, color:f.flujo>=0?'#1D9E75':'#E24B4A', fontWeight:600 }}>{fmtM(f.flujo)}</div>
                              <div style={{ width:'100%', display:'flex', gap:2, alignItems:'flex-end' }}>
                                <div style={{ flex:1, height:Math.max(hI,2), background:'#1D9E75', borderRadius:'2px 2px 0 0' }}/>
                                <div style={{ flex:1, height:Math.max(hG,2), background:'#E24B4A', borderRadius:'2px 2px 0 0' }}/>
                              </div>
                              <div style={{ fontSize:9, color:'#9ca3af', textAlign:'center' }}>{f.label}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Tabla */}
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead>
                      <tr style={{ background:'#3266ad' }}>
                        {['Período','Ingresos','Egresos','Flujo neto','Caja acumulada'].map(h=>(
                          <th key={h} style={{ textAlign:'left', padding:'8px 12px', color:'#fff', fontWeight:500, fontSize:12 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {flujoConAcum.map((f,i)=>(
                        <tr key={f.key} style={{ background:i%2===0?'#f8fafc':'#fff', borderBottom:'1px solid #e5e7eb' }}>
                          <td style={{ padding:'8px 12px', fontWeight:500 }}>{f.label}</td>
                          <td style={{ padding:'8px 12px', color:'#1D9E75', fontWeight:500 }}>{fmtCLP(f.ing)}</td>
                          <td style={{ padding:'8px 12px', color:'#E24B4A' }}>({fmtCLP(f.gas)})</td>
                          <td style={{ padding:'8px 12px', fontWeight:600, color:f.flujo>=0?'#3266ad':'#E24B4A' }}>{fmtCLP(f.flujo)}</td>
                          <td style={{ padding:'8px 12px', fontWeight:700, color:f.acum>=0?'#1D9E75':'#E24B4A' }}>{fmtCLP(f.acum)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background:'#f1f5f9', borderTop:'2px solid #3266ad' }}>
                        <td style={{ padding:'9px 12px', fontWeight:700 }}>Total</td>
                        <td style={{ padding:'9px 12px', fontWeight:700, color:'#1D9E75' }}>{fmtCLP(flujoConAcum.reduce((a,f)=>a+f.ing,0))}</td>
                        <td style={{ padding:'9px 12px', fontWeight:700, color:'#E24B4A' }}>({fmtCLP(flujoConAcum.reduce((a,f)=>a+f.gas,0))})</td>
                        <td style={{ padding:'9px 12px', fontWeight:700, color:'#3266ad' }}>{fmtCLP(flujoConAcum.reduce((a,f)=>a+f.flujo,0))}</td>
                        <td style={{ padding:'9px 12px', fontWeight:700, color:cajaAcum>=0?'#1D9E75':'#E24B4A' }}>{fmtCLP(cajaAcum)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* ── Libro de Compras ── */}
              {tab==='compras' && (
                <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:28 }}>
                  <div style={{ borderBottom:'3px solid #3266ad', paddingBottom:14, marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div>
                      <div style={{ fontSize:18, fontWeight:700, color:'#111827' }}>Libro de compras</div>
                      <div style={{ fontSize:12, color:'#6b7280', marginTop:3 }}>{encabezado} · Año {anio} · {libroCompras.length} documentos</div>
                    </div>
                    <div style={{ textAlign:'right', fontSize:12, color:'#6b7280' }}>
                      <div>IVA crédito fiscal</div>
                      <div style={{ fontSize:18, fontWeight:700, color:'#1D9E75' }}>{fmtCLP(totalIvaC)}</div>
                    </div>
                  </div>

                  {libroCompras.length===0 ? (
                    <div style={{ textAlign:'center', padding:'2rem', color:'#9ca3af' }}>Sin facturas recibidas registradas para {anio}</div>
                  ) : (
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:700 }}>
                        <thead>
                          <tr style={{ background:'#3266ad' }}>
                            {['N°','Fecha','Folio','Proveedor','RUT','Neto','IVA','Total','Estado'].map(h=>(
                              <th key={h} style={{ textAlign:'left', padding:'7px 10px', color:'#fff', fontWeight:500, whiteSpace:'nowrap' as const }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {libroCompras.map((d,i)=>(
                            <tr key={d.id} style={{ background:i%2===0?'#f8fafc':'#fff', borderBottom:'1px solid #e5e7eb' }}>
                              <td style={{ padding:'7px 10px', color:'#9ca3af' }}>{i+1}</td>
                              <td style={{ padding:'7px 10px', whiteSpace:'nowrap' as const }}>{d.fecha}</td>
                              <td style={{ padding:'7px 10px', fontWeight:500 }}>{d.folio}</td>
                              <td style={{ padding:'7px 10px' }}>{d.contraparte}</td>
                              <td style={{ padding:'7px 10px', color:'#6b7280', fontSize:11 }}>{d.rut_contraparte}</td>
                              <td style={{ padding:'7px 10px', textAlign:'right' }}>{fmtCLP(d.neto)}</td>
                              <td style={{ padding:'7px 10px', textAlign:'right', color:'#3266ad' }}>{fmtCLP(d.iva)}</td>
                              <td style={{ padding:'7px 10px', textAlign:'right', fontWeight:600 }}>{fmtCLP(d.total)}</td>
                              <td style={{ padding:'7px 10px' }}>
                                <span style={{ fontSize:10, padding:'1px 6px', borderRadius:999, fontWeight:500,
                                  background:d.estado==='pagada'?'#E1F5EE':d.estado==='vencida'?'#FCEBEB':'#FAEEDA',
                                  color:d.estado==='pagada'?'#085041':d.estado==='vencida'?'#791F1F':'#633806' }}>
                                  {d.estado}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background:'#f1f5f9', borderTop:'2px solid #3266ad', fontWeight:700 }}>
                            <td colSpan={5} style={{ padding:'8px 10px' }}>Total {libroCompras.length} documentos</td>
                            <td style={{ padding:'8px 10px', textAlign:'right' }}>{fmtCLP(totalNetoC)}</td>
                            <td style={{ padding:'8px 10px', textAlign:'right', color:'#3266ad' }}>{fmtCLP(totalIvaC)}</td>
                            <td style={{ padding:'8px 10px', textAlign:'right' }}>{fmtCLP(totalC)}</td>
                            <td/>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── Libro de Ventas ── */}
              {tab==='ventas' && (
                <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:28 }}>
                  <div style={{ borderBottom:'3px solid #3266ad', paddingBottom:14, marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div>
                      <div style={{ fontSize:18, fontWeight:700, color:'#111827' }}>Libro de ventas</div>
                      <div style={{ fontSize:12, color:'#6b7280', marginTop:3 }}>{encabezado} · Año {anio} · {libroVentas.length} documentos</div>
                    </div>
                    <div style={{ textAlign:'right', fontSize:12, color:'#6b7280' }}>
                      <div>IVA débito fiscal</div>
                      <div style={{ fontSize:18, fontWeight:700, color:'#E24B4A' }}>{fmtCLP(totalIvaV)}</div>
                    </div>
                  </div>

                  {/* Resumen IVA */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:16 }}>
                    {[
                      { l:'IVA débito (ventas)',   v:fmtCLP(totalIvaV), c:'#E24B4A' },
                      { l:'IVA crédito (compras)', v:fmtCLP(totalIvaC), c:'#1D9E75' },
                      { l:'IVA neto a pagar F29',  v:fmtCLP(ivaNeto),   c:ivaNeto>0?'#E24B4A':'#1D9E75' },
                    ].map(k=>(
                      <div key={k.l} style={{ background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:8, padding:'10px', textAlign:'center' }}>
                        <div style={{ fontSize:10, color:'#6b7280', marginBottom:3 }}>{k.l}</div>
                        <div style={{ fontSize:14, fontWeight:700, color:k.c }}>{k.v}</div>
                      </div>
                    ))}
                  </div>

                  {libroVentas.length===0 ? (
                    <div style={{ textAlign:'center', padding:'2rem', color:'#9ca3af' }}>Sin facturas emitidas ni boletas para {anio}</div>
                  ) : (
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:700 }}>
                        <thead>
                          <tr style={{ background:'#3266ad' }}>
                            {['N°','Fecha','Tipo','Folio','Cliente','RUT','Neto','IVA','Total','Estado'].map(h=>(
                              <th key={h} style={{ textAlign:'left', padding:'7px 10px', color:'#fff', fontWeight:500, whiteSpace:'nowrap' as const }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {libroVentas.map((d,i)=>(
                            <tr key={d.id} style={{ background:i%2===0?'#f8fafc':'#fff', borderBottom:'1px solid #e5e7eb' }}>
                              <td style={{ padding:'7px 10px', color:'#9ca3af' }}>{i+1}</td>
                              <td style={{ padding:'7px 10px', whiteSpace:'nowrap' as const }}>{d.fecha}</td>
                              <td style={{ padding:'7px 10px' }}>
                                <span style={{ fontSize:10, padding:'1px 6px', borderRadius:999, fontWeight:600, background:d.tipo==='FE'?'#E6F1FB':'#E1F5EE', color:d.tipo==='FE'?'#0C447C':'#085041' }}>
                                  {d.tipo==='FE'?'Factura':'Boleta'}
                                </span>
                              </td>
                              <td style={{ padding:'7px 10px', fontWeight:500 }}>{d.folio}</td>
                              <td style={{ padding:'7px 10px' }}>{d.contraparte}</td>
                              <td style={{ padding:'7px 10px', color:'#6b7280', fontSize:11 }}>{d.rut_contraparte}</td>
                              <td style={{ padding:'7px 10px', textAlign:'right' }}>{fmtCLP(d.neto)}</td>
                              <td style={{ padding:'7px 10px', textAlign:'right', color:'#E24B4A' }}>{fmtCLP(d.iva)}</td>
                              <td style={{ padding:'7px 10px', textAlign:'right', fontWeight:600 }}>{fmtCLP(d.total)}</td>
                              <td style={{ padding:'7px 10px' }}>
                                <span style={{ fontSize:10, padding:'1px 6px', borderRadius:999, fontWeight:500,
                                  background:d.estado==='pagada'?'#E1F5EE':d.estado==='vencida'?'#FCEBEB':'#FAEEDA',
                                  color:d.estado==='pagada'?'#085041':d.estado==='vencida'?'#791F1F':'#633806' }}>
                                  {d.estado}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background:'#f1f5f9', borderTop:'2px solid #3266ad', fontWeight:700 }}>
                            <td colSpan={6} style={{ padding:'8px 10px' }}>Total {libroVentas.length} documentos</td>
                            <td style={{ padding:'8px 10px', textAlign:'right' }}>{fmtCLP(totalNetoV)}</td>
                            <td style={{ padding:'8px 10px', textAlign:'right', color:'#E24B4A' }}>{fmtCLP(totalIvaV)}</td>
                            <td style={{ padding:'8px 10px', textAlign:'right' }}>{fmtCLP(totalV)}</td>
                            <td/>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const sel: React.CSSProperties = { fontSize:13, padding:'6px 10px', border:'1px solid rgba(0,0,0,0.12)', borderRadius:8, background:'#fff' }
const btnP: React.CSSProperties = { display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, border:'none', background:'#3266ad', color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer' }
const lineaEstado: React.CSSProperties = { display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'6px 0', borderBottom:'1px solid #f1f5f9', fontSize:13 }
function secTitle(emoji: string): React.CSSProperties {
  return { fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8, display:'flex', alignItems:'center', gap:6 }
}
