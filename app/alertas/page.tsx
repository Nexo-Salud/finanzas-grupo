'use client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// ── Tipos ──────────────────────────────────────────────────────
type Nivel = 'crit' | 'warn' | 'info' | 'ok'
type TipoRegla = 'variacion_gasto' | 'variacion_ingreso' | 'descuadre_caja' | 'facturas_vencidas' | 'facturas_por_vencer' | 'presupuesto_pct'
type TipoUmbral = '%' | '$' | 'dias'

type Alerta = {
  id: string; empresa_id: string; regla_id: string | null
  nivel: Nivel; titulo: string; descripcion: string
  categoria: string | null; periodo: string | null
  leida: boolean; created_at: string
}
type Regla = {
  id: string; nombre: string; descripcion: string | null
  tipo_regla: TipoRegla; umbral: number; tipo_umbral: TipoUmbral
  nivel: Nivel; activa: boolean
}
type Empresa = { id: string; nombre_corto: string; color: string }
type Movimiento = { empresa_id: string; tipo: string; categoria: string; monto: number; fecha: string }
type Cuadratura = { empresa_id: string; fecha: string; monto_esperado: number; monto_contado: number }
type Pago = { empresa_id: string; proveedor: string; fecha_vencimiento: string; monto_total: number; saldo: number }

const NAV = [
  { href:'/',             label:'Dashboard',    icon:'▦'  },
  { href:'/movimientos',  label:'Movimientos',  icon:'↕'  },
  { href:'/caja',           label:'Caja',         icon:'💵' },
  { href:'/calendario-pago', label:'Calendario de pago', icon:'🗓️' },
  { href:'/presupuesto',  label:'Presupuesto',  icon:'🎯' },
  { href:'/alertas',      label:'Alertas',      icon:'🔔', active:true },
  { href:'/reportes',     label:'Reportes',     icon:'📄' },
  { href:'/bancos',       label:'Bancos',       icon:'🏦' },
  { href:'/tributario',   label:'Documentos',   icon:'🧾' },
  { href:'/proyecciones', label:'Proyecciones', icon:'📈' },
  { href:'/usuarios',     label:'Usuarios',     icon:'👥' },
  { href:'/asistencia',     label:'Asistencia',   icon:'🕐' },
  { href:'/kpis',         label:'KPIs',         icon:'📊' },
  { href:'/ia',           label:'Análisis IA',  icon:'🧠' },
]

const TIPOS_REGLA: { value: TipoRegla; label: string; tipoUmbral: TipoUmbral; desc: string }[] = [
  { value:'variacion_gasto',     label:'Aumento de gasto por categoría', tipoUmbral:'%',    desc:'Compara cada categoría de gasto del mes actual vs el mes anterior (datos de Movimientos)' },
  { value:'variacion_ingreso',   label:'Caída de ingresos',              tipoUmbral:'%',    desc:'Compara los ingresos totales del mes actual vs el mes anterior (datos de Movimientos)' },
  { value:'descuadre_caja',      label:'Descuadre de caja',              tipoUmbral:'$',    desc:'Revisa la última cuadratura de caja (contado vs esperado, datos de Caja)' },
  { value:'facturas_vencidas',   label:'Facturas de proveedores vencidas', tipoUmbral:'$',  desc:'Suma el saldo de facturas vencidas y sin pagar (datos de Calendario de pago)' },
  { value:'facturas_por_vencer', label:'Facturas por vencer pronto',     tipoUmbral:'dias', desc:'Detecta facturas que vencen dentro de los próximos días (datos de Calendario de pago)' },
  { value:'presupuesto_pct',     label:'Gasto sobre presupuesto',        tipoUmbral:'%',    desc:'Compara el gasto ejecutado a la fecha vs la meta de presupuesto prorateada a la fecha (datos de Presupuesto)' },
]

// ── Helpers ────────────────────────────────────────────────────
const NIV_BG        = { crit:'rgba(226,75,74,0.16)', warn:'rgba(186,117,23,0.18)', info:'rgba(184,145,46,0.16)', ok:'rgba(29,158,117,0.14)' }
const NIV_BORDER    = { crit:'#E24B4A', warn:'#EF9F27', info:'#B8912E', ok:'#1D9E75' }
const NIV_LABEL     = { crit:'Crítico', warn:'Aviso', info:'Info', ok:'OK' }
const NIV_TEXT      = { crit:'#E24B4A', warn:'#BA7517', info:'#D8B24D', ok:'#1D9E75' }
const NIV_BADGE_BG  = { crit:'rgba(226,75,74,0.22)', warn:'rgba(186,117,23,0.24)', info:'rgba(184,145,46,0.2)', ok:'rgba(29,158,117,0.22)' }
const NIV_BADGE_TX  = { crit:'#E24B4A', warn:'#BA7517', info:'#D8B24D', ok:'#1D9E75' }

