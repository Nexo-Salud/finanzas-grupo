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
  { href:'/caja',         label:'Caja',         icon:'💵' },
  { href:'/presupuesto',  label:'Presupuesto',  icon:'🎯' },
  { href:'/alertas',      label:'Alertas',      icon:'🔔' },
  { href:'/reportes',     label:'Reportes',     icon:'📄' },
  { href:'/estados',      label:'Est. Financ.', icon:'📑' },
  { href:'/bancos',       label:'Bancos',       icon:'🏦' },
  { href:'/tributario',   label:'Documentos',   icon:'🧾' },
  { href:'/proyecciones', label:'Proyecciones', icon:'📈' },
  { href:'/usuarios',     label:'Usuarios',     icon:'👥' },
  { href:'/asistencia',   label:'Asistencia',   icon:'🕐', active:true },
  { href:'/kpis',         label:'KPIs',         icon:'📊' },
  { href:'/ia',           label:'Análisis IA',  icon:'🧠' },
]

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

type Empresa  = { id: string; nombre_corto: string; color: string }
type Empleada = { id: string; empresa_id: string; nombre: string; valor_hora: number; pin: string; activa: boolean }
type Registro = { id: string; empleada_id: string; empresa_id: string; fecha: string; hora_entrada: string; hora_salida: string | null; horas_trabajadas: number | null; valor_hora: number; monto_calculado: number | null; colacion_minutos?: number | null }
type Cierre   = { id: string; empresa_id: string; empleada_id: string; anio: number; mes: number; total_horas: number; total_pagar: number; pagado: boolean; fecha_pago: string | null }

function fmtCLP(n: number) { return '$'+Math.round(n).toLocaleString('es-CL') }
function fmtHoras(n: number) { return n.toFixed(1)+' h' }
function fmtHora(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' })
}

