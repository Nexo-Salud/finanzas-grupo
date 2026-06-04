'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else window.location.href = '/'
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>📊</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--brand)' }}>Finanzas Grupo</div>
          <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 4 }}>Ingresa a tu cuenta</div>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: 5 }}>
              Email
            </label>
            <input
              type="email" required
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="tu@correo.cl"
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: 5 }}>
              Contraseña
            </label>
            <input
              type="password" required
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div style={{ background: '#FCEBEB', color: '#791F1F', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 14 }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '10px' }} disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--color-muted)' }}>
          ¿Olvidaste tu contraseña?{' '}
          <a href="#" style={{ color: 'var(--brand)' }}>Recuperar acceso</a>
        </div>
      </div>
    </div>
  )
}
