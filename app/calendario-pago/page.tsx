'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

type Pago = {
  id: string; empresa_id: string; proveedor: string; documento: string|null; numero: string|null
  fecha_emision: string|null; fecha_vencimiento: string; monto_total: number; monto_pagado: number
  saldo: number; centro_costo: string|null; origen_archivo: string|null; created_at?: string
}
type Movimiento = { id: string; empresa_id: string; tipo: string; descripcion: string; categoria: string; monto: number; fecha: string }
type Empresa = { id: string; nombre_corto: string; color: string }

const MESES_NOMBRE = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const NAV = [
  { href:'/',             label:'Dashboard',    icon:'▦'  },
  { href:'/movimientos',  label:'Movimientos',  icon:'↕'  },
  { href:'/caja',           label:'Caja',         icon:'💵' },
  { href:'/calendario-pago', label:'Calendario de pago', icon:'🗓️', active:true },
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
  { href:'/ia',           label:'Análisis IA',  icon:'🧠' },
]

function fmtCLP(n: number) {
  return (n<0?'-':'')+'$'+Math.round(Math.abs(n)).toLocaleString('es-CL')
}
function hoyISO() { return new Date().toISOString().split('T')[0] }
function diffDias(fecha: string) {
  const a = new Date(fecha+'T00:00:00'), b = new Date(hoyISO()+'T00:00:00')
  return Math.round((a.getTime()-b.getTime())/86400000)
}
function normaliza(s: string) {
  return (s||'').toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/\s*\[\s*\]\s*$/,'')
    .replace(/\b(SPA|LTDA|LIMITADA|SOCIEDAD|COMERCIAL|S\.A\.|SA|E\.I\.R\.L\.|EIRL|Y\s+CIA)\b/g,'')
    .replace(/[^A-Z0-9 ]/g,'')
    .replace(/\s+/g,' ')
    .trim()
}
function estadoPago(p: Pago): 'pagado'|'vencido'|'proximo'|'pendiente' {
  if (p.saldo<=0) return 'pagado'
  const d = diffDias(p.fecha_vencimiento)
  if (d<0) return 'vencido'
  if (d<=7) return 'proximo'
  return 'pendiente'
}
const ESTADO_INFO: Record<string,{label:string;color:string;bg:string}> = {
  pagado:    { label:'✓ Pagado',        color:'#1D9E75', bg:'rgba(29,158,117,0.16)' },
  vencido:   { label:'⚠ Vencido',       color:'#E24B4A', bg:'rgba(226,75,74,0.16)' },
  proximo:   { label:'⏳ Vence pronto',  color:'#EF9F27', bg:'rgba(239,159,39,0.16)' },
  pendiente: { label:'📅 Pendiente',     color:'#9A9A9A', bg:'rgba(255,255,255,0.08)' },
}