export default function AsistenciaPage() {
  const router = useRouter()
  const [userEmail,          setUserEmail]          = useState('')
  const [empresasPermitidas, setEmpresasPermitidas] = useState<string[]>([])
  const [esAdmin,            setEsAdmin]            = useState(true)
  const [authListo,          setAuthListo]          = useState(false)

  const [empresas,    setEmpresas]    = useState<Empresa[]>([])
  const [empleadas,   setEmpleadas]   = useState<Empleada[]>([])
  const [registros,   setRegistros]   = useState<Registro[]>([])
  const [cierres,     setCierres]     = useState<Cierre[]>([])
  const [cargando,    setCargando]    = useState(true)
  const [guardando,   setGuardando]   = useState(false)
  const [error,       setError]       = useState('')
  const [exito,       setExito]       = useState('')
  const [empresa,     setEmpresa]     = useState('all')
  const [tab,         setTab]         = useState<'cierre'|'registros'|'trabajadoras'>('cierre')
  const [showForm,    setShowForm]    = useState(false)
  const [editId,      setEditId]      = useState<string | null>(null)

  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes,  setMes]  = useState(hoy.getMonth() + 1)

  // Form trabajadora
  const [fNombre,   setFNombre]   = useState('')
  const [fEmpresaF, setFEmpresaF] = useState('')
  const [fValorHora,setFValorHora]= useState('')
  const [fPin,      setFPin]      = useState('')

  // Form registro manual (libro de asistencia)
  const [showRegForm, setShowRegForm] = useState(false)
  const [regEditId,   setRegEditId]   = useState<string | null>(null)
  const [rEmpleada,   setREmpleada]   = useState('')
  const [rFecha,      setRFecha]      = useState(new Date().toISOString().split('T')[0])
  const [rEntrada,    setREntrada]    = useState('09:00')
  const [rSalida,     setRSalida]     = useState('')
  const [rColacion,   setRColacion]   = useState('0')

  const [expandido, setExpandido] = useState<string | null>(null)

  async function cargarDatos(perms: string[] = []) {
    setCargando(true)
    try {
      const [{ data: emps }, { data: empls }, { data: regs }, { data: cies }] = await Promise.all([
        supabase.from('empresas').select('id,nombre_corto,color').eq('activa',true).order('nombre_corto'),
        supabase.from('empleadas_hora').select('*').order('nombre'),
        supabase.from('registros_asistencia').select('*').order('fecha', { ascending:false }).limit(1000),
        supabase.from('cierres_horas').select('*'),
      ])
      if (emps && emps.length > 0) { setEmpresas(emps); setFEmpresaF(emps[0].id) }
      setEmpleadas(empls || [])
      setRegistros(regs || [])
      setCierres(cies || [])
    } catch(e: any) {
      setError('Error conectando con la base de datos.')
    } finally {
      setCargando(false)
    }
  }

  function resetForm() {
    setShowForm(false); setEditId(null)
    setFNombre(''); setFValorHora(''); setFPin('')
  }

  function abrirEditar(emp: Empleada) {
    setEditId(emp.id)
    setFNombre(emp.nombre)
    setFEmpresaF(emp.empresa_id)
    setFValorHora(String(emp.valor_hora))
    setFPin(emp.pin)
    setShowForm(true)
  }

  async function guardarEmpleada() {
    if (!fNombre || !fEmpresaF || !fValorHora || !fPin) {
      setError('Completa nombre, empresa, valor hora y PIN.')
      return
    }
    if (!/^\d{4}$/.test(fPin)) {
      setError('El PIN debe ser de 4 dígitos.')
      return
    }
    setGuardando(true)
    setError('')
    const data = {
      nombre:     fNombre,
      empresa_id: fEmpresaF,
      valor_hora: parseFloat(fValorHora) || 0,
      pin:        fPin,
    }
    try {
      if (editId) {
        const { error: err } = await supabase.from('empleadas_hora').update(data).eq('id', editId)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('empleadas_hora').insert({ ...data, activa:true })
        if (err) throw err
      }
      await cargarDatos()
      resetForm()
      setExito('✅ Trabajadora guardada.')
      setTimeout(()=>setExito(''), 4000)
    } catch(e: any) {
      setError('Error guardando: ' + e.message)
    } finally {
      setGuardando(false)
    }
  }

  async function toggleActiva(id: string, activaActual: boolean) {
    try {
      await supabase.from('empleadas_hora').update({ activa: !activaActual }).eq('id', id)
      setEmpleadas(prev => prev.map(e => e.id===id ? {...e, activa:!activaActual} : e))
    } catch(e: any) {
      setError('Error actualizando estado.')
    }
  }

  async function eliminarEmpleada(id: string) {
    try {
      await supabase.from('empleadas_hora').delete().eq('id', id)
      setEmpleadas(prev => prev.filter(e => e.id !== id))
    } catch(e: any) {
      setError('Error eliminando — puede que tenga registros de asistencia asociados.')
    }
  }

  function resetRegForm() {
    setShowRegForm(false); setRegEditId(null)
    setREmpleada(scopeEmpleadas[0]?.id || empleadas[0]?.id || '')
    setRFecha(new Date().toISOString().split('T')[0])
    setREntrada('09:00'); setRSalida(''); setRColacion('0')
  }

  function abrirEditarRegistro(r: Registro) {
    setRegEditId(r.id)
    setREmpleada(r.empleada_id)
    setRFecha(r.fecha)
    setREntrada(new Date(r.hora_entrada).toTimeString().slice(0,5))
    setRSalida(r.hora_salida ? new Date(r.hora_salida).toTimeString().slice(0,5) : '')
    setRColacion(String(r.colacion_minutos || 0))
    setShowRegForm(true)
  }

  async function guardarRegistro() {
    if (!rEmpleada || !rFecha || !rEntrada) {
      setError('Completa trabajadora, fecha y hora de entrada.')
      return
    }
    const emp = empleadas.find(e => e.id === rEmpleada)
    if (!emp) { setError('Selecciona una trabajadora válida.'); return }
    const entradaDate = new Date(`${rFecha}T${rEntrada}:00`)
    const salidaDate  = rSalida ? new Date(`${rFecha}T${rSalida}:00`) : null
    if (salidaDate && salidaDate <= entradaDate) {
      setError('La hora de salida debe ser posterior a la de entrada.')
      return
    }
    const colacionMin = parseInt(rColacion) || 0
    const horas = salidaDate ? Math.max(0, (salidaDate.getTime() - entradaDate.getTime()) / 3600000 - colacionMin/60) : null
    const monto = horas != null ? Math.round(horas * emp.valor_hora) : null
    setGuardando(true)
    setError('')
    const data = {
      empleada_id:       rEmpleada,
      empresa_id:        emp.empresa_id,
      fecha:              rFecha,
      hora_entrada:       entradaDate.toISOString(),
      hora_salida:        salidaDate ? salidaDate.toISOString() : null,
      horas_trabajadas:   horas,
      valor_hora:         emp.valor_hora,
      monto_calculado:    monto,
      colacion_minutos:   colacionMin,
    }
    try {
      if (regEditId) {
        const { error: err } = await supabase.from('registros_asistencia').update(data).eq('id', regEditId)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('registros_asistencia').insert(data)
        if (err) throw err
      }
      await cargarDatos()
      resetRegForm()
      setExito('✅ Registro guardado.')
      setTimeout(()=>setExito(''), 4000)
    } catch(e: any) {
      setError('Error guardando: ' + e.message)
    } finally {
      setGuardando(false)
    }
  }

  async function eliminarRegistro(id: string) {
    try {
      await supabase.from('registros_asistencia').delete().eq('id', id)
      setRegistros(prev => prev.filter(r => r.id !== id))
    } catch(e: any) {
      setError('Error eliminando registro.')
    }
  }

  const empNombre = (id: string) => empresas.find(e=>e.id===id)?.nombre_corto || id
  const empleadaNombre = (id: string) => empleadas.find(e=>e.id===id)?.nombre || '—'

  const scopeEmpleadas = empleadas.filter(e => empresa==='all' || e.empresa_id===empresa)
  const scopeRegistros = registros.filter(r => empresa==='all' || r.empresa_id===empresa)

  const registrosMes = scopeRegistros.filter(r => { const [y,m] = r.fecha.split('-'); return parseInt(y)===anio && parseInt(m)===mes })
  const abiertos = scopeRegistros.filter(r => !r.hora_salida)

  const resumenMes = scopeEmpleadas.map(emp => {
    const regs = registrosMes.filter(r => r.empleada_id===emp.id && r.hora_salida)
    const totalHoras = regs.reduce((a,r)=>a+(r.horas_trabajadas||0), 0)
    const totalPagar = regs.reduce((a,r)=>a+(r.monto_calculado||0), 0)
    const cierre = cierres.find(c => c.empleada_id===emp.id && c.anio===anio && c.mes===mes)
    return { emp, totalHoras, totalPagar, cierre, turnos: regs.length }
  })

  const totalHorasMes = resumenMes.reduce((a,r)=>a+r.totalHoras, 0)
  const totalPagarMes = resumenMes.reduce((a,r)=>a+r.totalPagar, 0)
  const pendientesPago = resumenMes.filter(r => r.totalHoras>0 && !r.cierre?.pagado).length

  async function marcarPagado(emp: Empleada, totalHoras: number, totalPagar: number, cierreExistente?: Cierre) {
    try {
      if (cierreExistente) {
        await supabase.from('cierres_horas').update({ pagado: true, fecha_pago: new Date().toISOString().split('T')[0], total_horas: totalHoras, total_pagar: totalPagar }).eq('id', cierreExistente.id)
      } else {
        await supabase.from('cierres_horas').insert({
          empresa_id: emp.empresa_id, empleada_id: emp.id, anio, mes,
          total_horas: totalHoras, total_pagar: totalPagar,
          pagado: true, fecha_pago: new Date().toISOString().split('T')[0],
        })
      }
      await cargarDatos()
      setExito(`✅ Marcado como pagado: ${emp.nombre}`)
      setTimeout(()=>setExito(''), 4000)
    } catch(e: any) {
      setError('Error marcando como pagado: ' + e.message)
    }
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
          <Link href="/asistencia/marcar" target="_blank" style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8, fontSize:12, color:'#D8B24D', background:'rgba(184,145,46,0.16)', textDecoration:'none', marginBottom:8, justifyContent:'center' }}>
            🕐 Abrir kiosco de marcaje
          </Link>
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
            <div style={{ fontSize:15, fontWeight:600 }}>Asistencia y horas</div>
            {!cargando && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:'rgba(29,158,117,0.16)', color:'#1D9E75', fontWeight:500 }}>🟢 Supabase</span>}
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <select value={empresa} onChange={e=>setEmpresa(e.target.value)} style={sel}>
              <option value="all">Todas las empresas</option>
              {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre_corto}</option>)}
            </select>
            {tab==='cierre' && (
              <>
                <select value={mes} onChange={e=>setMes(parseInt(e.target.value))} style={sel}>
                  {MESES.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
                </select>
                <select value={anio} onChange={e=>setAnio(parseInt(e.target.value))} style={sel}>
                  {[2024,2025,2026,2027].map(a=><option key={a}>{a}</option>)}
                </select>
              </>
            )}
          </div>
        </div>

        <div className="app-main" style={{ padding:'24px 28px' }}>

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

          {abiertos.length>0 && (
            <div style={{ background:'rgba(184,145,46,0.16)', border:'1px solid rgba(184,145,46,0.4)', borderRadius:10, padding:'10px 16px', marginBottom:20, fontSize:13, color:'#D8B24D' }}>
              🕐 {abiertos.length} turno(s) abierto(s) ahora mismo: {abiertos.map(r=>empleadaNombre(r.empleada_id)).join(', ')}
            </div>
          )}

          {/* Métricas del mes */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:24 }}>
            {[
              { label:'Horas del mes',      value:fmtHoras(totalHorasMes), sub:MESES[mes-1]+' '+anio, color:'#B8912E', bg:'rgba(184,145,46,0.16)' },
              { label:'Total a pagar',      value:fmtCLP(totalPagarMes),   sub:`${scopeEmpleadas.length} trabajadora(s)`, color:'#D8B24D', bg:'rgba(184,145,46,0.16)' },
              { label:'Pendientes de pago', value:pendientesPago,          sub:pendientesPago>0?'requieren cierre':'todo al día', color:pendientesPago>0?'#E24B4A':'#1D9E75', bg:pendientesPago>0?'rgba(226,75,74,0.16)':'rgba(29,158,117,0.16)' },
              { label:'Trabajadoras activas', value:empleadas.filter(e=>e.activa).length, sub:'registradas', color:'#1D9E75', bg:'rgba(29,158,117,0.16)' },
            ].map(m=>(
              <div key={m.label} style={{ background:m.bg, borderRadius:12, padding:'14px 16px' }}>
                <div style={{ fontSize:11, color:m.color, fontWeight:500, marginBottom:4, opacity:0.8 }}>{m.label}</div>
                <div style={{ fontSize:20, fontWeight:700, color:m.color }}>{m.value}</div>
                <div style={{ fontSize:11, color:m.color, opacity:0.7, marginTop:2 }}>{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap' }}>
            {([
              {k:'cierre',       l:'📅 Cierre de mes'},
              {k:'registros',    l:'🕐 Registros'},
              {k:'trabajadoras', l:'👥 Trabajadoras'},
            ] as const).map(t=>(
              <button key={t.k} onClick={()=>{ setTab(t.k); setShowForm(false) }} style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer', border:'1px solid rgba(255,255,255,0.1)', background:tab===t.k?'rgba(184,145,46,0.16)':'#161616', color:tab===t.k?'#B8912E':'#9A9A9A', fontWeight:tab===t.k?500:400 }}>
                {t.l}
              </button>
            ))}
          </div>

          {/* ── CIERRE DE MES ── */}
          {tab==='cierre' && (
            <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:'4px 20px' }}>
              {resumenMes.length===0 && (
                <div style={{ textAlign:'center', padding:'2rem', color:'#767676', fontSize:14 }}>
                  {cargando ? '⏳ Cargando...' : '📭 No hay trabajadoras registradas para esta empresa'}
                </div>
              )}
              {resumenMes.map((r,i)=>{
                const abierto = expandido === r.emp.id
                const regsDia = registrosMes.filter(x => x.empleada_id === r.emp.id).sort((a,b)=>a.fecha.localeCompare(b.fecha))
                return (
                <div key={r.emp.id} style={{ borderBottom:i<resumenMes.length-1?'1px solid rgba(255,255,255,0.06)':'none' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', flexWrap:'wrap', gap:10 }}>
                    <div
                      style={{ flex:1, minWidth:160, cursor:regsDia.length>0?'pointer':'default' }}
                      onClick={()=>regsDia.length>0 && setExpandido(abierto ? null : r.emp.id)}
                    >
                      <div style={{ fontSize:13, fontWeight:600, color:'#F0EFEA', display:'flex', alignItems:'center', gap:6 }}>
                        {regsDia.length>0 && <span style={{ fontSize:10, color:'#767676' }}>{abierto?'▾':'▸'}</span>}
                        {r.emp.nombre}
                      </div>
                      <div style={{ fontSize:12, color:'#9A9A9A' }}>{empNombre(r.emp.empresa_id)} · {fmtCLP(r.emp.valor_hora)}/hora · {r.turnos} turno(s) {regsDia.length>0 && '· ver detalle por día'}</div>
                    </div>
                    <div style={{ textAlign:'right', minWidth:100 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'#F0EFEA' }}>{fmtHoras(r.totalHoras)}</div>
                      <div style={{ fontSize:12, color:'#D8B24D' }}>{fmtCLP(r.totalPagar)}</div>
                    </div>
                    {r.cierre?.pagado ? (
                      <span style={{ fontSize:11, padding:'4px 10px', borderRadius:999, fontWeight:600, background:'rgba(29,158,117,0.16)', color:'#1D9E75' }}>✅ Pagado {r.cierre.fecha_pago}</span>
                    ) : (
                      <button
                        onClick={()=>marcarPagado(r.emp, r.totalHoras, r.totalPagar, r.cierre)}
                        disabled={r.totalHoras===0}
                        style={{ fontSize:12, padding:'6px 12px', borderRadius:8, fontWeight:500, cursor:r.totalHoras===0?'not-allowed':'pointer', border:'none', background:r.totalHoras===0?'#1F1F1F':'#B8912E', color:r.totalHoras===0?'#767676':'#fff' }}
                      >
                        Marcar pagado
                      </button>
                    )}
                  </div>
                  {abierto && regsDia.length>0 && (
                    <div style={{ background:'#141414', borderRadius:10, padding:'6px 14px', marginBottom:12 }}>
                      {regsDia.map((d,j)=>(
                        <div key={d.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:j<regsDia.length-1?'1px solid rgba(255,255,255,0.06)':'none', flexWrap:'wrap', gap:8, fontSize:12 }}>
                          <span style={{ color:'#C9C9C9' }}>{d.fecha}</span>
                          <span style={{ color:'#9A9A9A' }}>
                            {fmtHora(d.hora_entrada)} → {d.hora_salida ? fmtHora(d.hora_salida) : 'abierto'}
                            {!!d.colacion_minutos && ` · 🍽️ ${d.colacion_minutos} min`}
                          </span>
                          <span style={{ color:'#F0EFEA', fontWeight:500, minWidth:60, textAlign:'right' }}>{d.horas_trabajadas!=null ? fmtHoras(d.horas_trabajadas) : '—'}</span>
                          <span style={{ color:'#D8B24D', minWidth:80, textAlign:'right' }}>{d.monto_calculado!=null ? fmtCLP(d.monto_calculado) : '—'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )
              })}
              {resumenMes.length>0 && (
                <div style={{ display:'flex', justifyContent:'flex-end', gap:20, padding:'12px 0', fontSize:12, color:'#9A9A9A' }}>
                  <span>Total horas: <strong style={{ color:'#F0EFEA' }}>{fmtHoras(totalHorasMes)}</strong></span>
                  <span>Total a pagar: <strong style={{ color:'#F0EFEA' }}>{fmtCLP(totalPagarMes)}</strong></span>
                </div>
              )}
            </div>
          )}

          {/* ── REGISTROS ── */}
          {tab==='registros' && (
            <>
              {showRegForm && (
                <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:20, marginBottom:14 }}>
                  <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>{regEditId ? 'Editar registro' : 'Agregar registro de asistencia'}</div>
                  <div style={{ fontSize:12, color:'#9A9A9A', marginBottom:14, background:'rgba(184,145,46,0.16)', padding:'8px 12px', borderRadius:8 }}>
                    💡 Tipo libro de asistencia: anota entrada y salida de cada trabajadora. Si dejas la salida vacía, el turno queda abierto (igual que si marcara en el kiosco). Las horas y el monto se calculan solos.
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                    <div><label style={lbl}>Trabajadora</label>
                      <select value={rEmpleada} onChange={e=>setREmpleada(e.target.value)} style={inp}>
                        {empleadas.map(e=><option key={e.id} value={e.id}>{e.nombre} · {empNombre(e.empresa_id)}</option>)}
                      </select>
                    </div>
                    <div><label style={lbl}>Fecha</label>
                      <input type="date" value={rFecha} onChange={e=>setRFecha(e.target.value)} style={inp}/>
                    </div>
                    <div><label style={lbl}>Hora entrada</label>
                      <input type="time" value={rEntrada} onChange={e=>setREntrada(e.target.value)} style={inp}/>
                    </div>
                    <div><label style={lbl}>Hora salida (opcional)</label>
                      <input type="time" value={rSalida} onChange={e=>setRSalida(e.target.value)} style={inp}/>
                    </div>
                    <div><label style={lbl}>Colación (minutos, no se paga)</label>
                      <input type="number" min={0} value={rColacion} onChange={e=>setRColacion(e.target.value.replace(/\D/g,''))} placeholder="0" style={inp}/>
                    </div>
                  </div>
                  {rEntrada && rSalida && rEmpleada && (()=>{
                    const emp = empleadas.find(e=>e.id===rEmpleada)
                    const ent = new Date(`${rFecha}T${rEntrada}:00`)
                    const sal = new Date(`${rFecha}T${rSalida}:00`)
                    const colacionMin = parseInt(rColacion) || 0
                    const h = Math.max(0, (sal.getTime()-ent.getTime())/3600000 - colacionMin/60)
                    if (!emp || sal<=ent) return null
                    return (
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(184,145,46,0.16)', borderRadius:8, padding:'8px 12px', marginBottom:12, fontSize:13 }}>
                        <span style={{ color:'#C9C9C9' }}>{fmtHoras(h)}{colacionMin>0?` (descontados ${colacionMin} min de colación)`:''} × {fmtCLP(emp.valor_hora)}/hora</span>
                        <strong style={{ color:'#D8B24D' }}>{fmtCLP(Math.round(h*emp.valor_hora))}</strong>
                      </div>
                    )
                  })()}
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={guardarRegistro} disabled={guardando} style={{ ...btnP, flex:1, justifyContent:'center', opacity:guardando?0.7:1 }}>
                      {guardando ? 'Guardando...' : '💾 Guardar registro'}
                    </button>
                    <button onClick={resetRegForm} style={{ ...btnSec, width:'auto', padding:'8px 16px' }}>Cancelar</button>
                  </div>
                </div>
              )}

              <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:'4px 20px', marginBottom:12 }}>
                {scopeRegistros.length===0 && (
                  <div style={{ textAlign:'center', padding:'2rem', color:'#767676', fontSize:14 }}>
                    {cargando ? '⏳ Cargando...' : '📭 Sin registros de asistencia todavía'}
                  </div>
                )}
                {scopeRegistros.slice(0,200).map((r,i)=>(
                  <div key={r.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 0', borderBottom:i<Math.min(scopeRegistros.length,200)-1?'1px solid rgba(255,255,255,0.06)':'none', flexWrap:'wrap', gap:8 }}>
                    <div style={{ flex:1, minWidth:180 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3, flexWrap:'wrap' }}>
                        <span style={{ fontSize:13, fontWeight:600, color:'#F0EFEA' }}>{empleadaNombre(r.empleada_id)}</span>
                        <span style={{ fontSize:11, color:'#767676' }}>{r.fecha} · {empNombre(r.empresa_id)}</span>
                      </div>
                      <div style={{ fontSize:12, color:'#9A9A9A' }}>
                        Entrada {fmtHora(r.hora_entrada)} → {r.hora_salida ? `Salida ${fmtHora(r.hora_salida)}` : 'turno abierto'}
                        {!!r.colacion_minutos && ` · 🍽️ ${r.colacion_minutos} min colación`}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                      <div style={{ textAlign:'right' }}>
                        {r.horas_trabajadas!=null ? (
                          <>
                            <div style={{ fontSize:13, fontWeight:600, color:'#F0EFEA' }}>{fmtHoras(r.horas_trabajadas)}</div>
                            <div style={{ fontSize:12, color:'#D8B24D' }}>{fmtCLP(r.monto_calculado||0)}</div>
                          </>
                        ) : (
                          <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:'rgba(184,145,46,0.16)', color:'#D8B24D' }}>En curso</span>
                        )}
                      </div>
                      <button onClick={()=>abrirEditarRegistro(r)} style={{ background:'transparent', border:'1px solid rgba(255,255,255,0.14)', borderRadius:6, cursor:'pointer', fontSize:11, color:'#9A9A9A', padding:'4px 8px' }}>Editar</button>
                      <button onClick={()=>eliminarRegistro(r.id)} style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:14, color:'#767676', padding:4 }}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>

              {!showRegForm && (
                <button onClick={()=>{ resetRegForm(); setShowRegForm(true) }} style={{ ...btnP, width:'100%', justifyContent:'center' }}>
                  + Agregar registro
                </button>
              )}
            </>
          )}

          {/* ── TRABAJADORAS ── */}
          {tab==='trabajadoras' && (
            <>
              {showForm && (
                <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:20, marginBottom:14 }}>
                  <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>{editId ? 'Editar trabajadora' : 'Nueva trabajadora'}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                    <div><label style={lbl}>Nombre</label>
                      <input value={fNombre} onChange={e=>setFNombre(e.target.value)} placeholder="Nombre completo" style={inp}/>
                    </div>
                    <div><label style={lbl}>Empresa / sucursal</label>
                      <select value={fEmpresaF} onChange={e=>setFEmpresaF(e.target.value)} style={inp}>
                        {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre_corto}</option>)}
                      </select>
                    </div>
                    <div><label style={lbl}>Valor hora ($)</label>
                      <input type="number" value={fValorHora} onChange={e=>setFValorHora(e.target.value)} placeholder="0" style={inp}/>
                    </div>
                    <div><label style={lbl}>PIN (4 dígitos, para el kiosco)</label>
                      <input value={fPin} onChange={e=>setFPin(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="1234" style={inp}/>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={guardarEmpleada} disabled={guardando} style={{ ...btnP, flex:1, justifyContent:'center', opacity:guardando?0.7:1 }}>
                      {guardando ? 'Guardando...' : '💾 Guardar'}
                    </button>
                    <button onClick={resetForm} style={{ ...btnSec, width:'auto', padding:'8px 16px' }}>Cancelar</button>
                  </div>
                </div>
              )}

              <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:'4px 20px', marginBottom:12 }}>
                {scopeEmpleadas.length===0 && (
                  <div style={{ textAlign:'center', padding:'2rem', color:'#767676', fontSize:14 }}>
                    {cargando ? '⏳ Cargando...' : '📭 Sin trabajadoras registradas — agrega la primera'}
                  </div>
                )}
                {scopeEmpleadas.map((e,i)=>(
                  <div key={e.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 0', borderBottom:i<scopeEmpleadas.length-1?'1px solid rgba(255,255,255,0.06)':'none', flexWrap:'wrap', gap:8, opacity:e.activa?1:0.5 }}>
                    <div style={{ flex:1, minWidth:160 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'#F0EFEA' }}>{e.nombre}{!e.activa && ' (inactiva)'}</div>
                      <div style={{ fontSize:12, color:'#9A9A9A' }}>{empNombre(e.empresa_id)} · {fmtCLP(e.valor_hora)}/hora · PIN {e.pin}</div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <button onClick={()=>abrirEditar(e)} style={{ background:'transparent', border:'1px solid rgba(255,255,255,0.14)', borderRadius:6, cursor:'pointer', fontSize:11, color:'#9A9A9A', padding:'4px 8px' }}>Editar</button>
                      <button onClick={()=>toggleActiva(e.id, e.activa)} style={{ background:'transparent', border:'1px solid rgba(255,255,255,0.14)', borderRadius:6, cursor:'pointer', fontSize:11, color:'#9A9A9A', padding:'4px 8px' }}>{e.activa?'Desactivar':'Activar'}</button>
                      <button onClick={()=>eliminarEmpleada(e.id)} style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:14, color:'#767676', padding:4 }}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>

              {!showForm && (
                <button onClick={()=>setShowForm(true)} style={{ ...btnP, width:'100%', justifyContent:'center' }}>
                  + Agregar trabajadora
                </button>
              )}
            </>
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