function fmtCLP(n: number) { return (n<0?'-':'')+'$'+Math.round(Math.abs(n)).toLocaleString('es-CL') }
function hoyISO() { return new Date().toISOString().split('T')[0] }
function diffDias(fecha: string) {
  const a = new Date(fecha+'T00:00:00'), b = new Date(hoyISO()+'T00:00:00')
  return Math.round((a.getTime()-b.getTime())/86400000)
}
function fmtFechaHora(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-CL') + ' ' + d.toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' })
}

export default function AlertasPage() {
  const router = useRouter()
  const [userEmail,          setUserEmail]          = useState('')
  const [esAdmin,            setEsAdmin]            = useState(true)
  const [empresasPermitidas, setEmpresasPermitidas] = useState<string[]>([])
  const [authListo,          setAuthListo]          = useState(false)

  const [empresas,  setEmpresas]  = useState<Empresa[]>([])
  const [alertas,   setAlertas]   = useState<Alerta[]>([])
  const [reglas,    setReglas]    = useState<Regla[]>([])
  const [cargando,  setCargando]  = useState(false)
  const [evaluando, setEvaluando] = useState(false)
  const [ultimaEval,setUltimaEval]= useState<string>('')
  const [error,     setError]     = useState('')

  const [empresaFiltro, setEmpresaFiltro] = useState('all')
  const [tab,           setTab]           = useState<'activas'|'reglas'|'historial'>('activas')
  const [showForm,      setShowForm]      = useState(false)
  const [fNombre,  setFNombre]  = useState('')
  const [fTipo,    setFTipo]    = useState<TipoRegla>('variacion_gasto')
  const [fNivel,   setFNivel]   = useState<Nivel>('warn')
  const [fUmbral,  setFUmbral]  = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      const email = session.user.email || ''
      setUserEmail(email)

      const { data: perfil } = await supabase
        .from('usuarios_plataforma')
        .select('rol, empresas_permitidas, modulos_permitidos')
        .eq('email', email)
        .single()
      if (perfil?.modulos_permitidos && perfil.modulos_permitidos.length > 0 && !perfil.modulos_permitidos.includes('/alertas')) {
        router.push(perfil.modulos_permitidos[0]); return
      }

      let perms: string[] = []
      if (perfil && perfil.rol !== 'admin' && perfil.empresas_permitidas?.length > 0) {
        perms = perfil.empresas_permitidas
        setEsAdmin(false); setEmpresasPermitidas(perms)
      } else { setEsAdmin(true); setEmpresasPermitidas([]) }

      setAuthListo(true)
      await cargarTodo(perms)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.push('/login')
    })
    return () => subscription.unsubscribe()
  }, [])

  async function cerrarSesion() { await supabase.auth.signOut(); router.push('/login') }

  async function cargarTodo(perms: string[]) {
    setCargando(true); setError('')
    try {
      let qEmps = supabase.from('empresas').select('id,nombre_corto,color').eq('activa', true)
      if (perms.length > 0) qEmps = qEmps.in('id', perms)
      const { data: emps } = await qEmps.order('nombre_corto')
      setEmpresas(emps || [])

      const { data: rgs, error: errR } = await supabase.from('reglas_alertas').select('*').order('created_at')
      if (errR) throw errR
      setReglas(rgs || [])

      let qAls = supabase.from('alertas').select('*').order('created_at', { ascending:false }).limit(1000)
      if (perms.length > 0) qAls = qAls.in('empresa_id', perms)
      const { data: als, error: errA } = await qAls
      if (errA) throw errA
      setAlertas(als || [])

      // Evaluar automáticamente al entrar
      await evaluarReglas(perms, emps || [], rgs || [], als || [])
    } catch(e: any) {
      setError('Error conectando con la base de datos: ' + (e?.message||'desconocido'))
    } finally { setCargando(false) }
  }

  // ── Motor de evaluación ──
  async function evaluarReglas(perms: string[], empsArg?: Empresa[], reglasArg?: Regla[], alertasArg?: Alerta[]) {
    setEvaluando(true)
    try {
      const emps    = empsArg    ?? empresas
      const reglasE = (reglasArg ?? reglas).filter(r => r.activa)
      const alsPrev = alertasArg ?? alertas
      if (emps.length===0 || reglasE.length===0) { setEvaluando(false); return }

      const hoy = new Date()
      const keyActual   = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`
      const mesAntDate  = new Date(hoy.getFullYear(), hoy.getMonth()-1, 1)
      const keyAnterior = `${mesAntDate.getFullYear()}-${String(mesAntDate.getMonth()+1).padStart(2,'0')}`

      let qMovs = supabase.from('movimientos').select('empresa_id,tipo,categoria,monto,fecha').limit(5000)
      if (perms.length > 0) qMovs = qMovs.in('empresa_id', perms)
      const { data: movs } = await qMovs

      let qCaja = supabase.from('cuadraturas_caja').select('empresa_id,fecha,monto_esperado,monto_contado').order('fecha', { ascending:false }).limit(500)
      if (perms.length > 0) qCaja = qCaja.in('empresa_id', perms)
      const { data: cajas } = await qCaja

      let qPagos = supabase.from('pagos_proveedores').select('empresa_id,proveedor,fecha_vencimiento,monto_total,saldo').gt('saldo', 0).limit(2000)
      if (perms.length > 0) qPagos = qPagos.in('empresa_id', perms)
      const { data: pagos } = await qPagos

      let presupCats: any[] = []
      if (reglasE.some(r => r.tipo_regla === 'presupuesto_pct')) {
        let qPresup = supabase.from('presupuesto_categorias').select('*').eq('anio', hoy.getFullYear())
        if (perms.length > 0) qPresup = qPresup.in('empresa_id', perms)
        const { data: pcs } = await qPresup
        presupCats = (pcs || []).map((c:any) => ({ ...c, dist: Array.isArray(c.dist) ? c.dist : JSON.parse(c.dist) }))
      }

      const generadas: Array<Partial<Alerta> & { empresa_id:string; regla_id:string }> = []

      for (const emp of emps) {
        for (const regla of reglasE) {
          if (regla.tipo_regla === 'variacion_gasto') {
            const porCat: Record<string, { a:number; b:number }> = {}
            ;(movs||[]).filter(m => m.empresa_id===emp.id && m.tipo==='gasto').forEach(m => {
              const key = m.fecha.slice(0,7)
              if (key!==keyActual && key!==keyAnterior) return
              if (!porCat[m.categoria]) porCat[m.categoria] = { a:0, b:0 }
              if (key===keyActual) porCat[m.categoria].a += m.monto
              else porCat[m.categoria].b += m.monto
            })
            Object.entries(porCat).forEach(([cat, v]) => {
              if (v.b<=0) return
              const pct = Math.round((v.a-v.b)/v.b*100)
              if (pct > regla.umbral) {
                generadas.push({
                  empresa_id: emp.id, regla_id: regla.id, nivel: regla.nivel,
                  titulo: `${cat} subió ${pct}% vs mes anterior`,
                  descripcion: `${emp.nombre_corto} · ${cat}: ${fmtCLP(v.a)} este mes vs ${fmtCLP(v.b)} el mes anterior (+${pct}%)`,
                  categoria: cat, periodo: keyActual,
                })
              }
            })
          }
          else if (regla.tipo_regla === 'variacion_ingreso') {
            const ingA = (movs||[]).filter(m=>m.empresa_id===emp.id && m.tipo==='ingreso' && m.fecha.slice(0,7)===keyActual).reduce((a,m)=>a+m.monto,0)
            const ingB = (movs||[]).filter(m=>m.empresa_id===emp.id && m.tipo==='ingreso' && m.fecha.slice(0,7)===keyAnterior).reduce((a,m)=>a+m.monto,0)
            if (ingB>0) {
              const pct = Math.round((ingB-ingA)/ingB*100)
              if (pct > regla.umbral) {
                generadas.push({
                  empresa_id: emp.id, regla_id: regla.id, nivel: regla.nivel,
                  titulo: `Ingresos cayeron ${pct}% vs mes anterior`,
                  descripcion: `${emp.nombre_corto} · Ingresos: ${fmtCLP(ingA)} este mes vs ${fmtCLP(ingB)} el mes anterior (-${pct}%)`,
                  categoria: 'Ingresos', periodo: keyActual,
                })
              }
            }
          }
          else if (regla.tipo_regla === 'descuadre_caja') {
            const cs = (cajas||[]).filter(c=>c.empresa_id===emp.id).sort((a,b)=>b.fecha.localeCompare(a.fecha))
            const ultima = cs[0]
            if (ultima) {
              const dif = ultima.monto_contado - ultima.monto_esperado
              if (Math.abs(dif) > regla.umbral) {
                generadas.push({
                  empresa_id: emp.id, regla_id: regla.id, nivel: regla.nivel,
                  titulo: `Descuadre de caja: ${dif>0?'sobrante':'faltante'} de ${fmtCLP(Math.abs(dif))}`,
                  descripcion: `${emp.nombre_corto} · Cuadratura del ${ultima.fecha}: contado ${fmtCLP(ultima.monto_contado)} vs esperado ${fmtCLP(ultima.monto_esperado)}`,
                  categoria: 'Caja', periodo: ultima.fecha,
                })
              }
            }
          }
          else if (regla.tipo_regla === 'facturas_vencidas') {
            const venc = (pagos||[]).filter(p => p.empresa_id===emp.id && p.fecha_vencimiento < hoyISO())
            if (venc.length>0) {
              const total = venc.reduce((a,p)=>a+p.saldo,0)
              if (total > regla.umbral) {
                generadas.push({
                  empresa_id: emp.id, regla_id: regla.id, nivel: regla.nivel,
                  titulo: `${venc.length} factura(s) de proveedores vencidas`,
                  descripcion: `${emp.nombre_corto} · Total vencido: ${fmtCLP(total)} en ${venc.length} documento(s)`,
                  categoria: 'Proveedores', periodo: keyActual,
                })
              }
            }
          }
          else if (regla.tipo_regla === 'facturas_por_vencer') {
            const list = (pagos||[]).filter(p => p.empresa_id===emp.id).filter(p => {
              const d = diffDias(p.fecha_vencimiento)
              return d>=0 && d<=regla.umbral
            })
            if (list.length>0) {
              const total = list.reduce((a,p)=>a+p.saldo,0)
              generadas.push({
                empresa_id: emp.id, regla_id: regla.id, nivel: regla.nivel,
                titulo: `${list.length} factura(s) vencen en los próximos ${regla.umbral} días`,
                descripcion: `${emp.nombre_corto} · Total por vencer: ${fmtCLP(total)}`,
                categoria: 'Proveedores', periodo: keyActual,
              })
            }
          }
          else if (regla.tipo_regla === 'presupuesto_pct') {
            const mesActualIdx = hoy.getMonth() // 0..11
            presupCats.filter(pc => pc.empresa_id===emp.id && pc.tipo==='gasto').forEach(pc => {
              const ejecAcum = (movs||[]).filter(m =>
                m.empresa_id===emp.id && m.categoria===pc.nombre && m.tipo==='gasto' &&
                m.fecha.slice(0,4)===String(hoy.getFullYear()) &&
                (parseInt(m.fecha.slice(5,7),10)-1) <= mesActualIdx
              ).reduce((a,m)=>a+m.monto,0)
              const metaAcum = pc.dist.slice(0, mesActualIdx+1).reduce((a:number,d:number)=>a + pc.meta_anual*d/100, 0)
              if (metaAcum<=0) return
              const pct = Math.round(ejecAcum/metaAcum*100)
              if (pct > regla.umbral) {
                generadas.push({
                  empresa_id: emp.id, regla_id: regla.id, nivel: regla.nivel,
                  titulo: `${pc.nombre} sobre presupuesto (${pct}%)`,
                  descripcion: `${emp.nombre_corto} · ${pc.nombre} ejecutó ${fmtCLP(ejecAcum)} vs presupuesto ${fmtCLP(metaAcum)} a la fecha (${pct}%)`,
                  categoria: pc.nombre, periodo: keyActual,
                })
              }
            })
          }
        }
      }

      // Insertar/actualizar de forma idempotente, sin reabrir alertas ya leídas
      for (const n of generadas) {
        const existente = alsPrev.find(a =>
          a.empresa_id===n.empresa_id && a.regla_id===n.regla_id &&
          a.categoria===n.categoria && a.periodo===n.periodo)
        if (existente) {
          if (!existente.leida) {
            await supabase.from('alertas').update({ nivel:n.nivel, titulo:n.titulo, descripcion:n.descripcion }).eq('id', existente.id)
          }
        } else {
          await supabase.from('alertas').insert(n)
        }
      }

      let qAls = supabase.from('alertas').select('*').order('created_at', { ascending:false }).limit(1000)
      if (perms.length > 0) qAls = qAls.in('empresa_id', perms)
      const { data: alsNuevas } = await qAls
      setAlertas(alsNuevas || [])
      setUltimaEval(new Date().toISOString())
    } catch(e: any) {
      setError('Error evaluando reglas: ' + (e?.message||'desconocido'))
    } finally { setEvaluando(false) }
  }

  async function marcarLeida(id: string) {
    try {
      await supabase.from('alertas').update({ leida:true }).eq('id', id)
      setAlertas(prev => prev.map(a => a.id===id ? { ...a, leida:true } : a))
    } catch(e:any) { setError('Error actualizando: '+e.message) }
  }
  async function marcarTodasLeidas() {
    const ids = scopeAlertas.filter(a=>!a.leida).map(a=>a.id)
    if (ids.length===0) return
    try {
      await supabase.from('alertas').update({ leida:true }).in('id', ids)
      setAlertas(prev => prev.map(a => ids.includes(a.id) ? { ...a, leida:true } : a))
    } catch(e:any) { setError('Error actualizando: '+e.message) }
  }
  async function toggleRegla(r: Regla) {
    try {
      await supabase.from('reglas_alertas').update({ activa: !r.activa }).eq('id', r.id)
      setReglas(prev => prev.map(x => x.id===r.id ? { ...x, activa: !x.activa } : x))
    } catch(e:any) { setError('Error actualizando regla: '+e.message) }
  }
  async function updateUmbral(r: Regla, val: number) {
    setReglas(prev => prev.map(x => x.id===r.id ? { ...x, umbral: val } : x))
    try { await supabase.from('reglas_alertas').update({ umbral: val }).eq('id', r.id) }
    catch(e:any) { setError('Error actualizando umbral: '+e.message) }
  }
  async function eliminarRegla(id: string) {
    try {
      await supabase.from('reglas_alertas').delete().eq('id', id)
      setReglas(prev => prev.filter(r=>r.id!==id))
    } catch(e:any) { setError('Error eliminando regla: '+e.message) }
  }
  async function agregarRegla() {
    if (!fNombre || !fUmbral) return
    const meta = TIPOS_REGLA.find(t=>t.value===fTipo)!
    try {
      const { data, error: err } = await supabase.from('reglas_alertas').insert({
        nombre: fNombre, descripcion: meta.desc, tipo_regla: fTipo,
        umbral: parseFloat(fUmbral)||0, tipo_umbral: meta.tipoUmbral,
        nivel: fNivel, activa: true,
      }).select().single()
      if (err) throw err
      setReglas(prev => [...prev, data])
      setFNombre(''); setFUmbral(''); setShowForm(false)
    } catch(e:any) { setError('Error creando regla: '+e.message) }
  }

  const empNombre = (id: string) => empresas.find(e=>e.id===id)?.nombre_corto || id
  const empColor  = (id: string) => empresas.find(e=>e.id===id)?.color || '#888780'

  const scopeAlertas = alertas.filter(a => empresaFiltro==='all' || a.empresa_id===empresaFiltro)
  const noLeidas = scopeAlertas.filter(a => !a.leida)
  const leidas   = scopeAlertas.filter(a => a.leida)
  const criticas = scopeAlertas.filter(a => a.nivel==='crit' && !a.leida).length
  const avisos   = scopeAlertas.filter(a => a.nivel==='warn' && !a.leida).length

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
        {NAV.map(item => (
          <Link key={item.href} href={item.href} style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px', borderRadius:8, fontSize:13.5, color:(item as any).active?'#B8912E':'#9A9A9A', background:(item as any).active?'rgba(184,145,46,0.16)':'transparent', fontWeight:(item as any).active?500:400, textDecoration:'none', marginBottom:2 }}>
            <span style={{ fontSize:15 }}>{item.icon}</span>{item.label}
            {item.href==='/alertas' && noLeidas.length > 0 && (
              <span style={{ marginLeft:'auto', background:'#E24B4A', color:'#fff', borderRadius:999, fontSize:10, fontWeight:600, padding:'1px 6px' }}>{noLeidas.length}</span>
            )}
          </Link>
        ))}
        <div style={{ marginTop:'auto', paddingTop:12, borderTop:'1px solid rgba(255,255,255,0.08)' }}>
          {!esAdmin && empresasPermitidas.length > 0 && (
            <div style={{ fontSize:10, color:'#BA7517', padding:'4px 10px', background:'rgba(186,117,23,0.18)', borderRadius:6, marginBottom:6, textAlign:'center' }}>🔒 Vista restringida</div>
          )}
          <div style={{ fontSize:11, color:'#767676', marginBottom:4, padding:'0 10px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{userEmail}</div>
          <button onClick={cerrarSesion} style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'8px 10px', borderRadius:8, fontSize:13, color:'#E24B4A', background:'transparent', border:'none', cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
            🚪 Cerrar sesión
          </button>
        </div>
      </div>

      <div className="app-content" style={{ marginLeft:220 }}>
        {/* Header */}
        <div className="app-header" style={{ height:56, background:'#161616', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 28px', position:'sticky', top:0, zIndex:50 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:15, fontWeight:600 }}>Alertas automáticas</div>
            {noLeidas.length > 0 && (
              <span style={{ background:'rgba(226,75,74,0.16)', color:'#E24B4A', borderRadius:999, fontSize:11, fontWeight:600, padding:'2px 8px' }}>
                {noLeidas.length} sin leer
              </span>
            )}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <select value={empresaFiltro} onChange={e=>setEmpresaFiltro(e.target.value)} style={sel}>
              <option value="all">{esAdmin?'Todas las empresas':'Mis empresas'}</option>
              {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre_corto}</option>)}
            </select>
            <button onClick={()=>evaluarReglas(empresasPermitidas)} disabled={evaluando} style={{ ...btnSec, width:'auto', padding:'7px 12px', fontSize:12, opacity:evaluando?0.6:1 }}>
              {evaluando ? '⏳ Revisando...' : '🔄 Revisar ahora'}
            </button>
            {noLeidas.length > 0 && (
              <button onClick={marcarTodasLeidas} style={{ ...btnSec, width:'auto', padding:'7px 12px', fontSize:12 }}>✓ Marcar todas como leídas</button>
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

          <div style={{ fontSize:11, color:'#767676', marginBottom:14 }}>
            💡 Las reglas se evalúan contra tus datos reales (Movimientos, Caja y Calendario de pago) al entrar a esta página y al presionar "Revisar ahora" — no hay monitoreo continuo en segundo plano.
            {ultimaEval && <> Última revisión: {fmtFechaHora(ultimaEval)}.</>}
          </div>

          {/* Métricas */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:12, marginBottom:24 }}>
            {[
              { label:'Críticas',       value:criticas, color:'#E24B4A', bg:'rgba(226,75,74,0.16)' },
              { label:'Avisos',         value:avisos,   color:'#EF9F27', bg:'rgba(186,117,23,0.18)' },
              { label:'Sin leer',       value:noLeidas.length, color:'#F0EFEA', bg:'#1F1F1F' },
              { label:'Reglas activas', value:reglas.filter(r=>r.activa).length, color:'#1D9E75', bg:'rgba(29,158,117,0.16)' },
            ].map(m => (
              <div key={m.label} style={{ background:m.bg, borderRadius:12, padding:'14px 16px' }}>
                <div style={{ fontSize:11, color:m.color, fontWeight:500, marginBottom:4, opacity:0.8 }}>{m.label}</div>
                <div style={{ fontSize:26, fontWeight:700, color:m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:6, marginBottom:20 }}>
            {([
              { key:'activas',   label:'🔔 Alertas activas' },
              { key:'reglas',    label:'⚙️ Reglas' },
              { key:'historial', label:'📋 Historial' },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer', border:'1px solid rgba(255,255,255,0.1)', background:tab===t.key?'rgba(184,145,46,0.16)':'#161616', color:tab===t.key?'#B8912E':'#9A9A9A', fontWeight:tab===t.key?500:400 }}>
                {t.label}
              </button>
            ))}
          </div>

          {cargando && <div style={{ textAlign:'center', padding:'3rem', color:'#767676' }}>⏳ Cargando...</div>}

          {/* ── Tab: Alertas activas ── */}
          {!cargando && tab === 'activas' && (
            <>
              {noLeidas.length > 0 && (
                <>
                  <div style={{ fontSize:12, fontWeight:600, color:'#C9C9C9', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>
                    Sin leer ({noLeidas.length})
                  </div>
                  {noLeidas.map(a => <AlertaCard key={a.id} alerta={a} empNombre={empNombre} onLeer={marcarLeida} />)}
                </>
              )}
              {leidas.length > 0 && (
                <>
                  <div style={{ fontSize:12, fontWeight:600, color:'#767676', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10, marginTop: noLeidas.length ? 20 : 0 }}>
                    Leídas ({leidas.length})
                  </div>
                  {leidas.map(a => <AlertaCard key={a.id} alerta={a} empNombre={empNombre} onLeer={marcarLeida} dim />)}
                </>
              )}
              {scopeAlertas.length === 0 && (
                <div style={{ textAlign:'center', padding:'4rem', color:'#767676' }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
                  <div style={{ fontSize:15, fontWeight:500 }}>Sin alertas activas</div>
                  <div style={{ fontSize:13, marginTop:4 }}>Todo está bajo control (según las reglas activas)</div>
                </div>
              )}
            </>
          )}

          {/* ── Tab: Reglas ── */}
          {!cargando && tab === 'reglas' && (
            <>
              {!esAdmin && (
                <div style={{ background:'rgba(186,117,23,0.18)', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#BA7517', marginBottom:14 }}>
                  🔒 Solo administradores pueden editar reglas. Estas reglas aplican a todas las empresas.
                </div>
              )}
              {esAdmin && showForm && (
                <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:20, marginBottom:16 }}>
                  <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Nueva regla de alerta</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                    <div><label style={lbl}>Nombre</label><input value={fNombre} onChange={e=>setFNombre(e.target.value)} placeholder="Nombre de la regla" style={inp}/></div>
                    <div><label style={lbl}>Tipo de regla</label>
                      <select value={fTipo} onChange={e=>setFTipo(e.target.value as TipoRegla)} style={inp}>
                        {TIPOS_REGLA.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div><label style={lbl}>Nivel</label>
                      <select value={fNivel} onChange={e=>setFNivel(e.target.value as Nivel)} style={inp}>
                        <option value="crit">Crítico</option>
                        <option value="warn">Aviso</option>
                        <option value="info">Info</option>
                        <option value="ok">OK</option>
                      </select>
                    </div>
                    <div><label style={lbl}>Umbral ({TIPOS_REGLA.find(t=>t.value===fTipo)?.tipoUmbral})</label>
                      <input type="number" value={fUmbral} onChange={e=>setFUmbral(e.target.value)} placeholder="80" style={inp}/>
                    </div>
                    <div style={{ gridColumn:'span 2', fontSize:11, color:'#767676' }}>{TIPOS_REGLA.find(t=>t.value===fTipo)?.desc}</div>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={agregarRegla} style={{ ...btnP, flex:1 }}>Guardar regla</button>
                    <button onClick={()=>setShowForm(false)} style={{ ...btnSec, width:'auto', padding:'8px 16px' }}>Cancelar</button>
                  </div>
                </div>
              )}

              <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:'4px 20px' }}>
                {reglas.length===0 ? (
                  <div style={{ textAlign:'center', padding:'2rem', color:'#767676' }}>Sin reglas configuradas</div>
                ) : reglas.map((r, i) => (
                  <div key={r.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 0', borderBottom: i < reglas.length-1 ? '1px solid rgba(255,255,255,0.06)' : 'none', flexWrap:'wrap', gap:10 }}>
                    <div style={{ flex:1, minWidth:200 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                        <span style={{ fontSize:13, fontWeight:500, color:'#F0EFEA' }}>{r.nombre}</span>
                        <span style={{ fontSize:10, padding:'1px 7px', borderRadius:999, fontWeight:600, background:NIV_BADGE_BG[r.nivel], color:NIV_BADGE_TX[r.nivel] }}>
                          {NIV_LABEL[r.nivel]}
                        </span>
                        {!r.activa && <span style={{ fontSize:10, padding:'1px 7px', borderRadius:999, background:'#1F1F1F', color:'#767676' }}>Inactiva</span>}
                      </div>
                      <div style={{ fontSize:12, color:'#9A9A9A' }}>{r.descripcion}</div>
                      <div style={{ fontSize:12, color:'#C9C9C9', marginTop:3 }}>
                        Umbral: <strong>{r.tipo_umbral === '$' ? '$' + r.umbral.toLocaleString('es-CL') : r.tipo_umbral === 'dias' ? r.umbral + ' días' : r.umbral + '%'}</strong>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <input type="number" value={r.umbral} disabled={!esAdmin} onChange={e=>updateUmbral(r, parseFloat(e.target.value)||0)}
                        style={{ width:70, fontSize:13, textAlign:'center', padding:'5px 8px', border:'1px solid rgba(255,255,255,0.14)', borderRadius:7, background:'#161616', color:'#F0EFEA', opacity:esAdmin?1:0.6 }}/>
                      <div onClick={()=>esAdmin && toggleRegla(r)} style={{ width:36, height:20, borderRadius:10, background:r.activa?'#1D9E75':'#4A4A4A', cursor:esAdmin?'pointer':'default', position:'relative', transition:'background 0.2s', flexShrink:0, opacity:esAdmin?1:0.6 }}>
                        <div style={{ width:16, height:16, borderRadius:'50%', background:'#161616', position:'absolute', top:2, left:r.activa?18:2, transition:'left 0.2s' }}/>
                      </div>
                      {esAdmin && <button onClick={()=>eliminarRegla(r.id)} style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:16, color:'#767676', padding:4 }}>🗑️</button>}
                    </div>
                  </div>
                ))}
              </div>
              {esAdmin && (
                <button onClick={()=>setShowForm(true)} style={{ ...btnP, marginTop:12, width:'100%', justifyContent:'center' }}>
                  + Nueva regla personalizada
                </button>
              )}
            </>
          )}

          {/* ── Tab: Historial ── */}
          {!cargando && tab === 'historial' && (
            <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:'4px 20px' }}>
              {scopeAlertas.length===0 ? (
                <div style={{ textAlign:'center', padding:'2rem', color:'#767676' }}>Sin historial todavía</div>
              ) : scopeAlertas.map((a, i) => (
                <div key={a.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 0', borderBottom: i < scopeAlertas.length-1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  <div style={{ width:9, height:9, borderRadius:'50%', background:NIV_BORDER[a.nivel], flexShrink:0 }}/>
                  <div style={{ flex:1 }}>
                    <span style={{ fontSize:13, fontWeight:500, color:'#F0EFEA' }}>{a.titulo}</span>
                    <span style={{ fontSize:12, color:'#767676', marginLeft:8 }}>{empNombre(a.empresa_id)}</span>
                  </div>
                  <span style={{ fontSize:10, padding:'1px 7px', borderRadius:999, fontWeight:600, background:NIV_BADGE_BG[a.nivel], color:NIV_BADGE_TX[a.nivel] }}>{NIV_LABEL[a.nivel]}</span>
                  <span style={{ fontSize:11, color:'#767676', whiteSpace:'nowrap' as const, flexShrink:0 }}>{fmtFechaHora(a.created_at)}</span>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Subcomponente AlertaCard ───────────────────────────────────
function AlertaCard({ alerta: a, empNombre, onLeer, dim }: { alerta: Alerta; empNombre:(id:string)=>string; onLeer: (id:string)=>void; dim?: boolean }) {
  return (
    <div style={{ background:NIV_BG[a.nivel], borderLeft:`3px solid ${NIV_BORDER[a.nivel]}`, borderRadius:12, padding:'14px 16px', marginBottom:10, opacity: dim ? 0.55 : 1 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:6, marginBottom:6 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:13, fontWeight:600, color:NIV_TEXT[a.nivel] }}>{a.titulo}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:10, padding:'2px 8px', borderRadius:999, fontWeight:600, background:NIV_BADGE_BG[a.nivel], color:NIV_BADGE_TX[a.nivel] }}>{NIV_LABEL[a.nivel]}</span>
          <span style={{ fontSize:11, color:NIV_TEXT[a.nivel], opacity:0.7 }}>{fmtFechaHora(a.created_at)}</span>
          {!a.leida && (
            <button onClick={()=>onLeer(a.id)} style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:16, color:NIV_TEXT[a.nivel], opacity:0.6, padding:'2px 4px' }} title="Marcar como leída">✕</button>
          )}
        </div>
      </div>
      <div style={{ fontSize:13, color:NIV_TEXT[a.nivel], lineHeight:1.5 }}>{a.descripcion}</div>
      <div style={{ marginTop:6, fontSize:11, color:NIV_TEXT[a.nivel], opacity:0.7 }}>
        {empNombre(a.empresa_id)} · {a.categoria}
      </div>
    </div>
  )
}

// ── Estilos ────────────────────────────────────────────────────
const sel: React.CSSProperties    = { fontSize:13, padding:'6px 10px', border:'1px solid rgba(255,255,255,0.14)', borderRadius:8, background:'#161616' }
const btnP: React.CSSProperties   = { display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, border:'none', background:'#B8912E', color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer' }
const btnSec: React.CSSProperties = { display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'7px 14px', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', border:'1px solid rgba(255,255,255,0.14)', background:'#161616', color:'#C9C9C9', width:'100%' }
const lbl: React.CSSProperties    = { display:'block', fontSize:12, fontWeight:500, color:'#9A9A9A', marginBottom:4 }
const inp: React.CSSProperties    = { width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid rgba(255,255,255,0.16)', borderRadius:8, background:'#161616', color:'#F0EFEA', fontFamily:'DM Sans, sans-serif' }
