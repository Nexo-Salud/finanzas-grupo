'use client'
import { useRouter } from 'next/navigation'
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
  { href:'/caja',         label:'Caja',         icon:'💵', active:true },
  { href:'/presupuesto',  label:'Presupuesto',  icon:'🎯' },
  { href:'/alertas',      label:'Alertas',      icon:'🔔' },
  { href:'/reportes',     label:'Reportes',     icon:'📄' },
  { href:'/estados',      label:'Est. Financ.', icon:'📑' },
  { href:'/bancos',       label:'Bancos',       icon:'🏦' },
  { href:'/tributario',   label:'Documentos',   icon:'🧾' },
  { href:'/proyecciones', label:'Proyecciones', icon:'📈' },
  { href:'/usuarios',     label:'Usuarios',     icon:'👥' },
  { href:'/asistencia',   label:'Asistencia',   icon:'🕐' },
  { href:'/kpis',         label:'KPIs',         icon:'📊' },
  { href:'/ia',           label:'Análisis IA',  icon:'🧠' },
]

type Empresa = { id: string; nombre_corto: string; color: string }
type Cuadratura = {
  id: string
  empresa_id: string
  fecha: string
  sencillo_inicial: number
  monto_esperado: number
  monto_contado: number
  responsable: string | null
  observaciones: string | null
  created_at: string
  d20000?: number | null
  d10000?: number | null
  d5000?:  number | null
  d2000?:  number | null
  d1000?:  number | null
  d500?:   number | null
  d100?:   number | null
  d50?:    number | null
  d10?:    number | null
}

const DENOMINACIONES = [20000,10000,5000,2000,1000,500,100,50,10]
const denomKey = (v:number) => 'd'+v as keyof Cuadratura

function fmtCLP(n: number) { return '$'+Math.round(n).toLocaleString('es-CL') }
function fmtM(n: number) {
  const a=Math.abs(n),s=n<0?'-':''
  if(a>=1e6) return s+'$'+(Math.round(a/1e5)/10)+'M'
  if(a>=1000) return s+'$'+Math.round(a/1000)+'K'
  return s+'$'+Math.round(a)
}
function diferenciaDe(c: Cuadratura) { return c.monto_contado - c.monto_esperado }
function diasEntre(fechaISO: string) {
  const hoy = new Date(); hoy.setHours(0,0,0,0)
  const f = new Date(fechaISO+'T00:00:00')
  return Math.round((hoy.getTime()-f.getTime())/86400000)
}

