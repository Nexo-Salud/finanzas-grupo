'use client'
import { useState } from 'react'
import Link from 'next/link'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun']

const DATA = MESES.map((mes, i) => ({
  mes,
  A: [4200,5100,4800,6200,5900,7100][i],
  B: [2800,3200,3500,3100,4000,4400][i],
  C: [1500,1800,2100,1900,2400,2800][i],
}))

function fmtM(n: number) {
  if (n >= 1e6) return '$' + (Math.round(n / 1e5) / 10) + 'M'
  if (n >= 1000) return '$' + Math.round(n / 1000) + 'K'
  return '$' + Math.round(n)
}

const NAV = [
  { href:'/',             label:'Dashboard',    icon:'▦', active:true },
  { href:'/movimientos',  label:'Movimientos',  icon:'↕'  },
  { href:'/presupuesto',  label:'Presupuesto',  icon:'🎯' },
  { href:'/alertas',      label:'Alertas',      icon:'🔔' },
  { href:'/reportes',     label:'Reportes',     icon:'📄' },
  { href:'/bancos',       label:'Bancos',       icon:'🏦' },
  { href:'/tributario',   label:'Documentos',   icon:'🧾' },
  { href:'/proyecciones', label:'Proyecciones', icon:'📈' },
  { href:'/usuarios',     label:'Usuarios',     icon:'👥' },
  { href:'/kpis',         label:'KPIs',         icon:'📊' },
  { href:'/ia',           label:'Análisis IA',  icon:'🧠' },
]

