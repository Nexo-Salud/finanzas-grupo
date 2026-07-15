'use client'
import { useState, useEffect, useRef } from 'react'
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
  { href:'/reportes',     label:'Reportes',     icon:'📄', active:true },
  { href:'/bancos',       label:'Bancos',       icon:'🏦' },
  { href:'/tributario',   label:'Documentos',   icon:'🧾' },
  { href:'/proyecciones', label:'Proyecciones', icon:'📈' },
  { href:'/usuarios',     label:'Usuarios',     icon:'👥' },
  { href:'/kpis',         label:'KPIs',         icon:'📊' },
  { href:'/ia',           label:'Análisis IA',  icon:'🧠' },
]

const MESES_NOMBRE = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MESES_CORTO  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

type Empresa = { id: string; nombre_corto: string; nombre: string; color: string; rut?: string }
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

export default function ReportesPage() {
  const [empresas,    setEmpresas]    = useState<Empresa[]>([])
  const [movimientos, setMovimientos] = useState<Mov[]>([])
  const [cargando,    setCargando]    = useState(true)
  const [generando,   setGenerando]   = useState(false)
  const [tab,         setTab]         = useState<'nuevo'|'preview'>('nuevo')

  const hoy = new Date()
  const [empresa,  setEmpresa]  = useState('all')
  const [mes,      setMes]      = useState(hoy.getMonth() + 1)
  const [anio,     setAnio]     = useState(hoy.getFullYear())
  const [autor,    setAutor]    = useState('')
  const [incluirCats, setIncluirCats] = useState(true)
  const [incluirMensual, setIncluirMensual] = useState(true)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setCargando(true)
    try {
      const [{ data: emps }, { data: movs }] = await Promise.all([
        supabase.from('empresas').select('id,nombre_corto,nombre,color,rut').eq('activa',true).order('nombre_corto'),
        supabase.from('movimientos').select('empresa_id,tipo,monto,fecha,categoria,descripcion').order('fecha').limit(1000),
      ])
      setEmpresas(emps || [])
      setMovimientos(movs || [])
    } catch(e) { console.error(e) }
    finally { setCargando(false) }
  }

  // ── Datos del reporte ──
  const empSelec = empresa === 'all' ? null : empresas.find(e=>e.id===empresa)
  const scope    = movimientos.filter(m => empresa==='all' || m.empresa_id===empresa)
  const scopeMes = scope.filter(m => {
    const [y,mo] = m.fecha.split('-')
    return parseInt(y)===anio && parseInt(mo)===mes
  })

  const ingTotal  = scope.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)
  const gasTotal  = scope.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0)
  const utilTotal = ingTotal - gasTotal
  const mgTotal   = ingTotal>0 ? Math.round(utilTotal/ingTotal*100) : 0

  const ingMes    = scopeMes.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)
  const gasMes    = scopeMes.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0)
  const utilMes   = ingMes - gasMes
  const mgMes     = ingMes>0 ? Math.round(utilMes/ingMes*100) : 0

  // Categorías del mes
  const catsMes: Record<string,{tipo:string;total:number}> = {}
  scopeMes.forEach(m => {
    if (!catsMes[m.categoria]) catsMes[m.categoria] = { tipo:m.tipo, total:0 }
    catsMes[m.categoria].total += m.monto
  })
  const catsArr = Object.entries(catsMes).sort((a,b)=>b[1].total-a[1].total)

  // Historial mensual
  const porMes: Record<string,{ing:number;gas:number}> = {}
  scope.forEach(m => {
    const key = m.fecha.slice(0,7)
    if (!porMes[key]) porMes[key] = {ing:0,gas:0}
    if (m.tipo==='ingreso') porMes[key].ing += m.monto
    else porMes[key].gas += m.monto
  })
  const historial = Object.entries(porMes).sort((a,b)=>a[0].localeCompare(b[0]))

  // Por empresa (solo si es grupo completo)
  const porEmpresa = empresas.map(emp => {
    const movEmp = movimientos.filter(m=>m.empresa_id===emp.id)
    const eIng   = movEmp.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)
    const eGas   = movEmp.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0)
    const eUtil  = eIng - eGas
    const eMg    = eIng>0 ? Math.round(eUtil/eIng*100) : 0
    return { ...emp, ing:eIng, gas:eGas, util:eUtil, mg:eMg }
  })

  // Imprimir como PDF
  function imprimirPDF() {
    setGenerando(true)
    setTab('preview')
    setTimeout(() => {
      window.print()
      setGenerando(false)
    }, 500)
  }

  const tituloReporte = empresa==='all'
    ? `Reporte consolidado grupo — ${MESES_NOMBRE[mes-1]} ${anio}`
    : `Reporte ${empSelec?.nombre_corto} — ${MESES_NOMBRE[mes-1]} ${anio}`

  return (
    <div style={{ minHeight:'100vh', background:'#f8f9fb', fontFamily:'DM Sans, sans-serif' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-area { margin: 0 !important; padding: 0 !important; }
          body { background: white !important; }
        }
      `}</style>

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
            <div style={{ fontSize:15, fontWeight:600 }}>Reportes financieros</div>
            {!cargando && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:'#E1F5EE', color:'#085041', fontWeight:500 }}>🟢 Datos reales</span>}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {tab==='preview' && (
              <button onClick={imprimirPDF} disabled={generando} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, border:'none', background:'#3266ad', color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer' }}>
                🖨️ {generando ? 'Preparando...' : 'Imprimir / Guardar PDF'}
              </button>
            )}
          </div>
        </div>

        <div style={{ padding:'24px 28px' }}>

          {cargando && <div style={{ textAlign:'center', padding:'4rem', color:'#9ca3af' }}>⏳ Cargando datos reales...</div>}

          {!cargando && (
            <>
              {/* Tabs */}
              <div className="no-print" style={{ display:'flex', gap:6, marginBottom:20 }}>
                {([
                  {k:'nuevo',   l:'⚙️ Configurar reporte'},
                  {k:'preview', l:'👁️ Vista previa'},
                ] as const).map(t=>(
                  <button key={t.k} onClick={()=>setTab(t.k)} style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer', border:'1px solid rgba(0,0,0,0.1)', background:tab===t.k?'#eff4ff':'#fff', color:tab===t.k?'#3266ad':'#6b7280', fontWeight:tab===t.k?500:400 }}>
                    {t.l}
                  </button>
                ))}
              </div>

              {/* ── Configurar ── */}
              {tab==='nuevo' && (
                <>
                  <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20, marginBottom:16 }}>
                    <div style={sTitle}>Configuración del reporte</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                      <div><label style={lbl}>Empresa</label>
                        <select value={empresa} onChange={e=>setEmpresa(e.target.value)} style={inp}>
                          <option value="all">Grupo completo</option>
                          {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre_corto}</option>)}
                        </select>
                      </div>
                      <div><label style={lbl}>Mes del reporte</label>
                        <select value={mes} onChange={e=>setMes(parseInt(e.target.value))} style={inp}>
                          {MESES_NOMBRE.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
                        </select>
                      </div>
                      <div><label style={lbl}>Año</label>
                        <select value={anio} onChange={e=>setAnio(parseInt(e.target.value))} style={inp}>
                          {[2024,2025,2026,2027].map(a=><option key={a}>{a}</option>)}
                        </select>
                      </div>
                      <div><label style={lbl}>Preparado por</label>
                        <input value={autor} onChange={e=>setAutor(e.target.value)} placeholder="Nombre del responsable" style={inp}/>
                      </div>
                    </div>
                    <div style={{ fontSize:12, fontWeight:600, color:'#6b7280', marginBottom:8 }}>Secciones a incluir</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      {[
                        { label:'Resumen ejecutivo (KPIs)', checked:true, disabled:true },
                        { label:'Detalle por categoría', checked:incluirCats, set:setIncluirCats },
                        { label:'Historial mensual', checked:incluirMensual, set:setIncluirMensual },
                        { label:'Tabla por empresa', checked:true, disabled:true },
                      ].map(s=>(
                        <label key={s.label} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:s.disabled?'#9ca3af':'#374151', cursor:s.disabled?'default':'pointer' }}>
                          <input type="checkbox" checked={s.checked} disabled={s.disabled}
                            onChange={()=>s.set && s.set(!s.checked)}
                            style={{ accentColor:'#3266ad' }}/>
                          {s.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Preview rápido de métricas */}
                  <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20, marginBottom:16 }}>
                    <div style={sTitle}>Datos disponibles para {MESES_NOMBRE[mes-1]} {anio}</div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10, marginBottom:14 }}>
                      {[
                        { label:'Ingresos del mes',  value:fmtM(ingMes),   color:'#1D9E75', bg:'#E1F5EE' },
                        { label:'Gastos del mes',    value:fmtM(gasMes),   color:'#E24B4A', bg:'#FCEBEB' },
                        { label:'Utilidad del mes',  value:fmtM(utilMes),  color:'#3266ad', bg:'#E6F1FB' },
                        { label:'Margen del mes',    value:mgMes+'%',       color:'#7F77DD', bg:'#EEEDFE' },
                      ].map(m=>(
                        <div key={m.label} style={{ background:m.bg, borderRadius:10, padding:'12px 14px' }}>
                          <div style={{ fontSize:11, color:m.color, marginBottom:3, opacity:0.8 }}>{m.label}</div>
                          <div style={{ fontSize:18, fontWeight:700, color:m.color }}>{m.value}</div>
                        </div>
                      ))}
                    </div>
                    {scopeMes.length===0 && (
                      <div style={{ background:'#FAEEDA', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#633806' }}>
                        ⚠️ No hay movimientos registrados para {MESES_NOMBRE[mes-1]} {anio}. Selecciona otro período.
                      </div>
                    )}
                  </div>

                  <button onClick={()=>setTab('preview')} style={{ width:'100%', padding:11, borderRadius:9, border:'none', background:'#3266ad', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer' }}>
                    👁️ Ver reporte completo →
                  </button>
                </>
              )}

              {/* ── Vista previa / PDF ── */}
              {tab==='preview' && (
                <div ref={printRef} style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:32, maxWidth:760, margin:'0 auto' }}>

                  {/* Encabezado */}
                  <div style={{ borderBottom:'3px solid #3266ad', paddingBottom:16, marginBottom:24, display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div>
                      <div style={{ fontSize:22, fontWeight:700, color:'#111827', marginBottom:4 }}>
                        {tituloReporte}
                      </div>
                      <div style={{ fontSize:12, color:'#6b7280' }}>
                        {empresa==='all' ? 'Grupo consolidado — todas las empresas' : empSelec?.nombre}
                        {empSelec?.rut && ` · RUT ${empSelec.rut}`}
                      </div>
                      <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>
                        Generado el {hoy.toLocaleDateString('es-CL')}
                        {autor && ` · Preparado por ${autor}`}
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:28, fontWeight:700, color:'#3266ad' }}>📊</div>
                      <div style={{ fontSize:11, color:'#9ca3af' }}>Finanzas Grupo</div>
                    </div>
                  </div>

                  {/* KPIs del mes */}
                  <div style={{ fontSize:11, fontWeight:700, color:'#3266ad', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10, borderBottom:'1px solid #e5e7eb', paddingBottom:4 }}>
                    Indicadores — {MESES_NOMBRE[mes-1]} {anio}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:24 }}>
                    {[
                      { l:'Ingresos',  v:fmtCLP(ingMes),  c:'#1D9E75' },
                      { l:'Gastos',    v:fmtCLP(gasMes),  c:'#E24B4A' },
                      { l:'Utilidad',  v:fmtCLP(utilMes), c:'#3266ad' },
                      { l:'Margen',    v:mgMes+'%',         c:'#7F77DD' },
                    ].map(k=>(
                      <div key={k.l} style={{ background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:8, padding:'10px', textAlign:'center' }}>
                        <div style={{ fontSize:10, color:'#6b7280', marginBottom:3 }}>{k.l}</div>
                        <div style={{ fontSize:14, fontWeight:700, color:k.c }}>{k.v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Acumulado total */}
                  <div style={{ fontSize:11, fontWeight:700, color:'#3266ad', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10, borderBottom:'1px solid #e5e7eb', paddingBottom:4 }}>
                    Acumulado total del período
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:24 }}>
                    {[
                      { l:'Ingresos tot.',  v:fmtCLP(ingTotal),  c:'#1D9E75' },
                      { l:'Gastos tot.',    v:fmtCLP(gasTotal),  c:'#E24B4A' },
                      { l:'Utilidad tot.',  v:fmtCLP(utilTotal), c:'#3266ad' },
                      { l:'Margen tot.',    v:mgTotal+'%',         c:'#7F77DD' },
                    ].map(k=>(
                      <div key={k.l} style={{ background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:8, padding:'10px', textAlign:'center' }}>
                        <div style={{ fontSize:10, color:'#6b7280', marginBottom:3 }}>{k.l}</div>
                        <div style={{ fontSize:14, fontWeight:700, color:k.c }}>{k.v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Detalle categorías del mes */}
                  {incluirCats && catsArr.length > 0 && (
                    <>
                      <div style={{ fontSize:11, fontWeight:700, color:'#3266ad', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10, borderBottom:'1px solid #e5e7eb', paddingBottom:4 }}>
                        Detalle por categoría — {MESES_NOMBRE[mes-1]} {anio}
                      </div>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, marginBottom:24 }}>
                        <thead>
                          <tr style={{ background:'#3266ad' }}>
                            {['Categoría','Tipo','Monto'].map(h=>(
                              <th key={h} style={{ textAlign:'left', padding:'7px 10px', color:'#fff', fontWeight:500 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {catsArr.map(([cat,val],i)=>(
                            <tr key={cat} style={{ background:i%2===0?'#f8fafc':'#fff', borderBottom:'1px solid #e5e7eb' }}>
                              <td style={{ padding:'7px 10px', fontWeight:500 }}>{cat}</td>
                              <td style={{ padding:'7px 10px' }}>
                                <span style={{ fontSize:10, padding:'1px 6px', borderRadius:999, fontWeight:600, background:val.tipo==='ingreso'?'#E1F5EE':'#FCEBEB', color:val.tipo==='ingreso'?'#085041':'#791F1F' }}>
                                  {val.tipo}
                                </span>
                              </td>
                              <td style={{ padding:'7px 10px', fontWeight:600, color:val.tipo==='ingreso'?'#1D9E75':'#E24B4A' }}>
                                {fmtCLP(val.total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background:'#f1f5f9', borderTop:'2px solid #e5e7eb' }}>
                            <td colSpan={2} style={{ padding:'8px 10px', fontWeight:700 }}>Resultado neto del mes</td>
                            <td style={{ padding:'8px 10px', fontWeight:700, color:utilMes>=0?'#1D9E75':'#E24B4A' }}>{fmtCLP(utilMes)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </>
                  )}

                  {/* Historial mensual */}
                  {incluirMensual && historial.length > 0 && (
                    <>
                      <div style={{ fontSize:11, fontWeight:700, color:'#3266ad', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10, borderBottom:'1px solid #e5e7eb', paddingBottom:4 }}>
                        Historial mensual
                      </div>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, marginBottom:24 }}>
                        <thead>
                          <tr style={{ background:'#3266ad' }}>
                            {['Mes','Ingresos','Gastos','Utilidad','Margen'].map(h=>(
                              <th key={h} style={{ textAlign:'left', padding:'7px 10px', color:'#fff', fontWeight:500 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {historial.map(([key,val],i)=>{
                            const [y,m] = key.split('-')
                            const neto  = val.ing - val.gas
                            const mg    = val.ing>0 ? Math.round(neto/val.ing*100) : 0
                            const esMes = parseInt(m)===mes && parseInt(y)===anio
                            return (
                              <tr key={key} style={{ background:esMes?'#eff4ff':i%2===0?'#f8fafc':'#fff', borderBottom:'1px solid #e5e7eb', fontWeight:esMes?600:400 }}>
                                <td style={{ padding:'7px 10px' }}>{MESES_NOMBRE[parseInt(m)-1]} {y}{esMes?' ←':''}</td>
                                <td style={{ padding:'7px 10px', color:'#1D9E75' }}>{fmtCLP(val.ing)}</td>
                                <td style={{ padding:'7px 10px', color:'#E24B4A' }}>{fmtCLP(val.gas)}</td>
                                <td style={{ padding:'7px 10px', color:neto>=0?'#3266ad':'#E24B4A' }}>{fmtCLP(neto)}</td>
                                <td style={{ padding:'7px 10px', color:mg>=30?'#1D9E75':mg>=15?'#EF9F27':'#E24B4A' }}>{mg}%</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </>
                  )}

                  {/* Por empresa */}
                  {empresa==='all' && (
                    <>
                      <div style={{ fontSize:11, fontWeight:700, color:'#3266ad', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10, borderBottom:'1px solid #e5e7eb', paddingBottom:4 }}>
                        Resumen por empresa — acumulado
                      </div>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, marginBottom:24 }}>
                        <thead>
                          <tr style={{ background:'#3266ad' }}>
                            {['Empresa','Ingresos','Gastos','Utilidad','Margen'].map(h=>(
                              <th key={h} style={{ textAlign:'left', padding:'7px 10px', color:'#fff', fontWeight:500 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {porEmpresa.map((e,i)=>(
                            <tr key={e.id} style={{ background:i%2===0?'#f8fafc':'#fff', borderBottom:'1px solid #e5e7eb' }}>
                              <td style={{ padding:'7px 10px', fontWeight:500 }}>{e.nombre_corto}</td>
                              <td style={{ padding:'7px 10px', color:'#1D9E75', fontWeight:600 }}>{fmtCLP(e.ing)}</td>
                              <td style={{ padding:'7px 10px', color:'#E24B4A' }}>{fmtCLP(e.gas)}</td>
                              <td style={{ padding:'7px 10px', fontWeight:600, color:e.util>=0?'#3266ad':'#E24B4A' }}>{fmtCLP(e.util)}</td>
                              <td style={{ padding:'7px 10px', color:e.mg>=30?'#1D9E75':e.mg>=15?'#EF9F27':'#E24B4A', fontWeight:600 }}>{e.mg}%</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background:'#f1f5f9', borderTop:'2px solid #e5e7eb' }}>
                            <td style={{ padding:'8px 10px', fontWeight:700 }}>Total grupo</td>
                            <td style={{ padding:'8px 10px', fontWeight:700, color:'#1D9E75' }}>{fmtCLP(ingTotal)}</td>
                            <td style={{ padding:'8px 10px', fontWeight:700, color:'#E24B4A' }}>{fmtCLP(gasTotal)}</td>
                            <td style={{ padding:'8px 10px', fontWeight:700, color:'#3266ad' }}>{fmtCLP(utilTotal)}</td>
                            <td style={{ padding:'8px 10px', fontWeight:700, color:'#7F77DD' }}>{mgTotal}%</td>
                          </tr>
                        </tfoot>
                      </table>
                    </>
                  )}

                  {/* Footer */}
                  <div style={{ borderTop:'1px solid #e5e7eb', paddingTop:12, marginTop:8, display:'flex', justifyContent:'space-between', fontSize:10, color:'#9ca3af' }}>
                    <span>Plataforma Financiera Grupo Farmacias · Datos reales Supabase</span>
                    <span>Generado {hoy.toLocaleDateString('es-CL')} {hoy.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})}</span>
                  </div>

                  {/* Botón imprimir en preview */}
                  <div className="no-print" style={{ marginTop:20, display:'flex', gap:8 }}>
                    <button onClick={imprimirPDF} style={{ flex:1, padding:11, borderRadius:9, border:'none', background:'#3266ad', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer' }}>
                      🖨️ Imprimir / Guardar como PDF
                    </button>
                    <button onClick={()=>setTab('nuevo')} style={{ padding:'11px 16px', borderRadius:9, border:'1px solid rgba(0,0,0,0.12)', background:'#fff', color:'#374151', fontSize:13, fontWeight:500, cursor:'pointer' }}>
                      ← Volver
                    </button>
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

const lbl: React.CSSProperties  = { display:'block', fontSize:12, fontWeight:500, color:'#6b7280', marginBottom:4 }
const inp: React.CSSProperties  = { width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid rgba(0,0,0,0.14)', borderRadius:8, background:'#fff', color:'#111827', fontFamily:'DM Sans, sans-serif' }
const sTitle: React.CSSProperties = { fontSize:12, fontWeight:600, color:'#6b7280', textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:14 }
