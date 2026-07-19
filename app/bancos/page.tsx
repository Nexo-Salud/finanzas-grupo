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
  { href:'/usuarios',     label:'Usuarios',     icon:'👥' },
  { href:'/kpis',         label:'KPIs',         icon:'📊' },
  { href:'/ia',           label:'Análisis IA',  icon:'🧠' },
]

const BANCOS_LISTA = [
  'Santander','Banco de Chile','BancoEstado','BCI','Itaú',
  'Scotiabank','Security','BICE','Mercado Pago','Tenpo','Otro'
]

type Cuenta = {
  id: string
  empresa_id: string
  banco: string
  tipo: string
  numero: string
  moneda: string
  saldo: number
  saldo_banco: number
  activa: boolean
}
type Movimiento = {
  id: string
  cuenta_id: string
  fecha: string
  desc: string
  tipo: 'abono' | 'cargo'
  monto: number
  conciliado: boolean
}
type Empresa = { id: string; nombre_corto: string; color: string }

function fmtM(n: number) {
  const a=Math.abs(n),s=n<0?'-':''
  if(a>=1e6) return s+'$'+(Math.round(a/1e5)/10)+'M'
  if(a>=1000) return s+'$'+Math.round(a/1000)+'K'
  return s+'$'+Math.round(a)
}
function fmtCLP(n: number) { return (n<0?'-':'')+'$'+Math.round(Math.abs(n)).toLocaleString('es-CL') }
function initials(banco: string) {
  if(banco==='Mercado Pago') return 'MP'
  if(banco==='BancoEstado')  return 'BE'
  return banco.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
}
function bancoColor(banco: string) {
  const map: Record<string,string> = {
    'Santander':'#E24B4A','Banco de Chile':'#D85A30','BancoEstado':'#3266ad',
    'BCI':'#185FA5','Itaú':'#EF9F27','Mercado Pago':'#00b1ea','Tenpo':'#7F77DD',
  }
  return map[banco] || '#888780'
}