export default function DashboardPage() {
  const [empresa, setEmpresa] = useState('all')

  const maxVal = Math.max(...DATA.flatMap(d => [d.A + d.B + d.C]))

  const metricas = [
    { label:'Ingresos grupo', value:'$43.5M', delta:'+14% vs 2024', color:'#1D9E75', bg:'#E1F5EE' },
    { label:'Gastos grupo',   value:'$26.8M', delta:'+9% vs 2024',  color:'#E24B4A', bg:'#FCEBEB' },
    { label:'Utilidad neta',  value:'$16.7M', delta:'Margen 38%',   color:'#3266ad', bg:'#E6F1FB' },
    { label:'Caja total',     value:'$10.6M', delta:'3 empresas',   color:'#7F77DD', bg:'#EEEDFE' },
  ]

  const ranking = [
    { nombre:'Empresa A', util:'$11M',  margen:'41%', color:'#3266ad', pct:100 },
    { nombre:'Empresa B', util:'$3.9M', margen:'35%', color:'#1D9E75', pct:35  },
    { nombre:'Empresa C', util:'$1.8M', margen:'34%', color:'#BA7517', pct:16  },
  ]

  const alertas = [
    { color:'#E24B4A', texto:'Remuneraciones Empresa A +17% sobre presupuesto' },
    { color:'#E24B4A', texto:'Proveedores Empresa B en 112% del presupuesto' },
    { color:'#EF9F27', texto:'Marketing Empresa A al 88% del límite mensual' },
    { color:'#EF9F27', texto:'Ingresos Empresa C 18% bajo la meta de junio' },
  ]

  const modulos = [
    { href:'/movimientos',  icon:'↕',  label:'Movimientos',  ok:false },
    { href:'/presupuesto',  icon:'🎯', label:'Presupuesto',  ok:false },
    { href:'/alertas',      icon:'🔔', label:'Alertas',      ok:false },
    { href:'/bancos',       icon:'🏦', label:'Bancos',       ok:false },
    { href:'/tributario',   icon:'🧾', label:'Documentos',   ok:false },
    { href:'/proyecciones', icon:'📈', label:'Proyecciones', ok:false },
    { href:'/usuarios',     icon:'👥', label:'Usuarios',     ok:false },
    { href:'/kpis',         icon:'📊', label:'KPIs',         ok:false },
    { href:'/ia',           icon:'🧠', label:'IA',           ok:false },
  ]

  return (
    <div style={{ minHeight:'100vh', background:'#f8f9fb', fontFamily:'DM Sans, sans-serif' }}>

      {/* ── Sidebar ── */}
      <div style={{ position:'fixed', top:0, left:0, width:220, height:'100vh', background:'#fff', borderRight:'1px solid rgba(0,0,0,0.08)', display:'flex', flexDirection:'column', padding:'0 12px 16px', zIndex:100, overflowY:'auto' }}>
        <div style={{ height:56, display:'flex', alignItems:'center', gap:10, borderBottom:'1px solid rgba(0,0,0,0.08)', marginBottom:12, marginLeft:-12, marginRight:-12, paddingLeft:20, fontSize:15, fontWeight:600, color:'#3266ad' }}>
          📊 Finanzas Grupo
        </div>
        {NAV.map(item => (
          <Link key={item.href} href={item.href} style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px', borderRadius:8, fontSize:13.5, color:(item as any).active?'#3266ad':'#6b7280', background:(item as any).active?'#eff4ff':'transparent', fontWeight:(item as any).active?500:400, textDecoration:'none', marginBottom:2 }}>
            <span style={{ fontSize:15 }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
        <div style={{ marginTop:'auto', paddingTop:16, borderTop:'1px solid rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize:12, color:'#374151', fontWeight:500 }}>Carlos Mendoza</div>
          <div style={{ fontSize:11, color:'#9ca3af' }}>Administrador</div>
        </div>
      </div>

      {/* ── Main ── */}
      <div style={{ marginLeft:220 }}>

        {/* Header */}
        <div style={{ height:56, background:'#fff', borderBottom:'1px solid rgba(0,0,0,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 28px', position:'sticky', top:0, zIndex:50 }}>
          <div style={{ fontSize:15, fontWeight:600 }}>Dashboard consolidado</div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <select value={empresa} onChange={e => setEmpresa(e.target.value)}
              style={{ fontSize:13, padding:'6px 10px', border:'1px solid rgba(0,0,0,0.12)', borderRadius:8, background:'#fff' }}>
              <option value="all">Grupo completo</option>
              <option value="A">Empresa A</option>
              <option value="B">Empresa B</option>
              <option value="C">Empresa C</option>
            </select>
            <div style={{ width:32, height:32, borderRadius:'50%', background:'#eff4ff', color:'#3266ad', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700 }}>CM</div>
          </div>
        </div>

        <div style={{ padding:'24px 28px' }}>

          {/* Métricas */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:12, marginBottom:24 }}>
            {metricas.map(m => (
              <div key={m.label} style={{ background:m.bg, borderRadius:12, padding:'16px 18px' }}>
                <div style={{ fontSize:11, color:m.color, fontWeight:500, marginBottom:5, opacity:0.85 }}>{m.label}</div>
                <div style={{ fontSize:24, fontWeight:700, color:m.color }}>{m.value}</div>
                <div style={{ fontSize:12, color:m.color, marginTop:4, opacity:0.75 }}>{m.delta}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>

            {/* Gráfico barras */}
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:14 }}>
                Ingresos por empresa — H1 2025
              </div>
              <div style={{ display:'flex', gap:12, marginBottom:14 }}>
                {[{l:'Empresa A',c:'#3266ad'},{l:'Empresa B',c:'#1D9E75'},{l:'Empresa C',c:'#BA7517'}].map(e=>(
                  <span key={e.l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#6b7280' }}>
                    <span style={{ width:10, height:10, borderRadius:2, background:e.c, display:'inline-block' }}/>
                    {e.l}
                  </span>
                ))}
              </div>
              <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:160 }}>
                {DATA.map(d => {
                  const total = d.A + d.B + d.C
                  const h = Math.round(total / maxVal * 140)
                  const hA = Math.round(d.A / total * h)
                  const hB = Math.round(d.B / total * h)
                  const hC = h - hA - hB
                  return (
                    <div key={d.mes} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:0 }}>
                      <div style={{ width:'100%', display:'flex', flexDirection:'column', borderRadius:'4px 4px 0 0', overflow:'hidden' }}>
                        <div style={{ width:'100%', height:hA, background:'#3266ad' }}/>
                        <div style={{ width:'100%', height:hB, background:'#1D9E75' }}/>
                        <div style={{ width:'100%', height:hC, background:'#BA7517' }}/>
                      </div>
                      <div style={{ fontSize:10, color:'#9ca3af', marginTop:5 }}>{d.mes}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Ranking */}
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:14 }}>
                Ranking por utilidad neta
              </div>
              {ranking.map((e, i) => (
                <div key={e.nombre} style={{ marginBottom:16 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                    <span style={{ fontSize:18, fontWeight:700, color:'#d1d5db', width:20 }}>{i+1}</span>
                    <span style={{ width:9, height:9, borderRadius:'50%', background:e.color, flexShrink:0 }}/>
                    <span style={{ flex:1, fontSize:13, fontWeight:500, color:'#111827' }}>{e.nombre}</span>
                    <span style={{ fontSize:12, color:'#6b7280' }}>Margen {e.margen}</span>
                    <span style={{ fontSize:14, fontWeight:700, color:e.color }}>{e.util}</span>
                  </div>
                  <div style={{ height:6, background:'#f1f5f9', borderRadius:3, overflow:'hidden', marginLeft:30 }}>
                    <div style={{ height:'100%', width:`${e.pct}%`, background:e.color, borderRadius:3, transition:'width 0.5s' }}/>
                  </div>
                </div>
              ))}

              <div style={{ borderTop:'1px solid rgba(0,0,0,0.07)', paddingTop:14, marginTop:4 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Alertas activas</div>
                {alertas.map((a,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <div style={{ width:7, height:7, borderRadius:'50%', background:a.color, flexShrink:0 }}/>
                    <span style={{ fontSize:12, color:'#374151' }}>{a.texto}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Módulos */}
          <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                Acceso rápido a módulos
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))', gap:8 }}>
              {modulos.map(m => (
                <Link key={m.href} href={m.href} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, padding:'14px 8px', borderRadius:10, border:'1px solid rgba(0,0,0,0.08)', background:'#fafafa', textDecoration:'none', transition:'all 0.12s', cursor:'pointer' }}>
                  <span style={{ fontSize:22 }}>{m.icon}</span>
                  <span style={{ fontSize:12, fontWeight:500, color:'#374151', textAlign:'center' }}>{m.label}</span>
                </Link>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
