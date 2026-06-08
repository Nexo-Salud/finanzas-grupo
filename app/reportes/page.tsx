'use client'
import { useState } from 'react'
import Link from 'next/link'

type Plantilla = { id: number; icon: string; titulo: string; desc: string; badge: string; badgeColor: string; paginas: number }
type Reporte = { nombre: string; empresa: string; periodo: string; tipo: string; fecha: string; paginas: number; size: string }

const PLANTILLAS: Plantilla[] = [
  { id:0, icon:'📊', titulo:'Resumen ejecutivo',      desc:'KPIs principales, utilidad, margen y variación vs período anterior. Ideal para directorio.', badge:'Más usado',  badgeColor:'#0C447C', paginas:8  },
  { id:1, icon:'📋', titulo:'Informe detallado',       desc:'Movimientos, plan de cuentas, presupuesto vs real y flujo de caja mensual completo.',        badge:'Contador',   badgeColor:'#085041', paginas:22 },
  { id:2, icon:'🏢', titulo:'Consolidado grupo',       desc:'Suma de todas las empresas con comparativa entre ellas y ranking por utilidad neta.',         badge:'Grupo',      badgeColor:'#633806', paginas:14 },
  { id:3, icon:'🎯', titulo:'Seguimiento presupuesto', desc:'Avance de cada categoría vs presupuesto con semáforos y proyección de cierre de año.',        badge:'Control',    badgeColor:'#085041', paginas:10 },
]

const SECCIONES = [
  { id:'resumen',      label:'Resumen ejecutivo (KPIs)',         checked:true  },
  { id:'ingresos',     label:'Detalle de ingresos por categoría',checked:true  },
  { id:'gastos',       label:'Detalle de gastos por categoría',  checked:true  },
  { id:'flujo',        label:'Flujo de caja mensual',            checked:true  },
  { id:'presupuesto',  label:'Presupuesto vs real',              checked:true  },
  { id:'graficos',     label:'Gráficos y visualizaciones',       checked:true  },
  { id:'comparativo',  label:'Comparativo con período anterior', checked:false },
  { id:'alertas',      label:'Resumen de alertas del período',   checked:false },
]

const REPORTES_GEN: Reporte[] = [
  { nombre:'Resumen ejecutivo — Empresa A — Mayo 2025', empresa:'Empresa A', periodo:'Mayo 2025',  tipo:'Resumen ejecutivo',      fecha:'01 Jun 2025', paginas:8,  size:'420 KB' },
  { nombre:'Informe detallado — Empresa B — Mayo 2025', empresa:'Empresa B', periodo:'Mayo 2025',  tipo:'Informe detallado',       fecha:'01 Jun 2025', paginas:22, size:'1.1 MB' },
  { nombre:'Consolidado grupo — Abril 2025',            empresa:'Grupo',     periodo:'Abril 2025', tipo:'Consolidado grupo',       fecha:'02 May 2025', paginas:14, size:'780 KB' },
  { nombre:'Seguimiento presupuesto — Q1 2025',         empresa:'Grupo',     periodo:'Q1 2025',    tipo:'Seguimiento presupuesto', fecha:'03 Abr 2025', paginas:10, size:'540 KB' },
  { nombre:'Resumen ejecutivo — Empresa C — Mar 2025',  empresa:'Empresa C', periodo:'Mar 2025',   tipo:'Resumen ejecutivo',      fecha:'02 Abr 2025', paginas:8,  size:'390 KB' },
]

const NAV = [
  { href:'/',             label:'Dashboard',   icon:'▦'  },
  { href:'/movimientos',  label:'Movimientos', icon:'↕'  },
  { href:'/presupuesto',  label:'Presupuesto', icon:'🎯' },
  { href:'/alertas',      label:'Alertas',     icon:'🔔' },
  { href:'/reportes',     label:'Reportes',    icon:'📄', active:true },
  { href:'/bancos',       label:'Bancos',      icon:'🏦' },
  { href:'/tributario',   label:'Documentos',  icon:'🧾' },
  { href:'/proyecciones', label:'Proyecciones',icon:'📈' },
  { href:'/usuarios',     label:'Usuarios',    icon:'👥' },
  { href:'/kpis',         label:'KPIs',        icon:'📊' },
  { href:'/ia',           label:'Análisis IA', icon:'🧠' },
]

