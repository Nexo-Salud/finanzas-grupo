'use client'
import { useState } from 'react'
import Link from 'next/link'

// ── Tipos ──────────────────────────────────────────────────────
type Categoria = {
  id: string
  nombre: string
  tipo: 'ingreso' | 'gasto'
  color: string
  meta: number
  dist: number[] // 12 porcentajes que suman 100
}

type Empresa = { id: string; nombre: string; color: string }

// ── Datos ──────────────────────────────────────────────────────
const EMPRESAS: Empresa[] = [
  { id: 'A', nombre: 'Empresa A', color: '#3266ad' },
  { id: 'B', nombre: 'Empresa B', color: '#1D9E75' },
  { id: 'C', nombre: 'Empresa C', color: '#BA7517' },
]

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const PRESUPUESTOS_INICIALES: Record<string, Categoria[]> = {
  A: [
    { id:'a1', nombre:'Ventas',                tipo:'ingreso', color:'#3266ad', meta:80000000, dist:[8,8,8,8,8,8,8,8,8,8,8,12] },
    { id:'a2', nombre:'Servicios profesionales',tipo:'ingreso', color:'#1D9E75', meta:24000000, dist:[8,8,8,8,8,8,8,8,8,8,8,12] },
    { id:'a3', nombre:'Otros ingresos',         tipo:'ingreso', color:'#7F77DD', meta:6000000,  dist:[8,8,8,8,8,8,8,8,8,8,8,12] },
    { id:'a4', nombre:'Remuneraciones',         tipo:'gasto',   color:'#D85A30', meta:36000000, dist:[8,8,8,8,8,8,8,8,8,8,8,12] },
    { id:'a5', nombre:'Proveedores',            tipo:'gasto',   color:'#BA7517', meta:18000000, dist:[7,7,8,8,9,9,9,9,9,9,8,8] },
    { id:'a6', nombre:'Arriendos pagados',      tipo:'gasto',   color:'#534AB7', meta:6000000,  dist:[8,8,8,8,8,8,8,8,8,8,8,12] },
    { id:'a7', nombre:'Marketing',              tipo:'gasto',   color:'#D4537E', meta:8000000,  dist:[5,5,7,8,8,10,10,10,10,9,9,9] },
    { id:'a8', nombre:'Gastos generales',       tipo:'gasto',   color:'#888780', meta:4800000,  dist:[8,8,8,8,8,8,8,8,8,8,8,12] },
  ],
  B: [
    { id:'b1', nombre:'Ventas',           tipo:'ingreso', color:'#3266ad', meta:48000000, dist:[8,8,8,8,8,8,8,8,8,8,8,12] },
    { id:'b2', nombre:'Servicios',        tipo:'ingreso', color:'#1D9E75', meta:12000000, dist:[8,8,8,8,8,8,8,8,8,8,8,12] },
    { id:'b3', nombre:'Remuneraciones',   tipo:'gasto',   color:'#D85A30', meta:24000000, dist:[8,8,8,8,8,8,8,8,8,8,8,12] },
    { id:'b4', nombre:'Proveedores',      tipo:'gasto',   color:'#BA7517', meta:10000000, dist:[8,8,8,8,8,8,8,8,8,8,8,12] },
    { id:'b5', nombre:'Servicios básicos',tipo:'gasto',   color:'#534AB7', meta:4800000,  dist:[8,8,8,8,8,8,8,8,8,8,8,12] },
  ],
  C: [
    { id:'c1', nombre:'Arriendos cobrados',tipo:'ingreso', color:'#3266ad', meta:24000000, dist:[8,8,8,8,8,8,8,8,8,8,8,12] },
    { id:'c2', nombre:'Otros ingresos',    tipo:'ingreso', color:'#1D9E75', meta:6000000,  dist:[8,8,8,8,8,8,8,8,8,8,8,12] },
    { id:'c3', nombre:'Remuneraciones',    tipo:'gasto',   color:'#D85A30', meta:12000000, dist:[8,8,8,8,8,8,8,8,8,8,8,12] },
    { id:'c4', nombre:'Mantención',        tipo:'gasto',   color:'#BA7517', meta:4800000,  dist:[8,8,8,8,8,8,8,8,8,8,8,12] },
  ],
}

