'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export default function LoginPage() {
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [cargando,  setCargando]  = useState(false)
  const [error,     setError]     = useState('')
  const [showPass,  setShowPass]  = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) { setError('Ingresa tu email y contraseña'); return }
    setCargando(true); setError('')
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) throw err
      window.location.href = '/'
    } catch(e: any) {
      setError(e.message === 'Invalid login credentials'
        ? 'Email o contraseña incorrectos'
        : 'Error al iniciar sesión. Intenta nuevamente.')
    } finally { setCargando(false) }
  }

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg, #1e3a5f 0%, #3266ad 50%, #1D9E75 100%)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'DM Sans, sans-serif', padding:20 }}>
      <div style={{ background:'#fff', borderRadius:20, padding:'40px 36px', width:'100%', maxWidth:400, boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:36, marginBottom:8 }}>📊</div>
          <div style={{ fontSize:20, fontWeight:700, color:'#1e3a5f' }}>Finanzas Grupo</div>
          <div style={{ fontSize:13, color:'#9ca3af', marginTop:4 }}>Sistema financiero empresarial</div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e=>setEmail(e.target.value)}
              placeholder="usuario@correo.cl"
              style={{ width:'100%', padding:'10px 14px', fontSize:14, border:'1.5px solid #e5e7eb', borderRadius:10, background:'#f9fafb', color:'#111827', fontFamily:'DM Sans, sans-serif', outline:'none', boxSizing:'border-box' as const }}
            />
          </div>

          <div style={{ marginBottom:24 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:6 }}>
              Contraseña
            </label>
            <div style={{ position:'relative' }}>
              <input
                type={showPass?'text':'password'}
                value={password}
                onChange={e=>setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width:'100%', padding:'10px 40px 10px 14px', fontSize:14, border:'1.5px solid #e5e7eb', borderRadius:10, background:'#f9fafb', color:'#111827', fontFamily:'DM Sans, sans-serif', outline:'none', boxSizing:'border-box' as const }}
              />
              <button
                type="button"
                onClick={()=>setShowPass(!showPass)}
                style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'transparent', border:'none', cursor:'pointer', fontSize:16, color:'#9ca3af' }}
              >
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ background:'#FCEBEB', border:'1px solid #F09595', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#791F1F', marginBottom:16 }}>
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={cargando}
            style={{ width:'100%', padding:'12px', borderRadius:10, border:'none', background:cargando?'#9ca3af':'#3266ad', color:'#fff', fontSize:15, fontWeight:600, cursor:cargando?'not-allowed':'pointer', transition:'background 0.2s' }}
          >
            {cargando ? '⏳ Ingresando...' : 'Ingresar al sistema'}
          </button>
        </form>

        <div style={{ textAlign:'center', marginTop:24, fontSize:12, color:'#9ca3af' }}>
          ¿Problemas para acceder? Contacta al administrador
        </div>

        <div style={{ borderTop:'1px solid #f1f5f9', marginTop:24, paddingTop:16, textAlign:'center' }}>
          <div style={{ fontSize:11, color:'#d1d5db' }}>
            🔒 Conexión segura · Datos protegidos con Supabase
          </div>
        </div>
      </div>
    </div>
  )
}
