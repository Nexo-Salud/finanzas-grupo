'use client'
import { useState, useRef, useEffect } from 'react'
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
  { href:'/kpis',         label:'KPIs',         icon:'📊' },
  { href:'/ia',           label:'Análisis IA',  icon:'🧠', active:true },
]

const CONTEXTO = `Eres un analista financiero experto para un grupo de 3 empresas chilenas.
Datos del grupo H1 2025:
- Empresa A: Ingresos $26.9M, Gastos $15.9M, Margen 41%, Rubro: Comercio y retail
- Empresa B: Ingresos $11.3M, Gastos $7.4M, Margen 35%, Rubro: Servicios profesionales
- Empresa C: Ingresos $5.3M, Gastos $3.5M, Margen 34%, Rubro: Inmobiliario y arriendos
- Alertas activas: Remuneraciones Empresa A +17% sobre presupuesto, Proveedores Empresa B 112% del presupuesto
- IVA a pagar grupo: $1.2M vence 12 julio 2025
- Caja total grupo: $10.6M distribuida en 3 empresas
- Proyección H2: crecimiento esperado 12-15% en ingresos
Responde en español, de forma concisa y práctica. Máximo 3-4 párrafos cortos. Usa montos en pesos chilenos (CLP). Si no tienes información suficiente para responder algo, dilo claramente.`

type Msg = { rol: 'user' | 'ia'; texto: string }

const ANOMALIAS = [
  { nivel:'crit', titulo:'Remuneraciones Empresa A — exceso 17%', desc:'El gasto en remuneraciones de junio alcanzó $2.1M versus presupuesto de $1.8M. La IA detecta tendencia alcista sostenida desde abril (+6%, +11%, +17%).', accion:'Revisar estructura salarial y horas extra. Evaluar si el crecimiento de ingresos justifica el aumento.' },
  { nivel:'crit', titulo:'Proveedores Empresa B — 112% del presupuesto', desc:'Gasto en proveedores llegó a $1.12M vs presupuesto de $1M. Detectado en dos facturas inusualmente grandes la primera semana del mes.', accion:'Verificar si las compras responden a un pedido anticipado o si hay duplicidad en facturas.' },
  { nivel:'warn', titulo:'Variación inusual gastos generales Empresa B', desc:'Gastos generales subieron 34% respecto al mes anterior. La IA identifica múltiples pequeñas transacciones no categorizadas que suman $180K adicionales.', accion:'Categorizar los gastos pendientes y validar si hay cargos no autorizados.' },
  { nivel:'warn', titulo:'Ingresos Empresa C bajo tendencia histórica', desc:'Junio muestra ingresos 18% bajo la meta. La IA detecta que la caída se concentra en arriendos — posible local vacante.', accion:'Verificar ocupación de locales. Si hay vacancia, iniciar búsqueda de arrendatario.' },
  { nivel:'ok',   titulo:'Empresa B cerró mayo dentro del presupuesto', desc:'Todos los gastos de mayo se mantuvieron bajo el presupuesto con eficiencia del 94%. Mejor cierre mensual del año.', accion:'Replicar las prácticas de control de mayo en los próximos meses.' },
]

const SUGERENCIAS = [
  { icon:'🐷', color:'#1D9E75', titulo:'Renegociar contrato de servicios cloud', desc:'Empresa B paga $180K/mes. Existen alternativas entre $120K-$140K/mes. Uso real es solo el 60% de la capacidad contratada.', ahorro:'Ahorro estimado: $480K - $720K anuales' },
  { icon:'⏱️', color:'#3266ad', titulo:'Adelantar cobranza en 7 días', desc:'Reducir de 28 a 21 días promedio implementando recordatorios automáticos al día 20. Libera flujo de caja mensual.', ahorro:'Flujo liberado: ~$1.8M mensual' },
  { icon:'🏠', color:'#BA7517', titulo:'Gestionar vacancia en Empresa C', desc:'La IA detecta caída en ingresos de arriendos consistente con un local vacante. Precio promedio otros locales: $900K/mes.', ahorro:'Ingreso recuperable: $900K/mes' },
  { icon:'📅', color:'#D85A30', titulo:'Constituir fondo de reserva IVA', desc:'El grupo paga en promedio $1.1M de IVA mensual. Separar este monto automáticamente al recibir pagos evita estrés de caja los días 10-12.', ahorro:'Mejora de flujo en período de pago' },
  { icon:'📣', color:'#7F77DD', titulo:'Aumentar presupuesto de marketing Empresa A', desc:'Marketing al 88% del presupuesto pero ingresos crecen al 20%. ROI positivo observado sugiere aumentar 15% el presupuesto.', ahorro:'Potencial ingreso adicional: $1.2M - $2M' },
]

