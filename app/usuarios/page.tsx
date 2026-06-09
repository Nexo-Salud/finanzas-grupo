'use client'
import { useState } from 'react'
import Link from 'next/link'

type Rol = 'admin' | 'contador' | 'gerente' | 'lectura'
type Usuario = {
  id: string
  nombre: string
  email: string
  rol: Rol
  empresas: string[]
  activo: boolean
  ultimo: string
}

const NAV = [
  { href:'/',             label:'Dashboard',    icon:'▦'  },
  { href:'/movimientos',  label:'Movimientos',  icon:'↕'  },
  { href:'/presupuesto',  label:'Presupuesto',  icon:'🎯' },
  { href:'/alertas',      label:'Alertas',      icon:'🔔' },
  { href:'/reportes',     label:'Reportes',     icon:'📄' },
  { href:'/bancos',       label:'Bancos',       icon:'🏦' },
  { href:'/tributario',   label:'Documentos',   icon:'🧾' },
  { href:'/proyecciones', label:'Proyecciones', icon:'📈' },
  { href:'/usuarios',     label:'Usuarios',     icon:'👥', active:true },
  { href:'/kpis',         label:'KPIs',         icon:'📊' },
  { href:'/ia',           label:'Análisis IA',  icon:'🧠' },
]

const ROLES: Record<Rol, { label:string; color:string; bg:string; tx:string; icon:string; desc:string; perms:Record<string,boolean> }> = {
  admin:    { label:'Administrador', color:'#7F77DD', bg:'#EEEDFE', tx:'#3C3489', icon:'👑',
    desc:'Acceso total a todos los módulos y configuración del sistema.',
    perms:{ Dashboard:true, Movimientos:true, Presupuesto:true, Reportes:true, Bancos:true, Documentos:true, Proyecciones:true, Usuarios:true, KPIs:true, 'Análisis IA':true } },
  contador: { label:'Contador',      color:'#1D9E75', bg:'#E1F5EE', tx:'#085041', icon:'🧮',
    desc:'Acceso a movimientos, facturas, bancos y reportes. Sin acceso a usuarios ni configuración.',
    perms:{ Dashboard:true, Movimientos:true, Presupuesto:true, Reportes:true, Bancos:true, Documentos:true, Proyecciones:false, Usuarios:false, KPIs:true, 'Análisis IA':false } },
  gerente:  { label:'Gerente',       color:'#3266ad', bg:'#E6F1FB', tx:'#0C447C', icon:'💼',
    desc:'Ve dashboard, presupuesto, reportes y proyecciones. No accede a movimientos ni tributario.',
    perms:{ Dashboard:true, Movimientos:false, Presupuesto:true, Reportes:true, Bancos:false, Documentos:false, Proyecciones:true, Usuarios:false, KPIs:true, 'Análisis IA':true } },
  lectura:  { label:'Solo lectura',  color:'#888780', bg:'#f1f5f9', tx:'#374151', icon:'👁️',
    desc:'Solo puede ver el dashboard y reportes. No puede crear ni modificar nada.',
    perms:{ Dashboard:true, Movimientos:false, Presupuesto:false, Reportes:true, Bancos:false, Documentos:false, Proyecciones:false, Usuarios:false, KPIs:false, 'Análisis IA':false } },
}

const EMPRESAS = ['Empresa A', 'Empresa B', 'Empresa C']

const ACTIVIDAD = [
  { usuario:'Carlos Mendoza', accion:'Generó reporte PDF Empresa A — Mayo 2025', fecha:'Hoy 09:14',    color:'#7F77DD' },
  { usuario:'Ana Torres',     accion:'Registró 3 facturas recibidas Empresa B',  fecha:'Hoy 08:50',    color:'#1D9E75' },
  { usuario:'Ana Torres',     accion:'Concilió 5 movimientos Empresa A',         fecha:'Ayer 17:45',   color:'#1D9E75' },
  { usuario:'Roberto Silva',  accion:'Consultó dashboard consolidado',           fecha:'Ayer 17:30',   color:'#3266ad' },
  { usuario:'Sofía Rojas',    accion:'Revisó proyección de caja Empresa C',      fecha:'Ayer 11:20',   color:'#3266ad' },
  { usuario:'Carlos Mendoza', accion:'Agregó cuenta bancaria Empresa A',         fecha:'Ayer 10:05',   color:'#7F77DD' },
  { usuario:'Ana Torres',     accion:'Exportó resumen IVA junio 2025',           fecha:'01 Jun 16:30', color:'#1D9E75' },
  { usuario:'Carlos Mendoza', accion:'Invitó a Pedro Núñez como Solo lectura',   fecha:'01 Jun 09:00', color:'#7F77DD' },
]