// Ejecutado real H1 2025 (primeros 6 meses)
const EJECUTADO: Record<string, Record<string, number[]>> = {
  A: {
    a1:[3800,4600,4200,5500,5100,6200,0,0,0,0,0,0],
    a2:[1800,2100,1900,2500,2300,2800,0,0,0,0,0,0],
    a3:[400,500,450,600,550,700,0,0,0,0,0,0],
    a4:[2900,3000,2950,3100,3200,3500,0,0,0,0,0,0],
    a5:[1100,1200,1250,1350,1400,1500,0,0,0,0,0,0],
    a6:[500,500,500,500,500,500,0,0,0,0,0,0],
    a7:[280,300,420,550,560,700,0,0,0,0,0,0],
    a8:[330,340,350,360,370,380,0,0,0,0,0,0],
  },
  B: {
    b1:[3200,3700,4000,3600,4600,5000,0,0,0,0,0,0],
    b2:[800,900,950,850,1000,1100,0,0,0,0,0,0],
    b3:[1900,1950,2000,2050,2100,2200,0,0,0,0,0,0],
    b4:[750,800,820,870,900,950,0,0,0,0,0,0],
    b5:[380,385,380,390,395,400,0,0,0,0,0,0],
  },
  C: {
    c1:[1800,1800,1800,1800,1800,1800,0,0,0,0,0,0],
    c2:[350,400,420,380,450,500,0,0,0,0,0,0],
    c3:[950,960,970,980,990,1000,0,0,0,0,0,0],
    c4:[280,290,300,295,310,320,0,0,0,0,0,0],
  },
}

// ── Helpers ────────────────────────────────────────────────────
function fmtCLP(n: number) { return '$' + Math.round(n).toLocaleString('es-CL') }
function fmtM(n: number) {
  if (n >= 1e6) return '$' + (Math.round(n / 1e5) / 10) + 'M'
  if (n >= 1000) return '$' + Math.round(n / 1000) + 'K'
  return '$' + Math.round(n)
}
function distribuirUniforme(): number[] {
  const base = Array(12).fill(Math.round(10000 / 12) / 100)
  const suma = base.reduce((a, b) => a + b, 0)
  base[11] = Math.round((100 - suma + base[11]) * 100) / 100
  return base
}
function distribuirEstacional(): number[] {
  const d = [6,6,7,8,9,10,10,10,9,8,9,8]
  const suma = d.reduce((a,b)=>a+b,0)
  return d.map(v => Math.round(v/suma*10000)/100)
}

