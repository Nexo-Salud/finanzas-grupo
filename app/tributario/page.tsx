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
  { href:'/tributario',   label:'Documentos',   icon:'🧾', active:true },
  { href:'/proyecciones', label:'Proyecciones', icon:'📈' },
  { href:'/usuarios',     label:'Usuarios',     icon:'👥' },
  { href:'/kpis',         label:'KPIs',         icon:'📊' },
  { href:'/ia',           label:'Análisis IA',  icon:'🧠' },
]

type TipoDoc = 'FE' | 'FR' | 'BE' | 'RET'
type Estado  = 'pagada' | 'pendiente' | 'vencida'
type Doc = {
  id: string
  tipo: TipoDoc
  folio: string
  empresa_id: string
  contraparte: string
  rut_contraparte: string
  fecha: string
  neto: number
  iva: number
  total: number
  estado: Estado
  vence: string
}
type Empresa = { id: string; nombre_corto: string; color: string }

function fmtCLP(n: number) { return '$'+Math.round(n).toLocaleString('es-CL') }
function fmtM(n: number) {
  const a=Math.abs(n),s=n<0?'-':''
  if(a>=1e6) return s+'$'+(Math.round(a/1e5)/10)+'M'
  if(a>=1000) return s+'$'+Math.round(a/1000)+'K'
  return s+'$'+Math.round(a)
}

const PILL: Record<TipoDoc,{bg:string;tx:string;label:string}> = {
  FE:  { bg:'#E6F1FB', tx:'#0C447C', label:'Factura emitida'  },
  FR:  { bg:'#FAEEDA', tx:'#633806', label:'Factura recibida' },
  BE:  { bg:'#E1F5EE', tx:'#085041', label:'Boleta'           },
  RET: { bg:'#EEEDFE', tx:'#3C3489', label:'Retención'        },
}
const ESTADO_STYLE: Record<Estado,{bg:string;tx:string}> = {
  pagada:   { bg:'#E1F5EE', tx:'#085041' },
  pendiente:{ bg:'#FAEEDA', tx:'#633806' },
  vencida:  { bg:'#FCEBEB', tx:'#791F1F' },
}

// Mapeo tipo documento → categoría en movimientos
const TIPO_CATEGORIA: Record<TipoDoc, string> = {
  FE:  'Ventas',
  FR:  'Proveedores',
  BE:  'Ventas',
  RET: 'Gastos generales',
}

