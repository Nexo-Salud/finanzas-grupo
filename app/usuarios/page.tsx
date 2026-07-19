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
  { href:'/estados',      label:'Est. Financ.', icon:'📑' },
  { href:'/bancos',       label:'Bancos',       icon:'🏦' },
  { href:'/tributario',   label:'Documentos',   icon:'🧾' },
  { href:'/proyecciones', label:'Proyecciones', icon:'📈' },
  { href:'/usuarios',     label:'Usuarios',     icon:'👥', active:true },
  { href:'/kpis',         label:'KPIs',         icon:'📊' },
  { href:'/ia',           label:'Análisis IA',  icon:'🧠' },
]

const ROLES = {
  admin:    { label:'Administrador', color:'#7F77DD', bg:'#EEEDFE', tx:'#3C3489', icon:'👑', desc:'Acceso total a todos los módulos y empresas' },
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
  empresas_permitidas: string[]
  created_at?: string
}
type Empresa = { id: string; nombre_corto: string; nombre: string; color: string }

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
  const [tab,       setTab]       = useState<'usuarios'|'roles'|'permisos'>('usuarios')
  const [showForm,  setShowForm]  = useState(false)
  const [editando,  setEditando]  = useState<Perfil|null>(null)

  // Form
  const [fNombre,    setFNombre]    = useState('')
  const [fEmail,     setFEmail]     = useState('')
  const [fRol,       setFRol]       = useState<Rol>('gerente')
  const [fEmpresas,  setFEmpresas]  = useState<string[]>([])
  const [fTodas,     setFTodas]     = useState(false)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setCargando(true)
    try {
      const [{ data: emps }, { data: perfs }] = await Promise.all([
        supabase.from('empresas').select('id,nombre_corto,nombre,color').eq('activa',true).order('nombre_corto'),
        supabase.from('usuarios_plataforma').select('*').order('created_at', { ascending: false }),
      ])
      setEmpresas(emps || [])
      setPerfiles((perfs || []).map(p => ({
        ...p,
        empresas_permitidas: p.empresas_permitidas || []
      })))
    } catch(e: any) {
      setError('Error conectando con la base de datos.')
    } finally { setCargando(false) }
  }

  function abrirFormNuevo() {
    setEditando(null)
    setFNombre(''); setFEmail(''); setFRol('gerente')
    setFEmpresas([]); setFTodas(false)
    setShowForm(true)
  }

  function abrirFormEditar(p: Perfil) {
    setEditando(p)
    setFNombre(p.nombre); setFEmail(p.email); setFRol(p.rol)
    const todasEmps = empresas.map(e=>e.id)
    const tieneTodasEmps = todasEmps.every(id => p.empresas_permitidas.includes(id))
    setFTodas(tieneTodasEmps || p.empresas_permitidas.length === 0)
    setFEmpresas(p.empresas_permitidas)
    setShowForm(true)
    setTab('usuarios')
  }

  function toggleEmpresa(id: string) {
    setFEmpresas(prev => prev.includes(id) ? prev.filter(e=>e!==id) : [...prev, id])
  }

  async function guardarPerfil() {
    if (!fNombre || !fEmail) return
    setGuardando(true)
    const empresasGuardar = fTodas ? empresas.map(e=>e.id) : fEmpresas
    const datos = {
      nombre: fNombre,
      email:  fEmail,
      rol:    fRol,
      activa: true,
      empresas_permitidas: empresasGuardar,
    }
    try {
      if (editando) {
        const { error: err } = await supabase.from('usuarios_plataforma').update(datos).eq('id', editando.id)
        if (err) throw err
        setExito('✅ Usuario actualizado correctamente')
      } else {
        const { error: err } = await supabase.from('usuarios_plataforma').insert(datos)
        if (err) throw err
        setExito('✅ Usuario agregado correctamente')
      }
      await cargarDatos()
      setShowForm(false); setEditando(null)
      setFNombre(''); setFEmail('')
      setTimeout(() => setExito(''), 3000)
    } catch(e: any) {
      setError('Error guardando: ' + e.message)
    } finally { setGuardando(false) }
  }

  async function toggleActivo(id: string, actual: boolean) {
    try {
      await supabase.from('usuarios_plataforma').update({ activa: !actual }).eq('id', id)
      setPerfiles(prev => prev.map(p => p.id===id ? {...p, activa:!actual} : p))
    } catch(e: any) { setError('Error actualizando.') }
  }

  async function eliminar(id: string) {
    try {
      await supabase.from('usuarios_plataforma').delete().eq('id', id)
      setPerfiles(prev => prev.filter(p => p.id !== id))
    } catch(e: any) { setError('Error eliminando.') }
  }

  async function actualizarEmpresas(id: string, nuevasEmpresas: string[]) {
    try {
      await supabase.from('usuarios_plataforma').update({ empresas_permitidas: nuevasEmpresas }).eq('id', id)
      setPerfiles(prev => prev.map(p => p.id===id ? {...p, empresas_permitidas:nuevasEmpresas} : p))
      setExito('✅ Permisos actualizados')
      setTimeout(() => setExito(''), 2000)
    } catch(e: any) { setError('Error actualizando permisos.') }
  }

  const empNombre = (id: string) => empresas.find(e=>e.id===id)?.nombre_corto || id
  const empColor  = (id: string) => empresas.find(e=>e.id===id)?.color || '#888780'
  const activos   = perfiles.filter(p=>p.activa).length

  const tieneAcceso = (p: Perfil, empId: string) => {
    if (p.rol === 'admin') return true
    if (!p.empresas_permitidas || p.empresas_permitidas.length === 0) return true
    return p.empresas_permitidas.includes(empId)
  }

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
            <div style={{ fontSize:15, fontWeight:600 }}>Usuarios y permisos</div>
            {!cargando && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:'#E1F5EE', color:'#085041', fontWeight:500 }}>🟢 Supabase</span>}
          </div>
          <button onClick={abrirFormNuevo} style={btnP}>+ Agregar usuario</button>
        </div>

        <div style={{ padding:'24px 28px' }}>

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
              { label:'Con restricción',value:perfiles.filter(p=>p.empresas_permitidas?.length>0&&p.rol!=='admin').length, color:'#BA7517', bg:'#FAEEDA' },
              { label:'Acceso total',   value:perfiles.filter(p=>p.rol==='admin'||!p.empresas_permitidas?.length).length, color:'#7F77DD', bg:'#EEEDFE' },
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
              {k:'permisos', l:'🏢 Permisos por empresa'},
              {k:'roles',    l:'🛡️ Roles'},
            ] as const).map(t=>(
              <button key={t.k} onClick={()=>setTab(t.k)} style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer', border:'1px solid rgba(0,0,0,0.1)', background:tab===t.k?'#eff4ff':'#fff', color:tab===t.k?'#3266ad':'#6b7280', fontWeight:tab===t.k?500:400 }}>
                {t.l}
              </button>
            ))}
          </div>

          {/* ── Formulario ── */}
          {showForm && (
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20, marginBottom:16 }}>
              <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>
                {editando ? `Editando — ${editando.nombre}` : 'Agregar usuario'}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                <div><label style={lbl}>Nombre completo</label>
                  <input value={fNombre} onChange={e=>setFNombre(e.target.value)} placeholder="Nombre Apellido" style={inp}/>
                </div>
                <div><label style={lbl}>Email</label>
                  <input type="email" value={fEmail} onChange={e=>setFEmail(e.target.value)} placeholder="usuario@correo.cl" style={inp}/>
                </div>
                <div><label style={lbl}>Rol</label>
                  <select value={fRol} onChange={e=>setFRol(e.target.value as Rol)} style={inp}>
                    {(Object.entries(ROLES) as [Rol, typeof ROLES[Rol]][]).map(([k,v])=>(
                      <option key={k} value={k}>{v.icon} {v.label}</option>
                    ))}
                  </select>
                  <div style={{ fontSize:11, color:'#6b7280', marginTop:4, padding:'6px 8px', background:'#f8fafc', borderRadius:6 }}>
                    {ROLES[fRol].desc}
                  </div>
                </div>
                <div>
                  <label style={lbl}>Acceso a empresas</label>
                  {fRol === 'admin' ? (
                    <div style={{ fontSize:12, color:'#7F77DD', padding:'8px', background:'#EEEDFE', borderRadius:8 }}>
                      👑 Administrador — acceso automático a todas las empresas
                    </div>
                  ) : (
                    <>
                      <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#374151', marginBottom:8, cursor:'pointer', padding:'8px', background:'#f8fafc', borderRadius:8, border:'1px solid #e5e7eb' }}>
                        <input type="checkbox" checked={fTodas} onChange={e=>{ setFTodas(e.target.checked); if(e.target.checked) setFEmpresas([]) }} style={{ accentColor:'#3266ad' }}/>
                        <strong>Todas las empresas</strong>
                      </label>
                      {!fTodas && (
                        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                          {empresas.map(e=>(
                            <label key={e.id} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#374151', cursor:'pointer', padding:'8px 10px', borderRadius:8, border:`1.5px solid ${fEmpresas.includes(e.id)?e.color:'#e5e7eb'}`, background:fEmpresas.includes(e.id)?e.color+'11':'#fff' }}>
                              <input type="checkbox" checked={fEmpresas.includes(e.id)} onChange={()=>toggleEmpresa(e.id)} style={{ accentColor:e.color }}/>
                              <span style={{ width:10, height:10, borderRadius:'50%', background:e.color, flexShrink:0 }}/>
                              {e.nombre_corto}
                            </label>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={guardarPerfil} disabled={guardando} style={{ ...btnP, flex:1, justifyContent:'center', opacity:guardando?0.7:1 }}>
                  {guardando ? 'Guardando...' : editando ? '💾 Guardar cambios' : '✅ Agregar usuario'}
                </button>
                <button onClick={()=>{ setShowForm(false); setEditando(null) }} style={{ ...btnSec, width:'auto', padding:'8px 16px' }}>Cancelar</button>
              </div>
            </div>
          )}

          {cargando && <div style={{ textAlign:'center', padding:'3rem', color:'#9ca3af' }}>⏳ Cargando...</div>}

          {/* ── Tab: Usuarios ── */}
          {!cargando && tab==='usuarios' && (
            <>
              {perfiles.length===0 && (
                <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:'3rem', textAlign:'center', color:'#9ca3af' }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>👥</div>
                  <div style={{ fontSize:14, fontWeight:500 }}>Sin usuarios — agrega el primero</div>
                </div>
              )}
              {perfiles.map(p => {
                const r = ROLES[p.rol] || ROLES.lectura
                const tieneRestr = p.rol !== 'admin' && p.empresas_permitidas?.length > 0
                return (
                  <div key={p.id} style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:18, marginBottom:10, opacity:p.activa?1:0.6 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10, marginBottom:tieneRestr?12:0 }}>
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
                        <div onClick={()=>toggleActivo(p.id, p.activa)} style={{ width:36, height:20, borderRadius:10, background:p.activa?'#1D9E75':'#d1d5db', cursor:'pointer', position:'relative', transition:'background 0.2s', flexShrink:0 }}>
                          <div style={{ width:16, height:16, borderRadius:'50%', background:'#fff', position:'absolute', top:2, left:p.activa?18:2, transition:'left 0.2s' }}/>
                        </div>
                        <button onClick={()=>abrirFormEditar(p)} title="Editar" style={iconBtn}>✏️</button>
                        <button onClick={()=>eliminar(p.id)} title="Eliminar" style={iconBtn}>🗑️</button>
                      </div>
                    </div>

                    {/* Empresas con acceso */}
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginTop:tieneRestr||p.rol==='admin'?8:0 }}>
                      {p.rol === 'admin' ? (
                        <span style={{ fontSize:11, color:'#7F77DD', fontWeight:500 }}>👑 Acceso a todas las empresas</span>
                      ) : p.empresas_permitidas?.length === 0 ? (
                        <span style={{ fontSize:11, color:'#6b7280' }}>🌐 Acceso a todas las empresas</span>
                      ) : (
                        <>
                          <span style={{ fontSize:11, color:'#9ca3af' }}>Acceso:</span>
                          {p.empresas_permitidas.map(id=>(
                            <span key={id} style={{ fontSize:11, padding:'2px 8px', borderRadius:999, fontWeight:500, background:empColor(id)+'22', color:empColor(id), border:`1px solid ${empColor(id)}44` }}>
                              {empNombre(id)}
                            </span>
                          ))}
                          <span style={{ fontSize:11, color:'#E24B4A', fontWeight:500, marginLeft:4 }}>
                            🔒 Restringido
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
              <button onClick={abrirFormNuevo} style={{ ...btnP, width:'100%', justifyContent:'center', marginTop:4 }}>
                + Agregar usuario
              </button>
            </>
          )}

          {/* ── Tab: Permisos por empresa ── */}
          {!cargando && tab==='permisos' && (
            <>
              <div style={{ background:'#eff4ff', border:'1px solid #c7d7f5', borderRadius:10, padding:'10px 14px', fontSize:12, color:'#3266ad', marginBottom:16 }}>
                🏢 <strong>Panel de acceso:</strong> Marca qué empresas puede ver cada usuario. Los administradores siempre tienen acceso a todo.
              </div>

              {/* Tabla de permisos */}
              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, overflow:'hidden' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'#f8fafc' }}>
                      <th style={{ textAlign:'left', padding:'12px 16px', fontSize:12, fontWeight:600, color:'#6b7280', borderBottom:'1px solid rgba(0,0,0,0.07)' }}>
                        Usuario
                      </th>
                      {empresas.map(e=>(
                        <th key={e.id} style={{ textAlign:'center', padding:'12px 16px', fontSize:12, fontWeight:600, color:e.color, borderBottom:'1px solid rgba(0,0,0,0.07)', whiteSpace:'nowrap' as const }}>
                          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                            <div style={{ width:10, height:10, borderRadius:'50%', background:e.color }}/>
                            {e.nombre_corto}
                          </div>
                        </th>
                      ))}
                      <th style={{ textAlign:'center', padding:'12px 16px', fontSize:12, fontWeight:600, color:'#6b7280', borderBottom:'1px solid rgba(0,0,0,0.07)' }}>
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {perfiles.map((p,i)=>{
                      const r = ROLES[p.rol] || ROLES.lectura
                      return (
                        <tr key={p.id} style={{ borderBottom:i<perfiles.length-1?'1px solid rgba(0,0,0,0.06)':'none', opacity:p.activa?1:0.5 }}>
                          <td style={{ padding:'12px 16px' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                              <div style={{ width:32, height:32, borderRadius:'50%', background:r.bg, color:r.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 }}>
                                {initials(p.nombre)}
                              </div>
                              <div>
                                <div style={{ fontSize:13, fontWeight:500, color:'#111827' }}>{p.nombre}</div>
                                <span style={{ fontSize:10, padding:'1px 6px', borderRadius:999, background:r.bg, color:r.tx, fontWeight:500 }}>{r.icon} {r.label}</span>
                              </div>
                            </div>
                          </td>
                          {empresas.map(e=>{
                            const acceso = tieneAcceso(p, e.id)
                            const esAdmin = p.rol === 'admin'
                            return (
                              <td key={e.id} style={{ textAlign:'center', padding:'12px 16px' }}>
                                {esAdmin ? (
                                  <span style={{ fontSize:18 }} title="Admin — acceso siempre">👑</span>
                                ) : (
                                  <div
                                    onClick={()=>{
                                      if (!p.activa) return
                                      const tieneEmp = p.empresas_permitidas?.includes(e.id)
                                      let nuevas: string[]
                                      if (p.empresas_permitidas?.length === 0) {
                                        // Tiene acceso a todas → restringir a las que NO sea esta
                                        nuevas = empresas.filter(emp=>emp.id!==e.id).map(emp=>emp.id)
                                      } else if (tieneEmp) {
                                        nuevas = p.empresas_permitidas.filter(id=>id!==e.id)
                                      } else {
                                        nuevas = [...(p.empresas_permitidas||[]), e.id]
                                      }
                                      actualizarEmpresas(p.id, nuevas)
                                    }}
                                    style={{ width:28, height:28, borderRadius:8, background:acceso?e.color+'22':'#f1f5f9', border:`2px solid ${acceso?e.color:'#e5e7eb'}`, cursor:p.activa?'pointer':'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto', transition:'all 0.15s' }}
                                    title={acceso?`Quitar acceso a ${e.nombre_corto}`:`Dar acceso a ${e.nombre_corto}`}
                                  >
                                    {acceso ? (
                                      <span style={{ color:e.color, fontSize:14, fontWeight:700 }}>✓</span>
                                    ) : (
                                      <span style={{ color:'#d1d5db', fontSize:14 }}>✕</span>
                                    )}
                                  </div>
                                )}
                              </td>
                            )
                          })}
                          <td style={{ textAlign:'center', padding:'12px 16px' }}>
                            <button onClick={()=>abrirFormEditar(p)} style={iconBtn}>✏️</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ fontSize:11, color:'#9ca3af', marginTop:10, textAlign:'center' }}>
                ✓ verde = tiene acceso · ✕ gris = sin acceso · 👑 = administrador (siempre tiene acceso)
              </div>
            </>
          )}

          {/* ── Tab: Roles ── */}
          {!cargando && tab==='roles' && (
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
                      {count===0 && <span style={{ fontSize:11, color:'#9ca3af' }}>Sin usuarios</span>}
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
