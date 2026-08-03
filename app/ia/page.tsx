'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

const NAV = [
  { href:'/',             label:'Dashboard',    icon:'▦'  },
  { href:'/movimientos',  label:'Movimientos',  icon:'↕'  },
  { href:'/caja',           label:'Caja',         icon:'💵' },
  { href:'/presupuesto',  label:'Presupuesto',  icon:'🎯' },
  { href:'/alertas',      label:'Alertas',      icon:'🔔' },
  { href:'/reportes',     label:'Reportes',     icon:'📄' },
  { href:'/estados',      label:'Est. Financ.', icon:'📑' },
  { href:'/bancos',       label:'Bancos',       icon:'🏦' },
  { href:'/tributario',   label:'Documentos',   icon:'🧾' },
  { href:'/proyecciones', label:'Proyecciones', icon:'📈' },
  { href:'/usuarios',     label:'Usuarios',     icon:'👥' },
  { href:'/asistencia',     label:'Asistencia',   icon:'🕐' },
  { href:'/kpis',         label:'KPIs',         icon:'📊' },
  { href:'/ia',           label:'Análisis IA',  icon:'🧠', active:true },
]

type Empresa = { id: string; nombre_corto: string; color: string }
type Mov     = { empresa_id: string; tipo: string; monto: number; fecha: string; categoria: string; descripcion?: string }
type Msg     = { rol: 'user'|'ia'; texto: string }

function fmtM(n: number) {
  const a=Math.abs(n),s=n<0?'-':''
  if(a>=1e6) return s+'$'+(Math.round(a/1e5)/10)+'M'
  if(a>=1000) return s+'$'+Math.round(a/1000)+'K'
  return s+'$'+Math.round(a)
}
function fmtCLP(n: number) { return (n<0?'-':'')+'$'+Math.round(Math.abs(n)).toLocaleString('es-CL') }