export default function CajaPage() {
  const router = useRouter()
  const [userEmail,          setUserEmail]          = useState('')
  const [empresasPermitidas, setEmpresasPermitidas] = useState<string[]>([])
  const [esAdmin,            setEsAdmin]            = useState(true)
  const [authListo,          setAuthListo]          = useState(false)

  const [empresas,     setEmpresas]     = useState<Empresa[]>([])
  const [cuadraturas,  setCuadraturas]  = useState<Cuadratura[]>([])
  const [cargando,     setCargando]     = useState(true)
  const [guardando,    setGuardando]    = useState(false)
  const [error,        setError]        = useState('')
  const [exito,        setExito]        = useState('')
  const [empresa,      setEmpresa]      = useState('all')
  const [showForm,     setShowForm]     = useState(false)

  // Form
  const [fFecha,      setFFecha]      = useState(new Date().toISOString().split('T')[0])
  const [fEmpresa,    setFEmpresa]    = useState('')
  const [fSencillo,   setFSencillo]   = useState('')
  const [fEsperado,   setFEsperado]   = useState('')
  const [fContado,    setFContado]    = useState('')
  const [fResponsable,setFResponsable]= useState('')
  const [fObs,        setFObs]        = useState('')
  const [contarDenom, setContarDenom] = useState(false)
  const [fDenom,      setFDenom]      = useState<Record<number,string>>(
    Object.fromEntries(DENOMINACIONES.map(d=>[d,'']))
  )

  async function cargarDatos(perms: string[] = []) {
    setCargando(true)
    try {
      const [{ data: emps }, { data: cuads }] = await Promise.all([
        supabase.from('empresas').select('id,nombre_corto,color').eq('activa',true).order('nombre_corto'),
        supabase.from('cuadraturas_caja').select('*').order('fecha', { ascending:false }).limit(300),
      ])
      if (emps && emps.length > 0) {
        setEmpresas(emps)
        setFEmpresa(emps[0].id)
      }
      setCuadraturas(cuads || [])
    } catch(e: any) {
      setError('Error conectando con la base de datos.')
    } finally {
      setCargando(false)
    }
  }

  function resetForm() {
    setShowForm(false)
    setFSencillo(''); setFEsperado(''); setFContado(''); setFResponsable(''); setFObs('')
    setFFecha(new Date().toISOString().split('T')[0])
    setContarDenom(false)
    setFDenom(Object.fromEntries(DENOMINACIONES.map(d=>[d,''])))
  }

  function totalDenom() {
    return DENOMINACIONES.reduce((a,d) => a + d * (parseInt(fDenom[d])||0), 0)
  }

  function setDenomCantidad(d: number, v: string) {
    const limpio = v.replace(/\D/g,'')
    const nuevo = { ...fDenom, [d]: limpio }
    setFDenom(nuevo)
    if (contarDenom) {
      const total = DENOMINACIONES.reduce((a,dd) => a + dd * (parseInt(nuevo[dd])||0), 0)
      setFContado(total ? String(total) : '')
    }
  }

  async function guardarCuadratura() {
    if (!fEmpresa || !fEsperado || !fContado) {
      setError('Completa empresa, monto esperado y monto contado.')
      return
    }
    setGuardando(true)
    setError('')
    const data: any = {
      empresa_id:       fEmpresa,
      fecha:            fFecha,
      sencillo_inicial: parseFloat(fSencillo) || 0,
      monto_esperado:   parseFloat(fEsperado) || 0,
      monto_contado:    parseFloat(fContado) || 0,
      responsable:      fResponsable || null,
      observaciones:    fObs || null,
    }
    if (contarDenom) {
      DENOMINACIONES.forEach(d => { data['d'+d] = parseInt(fDenom[d]) || 0 })
    }
    try {
      const { error: err } = await supabase.from('cuadraturas_caja').insert(data)
      if (err) throw err
      await cargarDatos()
      resetForm()
      const dif = data.monto_contado - data.monto_esperado
      setExito(dif===0 ? '✅ Caja cuadrada, sin diferencias.' : dif>0 ? `✅ Guardado — sobrante de ${fmtCLP(dif)}` : `✅ Guardado — faltante de ${fmtCLP(Math.abs(dif))}`)
      setTimeout(()=>setExito(''), 5000)
    } catch(e: any) {
      setError('Error guardando: ' + e.message)
    } finally {
      setGuardando(false)
    }
  }

  async function eliminarCuadratura(id: string) {
    try {
      await supabase.from('cuadraturas_caja').delete().eq('id', id)
      setCuadraturas(prev => prev.filter(c => c.id !== id))
    } catch(e: any) {
      setError('Error eliminando registro.')
    }
  }

  const empNombre = (id: string) => empresas.find(e=>e.id===id)?.nombre_corto || id
  const scope = cuadraturas.filter(c => empresa==='all' || c.empresa_id===empresa)

  const hoy = new Date()
  const scopeMes = scope.filter(c => { const [y,m] = c.fecha.split('-'); return parseInt(y)===hoy.getFullYear() && parseInt(m)===hoy.getMonth()+1 })
  const diferenciasMes = scopeMes.map(diferenciaDe)
  const conDiferencia   = diferenciasMes.filter(d => d!==0).length
  const acumMes         = diferenciasMes.reduce((a,b)=>a+b,0)
  const ultima          = scope[0]
  const diasUltima      = ultima ? diasEntre(ultima.fecha) : null
  const atrasada        = diasUltima !== null && diasUltima > 4
  const ultimaConDenom  = scope.find(c => DENOMINACIONES.some(d => Number((c as any)[denomKey(d)]) > 0))
  const nivelDenom = (cant: number) => cant<=2 ? 'crit' : cant<=5 ? 'warn' : 'ok'
  const colorDenom = (n: string) => n==='crit'?'#E24B4A':n==='warn'?'#EF9F27':'#1D9E75'
  const bgDenom     = (n: string) => n==='crit'?'rgba(226,75,74,0.16)':n==='warn'?'rgba(186,117,23,0.18)':'rgba(29,158,117,0.14)'

  function renderFormulario() {
    if (!showForm) return null
    const prevEsperado = parseFloat(fEsperado)||0
    const prevContado  = parseFloat(fContado)||0
    const prevDif = prevContado - prevEsperado
    return (
      <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:20, marginBottom:14 }}>
        <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>Nueva cuadratura de caja</div>
        <div style={{ fontSize:12, color:'#9A9A9A', marginBottom:14, background:'rgba(184,145,46,0.16)', padding:'8px 12px', borderRadius:8 }}>
          💡 "Esperado" = sencillo inicial + ventas en efectivo del período que estás cuadrando.
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
          <div><label style={lbl}>Fecha</label>
            <input type="date" value={fFecha} onChange={e=>setFFecha(e.target.value)} style={inp}/>
          </div>
          <div><label style={lbl}>Empresa / sucursal</label>
            <select value={fEmpresa} onChange={e=>setFEmpresa(e.target.value)} style={inp}>
              {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre_corto}</option>)}
            </select>
          </div>
          <div><label style={lbl}>Sencillo inicial</label>
            <input type="number" value={fSencillo} onChange={e=>setFSencillo(e.target.value)} placeholder="0" style={inp}/>
          </div>
          <div><label style={lbl}>Responsable</label>
            <input value={fResponsable} onChange={e=>setFResponsable(e.target.value)} placeholder="Nombre de quien cuadra" style={inp}/>
          </div>
          <div><label style={lbl}>Monto esperado</label>
            <input type="number" value={fEsperado} onChange={e=>setFEsperado(e.target.value)} placeholder="0" style={inp}/>
          </div>
          <div><label style={lbl}>Monto contado</label>
            <input type="number" value={fContado} onChange={e=>setFContado(e.target.value)} placeholder="0" style={inp} disabled={contarDenom} />
          </div>
        </div>

        <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12.5, color:'#C9C9C9', marginBottom:12, cursor:'pointer' }}>
          <input type="checkbox" checked={contarDenom} onChange={e=>{ const on=e.target.checked; setContarDenom(on); setFContado(on?String(totalDenom()):'') }} />
          🧮 Contar el sencillo billete por billete (además arma el "Monto contado" solo)
        </label>

        {contarDenom && (
          <div style={{ background:'#141414', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:14, marginBottom:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:10 }}>
              {DENOMINACIONES.map(d=>{
                const cant = parseInt(fDenom[d])||0
                return (
                  <div key={d}>
                    <label style={lbl}>{d>=1000 ? `Billete ${fmtCLP(d)}` : `Moneda ${fmtCLP(d)}`}</label>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <input type="number" min={0} value={fDenom[d]} onChange={e=>setDenomCantidad(d, e.target.value)} placeholder="0" style={{...inp, width:70}}/>
                      <span style={{ fontSize:11, color:'#767676', whiteSpace:'nowrap' as const }}>× {fmtCLP(d)} = {fmtCLP(cant*d)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop:12, paddingTop:10, borderTop:'1px solid rgba(255,255,255,0.08)', display:'flex', justifyContent:'space-between', fontSize:13 }}>
              <span style={{ color:'#9A9A9A' }}>Total contado</span>
              <strong style={{ color:'#D8B24D' }}>{fmtCLP(totalDenom())}</strong>
            </div>
          </div>
        )}

        {(fEsperado || fContado) && (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background: prevDif===0?'rgba(29,158,117,0.16)':prevDif>0?'rgba(184,145,46,0.16)':'rgba(226,75,74,0.16)', borderRadius:8, padding:'8px 12px', marginBottom:12, fontSize:13 }}>
            <span style={{ color:'#C9C9C9' }}>Diferencia</span>
            <strong style={{ color: prevDif===0?'#1D9E75':prevDif>0?'#D8B24D':'#E24B4A' }}>
              {prevDif===0 ? 'Cuadrada' : prevDif>0 ? `Sobrante ${fmtCLP(prevDif)}` : `Faltante ${fmtCLP(Math.abs(prevDif))}`}
            </strong>
          </div>
        )}
        <div style={{ marginBottom:12 }}>
          <label style={lbl}>Observaciones</label>
          <input value={fObs} onChange={e=>setFObs(e.target.value)} placeholder="Opcional" style={inp}/>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={guardarCuadratura} disabled={guardando} style={{ ...btnP, flex:1, justifyContent:'center', opacity:guardando?0.7:1 }}>
            {guardando ? 'Guardando...' : '💾 Guardar cuadratura'}
          </button>
          <button onClick={resetForm} style={{ ...btnSec, width:'auto', padding:'8px 16px' }}>Cancelar</button>
        </div>
      </div>
    )
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      const email = session.user.email || ''
      setUserEmail(email)
      const { data: perfil } = await supabase
        .from('usuarios_plataforma')
        .select('rol, empresas_permitidas')
        .eq('email', email)
        .single()
      let perms: string[] = []
      if (perfil && perfil.rol !== 'admin' && perfil.empresas_permitidas?.length > 0) {
        perms = perfil.empresas_permitidas
        setEsAdmin(false)
        setEmpresasPermitidas(perms)
      } else {
        setEsAdmin(true)
        setEmpresasPermitidas([])
      }
      setAuthListo(true)
      await cargarDatos(perms)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.push('/login')
    })
    return () => subscription.unsubscribe()
  }, [])

  async function cerrarSesion() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!authListo) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'DM Sans, sans-serif', color:'#767676' }}>
      ⏳ Verificando acceso...
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#0B0B0C', fontFamily:'DM Sans, sans-serif' }}>
      {/* Sidebar */}
      <input type="checkbox" id="sidebarToggle" className="sidebar-toggle-input no-print" />
      <label htmlFor="sidebarToggle" className="sidebar-toggle-btn no-print" aria-label="Abrir menu">☰</label>
      <label htmlFor="sidebarToggle" className="sidebar-overlay no-print"></label>
      <div className="app-sidebar" style={{ position:'fixed', top:0, left:0, width:220, height:'100vh', background:'#161616', borderRight:'1px solid rgba(255,255,255,0.08)', display:'flex', flexDirection:'column', padding:'0 12px 16px', zIndex:100, overflowY:'auto' }}>
        <div style={{ height:56, display:'flex', alignItems:'center', borderBottom:'1px solid rgba(255,255,255,0.08)', marginBottom:12, marginLeft:-12, marginRight:-12, paddingLeft:20, fontSize:15, fontWeight:600, color:'#B8912E' }}>
          📊 Finanzas Grupo
        </div>
        {NAV.map(item=>(
          <Link key={item.href} href={item.href} style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px', borderRadius:8, fontSize:13.5, color:(item as any).active?'#B8912E':'#9A9A9A', background:(item as any).active?'rgba(184,145,46,0.16)':'transparent', fontWeight:(item as any).active?500:400, textDecoration:'none', marginBottom:2 }}>
            <span style={{ fontSize:15 }}>{item.icon}</span>{item.label}
          </Link>
        ))}

        <div style={{ marginTop:'auto', paddingTop:12, borderTop:'1px solid rgba(255,255,255,0.08)' }}>
          {!esAdmin && empresasPermitidas.length > 0 && (
            <div style={{ fontSize:10, color:'#BA7517', padding:'4px 10px', background:'rgba(186,117,23,0.18)', borderRadius:6, marginBottom:6, textAlign:'center' }}>
              🔒 Vista restringida
            </div>
          )}
          <div style={{ fontSize:11, color:'#767676', marginBottom:4, padding:'0 10px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>
            {userEmail}
          </div>
          <button onClick={cerrarSesion} style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'8px 10px', borderRadius:8, fontSize:13, color:'#E24B4A', background:'transparent', border:'none', cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
            🚪 Cerrar sesión
          </button>
        </div>
      </div>

      <div className="app-content" style={{ marginLeft:220 }}>
        {/* Header */}
        <div className="app-header" style={{ height:56, background:'#161616', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 28px', position:'sticky', top:0, zIndex:50 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:15, fontWeight:600 }}>Cuadratura de caja</div>
            {!cargando && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:'rgba(29,158,117,0.16)', color:'#1D9E75', fontWeight:500 }}>🟢 Supabase</span>}
          </div>
          <select value={empresa} onChange={e=>setEmpresa(e.target.value)} style={sel}>
            <option value="all">Todas las empresas</option>
            {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre_corto}</option>)}
          </select>
        </div>

        <div className="app-main" style={{ padding:'24px 28px' }}>

          {/* Mensajes */}
          {error && (
            <div style={{ background:'rgba(226,75,74,0.16)', border:'1px solid rgba(226,75,74,0.22)', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#E24B4A', marginBottom:16, display:'flex', justifyContent:'space-between' }}>
              <span>⚠️ {error}</span>
              <button onClick={()=>setError('')} style={{ background:'transparent', border:'none', cursor:'pointer', color:'#E24B4A' }}>✕</button>
            </div>
          )}
          {exito && (
            <div style={{ background:'rgba(29,158,117,0.14)', border:'1px solid rgba(29,158,117,0.4)', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#1D9E75', marginBottom:16 }}>
              {exito}
            </div>
          )}

          {/* Aviso de cadencia */}
          {!cargando && (
            <div style={{ background: atrasada ? 'rgba(226,75,74,0.16)' : 'rgba(29,158,117,0.14)', border: atrasada ? '1px solid rgba(226,75,74,0.22)' : '1px solid rgba(29,158,117,0.4)', borderRadius:10, padding:'10px 16px', marginBottom:20, fontSize:13, color: atrasada ? '#E24B4A' : '#1D9E75', display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:16 }}>{atrasada ? '⏰' : '✅'}</span>
              {ultima
                ? <span>Última cuadratura: <strong>{ultima.fecha}</strong> ({diasUltima} día{diasUltima===1?'':'s'} atrás){atrasada ? ' — ya te pasaste de los 3-4 días recomendados para cuadrar 2 veces por semana' : ''}</span>
                : <span>Aún no registras ninguna cuadratura. La meta es hacerlo 2 veces por semana.</span>
              }
            </div>
          )}

          {/* Métricas */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:24 }}>
            {[
              { label:'Cuadraturas del mes', value:scopeMes.length, sub:'registradas', color:'#B8912E', bg:'rgba(184,145,46,0.16)' },
              { label:'Con diferencia',      value:conDiferencia,   sub:`de ${scopeMes.length} este mes`, color:conDiferencia>0?'#E24B4A':'#1D9E75', bg:conDiferencia>0?'rgba(226,75,74,0.16)':'rgba(29,158,117,0.16)' },
              { label:'Diferencia acumulada',value:fmtM(acumMes),   sub:acumMes>=0?'sobrante neto':'faltante neto', color:acumMes<0?'#E24B4A':acumMes>0?'#D8B24D':'#1D9E75', bg:acumMes<0?'rgba(226,75,74,0.16)':acumMes>0?'rgba(184,145,46,0.16)':'rgba(29,158,117,0.16)' },
              { label:'Última cuadratura',   value:ultima?`${diasUltima}d`:'—', sub:ultima?ultima.fecha:'sin registros', color:atrasada?'#E24B4A':'#1D9E75', bg:atrasada?'rgba(226,75,74,0.16)':'rgba(29,158,117,0.16)' },
            ].map(m=>(
              <div key={m.label} style={{ background:m.bg, borderRadius:12, padding:'14px 16px' }}>
                <div style={{ fontSize:11, color:m.color, fontWeight:500, marginBottom:4, opacity:0.8 }}>{m.label}</div>
                <div style={{ fontSize:20, fontWeight:700, color:m.color }}>{m.value}</div>
                <div style={{ fontSize:11, color:m.color, opacity:0.7, marginTop:2 }}>{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Estado del sencillo por denominación */}
          {!cargando && ultimaConDenom && (
            <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:20, marginBottom:20 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                <div style={{ fontSize:14, fontWeight:600 }}>💰 Estado del sencillo por denominación</div>
                <span style={{ fontSize:11, color:'#767676' }}>Último conteo: {ultimaConDenom.fecha}{empresa==='all' ? ' · '+empNombre(ultimaConDenom.empresa_id) : ''}</span>
              </div>
              <div style={{ fontSize:12, color:'#9A9A9A', marginBottom:14 }}>Así sabes con qué billetes/monedas te estás quedando corto para dar vuelto.</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))', gap:10 }}>
                {DENOMINACIONES.map(d=>{
                  const cant = Number((ultimaConDenom as any)[denomKey(d)]) || 0
                  const nivel = nivelDenom(cant)
                  return (
                    <div key={d} style={{ background:bgDenom(nivel), borderRadius:10, padding:'10px 12px', textAlign:'center' }}>
                      <div style={{ fontSize:11, color:colorDenom(nivel), opacity:0.85, marginBottom:2 }}>{d>=1000?'Billete':'Moneda'} {fmtCLP(d)}</div>
                      <div style={{ fontSize:20, fontWeight:700, color:colorDenom(nivel) }}>{cant}</div>
                      <div style={{ fontSize:10, color:colorDenom(nivel), opacity:0.8 }}>{nivel==='crit'?'⚠️ casi sin stock':nivel==='warn'?'bajo, considera sencillar':'ok'}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {renderFormulario()}

          <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:'4px 20px', marginBottom:12 }}>
            {scope.length===0 && (
              <div style={{ textAlign:'center', padding:'2rem', color:'#767676', fontSize:14 }}>
                {cargando ? '⏳ Cargando...' : '📭 Sin cuadraturas registradas — agrega la primera'}
              </div>
            )}
            {scope.map((c,i)=>{
              const dif = diferenciaDe(c)
              const difColor = dif===0 ? '#1D9E75' : dif>0 ? '#D8B24D' : '#E24B4A'
              const difLabel = dif===0 ? 'Cuadrada' : dif>0 ? `Sobrante ${fmtCLP(dif)}` : `Faltante ${fmtCLP(Math.abs(dif))}`
              return (
                <div key={c.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 0', borderBottom:i<scope.length-1?'1px solid rgba(255,255,255,0.06)':'none', flexWrap:'wrap', gap:8 }}>
                  <div style={{ flex:1, minWidth:180 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3, flexWrap:'wrap' }}>
                      <span style={{ fontSize:13, fontWeight:600, color:'#F0EFEA' }}>{c.fecha}</span>
                      <span style={{ fontSize:11, color:'#767676' }}>{empNombre(c.empresa_id)}</span>
                      {c.responsable && <span style={{ fontSize:11, color:'#767676' }}>· {c.responsable}</span>}
                    </div>
                    <div style={{ fontSize:12, color:'#9A9A9A' }}>Esperado: {fmtCLP(c.monto_esperado)} · Contado: {fmtCLP(c.monto_contado)} · Sencillo: {fmtCLP(c.sencillo_inicial)}</div>
                    {c.observaciones && <div style={{ fontSize:11, color:'#767676', marginTop:1 }}>{c.observaciones}</div>}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, fontWeight:600, background: dif===0?'rgba(29,158,117,0.16)':dif>0?'rgba(184,145,46,0.16)':'rgba(226,75,74,0.16)', color:difColor }}>{difLabel}</span>
                    <button onClick={()=>eliminarCuadratura(c.id)} style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:14, color:'#767676', padding:4 }}>🗑️</button>
                  </div>
                </div>
              )
            })}
          </div>

          {!showForm && (
            <button onClick={()=>setShowForm(true)} style={{ ...btnP, width:'100%', justifyContent:'center' }}>
              + Nueva cuadratura
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const sel: React.CSSProperties    = { fontSize:13, padding:'6px 10px', border:'1px solid rgba(255,255,255,0.14)', borderRadius:8, background:'#161616' }
const btnP: React.CSSProperties   = { display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, border:'none', background:'#B8912E', color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer' }
const btnSec: React.CSSProperties = { display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'7px 14px', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', border:'1px solid rgba(255,255,255,0.14)', background:'#161616', color:'#C9C9C9', width:'100%' }
const lbl: React.CSSProperties    = { display:'block', fontSize:12, fontWeight:500, color:'#9A9A9A', marginBottom:4 }
const inp: React.CSSProperties    = { width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid rgba(255,255,255,0.16)', borderRadius:8, background:'#161616', color:'#F0EFEA', fontFamily:'DM Sans, sans-serif' }
