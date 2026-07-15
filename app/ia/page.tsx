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
  { href:'/reportes',     label:'Reportes',     icon:'📄' },
  { href:'/bancos',       label:'Bancos',       icon:'🏦' },
  { href:'/tributario',   label:'Documentos',   icon:'🧾' },
  { href:'/proyecciones', label:'Proyecciones', icon:'📈' },
  { href:'/usuarios',     label:'Usuarios',     icon:'👥' },
  { href:'/kpis',         label:'KPIs',         icon:'📊' },
  { href:'/ia',           label:'Análisis IA',  icon:'🧠', active:true },
]

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

type Empresa = { id: string; nombre_corto: string; color: string }
type Mov     = { empresa_id: string; tipo: string; monto: number; fecha: string; categoria: string; descripcion?: string }
type Msg     = { rol: 'user' | 'ia'; texto: string }

function fmtM(n: number) {
  const a=Math.abs(n),s=n<0?'-':''
  if(a>=1e6) return s+'$'+(Math.round(a/1e5)/10)+'M'
  if(a>=1000) return s+'$'+Math.round(a/1000)+'K'
  return s+'$'+Math.round(a)
}
function fmtCLP(n: number) {
  return (n<0?'-':'')+'$'+Math.round(Math.abs(n)).toLocaleString('es-CL')
}