export default function IAPage() {
  const router = useRouter()
  const [userEmail,          setUserEmail]          = useState('')
  const [esAdmin,            setEsAdmin]            = useState(true)
  const [empresasPermitidas, setEmpresasPermitidas] = useState<string[]>([])
  const [authListo,          setAuthListo]          = useState(false)
  const [empresas,    setEmpresas]    = useState<Empresa[]>([])
  const [movimientos, setMovimientos] = useState<Mov[]>([])
  const [cargando,    setCargando]    = useState(false)
  const [tab,         setTab]         = useState<'chat'|'anomalias'|'resumen'>('chat')
  const [mensajes,    setMensajes]    = useState<Msg[]>([])
  const [input,       setInput]       = useState('')
  const [pensando,    setPensando]    = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)
  const hoy = new Date()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      const email = session.user.email || ''
      setUserEmail(email)
      const { data: perfil } = await supabase
        .from('usuarios_plataforma').select('rol,empresas_permitidas').eq('email',email).single()
      let perms: string[] = []
      if (perfil && perfil.rol !== 'admin' && perfil.empresas_permitidas?.length > 0) {
        perms = perfil.empresas_permitidas; setEsAdmin(false); setEmpresasPermitidas(perms)
      } else { setEsAdmin(true); setEmpresasPermitidas([]) }
      setAuthListo(true)
      await cargarDatos(perms)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.push('/login')
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [mensajes])

  async function cerrarSesion() { await supabase.auth.signOut(); router.push('/login') }

  async function cargarDatos(perms: string[] = []) {
    setCargando(true)
    try {
      let qE = supabase.from('empresas').select('id,nombre_corto,color').eq('activa',true)
      if (perms.length > 0) qE = qE.in('id', perms)
      const { data: emps } = await qE.order('nombre_corto')
      let qM = supabase.from('movimientos').select('empresa_id,tipo,monto,fecha,categoria,descripcion').order('fecha').limit(1000)
      if (perms.length > 0) qM = qM.in('empresa_id', perms)
      const { data: movs } = await qM
      setEmpresas(emps || [])
      setMovimientos(movs || [])
      const ing  = (movs||[]).filter((m:Mov)=>m.tipo==='ingreso').reduce((a:number,m:Mov)=>a+m.monto,0)
      const gas  = (movs||[]).filter((m:Mov)=>m.tipo==='gasto').reduce((a:number,m:Mov)=>a+m.monto,0)
      const util = ing-gas
      const mg   = ing>0?Math.round(util/ing*100):0
      setMensajes([{ rol:'ia', texto:`Hola, soy tu analista financiero IA. Datos cargados:\n\n📊 ${(emps||[]).length} empresas · ${(movs||[]).length} movimientos\n💰 Ingresos: ${fmtM(ing)} · Gastos: ${fmtM(gas)}\n📈 Utilidad: ${fmtM(util)} · Margen: ${mg}%\n\n¿Qué quieres analizar?` }])
    } catch(e) { console.error(e) }
    finally { setCargando(false) }
  }

  function buildContexto() {
    const ing  = movimientos.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)
    const gas  = movimientos.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0)
    const util = ing-gas
    const mg   = ing>0?Math.round(util/ing*100):0
    const porEmpresa = empresas.map(emp => {
      const movEmp = movimientos.filter(m=>m.empresa_id===emp.id)
      const eIng = movEmp.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)
      const eGas = movEmp.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0)
      return `- ${emp.nombre_corto}: Ingresos ${fmtM(eIng)}, Gastos ${fmtM(eGas)}, Utilidad ${fmtM(eIng-eGas)}, Margen ${eIng>0?Math.round((eIng-eGas)/eIng*100):0}%`
    }).join('\n')
    const topGas: Record<string,number> = {}
    movimientos.filter(m=>m.tipo==='gasto').forEach(m => { topGas[m.categoria]=(topGas[m.categoria]||0)+m.monto })
    const topGasStr = Object.entries(topGas).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([c,v])=>`  - ${c}: ${fmtM(v)}`).join('\n')
    return `Eres un analista financiero experto para un grupo farmacéutico chileno.
Fecha: ${hoy.toLocaleDateString('es-CL')}
Ingresos totales: ${fmtCLP(ing)} | Gastos: ${fmtCLP(gas)} | Utilidad: ${fmtCLP(util)} | Margen: ${mg}%
POR EMPRESA:\n${porEmpresa}
TOP GASTOS:\n${topGasStr}
Responde en español, conciso y práctico. Máximo 3-4 párrafos.`
  }

  async function enviar(texto?: string) {
    const msg = (texto||input).trim()
    if (!msg||pensando) return
    setInput('')
    const nuevosMensajes = [...mensajes, { rol:'user' as const, texto:msg }]
    setMensajes(nuevosMensajes)
    setPensando(true)
    try {
      const historial = nuevosMensajes.slice(-8).map(m => ({ role: m.rol==='user'?'user' as const:'assistant' as const, content:m.texto }))
      const res = await fetch('/api/ia', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ system:buildContexto(), messages:historial }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setMensajes(prev=>[...prev, { rol:'ia', texto:`⚠️ ${data.error || 'Error al conectar con la IA.'}` }])
        return
      }
      const respuesta = data.content?.map((c: any)=>c.text||'').join('') || 'No pude obtener respuesta.'
      setMensajes(prev=>[...prev, { rol:'ia', texto:respuesta }])
    } catch { setMensajes(prev=>[...prev, { rol:'ia', texto:'⚠️ Error al conectar con la IA.' }]) }
    finally { setPensando(false) }
  }

  function getAnomalias() {
    const anomalias: any[] = []
    const porMes: Record<string,{ing:number;gas:number}> = {}
    movimientos.forEach(m => {
      const key = m.fecha.slice(0,7)
      if (!porMes[key]) porMes[key] = {ing:0,gas:0}
      if (m.tipo==='ingreso') porMes[key].ing += m.monto
      else porMes[key].gas += m.monto
    })
    const mesesArr = Object.entries(porMes).sort((a,b)=>a[0].localeCompare(b[0]))
    mesesArr.forEach(([key,v],i) => {
      if (i===0) return
      const prev = mesesArr[i-1][1]
      const varGas = prev.gas>0?Math.round((v.gas-prev.gas)/prev.gas*100):0
      const varIng = prev.ing>0?Math.round((v.ing-prev.ing)/prev.ing*100):0
      const [y,mo] = key.split('-')
      const label = `${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][parseInt(mo)-1]} ${y}`
      if (varGas>20) anomalias.push({ nivel:'warn', titulo:`Gastos subieron ${varGas}% en ${label}`, desc:`De ${fmtM(prev.gas)} a ${fmtM(v.gas)}`, accion:'Revisar qué categorías generaron el aumento.' })
      if (varIng<-10) anomalias.push({ nivel:'crit', titulo:`Ingresos cayeron ${Math.abs(varIng)}% en ${label}`, desc:`De ${fmtM(prev.ing)} a ${fmtM(v.ing)}`, accion:'Investigar la causa de la caída.' })
      if (varIng>15) anomalias.push({ nivel:'ok', titulo:`Ingresos crecieron ${varIng}% en ${label}`, desc:`De ${fmtM(prev.ing)} a ${fmtM(v.ing)}`, accion:'Identificar qué impulsó el crecimiento.' })
    })
    return anomalias.length>0?anomalias:[{ nivel:'ok', titulo:'Sin anomalías detectadas', desc:'Los datos no muestran variaciones inusuales.', accion:'Continúa monitoreando.' }]
  }

  const ing  = movimientos.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)
  const gas  = movimientos.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0)
  const util = ing-gas
  const mg   = ing>0?Math.round(util/ing*100):0
  const anomalias = getAnomalias()
  const nivelColor = (n: string) => n==='crit'?'#E24B4A':n==='warn'?'#EF9F27':'#1D9E75'
  const nivelBg    = (n: string) => n==='crit'?'rgba(226,75,74,0.16)':n==='warn'?'rgba(186,117,23,0.18)':'rgba(29,158,117,0.14)'
  const nivelTx    = (n: string) => n==='crit'?'#E24B4A':n==='warn'?'#BA7517':'#1D9E75'

  if (!authListo) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'DM Sans, sans-serif', color:'#767676' }}>
      ⏳ Verificando acceso...
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#0B0B0C', fontFamily:'DM Sans, sans-serif' }}>
      <input type="checkbox" id="sidebarToggle" className="sidebar-toggle-input no-print" />
      <label htmlFor="sidebarToggle" className="sidebar-toggle-btn no-print" aria-label="Abrir menu">☰</label>
      <label htmlFor="sidebarToggle" className="sidebar-overlay no-print"></label>
      <div className="app-sidebar" style={{ position:'fixed', top:0, left:0, width:220, height:'100vh', background:'#161616', borderRight:'1px solid rgba(255,255,255,0.08)', display:'flex', flexDirection:'column', padding:'0 12px 16px', zIndex:100, overflowY:'auto' }}>
        <div style={{ height:56, display:'flex', alignItems:'center', borderBottom:'1px solid rgba(255,255,255,0.08)', marginBottom:12, marginLeft:-12, marginRight:-12, paddingLeft:20, fontSize:15, fontWeight:600, color:'#B8912E' }}>📊 Finanzas Grupo</div>
        {NAV.map(item=>(
          <Link key={item.href} href={item.href} style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px', borderRadius:8, fontSize:13.5, color:(item as any).active?'#B8912E':'#9A9A9A', background:(item as any).active?'rgba(184,145,46,0.16)':'transparent', fontWeight:(item as any).active?500:400, textDecoration:'none', marginBottom:2 }}>
            <span style={{ fontSize:15 }}>{item.icon}</span>{item.label}
          </Link>
        ))}
        <div style={{ marginTop:'auto', paddingTop:12, borderTop:'1px solid rgba(255,255,255,0.08)' }}>
          {!esAdmin && empresasPermitidas.length>0 && <div style={{ fontSize:10, color:'#BA7517', padding:'4px 10px', background:'rgba(186,117,23,0.18)', borderRadius:6, marginBottom:6, textAlign:'center' }}>🔒 Vista restringida</div>}
          <div style={{ fontSize:11, color:'#767676', marginBottom:4, padding:'0 10px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{userEmail}</div>
          <button onClick={cerrarSesion} style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'8px 10px', borderRadius:8, fontSize:13, color:'#E24B4A', background:'transparent', border:'none', cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>🚪 Cerrar sesión</button>
        </div>
      </div>

      <div className="app-content" style={{ marginLeft:220 }}>
        <div className="app-header" style={{ height:56, background:'#161616', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 28px', position:'sticky', top:0, zIndex:50 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:15, fontWeight:600 }}>Análisis con IA</div>
            <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, fontWeight:600, background:'rgba(184,145,46,0.16)', color:'#D8B24D' }}>✨ Claude + datos reales</span>
          </div>
          {!cargando && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:'rgba(29,158,117,0.16)', color:'#1D9E75', fontWeight:500 }}>🟢 {movimientos.length} mov.</span>}
        </div>

        <div className="app-main" style={{ padding:'24px 28px' }}>
          {cargando && <div style={{ textAlign:'center', padding:'4rem', color:'#767676' }}>⏳ Cargando...</div>}
          {!cargando && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:12, marginBottom:20 }}>
                {[
                  { label:'Ingresos', value:fmtM(ing),  color:'#1D9E75', bg:'rgba(29,158,117,0.16)' },
                  { label:'Gastos',   value:fmtM(gas),  color:'#E24B4A', bg:'rgba(226,75,74,0.16)' },
                  { label:'Utilidad', value:fmtM(util), color:'#B8912E', bg:'rgba(184,145,46,0.16)' },
                  { label:'Margen',   value:mg+'%',      color:'#B8912E', bg:'rgba(184,145,46,0.16)' },
                ].map(m=>(
                  <div key={m.label} style={{ background:m.bg, borderRadius:12, padding:'12px 14px' }}>
                    <div style={{ fontSize:11, color:m.color, fontWeight:500, marginBottom:3, opacity:0.8 }}>{m.label}</div>
                    <div style={{ fontSize:20, fontWeight:700, color:m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display:'flex', gap:6, marginBottom:20 }}>
                {([{k:'chat',l:'💬 Chat'},{k:'anomalias',l:'⚠️ Anomalías'},{k:'resumen',l:'📊 Resumen'}] as const).map(t=>(
                  <button key={t.k} onClick={()=>setTab(t.k)} style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer', border:'1px solid rgba(255,255,255,0.1)', background:tab===t.k?'rgba(184,145,46,0.16)':'#161616', color:tab===t.k?'#B8912E':'#9A9A9A', fontWeight:tab===t.k?500:400 }}>{t.l}</button>
                ))}
              </div>

              {tab==='chat' && (
                <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, overflow:'hidden' }}>
                  <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', gap:6, flexWrap:'wrap' }}>
                    {['¿Cómo va el negocio?','¿Dónde reducir gastos?','¿Cuál empresa tiene mejor margen?','¿Hay riesgo de iliquidez?'].map(q=>(
                      <button key={q} onClick={()=>enviar(q)} style={{ fontSize:11, padding:'4px 10px', borderRadius:999, border:'1px solid rgba(255,255,255,0.1)', background:'#141414', color:'#C9C9C9', cursor:'pointer' }}>{q}</button>
                    ))}
                  </div>
                  <div ref={chatRef} style={{ height:360, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:12 }}>
                    {mensajes.map((m,i)=>(
                      <div key={i} style={{ maxWidth:'85%', alignSelf:m.rol==='user'?'flex-end':'flex-start' }}>
                        <div style={{ padding:'10px 14px', borderRadius:12, fontSize:13, lineHeight:1.6, background:m.rol==='user'?'#B8912E':'#1F1F1F', color:m.rol==='user'?'#fff':'#F0EFEA' }}>
                          {m.rol==='ia' && <div style={{ fontSize:10, fontWeight:600, color:'#767676', marginBottom:4 }}>🧠 Analista IA</div>}
                          {m.texto.split('\n').map((line,j)=><div key={j}>{line}</div>)}
                        </div>
                      </div>
                    ))}
                    {pensando && <div style={{ alignSelf:'flex-start' }}><div style={{ padding:'10px 14px', borderRadius:12, background:'#1F1F1F', fontSize:13, color:'#767676' }}>🧠 Analizando...</div></div>}
                  </div>
                  <div style={{ padding:'12px 16px', borderTop:'1px solid rgba(255,255,255,0.06)', display:'flex', gap:8 }}>
                    <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); enviar() } }} placeholder="Pregunta sobre tus finanzas..." disabled={pensando} style={{ flex:1, padding:'9px 12px', fontSize:13, border:'1px solid rgba(255,255,255,0.14)', borderRadius:9, background:'#161616', outline:'none', fontFamily:'DM Sans, sans-serif' }}/>
                    <button onClick={()=>enviar()} disabled={pensando||!input.trim()} style={{ padding:'9px 18px', borderRadius:9, border:'none', background:pensando||!input.trim()?'#4A4A4A':'#B8912E', color:'#fff', fontSize:13, fontWeight:600, cursor:pensando||!input.trim()?'not-allowed':'pointer' }}>Enviar</button>
                  </div>
                </div>
              )}

              {tab==='anomalias' && (
                <>
                  <div style={{ fontSize:12, color:'#9A9A9A', marginBottom:14 }}>Análisis automático de {movimientos.length} movimientos</div>
                  {anomalias.map((a,i)=>(
                    <div key={i} style={{ background:nivelBg(a.nivel), borderLeft:`3px solid ${nivelColor(a.nivel)}`, borderRadius:12, padding:'14px 16px', marginBottom:12 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                        <span style={{ fontSize:13, fontWeight:600, color:nivelTx(a.nivel) }}>{a.titulo}</span>
                        <span style={{ fontSize:10, padding:'2px 8px', borderRadius:999, fontWeight:600, background:nivelColor(a.nivel), color:'#fff' }}>{a.nivel==='crit'?'Crítico':a.nivel==='warn'?'Aviso':'OK'}</span>
                      </div>
                      <div style={{ fontSize:13, color:nivelTx(a.nivel), marginBottom:8 }}>{a.desc}</div>
                      <div style={{ fontSize:12, color:nivelTx(a.nivel), display:'flex', gap:6 }}><span>→</span><span>{a.accion}</span></div>
                    </div>
                  ))}
                </>
              )}

              {tab==='resumen' && (
                <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:24 }}>
                  <div style={{ borderBottom:'3px solid #B8912E', paddingBottom:14, marginBottom:20, display:'flex', justifyContent:'space-between' }}>
                    <div>
                      <div style={{ fontSize:18, fontWeight:700, color:'#F0EFEA' }}>Resumen ejecutivo</div>
                      <div style={{ fontSize:12, color:'#9A9A9A', marginTop:3 }}>Generado {hoy.toLocaleDateString('es-CL')}</div>
                    </div>
                    <div style={{ fontSize:20 }}>📊</div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:20 }}>
                    {[{l:'Ingresos',v:fmtCLP(ing),c:'#1D9E75'},{l:'Gastos',v:fmtCLP(gas),c:'#E24B4A'},{l:'Utilidad',v:fmtCLP(util),c:'#B8912E'},{l:'Margen',v:mg+'%',c:'#B8912E'},{l:'Empresas',v:empresas.length.toString(),c:'#B8912E'},{l:'Movimientos',v:movimientos.length.toString(),c:'#BA7517'}].map(k=>(
                      <div key={k.l} style={{ background:'#141414', border:'1px solid rgba(255,255,255,0.12)', borderRadius:8, padding:'10px', textAlign:'center' }}>
                        <div style={{ fontSize:10, color:'#9A9A9A', marginBottom:3 }}>{k.l}</div>
                        <div style={{ fontSize:16, fontWeight:700, color:k.c }}>{k.v}</div>
                      </div>
                    ))}
                  </div>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead><tr style={{ background:'#B8912E' }}>
                      {['Empresa','Ingresos','Gastos','Utilidad','Margen'].map(h=><th key={h} style={{ textAlign:'left', padding:'7px 10px', color:'#fff', fontWeight:500 }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {empresas.map((emp,i)=>{
                        const movEmp = movimientos.filter(m=>m.empresa_id===emp.id)
                        const eIng = movEmp.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0)
                        const eGas = movEmp.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+m.monto,0)
                        const eUtil = eIng-eGas
                        const eMg = eIng>0?Math.round(eUtil/eIng*100):0
                        return (
                          <tr key={emp.id} style={{ background:i%2===0?'#141414':'#161616', borderBottom:'1px solid rgba(255,255,255,0.12)' }}>
                            <td style={{ padding:'7px 10px', fontWeight:500 }}>{emp.nombre_corto}</td>
                            <td style={{ padding:'7px 10px', color:'#1D9E75', fontWeight:600 }}>{fmtM(eIng)}</td>
                            <td style={{ padding:'7px 10px', color:'#E24B4A' }}>{fmtM(eGas)}</td>
                            <td style={{ padding:'7px 10px', fontWeight:600, color:eUtil>=0?'#B8912E':'#E24B4A' }}>{fmtM(eUtil)}</td>
                            <td style={{ padding:'7px 10px', color:eMg>=30?'#1D9E75':eMg>=15?'#EF9F27':'#E24B4A', fontWeight:600 }}>{eMg}%</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
