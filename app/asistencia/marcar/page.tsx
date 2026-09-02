'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

type Empleada = { id: string; empresa_id: string; nombre: string; valor_hora: number; pin: string; activa: boolean }
type Registro = {
  id: string
  empleada_id: string
  hora_entrada: string
  hora_salida_colacion: string | null
  hora_entrada_tarde: string | null
  hora_salida: string | null
}

type Etapa = 'entrada' | 'salida_colacion' | 'entrada_tarde' | 'salida' | 'completo'

const INFO_ETAPA: Record<Etapa, { titulo: string; badge: string; badgeColor: string; badgeBg: string }> = {
  entrada:          { titulo:'Ingresa tu PIN para marcar ENTRADA',                     badge:'Marcar entrada',          badgeColor:'#767676', badgeBg:'rgba(255,255,255,0.06)' },
  salida_colacion:  { titulo:'Ingresa tu PIN para marcar SALIDA A COLACIÓN',           badge:'🟡 En jornada (mañana)',  badgeColor:'#D8B24D', badgeBg:'rgba(184,145,46,0.16)' },
  entrada_tarde:    { titulo:'Ingresa tu PIN para marcar REGRESO DE COLACIÓN',         badge:'🍽️ En colación',          badgeColor:'#5CA6E8', badgeBg:'rgba(55,138,221,0.16)' },
  salida:           { titulo:'Ingresa tu PIN para marcar SALIDA',                      badge:'🟠 En jornada (tarde)',    badgeColor:'#E8935C', badgeBg:'rgba(221,138,55,0.16)' },
  completo:         { titulo:'',                                                       badge:'✅ Jornada completa',     badgeColor:'#1D9E75', badgeBg:'rgba(29,158,117,0.16)' },
}

function horaActual() {
  return new Date().toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' })
}
function fmtHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' })
}