// ── Componente ─────────────────────────────────────────────────
export default function PresupuestoPage() {
  const [empresa,      setEmpresa]      = useState('A')
  const [anio,         setAnio]         = useState(2025)
  const [tab,          setTab]          = useState<'categorias'|'resumen'|'comparativo'>('categorias')
  const [tipoFiltro,   setTipoFiltro]   = useState<'all'|'ingreso'|'gasto'>('all')
  const [presupuestos, setPresupuestos] = useState(PRESUPUESTOS_INICIALES)
  const [expandidos,   setExpandidos]   = useState<Record<string,boolean>>({})
  const [showForm,     setShowForm]     = useState(false)
  const [fNombre, setFNombre] = useState('')
  const [fTipo,   setFTipo]   = useState<'ingreso'|'gasto'>('ingreso')
  const [fMeta,   setFMeta]   = useState('')
  const [fColor,  setFColor]  = useState('#3266ad')

  const cats = presupuestos[empresa] || []
  const filtradas = tipoFiltro === 'all' ? cats : cats.filter(c => c.tipo === tipoFiltro)
  const ejec = EJECUTADO[empresa] || {}

  // Métricas globales
  const totalIngMeta = cats.filter(c=>c.tipo==='ingreso').reduce((a,c)=>a+c.meta,0)
  const totalGasMeta = cats.filter(c=>c.tipo==='gasto').reduce((a,c)=>a+c.meta,0)
  const utilidadMeta = totalIngMeta - totalGasMeta
  const margen       = totalIngMeta ? Math.round(utilidadMeta/totalIngMeta*100) : 0

  function getMesVal(cat: Categoria, mes: number) {
    return Math.round(cat.meta * cat.dist[mes] / 100)
  }
  function getEjecMes(catId: string, mes: number) {
    return (ejec[catId] || [])[mes] || 0
  }
  function getTotalEjec(catId: string) {
    return (ejec[catId] || []).reduce((a,v)=>a+v,0)
  }
  function getPctEjec(cat: Categoria) {
    const ej = getTotalEjec(cat.id)
    return cat.meta ? Math.round(ej/cat.meta*100) : 0
  }

  function updateMeta(id: string, val: number) {
    setPresupuestos(prev => ({
      ...prev,
      [empresa]: prev[empresa].map(c => c.id === id ? {...c, meta: val} : c)
    }))
  }
  function updateDist(id: string, mes: number, val: number) {
    setPresupuestos(prev => ({
      ...prev,
      [empresa]: prev[empresa].map(c => {
        if (c.id !== id) return c
        const nd = [...c.dist]; nd[mes] = val
        return {...c, dist: nd}
      })
    }))
  }
  function aplicarDist(id: string, modo: 'uniforme'|'estacional') {
    const nd = modo === 'uniforme' ? distribuirUniforme() : distribuirEstacional()
    setPresupuestos(prev => ({
      ...prev,
      [empresa]: prev[empresa].map(c => c.id === id ? {...c, dist: nd} : c)
    }))
  }
  function toggleExpand(id: string) {
    setExpandidos(prev => ({...prev, [id]: !prev[id]}))
  }
  function agregarCategoria() {
    if (!fNombre || !fMeta) return
    const nc: Categoria = {
      id: Date.now().toString(), nombre: fNombre, tipo: fTipo,
      color: fColor, meta: parseFloat(fMeta) || 0,
      dist: distribuirUniforme(),
    }
    setPresupuestos(prev => ({...prev, [empresa]: [...prev[empresa], nc]}))
    setFNombre(''); setFMeta(''); setShowForm(false)
  }
  function eliminarCategoria(id: string) {
    setPresupuestos(prev => ({
      ...prev,
      [empresa]: prev[empresa].filter(c => c.id !== id)
    }))
  }

  const barColor = (pct: number, invert = false) => {
    if (invert) return pct > 100 ? '#E24B4A' : pct > 85 ? '#EF9F27' : '#1D9E75'
    return pct >= 100 ? '#1D9E75' : pct >= 75 ? '#EF9F27' : '#E24B4A'
  }
  const badgeStyle = (pct: number, invert = false): React.CSSProperties => {
    const c = barColor(pct, invert)
    const bg = c === '#1D9E75' ? '#E1F5EE' : c === '#EF9F27' ? '#FAEEDA' : '#FCEBEB'
    const tx = c === '#1D9E75' ? '#085041' : c === '#EF9F27' ? '#633806' : '#791F1F'
    return { fontSize:11, padding:'2px 8px', borderRadius:999, fontWeight:500, background:bg, color:tx }
  }
  const labelEstado = (pct: number, invert = false) => {
    if (invert) return pct > 100 ? 'Excedido' : pct > 85 ? 'En límite' : 'Óptimo'
    return pct >= 100 ? 'Logrado' : pct >= 75 ? 'En curso' : 'Bajo meta'
  }

  return (
    <div style={{ minHeight:'100vh', background:'#f8f9fb', fontFamily:'DM Sans, sans-serif' }}>

      {/* Sidebar */}
      <div style={{ position:'fixed', top:0, left:0, width:220, height:'100vh', background:'#fff', borderRight:'1px solid rgba(0,0,0,0.08)', display:'flex', flexDirection:'column', padding:'0 12px 16px', zIndex:100, overflowY:'auto' }}>
        <div style={{ height:56, display:'flex', alignItems:'center', gap:10, borderBottom:'1px solid rgba(0,0,0,0.08)', marginBottom:12, marginLeft:-12, marginRight:-12, paddingLeft:20, fontSize:15, fontWeight:600, color:'#3266ad' }}>
          📊 Finanzas Grupo
        </div>
        {[
          { href:'/',             label:'Dashboard',    icon:'▦'  },
          { href:'/movimientos',  label:'Movimientos',  icon:'↕'  },
          { href:'/presupuesto',  label:'Presupuesto',  icon:'🎯', active:true },
          { href:'/alertas',      label:'Alertas',      icon:'🔔' },
          { href:'/reportes',     label:'Reportes',     icon:'📄' },
          { href:'/estados',      label:'Est. Financ.', icon:'📑' },
          { href:'/bancos',       label:'Bancos',       icon:'🏦' },
          { href:'/tributario',   label:'Documentos',   icon:'🧾' },
          { href:'/proyecciones', label:'Proyecciones', icon:'📈' },
          { href:'/usuarios',     label:'Usuarios',     icon:'👥' },
          { href:'/kpis',         label:'KPIs',         icon:'📊' },
          { href:'/ia',           label:'Análisis IA',  icon:'🧠' },
        ].map(item => (
          <Link key={item.href} href={item.href} style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px', borderRadius:8, fontSize:13.5, color:item.active?'#3266ad':'#6b7280', background:item.active?'#eff4ff':'transparent', fontWeight:item.active?500:400, textDecoration:'none', marginBottom:2 }}>
            <span style={{ fontSize:15 }}>{item.icon}</span>{item.label}
          </Link>
        ))}
      </div>

      {/* Contenido */}
      <div style={{ marginLeft:220 }}>

        {/* Header */}
        <div style={{ height:56, background:'#fff', borderBottom:'1px solid rgba(0,0,0,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 28px', position:'sticky', top:0, zIndex:50 }}>
          <div style={{ fontSize:15, fontWeight:600 }}>Presupuesto anual</div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <select value={empresa} onChange={e=>setEmpresa(e.target.value)} style={sel}>
              {EMPRESAS.map(e=><option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
            <select value={anio} onChange={e=>setAnio(parseInt(e.target.value))} style={sel}>
              {[2024,2025,2026].map(a=><option key={a}>{a}</option>)}
            </select>
            <button onClick={()=>setShowForm(true)} style={btnP}>+ Nueva categoría</button>
          </div>
        </div>

        <div style={{ padding:'24px 28px' }}>

          {/* Métricas */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:24 }}>
            {[
              { label:'Ingreso presupuestado', value:fmtM(totalIngMeta), color:'#1D9E75', bg:'#E1F5EE' },
              { label:'Gasto presupuestado',   value:fmtM(totalGasMeta), color:'#E24B4A', bg:'#FCEBEB' },
              { label:'Utilidad esperada',     value:fmtM(utilidadMeta), color:'#3266ad', bg:'#E6F1FB' },
              { label:'Margen objetivo',       value:margen+'%',          color:'#7F77DD', bg:'#EEEDFE' },
            ].map(m=>(
              <div key={m.label} style={{ background:m.bg, borderRadius:12, padding:'14px 16px' }}>
                <div style={{ fontSize:11, color:m.color, fontWeight:500, marginBottom:4, opacity:0.8 }}>{m.label}</div>
                <div style={{ fontSize:22, fontWeight:600, color:m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Formulario nueva categoría */}
          {showForm && (
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20, marginBottom:20 }}>
              <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Nueva categoría de presupuesto</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div><label style={lbl}>Nombre</label><input value={fNombre} onChange={e=>setFNombre(e.target.value)} placeholder="Ej: Comisiones" style={inp}/></div>
                <div><label style={lbl}>Tipo</label>
                  <select value={fTipo} onChange={e=>setFTipo(e.target.value as 'ingreso'|'gasto')} style={inp}>
                    <option value="ingreso">Ingreso</option>
                    <option value="gasto">Gasto</option>
                  </select>
                </div>
                <div><label style={lbl}>Meta anual ($)</label><input type="number" value={fMeta} onChange={e=>setFMeta(e.target.value)} placeholder="0" style={inp}/></div>
                <div><label style={lbl}>Color</label>
                  <div style={{ display:'flex', gap:6, marginTop:4 }}>
                    {['#3266ad','#1D9E75','#BA7517','#D85A30','#7F77DD','#D4537E','#639922'].map(c=>(
                      <div key={c} onClick={()=>setFColor(c)} style={{ width:24, height:24, borderRadius:'50%', background:c, cursor:'pointer', border:fColor===c?'3px solid #111':'2px solid transparent' }}/>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={agregarCategoria} style={{ ...btnP, flex:1 }}>Guardar categoría</button>
                <button onClick={()=>setShowForm(false)} style={{ ...btnSec, width:'auto', padding:'8px 16px' }}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
            {(['categorias','resumen','comparativo'] as const).map(t=>(
              <button key={t} onClick={()=>setTab(t)} style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer', border:'1px solid rgba(0,0,0,0.1)', background:tab===t?'#eff4ff':'#fff', color:tab===t?'#3266ad':'#6b7280', fontWeight:tab===t?500:400 }}>
                {t==='categorias'?'📋 Categorías':t==='resumen'?'📊 Resumen anual':'🔄 Presup. vs Real'}
              </button>
            ))}
            {tab==='categorias' && (
              <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
                {(['all','ingreso','gasto'] as const).map(f=>(
                  <button key={f} onClick={()=>setTipoFiltro(f)} style={{ padding:'6px 12px', borderRadius:8, fontSize:12, cursor:'pointer', border:'1px solid rgba(0,0,0,0.1)', background:tipoFiltro===f?'#1f2937':'#fff', color:tipoFiltro===f?'#fff':'#6b7280' }}>
                    {f==='all'?'Todos':f==='ingreso'?'Ingresos':'Gastos'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Tab: Categorías ── */}
          {tab==='categorias' && filtradas.map(cat => {
            const pctEj = getPctEjec(cat)
            const totalMesPresup = MESES.map((_,i)=>getMesVal(cat,i))
            const sumaDistActual = cat.dist.reduce((a,b)=>a+b,0)
            const isOpen = expandidos[cat.id]

            return (
              <div key={cat.id} style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20, marginBottom:12 }}>
                {/* Header categoría */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:12 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', background:cat.color, flexShrink:0 }}/>
                    <div>
                      <div style={{ fontSize:14, fontWeight:600, color:'#111827' }}>{cat.nombre}</div>
                      <div style={{ fontSize:11, color:'#6b7280', marginTop:1 }}>
                        {cat.tipo === 'ingreso' ? '↑ Ingreso' : '↓ Gasto'} · Promedio mensual: {fmtM(cat.meta/12)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <span style={badgeStyle(pctEj, cat.tipo==='gasto')}>{labelEstado(pctEj, cat.tipo==='gasto')}</span>
                    <button onClick={()=>toggleExpand(cat.id)} style={{ ...btnSec, width:'auto', padding:'5px 10px', fontSize:12 }}>
                      {isOpen ? '▲ Cerrar' : '▼ Distribución mensual'}
                    </button>
                    <button onClick={()=>eliminarCategoria(cat.id)} style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:16, color:'#9ca3af', padding:'4px' }}>🗑️</button>
                  </div>
                </div>

                {/* Meta editable + barra */}
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10, flexWrap:'wrap' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#6b7280', marginBottom:4 }}>
                      <span>Meta anual</span>
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        <input
                          type="number"
                          value={cat.meta}
                          onChange={e=>updateMeta(cat.id, parseFloat(e.target.value)||0)}
                          style={{ width:120, fontSize:13, fontWeight:600, textAlign:'right', border:'none', borderBottom:'1.5px solid #e5e7eb', background:'transparent', color:'#111827', padding:'2px 4px' }}
                        />
                        <span style={{ fontSize:12, color:'#6b7280' }}>CLP</span>
                      </div>
                    </div>
                    <div style={{ height:8, background:'#f1f5f9', borderRadius:4, overflow:'hidden' }}>
                      <div style={{ height:'100%', borderRadius:4, transition:'width 0.4s', width:`${Math.min(100,pctEj)}%`, background:barColor(pctEj, cat.tipo==='gasto') }}/>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#9ca3af', marginTop:3 }}>
                      <span>Ejecutado: {fmtM(getTotalEjec(cat.id))} ({pctEj}%)</span>
                      <span>Meta: {fmtM(cat.meta)}</span>
                    </div>
                  </div>
                </div>

                {/* Distribución mensual expandible */}
                {isOpen && (
                  <div style={{ borderTop:'1px solid rgba(0,0,0,0.07)', paddingTop:14, marginTop:4 }}>
                    <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap', alignItems:'center' }}>
                      <span style={{ fontSize:12, color:'#6b7280' }}>Distribuir:</span>
                      <button onClick={()=>aplicarDist(cat.id,'uniforme')} style={{ ...btnSec, width:'auto', padding:'4px 10px', fontSize:11 }}>Uniforme</button>
                      <button onClick={()=>aplicarDist(cat.id,'estacional')} style={{ ...btnSec, width:'auto', padding:'4px 10px', fontSize:11 }}>Estacional</button>
                      <span style={{ marginLeft:'auto', fontSize:11, color: Math.abs(sumaDistActual-100) < 0.5 ? '#1D9E75' : '#E24B4A', fontWeight:500 }}>
                        Suma: {Math.round(sumaDistActual)}%
                      </span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:6 }}>
                      {MESES.map((mes,i)=>(
                        <div key={mes} style={{ textAlign:'center' }}>
                          <div style={{ fontSize:10, color:'#9ca3af', marginBottom:3 }}>{mes}</div>
                          <input
                            type="number" step="0.1" min="0" max="100"
                            value={Math.round(cat.dist[i]*10)/10}
                            onChange={e=>updateDist(cat.id, i, parseFloat(e.target.value)||0)}
                            style={{ width:'100%', fontSize:11, textAlign:'center', padding:'4px 2px', border:'1px solid rgba(0,0,0,0.12)', borderRadius:6, background: i < 6 && getEjecMes(cat.id,i) > 0 ? '#f0fdf4' : '#fff' }}
                          />
                          <div style={{ fontSize:10, color:'#9ca3af', marginTop:2 }}>{fmtM(totalMesPresup[i])}</div>
                          {i < 6 && getEjecMes(cat.id,i) > 0 && (
                            <div style={{ fontSize:10, color:'#1D9E75', marginTop:1 }}>✓ {fmtM(getEjecMes(cat.id,i))}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* ── Tab: Resumen anual ── */}
          {tab==='resumen' && (
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, overflow:'hidden' }}>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:700 }}>
                  <thead>
                    <tr style={{ background:'#fafafa' }}>
                      <th style={th}>Categoría</th>
                      {MESES.map(m=><th key={m} style={{ ...th, textAlign:'right' }}>{m}</th>)}
                      <th style={{ ...th, textAlign:'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Ingresos */}
                    <tr><td colSpan={14} style={{ padding:'6px 14px', fontSize:10, fontWeight:600, color:'#1D9E75', textTransform:'uppercase', letterSpacing:'0.06em', background:'#f0fdf4' }}>INGRESOS</td></tr>
                    {cats.filter(c=>c.tipo==='ingreso').map(cat=>(
                      <tr key={cat.id}>
                        <td style={{ padding:'8px 14px', fontWeight:500, color:'#111827' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ width:8, height:8, borderRadius:'50%', background:cat.color }}/>
                            {cat.nombre}
                          </div>
                        </td>
                        {MESES.map((_,i)=>(
                          <td key={i} style={{ padding:'8px 8px', textAlign:'right', color:'#374151' }}>{fmtM(getMesVal(cat,i))}</td>
                        ))}
                        <td style={{ padding:'8px 14px', textAlign:'right', fontWeight:600, color:'#1D9E75' }}>{fmtM(cat.meta)}</td>
                      </tr>
                    ))}
                    {/* Gastos */}
                    <tr><td colSpan={14} style={{ padding:'6px 14px', fontSize:10, fontWeight:600, color:'#E24B4A', textTransform:'uppercase', letterSpacing:'0.06em', background:'#fff5f5' }}>GASTOS</td></tr>
                    {cats.filter(c=>c.tipo==='gasto').map(cat=>(
                      <tr key={cat.id}>
                        <td style={{ padding:'8px 14px', fontWeight:500, color:'#111827' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ width:8, height:8, borderRadius:'50%', background:cat.color }}/>
                            {cat.nombre}
                          </div>
                        </td>
                        {MESES.map((_,i)=>(
                          <td key={i} style={{ padding:'8px 8px', textAlign:'right', color:'#374151' }}>{fmtM(getMesVal(cat,i))}</td>
                        ))}
                        <td style={{ padding:'8px 14px', textAlign:'right', fontWeight:600, color:'#E24B4A' }}>{fmtM(cat.meta)}</td>
                      </tr>
                    ))}
                    {/* Resultado neto */}
                    <tr style={{ background:'#f8fafc', borderTop:'2px solid rgba(0,0,0,0.1)' }}>
                      <td style={{ padding:'10px 14px', fontWeight:700, fontSize:13 }}>Resultado neto</td>
                      {MESES.map((_,i)=>{
                        const ing = cats.filter(c=>c.tipo==='ingreso').reduce((a,c)=>a+getMesVal(c,i),0)
                        const gas = cats.filter(c=>c.tipo==='gasto').reduce((a,c)=>a+getMesVal(c,i),0)
                        const neto = ing - gas
                        return <td key={i} style={{ padding:'10px 8px', textAlign:'right', fontWeight:600, color:neto>=0?'#1D9E75':'#E24B4A' }}>{fmtM(neto)}</td>
                      })}
                      <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:700, fontSize:13, color:utilidadMeta>=0?'#1D9E75':'#E24B4A' }}>{fmtM(utilidadMeta)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Tab: Comparativo ── */}
          {tab==='comparativo' && (
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20 }}>
              <div style={{ fontSize:13, color:'#6b7280', marginBottom:16 }}>
                Comparando presupuesto vs ejecución real H1 2025
              </div>
              {cats.map(cat => {
                const pct = getPctEjec(cat)
                const ejTotal = getTotalEjec(cat.id)
                const metaH1  = cat.dist.slice(0,6).reduce((a,d)=>a+cat.meta*d/100,0)
                const variacion = metaH1 ? Math.round((ejTotal - metaH1)/metaH1*100) : 0
                return (
                  <div key={cat.id} style={{ marginBottom:18 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6, flexWrap:'wrap', gap:6 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:9, height:9, borderRadius:'50%', background:cat.color }}/>
                        <span style={{ fontSize:13, fontWeight:500, color:'#111827' }}>{cat.nombre}</span>
                        <span style={{ fontSize:11, padding:'1px 7px', borderRadius:999, fontWeight:500,
                          background:cat.tipo==='ingreso'?'#E1F5EE':'#FCEBEB',
                          color:cat.tipo==='ingreso'?'#085041':'#791F1F' }}>
                          {cat.tipo}
                        </span>
                      </div>
                      <div style={{ display:'flex', gap:12, fontSize:12, flexWrap:'wrap' }}>
                        <span style={{ color:'#6b7280' }}>Meta H1: <strong style={{ color:'#111827' }}>{fmtM(metaH1)}</strong></span>
                        <span style={{ color:'#6b7280' }}>Real H1: <strong style={{ color: cat.tipo==='ingreso'?'#1D9E75':'#E24B4A' }}>{fmtM(ejTotal)}</strong></span>
                        <span style={{ fontWeight:600, color: variacion >= 0 ? (cat.tipo==='ingreso'?'#1D9E75':'#E24B4A') : (cat.tipo==='ingreso'?'#E24B4A':'#1D9E75') }}>
                          {variacion >= 0 ? '+' : ''}{variacion}%
                        </span>
                      </div>
                    </div>
                    {/* Barras dobles */}
                    <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                      <span style={{ fontSize:10, color:'#9ca3af', width:50, flexShrink:0 }}>Meta</span>
                      <div style={{ flex:1, height:7, background:'#f1f5f9', borderRadius:4, overflow:'hidden' }}>
                        <div style={{ height:'100%', borderRadius:4, width:'100%', background:cat.color, opacity:0.3 }}/>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:4, alignItems:'center', marginTop:3 }}>
                      <span style={{ fontSize:10, color:'#9ca3af', width:50, flexShrink:0 }}>Real</span>
                      <div style={{ flex:1, height:7, background:'#f1f5f9', borderRadius:4, overflow:'hidden' }}>
                        <div style={{ height:'100%', borderRadius:4, transition:'width 0.5s', width:`${Math.min(100,pct)}%`, background:barColor(pct, cat.tipo==='gasto') }}/>
                      </div>
                      <span style={{ fontSize:11, fontWeight:500, width:36, textAlign:'right', color:barColor(pct, cat.tipo==='gasto') }}>{pct}%</span>
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

// ── Estilos ────────────────────────────────────────────────────
const sel: React.CSSProperties = { fontSize:13, padding:'6px 10px', border:'1px solid rgba(0,0,0,0.14)', borderRadius:8, background:'#fff' }
const btnP: React.CSSProperties = { display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, border:'none', background:'#3266ad', color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer' }
const btnSec: React.CSSProperties = { display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px 16px', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', border:'1px solid rgba(0,0,0,0.12)', background:'#fff', color:'#111827', width:'100%' }
const lbl: React.CSSProperties = { display:'block', fontSize:12, fontWeight:500, color:'#6b7280', marginBottom:4 }
const inp: React.CSSProperties = { width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid rgba(0,0,0,0.14)', borderRadius:8, background:'#fff', color:'#111827', fontFamily:'DM Sans, sans-serif' }
const th: React.CSSProperties  = { textAlign:'left', padding:'9px 8px', fontWeight:500, color:'#6b7280', borderBottom:'1px solid rgba(0,0,0,0.07)', whiteSpace:'nowrap', fontSize:12 }
