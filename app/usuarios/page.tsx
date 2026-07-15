'use client'
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

const ROLES = {
  admin:    { label:'Administrador', color:'#7F77DD', bg:'#EEEDFE', tx:'#3C3489', icon:'👑', desc:'Acceso total a todos los módulos' },
  contador: { label:'Contador',      color:'#1D9E75', bg:'#E1F5EE', tx:'#085041', icon:'🧮', desc:'Movimientos, facturas, bancos y reportes' },
  gerente:  { label:'Gerente',       color:'#3266ad', bg:'#E6F1FB', tx:'#0C447C', icon:'💼', desc:'Dashboard, presupuesto, reportes y proyecciones' },
  lectura:  { label:'Solo lectura',  color:'#888780', bg:'#f1f5f9', tx:'#374151', icon:'👁️', desc:'Solo puede ver dashboard y reportes' },
}

type Rol = keyof typeof ROLES
type Perfil = {
  id: string
  nombre: string
  email: string
  rol: Rol
  activa: boolean
  created_at?: string
}
type Empresa = { id: string; nombre_corto: string; color: string }

function initials(nombre: string) {
  return nombre.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
}

export default function UsuariosPage() {
  const [perfiles,  setPerfiles]  = useState<Perfil[]>([])
  const [empresas,  setEmpresas]  = useState<Empresa[]>([])
  const [cargando,  setCargando]  = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error,     setError]     = useState('')
  const [exito,     setExito]     = useState('')
  const [tab,       setTab]       = useState<'usuarios'|'roles'>('usuarios')
  const [showForm,  setShowForm]  = useState(false)

  // Form
  const [fNombre, setFNombre] = useState('')
  const [fEmail,  setFEmail]  = useState('')
  const [fRol,    setFRol]    = useState<Rol>('gerente')

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setCargando(true)
    try {
      const [{ data: emps }, { data: perfs }] = await Promise.all([
        supabase.from('empresas').select('id,nombre_corto,color').eq('activa',true).order('nombre_corto'),
        supabase.from('perfiles').select('*').order('created_at', { ascending: false }),
      ])
      setEmpresas(emps || [])
      setPerfiles(perfs || [])
    } catch(e: any) {
      setError('Error conectando con la base de datos.')
    } finally { setCargando(false) }
  }

  async function guardarPerfil() {
    if (!fNombre || !fEmail) return
    setGuardando(true)
    try {
      const { error: err } = await supabase.from('perfiles').insert({
        nombre: fNombre,
        email:  fEmail,
        rol:    fRol,
        activa: true,
      })
      if (err) throw err
      await cargarDatos()
      setFNombre(''); setFEmail(''); setFRol('gerente')
      setShowForm(false)
      setExito('✅ Usuario agregado correctamente')
      setTimeout(() => setExito(''), 3000)
    } catch(e: any) {
      setError('Error guardando usuario: ' + e.message)
    } finally { setGuardando(false) }
  }

  async function toggleActivo(id: string, actual: boolean) {
    try {
      await supabase.from('perfiles').update({ activa: !actual }).eq('id', id)
      setPerfiles(prev => prev.map(p => p.id===id ? {...p, activa:!actual} : p))
    } catch(e: any) { setError('Error actualizando.') }
  }

  async function cambiarRol(id: string, rolActual: Rol) {
    const roles: Rol[] = ['admin','contador','gerente','lectura']
    const nuevoRol = roles[(roles.indexOf(rolActual)+1) % roles.length]
    try {
      await supabase.from('perfiles').update({ rol: nuevoRol }).eq('id', id)
      setPerfiles(prev => prev.map(p => p.id===id ? {...p, rol:nuevoRol} : p))
    } catch(e: any) { setError('Error cambiando rol.') }
  }

  async function eliminar(id: string) {
    try {
      await supabase.from('perfiles').delete().eq('id', id)
      setPerfiles(prev => prev.filter(p => p.id !== id))
    } catch(e: any) { setError('Error eliminando.') }
  }

  const activos   = perfiles.filter(p=>p.activa).length
  const inactivos = perfiles.length - activos

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
            <div style={{ fontSize:15, fontWeight:600 }}>Usuarios y roles</div>
            {!cargando && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:'#E1F5EE', color:'#085041', fontWeight:500 }}>🟢 Supabase</span>}
          </div>
          <button onClick={()=>setShowForm(true)} style={btnP}>+ Agregar usuario</button>
        </div>

        <div style={{ padding:'24px 28px' }}>

          {/* Mensajes */}
          {error && (
            <div style={{ background:'#FCEBEB', border:'1px solid #F09595', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#791F1F', marginBottom:16, display:'flex', justifyContent:'space-between' }}>
              <span>⚠️ {error}</span>
              <button onClick={()=>setError('')} style={{ background:'transparent', border:'none', cursor:'pointer', color:'#791F1F' }}>✕</button>
            </div>
          )}
          {exito && (
            <div style={{ background:'#EAF3DE', border:'1px solid #97C459', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#27500A', marginBottom:16 }}>
              {exito}
            </div>
          )}

          {/* Métricas */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:12, marginBottom:24 }}>
            {[
              { label:'Total usuarios', value:perfiles.length, color:'#111827', bg:'#f1f5f9' },
              { label:'Activos',        value:activos,          color:'#1D9E75', bg:'#E1F5EE' },
              { label:'Inactivos',      value:inactivos,        color:'#6b7280', bg:'#f1f5f9' },
              { label:'Roles en uso',   value:new Set(perfiles.map(p=>p.rol)).size, color:'#7F77DD', bg:'#EEEDFE' },
            ].map(m=>(
              <div key={m.label} style={{ background:m.bg, borderRadius:12, padding:'14px 16px' }}>
                <div style={{ fontSize:11, color:m.color, fontWeight:500, marginBottom:4, opacity:0.8 }}>{m.label}</div>
                <div style={{ fontSize:24, fontWeight:700, color:m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:6, marginBottom:20 }}>
            {([
              {k:'usuarios', l:'👥 Usuarios'},
              {k:'roles',    l:'🛡️ Roles'},
            ] as const).map(t=>(
              <button key={t.k} onClick={()=>setTab(t.k)} style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer', border:'1px solid rgba(0,0,0,0.1)', background:tab===t.k?'#eff4ff':'#fff', color:tab===t.k?'#3266ad':'#6b7280', fontWeight:tab===t.k?500:400 }}>
                {t.l}
              </button>
            ))}
          </div>

          {/* ── Tab: Usuarios ── */}
          {tab==='usuarios' && (
            <>
              {/* Formulario */}
              {showForm && (
                <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20, marginBottom:16 }}>
                  <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Agregar usuario</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                    <div><label style={lbl}>Nombre completo</label>
                      <input value={fNombre} onChange={e=>setFNombre(e.target.value)} placeholder="Nombre Apellido" style={inp}/>
                    </div>
                    <div><label style={lbl}>Email</label>
                      <input type="email" value={fEmail} onChange={e=>setFEmail(e.target.value)} placeholder="usuario@correo.cl" style={inp}/>
                    </div>
                    <div>
                      <label style={lbl}>Rol</label>
                      <select value={fRol} onChange={e=>setFRol(e.target.value as Rol)} style={inp}>
                        {(Object.entries(ROLES) as [Rol, typeof ROLES[Rol]][]).map(([k,v])=>(
                          <option key={k} value={k}>{v.icon} {v.label}</option>
                        ))}
                      </select>
                      <div style={{ fontSize:11, color:'#6b7280', marginTop:4, padding:'6px 8px', background:'#f8fafc', borderRadius:6 }}>
                        {ROLES[fRol].desc}
                      </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', justifyContent:'center' }}>
                      <div style={{ fontSize:12, color:'#6b7280', marginBottom:6 }}>Acceso a empresas</div>
                      {empresas.map(e=>(
                        <div key={e.id} style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'#374151', marginBottom:4 }}>
                          <span style={{ width:8, height:8, borderRadius:'50%', background:e.color }}/>
                          {e.nombre_corto}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={guardarPerfil} disabled={guardando} style={{ ...btnP, flex:1, justifyContent:'center', opacity:guardando?0.7:1 }}>
                      {guardando ? 'Guardando...' : '✅ Guardar usuario'}
                    </button>
                    <button onClick={()=>{ setShowForm(false); setFNombre(''); setFEmail('') }} style={{ ...btnSec, width:'auto', padding:'8px 16px' }}>Cancelar</button>
                  </div>
                </div>
              )}

              {cargando && <div style={{ textAlign:'center', padding:'3rem', color:'#9ca3af' }}>⏳ Cargando...</div>}

              {!cargando && perfiles.length===0 && (
                <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:'3rem', textAlign:'center', color:'#9ca3af' }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>👥</div>
                  <div style={{ fontSize:14, fontWeight:500, marginBottom:4 }}>Sin usuarios registrados</div>
                  <div style={{ fontSize:13 }}>Agrega el primer usuario con el botón de arriba</div>
                </div>
              )}

              {/* Lista usuarios */}
              {perfiles.map(p => {
                const r = ROLES[p.rol] || ROLES.lectura
                return (
                  <div key={p.id} style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:18, marginBottom:10, opacity:p.activa?1:0.6 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <div style={{ width:40, height:40, borderRadius:'50%', background:r.bg, color:r.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0 }}>
                          {initials(p.nombre)}
                        </div>
                        <div>
                          <div style={{ fontSize:14, fontWeight:600, color:'#111827' }}>{p.nombre}</div>
                          <div style={{ fontSize:12, color:'#6b7280' }}>{p.email}</div>
                        </div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                        <span style={{ fontSize:11, padding:'2px 9px', borderRadius:999, fontWeight:600, background:r.bg, color:r.tx }}>
                          {r.icon} {r.label}
                        </span>
                        <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, fontWeight:500, background:p.activa?'#E1F5EE':'#f1f5f9', color:p.activa?'#085041':'#6b7280' }}>
                          {p.activa ? 'Activo' : 'Inactivo'}
                        </span>
                        {/* Toggle */}
                        <div onClick={()=>toggleActivo(p.id, p.activa)} style={{ width:36, height:20, borderRadius:10, background:p.activa?'#1D9E75':'#d1d5db', cursor:'pointer', position:'relative', transition:'background 0.2s', flexShrink:0 }}>
                          <div style={{ width:16, height:16, borderRadius:'50%', background:'#fff', position:'absolute', top:2, left:p.activa?18:2, transition:'left 0.2s' }}/>
                        </div>
                        <button onClick={()=>cambiarRol(p.id, p.rol)} title="Cambiar rol" style={iconBtn}>✏️</button>
                        <button onClick={()=>eliminar(p.id)} title="Eliminar" style={iconBtn}>🗑️</button>
                      </div>
                    </div>
                    {p.created_at && (
                      <div style={{ fontSize:11, color:'#9ca3af', marginTop:8 }}>
                        Registrado: {new Date(p.created_at).toLocaleDateString('es-CL')}
                      </div>
                    )}
                  </div>
                )
              })}

              <button onClick={()=>setShowForm(true)} style={{ ...btnP, width:'100%', justifyContent:'center', marginTop:4 }}>
                + Agregar usuario
              </button>
            </>
          )}

          {/* ── Tab: Roles ── */}
          {tab==='roles' && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:14 }}>
              {(Object.entries(ROLES) as [Rol, typeof ROLES[Rol]][]).map(([key, r])=>{
                const count = perfiles.filter(p=>p.rol===key).length
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
                    </div>
                    <div style={{ fontSize:12, color:'#6b7280', lineHeight:1.6, marginBottom:12 }}>{r.desc}</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      {perfiles.filter(p=>p.rol===key).map(p=>(
                        <span key={p.id} style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:r.bg, color:r.tx, fontWeight:500 }}>
                          {initials(p.nombre)} {p.nombre.split(' ')[0]}
                        </span>
                      ))}
                      {count===0 && <span style={{ fontSize:11, color:'#9ca3af' }}>Sin usuarios asignados</span>}
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

const btnP: React.CSSProperties    = { display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, border:'none', background:'#3266ad', color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer' }
const btnSec: React.CSSProperties  = { display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'7px 14px', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', border:'1px solid rgba(0,0,0,0.12)', background:'#fff', color:'#374151', width:'100%' }
const lbl: React.CSSProperties     = { display:'block', fontSize:12, fontWeight:500, color:'#6b7280', marginBottom:4 }
const inp: React.CSSProperties     = { width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid rgba(0,0,0,0.14)', borderRadius:8, background:'#fff', color:'#111827', fontFamily:'DM Sans, sans-serif' }
const iconBtn: React.CSSProperties = { background:'transparent', border:'none', cursor:'pointer', padding:'4px 6px', borderRadius:6, fontSize:14 }