export default function ReportesPage() {
  const [tab,          setTab]          = useState<'nuevo'|'preview'|'historial'>('nuevo')
  const [plantilla,    setPlantilla]    = useState(0)
  const [empresa,      setEmpresa]      = useState('Empresa A')
  const [periodo,      setPeriodo]      = useState('Junio 2025')
  const [autor,        setAutor]        = useState('')
  const [secciones,    setSecciones]    = useState(SECCIONES)
  const [generando,    setGenerando]    = useState(false)
  const [progreso,     setProgreso]     = useState(0)
  const [progresoMsg,  setProgresoMsg]  = useState('')
  const [generado,     setGenerado]     = useState(false)
  const [historial,    setHistorial]    = useState(REPORTES_GEN)

  function toggleSeccion(id: string) {
    setSecciones(prev => prev.map(s => s.id === id ? {...s, checked: !s.checked} : s))
  }

  function generarReporte() {
    setGenerando(true); setGenerado(false); setProgreso(0)
    const pasos = [
      'Recopilando datos financieros...',
      'Calculando KPIs y variaciones...',
      'Generando gráficos...',
      'Armando el documento...',
      '¡Listo!',
    ]
    let i = 0
    const iv = setInterval(() => {
      i++
      setProgreso(i * 20)
      setProgresoMsg(pasos[i - 1])
      if (i >= 5) {
        clearInterval(iv)
        setTimeout(() => {
          setGenerando(false)
          setGenerado(true)
          const nuevo: Reporte = {
            nombre: `${PLANTILLAS[plantilla].titulo} — ${empresa} — ${periodo}`,
            empresa, periodo,
            tipo: PLANTILLAS[plantilla].titulo,
            fecha: 'Hoy',
            paginas: PLANTILLAS[plantilla].paginas,
            size: '450 KB',
          }
          setHistorial(prev => [nuevo, ...prev])
        }, 300)
      }
    }, 500)
  }

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
          <div style={{ fontSize:15, fontWeight:600 }}>Reportes financieros</div>
          <div style={{ fontSize:12, color:'#6b7280' }}>Genera informes PDF por empresa y período</div>
        </div>

        <div style={{ padding:'24px 28px' }}>

          {/* Tabs */}
          <div style={{ display:'flex', gap:6, marginBottom:24 }}>
            {([
              { key:'nuevo',     label:'📄 Nuevo reporte'   },
              { key:'preview',   label:'👁️ Vista previa'    },
              { key:'historial', label:'📋 Generados'        },
            ] as const).map(t => (
              <button key={t.key} onClick={()=>{ setTab(t.key); setGenerado(false) }} style={{ padding:'7px 16px', borderRadius:8, fontSize:13, cursor:'pointer', border:'1px solid rgba(0,0,0,0.1)', background:tab===t.key?'#eff4ff':'#fff', color:tab===t.key?'#3266ad':'#6b7280', fontWeight:tab===t.key?500:400 }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Tab: Nuevo reporte ── */}
          {tab === 'nuevo' && (
            <>
              {/* Plantillas */}
              <div style={{ marginBottom:20 }}>
                <div style={sectionTitle}>1. Elige la plantilla</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:10 }}>
                  {PLANTILLAS.map(p => (
                    <div key={p.id} onClick={()=>setPlantilla(p.id)} style={{ background:'#fff', border:`${plantilla===p.id?'2px solid #3266ad':'1px solid rgba(0,0,0,0.08)'}`, borderRadius:12, padding:'16px', cursor:'pointer', transition:'border-color 0.15s' }}>
                      <div style={{ fontSize:24, marginBottom:8 }}>{p.icon}</div>
                      <div style={{ fontSize:13, fontWeight:600, color:'#111827', marginBottom:4 }}>{p.titulo}</div>
                      <div style={{ fontSize:12, color:'#6b7280', lineHeight:1.5, marginBottom:8 }}>{p.desc}</div>
                      <span style={{ fontSize:10, padding:'2px 8px', borderRadius:999, fontWeight:600, background:'#E6F1FB', color:p.badgeColor }}>{p.badge}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Configuración */}
              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:12, padding:20, marginBottom:20 }}>
                <div style={sectionTitle}>2. Configura el reporte</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                  <div><label style={lbl}>Empresa</label>
                    <select value={empresa} onChange={e=>setEmpresa(e.target.value)} style={inp}>
                      <option>Empresa A</option><option>Empresa B</option><option>Empresa C</option><option>Grupo completo</option>
                    </select>
                  </div>
                  <div><label style={lbl}>Período</label>
                    <select value={periodo} onChange={e=>setPeriodo(e.target.value)} style={inp}>
                      <option>Junio 2025</option><option>Mayo 2025</option><option>Abril 2025</option>
                      <option>Q2 2025</option><option>Q1 2025</option><option>H1 2025</option><option>Año 2025</option>
                    </select>
                  </div>
                  <div><label style={lbl}>Preparado por</label>
                    <input value={autor} onChange={e=>setAutor(e.target.value)} placeholder="Nombre del responsable" style={inp}/>
                  </div>
                  <div><label style={lbl}>Idioma</label>
                    <select style={inp}><option>Español</option><option>English</option></select>
                  </div>
                </div>
              </div>

              {/* Secciones */}
              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:12, padding:20, marginBottom:20 }}>
                <div style={sectionTitle}>3. Secciones a incluir</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                  {secciones.map(s => (
                    <label key={s.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0', fontSize:13, color:'#374151', cursor:'pointer', borderBottom:'1px solid rgba(0,0,0,0.05)' }}>
                      <input type="checkbox" checked={s.checked} onChange={()=>toggleSeccion(s.id)} style={{ width:15, height:15, accentColor:'#3266ad', cursor:'pointer' }}/>
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Generar */}
              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:12, padding:20 }}>
                <div style={sectionTitle}>4. Generar</div>
                <button onClick={generarReporte} disabled={generando} style={{ width:'100%', padding:'11px', borderRadius:9, border:'none', background: generando ? '#9ca3af' : '#3266ad', color:'#fff', fontSize:14, fontWeight:600, cursor: generando ? 'not-allowed' : 'pointer' }}>
                  {generando ? '⏳ Generando...' : '📄 Generar reporte PDF'}
                </button>

                {/* Barra de progreso */}
                {generando && (
                  <div style={{ marginTop:12 }}>
                    <div style={{ height:6, background:'#f1f5f9', borderRadius:3, overflow:'hidden', marginBottom:6 }}>
                      <div style={{ height:'100%', width:`${progreso}%`, background:'#3266ad', borderRadius:3, transition:'width 0.4s' }}/>
                    </div>
                    <div style={{ fontSize:12, color:'#6b7280', textAlign:'center' }}>{progresoMsg}</div>
                  </div>
                )}

                {/* Éxito */}
                {generado && (
                  <div style={{ marginTop:12, background:'#EAF3DE', border:'1px solid #97C459', borderRadius:10, padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
                    <span style={{ fontSize:24 }}>✅</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:600, color:'#27500A' }}>Reporte generado correctamente</div>
                      <div style={{ fontSize:12, color:'#3B6D11', marginTop:2 }}>{PLANTILLAS[plantilla].titulo} · {empresa} · {periodo}</div>
                    </div>
                    <button onClick={()=>setTab('historial')} style={{ padding:'6px 12px', borderRadius:7, border:'1px solid #97C459', background:'transparent', color:'#27500A', fontSize:12, fontWeight:500, cursor:'pointer' }}>
                      Ver en historial ↗
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Tab: Vista previa ── */}
          {tab === 'preview' && (
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:12, padding:28, maxWidth:680, margin:'0 auto' }}>
              {/* Encabezado documento */}
              <div style={{ borderBottom:'3px solid #3266ad', paddingBottom:14, marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontSize:20, fontWeight:700, color:'#111827' }}>Resumen ejecutivo financiero</div>
                  <div style={{ fontSize:12, color:'#6b7280', marginTop:3 }}>Empresa A &nbsp;·&nbsp; Junio 2025 &nbsp;·&nbsp; Preparado el 04 Jun 2025</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:11, color:'#9ca3af' }}>Grupo empresarial</div>
                  <div style={{ fontSize:22, fontWeight:700, color:'#3266ad' }}>EA</div>
                </div>
              </div>

              {/* KPIs */}
              <div style={{ fontSize:11, fontWeight:600, color:'#3266ad', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10, borderBottom:'1px solid #e5e7eb', paddingBottom:4 }}>Indicadores clave del período</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:20 }}>
                {[
                  { l:'Ingresos',    v:'$7.1M',  c:'#1D9E75' },
                  { l:'Gastos',      v:'$4.2M',  c:'#E24B4A' },
                  { l:'Utilidad',    v:'$2.9M',  c:'#3266ad' },
                  { l:'Margen',      v:'40.8%',  c:'#111827' },
                  { l:'Var. ing.',   v:'+20%',   c:'#1D9E75' },
                  { l:'Var. gastos', v:'+10%',   c:'#E24B4A' },
                ].map(k => (
                  <div key={k.l} style={{ background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:8, padding:'10px', textAlign:'center' }}>
                    <div style={{ fontSize:10, color:'#6b7280', marginBottom:3 }}>{k.l}</div>
                    <div style={{ fontSize:16, fontWeight:700, color:k.c }}>{k.v}</div>
                  </div>
                ))}
              </div>

              {/* Gráfico simple */}
              <div style={{ fontSize:11, fontWeight:600, color:'#3266ad', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10, borderBottom:'1px solid #e5e7eb', paddingBottom:4 }}>Ingresos vs gastos — últimos 6 meses</div>
              <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:100, marginBottom:20 }}>
                {[
                  {m:'Ene',i:42,g:31},{m:'Feb',i:51,g:34},{m:'Mar',i:48,g:32},
                  {m:'Abr',i:62,g:41},{m:'May',i:59,g:38},{m:'Jun',i:71,g:42},
                ].map(d => (
                  <div key={d.m} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                    <div style={{ width:'100%', display:'flex', gap:2, alignItems:'flex-end' }}>
                      <div style={{ flex:1, height:d.i, background:'#3266ad', borderRadius:'2px 2px 0 0' }}/>
                      <div style={{ flex:1, height:d.g, background:'#E24B4A', borderRadius:'2px 2px 0 0' }}/>
                    </div>
                    <div style={{ fontSize:9, color:'#9ca3af' }}>{d.m}</div>
                  </div>
                ))}
              </div>

              {/* Tabla categorías */}
              <div style={{ fontSize:11, fontWeight:600, color:'#3266ad', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10, borderBottom:'1px solid #e5e7eb', paddingBottom:4 }}>Detalle por categoría</div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'#3266ad' }}>
                    {['Categoría','Presupuesto','Real','Var.'].map(h => (
                      <th key={h} style={{ textAlign:'left', padding:'6px 8px', color:'#fff', fontWeight:500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Ventas',          '$5.5M','$5.9M','+7%',   '#1D9E75'],
                    ['Servicios',       '$1.4M','$1.2M','-14%',  '#E24B4A'],
                    ['Remuneraciones',  '$1.8M','$2.1M','+17%',  '#E24B4A'],
                    ['Proveedores',     '$1.2M','$1.1M','-8%',   '#1D9E75'],
                    ['Marketing',       '$0.6M','$0.5M','-5%',   '#1D9E75'],
                  ].map(([cat,pres,real,var_,col], i) => (
                    <tr key={cat} style={{ background: i%2===0 ? '#f8fafc' : '#fff' }}>
                      <td style={{ padding:'6px 8px', fontWeight:500 }}>{cat}</td>
                      <td style={{ padding:'6px 8px', color:'#6b7280' }}>{pres}</td>
                      <td style={{ padding:'6px 8px' }}>{real}</td>
                      <td style={{ padding:'6px 8px', fontWeight:600, color:col as string }}>{var_}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Footer */}
              <div style={{ borderTop:'1px solid #e5e7eb', paddingTop:10, marginTop:16, display:'flex', justifyContent:'space-between', fontSize:10, color:'#9ca3af' }}>
                <span>Generado con Plataforma Financiera Grupo</span>
                <span>Página 1 de {PLANTILLAS[plantilla].paginas}</span>
              </div>
            </div>
          )}

          {/* ── Tab: Historial ── */}
          {tab === 'historial' && (
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:12, padding:'4px 20px' }}>
              {historial.map((r, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 0', borderBottom: i < historial.length-1 ? '1px solid rgba(0,0,0,0.06)' : 'none', flexWrap:'wrap', gap:8 }}>
                  <div style={{ flex:1, minWidth:200 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:'#111827', marginBottom:3 }}>{r.nombre}</div>
                    <div style={{ fontSize:11, color:'#9ca3af' }}>
                      📅 {r.fecha} &nbsp;·&nbsp; 📄 {r.paginas} págs &nbsp;·&nbsp; {r.size}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={()=>setTab('preview')} style={{ ...btnSec, width:'auto', padding:'5px 12px', fontSize:12 }}>👁️ Ver</button>
                    <button style={{ ...btnSec, width:'auto', padding:'5px 12px', fontSize:12 }}>⬇️ PDF</button>
                  </div>
                </div>
              ))}
              {historial.length === 0 && (
                <div style={{ textAlign:'center', padding:'3rem', color:'#9ca3af', fontSize:14 }}>
                  Sin reportes generados aún
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Estilos ────────────────────────────────────────────────────
const sectionTitle: React.CSSProperties = { fontSize:12, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }
const lbl: React.CSSProperties  = { display:'block', fontSize:12, fontWeight:500, color:'#6b7280', marginBottom:4 }
const inp: React.CSSProperties  = { width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid rgba(0,0,0,0.14)', borderRadius:8, background:'#fff', color:'#111827', fontFamily:'DM Sans, sans-serif' }
const btnSec: React.CSSProperties = { display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'7px 14px', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', border:'1px solid rgba(0,0,0,0.12)', background:'#fff', color:'#374151', width:'100%' }
