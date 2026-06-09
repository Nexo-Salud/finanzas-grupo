'use client'
import { useState } from 'react'
import Link from 'next/link'

const NAV = [
  { href:'/',             label:'Dashboard',    icon:'▦'  },
  { href:'/movimientos',  label:'Movimientos',  icon:'↕'  },
  { href:'/presupuesto',  label:'Presupuesto',  icon:'🎯' },
  { href:'/alertas',      label:'Alertas',      icon:'🔔' },
  { href:'/reportes',     label:'Reportes',     icon:'📄' },
  { href:'/bancos',       label:'Bancos',       icon:'🏦', active:true },
  { href:'/tributario',   label:'Documentos',   icon:'🧾' },
  { href:'/proyecciones', label:'Proyecciones', icon:'📈' },
  { href:'/usuarios',     label:'Usuarios',     icon:'👥' },
  { href:'/kpis',         label:'KPIs',         icon:'📊' },
  { href:'/ia',           label:'Análisis IA',  icon:'🧠' },
]

const BANCOS_LISTA = ['Banco de Chile','BancoEstado','Santander','BCI','Itaú','Scotiabank','Security','BICE','Mercado Pago','Tenpo','Otro']

type Cuenta = {
  id: string
  empresa: string
  banco: string
  tipo: string
  numero: string
  moneda: string
  saldo: number
  saldoBanco: number
  activa: boolean
}
type Movimiento = {
  id: string
  cuentaId: string
  fecha: string
  desc: string
  tipo: 'abono' | 'cargo'
  monto: number
  conciliado: boolean
}

function fmtM(n: number) {
  const a = Math.abs(n)
  const s = n < 0 ? '-' : ''
  if (a >= 1e6) return s+'$'+(Math.round(a/1e5)/10)+'M'
  if (a >= 1000) return s+'$'+Math.round(a/1000)+'K'
  return s+'$'+Math.round(a)
}
function fmtCLP(n: number) { return (n<0?'-':'')+'$'+Math.round(Math.abs(n)).toLocaleString('es-CL') }
function initials(banco: string) {
  if (banco === 'Mercado Pago') return 'MP'
  if (banco === 'BancoEstado')  return 'BE'
  return banco.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
}
function bancoColor(banco: string): string {
  const map: Record<string,string> = {
    'Banco de Chile':'#D85A30','BancoEstado':'#3266ad','Santander':'#E24B4A',
    'BCI':'#185FA5','Itaú':'#EF9F27','Scotiabank':'#D85A30','Security':'#1D9E75',
    'BICE':'#534AB7','Mercado Pago':'#00b1ea','Tenpo':'#7F77DD',
  }
  return map[banco] || '#888780'
}