export default function BancosPage() {
  const [cuentas,   setCuentas]   = useState<Cuenta[]>([])
  const [empresas,  setEmpresas]  = useState<Empresa[]>([])
  const [cargando,  setCargando]  = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error,     setError]     = useState('')
  const [tab,       setTab]       = useState<'cuentas'|'conciliacion'>('cuentas')
  const [empFiltro, setEmpFiltro] = useState('all')
  const [showForm,  setShowForm]  = useState(false)

  // Form
  const [fEmpresa, setFEmpresa] = useState('')
  const [fBanco,   setFBanco]   = useState('Santander')
  const [fTipo,    setFTipo]    = useState('Cuenta corriente')
  const [fNumero,  setFNumero]  = useState('')
  const [fMoneda,  setFMoneda]  = useState('CLP')
  const [fSaldo,   setFSaldo]   = useState('')

  // Movimientos manuales para conciliación
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setCargando(true)
    try {
      const { data: emps } = await supabase
        .from('empresas').select('id,nombre_corto,color')
        .eq('activa', true).order('nombre_corto')

      if (emps && emps.length > 0) {
        setEmpresas(emps)
        setFEmpresa(emps[0].id)
      }

      const { data: ctas, error: errCtas } = await supabase
        .from('cuentas_bancarias').select('*').order('banco')

      if (errCtas) throw errCtas
      setCuentas(ctas || [])

    } catch(e: any) {
      setError('Error conectando con la base de datos.')
    } finally {
      setCargando(false)
    }
  }

  async function guardarCuenta() {
    if (!fNumero || !fEmpresa) return
    setGuardando(true)
    try {
      const saldo = parseFloat(fSaldo) || 0
      const { error } = await supabase.from('cuentas_bancarias').insert({
        empresa_id:  fEmpresa,
        banco:       fBanco,
        tipo:        fTipo,
        numero:      fNumero,
        moneda:      fMoneda,
        saldo,
        saldo_banco: saldo,
        activa:      true,
      })
      if (error) throw error
      await cargarDatos()
      setFNumero(''); setFSaldo(''); setShowForm(false)
    } catch(e: any) {
      setError('Error guardando cuenta: ' + e.message)
    } finally {
      setGuardando(false)
    }
  }

  async function eliminarCuenta(id: string) {
    try {
      await supabase.from('cuentas_bancarias').delete().eq('id', id)
      setCuentas(prev => prev.filter(c => c.id !== id))
    } catch(e: any) {
      setError('Error eliminando cuenta.')
    }
  }

  async function actualizarSaldoBanco(id: string, valor: number) {
    try {
      await supabase.from('cuentas_bancarias').update({ saldo_banco: valor }).eq('id', id)
      setCuentas(prev => prev.map(c => c.id===id ? {...c, saldo_banco: valor} : c))
    } catch(e: any) {
      setError('Error actualizando saldo.')
    }
  }

  const cuentasFilt = empFiltro==='all' ? cuentas : cuentas.filter(c=>c.empresa_id===empFiltro)
  const activas     = cuentasFilt.filter(c=>c.activa)
  const totalCLP    = activas.filter(c=>c.moneda==='CLP').reduce((a,c)=>a+c.saldo,0)
  const conDif      = activas.filter(c=>Math.abs(c.saldo-c.saldo_banco)>0).length

  const porEmpresa = () => {
    const map: Record<string, { emp: Empresa; cuentas: Cuenta[] }> = {}
    cuentasFilt.forEach(c => {
      const emp = empresas.find(e=>e.id===c.empresa_id)
      if (!emp) return
      if (!map[c.empresa_id]) map[c.empresa_id] = { emp, cuentas: [] }
      map[c.empresa_id].cuentas.push(c)
    })
    return Object.values(map)
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
            <div style={{ fontSize:15, fontWeight:600 }}>Cuentas bancarias</div>
            {!cargando && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:'#E1F5EE', color:'#085041', fontWeight:500 }}>🟢 Supabase</span>}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <select value={empFiltro} onChange={e=>setEmpFiltro(e.target.value)} style={sel}>
              <option value="all">Todas las empresas</option>
              {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre_corto}</option>)}
            </select>
            <button onClick={()=>setShowForm(true)} style={btnP}>+ Agregar cuenta</button>
          </div>
        </div>

        <div style={{ padding:'24px 28px' }}>

          {/* Error */}
          {error && (
            <div style={{ background:'#FCEBEB', border:'1px solid #F09595', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#791F1F', marginBottom:16, display:'flex', justifyContent:'space-between' }}>
              <span>⚠️ {error}</span>
              <button onClick={()=>setError('')} style={{ background:'transparent', border:'none', cursor:'pointer', color:'#791F1F' }}>✕</button>
            </div>
          )}

          {/* Métricas */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12, marginBottom:24 }}>
            {[
              { label:'Saldo total CLP',  value:fmtM(totalCLP),        color:'#3266ad', bg:'#E6F1FB' },
              { label:'Cuentas activas',  value:activas.length,         color:'#1D9E75', bg:'#E1F5EE' },
              { label:'Con diferencias',  value:conDif,                  color:conDif>0?'#E24B4A':'#1D9E75', bg:conDif>0?'#FCEBEB':'#E1F5EE' },
              { label:'Sin diferencias',  value:activas.length-conDif,  color:'#1D9E75', bg:'#E1F5EE' },
            ].map(m=>(
              <div key={m.label} style={{ background:m.bg, borderRadius:12, padding:'14px 16px' }}>
                <div style={{ fontSize:11, color:m.color, fontWeight:500, marginBottom:4, opacity:0.8 }}>{m.label}</div>
                <div style={{ fontSize:22, fontWeight:700, color:m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:6, marginBottom:20 }}>
            {([
              { key:'cuentas',      label:'🏦 Cuentas'      },
              { key:'conciliacion', label:'✓ Conciliación'  },
            ] as const).map(t=>(
              <button key={t.key} onClick={()=>setTab(t.key)} style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer', border:'1px solid rgba(0,0,0,0.1)', background:tab===t.key?'#eff4ff':'#fff', color:tab===t.key?'#3266ad':'#6b7280', fontWeight:tab===t.key?500:400 }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Formulario */}
          {showForm && (
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20, marginBottom:16 }}>
              <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Nueva cuenta bancaria</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div><label style={lbl}>Empresa</label>
                  <select value={fEmpresa} onChange={e=>setFEmpresa(e.target.value)} style={inp}>
                    {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre_corto}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Banco</label>
                  <select value={fBanco} onChange={e=>{ setFBanco(e.target.value); if(e.target.value==='Mercado Pago') setFTipo('Billetera digital') }} style={inp}>
                    {BANCOS_LISTA.map(b=><option key={b}>{b}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Tipo</label>
                  <select value={fTipo} onChange={e=>setFTipo(e.target.value)} style={inp}>
                    <option>Cuenta corriente</option>
                    <option>Cuenta vista</option>
                    <option>Cuenta de ahorro</option>
                    <option>Cuenta USD</option>
                    <option>Billetera digital</option>
                  </select>
                </div>
                <div><label style={lbl}>{fBanco==='Mercado Pago'?'Email / Usuario MP':'N° de cuenta'}</label>
                  <input value={fNumero} onChange={e=>setFNumero(e.target.value)} placeholder={fBanco==='Mercado Pago'?'usuario@correo.cl':'000-1-12345-6'} style={inp}/>
                </div>
                <div><label style={lbl}>Saldo actual ($)</label>
                  <input type="number" value={fSaldo} onChange={e=>setFSaldo(e.target.value)} placeholder="0" style={inp}/>
                </div>
                <div><label style={lbl}>Moneda</label>
                  <select value={fMoneda} onChange={e=>setFMoneda(e.target.value)} style={inp}>
                    <option>CLP</option><option>USD</option>
                  </select>
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={guardarCuenta} disabled={guardando} style={{ ...btnP, flex:1, justifyContent:'center', opacity:guardando?0.7:1 }}>
                  {guardando?'Guardando...':'💾 Guardar cuenta'}
                </button>
                <button onClick={()=>setShowForm(false)} style={{ ...btnSec, width:'auto', padding:'8px 16px' }}>Cancelar</button>
              </div>
            </div>
          )}

          {/* ── Tab: Cuentas ── */}
          {tab==='cuentas' && (
            <>
              {cargando && <div style={{ textAlign:'center', padding:'3rem', color:'#9ca3af' }}>⏳ Cargando cuentas...</div>}
              {!cargando && cuentas.length===0 && (
                <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:'3rem', textAlign:'center', color:'#9ca3af' }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>🏦</div>
                  <div style={{ fontSize:14, fontWeight:500, marginBottom:4 }}>Sin cuentas registradas</div>
                  <div style={{ fontSize:13 }}>Agrega tus cuentas bancarias con el botón de arriba</div>
                </div>
              )}

              {porEmpresa().map(({ emp, cuentas: cs }) => (
                <div key={emp.id} style={{ marginBottom:24 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', background:emp.color }}/>
                    <div style={{ fontSize:13, fontWeight:600, color:'#374151', textTransform:'uppercase', letterSpacing:'0.05em' }}>{emp.nombre_corto}</div>
                  </div>
                  {cs.map(c=>{
                    const dif = c.saldo_banco - c.saldo
                    const hayDif = Math.abs(dif) > 0
                    const color = bancoColor(c.banco)
                    return (
                      <div key={c.id} style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:18, marginBottom:10 }}>
                        {c.banco==='Mercado Pago' && (
                          <div style={{ background:'#e0f7ff', border:'1px solid #7dd3ee', borderRadius:8, padding:'6px 10px', fontSize:11, color:'#0070a8', marginBottom:10 }}>
                            📱 Billetera digital Mercado Pago
                          </div>
                        )}
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:14 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <div style={{ width:40, height:40, borderRadius:10, background:color+'22', color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0 }}>
                              {initials(c.banco)}
                            </div>
                            <div>
                              <div style={{ fontSize:14, fontWeight:600, color:'#111827' }}>{c.banco}</div>
                              <div style={{ fontSize:12, color:'#6b7280' }}>{c.tipo} · {c.numero} · {c.moneda}</div>
                            </div>
                          </div>
                          <button onClick={()=>eliminarCuenta(c.id)} style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:16, color:'#9ca3af', padding:4 }}>🗑️</button>
                        </div>

                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                          <div style={{ background:'#f8fafc', borderRadius:8, padding:'10px 12px' }}>
                            <div style={{ fontSize:10, color:'#6b7280', marginBottom:3 }}>Saldo libro</div>
                            <div style={{ fontSize:16, fontWeight:700, color:'#3266ad' }}>{fmtCLP(c.saldo)}</div>
                          </div>
                          <div style={{ background:'#f8fafc', borderRadius:8, padding:'10px 12px' }}>
                            <div style={{ fontSize:10, color:'#6b7280', marginBottom:3 }}>Saldo real banco</div>
                            <input
                              type="number"
                              defaultValue={c.saldo_banco}
                              onBlur={e=>actualizarSaldoBanco(c.id, parseFloat(e.target.value)||0)}
                              style={{ width:'100%', fontSize:14, fontWeight:700, border:'none', borderBottom:'1.5px solid #e5e7eb', background:'transparent', color:'#111827', padding:'2px 0' }}
                            />
                            <div style={{ fontSize:9, color:'#9ca3af', marginTop:2 }}>Editable — ingresa saldo del banco</div>
                          </div>
                          <div style={{ background:hayDif?'#FAEEDA':'#EAF3DE', borderRadius:8, padding:'10px 12px' }}>
                            <div style={{ fontSize:10, color:hayDif?'#633806':'#27500A', marginBottom:3 }}>Diferencia</div>
                            <div style={{ fontSize:16, fontWeight:700, color:hayDif?'#D85A30':'#1D9E75' }}>
                              {hayDif?(dif>0?'+':'')+fmtCLP(dif):'✓ OK'}
                            </div>
                          </div>
                        </div>
                        {hayDif && (
                          <div style={{ marginTop:8, background:'#FAEEDA', borderRadius:8, padding:'6px 10px', fontSize:11, color:'#854F0B' }}>
                            ⚠️ Diferencia de {fmtCLP(Math.abs(dif))} — revisa movimientos pendientes
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}

              <button onClick={()=>setShowForm(true)} style={{ ...btnP, width:'100%', justifyContent:'center' }}>
                + Agregar cuenta bancaria
              </button>
            </>
          )}

          {/* ── Tab: Conciliación ── */}
          {tab==='conciliacion' && (
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20 }}>
              <div style={{ fontSize:14, fontWeight:500, color:'#111827', marginBottom:8 }}>Cómo conciliar</div>
              <div style={{ fontSize:13, color:'#6b7280', lineHeight:1.8, marginBottom:16 }}>
                <div>1. Abre tu resumen bancario de Santander o Mercado Pago</div>
                <div>2. Compara el saldo final con el "Saldo libro" en la pestaña Cuentas</div>
                <div>3. Si hay diferencia, edita el campo "Saldo real banco" directamente</div>
                <div>4. Revisa en Movimientos qué transacciones podrían explicar la diferencia</div>
              </div>
              <div style={{ background:'#eff4ff', border:'1px solid #c7d7f5', borderRadius:10, padding:'10px 14px', fontSize:12, color:'#3266ad' }}>
                💡 <strong>Tip Mercado Pago:</strong> Descarga el resumen desde la app MP → Actividad → Exportar. El saldo final debe coincidir con el saldo libro de tu cuenta MP en esta plataforma.
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

const sel: React.CSSProperties    = { fontSize:13, padding:'6px 10px', border:'1px solid rgba(0,0,0,0.12)', borderRadius:8, background:'#fff' }
const btnP: React.CSSProperties   = { display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, border:'none', background:'#3266ad', color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer' }
const btnSec: React.CSSProperties = { display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'7px 14px', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', border:'1px solid rgba(0,0,0,0.12)', background:'#fff', color:'#374151', width:'100%' }
const lbl: React.CSSProperties    = { display:'block', fontSize:12, fontWeight:500, color:'#6b7280', marginBottom:4 }
const inp: React.CSSProperties    = { width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid rgba(0,0,0,0.14)', borderRadius:8, background:'#fff', color:'#111827', fontFamily:'DM Sans, sans-serif' }