export default function TributarioPage() {
  const [docs,      setDocs]      = useState<Doc[]>([])
  const [empresas,  setEmpresas]  = useState<Empresa[]>([])
  const [cargando,  setCargando]  = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error,     setError]     = useState('')
  const [exito,     setExito]     = useState('')
  const [tab,       setTab]       = useState<'emitidos'|'recibidos'|'retenciones'|'iva'>('emitidos')
  const [empresa,   setEmpresa]   = useState('all')
  const [showForm,  setShowForm]  = useState(false)

  // Form
  const [fTipo,    setFTipo]    = useState<TipoDoc>('FR')
  const [fFolio,   setFFolio]   = useState('')
  const [fEmpresa, setFEmpresa] = useState('')
  const [fContra,  setFContra]  = useState('')
  const [fRut,     setFRut]     = useState('')
  const [fTotal,   setFTotal]   = useState('')
  const [fFecha,   setFFecha]   = useState(new Date().toISOString().split('T')[0])
  const [fEstado,  setFEstado]  = useState<Estado>('pendiente')
  const [fVence,   setFVence]   = useState('')

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setCargando(true)
    try {
      const [{ data: emps }, { data: docsData }] = await Promise.all([
        supabase.from('empresas').select('id,nombre_corto,color').eq('activa',true).order('nombre_corto'),
        supabase.from('documentos').select('*').order('fecha', { ascending:false }).limit(300),
      ])
      if (emps && emps.length > 0) {
        setEmpresas(emps)
        setFEmpresa(emps[0].id)
      }
      setDocs(docsData || [])
    } catch(e: any) {
      setError('Error conectando con la base de datos.')
    } finally {
      setCargando(false)
    }
  }

  // ── Guardar documento Y crear movimiento automático ──
  async function guardarDoc() {
    if (!fContra || !fTotal || !fEmpresa) {
      setError('Completa contraparte, monto y empresa.')
      return
    }
    setGuardando(true)
    setError('')

    const total = parseFloat(fTotal) || 0
    const neto  = Math.round(total / 1.19)
    const iva   = total - neto

    const docData = {
      tipo:            fTipo,
      folio:           fFolio || '—',
      empresa_id:      fEmpresa,
      contraparte:     fContra,
      rut_contraparte: fRut || '—',
      fecha:           fFecha,
      neto,
      iva,
      total,
      estado:          fEstado,
      vence:           fVence || null,
      sistema_origen:  'manual',
    }

    try {
      // 1 — Guardar documento
      const { data: docGuardado, error: errDoc } = await supabase
        .from('documentos')
        .insert(docData)
        .select()
        .single()

      if (errDoc) throw errDoc

      // 2 — Crear movimiento automático
      const esIngreso = fTipo === 'FE' || fTipo === 'BE'
      const movData = {
        empresa_id:  fEmpresa,
        tipo:        esIngreso ? 'ingreso' : 'gasto',
        descripcion: `${PILL[fTipo].label} ${fFolio||''} — ${fContra}`.trim(),
        categoria:   TIPO_CATEGORIA[fTipo],
        monto:       total,
        fecha:       fFecha,
        referencia:  fFolio || '—',
        conciliado:  fEstado === 'pagada',
      }

      const { error: errMov } = await supabase.from('movimientos').insert(movData)
      if (errMov) throw errMov

      // 3 — Actualizar estado local
      await cargarDatos()
      resetForm()
      setExito(`✅ Documento guardado y movimiento creado automáticamente en ${esIngreso?'ingresos':'gastos'}`)
      setTimeout(() => setExito(''), 5000)

    } catch(e: any) {
      setError('Error guardando: ' + e.message)
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarEstado(id: string, estadoActual: Estado) {
    const estados: Estado[] = ['pendiente','pagada','vencida']
    const nuevoEstado = estados[(estados.indexOf(estadoActual)+1) % estados.length]
    try {
      await supabase.from('documentos').update({ estado: nuevoEstado }).eq('id', id)
      setDocs(prev => prev.map(d => d.id===id ? {...d, estado:nuevoEstado} : d))
    } catch(e: any) {
      setError('Error actualizando estado.')
    }
  }

  async function eliminarDoc(id: string) {
    try {
      await supabase.from('documentos').delete().eq('id', id)
      setDocs(prev => prev.filter(d => d.id !== id))
    } catch(e: any) {
      setError('Error eliminando documento.')
    }
  }

  function resetForm() {
    setShowForm(false)
    setFFolio(''); setFContra(''); setFRut(''); setFTotal(''); setFVence('')
    setFTipo('FR'); setFEstado('pendiente')
    setFFecha(new Date().toISOString().split('T')[0])
  }

  const empNombre = (id: string) => empresas.find(e=>e.id===id)?.nombre_corto || id
  const filtrados = (tipos: TipoDoc[]) =>
    docs.filter(d => tipos.includes(d.tipo) && (empresa==='all' || d.empresa_id===empresa))

  const emitidos  = filtrados(['FE','BE'])
  const recibidos = filtrados(['FR'])
  const retsAll   = filtrados(['RET'])
  const todosEmp  = docs.filter(d => empresa==='all' || d.empresa_id===empresa)

  const ivaDebito  = emitidos.reduce((a,d)=>a+d.iva,0)
  const ivaCredito = recibidos.reduce((a,d)=>a+d.iva,0)
  const ivaNeto    = ivaDebito - ivaCredito
  const vencidas   = todosEmp.filter(d=>d.estado==='vencida').length

  function renderFormulario() {
    if (!showForm) return null
    return (
      <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20, marginBottom:14 }}>
        <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>Registrar documento</div>
        <div style={{ fontSize:12, color:'#6b7280', marginBottom:14, background:'#eff4ff', padding:'8px 12px', borderRadius:8 }}>
          💡 Al guardar se creará automáticamente un movimiento en {fTipo==='FE'||fTipo==='BE'?'ingresos':'gastos'}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
          <div><label style={lbl}>Tipo documento</label>
            <select value={fTipo} onChange={e=>setFTipo(e.target.value as TipoDoc)} style={inp}>
              <option value="FE">Factura emitida</option>
              <option value="FR">Factura recibida</option>
              <option value="BE">Boleta</option>
              <option value="RET">Retención honorarios</option>
            </select>
          </div>
          <div><label style={lbl}>Folio</label>
            <input value={fFolio} onChange={e=>setFFolio(e.target.value)} placeholder="F-1024" style={inp}/>
          </div>
          <div><label style={lbl}>Empresa</label>
            <select value={fEmpresa} onChange={e=>setFEmpresa(e.target.value)} style={inp}>
              {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre_corto}</option>)}
            </select>
          </div>
          <div><label style={lbl}>{fTipo==='FR'||fTipo==='RET'?'Proveedor / Emisor':'Cliente'}</label>
            <input value={fContra} onChange={e=>setFContra(e.target.value)} placeholder="Nombre empresa o persona" style={inp}/>
          </div>
          <div><label style={lbl}>RUT</label>
            <input value={fRut} onChange={e=>setFRut(e.target.value)} placeholder="76.123.456-7" style={inp}/>
          </div>
          <div><label style={lbl}>Monto total (con IVA)</label>
            <input type="number" value={fTotal} onChange={e=>setFTotal(e.target.value)} placeholder="0" style={inp}/>
            {fTotal && (
              <div style={{ fontSize:11, color:'#6b7280', marginTop:3 }}>
                Neto: {fmtCLP(Math.round(parseFloat(fTotal)/1.19))} · IVA: {fmtCLP(parseFloat(fTotal)-Math.round(parseFloat(fTotal)/1.19))}
              </div>
            )}
          </div>
          <div><label style={lbl}>Fecha emisión</label>
            <input type="date" value={fFecha} onChange={e=>setFFecha(e.target.value)} style={inp}/>
          </div>
          <div><label style={lbl}>Fecha vencimiento</label>
            <input type="date" value={fVence} onChange={e=>setFVence(e.target.value)} style={inp}/>
          </div>
          <div><label style={lbl}>Estado</label>
            <select value={fEstado} onChange={e=>setFEstado(e.target.value as Estado)} style={inp}>
              <option value="pendiente">Pendiente</option>
              <option value="pagada">Pagada</option>
              <option value="vencida">Vencida</option>
            </select>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={guardarDoc} disabled={guardando} style={{ ...btnP, flex:1, justifyContent:'center', opacity:guardando?0.7:1 }}>
            {guardando ? 'Guardando...' : '💾 Guardar documento + crear movimiento'}
          </button>
          <button onClick={resetForm} style={{ ...btnSec, width:'auto', padding:'8px 16px' }}>Cancelar</button>
        </div>
      </div>
    )
  }

  function renderLista(lista: Doc[], permitirNuevo=true) {
    return (
      <>
        {renderFormulario()}
        {lista.filter(d=>d.estado==='vencida').length>0 && (
          <div style={{ background:'#FCEBEB', border:'1px solid #F09595', borderRadius:10, padding:'8px 12px', fontSize:12, color:'#791F1F', marginBottom:12 }}>
            ⚠️ {lista.filter(d=>d.estado==='vencida').length} documento(s) vencido(s) — requieren acción
          </div>
        )}
        <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:'4px 20px', marginBottom:12 }}>
          {lista.length===0 && (
            <div style={{ textAlign:'center', padding:'2rem', color:'#9ca3af', fontSize:14 }}>
              {cargando ? '⏳ Cargando...' : '📭 Sin documentos — agrega el primero'}
            </div>
          )}
          {lista.map((d,i)=>{
            const pill  = PILL[d.tipo]
            const estat = ESTADO_STYLE[d.estado]
            return (
              <div key={d.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 0', borderBottom:i<lista.length-1?'1px solid rgba(0,0,0,0.06)':'none', flexWrap:'wrap', gap:8 }}>
                <div style={{ flex:1, minWidth:180 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3, flexWrap:'wrap' }}>
                    <span style={{ fontSize:13, fontWeight:600, color:'#111827' }}>{d.folio}</span>
                    <span style={{ fontSize:10, padding:'1px 7px', borderRadius:999, fontWeight:600, background:pill.bg, color:pill.tx }}>{pill.label}</span>
                    <span style={{ fontSize:11, color:'#9ca3af' }}>{empNombre(d.empresa_id)}</span>
                  </div>
                  <div style={{ fontSize:12, color:'#6b7280' }}>{d.contraparte} · RUT {d.rut_contraparte} · {d.fecha}</div>
                  <div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>Neto: {fmtCLP(d.neto)} · IVA: {fmtCLP(d.iva)}</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  <button onClick={()=>cambiarEstado(d.id, d.estado)} style={{ fontSize:11, padding:'2px 8px', borderRadius:999, fontWeight:500, cursor:'pointer', border:'none', background:estat.bg, color:estat.tx }}>
                    {d.estado}
                  </button>
                  <span style={{ fontSize:13, fontWeight:700, color:'#111827', whiteSpace:'nowrap' as const }}>{fmtCLP(d.total)}</span>
                  <button onClick={()=>eliminarDoc(d.id)} style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:14, color:'#9ca3af', padding:4 }}>🗑️</button>
                </div>
              </div>
            )
          })}
          {lista.length>0 && (
            <div style={{ display:'flex', justifyContent:'flex-end', gap:20, paddingTop:10, fontSize:12, color:'#6b7280' }}>
              <span>IVA: <strong style={{ color:'#111827' }}>{fmtCLP(lista.reduce((a,d)=>a+d.iva,0))}</strong></span>
              <span>Total: <strong style={{ color:'#111827' }}>{fmtCLP(lista.reduce((a,d)=>a+d.total,0))}</strong></span>
            </div>
          )}
        </div>
        {permitirNuevo && (
          <button onClick={()=>setShowForm(true)} style={{ ...btnP, width:'100%', justifyContent:'center' }}>
            + Registrar documento
          </button>
        )}
      </>
    )
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
            <div style={{ fontSize:15, fontWeight:600 }}>Documentos tributarios</div>
            {!cargando && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:'#E1F5EE', color:'#085041', fontWeight:500 }}>🟢 Supabase</span>}
          </div>
          <select value={empresa} onChange={e=>setEmpresa(e.target.value)} style={sel}>
            <option value="all">Todas las empresas</option>
            {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre_corto}</option>)}
          </select>
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
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:12, marginBottom:24 }}>
            {[
              { label:'Docs emitidos',  value:emitidos.length,  sub:fmtM(emitidos.reduce((a,d)=>a+d.total,0)),  color:'#3266ad', bg:'#E6F1FB' },
              { label:'Docs recibidos', value:recibidos.length, sub:fmtM(recibidos.reduce((a,d)=>a+d.total,0)), color:'#BA7517', bg:'#FAEEDA' },
              { label:'IVA a pagar',    value:fmtM(ivaNeto),    sub:'débito − crédito', color:ivaNeto>0?'#E24B4A':'#1D9E75', bg:ivaNeto>0?'#FCEBEB':'#E1F5EE' },
              { label:'Vencidas',       value:vencidas,          sub:vencidas>0?'acción requerida':'al día', color:vencidas>0?'#E24B4A':'#1D9E75', bg:vencidas>0?'#FCEBEB':'#E1F5EE' },
            ].map(m=>(
              <div key={m.label} style={{ background:m.bg, borderRadius:12, padding:'14px 16px' }}>
                <div style={{ fontSize:11, color:m.color, fontWeight:500, marginBottom:4, opacity:0.8 }}>{m.label}</div>
                <div style={{ fontSize:20, fontWeight:700, color:m.color }}>{m.value}</div>
                <div style={{ fontSize:11, color:m.color, opacity:0.7, marginTop:2 }}>{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Banner integración */}
          <div style={{ background:'#eff4ff', border:'1px solid #c7d7f5', borderRadius:10, padding:'10px 16px', fontSize:12, color:'#3266ad', marginBottom:20, display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:16 }}>🔄</span>
            <span><strong>Integración activa:</strong> Cada factura que registres crea automáticamente un movimiento en ingresos o gastos según el tipo.</span>
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap' }}>
            {([
              {key:'emitidos',    label:'📤 Emitidos'},
              {key:'recibidos',   label:'📥 Recibidos'},
              {key:'retenciones', label:'📑 Retenciones'},
              {key:'iva',         label:'🧮 IVA'},
            ] as const).map(t=>(
              <button key={t.key} onClick={()=>{ setTab(t.key); setShowForm(false) }} style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer', border:'1px solid rgba(0,0,0,0.1)', background:tab===t.key?'#eff4ff':'#fff', color:tab===t.key?'#3266ad':'#6b7280', fontWeight:tab===t.key?500:400 }}>
                {t.label}
              </button>
            ))}
          </div>

          {tab==='emitidos'    && renderLista(emitidos)}
          {tab==='recibidos'   && renderLista(recibidos)}
          {tab==='retenciones' && renderLista(retsAll, true)}

          {tab==='iva' && (
            <>
              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20, marginBottom:14 }}>
                <div style={{ fontSize:14, fontWeight:600, marginBottom:16 }}>Detalle IVA mensual</div>
                {[
                  { label:'IVA débito (ventas)',   value:ivaDebito,   color:'#E24B4A' },
                  { label:'IVA crédito (compras)', value:-ivaCredito, color:'#1D9E75' },
                ].map(row=>(
                  <div key={row.label} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid rgba(0,0,0,0.06)' }}>
                    <span style={{ fontSize:13, color:'#374151' }}>{row.label}</span>
                    <span style={{ fontSize:14, fontWeight:700, color:row.color }}>{row.value<0?'-':''}{fmtCLP(Math.abs(row.value))}</span>
                  </div>
                ))}
                <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 0', borderTop:'2px solid rgba(0,0,0,0.1)', marginTop:4 }}>
                  <span style={{ fontSize:14, fontWeight:600 }}>IVA neto a pagar</span>
                  <span style={{ fontSize:20, fontWeight:700, color:ivaNeto>0?'#E24B4A':'#1D9E75' }}>{fmtCLP(ivaNeto)}</span>
                </div>
                <div style={{ background:'#FAEEDA', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#633806', marginTop:8 }}>
                  📅 Vencimiento F29: <strong>día 12 del mes siguiente</strong>
                </div>
              </div>
              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20 }}>
                <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Por empresa</div>
                {empresas.map(emp=>{
                  const eEm  = docs.filter(d=>['FE','BE'].includes(d.tipo)&&d.empresa_id===emp.id)
                  const eRec = docs.filter(d=>d.tipo==='FR'&&d.empresa_id===emp.id)
                  const deb  = eEm.reduce((a,d)=>a+d.iva,0)
                  const cred = eRec.reduce((a,d)=>a+d.iva,0)
                  const net  = deb - cred
                  return (
                    <div key={emp.id} style={{ marginBottom:14 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5, flexWrap:'wrap', gap:4 }}>
                        <span style={{ fontSize:13, fontWeight:500 }}>{emp.nombre_corto}</span>
                        <span style={{ fontSize:12, color:'#6b7280' }}>
                          Débito {fmtCLP(deb)} · Crédito {fmtCLP(cred)} · <strong style={{ color:net>0?'#E24B4A':'#1D9E75' }}>Neto {fmtCLP(net)}</strong>
                        </span>
                      </div>
                      <div style={{ height:7, background:'#f1f5f9', borderRadius:4, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${Math.min(100, deb?Math.abs(net/deb*100):0)}%`, background:net>0?'#E24B4A':'#1D9E75', borderRadius:4 }}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
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