export default function BancosPage() {
  const [cuentas, setCuentas] = useState<Cuenta[]>([
    { id:'1', empresa:'Empresa A', banco:'Banco de Chile', tipo:'Cuenta corriente', numero:'000-1-12345-6', moneda:'CLP', saldo:8450000, saldoBanco:8520000, activa:true },
    { id:'2', empresa:'Empresa A', banco:'Mercado Pago',   tipo:'Billetera digital', numero:'admin@grupo.cl', moneda:'CLP', saldo:340000, saldoBanco:340000, activa:true },
    { id:'3', empresa:'Empresa A', banco:'BancoEstado',    tipo:'Cuenta vista',     numero:'12345678',     moneda:'CLP', saldo:1200000, saldoBanco:1200000, activa:true },
    { id:'4', empresa:'Empresa B', banco:'Santander',      tipo:'Cuenta corriente', numero:'0063-1-98765-4',moneda:'CLP', saldo:4380000, saldoBanco:4610000, activa:true },
    { id:'5', empresa:'Empresa B', banco:'BCI',            tipo:'Cuenta USD',       numero:'USD-00221',    moneda:'USD', saldo:12400,   saldoBanco:12400,   activa:true },
    { id:'6', empresa:'Empresa C', banco:'Itaú',           tipo:'Cuenta corriente', numero:'001-23456-7',  moneda:'CLP', saldo:1850000, saldoBanco:1850000, activa:true },
    { id:'7', empresa:'Empresa C', banco:'Scotiabank',     tipo:'Cuenta de ahorro', numero:'9876543',      moneda:'CLP', saldo:3200000, saldoBanco:3200000, activa:false },
  ])

  const [movimientos, setMovimientos] = useState<Movimiento[]>([
    { id:'m1', cuentaId:'1', fecha:'04 Jun', desc:'Transferencia cliente Empresa X', tipo:'abono', monto:2400000, conciliado:true },
    { id:'m2', cuentaId:'1', fecha:'03 Jun', desc:'Pago proveedor materiales',       tipo:'cargo', monto:620000,  conciliado:true },
    { id:'m3', cuentaId:'2', fecha:'03 Jun', desc:'Cobro venta online MP',           tipo:'abono', monto:185000,  conciliado:true },
    { id:'m4', cuentaId:'2', fecha:'02 Jun', desc:'Retiro a cuenta corriente',       tipo:'cargo', monto:150000,  conciliado:false },
    { id:'m5', cuentaId:'1', fecha:'02 Jun', desc:'Pago sueldos junio',              tipo:'cargo', monto:1800000, conciliado:true },
    { id:'m6', cuentaId:'1', fecha:'01 Jun', desc:'Arriendo oficina',                tipo:'cargo', monto:450000,  conciliado:true },
    { id:'m7', cuentaId:'4', fecha:'04 Jun', desc:'Cobro factura F-221',             tipo:'abono', monto:1750000, conciliado:false },
    { id:'m8', cuentaId:'4', fecha:'02 Jun', desc:'Pago servicio cloud',             tipo:'cargo', monto:180000,  conciliado:true },
    { id:'m9', cuentaId:'6', fecha:'03 Jun', desc:'Arriendo local cobrado',          tipo:'abono', monto:900000,  conciliado:true },
    { id:'m10',cuentaId:'6', fecha:'01 Jun', desc:'Mantención mensual',              tipo:'cargo', monto:320000,  conciliado:false },
  ])

  const [tab,       setTab]       = useState<'cuentas'|'movimientos'|'conciliacion'>('cuentas')
  const [showForm,  setShowForm]  = useState(false)
  const [empFiltro, setEmpFiltro] = useState('all')
  const [fEmpresa,  setFEmpresa]  = useState('Empresa A')
  const [fBanco,    setFBanco]    = useState('Banco de Chile')
  const [fTipo,     setFTipo]     = useState('Cuenta corriente')
  const [fNumero,   setFNumero]   = useState('')
  const [fMoneda,   setFMoneda]   = useState('CLP')
  const [fSaldo,    setFSaldo]    = useState('')

  const cuentasFilt = empFiltro === 'all' ? cuentas : cuentas.filter(c=>c.empresa===empFiltro)
  const activas     = cuentasFilt.filter(c=>c.activa)
  const totalCLP    = activas.filter(c=>c.moneda==='CLP').reduce((a,c)=>a+c.saldo,0)
  const conDif      = activas.filter(c=>Math.abs(c.saldo-c.saldoBanco)>0).length
  const movsFilt    = movimientos.filter(m=>cuentasFilt.map(c=>c.id).includes(m.cuentaId))
  const pendientes  = movsFilt.filter(m=>!m.conciliado).length
  const pctConc     = movsFilt.length ? Math.round(movsFilt.filter(m=>m.conciliado).length/movsFilt.length*100) : 0

  function toggleConciliar(id: string) {
    setMovimientos(prev=>prev.map(m=>m.id===id?{...m,conciliado:!m.conciliado}:m))
  }
  function eliminarCuenta(id: string) {
    setCuentas(prev=>prev.filter(c=>c.id!==id))
  }
  function agregarCuenta() {
    if (!fNumero) return
    setCuentas(prev=>[...prev,{
      id:Date.now().toString(), empresa:fEmpresa, banco:fBanco,
      tipo:fTipo, numero:fNumero, moneda:fMoneda,
      saldo:parseFloat(fSaldo)||0, saldoBanco:parseFloat(fSaldo)||0, activa:true,
    }])
    setFNumero(''); setFSaldo(''); setShowForm(false)
  }

  const porEmpresa = (cuentas: Cuenta[]) => {
    const map: Record<string,Cuenta[]> = {}
    cuentas.forEach(c=>{ if(!map[c.empresa]) map[c.empresa]=[]; map[c.empresa].push(c) })
    return map
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
          <div style={{ fontSize:15, fontWeight:600 }}>Cuentas bancarias</div>
          <div style={{ display:'flex', gap:8 }}>
            <select value={empFiltro} onChange={e=>setEmpFiltro(e.target.value)} style={sel}>
              <option value="all">Todas las empresas</option>
              <option>Empresa A</option><option>Empresa B</option><option>Empresa C</option>
            </select>
            <button onClick={()=>setShowForm(true)} style={btnP}>+ Agregar cuenta</button>
          </div>
        </div>

        <div style={{ padding:'24px 28px' }}>
          {/* Métricas */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:12, marginBottom:24 }}>
            {[
              { label:'Saldo total CLP', value:fmtM(totalCLP),       color:'#3266ad', bg:'#E6F1FB' },
              { label:'Sin diferencias', value:activas.length-conDif, color:'#1D9E75', bg:'#E1F5EE' },
              { label:'Con diferencias', value:conDif,                color:conDif>0?'#E24B4A':'#1D9E75', bg:conDif>0?'#FCEBEB':'#E1F5EE' },
              { label:'Conciliación',    value:pctConc+'%',           color:'#7F77DD', bg:'#EEEDFE' },
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
              {key:'cuentas',       label:'🏦 Cuentas'},
              {key:'movimientos',   label:'↕ Movimientos'},
              {key:'conciliacion',  label:'✓ Conciliación'},
            ] as const).map(t=>(
              <button key={t.key} onClick={()=>setTab(t.key)} style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer', border:'1px solid rgba(0,0,0,0.1)', background:tab===t.key?'#eff4ff':'#fff', color:tab===t.key?'#3266ad':'#6b7280', fontWeight:tab===t.key?500:400 }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Formulario nueva cuenta */}
          {showForm && (
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20, marginBottom:16 }}>
              <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Nueva cuenta bancaria</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div><label style={lbl}>Empresa</label>
                  <select value={fEmpresa} onChange={e=>setFEmpresa(e.target.value)} style={inp}>
                    <option>Empresa A</option><option>Empresa B</option><option>Empresa C</option>
                  </select>
                </div>
                <div><label style={lbl}>Banco</label>
                  <select value={fBanco} onChange={e=>setFBanco(e.target.value)} style={inp}>
                    {BANCOS_LISTA.map(b=><option key={b}>{b}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Tipo</label>
                  <select value={fTipo} onChange={e=>setFTipo(e.target.value)} style={inp}>
                    {['Cuenta corriente','Cuenta vista','Cuenta de ahorro','Cuenta USD','Billetera digital'].map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>N° / Identificador</label>
                  <input value={fNumero} onChange={e=>setFNumero(e.target.value)} placeholder="000-1-12345-6" style={inp}/>
                </div>
                <div><label style={lbl}>Saldo inicial</label>
                  <input type="number" value={fSaldo} onChange={e=>setFSaldo(e.target.value)} placeholder="0" style={inp}/>
                </div>
                <div><label style={lbl}>Moneda</label>
                  <select value={fMoneda} onChange={e=>setFMoneda(e.target.value)} style={inp}>
                    <option>CLP</option><option>USD</option><option>UF</option>
                  </select>
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={agregarCuenta} style={{ ...btnP, flex:1, justifyContent:'center' }}>Guardar cuenta</button>
                <button onClick={()=>setShowForm(false)} style={{ ...btnSec, width:'auto', padding:'8px 16px' }}>Cancelar</button>
              </div>
            </div>
          )}

          {/* ── Tab: Cuentas ── */}
          {tab === 'cuentas' && (
            <>
              {Object.entries(porEmpresa(cuentasFilt)).map(([emp, cs])=>(
                <div key={emp} style={{ marginBottom:20 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>{emp}</div>
                  {cs.map(c=>{
                    const dif = c.saldoBanco - c.saldo
                    const hayDif = Math.abs(dif) > 0
                    const color = bancoColor(c.banco)
                    return (
                      <div key={c.id} style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:18, marginBottom:10, opacity:c.activa?1:0.6 }}>
                        {c.banco==='Mercado Pago' && (
                          <div style={{ background:'#e0f7ff', border:'1px solid #7dd3ee', borderRadius:8, padding:'6px 10px', fontSize:11, color:'#0070a8', marginBottom:10 }}>
                            📱 Billetera digital Mercado Pago · Cobros por QR y links de pago
                          </div>
                        )}
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:12 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <div style={{ width:38, height:38, borderRadius:10, background:color+'22', color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0 }}>
                              {initials(c.banco)}
                            </div>
                            <div>
                              <div style={{ fontSize:14, fontWeight:600, color:'#111827' }}>{c.banco}</div>
                              <div style={{ fontSize:12, color:'#6b7280' }}>{c.tipo} · {c.numero} · {c.moneda}</div>
                            </div>
                          </div>
                          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                            <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, fontWeight:500, background:c.activa?'#E1F5EE':'#f1f5f9', color:c.activa?'#085041':'#6b7280' }}>
                              {c.activa?'Activa':'Inactiva'}
                            </span>
                            <button onClick={()=>eliminarCuenta(c.id)} style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:15, color:'#9ca3af', padding:4 }}>🗑️</button>
                          </div>
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                          <div style={{ background:'#f8fafc', borderRadius:8, padding:'10px 12px' }}>
                            <div style={{ fontSize:10, color:'#6b7280', marginBottom:3 }}>Saldo libro</div>
                            <div style={{ fontSize:16, fontWeight:700, color:'#3266ad' }}>{c.moneda==='USD'?'US$':''}{fmtM(c.saldo)}</div>
                          </div>
                          <div style={{ background:'#f8fafc', borderRadius:8, padding:'10px 12px' }}>
                            <div style={{ fontSize:10, color:'#6b7280', marginBottom:3 }}>Saldo banco</div>
                            <div style={{ fontSize:16, fontWeight:700, color:'#111827' }}>{c.moneda==='USD'?'US$':''}{fmtM(c.saldoBanco)}</div>
                          </div>
                          <div style={{ background:hayDif?'#FAEEDA':'#EAF3DE', borderRadius:8, padding:'10px 12px' }}>
                            <div style={{ fontSize:10, color:hayDif?'#633806':'#27500A', marginBottom:3 }}>Diferencia</div>
                            <div style={{ fontSize:16, fontWeight:700, color:hayDif?'#D85A30':'#1D9E75' }}>
                              {hayDif?(dif>0?'+':'')+fmtM(dif):'OK'}
                            </div>
                          </div>
                        </div>
                        {hayDif && (
                          <div style={{ marginTop:8, background:'#FAEEDA', borderRadius:8, padding:'6px 10px', fontSize:11, color:'#854F0B' }}>
                            ⚠️ Diferencia de {fmtM(Math.abs(dif))} — requiere conciliación
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </>
          )}

          {/* ── Tab: Movimientos ── */}
          {tab === 'movimientos' && (
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'#fafafa' }}>
                    {['Fecha','Descripción','Cuenta','Tipo','Monto','Estado'].map(h=>(
                      <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontWeight:500, color:'#6b7280', borderBottom:'1px solid rgba(0,0,0,0.07)', whiteSpace:'nowrap' as const }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {movsFilt.map((m,i)=>{
                    const cuenta = cuentas.find(c=>c.id===m.cuentaId)
                    return (
                      <tr key={m.id} style={{ borderBottom:i<movsFilt.length-1?'1px solid rgba(0,0,0,0.06)':'none' }}>
                        <td style={{ padding:'9px 14px', color:'#6b7280', whiteSpace:'nowrap' as const }}>{m.fecha}</td>
                        <td style={{ padding:'9px 14px', fontWeight:500, color:'#111827' }}>{m.desc}</td>
                        <td style={{ padding:'9px 14px', fontSize:12, color:'#6b7280' }}>{cuenta?.banco}</td>
                        <td style={{ padding:'9px 14px' }}>
                          <span style={{ fontSize:11, padding:'2px 7px', borderRadius:999, fontWeight:500, background:m.tipo==='abono'?'#E1F5EE':'#FCEBEB', color:m.tipo==='abono'?'#085041':'#791F1F' }}>
                            {m.tipo}
                          </span>
                        </td>
                        <td style={{ padding:'9px 14px', fontWeight:600, color:m.tipo==='abono'?'#1D9E75':'#E24B4A', whiteSpace:'nowrap' as const }}>
                          {m.tipo==='abono'?'+':'-'}{fmtCLP(m.monto)}
                        </td>
                        <td style={{ padding:'9px 14px' }}>
                          <button onClick={()=>toggleConciliar(m.id)} style={{ fontSize:11, padding:'2px 8px', borderRadius:999, fontWeight:500, cursor:'pointer', border:'none', background:m.conciliado?'#E1F5EE':'#FAEEDA', color:m.conciliado?'#085041':'#633806' }}>
                            {m.conciliado?'✓ Conciliado':'⏳ Pendiente'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Tab: Conciliación ── */}
          {tab === 'conciliacion' && (
            <>
              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20, marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:'#111827' }}>Progreso de conciliación</div>
                  <div style={{ fontSize:20, fontWeight:700, color:pctConc===100?'#1D9E75':'#3266ad' }}>{pctConc}%</div>
                </div>
                <div style={{ height:10, background:'#f1f5f9', borderRadius:5, overflow:'hidden', marginBottom:6 }}>
                  <div style={{ height:'100%', width:`${pctConc}%`, background:pctConc===100?'#1D9E75':'#3266ad', borderRadius:5, transition:'width 0.4s' }}/>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#6b7280' }}>
                  <span>{movsFilt.filter(m=>m.conciliado).length} conciliados</span>
                  <span>{pendientes} pendientes</span>
                </div>
              </div>

              {pendientes > 0 && (
                <>
                  <div style={{ fontSize:12, fontWeight:600, color:'#374151', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Pendientes ({pendientes})</div>
                  <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:'4px 20px', marginBottom:16 }}>
                    {movsFilt.filter(m=>!m.conciliado).map((m,i,arr)=>{
                      const cuenta = cuentas.find(c=>c.id===m.cuentaId)
                      return (
                        <div key={m.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 0', borderBottom:i<arr.length-1?'1px solid rgba(0,0,0,0.06)':'none' }}>
                          <div onClick={()=>toggleConciliar(m.id)} style={{ width:20, height:20, borderRadius:4, border:'1.5px solid #d1d5db', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}/>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:13, fontWeight:500, color:'#111827' }}>{m.desc}</div>
                            <div style={{ fontSize:11, color:'#6b7280' }}>{m.fecha} · {cuenta?.banco}</div>
                          </div>
                          <span style={{ fontSize:13, fontWeight:600, color:m.tipo==='abono'?'#1D9E75':'#E24B4A' }}>
                            {m.tipo==='abono'?'+':'-'}{fmtCLP(m.monto)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              <div style={{ fontSize:12, fontWeight:600, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Conciliados ({movsFilt.filter(m=>m.conciliado).length})</div>
              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:'4px 20px' }}>
                {movsFilt.filter(m=>m.conciliado).map((m,i,arr)=>{
                  const cuenta = cuentas.find(c=>c.id===m.cuentaId)
                  return (
                    <div key={m.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 0', borderBottom:i<arr.length-1?'1px solid rgba(0,0,0,0.06)':'none', opacity:0.55 }}>
                      <div onClick={()=>toggleConciliar(m.id)} style={{ width:20, height:20, borderRadius:4, background:'#1D9E75', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:'#fff', fontSize:12 }}>✓</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:500, color:'#111827' }}>{m.desc}</div>
                        <div style={{ fontSize:11, color:'#6b7280' }}>{m.fecha} · {cuenta?.banco}</div>
                      </div>
                      <span style={{ fontSize:13, fontWeight:600, color:m.tipo==='abono'?'#1D9E75':'#E24B4A' }}>
                        {m.tipo==='abono'?'+':'-'}{fmtCLP(m.monto)}
                      </span>
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

const sel: React.CSSProperties  = { fontSize:13, padding:'6px 10px', border:'1px solid rgba(0,0,0,0.12)', borderRadius:8, background:'#fff' }
const btnP: React.CSSProperties = { display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, border:'none', background:'#3266ad', color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer' }
const btnSec: React.CSSProperties = { display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'7px 14px', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', border:'1px solid rgba(0,0,0,0.12)', background:'#fff', color:'#374151', width:'100%' }
const lbl: React.CSSProperties  = { display:'block', fontSize:12, fontWeight:500, color:'#6b7280', marginBottom:4 }
const inp: React.CSSProperties  = { width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid rgba(0,0,0,0.14)', borderRadius:8, background:'#fff', color:'#111827', fontFamily:'DM Sans, sans-serif' }
