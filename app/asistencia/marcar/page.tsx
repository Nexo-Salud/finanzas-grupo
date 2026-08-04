'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

type Empleada = { id: string; empresa_id: string; nombre: string; valor_hora: number; pin: string; activa: boolean }
type Registro = { id: string; empleada_id: string; hora_entrada: string; hora_salida: string | null }

function horaActual() {
  return new Date().toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' })
}

export default function MarcarAsistenciaPage() {
  const [empleadas,  setEmpleadas]  = useState<Empleada[]>([])
  const [abiertos,   setAbiertos]   = useState<Registro[]>([])
  const [cargando,   setCargando]   = useState(true)
  const [seleccion,  setSeleccion]  = useState<Empleada | null>(null)
  const [pin,        setPin]        = useState('')
  const [procesando, setProcesando] = useState(false)
  const [mensaje,    setMensaje]    = useState<{tipo:'ok'|'error', texto:string} | null>(null)
  const [pasoColacion, setPasoColacion] = useState(false)
  const [colacion,     setColacion]     = useState('0')

  async function cargar() {
    setCargando(true)
    const hoy = new Date().toISOString().split('T')[0]
    const [{ data: empls }, { data: regs }] = await Promise.all([
      supabase.from('empleadas_hora').select('*').eq('activa', true).order('nombre'),
      supabase.from('registros_asistencia').select('id,empleada_id,hora_entrada,hora_salida').eq('fecha', hoy).is('hora_salida', null),
    ])
    setEmpleadas(empls || [])
    setAbiertos(regs || [])
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  function turnoAbierto(empleadaId: string) {
    return abiertos.find(r => r.empleada_id === empleadaId) || null
  }

  function elegir(emp: Empleada) {
    setSeleccion(emp)
    setPin('')
    setMensaje(null)
  }

  function volver() {
    setSeleccion(null)
    setPin('')
    setMensaje(null)
    setPasoColacion(false)
    setColacion('0')
  }

  async function procesarMarcaje(pinIngresado: string) {
    if (!seleccion) return
    if (pinIngresado !== seleccion.pin) {
      setMensaje({ tipo:'error', texto:'PIN incorrecto. Intenta de nuevo.' })
      setPin('')
      return
    }
    const abierto = turnoAbierto(seleccion.id)
    if (abierto) {
      // Antes de guardar la salida, preguntamos minutos de colación
      setMensaje(null)
      setPasoColacion(true)
      return
    }
    setProcesando(true)
    setMensaje(null)
    try {
      const ahora = new Date()
      const hoy = ahora.toISOString().split('T')[0]
      const { error: err } = await supabase.from('registros_asistencia').insert({
        empleada_id: seleccion.id,
        empresa_id:  seleccion.empresa_id,
        fecha:       hoy,
        hora_entrada: ahora.toISOString(),
        valor_hora:  seleccion.valor_hora,
      })
      if (err) throw err
      setMensaje({ tipo:'ok', texto:`✅ Entrada registrada a las ${horaActual()}.` })
      await cargar()
      setTimeout(() => { setSeleccion(null); setPin(''); setMensaje(null) }, 2500)
    } catch(e: any) {
      setMensaje({ tipo:'error', texto:'Error registrando: ' + e.message })
    } finally {
      setProcesando(false)
    }
  }

  async function confirmarSalida() {
    if (!seleccion) return
    const abierto = turnoAbierto(seleccion.id)
    if (!abierto) return
    setProcesando(true)
    setMensaje(null)
    try {
      const ahora = new Date()
      const entrada = new Date(abierto.hora_entrada)
      const colacionMin = parseInt(colacion) || 0
      const horasBrutas = (ahora.getTime() - entrada.getTime()) / 3600000
      const horas = Math.max(0, horasBrutas - colacionMin/60)
      const monto = Math.round(horas * seleccion.valor_hora)
      const { error: err } = await supabase.from('registros_asistencia')
        .update({ hora_salida: ahora.toISOString(), horas_trabajadas: Math.round(horas*100)/100, monto_calculado: monto, colacion_minutos: colacionMin })
        .eq('id', abierto.id)
      if (err) throw err
      setPasoColacion(false)
      setMensaje({ tipo:'ok', texto:`👋 Salida registrada a las ${horaActual()} — ${Math.round(horas*100)/100} h trabajadas${colacionMin>0?` (se descontaron ${colacionMin} min de colación)`:''}.` })
      await cargar()
      setTimeout(() => { setSeleccion(null); setPin(''); setMensaje(null); setColacion('0') }, 3000)
    } catch(e: any) {
      setMensaje({ tipo:'error', texto:'Error registrando: ' + e.message })
    } finally {
      setProcesando(false)
    }
  }

  function tocarDigito(d: string) {
    if (pin.length >= 4) return
    const nuevo = pin + d
    setPin(nuevo)
    if (nuevo.length === 4 && seleccion) {
      // pequeño delay para que se vea el último punto antes de validar
      setTimeout(() => procesarMarcaje(nuevo), 150)
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 45%, #8A6D1F 78%, #B8912E 100%)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'DM Sans, sans-serif', padding:20 }}>
      <div style={{ background:'#161616', borderRadius:20, padding:'32px 28px', width:'100%', maxWidth:420, boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }}>

        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ fontSize:32, marginBottom:6 }}>🕐</div>
          <div style={{ fontSize:18, fontWeight:700, color:'#F0EFEA' }}>Marcar asistencia</div>
          <div style={{ fontSize:12, color:'#767676', marginTop:2 }}>Finanzas Grupo</div>
        </div>

        {cargando && (
          <div style={{ textAlign:'center', padding:'2rem', color:'#767676' }}>⏳ Cargando...</div>
        )}

        {!cargando && !seleccion && (
          <>
            {empleadas.length===0 && (
              <div style={{ textAlign:'center', padding:'1.5rem', color:'#767676', fontSize:13 }}>
                No hay trabajadoras registradas todavía. Pide al administrador que las agregue en el módulo de Asistencia.
              </div>
            )}
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {empleadas.map(emp => {
                const abierto = turnoAbierto(emp.id)
                return (
                  <button key={emp.id} onClick={()=>elegir(emp)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'#1F1F1F', color:'#F0EFEA', fontSize:14, fontWeight:500, cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
                    <span>{emp.nombre}</span>
                    {abierto
                      ? <span style={{ fontSize:11, padding:'3px 9px', borderRadius:999, background:'rgba(184,145,46,0.16)', color:'#D8B24D', fontWeight:600 }}>En turno</span>
                      : <span style={{ fontSize:11, padding:'3px 9px', borderRadius:999, background:'rgba(255,255,255,0.06)', color:'#767676', fontWeight:500 }}>Marcar entrada</span>
                    }
                  </button>
                )
              })}
            </div>
          </>
        )}

        {!cargando && seleccion && pasoColacion && (
          <div>
            <div style={{ textAlign:'center', marginBottom:16 }}>
              <div style={{ fontSize:16, fontWeight:600, color:'#F0EFEA' }}>{seleccion.nombre}</div>
              <div style={{ fontSize:12, color:'#9A9A9A', marginTop:2 }}>¿Cuántos minutos de colación tomaste hoy?</div>
            </div>

            <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:14, flexWrap:'wrap' }}>
              {[0,15,30,45,60].map(m=>(
                <button key={m} onClick={()=>setColacion(String(m))} style={{ padding:'10px 14px', borderRadius:10, border: colacion===String(m) ? '2px solid #B8912E' : '1px solid rgba(255,255,255,0.1)', background:'#1F1F1F', color:'#F0EFEA', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                  {m} min
                </button>
              ))}
            </div>

            <input
              type="number" min={0} value={colacion}
              onChange={e=>setColacion(e.target.value.replace(/\D/g,''))}
              placeholder="Otra cantidad de minutos"
              style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid rgba(255,255,255,0.14)', background:'#161616', color:'#F0EFEA', fontSize:14, textAlign:'center', marginBottom:16, fontFamily:'DM Sans, sans-serif' }}
            />

            {mensaje && (
              <div style={{ textAlign:'center', fontSize:13, marginBottom:16, padding:'8px 12px', borderRadius:8, background: mensaje.tipo==='ok' ? 'rgba(29,158,117,0.16)' : 'rgba(226,75,74,0.16)', color: mensaje.tipo==='ok' ? '#1D9E75' : '#E24B4A' }}>
                {mensaje.texto}
              </div>
            )}

            {!mensaje && (
              <>
                <button onClick={confirmarSalida} disabled={procesando} style={{ width:'100%', padding:'12px', borderRadius:10, border:'none', background:'#B8912E', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', marginBottom:8 }}>
                  {procesando ? 'Guardando...' : 'Confirmar salida'}
                </button>
                <button onClick={volver} style={{ width:'100%', padding:'10px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#767676', fontSize:13, cursor:'pointer' }}>
                  Cancelar
                </button>
              </>
            )}

            {!procesando && mensaje?.texto.startsWith('👋') && (
              <button onClick={volver} style={{ width:'100%', padding:'12px', borderRadius:10, border:'none', background:'#B8912E', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer' }}>
                Listo
              </button>
            )}
          </div>
        )}

        {!cargando && seleccion && !pasoColacion && (
          <div>
            <div style={{ textAlign:'center', marginBottom:16 }}>
              <div style={{ fontSize:16, fontWeight:600, color:'#F0EFEA' }}>{seleccion.nombre}</div>
              <div style={{ fontSize:12, color:'#9A9A9A', marginTop:2 }}>
                {turnoAbierto(seleccion.id) ? 'Ingresa tu PIN para marcar salida' : 'Ingresa tu PIN para marcar entrada'}
              </div>
            </div>

            <div style={{ display:'flex', justifyContent:'center', gap:12, marginBottom:20 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ width:16, height:16, borderRadius:'50%', background: i<pin.length ? '#B8912E' : 'rgba(255,255,255,0.12)' }} />
              ))}
            </div>

            {mensaje && (
              <div style={{ textAlign:'center', fontSize:13, marginBottom:16, padding:'8px 12px', borderRadius:8, background: mensaje.tipo==='ok' ? 'rgba(29,158,117,0.16)' : 'rgba(226,75,74,0.16)', color: mensaje.tipo==='ok' ? '#1D9E75' : '#E24B4A' }}>
                {mensaje.texto}
              </div>
            )}

            {!mensaje?.texto.startsWith('✅') && !mensaje?.texto.startsWith('👋') && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
                {['1','2','3','4','5','6','7','8','9'].map(d=>(
                  <button key={d} onClick={()=>tocarDigito(d)} disabled={procesando} style={{ padding:'16px 0', borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'#1F1F1F', color:'#F0EFEA', fontSize:18, fontWeight:600, cursor:'pointer' }}>{d}</button>
                ))}
                <button onClick={()=>{ setPin(''); setMensaje(null) }} style={{ padding:'16px 0', borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#767676', fontSize:13, cursor:'pointer' }}>Borrar</button>
                <button onClick={()=>tocarDigito('0')} disabled={procesando} style={{ padding:'16px 0', borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'#1F1F1F', color:'#F0EFEA', fontSize:18, fontWeight:600, cursor:'pointer' }}>0</button>
                <button onClick={volver} style={{ padding:'16px 0', borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#767676', fontSize:13, cursor:'pointer' }}>✕</button>
              </div>
            )}

            {procesando && <div style={{ textAlign:'center', color:'#9A9A9A', fontSize:13 }}>Procesando...</div>}

            {!procesando && (mensaje?.texto.startsWith('✅') || mensaje?.texto.startsWith('👋')) && (
              <button onClick={volver} style={{ width:'100%', padding:'12px', borderRadius:10, border:'none', background:'#B8912E', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer' }}>
                Listo
              </button>
            )}

            {!mensaje && (
              <button onClick={volver} style={{ width:'100%', padding:'10px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#767676', fontSize:13, cursor:'pointer', marginTop:4 }}>
                ← Elegir otra persona
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