// Parser del archivo "Informe Estado Pagos" (.xls / .xlsx)
function parseCeldaFecha(v: any): string {
  if (v===null || v===undefined || v==='') return ''
  if (typeof v==='number') {
    const d = (XLSX as any).SSF.parse_date_code(v)
    if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`
  }
  const s = String(v).trim()
  let m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
  m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`
  return s
}
function parseCeldaMonto(v: any): number {
  if (v===null || v===undefined || v==='') return 0
  if (typeof v==='number') return v
  const limpio = String(v).replace(/[^0-9.,-]/g,'').replace(/\.(?=\d{3}(\D|$))/g,'').replace(',', '.')
  const n = parseFloat(limpio)
  return isNaN(n) ? 0 : n
}

export default function CalendarioPagoPage() {
  const router = useRouter()
  const [userEmail,          setUserEmail]          = useState('')
  const [esAdmin,            setEsAdmin]            = useState(true)
  const [empresasPermitidas, setEmpresasPermitidas] = useState<string[]>([])
  const [authListo,          setAuthListo]          = useState(false)

  const [pagos,         setPagos]         = useState<Pago[]>([])
  const [movimientos,   setMovimientos]   = useState<Movimiento[]>([])
  const [empresas,      setEmpresas]      = useState<Empresa[]>([])
  const [cargando,      setCargando]      = useState(false)
  const [empresaFiltro, setEmpresaFiltro] = useState('all')
  const [estadoFiltro,  setEstadoFiltro]  = useState('all')
  const [busqueda,      setBusqueda]      = useState('')
  const [showImport,    setShowImport]    = useState(false)
  const [tab,           setTab]           = useState<'calendario'|'proveedores'|'comparar'>('calendario')
  const [error,         setError]         = useState('')
  const [fEmpresa,      setFEmpresa]      = useState('')

  const hoy = new Date()
  const [mesComp,  setMesComp]  = useState(hoy.getMonth()+1)
  const [anioComp, setAnioComp] = useState(hoy.getFullYear())

  // Import
  const [importPreview, setImportPreview] = useState<any[]>([])
  const [importError,   setImportError]   = useState('')
  const [importando,    setImportando]    = useState(false)
  const [importResult,  setImportResult]  = useState('')
  const [nombreArchivo, setNombreArchivo] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

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
      if (perfil?.modulos_permitidos && perfil.modulos_permitidos.length > 0 && !perfil.modulos_permitidos.includes('/calendario-pago')) {
        router.push(perfil.modulos_permitidos[0]); return
      }

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

  async function cargarDatos(perms: string[]) {
    setCargando(true); setError('')
    try {
      let qEmps = supabase.from('empresas').select('id,nombre_corto,color').eq('activa',true)
      if (perms.length > 0) qEmps = qEmps.in('id', perms)
      const { data: emps } = await qEmps.order('nombre_corto')
      if (emps && emps.length > 0) { setEmpresas(emps); setFEmpresa(emps[0].id) }

      let qPagos = supabase.from('pagos_proveedores').select('*').order('fecha_vencimiento', { ascending: true }).limit(2000)
      if (perms.length > 0) qPagos = qPagos.in('empresa_id', perms)
      const { data: pgs, error: errPagos } = await qPagos
      if (errPagos) throw errPagos
      setPagos(pgs || [])

      let qMovs = supabase.from('movimientos').select('id,empresa_id,tipo,descripcion,categoria,monto,fecha')
        .eq('tipo','gasto').eq('categoria','Proveedores').limit(2000)
      if (perms.length > 0) qMovs = qMovs.in('empresa_id', perms)
      const { data: movs, error: errMovs } = await qMovs
      if (errMovs) throw errMovs
      setMovimientos(movs || [])
    } catch(e: any) {
      setError('Error conectando con la base de datos: ' + (e?.message||'desconocido'))
    } finally { setCargando(false) }
  }

  async function cerrarSesion() { await supabase.auth.signOut(); router.push('/login') }

  const scope = pagos.filter(p => {
    if (empresaFiltro!=='all' && p.empresa_id!==empresaFiltro) return false
    if (estadoFiltro!=='all' && estadoPago(p)!==estadoFiltro) return false
    if (busqueda && !p.proveedor.toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  })

  const totalPendiente = scope.filter(p=>p.saldo>0).reduce((a,p)=>a+p.saldo,0)
  const totalVencido    = scope.filter(p=>estadoPago(p)==='vencido').reduce((a,p)=>a+p.saldo,0)
  const totalProximo    = scope.filter(p=>estadoPago(p)==='proximo').reduce((a,p)=>a+p.saldo,0)
  const totalFacturado  = scope.reduce((a,p)=>a+p.monto_total,0)

  // Agrupado por fecha de vencimiento
  const porFecha: Record<string, Pago[]> = {}
  scope.forEach(p => { (porFecha[p.fecha_vencimiento] ||= []).push(p) })
  const fechasOrdenadas = Object.keys(porFecha).sort()

  // Agrupado por proveedor
  const porProveedor: Record<string, { total:number; pagado:number; saldo:number; count:number }> = {}
  scope.forEach(p => {
    const k = p.proveedor
    if (!porProveedor[k]) porProveedor[k] = { total:0, pagado:0, saldo:0, count:0 }
    porProveedor[k].total += p.monto_total
    porProveedor[k].pagado += p.monto_pagado
    porProveedor[k].saldo += p.saldo
    porProveedor[k].count++
  })
  const proveedoresOrdenados = Object.entries(porProveedor).sort((a,b)=>b[1].saldo-a[1].saldo)

  // Comparación con movimientos del mes elegido
  const keyMes = `${anioComp}-${String(mesComp).padStart(2,'0')}`
  const pagosDelMes = pagos.filter(p => empresaFiltro==='all'||p.empresa_id===empresaFiltro).filter(p => p.fecha_vencimiento.slice(0,7)===keyMes)
  const movsDelMes  = movimientos.filter(m => empresaFiltro==='all'||m.empresa_id===empresaFiltro).filter(m => m.fecha.slice(0,7)===keyMes)
  const porProveedorMes: Record<string, number> = {}
  pagosDelMes.forEach(p => { porProveedorMes[p.proveedor] = (porProveedorMes[p.proveedor]||0) + p.monto_total })
  const comparacion = Object.entries(porProveedorMes).map(([proveedor, facturado]) => {
    const norm = normaliza(proveedor)
    const palabras = norm.split(' ').filter(w=>w.length>=4)
    const registrado = movsDelMes.filter(m => {
      const dn = normaliza(m.descripcion)
      return palabras.some(w => dn.includes(w))
    }).reduce((a,m)=>a+m.monto,0)
    const diff = facturado - registrado
    return { proveedor, facturado, registrado, diff }
  }).sort((a,b)=>Math.abs(b.diff)-Math.abs(a.diff))
  const totalFacturadoMes  = pagosDelMes.reduce((a,p)=>a+p.monto_total,0)
  const totalRegistradoMes = movsDelMes.reduce((a,m)=>a+m.monto,0)

  // Import
  function handleArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setNombreArchivo(file.name); setImportError('')
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const buf = ev.target?.result as ArrayBuffer
        const wb = XLSX.read(buf, { type:'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const filas: any[][] = XLSX.utils.sheet_to_json(sheet, { header:1, raw:true })
        let idxHeader = filas.findIndex(f => f.some(c => String(c).toUpperCase().includes('PROVEEDOR')) && f.some(c => String(c).toUpperCase().includes('VENCIMIENTO')))
        if (idxHeader<0) { setImportError('No se encontró la fila de encabezados (PROVEEDOR / FECHA_VENCIMIENTO).'); return }
        const header = filas[idxHeader].map(h => String(h).trim().toUpperCase())
        const col = (name: string) => header.findIndex(h => h===name)
        const cProv = col('PROVEEDOR'), cNum = col('NUMERO'), cNom = col('NOMBRE')
        const cFEmi = col('FECHA_FORMAT'), cFVen = col('FECHA_VENCIMIENTO')
        const cTot = col('TOTAL'), cPago = col('PAGO'), cSaldo = col('SALDO'), cCC = col('CENTRO_COSTO_NOMBRE')
        if (cProv<0 || cFVen<0 || cTot<0) { setImportError('Faltan columnas obligatorias (PROVEEDOR, FECHA_VENCIMIENTO, TOTAL).'); return }

        const out: any[] = [], errs: string[] = []
        for (let i=idxHeader+1; i<filas.length; i++) {
          const f = filas[i]; if (!f || f.length===0) continue
          const provRaw = f[cProv]
          if (!provRaw || String(provRaw).trim()==='') continue
          const proveedor = String(provRaw).replace(/\s*\[\s*\]\s*$/,'').trim()
          const fechaVenc = parseCeldaFecha(f[cFVen])
          const total = parseCeldaMonto(f[cTot])
          if (!proveedor || !fechaVenc || !total) { errs.push(`Fila ${i+1}: datos incompletos`); continue }
          const pago = cPago>=0 ? parseCeldaMonto(f[cPago]) : 0
          const saldo = cSaldo>=0 ? parseCeldaMonto(f[cSaldo]) : Math.max(total-pago,0)
          out.push({
            empresa_id: fEmpresa,
            proveedor,
            documento: cNom>=0 ? String(f[cNom]||'').trim() : null,
            numero: cNum>=0 ? String(f[cNum]||'').trim() : null,
            fecha_emision: cFEmi>=0 ? (parseCeldaFecha(f[cFEmi])||null) : null,
            fecha_vencimiento: fechaVenc,
            monto_total: total,
            monto_pagado: pago,
            saldo,
            centro_costo: cCC>=0 ? String(f[cCC]||'').trim() : null,
            origen_archivo: nombreArchivo || file.name,
          })
        }
        if (errs.length>0) setImportError(errs.slice(0,3).join(' · '))
        setImportPreview(out)
      } catch(err: any) {
        setImportError('No se pudo leer el archivo: ' + (err?.message||'formato no soportado'))
      }
    }
    reader.readAsArrayBuffer(file)
  }
  async function importar() {
    if (!importPreview.length) return
    setImportando(true)
    try {
      for (let i=0; i<importPreview.length; i+=50) {
        const { error } = await supabase.from('pagos_proveedores')
          .upsert(importPreview.slice(i,i+50), { onConflict: 'empresa_id,proveedor,numero,fecha_vencimiento,monto_total' })
        if (error) throw error
      }
      setImportResult(`✅ ${importPreview.length} documentos importados/actualizados`)
      setImportPreview([]); if (fileRef.current) fileRef.current.value=''
      await cargarDatos(empresasPermitidas)
      setTimeout(()=>{ setShowImport(false); setImportResult('') }, 3000)
    } catch(e: any) { setImportResult('❌ Error: '+e.message) }
    finally { setImportando(false) }
  }
  async function marcarPagado(p: Pago) {
    try {
      const { error } = await supabase.from('pagos_proveedores').update({ monto_pagado: p.monto_total, saldo: 0 }).eq('id', p.id)
      if (error) throw error
      setPagos(prev => prev.map(x => x.id===p.id ? { ...x, monto_pagado: p.monto_total, saldo: 0 } : x))
    } catch(e: any) { setError('Error actualizando: ' + e.message) }
  }
  async function eliminar(id: string) {
    try {
      const { error } = await supabase.from('pagos_proveedores').delete().eq('id', id)
      if (error) throw error
      setPagos(prev => prev.filter(p=>p.id!==id))
    } catch(e: any) { setError('Error eliminando: ' + e.message) }
  }

  const empColor  = (id: string) => empresas.find(e=>e.id===id)?.color||'#888780'
  const empNombre = (id: string) => empresas.find(e=>e.id===id)?.nombre_corto||id

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
        <div style={{ height:56, display:'flex', alignItems:'center', borderBottom:'1px solid rgba(255,255,255,0.08)', marginBottom:12, marginLeft:-12, marginRight:-12, paddingLeft:20, fontSize:15, fontWeight:600, color:'#B8912E' }}>
          📊 Finanzas Grupo
        </div>
        {NAV.map(item=>(
          <Link key={item.href} href={item.href} style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px', borderRadius:8, fontSize:13.5, color:(item as any).active?'#B8912E':'#9A9A9A', background:(item as any).active?'rgba(184,145,46,0.16)':'transparent', fontWeight:(item as any).active?500:400, textDecoration:'none', marginBottom:2 }}>
            <span style={{ fontSize:15 }}>{item.icon}</span>{item.label}
          </Link>
        ))}
        <div style={{ marginTop:'auto', paddingTop:12, borderTop:'1px solid rgba(255,255,255,0.08)' }}>
          {!esAdmin && empresasPermitidas.length>0 && (
            <div style={{ fontSize:10, color:'#BA7517', padding:'4px 10px', background:'rgba(186,117,23,0.18)', borderRadius:6, marginBottom:6, textAlign:'center' }}>🔒 Vista restringida</div>
          )}
          <div style={{ fontSize:11, color:'#767676', marginBottom:4, padding:'0 10px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{userEmail}</div>
          <button onClick={cerrarSesion} style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'8px 10px', borderRadius:8, fontSize:13, color:'#E24B4A', background:'transparent', border:'none', cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
            🚪 Cerrar sesión
          </button>
        </div>
      </div>

      <div className="app-content" style={{ marginLeft:220 }}>
        <div className="app-header" style={{ height:56, background:'#161616', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 28px', position:'sticky', top:0, zIndex:50 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:15, fontWeight:600 }}>Calendario de pago</div>
            {!cargando && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:'rgba(29,158,117,0.16)', color:'#1D9E75', fontWeight:500 }}>🟢 Supabase</span>}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <select value={empresaFiltro} onChange={e=>setEmpresaFiltro(e.target.value)} style={sel}>
              <option value="all">{esAdmin?'Todas las empresas':'Mis empresas'}</option>
              {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre_corto}</option>)}
            </select>
            <button onClick={()=>setShowImport(!showImport)} style={{ ...btnSec, width:'auto', padding:'7px 12px', fontSize:12 }}>📥 Importar informe</button>
          </div>
        </div>

        <div className="app-main" style={{ padding:'24px 28px' }}>
          {error && (
            <div style={{ background:'rgba(226,75,74,0.16)', border:'1px solid rgba(226,75,74,0.22)', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#E24B4A', marginBottom:16, display:'flex', justifyContent:'space-between' }}>
              <span>⚠️ {error}</span>
              <button onClick={()=>setError('')} style={{ background:'transparent', border:'none', cursor:'pointer', color:'#E24B4A' }}>✕</button>
            </div>
          )}

          {/* Métricas */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:20 }}>
            {[
              { label:'Facturado total', value:fmtCLP(totalFacturado), sub:`${scope.length} documentos`, color:'#9A9A9A', bg:'rgba(255,255,255,0.06)' },
              { label:'Por pagar',       value:fmtCLP(totalPendiente),  sub:'saldo pendiente',            color:'#B8912E', bg:'rgba(184,145,46,0.16)' },
              { label:'Vencido',         value:fmtCLP(totalVencido),    sub:'requiere atención',          color:'#E24B4A', bg:'rgba(226,75,74,0.16)' },
              { label:'Vence en 7 días', value:fmtCLP(totalProximo),    sub:'próximos vencimientos',      color:'#EF9F27', bg:'rgba(239,159,39,0.16)' },
            ].map(m=>(
              <div key={m.label} style={{ background:m.bg, borderRadius:12, padding:'14px 16px' }}>
                <div style={{ fontSize:11, color:m.color, fontWeight:500, marginBottom:4, opacity:0.85 }}>{m.label}</div>
                <div style={{ fontSize:20, fontWeight:700, color:m.color }}>{m.value}</div>
                <div style={{ fontSize:10, color:m.color, opacity:0.7, marginTop:2 }}>{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Import */}
          {showImport && (
            <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:20, marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{ fontSize:14, fontWeight:600 }}>📥 Importar informe de estado de pagos (.xls / .xlsx)</div>
                <button onClick={()=>{ setShowImport(false); setImportPreview([]) }} style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:18, color:'#767676' }}>✕</button>
              </div>
              <div style={{ background:'rgba(184,145,46,0.16)', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#B8912E', marginBottom:12 }}>
                Sube el archivo tal como lo exporta el sistema (columnas PROVEEDOR, FECHA_VENCIMIENTO, TOTAL, PAGO, SALDO). Si un documento ya existe (mismo proveedor, número, vencimiento y monto), se actualiza en vez de duplicarse.
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                <div><label style={lbl}>Empresa</label>
                  <select value={fEmpresa} onChange={e=>setFEmpresa(e.target.value)} style={inp}>
                    {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre_corto}</option>)}
                  </select>
                </div>
              </div>
              <input ref={fileRef} type="file" accept=".xls,.xlsx" onChange={handleArchivo}
                style={{ display:'block', fontSize:13, padding:8, border:'1px dashed #4A4A4A', borderRadius:8, width:'100%', background:'#1A1A1A', cursor:'pointer', marginBottom:10 }}/>
              {importError && <div style={{ background:'rgba(186,117,23,0.18)', borderRadius:8, padding:'6px 10px', fontSize:12, color:'#BA7517', marginBottom:10 }}>⚠️ {importError}</div>}
              {importPreview.length>0 && (
                <>
                  <div style={{ fontSize:13, fontWeight:500, marginBottom:8 }}>{importPreview.length} documentos listos para importar</div>
                  {importResult && <div style={{ background:importResult.startsWith('✅')?'rgba(29,158,117,0.14)':'rgba(226,75,74,0.16)', borderRadius:8, padding:'7px 10px', fontSize:13, color:importResult.startsWith('✅')?'#1D9E75':'#E24B4A', marginBottom:10 }}>{importResult}</div>}
                  <button onClick={importar} disabled={importando} style={{ ...btnP, width:'100%', justifyContent:'center', opacity:importando?0.7:1 }}>
                    {importando?'⏳ Importando...': `✅ Importar ${importPreview.length} documentos`}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Tabs */}
          <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
            {([{k:'calendario',l:'🗓️ Calendario'},{k:'proveedores',l:'🏭 Por proveedor'},{k:'comparar',l:'📊 Comparar con movimientos'}] as const).map(t=>(
              <button key={t.k} onClick={()=>setTab(t.k)} style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer', border:'1px solid rgba(255,255,255,0.1)', background:tab===t.k?'rgba(184,145,46,0.16)':'#161616', color:tab===t.k?'#B8912E':'#9A9A9A', fontWeight:tab===t.k?500:400 }}>
                {t.l}
              </button>
            ))}
            {tab==='calendario' && (
              <div style={{ display:'flex', gap:8, marginLeft:'auto' }}>
                <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar proveedor..." style={{ ...inp, width:180, margin:0, fontSize:12 }}/>
                <select value={estadoFiltro} onChange={e=>setEstadoFiltro(e.target.value)} style={{ ...sel, fontSize:12 }}>
                  <option value="all">Todos los estados</option>
                  <option value="vencido">Vencido</option>
                  <option value="proximo">Vence pronto</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="pagado">Pagado</option>
                </select>
              </div>
            )}
          </div>

          {cargando && <div style={{ textAlign:'center', padding:'3rem', color:'#767676' }}>⏳ Cargando...</div>}

          {/* Calendario */}
          {!cargando && tab==='calendario' && (
            <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, overflow:'hidden' }}>
              {fechasOrdenadas.length===0 ? (
                <div style={{ textAlign:'center', padding:'3rem', color:'#767676', fontSize:14 }}>
                  📭 Sin documentos — importa el informe de estado de pagos para comenzar
                </div>
              ) : fechasOrdenadas.map((fecha, fi) => {
                const items = porFecha[fecha]
                const dias = diffDias(fecha)
                const totalDia = items.reduce((a,p)=>a+p.saldo,0)
                return (
                  <div key={fecha} style={{ borderBottom:fi<fechasOrdenadas.length-1?'1px solid rgba(255,255,255,0.06)':'none' }}>
                    <div style={{ background:'#1A1A1A', padding:'8px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <span style={{ fontSize:13, fontWeight:600 }}>{fecha}</span>
                        <span style={{ fontSize:11, color:dias<0?'#E24B4A':dias<=7?'#EF9F27':'#767676' }}>
                          {dias<0 ? `vencido hace ${Math.abs(dias)} días` : dias===0 ? 'vence hoy' : `en ${dias} días`}
                        </span>
                      </div>
                      {totalDia>0 && <span style={{ fontSize:12, fontWeight:600, color:'#B8912E' }}>{fmtCLP(totalDia)} por pagar</span>}
                    </div>
                    {items.map(p => {
                      const est = estadoPago(p)
                      const info = ESTADO_INFO[est]
                      return (
                        <div key={p.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <span style={{ width:8, height:8, borderRadius:'50%', background:empColor(p.empresa_id), flexShrink:0 }}/>
                            <div>
                              <div style={{ fontWeight:500, color:'#F0EFEA', fontSize:13 }}>{p.proveedor}</div>
                              <div style={{ fontSize:11, color:'#767676' }}>{p.documento||'Documento'} {p.numero?`N° ${p.numero}`:''} {p.centro_costo?`· ${p.centro_costo}`:''}</div>
                            </div>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                            <div style={{ textAlign:'right' }}>
                              <div style={{ fontSize:13, fontWeight:600, color:'#F0EFEA' }}>{fmtCLP(p.monto_total)}</div>
                              {p.saldo>0 && p.saldo<p.monto_total && <div style={{ fontSize:10, color:'#767676' }}>saldo {fmtCLP(p.saldo)}</div>}
                            </div>
                            <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, fontWeight:500, background:info.bg, color:info.color, whiteSpace:'nowrap' as const }}>{info.label}</span>
                            {p.saldo>0 && <button onClick={()=>marcarPagado(p)} style={iconBtn} title="Marcar pagado">✔️</button>}
                            <button onClick={()=>eliminar(p.id)} style={iconBtn} title="Eliminar">🗑️</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}

          {/* Por proveedor */}
          {!cargando && tab==='proveedores' && (
            <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, overflow:'hidden' }}>
              {proveedoresOrdenados.length===0 ? (
                <div style={{ textAlign:'center', padding:'3rem', color:'#767676' }}>Sin datos</div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:'#1A1A1A' }}>
                      {['Proveedor','Documentos','Facturado','Pagado','Saldo pendiente'].map(h=>(
                        <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontWeight:500, color:'#9A9A9A', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {proveedoresOrdenados.map(([prov,v],i)=>(
                      <tr key={prov} style={{ borderBottom:i<proveedoresOrdenados.length-1?'1px solid rgba(255,255,255,0.06)':'none' }}>
                        <td style={{ padding:'10px 14px', fontWeight:500, color:'#F0EFEA' }}>{prov}</td>
                        <td style={{ padding:'10px 14px', color:'#9A9A9A' }}>{v.count}</td>
                        <td style={{ padding:'10px 14px', color:'#F0EFEA' }}>{fmtCLP(v.total)}</td>
                        <td style={{ padding:'10px 14px', color:'#1D9E75' }}>{fmtCLP(v.pagado)}</td>
                        <td style={{ padding:'10px 14px', fontWeight:600, color:v.saldo>0?'#B8912E':'#767676' }}>{fmtCLP(v.saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Comparar con movimientos */}
          {!cargando && tab==='comparar' && (
            <>
              <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:'14px 18px', marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                  <span style={{ fontSize:12, fontWeight:600, color:'#9A9A9A' }}>📊 Mes a comparar:</span>
                  <select value={mesComp} onChange={e=>setMesComp(parseInt(e.target.value))} style={sel}>
                    {MESES_NOMBRE.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                  <select value={anioComp} onChange={e=>setAnioComp(parseInt(e.target.value))} style={sel}>
                    {[2024,2025,2026,2027].map(a=><option key={a}>{a}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:12, marginBottom:16 }}>
                <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:'14px 16px' }}>
                  <div style={{ fontSize:11, color:'#9A9A9A', fontWeight:500, marginBottom:6 }}>Según informe de pagos (vencen este mes)</div>
                  <div style={{ fontSize:20, fontWeight:700, color:'#F0EFEA' }}>{fmtCLP(totalFacturadoMes)}</div>
                </div>
                <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:'14px 16px' }}>
                  <div style={{ fontSize:11, color:'#9A9A9A', fontWeight:500, marginBottom:6 }}>Registrado en Movimientos (categoría Proveedores)</div>
                  <div style={{ fontSize:20, fontWeight:700, color:'#F0EFEA' }}>{fmtCLP(totalRegistradoMes)}</div>
                </div>
                <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:'14px 16px' }}>
                  <div style={{ fontSize:11, color:'#9A9A9A', fontWeight:500, marginBottom:6 }}>Diferencia</div>
                  <div style={{ fontSize:20, fontWeight:700, color: Math.abs(totalFacturadoMes-totalRegistradoMes)<1000 ? '#1D9E75' : '#E24B4A' }}>{fmtCLP(totalFacturadoMes-totalRegistradoMes)}</div>
                </div>
              </div>

              <div style={{ background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, overflow:'hidden' }}>
                <div style={{ padding:'14px 18px 0', fontSize:12, fontWeight:600, color:'#9A9A9A', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                  Cruce por proveedor (aproximado, por coincidencia de nombre en la descripción)
                </div>
                {comparacion.length===0 ? (
                  <div style={{ textAlign:'center', padding:'2rem', color:'#767676' }}>Sin documentos con vencimiento en este mes</div>
                ) : (
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, marginTop:10 }}>
                    <thead>
                      <tr style={{ background:'#1A1A1A' }}>
                        {['Proveedor','Informe de pagos','Registrado en movimientos','Diferencia',''].map(h=>(
                          <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontWeight:500, color:'#9A9A9A', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {comparacion.map((c,i)=>{
                        const coincide = Math.abs(c.diff) < 1000
                        return (
                          <tr key={c.proveedor} style={{ borderBottom:i<comparacion.length-1?'1px solid rgba(255,255,255,0.06)':'none' }}>
                            <td style={{ padding:'10px 14px', fontWeight:500, color:'#F0EFEA' }}>{c.proveedor}</td>
                            <td style={{ padding:'10px 14px', color:'#9A9A9A' }}>{fmtCLP(c.facturado)}</td>
                            <td style={{ padding:'10px 14px', color:'#9A9A9A' }}>{fmtCLP(c.registrado)}</td>
                            <td style={{ padding:'10px 14px', fontWeight:600, color:coincide?'#1D9E75':'#E24B4A' }}>{fmtCLP(c.diff)}</td>
                            <td style={{ padding:'10px 14px' }}>
                              <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, fontWeight:600, background:coincide?'rgba(29,158,117,0.16)':'rgba(226,75,74,0.16)', color:coincide?'#1D9E75':'#E24B4A' }}>
                                {coincide ? '✓ Coincide' : '⚠ Revisar'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
                <div style={{ padding:'8px 14px', fontSize:11, color:'#767676', background:'#141414', marginTop:8 }}>
                  💡 El cruce busca el nombre del proveedor dentro de la descripción de cada movimiento. Es una aproximación — verifica manualmente los casos marcados "Revisar" antes de dar por conciliado un pago.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const sel: React.CSSProperties     = { fontSize:13, padding:'6px 10px', border:'1px solid rgba(255,255,255,0.14)', borderRadius:8, background:'#161616' }
const btnP: React.CSSProperties    = { display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, border:'none', background:'#B8912E', color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer' }
const btnSec: React.CSSProperties  = { display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'7px 14px', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', border:'1px solid rgba(255,255,255,0.14)', background:'#161616', color:'#C9C9C9', width:'100%' }
const lbl: React.CSSProperties     = { display:'block', fontSize:12, fontWeight:500, color:'#9A9A9A', marginBottom:4 }
const inp: React.CSSProperties     = { width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid rgba(255,255,255,0.16)', borderRadius:8, background:'#161616', color:'#F0EFEA', fontFamily:'DM Sans, sans-serif' }
const iconBtn: React.CSSProperties = { background:'transparent', border:'none', cursor:'pointer', padding:'4px 6px', borderRadius:6, fontSize:14 }