export default function IAPage() {
  const [empresas,    setEmpresas]    = useState<Empresa[]>([])
  const [movimientos, setMovimientos] = useState<Mov[]>([])
  const [cargando,    setCargando]    = useState(true)
  const [tab,         setTab]         = useState<'chat'|'anomalias'|'resumen'>('chat')
  const [mensajes,    setMensajes]    = useState<Msg[]>([])
  const [input,       setInput]       = useState('')
  const [pensando,    setPensando]    = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)
  const hoy = new Date()

  useEffect(() => { cargarDatos() }, [])
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [mensajes])

  async function cargarDatos() {
    setCargando(true)
    try {
      const [{ data: emps }, { data: movs }] = await Promise.all([
        supabase.from('empresas').select('id,nombre_corto,color').eq('activa',true).order('nombre_corto'),
        supabase.from('movimientos').select('empresa_id,tipo,monto,fecha,categoria,descripcion').order('fecha').limit(1000),
      ])
      setEmpresas(emps || [])
      setMovimientos(movs || [])

      // Mensaje inicial con contexto real
      if (emps && movs) {
        const ing  = movs.filter((m:Mov)=>m.tipo==='ingreso').reduce((a:number,m:Mov)=>a+m.monto,0)
        const gas  = movs.filter((m:Mov)=>m.tipo==='gasto').reduce((a:number,m:Mov)=>a+m.monto,0)
        const util = ing - gas
        const mg   = ing>0 ? Math.round(util/ing*100) : 0
        setMensajes([{
          rol:'ia',
          texto:`Hola, soy tu analista financiero IA. Ya cargué los datos reales de tu grupo:\n\n📊 ${emps.length} empresas activas · ${movs.length} movimientos registrados\n💰 Ingresos totales: ${fmtM(ing)} · Gastos: ${fmtM(gas)}\n📈 Utilidad: ${fmtM(util)} · Margen: ${mg}%\n\n¿Qué quieres analizar?`
        }])
      }
    } catch(e) { console.error(e) }
    finally { setCargando(false) }
  }

  // ── Construir contexto real para la IA ──
  function buildContexto() {
    const ing  = movimientos.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)
    const gas  = movimientos.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0)
    const util = ing - gas
    const mg   = ing>0 ? Math.round(util/ing*100) : 0

    // Por empresa
    const porEmpresa = empresas.map(emp => {
      const movEmp = movimientos.filter(m=>m.empresa_id===emp.id)
      const eIng   = movEmp.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)
      const eGas   = movEmp.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0)
      const eUtil  = eIng - eGas
      const eMg    = eIng>0 ? Math.round(eUtil/eIng*100) : 0
      return `- ${emp.nombre_corto}: Ingresos ${fmtM(eIng)}, Gastos ${fmtM(eGas)}, Utilidad ${fmtM(eUtil)}, Margen ${eMg}%`
    }).join('\n')

    // Por mes últimos 6
    const porMes: Record<string,{ing:number;gas:number}> = {}
    movimientos.forEach(m => {
      const key = m.fecha.slice(0,7)
      if (!porMes[key]) porMes[key] = {ing:0,gas:0}
      if (m.tipo==='ingreso') porMes[key].ing += m.monto
      else porMes[key].gas += m.monto
    })
    const histMeses = Object.entries(porMes).sort((a,b)=>a[0].localeCompare(b[0])).slice(-6)
      .map(([key,v]) => {
        const [y,mo] = key.split('-')
        return `  ${MESES[parseInt(mo)-1]} ${y}: Ing ${fmtM(v.ing)}, Gas ${fmtM(v.gas)}, Neto ${fmtM(v.ing-v.gas)}`
      }).join('\n')

    // Top categorías gasto
    const topGas: Record<string,number> = {}
    movimientos.filter(m=>m.tipo==='gasto').forEach(m => {
      topGas[m.categoria] = (topGas[m.categoria]||0) + m.monto
    })
    const topGasStr = Object.entries(topGas).sort((a,b)=>b[1]-a[1]).slice(0,6)
      .map(([cat,val]) => `  - ${cat}: ${fmtM(val)}`).join('\n')

    // Top categorías ingreso
    const topIng: Record<string,number> = {}
    movimientos.filter(m=>m.tipo==='ingreso').forEach(m => {
      topIng[m.categoria] = (topIng[m.categoria]||0) + m.monto
    })
    const topIngStr = Object.entries(topIng).sort((a,b)=>b[1]-a[1]).slice(0,5)
      .map(([cat,val]) => `  - ${cat}: ${fmtM(val)}`).join('\n')

    return `Eres un analista financiero experto para un grupo farmacéutico chileno.
Fecha actual: ${hoy.toLocaleDateString('es-CL')}

DATOS REALES DEL GRUPO:
Total movimientos: ${movimientos.length}
Ingresos totales: ${fmtCLP(ing)}
Gastos totales: ${fmtCLP(gas)}
Utilidad neta: ${fmtCLP(util)}
Margen neto: ${mg}%

POR EMPRESA:
${porEmpresa}

HISTORIAL MENSUAL (últimos 6 meses):
${histMeses}

TOP CATEGORÍAS DE INGRESO:
${topIngStr}

TOP CATEGORÍAS DE GASTO:
${topGasStr}

INSTRUCCIONES:
- Responde en español, de forma concisa y práctica
- Usa los datos reales proporcionados para responder
- Máximo 3-4 párrafos cortos
- Usa montos en pesos chilenos (CLP)
- Da recomendaciones concretas y accionables
- Si algo no está en los datos, dilo claramente`
  }

  async function enviar(texto?: string) {
    const msg = (texto || input).trim()
    if (!msg || pensando) return
    setInput('')
    const nuevosMensajes = [...mensajes, { rol:'user' as const, texto:msg }]
    setMensajes(nuevosMensajes)
    setPensando(true)

    try {
      const historial = nuevosMensajes.slice(-8).map(m => ({
        role: m.rol==='user' ? 'user' as const : 'assistant' as const,
        content: m.texto
      }))

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: buildContexto(),
          messages: historial,
        }),
      })

      const data = await res.json()
      const respuesta = data.content?.map((c: any) => c.text||'').join('') || 'No pude obtener respuesta.'
      setMensajes(prev => [...prev, { rol:'ia', texto:respuesta }])
    } catch {
      setMensajes(prev => [...prev, { rol:'ia', texto:'Error al conectar con la IA. Intenta nuevamente.' }])
    } finally {
      setPensando(false)
    }
  }

  // ── Anomalías calculadas desde datos reales ──
  function getAnomalias() {
    const anomalias = []
    const porMes: Record<string,{ing:number;gas:number}> = {}
    movimientos.forEach(m => {
      const key = m.fecha.slice(0,7)
      if (!porMes[key]) porMes[key] = {ing:0,gas:0}
      if (m.tipo==='ingreso') porMes[key].ing += m.monto
      else porMes[key].gas += m.monto
    })
    const mesesArr = Object.entries(porMes).sort((a,b)=>a[0].localeCompare(b[0]))

    // Detectar mes con mayor gasto relativo
    mesesArr.forEach(([key,v],i) => {
      if (i===0) return
      const prev = mesesArr[i-1][1]
      const varGas = prev.gas>0 ? Math.round((v.gas-prev.gas)/prev.gas*100) : 0
      const varIng = prev.ing>0 ? Math.round((v.ing-prev.ing)/prev.ing*100) : 0
      const [y,mo] = key.split('-')
      const label  = `${MESES[parseInt(mo)-1]} ${y}`

      if (varGas > 20) {
        anomalias.push({ nivel:'warn', titulo:`Gastos subieron ${varGas}% en ${label}`, desc:`Los gastos pasaron de ${fmtM(prev.gas)} a ${fmtM(v.gas)} — un aumento de ${varGas}% respecto al mes anterior.`, accion:'Revisar qué categorías generaron el aumento y evaluar si es justificado.' })
      }
      if (varIng < -10) {
        anomalias.push({ nivel:'crit', titulo:`Ingresos cayeron ${Math.abs(varIng)}% en ${label}`, desc:`Los ingresos bajaron de ${fmtM(prev.ing)} a ${fmtM(v.ing)} — una caída de ${Math.abs(varIng)}%.`, accion:'Investigar la causa de la caída de ingresos y tomar medidas correctivas.' })
      }
      if (varIng > 15) {
        anomalias.push({ nivel:'ok', titulo:`Ingresos crecieron ${varIng}% en ${label}`, desc:`Excelente resultado — los ingresos subieron de ${fmtM(prev.ing)} a ${fmtM(v.ing)}.`, accion:'Identificar qué impulsó el crecimiento y replicar las acciones exitosas.' })
      }
    })

    // Detectar categoría de gasto dominante
    const topGas: Record<string,number> = {}
    movimientos.filter(m=>m.tipo==='gasto').forEach(m => { topGas[m.categoria]=(topGas[m.categoria]||0)+m.monto })
    const gasTotal = Object.values(topGas).reduce((a,b)=>a+b,0)
    Object.entries(topGas).sort((a,b)=>b[1]-a[1]).slice(0,1).forEach(([cat,val]) => {
      const pct = gasTotal>0 ? Math.round(val/gasTotal*100) : 0
      if (pct > 35) {
        anomalias.push({ nivel:'warn', titulo:`${cat} concentra el ${pct}% del gasto total`, desc:`${cat} es la categoría de gasto más grande con ${fmtM(val)} — ${pct}% del total.`, accion:'Evaluar si existe margen para negociar mejores condiciones o reducir este gasto.' })
      }
    })

    return anomalias.length > 0 ? anomalias : [{ nivel:'ok', titulo:'Sin anomalías detectadas', desc:'Los datos no muestran variaciones inusuales significativas en el período analizado.', accion:'Continúa monitoreando regularmente.' }]
  }

  const anomalias = getAnomalias()
  const nivelColor = (n: string) => n==='crit'?'#E24B4A':n==='warn'?'#EF9F27':'#1D9E75'
  const nivelBg    = (n: string) => n==='crit'?'#FCEBEB':n==='warn'?'#FAEEDA':'#EAF3DE'
  const nivelTx    = (n: string) => n==='crit'?'#A32D2D':n==='warn'?'#633806':'#27500A'
  const nivelLabel = (n: string) => n==='crit'?'Crítico':n==='warn'?'Aviso':'OK'

  // ── Resumen IA ──
  const ing  = movimientos.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)
  const gas  = movimientos.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0)
  const util = ing - gas
  const mg   = ing>0 ? Math.round(util/ing*100) : 0

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
            <div style={{ fontSize:15, fontWeight:600 }}>Análisis con IA</div>
            <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, fontWeight:600, background:'#EEEDFE', color:'#3C3489' }}>✨ Claude + datos reales</span>
          </div>
          {!cargando && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:'#E1F5EE', color:'#085041', fontWeight:500 }}>🟢 {movimientos.length} movimientos cargados</span>}
        </div>

        <div style={{ padding:'24px 28px' }}>

          {cargando && <div style={{ textAlign:'center', padding:'4rem', color:'#9ca3af' }}>⏳ Cargando datos reales...</div>}

          {!cargando && (
            <>
              {/* Métricas rápidas */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:12, marginBottom:20 }}>
                {[
                  { label:'Ingresos',  value:fmtM(ing),  color:'#1D9E75', bg:'#E1F5EE' },
                  { label:'Gastos',    value:fmtM(gas),  color:'#E24B4A', bg:'#FCEBEB' },
                  { label:'Utilidad',  value:fmtM(util), color:'#3266ad', bg:'#E6F1FB' },
                  { label:'Margen',    value:mg+'%',      color:'#7F77DD', bg:'#EEEDFE' },
                ].map(m=>(
                  <div key={m.label} style={{ background:m.bg, borderRadius:12, padding:'12px 14px' }}>
                    <div style={{ fontSize:11, color:m.color, fontWeight:500, marginBottom:3, opacity:0.8 }}>{m.label}</div>
                    <div style={{ fontSize:20, fontWeight:700, color:m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div style={{ display:'flex', gap:6, marginBottom:20 }}>
                {([
                  {k:'chat',      l:'💬 Chat con IA'},
                  {k:'anomalias', l:'⚠️ Anomalías detectadas'},
                  {k:'resumen',   l:'📊 Resumen ejecutivo'},
                ] as const).map(t=>(
                  <button key={t.k} onClick={()=>setTab(t.k)} style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer', border:'1px solid rgba(0,0,0,0.1)', background:tab===t.k?'#eff4ff':'#fff', color:tab===t.k?'#3266ad':'#6b7280', fontWeight:tab===t.k?500:400 }}>
                    {t.l}
                  </button>
                ))}
              </div>

              {/* ── Chat ── */}
              {tab==='chat' && (
                <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, overflow:'hidden' }}>
                  {/* Chips preguntas */}
                  <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(0,0,0,0.06)', display:'flex', gap:6, flexWrap:'wrap' }}>
                    {[
                      '¿Cómo va el negocio?',
                      '¿Dónde puedo reducir gastos?',
                      '¿Cuál empresa tiene mejor margen?',
                      '¿Hay riesgo de iliquidez?',
                      '¿Qué categoría de gasto preocupa más?',
                      '¿Cuál es la tendencia de ingresos?',
                    ].map(q=>(
                      <button key={q} onClick={()=>enviar(q)} style={{ fontSize:11, padding:'4px 10px', borderRadius:999, border:'1px solid rgba(0,0,0,0.1)', background:'#f8fafc', color:'#374151', cursor:'pointer', whiteSpace:'nowrap' as const }}>
                        {q}
                      </button>
                    ))}
                  </div>

                  {/* Mensajes */}
                  <div ref={chatRef} style={{ height:380, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:12 }}>
                    {mensajes.map((m,i)=>(
                      <div key={i} style={{ maxWidth:'85%', alignSelf:m.rol==='user'?'flex-end':'flex-start' }}>
                        <div style={{ padding:'10px 14px', borderRadius:12, fontSize:13, lineHeight:1.6,
                          background:m.rol==='user'?'#3266ad':'#f1f5f9',
                          color:m.rol==='user'?'#fff':'#111827',
                        }}>
                          {m.rol==='ia' && <div style={{ fontSize:10, fontWeight:600, color:'#9ca3af', marginBottom:4 }}>🧠 Analista IA — datos reales</div>}
                          {m.texto.split('\n').map((line,j)=>(
                            <div key={j} style={{ marginBottom:j<m.texto.split('\n').length-1?4:0 }}>{line}</div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {pensando && (
                      <div style={{ alignSelf:'flex-start' }}>
                        <div style={{ padding:'10px 14px', borderRadius:12, background:'#f1f5f9', fontSize:13, color:'#9ca3af' }}>
                          🧠 Analizando tus datos reales...
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Input */}
                  <div style={{ padding:'12px 16px', borderTop:'1px solid rgba(0,0,0,0.06)', display:'flex', gap:8 }}>
                    <input
                      value={input}
                      onChange={e=>setInput(e.target.value)}
                      onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); enviar() } }}
                      placeholder="Pregunta sobre tus finanzas reales..."
                      disabled={pensando}
                      style={{ flex:1, padding:'9px 12px', fontSize:13, border:'1px solid rgba(0,0,0,0.12)', borderRadius:9, background:'#fff', color:'#111827', fontFamily:'DM Sans, sans-serif', outline:'none' }}
                    />
                    <button onClick={()=>enviar()} disabled={pensando||!input.trim()} style={{ padding:'9px 18px', borderRadius:9, border:'none', background:pensando||!input.trim()?'#d1d5db':'#3266ad', color:'#fff', fontSize:13, fontWeight:600, cursor:pensando||!input.trim()?'not-allowed':'pointer' }}>
                      Enviar
                    </button>
                  </div>
                </div>
              )}

              {/* ── Anomalías ── */}
              {tab==='anomalias' && (
                <>
                  <div style={{ fontSize:12, color:'#6b7280', marginBottom:14 }}>
                    Análisis automático basado en tus {movimientos.length} movimientos reales
                  </div>
                  {anomalias.map((a,i)=>(
                    <div key={i} style={{ background:nivelBg(a.nivel), borderLeft:`3px solid ${nivelColor(a.nivel)}`, borderRadius:12, padding:'14px 16px', marginBottom:12 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6, flexWrap:'wrap', gap:6 }}>
                        <span style={{ fontSize:13, fontWeight:600, color:nivelTx(a.nivel) }}>{a.titulo}</span>
                        <span style={{ fontSize:10, padding:'2px 8px', borderRadius:999, fontWeight:600, background:nivelColor(a.nivel), color:'#fff' }}>{nivelLabel(a.nivel)}</span>
                      </div>
                      <div style={{ fontSize:13, color:nivelTx(a.nivel), lineHeight:1.5, marginBottom:8 }}>{a.desc}</div>
                      <div style={{ fontSize:12, color:nivelTx(a.nivel), display:'flex', gap:6, opacity:0.9 }}>
                        <span>→</span><span>{a.accion}</span>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* ── Resumen ejecutivo ── */}
              {tab==='resumen' && (
                <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:24 }}>
                  {/* Encabezado */}
                  <div style={{ borderBottom:'3px solid #3266ad', paddingBottom:14, marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div>
                      <div style={{ fontSize:18, fontWeight:700, color:'#111827' }}>Resumen ejecutivo financiero</div>
                      <div style={{ fontSize:12, color:'#6b7280', marginTop:3 }}>
                        Grupo consolidado · Generado {hoy.toLocaleDateString('es-CL')}
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:11, color:'#9ca3af' }}>Datos reales Supabase</div>
                      <div style={{ fontSize:20, fontWeight:700, color:'#3266ad' }}>🟢</div>
                    </div>
                  </div>

                  {/* KPIs */}
                  <div style={{ fontSize:11, fontWeight:600, color:'#3266ad', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10, borderBottom:'1px solid #e5e7eb', paddingBottom:4 }}>Indicadores clave</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:20 }}>
                    {[
                      { l:'Ingresos',   v:fmtM(ing),   c:'#1D9E75' },
                      { l:'Gastos',     v:fmtM(gas),   c:'#E24B4A' },
                      { l:'Utilidad',   v:fmtM(util),  c:'#3266ad' },
                      { l:'Margen',     v:mg+'%',       c:'#111827' },
                      { l:'Empresas',   v:empresas.length.toString(), c:'#7F77DD' },
                      { l:'Movimientos',v:movimientos.length.toString(), c:'#BA7517' },
                    ].map(k=>(
                      <div key={k.l} style={{ background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:8, padding:'10px', textAlign:'center' }}>
                        <div style={{ fontSize:10, color:'#6b7280', marginBottom:3 }}>{k.l}</div>
                        <div style={{ fontSize:16, fontWeight:700, color:k.c }}>{k.v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Por empresa */}
                  <div style={{ fontSize:11, fontWeight:600, color:'#3266ad', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10, borderBottom:'1px solid #e5e7eb', paddingBottom:4 }}>Por empresa</div>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, marginBottom:20 }}>
                    <thead>
                      <tr style={{ background:'#3266ad' }}>
                        {['Empresa','Ingresos','Gastos','Utilidad','Margen'].map(h=>(
                          <th key={h} style={{ textAlign:'left', padding:'7px 10px', color:'#fff', fontWeight:500 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {empresas.map((emp,i)=>{
                        const movEmp = movimientos.filter(m=>m.empresa_id===emp.id)
                        const eIng   = movEmp.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)
                        const eGas   = movEmp.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0)
                        const eUtil  = eIng - eGas
                        const eMg    = eIng>0 ? Math.round(eUtil/eIng*100) : 0
                        return (
                          <tr key={emp.id} style={{ background:i%2===0?'#f8fafc':'#fff' }}>
                            <td style={{ padding:'7px 10px', fontWeight:500 }}>{emp.nombre_corto}</td>
                            <td style={{ padding:'7px 10px', color:'#1D9E75', fontWeight:600 }}>{fmtM(eIng)}</td>
                            <td style={{ padding:'7px 10px', color:'#E24B4A' }}>{fmtM(eGas)}</td>
                            <td style={{ padding:'7px 10px', fontWeight:600, color:eUtil>=0?'#3266ad':'#E24B4A' }}>{fmtM(eUtil)}</td>
                            <td style={{ padding:'7px 10px', fontWeight:600, color:eMg>=30?'#1D9E75':eMg>=15?'#EF9F27':'#E24B4A' }}>{eMg}%</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  {/* Footer */}
                  <div style={{ borderTop:'1px solid #e5e7eb', paddingTop:10, display:'flex', justifyContent:'space-between', fontSize:10, color:'#9ca3af' }}>
                    <span>Plataforma Financiera Grupo Farmacias</span>
                    <span>{movimientos.length} movimientos · {hoy.toLocaleDateString('es-CL')}</span>
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