const PATRONES = [
  { nombre:'Remuneraciones', trend:17,  color:'#D85A30', desc:'Tendencia alcista sostenida +17% en 6 meses' },
  { nombre:'Proveedores',    trend:12,  color:'#BA7517', desc:'Crecimiento gradual, pico en junio' },
  { nombre:'Arriendos',      trend:0,   color:'#3266ad', desc:'Gasto fijo estable, sin variación' },
  { nombre:'Marketing',      trend:-12, color:'#1D9E75', desc:'Bajo control, bien bajo el presupuesto' },
  { nombre:'Gastos gen.',    trend:34,  color:'#7F77DD', desc:'Spike anómalo en junio, requiere revisión' },
]

export default function IAPage() {
  const [tab,      setTab]      = useState<'anomalias'|'patrones'|'sugerencias'|'chat'>('anomalias')
  const [mensajes, setMensajes] = useState<Msg[]>([
    { rol:'ia', texto:'Hola, soy tu analista financiero con IA. Analizo los datos de tu grupo y puedo responder preguntas sobre gastos, márgenes, anomalías o cualquier duda financiera. ¿En qué te ayudo?' }
  ])
  const [input,    setInput]    = useState('')
  const [cargando, setCargando] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [mensajes])

  async function enviar(texto?: string) {
    const msg = (texto || input).trim()
    if (!msg || cargando) return
    setInput('')
    setMensajes(prev => [...prev, { rol:'user', texto:msg }])
    setCargando(true)

    try {
      const historial = [...mensajes, { rol:'user' as const, texto:msg }]
        .slice(-8)
        .map(m => ({ role: m.rol==='user'?'user':'assistant' as const, content: m.texto }))

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: CONTEXTO,
          messages: historial,
        }),
      })

      const data = await res.json()
      const respuesta = data.content?.map((c: any) => c.text || '').join('') || 'No pude obtener respuesta.'
      setMensajes(prev => [...prev, { rol:'ia', texto:respuesta }])
    } catch {
      setMensajes(prev => [...prev, { rol:'ia', texto:'Error al conectar con la IA. Verifica tu conexión e intenta nuevamente.' }])
    } finally {
      setCargando(false)
    }
  }

  const nivelColor  = (n: string) => n==='crit'?'#E24B4A':n==='warn'?'#EF9F27':'#1D9E75'
  const nivelBg     = (n: string) => n==='crit'?'#FCEBEB':n==='warn'?'#FAEEDA':'#EAF3DE'
  const nivelBorder = (n: string) => n==='crit'?'#E24B4A':n==='warn'?'#EF9F27':'#1D9E75'
  const nivelTx     = (n: string) => n==='crit'?'#A32D2D':n==='warn'?'#633806':'#27500A'
  const nivelLabel  = (n: string) => n==='crit'?'Crítico':n==='warn'?'Aviso':'OK'

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
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:15, fontWeight:600 }}>Análisis con IA</div>
            <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, fontWeight:600, background:'#EEEDFE', color:'#3C3489' }}>✨ Powered by Claude</span>
          </div>
        </div>

        <div style={{ padding:'24px 28px' }}>

          {/* Tabs */}
          <div style={{ display:'flex', gap:6, marginBottom:24, flexWrap:'wrap' }}>
            {([
              { key:'anomalias',   label:'⚠️ Anomalías'    },
              { key:'patrones',    label:'📊 Patrones'      },
              { key:'sugerencias', label:'💡 Sugerencias'   },
              { key:'chat',        label:'💬 Pregunta a la IA' },
            ] as const).map(t => (
              <button key={t.key} onClick={()=>setTab(t.key)} style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer', border:'1px solid rgba(0,0,0,0.1)', background:tab===t.key?'#eff4ff':'#fff', color:tab===t.key?'#3266ad':'#6b7280', fontWeight:tab===t.key?500:400 }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Tab: Anomalías ── */}
          {tab === 'anomalias' && (
            <>
              <div style={{ fontSize:12, color:'#6b7280', marginBottom:16, display:'flex', alignItems:'center', gap:6 }}>
                <span>✨</span> Análisis generado automáticamente por IA · Actualizado hoy
              </div>
              {ANOMALIAS.map((a, i) => (
                <div key={i} style={{ background:nivelBg(a.nivel), borderLeft:`3px solid ${nivelBorder(a.nivel)}`, borderRadius:12, padding:'14px 16px', marginBottom:12 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:6, marginBottom:6 }}>
                    <span style={{ fontSize:13, fontWeight:600, color:nivelTx(a.nivel) }}>{a.titulo}</span>
                    <span style={{ fontSize:10, padding:'2px 8px', borderRadius:999, fontWeight:600, background:nivelColor(a.nivel), color:'#fff' }}>{nivelLabel(a.nivel)}</span>
                  </div>
                  <div style={{ fontSize:13, color:nivelTx(a.nivel), lineHeight:1.5, marginBottom:8 }}>{a.desc}</div>
                  <div style={{ fontSize:12, color:nivelTx(a.nivel), display:'flex', alignItems:'flex-start', gap:6, opacity:0.9 }}>
                    <span style={{ flexShrink:0 }}>→</span>
                    <span>{a.accion}</span>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* ── Tab: Patrones ── */}
          {tab === 'patrones' && (
            <>
              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20, marginBottom:14 }}>
                <div style={sectionTitle}>Tendencia de gasto por categoría — variación 6 meses</div>
                {PATRONES.map(p => (
                  <div key={p.nombre} style={{ marginBottom:14 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                      <div>
                        <span style={{ fontSize:13, fontWeight:500, color:'#111827' }}>{p.nombre}</span>
                        <span style={{ fontSize:11, color:'#6b7280', marginLeft:8 }}>{p.desc}</span>
                      </div>
                      <span style={{ fontSize:13, fontWeight:700, color:p.trend>10?'#E24B4A':p.trend<0?'#1D9E75':'#6b7280' }}>
                        {p.trend>0?'+':''}{p.trend}%
                      </span>
                    </div>
                    <div style={{ height:8, background:'#f1f5f9', borderRadius:4, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${Math.min(100,Math.abs(p.trend)*2+20)}%`, background:p.color, borderRadius:4 }}/>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20, marginBottom:14 }}>
                <div style={sectionTitle}>Patrones estacionales detectados</div>
                {[
                  { mes:'Ene–Feb', icon:'❄️', patron:'Remuneraciones altas por aguinaldos y finiquitos de temporada anterior.' },
                  { mes:'Mar–Abr', icon:'🌱', patron:'Aumento en proveedores por inicio de temporada de compras.' },
                  { mes:'May–Jun', icon:'☀️', patron:'Peak de actividad comercial. Ingresos al alza pero también gastos operativos.' },
                  { mes:'Jul–Ago', icon:'🌙', patron:'Temporada baja proyectada. Buena oportunidad para renegociar contratos.' },
                ].map(e => (
                  <div key={e.mes} style={{ display:'flex', gap:12, padding:'10px 0', borderBottom:'1px solid rgba(0,0,0,0.06)' }}>
                    <span style={{ fontSize:20, flexShrink:0 }}>{e.icon}</span>
                    <div>
                      <div style={{ fontSize:13, fontWeight:500, color:'#111827', marginBottom:2 }}>{e.mes}</div>
                      <div style={{ fontSize:12, color:'#6b7280', lineHeight:1.5 }}>{e.patron}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20 }}>
                <div style={sectionTitle}>Correlaciones detectadas por IA</div>
                {[
                  { icon:'🔗', titulo:'Ingresos → Remuneraciones (correlación 0.82)', desc:'Cuando ingresos suben >10% mensual, remuneraciones tienden a subir 5-8% el mes siguiente.' },
                  { icon:'🔗', titulo:'Proveedores → Ingresos siguiente mes (correlación 0.71)', desc:'Meses con mayor gasto en proveedores correlacionan con mayor ingreso el mes siguiente. Sugiere compras anticipando demanda.' },
                ].map((c,i) => (
                  <div key={i} style={{ display:'flex', gap:12, padding:'10px 0', borderBottom:i===0?'1px solid rgba(0,0,0,0.06)':'none' }}>
                    <span style={{ fontSize:18, flexShrink:0 }}>{c.icon}</span>
                    <div>
                      <div style={{ fontSize:13, fontWeight:500, color:'#111827', marginBottom:2 }}>{c.titulo}</div>
                      <div style={{ fontSize:12, color:'#6b7280', lineHeight:1.5 }}>{c.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Tab: Sugerencias ── */}
          {tab === 'sugerencias' && (
            <>
              <div style={{ fontSize:12, color:'#6b7280', marginBottom:16 }}>
                ✨ {SUGERENCIAS.length} oportunidades de mejora detectadas por IA
              </div>
              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:'4px 20px' }}>
                {SUGERENCIAS.map((s, i) => (
                  <div key={i} style={{ display:'flex', gap:14, padding:'16px 0', borderBottom:i<SUGERENCIAS.length-1?'1px solid rgba(0,0,0,0.06)':'none' }}>
                    <span style={{ fontSize:22, flexShrink:0, marginTop:2 }}>{s.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
                        <span style={{ fontSize:13, fontWeight:600, color:'#111827' }}>{s.titulo}</span>
                      </div>
                      <div style={{ fontSize:12, color:'#6b7280', lineHeight:1.5, marginBottom:6 }}>{s.desc}</div>
                      <div style={{ fontSize:12, fontWeight:600, color:s.color, display:'flex', alignItems:'center', gap:4 }}>
                        📈 {s.ahorro}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Tab: Chat ── */}
          {tab === 'chat' && (
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, overflow:'hidden' }}>
              {/* Chips de acceso rápido */}
              <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(0,0,0,0.06)', display:'flex', gap:6, flexWrap:'wrap' }}>
                {[
                  '¿Cuál empresa tiene mejor margen?',
                  '¿Qué gasto puedo reducir primero?',
                  '¿Hay riesgo de iliquidez en Q3?',
                  '¿Cómo mejorar el margen de Empresa C?',
                  '¿Qué KPIs son más urgentes mejorar?',
                ].map(q => (
                  <button key={q} onClick={()=>enviar(q)} style={{ fontSize:11, padding:'4px 10px', borderRadius:999, border:'1px solid rgba(0,0,0,0.1)', background:'#f8fafc', color:'#374151', cursor:'pointer', whiteSpace:'nowrap' }}>
                    {q}
                  </button>
                ))}
              </div>

              {/* Mensajes */}
              <div ref={chatRef} style={{ height:380, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:12 }}>
                {mensajes.map((m, i) => (
                  <div key={i} style={{ maxWidth:'85%', alignSelf:m.rol==='user'?'flex-end':'flex-start' }}>
                    <div style={{ padding:'10px 14px', borderRadius:12, fontSize:13, lineHeight:1.6,
                      background: m.rol==='user'?'#3266ad':'#f1f5f9',
                      color: m.rol==='user'?'#fff':'#111827',
                      borderBottomRightRadius: m.rol==='user'?4:12,
                    }}>
                      {m.rol==='ia' && <div style={{ fontSize:10, fontWeight:600, color:'#9ca3af', marginBottom:4 }}>🧠 Analista IA</div>}
                      {m.texto.split('\n').map((line, j) => (
                        <div key={j} style={{ marginBottom: j < m.texto.split('\n').length-1 ? 4 : 0 }}>{line}</div>
                      ))}
                    </div>
                  </div>
                ))}
                {cargando && (
                  <div style={{ alignSelf:'flex-start' }}>
                    <div style={{ padding:'10px 14px', borderRadius:12, background:'#f1f5f9', fontSize:13, color:'#9ca3af' }}>
                      🧠 Analizando...
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div style={{ padding:'12px 16px', borderTop:'1px solid rgba(0,0,0,0.06)', display:'flex', gap:8 }}>
                <input
                  value={input}
                  onChange={e=>setInput(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); enviar() } }}
                  placeholder="Pregunta sobre tus finanzas..."
                  style={{ flex:1, padding:'9px 12px', fontSize:13, border:'1px solid rgba(0,0,0,0.12)', borderRadius:9, background:'#fff', color:'#111827', fontFamily:'DM Sans, sans-serif', outline:'none' }}
                  disabled={cargando}
                />
                <button onClick={()=>enviar()} disabled={cargando || !input.trim()} style={{ padding:'9px 18px', borderRadius:9, border:'none', background:cargando||!input.trim()?'#d1d5db':'#3266ad', color:'#fff', fontSize:13, fontWeight:600, cursor:cargando||!input.trim()?'not-allowed':'pointer' }}>
                  Enviar
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

const sectionTitle: React.CSSProperties = { fontSize:12, fontWeight:600, color:'#6b7280', textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:14 }