export default function MarcarAsistenciaPage() {
  const [empleadas,  setEmpleadas]  = useState<Empleada[]>([])
  const [hoyRegs,    setHoyRegs]    = useState<Registro[]>([])
  const [cargando,   setCargando]   = useState(true)
  const [seleccion,  setSeleccion]  = useState<Empleada | null>(null)
  const [pin,        setPin]        = useState('')
  const [procesando, setProcesando] = useState(false)
  const [mensaje,    setMensaje]    = useState<{tipo:'ok'|'error', texto:string} | null>(null)
  const [errorCarga, setErrorCarga] = useState('')

  async function cargar() {
    setCargando(true)
    setErrorCarga('')
    const hoy = new Date().toISOString().split('T')[0]
    const [{ data: empls, error: errEmpls }, { data: regs, error: errRegs }] = await Promise.all([
      supabase.from('empleadas_hora').select('*').eq('activa', true).order('nombre'),
      supabase.from('registros_asistencia').select('id,empleada_id,hora_entrada,hora_salida_colacion,hora_entrada_tarde,hora_salida').eq('fecha', hoy),
    ])
    if (errEmpls || errRegs) {
      setErrorCarga('Error cargando datos: ' + (errEmpls?.message || errRegs?.message || 'desconocido') + '. Es probable que falte correr una migración SQL en Supabase — avisa al administrador.')
    }
    setEmpleadas(empls || [])
    setHoyRegs(regs || [])
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  function registroHoy(empleadaId: string) {
    return hoyRegs.find(r => r.empleada_id === empleadaId) || null
  }

  function etapaDe(empleadaId: string): Etapa {
    const r = registroHoy(empleadaId)
    if (!r) return 'entrada'
    if (!r.hora_salida_colacion) return 'salida_colacion'
    if (!r.hora_entrada_tarde) return 'entrada_tarde'
    if (!r.hora_salida) return 'salida'
    return 'completo'
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
  }

  async function procesarMarcaje(pinIngresado: string, saltarColacion = false) {
    if (!seleccion) return
    if (pinIngresado !== seleccion.pin) {
      setMensaje({ tipo:'error', texto:'PIN incorrecto. Intenta de nuevo.' })
      setPin('')
      return
    }
    const etapa = etapaDe(seleccion.id)
    if (etapa === 'completo') {
      setMensaje({ tipo:'error', texto:'Ya completaste tu jornada de hoy.' })
      return
    }
    setProcesando(true)
    setMensaje(null)
    try {
      const ahora = new Date()
      const hoy = ahora.toISOString().split('T')[0]

      if (etapa === 'entrada') {
        const { error: err } = await supabase.from('registros_asistencia').insert({
          empleada_id: seleccion.id,
          empresa_id:  seleccion.empresa_id,
          fecha:       hoy,
          hora_entrada: ahora.toISOString(),
          valor_hora:  seleccion.valor_hora,
        })
        if (err) throw err
        setMensaje({ tipo:'ok', texto:`✅ Entrada registrada a las ${horaActual()}.` })

      } else if (etapa === 'salida_colacion' && !saltarColacion) {
        const r = registroHoy(seleccion.id)!
        const { error: err } = await supabase.from('registros_asistencia')
          .update({ hora_salida_colacion: ahora.toISOString() }).eq('id', r.id)
        if (err) throw err
        setMensaje({ tipo:'ok', texto:`🍽️ Salida a colación registrada a las ${horaActual()}.` })

      } else if (etapa === 'entrada_tarde') {
        const r = registroHoy(seleccion.id)!
        const { error: err } = await supabase.from('registros_asistencia')
          .update({ hora_entrada_tarde: ahora.toISOString() }).eq('id', r.id)
        if (err) throw err
        setMensaje({ tipo:'ok', texto:`🔙 Regreso de colación registrado a las ${horaActual()}.` })

      } else {
        // etapa 'salida', o 'salida_colacion' con saltarColacion=true (jornada corrida, sin colación)
        const r = registroHoy(seleccion.id)!
        const entrada = new Date(r.hora_entrada)
        let colacionMin = 0
        if (r.hora_salida_colacion && r.hora_entrada_tarde) {
          colacionMin = Math.round((new Date(r.hora_entrada_tarde).getTime() - new Date(r.hora_salida_colacion).getTime()) / 60000)
        }
        const horasBrutas = (ahora.getTime() - entrada.getTime()) / 3600000
        const horas = Math.max(0, horasBrutas - colacionMin/60)
        const monto = Math.round(horas * seleccion.valor_hora)
        const { error: err } = await supabase.from('registros_asistencia')
          .update({ hora_salida: ahora.toISOString(), horas_trabajadas: Math.round(horas*100)/100, monto_calculado: monto, colacion_minutos: colacionMin })
          .eq('id', r.id)
        if (err) throw err
        setMensaje({ tipo:'ok', texto:`👋 Salida registrada a las ${horaActual()} — ${Math.round(horas*100)/100} h trabajadas${colacionMin>0?` (se descontaron ${colacionMin} min de colación)`:''}.` })
      }

      await cargar()
      setTimeout(() => { setSeleccion(null); setPin(''); setMensaje(null) }, 2500)
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
      const etapa = etapaDe(seleccion.id)
      // La salida a colación pide confirmación (hay dos botones), el resto se procesa directo
      if (etapa !== 'salida_colacion') {
        setTimeout(() => procesarMarcaje(nuevo), 150)
      }
    }
  }

  const etapaSel = seleccion ? etapaDe(seleccion.id) : null

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

        {!cargando && errorCarga && (
          <div style={{ textAlign:'center', fontSize:12, padding:'12px 14px', borderRadius:10, background:'rgba(226,75,74,0.16)', color:'#E24B4A', marginBottom:16 }}>
            ⚠️ {errorCarga}
          </div>
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
                const info = INFO_ETAPA[etapaDe(emp.id)]
                return (
                  <button key={emp.id} onClick={()=>elegir(emp)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'#1F1F1F', color:'#F0EFEA', fontSize:14, fontWeight:500, cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
                    <span>{emp.nombre}</span>
                    <span style={{ fontSize:11, padding:'3px 9px', borderRadius:999, background:info.badgeBg, color:info.badgeColor, fontWeight:600 }}>{info.badge}</span>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {!cargando && seleccion && etapaSel==='completo' && !mensaje && (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:16, fontWeight:600, color:'#F0EFEA', marginBottom:6 }}>{seleccion.nombre}</div>
            <div style={{ fontSize:28, marginBottom:10 }}>✅</div>
            <div style={{ fontSize:13, color:'#9A9A9A', marginBottom:20 }}>Ya completaste tu jornada de hoy.</div>
            {(() => {
              const r = registroHoy(seleccion.id)
              if (!r) return null
              return (
                <div style={{ fontSize:12, color:'#C9C9C9', background:'#1F1F1F', borderRadius:10, padding:'10px 14px', marginBottom:16 }}>
                  🟢 {fmtHora(r.hora_entrada)}
                  {r.hora_salida_colacion && <> · 🍽️ {fmtHora(r.hora_salida_colacion)}</>}
                  {r.hora_entrada_tarde && <> · 🔙 {fmtHora(r.hora_entrada_tarde)}</>}
                  {r.hora_salida && <> · 🔴 {fmtHora(r.hora_salida)}</>}
                </div>
              )
            })()}
            <button onClick={volver} style={{ width:'100%', padding:'12px', borderRadius:10, border:'none', background:'#B8912E', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer' }}>
              Volver
            </button>
          </div>
        )}

        {!cargando && seleccion && etapaSel!=='completo' && (
          <div>
            <div style={{ textAlign:'center', marginBottom:16 }}>
              <div style={{ fontSize:16, fontWeight:600, color:'#F0EFEA' }}>{seleccion.nombre}</div>
              <div style={{ fontSize:12, color:'#9A9A9A', marginTop:2 }}>
                {etapaSel && INFO_ETAPA[etapaSel].titulo}
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

            {pin.length<4 && !mensaje?.texto.match(/^(✅|🍽️|🔙|👋)/) && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
                {['1','2','3','4','5','6','7','8','9'].map(d=>(
                  <button key={d} onClick={()=>tocarDigito(d)} disabled={procesando} style={{ padding:'16px 0', borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'#1F1F1F', color:'#F0EFEA', fontSize:18, fontWeight:600, cursor:'pointer' }}>{d}</button>
                ))}
                <button onClick={()=>{ setPin(''); setMensaje(null) }} style={{ padding:'16px 0', borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#767676', fontSize:13, cursor:'pointer' }}>Borrar</button>
                <button onClick={()=>tocarDigito('0')} disabled={procesando} style={{ padding:'16px 0', borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'#1F1F1F', color:'#F0EFEA', fontSize:18, fontWeight:600, cursor:'pointer' }}>0</button>
                <button onClick={volver} style={{ padding:'16px 0', borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#767676', fontSize:13, cursor:'pointer' }}>✕</button>
              </div>
            )}

            {!mensaje && pin.length===4 && etapaSel==='salida_colacion' && (
              <div style={{ marginBottom:16 }}>
                <button onClick={()=>procesarMarcaje(pin, false)} disabled={procesando} style={{ width:'100%', padding:'12px', borderRadius:10, border:'none', background:'#B8912E', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', marginBottom:8 }}>
                  {procesando ? 'Guardando...' : '🍽️ Confirmar salida a colación'}
                </button>
                <button onClick={()=>procesarMarcaje(pin, true)} disabled={procesando} style={{ width:'100%', background:'transparent', border:'none', color:'#9A9A9A', fontSize:11, textDecoration:'underline', cursor:'pointer', padding:'4px' }}>
                  Hoy trabajé corrido, sin colación — marcar salida final
                </button>
              </div>
            )}

            {procesando && <div style={{ textAlign:'center', color:'#9A9A9A', fontSize:13 }}>Procesando...</div>}

            {!procesando && mensaje?.texto.match(/^(✅|🍽️|🔙|👋)/) && (
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