function initials(nombre: string) {
  return nombre.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([
    { id:'1', nombre:'Carlos Mendoza', email:'carlos@grupo.cl',  rol:'admin',    empresas:['Empresa A','Empresa B','Empresa C'], activo:true,  ultimo:'Hoy 09:14' },
    { id:'2', nombre:'Ana Torres',     email:'ana@contador.cl',  rol:'contador', empresas:['Empresa A','Empresa B','Empresa C'], activo:true,  ultimo:'Hoy 08:50' },
    { id:'3', nombre:'Roberto Silva',  email:'roberto@grupo.cl', rol:'gerente',  empresas:['Empresa A'],                        activo:true,  ultimo:'Ayer 17:30' },
    { id:'4', nombre:'Sofía Rojas',    email:'sofia@grupo.cl',   rol:'gerente',  empresas:['Empresa B','Empresa C'],             activo:true,  ultimo:'Ayer 11:20' },
    { id:'5', nombre:'Pedro Núñez',    email:'pedro@grupo.cl',   rol:'lectura',  empresas:['Empresa A'],                        activo:false, ultimo:'01 Jun 15:00' },
  ])

  const [tab,       setTab]       = useState<'usuarios'|'roles'|'actividad'>('usuarios')
  const [showForm,  setShowForm]  = useState(false)
  const [fNombre,   setFNombre]   = useState('')
  const [fEmail,    setFEmail]    = useState('')
  const [fRol,      setFRol]      = useState<Rol>('gerente')
  const [fEmpresas, setFEmpresas] = useState<string[]>(['Empresa A'])

  const activos   = usuarios.filter(u=>u.activo).length
  const inactivos = usuarios.length - activos

  function toggleActivo(id: string) {
    setUsuarios(prev => prev.map(u => u.id===id ? {...u, activo:!u.activo} : u))
  }
  function cambiarRol(id: string) {
    const roles: Rol[] = ['admin','contador','gerente','lectura']
    setUsuarios(prev => prev.map(u => {
      if (u.id !== id) return u
      const idx = roles.indexOf(u.rol)
      return { ...u, rol: roles[(idx+1)%roles.length] }
    }))
  }
  function eliminar(id: string) {
    setUsuarios(prev => prev.filter(u => u.id !== id))
  }
  function toggleEmpresa(emp: string) {
    setFEmpresas(prev => prev.includes(emp) ? prev.filter(e=>e!==emp) : [...prev, emp])
  }
  function invitar() {
    if (!fNombre || !fEmail) return
    setUsuarios(prev => [...prev, {
      id: Date.now().toString(), nombre:fNombre, email:fEmail,
      rol:fRol, empresas:fEmpresas.length?fEmpresas:['Empresa A'],
      activo:true, ultimo:'Invitación enviada',
    }])
    setFNombre(''); setFEmail(''); setShowForm(false)
  }

  const rolInfo = ROLES[fRol]

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
          <div style={{ fontSize:15, fontWeight:600 }}>Usuarios y roles</div>
          <button onClick={()=>{setShowForm(true);setTab('usuarios')}} style={btnP}>
            + Invitar usuario
          </button>
        </div>

        <div style={{ padding:'24px 28px' }}>

          {/* Métricas */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:12, marginBottom:24 }}>
            {[
              { label:'Total usuarios', value:usuarios.length, color:'#111827', bg:'#f1f5f9' },
              { label:'Activos',        value:activos,          color:'#1D9E75', bg:'#E1F5EE' },
              { label:'Inactivos',      value:inactivos,        color:'#6b7280', bg:'#f1f5f9' },
              { label:'Roles en uso',   value:new Set(usuarios.map(u=>u.rol)).size, color:'#7F77DD', bg:'#EEEDFE' },
            ].map(m => (
              <div key={m.label} style={{ background:m.bg, borderRadius:12, padding:'14px 16px' }}>
                <div style={{ fontSize:11, color:m.color, fontWeight:500, marginBottom:4, opacity:0.8 }}>{m.label}</div>
                <div style={{ fontSize:24, fontWeight:700, color:m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:6, marginBottom:20 }}>
            {([
              { key:'usuarios',  label:'👥 Usuarios'  },
              { key:'roles',     label:'🛡️ Roles'     },
              { key:'actividad', label:'📋 Actividad' },
            ] as const).map(t => (
              <button key={t.key} onClick={()=>setTab(t.key)} style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer', border:'1px solid rgba(0,0,0,0.1)', background:tab===t.key?'#eff4ff':'#fff', color:tab===t.key?'#3266ad':'#6b7280', fontWeight:tab===t.key?500:400 }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Tab: Usuarios ── */}
          {tab === 'usuarios' && (
            <>
              {/* Formulario invitar */}
              {showForm && (
                <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20, marginBottom:16 }}>
                  <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>✉️ Invitar nuevo usuario</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                    <div><label style={lbl}>Nombre completo</label><input value={fNombre} onChange={e=>setFNombre(e.target.value)} placeholder="Nombre Apellido" style={inp}/></div>
                    <div><label style={lbl}>Email</label><input type="email" value={fEmail} onChange={e=>setFEmail(e.target.value)} placeholder="usuario@correo.cl" style={inp}/></div>
                    <div>
                      <label style={lbl}>Rol</label>
                      <select value={fRol} onChange={e=>setFRol(e.target.value as Rol)} style={inp}>
                        {(Object.entries(ROLES) as [Rol, typeof ROLES[Rol]][]).map(([k,v]) => (
                          <option key={k} value={k}>{v.icon} {v.label}</option>
                        ))}
                      </select>
                      <div style={{ fontSize:11, color:'#6b7280', marginTop:4, padding:'6px 8px', background:'#f8fafc', borderRadius:6 }}>
                        {rolInfo.desc}
                      </div>
                    </div>
                    <div>
                      <label style={lbl}>Acceso a empresas</label>
                      {EMPRESAS.map(emp => (
                        <label key={emp} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#374151', marginBottom:6, cursor:'pointer' }}>
                          <input type="checkbox" checked={fEmpresas.includes(emp)} onChange={()=>toggleEmpresa(emp)} style={{ accentColor:'#3266ad' }}/>
                          {emp}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={invitar} style={{ ...btnP, flex:1, justifyContent:'center' }}>✉️ Enviar invitación</button>
                    <button onClick={()=>setShowForm(false)} style={{ ...btnSec, width:'auto', padding:'8px 16px' }}>Cancelar</button>
                  </div>
                </div>
              )}

              {/* Lista usuarios */}
              {usuarios.map(u => {
                const r = ROLES[u.rol]
                return (
                  <div key={u.id} style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:18, marginBottom:10, opacity: u.activo ? 1 : 0.65 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10, marginBottom:12 }}>
                      {/* Avatar + info */}
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <div style={{ width:40, height:40, borderRadius:'50%', background:r.bg, color:r.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0 }}>
                          {initials(u.nombre)}
                        </div>
                        <div>
                          <div style={{ fontSize:14, fontWeight:600, color:'#111827' }}>{u.nombre}</div>
                          <div style={{ fontSize:12, color:'#6b7280' }}>{u.email}</div>
                        </div>
                      </div>
                      {/* Controles */}
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                        <span style={{ fontSize:11, padding:'2px 9px', borderRadius:999, fontWeight:600, background:r.bg, color:r.tx }}>
                          {r.icon} {r.label}
                        </span>
                        <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, fontWeight:500, background:u.activo?'#E1F5EE':'#f1f5f9', color:u.activo?'#085041':'#6b7280' }}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </span>
                        {/* Toggle */}
                        <div onClick={()=>toggleActivo(u.id)} title="Activar/desactivar" style={{ width:36, height:20, borderRadius:10, background:u.activo?'#1D9E75':'#d1d5db', cursor:'pointer', position:'relative', transition:'background 0.2s', flexShrink:0 }}>
                          <div style={{ width:16, height:16, borderRadius:'50%', background:'#fff', position:'absolute', top:2, left:u.activo?18:2, transition:'left 0.2s' }}/>
                        </div>
                        <button onClick={()=>cambiarRol(u.id)} title="Cambiar rol" style={iconBtn}>✏️</button>
                        <button onClick={()=>eliminar(u.id)} title="Eliminar" style={iconBtn}>🗑️</button>
                      </div>
                    </div>
                    {/* Empresas */}
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                      <span style={{ fontSize:11, color:'#9ca3af' }}>Acceso:</span>
                      {u.empresas.map(e => (
                        <span key={e} style={{ fontSize:11, padding:'2px 8px', borderRadius:999, fontWeight:500,
                          background: e==='Empresa A'?'#E6F1FB':e==='Empresa B'?'#E1F5EE':'#FAEEDA',
                          color: e==='Empresa A'?'#0C447C':e==='Empresa B'?'#085041':'#633806' }}>
                          {e}
                        </span>
                      ))}
                    </div>
                    {/* Permisos */}
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      {Object.entries(r.perms).map(([mod, ok]) => (
                        <span key={mod} style={{ fontSize:11, padding:'2px 7px', borderRadius:6, background: ok?r.bg:'#f1f5f9', color: ok?r.tx:'#9ca3af', fontWeight: ok?500:400, opacity: ok?1:0.6 }}>
                          {ok ? '✓' : '✗'} {mod}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize:11, color:'#9ca3af', marginTop:8 }}>⏱ Último acceso: {u.ultimo}</div>
                  </div>
                )
              })}

              <button onClick={()=>setShowForm(true)} style={{ ...btnP, width:'100%', justifyContent:'center', marginTop:4 }}>
                + Invitar nuevo usuario
              </button>
            </>
          )}

          {/* ── Tab: Roles ── */}
          {tab === 'roles' && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:14 }}>
              {(Object.entries(ROLES) as [Rol, typeof ROLES[Rol]][]).map(([key, r]) => {
                const count = usuarios.filter(u=>u.rol===key).length
                return (
                  <div key={key} style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:18 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                      <div style={{ width:36, height:36, borderRadius:'50%', background:r.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
                        {r.icon}
                      </div>
                      <div>
                        <div style={{ fontSize:14, fontWeight:600, color:'#111827' }}>{r.label}</div>
                        <div style={{ fontSize:12, color:'#6b7280' }}>{count} usuario{count!==1?'s':''}</div>
                      </div>
                      <span style={{ marginLeft:'auto', fontSize:11, padding:'2px 8px', borderRadius:999, fontWeight:600, background:r.bg, color:r.tx }}>{r.label}</span>
                    </div>
                    <div style={{ fontSize:12, color:'#6b7280', marginBottom:12, lineHeight:1.5 }}>{r.desc}</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      {Object.entries(r.perms).map(([mod, ok]) => (
                        <span key={mod} style={{ fontSize:11, padding:'2px 7px', borderRadius:6, background:ok?r.bg:'#f1f5f9', color:ok?r.tx:'#9ca3af', fontWeight:ok?500:400 }}>
                          {ok?'✓':'✗'} {mod}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Tab: Actividad ── */}
          {tab === 'actividad' && (
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:'4px 20px' }}>
              {ACTIVIDAD.map((a, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 0', borderBottom: i<ACTIVIDAD.length-1?'1px solid rgba(0,0,0,0.06)':'none', flexWrap:'wrap', gap:10 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:a.color, flexShrink:0 }}/>
                  <div style={{ flex:1 }}>
                    <span style={{ fontSize:13, fontWeight:500, color:'#111827' }}>{a.usuario}</span>
                    <span style={{ fontSize:12, color:'#6b7280' }}> — {a.accion}</span>
                  </div>
                  <span style={{ fontSize:11, color:'#9ca3af', whiteSpace:'nowrap', flexShrink:0 }}>{a.fecha}</span>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

const btnP: React.CSSProperties   = { display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, border:'none', background:'#3266ad', color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer' }
const btnSec: React.CSSProperties = { display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'7px 14px', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', border:'1px solid rgba(0,0,0,0.12)', background:'#fff', color:'#374151', width:'100%' }
const lbl: React.CSSProperties    = { display:'block', fontSize:12, fontWeight:500, color:'#6b7280', marginBottom:4 }
const inp: React.CSSProperties    = { width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid rgba(0,0,0,0.14)', borderRadius:8, background:'#fff', color:'#111827', fontFamily:'DM Sans, sans-serif' }
const iconBtn: React.CSSProperties = { background:'transparent', border:'none', cursor:'pointer', fontSize:15, padding:'4px 6px', borderRadius:6 }
