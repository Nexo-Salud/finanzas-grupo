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

type Empresa = { id: string; nombre_corto: string; nombre: string; color: string; rut?: string }
type Mov     = { empresa_id: string; tipo: string; monto: number; fecha: string; categoria: string; descripcion?: string }
type Doc     = { id: string; empresa_id: string; tipo: string; folio: string; contraparte: string; rut_contraparte: string; fecha: string; neto: number; iva: number; total: number; estado: string }

function fmtCLP(n: number) {
  if (n === 0) return '-'
  return Math.round(Math.abs(n)).toLocaleString('es-CL')
}
function fmtM(n: number) {
  const a=Math.abs(n),s=n<0?'-':''
  if(a>=1e6) return s+'$'+(Math.round(a/1e5)/10)+'M'
  if(a>=1000) return s+'$'+Math.round(a/1000)+'K'
  return s+'$'+Math.round(a)
}

type CuentaBalance = {
  num: number
  nombre: string
  debe: number
  haber: number
  deudor: number
  acreedor: number
  activo: number
  pasivo: number
  perdidas: number
  ganancias: number
}

export default function EstadosPage() {
  const [empresas,    setEmpresas]    = useState<Empresa[]>([])
  const [movimientos, setMovimientos] = useState<Mov[]>([])
  const [documentos,  setDocumentos]  = useState<Doc[]>([])
  const [cargando,    setCargando]    = useState(true)
  const [empresa,     setEmpresa]     = useState('all')
  const [tab,         setTab]         = useState<'balance'|'resultados'|'flujo'|'compras'|'ventas'>('balance')

  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes,  setMes]  = useState(hoy.getMonth() + 1)

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

  const scope     = movimientos.filter(m => empresa==='all' || m.empresa_id===empresa)
  const scopeDocs = documentos.filter(d => empresa==='all' || d.empresa_id===empresa)
  const scopeAnio = scope.filter(m => m.fecha.startsWith(anio.toString()))
  const docsAnio  = scopeDocs.filter(d => d.fecha.startsWith(anio.toString()))

  // ── Calcular cuentas para balance 8 columnas ──
  function calcBalance(): CuentaBalance[] {
    // Ventas brutas
    const ventas     = docsAnio.filter(d=>['FE','BE'].includes(d.tipo)).reduce((a,d)=>a+d.neto,0)
    const ivaDF      = docsAnio.filter(d=>['FE','BE'].includes(d.tipo)).reduce((a,d)=>a+d.iva,0)
    // Compras
    const compras    = docsAnio.filter(d=>d.tipo==='FR').reduce((a,d)=>a+d.neto,0)
    const ivaCF      = docsAnio.filter(d=>d.tipo==='FR').reduce((a,d)=>a+d.iva,0)
    // Sueldos
    const sueldos    = scopeAnio.filter(m=>m.tipo==='gasto'&&m.categoria==='Remuneraciones').reduce((a,m)=>a+m.monto,0)
    // Leyes sociales
    const leyesSoc   = scopeAnio.filter(m=>m.tipo==='gasto'&&m.categoria==='Leyes sociales').reduce((a,m)=>a+m.monto,0)
    // Honorarios
    const honorarios = scopeAnio.filter(m=>m.tipo==='gasto'&&m.categoria==='Boletas de honorarios').reduce((a,m)=>a+m.monto,0)
    // Arriendo
    const arriendo   = scopeAnio.filter(m=>m.tipo==='gasto'&&m.categoria==='Arriendos pagados').reduce((a,m)=>a+m.monto,0)
    // Otros gastos operacionales
    const otrosGas   = scopeAnio.filter(m=>m.tipo==='gasto'&&!['Remuneraciones','Leyes sociales','Boletas de honorarios','Arriendos pagados','Proveedores','Impuestos'].includes(m.categoria)).reduce((a,m)=>a+m.monto,0)
    // Impuestos
    const impuestos  = scopeAnio.filter(m=>m.tipo==='gasto'&&m.categoria==='Impuestos').reduce((a,m)=>a+m.monto,0)
    // Caja (ingresos - egresos totales)
    const cajaDebe   = scope.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)
    const cajaHaber  = scope.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0)
    const cajaSaldo  = cajaDebe - cajaHaber
    // CxC pendientes
    const cxc        = scopeDocs.filter(d=>['FE','BE'].includes(d.tipo)&&d.estado==='pendiente').reduce((a,d)=>a+d.total,0)
    // CxP pendientes
    const cxp        = scopeDocs.filter(d=>d.tipo==='FR'&&d.estado==='pendiente').reduce((a,d)=>a+d.total,0)
    // Retenciones pendientes
    const retenciones= scopeDocs.filter(d=>d.tipo==='RET'&&d.estado==='pendiente').reduce((a,d)=>a+Math.round(d.total*0.115),0)

    // Utilidad/Pérdida
    const totalIng   = ventas
    const totalGas   = compras + sueldos + leyesSoc + honorarios + arriendo + otrosGas + impuestos
    const resultado  = totalIng - totalGas
    const esUtilidad = resultado >= 0

    const cuentas: CuentaBalance[] = []
    let num = 1

    function addCuenta(nombre: string, debe: number, haber: number, tipo: 'activo'|'pasivo'|'perdida'|'ganancia'|'ninguno') {
      const saldo = debe - haber
      const deudor   = saldo > 0 ? saldo : 0
      const acreedor = saldo < 0 ? Math.abs(saldo) : 0
      let activo=0, pasivo=0, perdidas=0, ganancias=0
      if (tipo==='activo')   activo   = deudor
      if (tipo==='pasivo')   pasivo   = acreedor
      if (tipo==='perdida')  perdidas = deudor
      if (tipo==='ganancia') ganancias= acreedor
      if (debe>0||haber>0) {
        cuentas.push({ num:num++, nombre, debe, haber, deudor, acreedor, activo, pasivo, perdidas, ganancias })
      }
    }

    // ACTIVOS
    addCuenta('CAJA',                      cajaDebe,    cajaHaber,   cajaSaldo>0?'activo':'pasivo')
    if (cxc>0) addCuenta('CUENTAS POR COBRAR', cxc, 0, 'activo')
    if (ivaCF>0) addCuenta('IVA CRÉDITO FISCAL', ivaCF, 0, 'activo')

    // PASIVOS
    if (ivaDF>0) addCuenta('IVA DÉBITO FISCAL', 0, ivaDF, 'pasivo')
    if (cxp>0) addCuenta('PROVEEDORES POR PAGAR', 0, cxp, 'pasivo')
    if (retenciones>0) addCuenta('RETENCIONES POR PAGAR', 0, retenciones, 'pasivo')
    if (impuestos>0) addCuenta('PROVISIÓN IMPUESTOS', 0, impuestos, 'pasivo')
    if (leyesSoc>0) addCuenta('IMPOSICIONES POR PAGAR', 0, leyesSoc, 'pasivo')

    // RESULTADOS - PÉRDIDAS
    if (compras>0)    addCuenta('COSTO DE VENTAS',      compras,    0, 'perdida')
    if (sueldos>0)    addCuenta('SUELDOS Y SALARIOS',   sueldos,    0, 'perdida')
    if (honorarios>0) addCuenta('HONORARIOS',           honorarios, 0, 'perdida')
    if (arriendo>0)   addCuenta('ARRIENDO',             arriendo,   0, 'perdida')
    if (otrosGas>0)   addCuenta('OTROS GASTOS OPER.',   otrosGas,   0, 'perdida')

    // RESULTADOS - GANANCIAS
    if (ventas>0) addCuenta('VENTAS',                   0, ventas,  'ganancia')

    // RESULTADO FINAL
    if (!esUtilidad && Math.abs(resultado)>0) {
      addCuenta('PÉRDIDAS Y GANANCIAS', Math.abs(resultado), 0, 'perdida')
    } else if (esUtilidad && resultado>0) {
      addCuenta('PÉRDIDAS Y GANANCIAS', 0, resultado, 'ganancia')
    }

    return cuentas
  }

  const cuentas = calcBalance()

  // Sumas
  const sumaDebe     = cuentas.reduce((a,c)=>a+c.debe,0)
  const sumaHaber    = cuentas.reduce((a,c)=>a+c.haber,0)
  const sumaDeudor   = cuentas.reduce((a,c)=>a+c.deudor,0)
  const sumaAcreedor = cuentas.reduce((a,c)=>a+c.acreedor,0)
  const sumaActivo   = cuentas.reduce((a,c)=>a+c.activo,0)
  const sumaPasivo   = cuentas.reduce((a,c)=>a+c.pasivo,0)
  const sumaPerdidas = cuentas.reduce((a,c)=>a+c.perdidas,0)
  const sumaGanancias= cuentas.reduce((a,c)=>a+c.ganancias,0)
  const utilidad     = sumaGanancias - sumaPerdidas
  const esUtilidad   = utilidad >= 0

  // Estado de resultados
  const scopeMes = scope.filter(m => { const [y,mo]=m.fecha.split('-'); return parseInt(y)===anio&&parseInt(mo)===mes })
  const catIng: Record<string,number> = {}
  const catGas: Record<string,number> = {}
  scopeMes.forEach(m => {
    if (m.tipo==='ingreso') catIng[m.categoria]=(catIng[m.categoria]||0)+m.monto
    else catGas[m.categoria]=(catGas[m.categoria]||0)+m.monto
  })
  const ingMes  = Object.values(catIng).reduce((a,b)=>a+b,0)
  const gasMes  = Object.values(catGas).reduce((a,b)=>a+b,0)
  const utilMes = ingMes - gasMes
  const mgMes   = ingMes>0 ? Math.round(utilMes/ingMes*100) : 0

  // Flujo de caja
  const porMes: Record<string,{ing:number;gas:number}> = {}
  scope.forEach(m => {
    const key = m.fecha.slice(0,7)
    if (!porMes[key]) porMes[key] = {ing:0,gas:0}
    if (m.tipo==='ingreso') porMes[key].ing += m.monto
    else porMes[key].gas += m.monto
  })
  const historial = Object.entries(porMes).sort((a,b)=>a[0].localeCompare(b[0]))
  let cajaAcum = 0
  const flujoConAcum = historial.map(([key,val])=>{
    const [y,m] = key.split('-')
    cajaAcum += val.ing - val.gas
    return { key, label:`${MESES[parseInt(m)-1].slice(0,3)} ${y}`, ...val, flujo:val.ing-val.gas, acum:cajaAcum }
  })

  // Libros
  const libroCompras = documentos.filter(d=>(empresa==='all'||d.empresa_id===empresa)&&d.tipo==='FR'&&d.fecha.startsWith(anio.toString())).sort((a,b)=>a.fecha.localeCompare(b.fecha))
  const libroVentas  = documentos.filter(d=>(empresa==='all'||d.empresa_id===empresa)&&['FE','BE'].includes(d.tipo)&&d.fecha.startsWith(anio.toString())).sort((a,b)=>a.fecha.localeCompare(b.fecha))
  const totalIvaC    = libroCompras.reduce((a,d)=>a+d.iva,0)
  const totalIvaV    = libroVentas.reduce((a,d)=>a+d.iva,0)
  const ivaNeto      = totalIvaV - totalIvaC

  const empInfo  = empresa==='all' ? null : empresas.find(e=>e.id===empresa)
  const razonSoc = empInfo?.nombre || 'GRUPO CONSOLIDADO'
  const rut      = empInfo?.rut || ''

  function imprimir() { window.print() }

  const thStyle: React.CSSProperties = { padding:'5px 6px', textAlign:'center', fontWeight:600, fontSize:10, color:'#fff', background:'#1e3a5f', border:'1px solid #2d5080', whiteSpace:'nowrap' as const }
  const tdStyle: React.CSSProperties = { padding:'4px 6px', fontSize:11, border:'1px solid #e5e7eb', textAlign:'right', whiteSpace:'nowrap' as const }
  const tdNomStyle: React.CSSProperties = { padding:'4px 6px', fontSize:11, border:'1px solid #e5e7eb', textAlign:'left' }

  return (
    <div style={{ minHeight:'100vh', background:'#f8f9fb', fontFamily:'Arial, sans-serif' }}>
      <style>{`
        @media print {
          .no-print { display:none!important; }
          body { background:white!important; font-size:10px; }
          .print-full { margin:0!important; padding:10px!important; }
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
            <div style={{ fontSize:15, fontWeight:600 }}>Estados financieros</div>
            {!cargando && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:'#E1F5EE', color:'#085041', fontWeight:500 }}>🟢 Datos reales</span>}
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <select value={empresa} onChange={e=>setEmpresa(e.target.value)} style={sel}>
              <option value="all">Grupo completo</option>
              {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre_corto}</option>)}
            </select>
            <select value={anio} onChange={e=>setAnio(parseInt(e.target.value))} style={sel}>
              {[2024,2025,2026,2027].map(a=><option key={a}>{a}</option>)}
            </select>
            {(tab==='resultados') && (
              <select value={mes} onChange={e=>setMes(parseInt(e.target.value))} style={sel}>
                {MESES.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
              </select>
            )}
            <button onClick={imprimir} style={btnP}>🖨️ PDF</button>
          </div>
        </div>

        <div className="print-full" style={{ padding:'24px 28px' }}>
          {cargando && <div style={{ textAlign:'center', padding:'4rem', color:'#9ca3af' }}>⏳ Cargando datos...</div>}

          {!cargando && (
            <>
              {/* Tabs */}
              <div className="no-print" style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap' }}>
                {([
                  {k:'balance',    l:'⚖️ Balance 8 columnas'},
                  {k:'resultados', l:'📊 Estado de resultados'},
                  {k:'flujo',      l:'💧 Flujo de caja'},
                  {k:'compras',    l:'📥 Libro de compras'},
                  {k:'ventas',     l:'📤 Libro de ventas'},
                ] as const).map(t=>(
                  <button key={t.k} onClick={()=>setTab(t.k)} style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer', border:'1px solid rgba(0,0,0,0.1)', background:tab===t.k?'#eff4ff':'#fff', color:tab===t.k?'#3266ad':'#6b7280', fontWeight:tab===t.k?500:400 }}>
                    {t.l}
                  </button>
                ))}
              </div>

              {/* ── BALANCE 8 COLUMNAS ── */}
              {tab==='balance' && (
                <div style={{ background:'#fff', borderRadius:14, padding:24, overflowX:'auto' }}>
                  {/* Encabezado formal */}
                  <div style={{ textAlign:'center', marginBottom:16, borderBottom:'2px solid #1e3a5f', paddingBottom:12 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'#1e3a5f', textTransform:'uppercase', letterSpacing:'0.1em' }}>
                      B A L A N C E &nbsp; G E N E R A L
                    </div>
                    <div style={{ fontSize:11, color:'#374151', marginTop:4 }}>
                      EJERCICIO COMPRENDIDO ENTRE EL 01 DE ENERO DE {anio} AL 31 DE DICIEMBRE DE {anio}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginTop:10, fontSize:11, textAlign:'left', maxWidth:600, margin:'10px auto 0' }}>
                      <div><strong>RAZÓN SOCIAL:</strong> {razonSoc}</div>
                      <div><strong>R.U.T.:</strong> {rut || '—'}</div>
                      <div><strong>GIRO:</strong> FARMACIA</div>
                      <div><strong>DOMICILIO:</strong> ANTOFAGASTA</div>
                    </div>
                  </div>

                  {/* Tabla 8 columnas */}
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', minWidth:900 }}>
                      <thead>
                        <tr>
                          <th style={{ ...thStyle, width:30 }}>Nº</th>
                          <th style={{ ...thStyle, textAlign:'left', width:200 }}>CUENTAS</th>
                          <th colSpan={2} style={{ ...thStyle }}>SALDOS</th>
                          <th colSpan={2} style={{ ...thStyle }}>INVENTARIO</th>
                          <th colSpan={2} style={{ ...thStyle }}>RESULTADO</th>
                        </tr>
                        <tr>
                          <th style={{ ...thStyle }}></th>
                          <th style={{ ...thStyle, textAlign:'left' }}></th>
                          <th style={{ ...thStyle }}>DÉBITOS</th>
                          <th style={{ ...thStyle }}>CRÉDITOS</th>
                          <th style={{ ...thStyle }}>DEUDOR</th>
                          <th style={{ ...thStyle }}>ACREEDOR</th>
                          <th style={{ ...thStyle }}>ACTIVO</th>
                          <th style={{ ...thStyle }}>PASIVO</th>
                          <th style={{ ...thStyle }}>PÉRDIDAS</th>
                          <th style={{ ...thStyle }}>GANANCIAS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cuentas.map((c,i)=>(
                          <tr key={c.num} style={{ background:i%2===0?'#f8fafc':'#fff' }}>
                            <td style={{ ...tdStyle, textAlign:'center', color:'#6b7280' }}>{c.num}</td>
                            <td style={{ ...tdNomStyle, fontWeight:500 }}>{c.nombre}</td>
                            <td style={tdStyle}>{fmtCLP(c.debe)}</td>
                            <td style={tdStyle}>{fmtCLP(c.haber)}</td>
                            <td style={tdStyle}>{fmtCLP(c.deudor)}</td>
                            <td style={tdStyle}>{fmtCLP(c.acreedor)}</td>
                            <td style={{ ...tdStyle, color:'#1D9E75', fontWeight:c.activo>0?500:400 }}>{fmtCLP(c.activo)}</td>
                            <td style={{ ...tdStyle, color:'#E24B4A', fontWeight:c.pasivo>0?500:400 }}>{fmtCLP(c.pasivo)}</td>
                            <td style={{ ...tdStyle, color:'#D85A30' }}>{fmtCLP(c.perdidas)}</td>
                            <td style={{ ...tdStyle, color:'#3266ad' }}>{fmtCLP(c.ganancias)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        {/* Fila SUMAS */}
                        <tr style={{ background:'#1e3a5f' }}>
                          <td colSpan={2} style={{ ...tdStyle, textAlign:'center', fontWeight:700, color:'#fff', background:'#1e3a5f', border:'1px solid #2d5080' }}>SUMAS</td>
                          <td style={{ ...tdStyle, fontWeight:700, color:'#fff', background:'#1e3a5f', border:'1px solid #2d5080' }}>{fmtCLP(sumaDebe)}</td>
                          <td style={{ ...tdStyle, fontWeight:700, color:'#fff', background:'#1e3a5f', border:'1px solid #2d5080' }}>{fmtCLP(sumaHaber)}</td>
                          <td style={{ ...tdStyle, fontWeight:700, color:'#fff', background:'#1e3a5f', border:'1px solid #2d5080' }}>{fmtCLP(sumaDeudor)}</td>
                          <td style={{ ...tdStyle, fontWeight:700, color:'#fff', background:'#1e3a5f', border:'1px solid #2d5080' }}>{fmtCLP(sumaAcreedor)}</td>
                          <td style={{ ...tdStyle, fontWeight:700, color:'#fff', background:'#1e3a5f', border:'1px solid #2d5080' }}>{fmtCLP(sumaActivo)}</td>
                          <td style={{ ...tdStyle, fontWeight:700, color:'#fff', background:'#1e3a5f', border:'1px solid #2d5080' }}>{fmtCLP(sumaPasivo)}</td>
                          <td style={{ ...tdStyle, fontWeight:700, color:'#fff', background:'#1e3a5f', border:'1px solid #2d5080' }}>{fmtCLP(sumaPerdidas)}</td>
                          <td style={{ ...tdStyle, fontWeight:700, color:'#fff', background:'#1e3a5f', border:'1px solid #2d5080' }}>{fmtCLP(sumaGanancias)}</td>
                        </tr>
                        {/* Fila UTILIDAD/PÉRDIDA */}
                        <tr style={{ background:'#f0f4ff' }}>
                          <td colSpan={2} style={{ ...tdNomStyle, fontWeight:700, fontSize:11 }}>
                            {esUtilidad ? 'UTILIDAD DEL EJERCICIO' : 'PÉRDIDA DEL EJERCICIO'}
                          </td>
                          <td style={tdStyle}></td>
                          <td style={tdStyle}></td>
                          <td style={tdStyle}></td>
                          <td style={tdStyle}></td>
                          <td style={{ ...tdStyle, fontWeight:700, color:esUtilidad?'#1D9E75':'#E24B4A' }}>
                            {esUtilidad ? '-' : fmtCLP(Math.abs(utilidad))}
                          </td>
                          <td style={tdStyle}></td>
                          <td style={{ ...tdStyle, fontWeight:700, color:'#D85A30' }}>
                            {esUtilidad ? '-' : fmtCLP(Math.abs(utilidad))}
                          </td>
                          <td style={{ ...tdStyle, fontWeight:700, color:'#3266ad' }}>
                            {esUtilidad ? fmtCLP(utilidad) : '-'}
                          </td>
                        </tr>
                        {/* Fila TOTALES IGUALES */}
                        <tr style={{ background:'#1e3a5f' }}>
                          <td colSpan={2} style={{ ...tdStyle, textAlign:'center', fontWeight:700, color:'#fff', background:'#1e3a5f', border:'1px solid #2d5080' }}>TOTALES IGUALES</td>
                          <td style={{ ...tdStyle, fontWeight:700, color:'#fff', background:'#1e3a5f', border:'1px solid #2d5080' }}>{fmtCLP(sumaDebe)}</td>
                          <td style={{ ...tdStyle, fontWeight:700, color:'#fff', background:'#1e3a5f', border:'1px solid #2d5080' }}>{fmtCLP(sumaHaber)}</td>
                          <td style={{ ...tdStyle, fontWeight:700, color:'#fff', background:'#1e3a5f', border:'1px solid #2d5080' }}>{fmtCLP(sumaDeudor)}</td>
                          <td style={{ ...tdStyle, fontWeight:700, color:'#fff', background:'#1e3a5f', border:'1px solid #2d5080' }}>{fmtCLP(sumaAcreedor)}</td>
                          <td style={{ ...tdStyle, fontWeight:700, color:'#fff', background:'#1e3a5f', border:'1px solid #2d5080' }}>{fmtCLP(sumaActivo + (esUtilidad?0:Math.abs(utilidad)))}</td>
                          <td style={{ ...tdStyle, fontWeight:700, color:'#fff', background:'#1e3a5f', border:'1px solid #2d5080' }}>{fmtCLP(sumaPasivo)}</td>
                          <td style={{ ...tdStyle, fontWeight:700, color:'#fff', background:'#1e3a5f', border:'1px solid #2d5080' }}>{fmtCLP(sumaPerdidas + (esUtilidad?0:Math.abs(utilidad)))}</td>
                          <td style={{ ...tdStyle, fontWeight:700, color:'#fff', background:'#1e3a5f', border:'1px solid #2d5080' }}>{fmtCLP(sumaGanancias + (esUtilidad?utilidad:0))}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Firma */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:40, marginTop:40, paddingTop:20, borderTop:'1px solid #e5e7eb' }}>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ borderTop:'1px solid #374151', paddingTop:8, fontSize:11, color:'#374151' }}>
                        FIRMA DEL CONTADOR
                      </div>
                      <div style={{ fontSize:10, color:'#9ca3af', marginTop:4 }}>
                        Fecha: Antofagasta, {anio}
                      </div>
                    </div>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ borderTop:'1px solid #374151', paddingTop:8, fontSize:11, color:'#374151' }}>
                        FIRMA CONTRIBUYENTE
                      </div>
                      <div style={{ fontSize:10, color:'#6b7280', marginTop:4, lineHeight:1.5 }}>
                        Declaro que todos los asientos corresponden a datos fidedignos.
                      </div>
                    </div>
                  </div>

                  {/* Resumen rápido */}
                  <div className="no-print" style={{ marginTop:20, display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:8 }}>
                    {[
                      { l:'Total activos',   v:fmtM(sumaActivo),    c:'#1D9E75', bg:'#E1F5EE' },
                      { l:'Total pasivos',   v:fmtM(sumaPasivo),    c:'#E24B4A', bg:'#FCEBEB' },
                      { l:esUtilidad?'Utilidad':'Pérdida', v:fmtM(Math.abs(utilidad)), c:esUtilidad?'#3266ad':'#E24B4A', bg:'#E6F1FB' },
                      { l:'Total pérdidas',  v:fmtM(sumaPerdidas),  c:'#D85A30', bg:'#FAEEDA' },
                      { l:'Total ganancias', v:fmtM(sumaGanancias), c:'#3266ad', bg:'#eff4ff'  },
                    ].map(m=>(
                      <div key={m.l} style={{ background:m.bg, borderRadius:10, padding:'10px 12px' }}>
                        <div style={{ fontSize:10, color:m.c, marginBottom:2, opacity:0.8 }}>{m.l}</div>
                        <div style={{ fontSize:16, fontWeight:700, color:m.c }}>{m.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── ESTADO DE RESULTADOS ── */}
              {tab==='resultados' && (
                <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:28, maxWidth:720, margin:'0 auto' }}>
                  <div style={{ borderBottom:'3px solid #1e3a5f', paddingBottom:14, marginBottom:20, textAlign:'center' }}>
                    <div style={{ fontSize:16, fontWeight:700, color:'#1e3a5f', textTransform:'uppercase', letterSpacing:'0.08em' }}>Estado de resultados</div>
                    <div style={{ fontSize:12, color:'#6b7280', marginTop:3 }}>{razonSoc} · {MESES[mes-1]} {anio}</div>
                  </div>
                  <div style={{ marginBottom:16 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#1e3a5f', textTransform:'uppercase', marginBottom:8, paddingBottom:4, borderBottom:'1px solid #e5e7eb' }}>Ingresos operacionales</div>
                    {Object.entries(catIng).sort((a,b)=>b[1]-a[1]).map(([cat,val])=>(
                      <div key={cat} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', fontSize:12, borderBottom:'1px solid #f1f5f9' }}>
                        <span style={{ color:'#374151' }}>{cat}</span>
                        <span style={{ color:'#1D9E75', fontWeight:500 }}>{val.toLocaleString('es-CL')}</span>
                      </div>
                    ))}
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', fontWeight:700, borderTop:'1.5px solid #e5e7eb', marginTop:4 }}>
                      <span>Total ingresos</span>
                      <span style={{ color:'#1D9E75' }}>{ingMes.toLocaleString('es-CL')}</span>
                    </div>
                  </div>
                  <div style={{ marginBottom:16 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#1e3a5f', textTransform:'uppercase', marginBottom:8, paddingBottom:4, borderBottom:'1px solid #e5e7eb' }}>Gastos operacionales</div>
                    {Object.entries(catGas).sort((a,b)=>b[1]-a[1]).map(([cat,val])=>(
                      <div key={cat} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', fontSize:12, borderBottom:'1px solid #f1f5f9' }}>
                        <span style={{ color:'#374151' }}>{cat}</span>
                        <span style={{ color:'#E24B4A' }}>({val.toLocaleString('es-CL')})</span>
                      </div>
                    ))}
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', fontWeight:700, borderTop:'1.5px solid #e5e7eb', marginTop:4 }}>
                      <span>Total gastos</span>
                      <span style={{ color:'#E24B4A' }}>({gasMes.toLocaleString('es-CL')})</span>
                    </div>
                  </div>
                  <div style={{ background:utilMes>=0?'#E1F5EE':'#FCEBEB', borderRadius:10, padding:'14px 16px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div>
                        <div style={{ fontSize:14, fontWeight:700 }}>{utilMes>=0?'Utilidad':'Pérdida'} del período</div>
                        <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Margen: {mgMes}%</div>
                      </div>
                      <div style={{ fontSize:22, fontWeight:700, color:utilMes>=0?'#1D9E75':'#E24B4A' }}>${Math.abs(utilMes).toLocaleString('es-CL')}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── FLUJO DE CAJA ── */}
              {tab==='flujo' && (
                <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:28 }}>
                  <div style={{ borderBottom:'3px solid #1e3a5f', paddingBottom:14, marginBottom:20, textAlign:'center' }}>
                    <div style={{ fontSize:16, fontWeight:700, color:'#1e3a5f', textTransform:'uppercase', letterSpacing:'0.08em' }}>Flujo de caja</div>
                    <div style={{ fontSize:12, color:'#6b7280', marginTop:3 }}>{razonSoc} · Histórico completo</div>
                  </div>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead>
                      <tr style={{ background:'#1e3a5f' }}>
                        {['Período','Ingresos','Egresos','Flujo neto','Caja acumulada'].map(h=>(
                          <th key={h} style={{ ...thStyle, textAlign:'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {flujoConAcum.map((f,i)=>(
                        <tr key={f.key} style={{ background:i%2===0?'#f8fafc':'#fff', borderBottom:'1px solid #e5e7eb' }}>
                          <td style={{ ...tdNomStyle }}>{f.label}</td>
                          <td style={{ ...tdStyle, color:'#1D9E75' }}>{f.ing.toLocaleString('es-CL')}</td>
                          <td style={{ ...tdStyle, color:'#E24B4A' }}>({f.gas.toLocaleString('es-CL')})</td>
                          <td style={{ ...tdStyle, fontWeight:600, color:f.flujo>=0?'#3266ad':'#E24B4A' }}>{f.flujo>=0?'':'-'}{Math.abs(f.flujo).toLocaleString('es-CL')}</td>
                          <td style={{ ...tdStyle, fontWeight:700, color:f.acum>=0?'#1D9E75':'#E24B4A' }}>{f.acum>=0?'':'-'}{Math.abs(f.acum).toLocaleString('es-CL')}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background:'#1e3a5f' }}>
                        <td style={{ ...tdNomStyle, color:'#fff', fontWeight:700, background:'#1e3a5f', border:'1px solid #2d5080' }}>TOTALES</td>
                        <td style={{ ...tdStyle, color:'#fff', fontWeight:700, background:'#1e3a5f', border:'1px solid #2d5080' }}>{flujoConAcum.reduce((a,f)=>a+f.ing,0).toLocaleString('es-CL')}</td>
                        <td style={{ ...tdStyle, color:'#fff', fontWeight:700, background:'#1e3a5f', border:'1px solid #2d5080' }}>({flujoConAcum.reduce((a,f)=>a+f.gas,0).toLocaleString('es-CL')})</td>
                        <td style={{ ...tdStyle, color:'#fff', fontWeight:700, background:'#1e3a5f', border:'1px solid #2d5080' }}>{flujoConAcum.reduce((a,f)=>a+f.flujo,0).toLocaleString('es-CL')}</td>
                        <td style={{ ...tdStyle, color:'#fff', fontWeight:700, background:'#1e3a5f', border:'1px solid #2d5080' }}>{cajaAcum.toLocaleString('es-CL')}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* ── LIBRO DE COMPRAS ── */}
              {tab==='compras' && (
                <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:28 }}>
                  <div style={{ borderBottom:'3px solid #1e3a5f', paddingBottom:14, marginBottom:20, display:'flex', justifyContent:'space-between' }}>
                    <div>
                      <div style={{ fontSize:16, fontWeight:700, color:'#1e3a5f', textTransform:'uppercase' }}>Libro de compras</div>
                      <div style={{ fontSize:12, color:'#6b7280', marginTop:3 }}>{razonSoc} · {libroCompras.length} documentos · Año {anio}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:11, color:'#6b7280' }}>IVA crédito fiscal</div>
                      <div style={{ fontSize:18, fontWeight:700, color:'#1D9E75' }}>${totalIvaC.toLocaleString('es-CL')}</div>
                    </div>
                  </div>
                  {libroCompras.length===0 ? (
                    <div style={{ textAlign:'center', padding:'2rem', color:'#9ca3af' }}>Sin facturas recibidas para {anio}</div>
                  ) : (
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11, minWidth:700 }}>
                        <thead>
                          <tr style={{ background:'#1e3a5f' }}>
                            {['N°','Fecha','Folio','Proveedor','RUT','Neto','IVA','Total','Estado'].map(h=>(
                              <th key={h} style={{ ...thStyle }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {libroCompras.map((d,i)=>(
                            <tr key={d.id} style={{ background:i%2===0?'#f8fafc':'#fff', borderBottom:'1px solid #e5e7eb' }}>
                              <td style={{ ...tdStyle, textAlign:'center', color:'#9ca3af' }}>{i+1}</td>
                              <td style={{ ...tdStyle }}>{d.fecha}</td>
                              <td style={{ ...tdNomStyle, fontWeight:500 }}>{d.folio}</td>
                              <td style={{ ...tdNomStyle }}>{d.contraparte}</td>
                              <td style={{ ...tdStyle, fontSize:10, color:'#6b7280' }}>{d.rut_contraparte}</td>
                              <td style={{ ...tdStyle }}>{d.neto.toLocaleString('es-CL')}</td>
                              <td style={{ ...tdStyle, color:'#3266ad' }}>{d.iva.toLocaleString('es-CL')}</td>
                              <td style={{ ...tdStyle, fontWeight:600 }}>{d.total.toLocaleString('es-CL')}</td>
                              <td style={{ ...tdStyle }}>
                                <span style={{ fontSize:10, padding:'1px 5px', borderRadius:999, background:d.estado==='pagada'?'#E1F5EE':d.estado==='vencida'?'#FCEBEB':'#FAEEDA', color:d.estado==='pagada'?'#085041':d.estado==='vencida'?'#791F1F':'#633806' }}>
                                  {d.estado}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background:'#1e3a5f' }}>
                            <td colSpan={5} style={{ ...tdNomStyle, color:'#fff', fontWeight:700, background:'#1e3a5f', border:'1px solid #2d5080' }}>TOTALES — {libroCompras.length} doc.</td>
                            <td style={{ ...tdStyle, color:'#fff', fontWeight:700, background:'#1e3a5f', border:'1px solid #2d5080' }}>{libroCompras.reduce((a,d)=>a+d.neto,0).toLocaleString('es-CL')}</td>
                            <td style={{ ...tdStyle, color:'#fff', fontWeight:700, background:'#1e3a5f', border:'1px solid #2d5080' }}>{totalIvaC.toLocaleString('es-CL')}</td>
                            <td style={{ ...tdStyle, color:'#fff', fontWeight:700, background:'#1e3a5f', border:'1px solid #2d5080' }}>{libroCompras.reduce((a,d)=>a+d.total,0).toLocaleString('es-CL')}</td>
                            <td style={{ background:'#1e3a5f', border:'1px solid #2d5080' }}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── LIBRO DE VENTAS ── */}
              {tab==='ventas' && (
                <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:28 }}>
                  <div style={{ borderBottom:'3px solid #1e3a5f', paddingBottom:14, marginBottom:20, display:'flex', justifyContent:'space-between' }}>
                    <div>
                      <div style={{ fontSize:16, fontWeight:700, color:'#1e3a5f', textTransform:'uppercase' }}>Libro de ventas</div>
                      <div style={{ fontSize:12, color:'#6b7280', marginTop:3 }}>{razonSoc} · {libroVentas.length} documentos · Año {anio}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:11, color:'#6b7280' }}>IVA débito fiscal</div>
                      <div style={{ fontSize:18, fontWeight:700, color:'#E24B4A' }}>${totalIvaV.toLocaleString('es-CL')}</div>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:16 }}>
                    {[
                      { l:'IVA débito',  v:totalIvaV, c:'#E24B4A' },
                      { l:'IVA crédito', v:totalIvaC, c:'#1D9E75' },
                      { l:'IVA neto F29',v:ivaNeto,   c:ivaNeto>0?'#E24B4A':'#1D9E75' },
                    ].map(k=>(
                      <div key={k.l} style={{ background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:8, padding:'10px', textAlign:'center' }}>
                        <div style={{ fontSize:10, color:'#6b7280', marginBottom:3 }}>{k.l}</div>
                        <div style={{ fontSize:14, fontWeight:700, color:k.c }}>${k.v.toLocaleString('es-CL')}</div>
                      </div>
                    ))}
                  </div>
                  {libroVentas.length===0 ? (
                    <div style={{ textAlign:'center', padding:'2rem', color:'#9ca3af' }}>Sin facturas emitidas para {anio}</div>
                  ) : (
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11, minWidth:700 }}>
                        <thead>
                          <tr style={{ background:'#1e3a5f' }}>
                            {['N°','Fecha','Tipo','Folio','Cliente','RUT','Neto','IVA','Total','Estado'].map(h=>(
                              <th key={h} style={{ ...thStyle }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {libroVentas.map((d,i)=>(
                            <tr key={d.id} style={{ background:i%2===0?'#f8fafc':'#fff', borderBottom:'1px solid #e5e7eb' }}>
                              <td style={{ ...tdStyle, textAlign:'center', color:'#9ca3af' }}>{i+1}</td>
                              <td style={{ ...tdStyle }}>{d.fecha}</td>
                              <td style={{ ...tdStyle, textAlign:'center' }}>
                                <span style={{ fontSize:10, padding:'1px 5px', borderRadius:999, background:d.tipo==='FE'?'#E6F1FB':'#E1F5EE', color:d.tipo==='FE'?'#0C447C':'#085041', fontWeight:600 }}>
                                  {d.tipo==='FE'?'Factura':'Boleta'}
                                </span>
                              </td>
                              <td style={{ ...tdNomStyle, fontWeight:500 }}>{d.folio}</td>
                              <td style={{ ...tdNomStyle }}>{d.contraparte}</td>
                              <td style={{ ...tdStyle, fontSize:10, color:'#6b7280' }}>{d.rut_contraparte}</td>
                              <td style={{ ...tdStyle }}>{d.neto.toLocaleString('es-CL')}</td>
                              <td style={{ ...tdStyle, color:'#E24B4A' }}>{d.iva.toLocaleString('es-CL')}</td>
                              <td style={{ ...tdStyle, fontWeight:600 }}>{d.total.toLocaleString('es-CL')}</td>
                              <td style={{ ...tdStyle }}>
                                <span style={{ fontSize:10, padding:'1px 5px', borderRadius:999, background:d.estado==='pagada'?'#E1F5EE':d.estado==='vencida'?'#FCEBEB':'#FAEEDA', color:d.estado==='pagada'?'#085041':d.estado==='vencida'?'#791F1F':'#633806' }}>
                                  {d.estado}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background:'#1e3a5f' }}>
                            <td colSpan={6} style={{ ...tdNomStyle, color:'#fff', fontWeight:700, background:'#1e3a5f', border:'1px solid #2d5080' }}>TOTALES — {libroVentas.length} doc.</td>
                            <td style={{ ...tdStyle, color:'#fff', fontWeight:700, background:'#1e3a5f', border:'1px solid #2d5080' }}>{libroVentas.reduce((a,d)=>a+d.neto,0).toLocaleString('es-CL')}</td>
                            <td style={{ ...tdStyle, color:'#fff', fontWeight:700, background:'#1e3a5f', border:'1px solid #2d5080' }}>{totalIvaV.toLocaleString('es-CL')}</td>
                            <td style={{ ...tdStyle, color:'#fff', fontWeight:700, background:'#1e3a5f', border:'1px solid #2d5080' }}>{libroVentas.reduce((a,d)=>a+d.total,0).toLocaleString('es-CL')}</td>
                            <td style={{ background:'#1e3a5f', border:'1px solid #2d5080' }}></td>
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

const sel: React.CSSProperties  = { fontSize:13, padding:'6px 10px', border:'1px solid rgba(0,0,0,0.12)', borderRadius:8, background:'#fff' }
const btnP: React.CSSProperties = { display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, border:'none', background:'#1e3a5f', color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer' }
