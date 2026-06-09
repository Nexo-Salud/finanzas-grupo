'use client'
import { useState } from 'react'
import Link from 'next/link'

const NAV = [
  { href:'/',             label:'Dashboard',    icon:'▦'  },
  { href:'/movimientos',  label:'Movimientos',  icon:'↕'  },
  { href:'/presupuesto',  label:'Presupuesto',  icon:'🎯' },
  { href:'/alertas',      label:'Alertas',      icon:'🔔' },
  { href:'/reportes',     label:'Reportes',     icon:'📄' },
  { href:'/bancos',       label:'Bancos',       icon:'🏦' },
  { href:'/tributario',   label:'Documentos',   icon:'🧾', active:true },
  { href:'/proyecciones', label:'Proyecciones', icon:'📈' },
  { href:'/usuarios',     label:'Usuarios',     icon:'👥' },
  { href:'/kpis',         label:'KPIs',         icon:'📊' },
  { href:'/ia',           label:'Análisis IA',  icon:'🧠' },
]

const IVA = 0.19

type TipoDoc = 'FE' | 'FR' | 'BE' | 'RET'
type Estado  = 'pagada' | 'pendiente' | 'vencida'
type Doc = {
  id: string
  tipo: TipoDoc
  folio: string
  empresa: string
  contraparte: string
  rut: string
  fecha: string
  neto: number
  iva: number
  total: number
  estado: Estado
  vence: string
  retencion?: number
}

function fmtCLP(n: number) { return '$'+Math.round(n).toLocaleString('es-CL') }
function fmtM(n: number) {
  const a=Math.abs(n), s=n<0?'-':''
  if(a>=1e6) return s+'$'+(Math.round(a/1e5)/10)+'M'
  if(a>=1000) return s+'$'+Math.round(a/1000)+'K'
  return s+'$'+Math.round(a)
}

const DOCS_INIT: Doc[] = [
  { id:'1',  tipo:'FE', folio:'F-1021', empresa:'Empresa A', contraparte:'Cliente Retail Ltda.',   rut:'76.543.210-1', fecha:'04 Jun 2025', neto:2016807, iva:383193, total:2400000, estado:'pagada',   vence:'04 Jul 2025' },
  { id:'2',  tipo:'FE', folio:'F-1022', empresa:'Empresa A', contraparte:'Distribuidora Sur SpA',  rut:'77.123.456-2', fecha:'02 Jun 2025', neto:630252,  iva:119748, total:750000,  estado:'pendiente', vence:'02 Jul 2025' },
  { id:'3',  tipo:'FE', folio:'F-1023', empresa:'Empresa A', contraparte:'Constructora Norte SA',  rut:'96.789.012-3', fecha:'01 Jun 2025', neto:1176471, iva:223529, total:1400000, estado:'vencida',   vence:'01 Jun 2025' },
  { id:'4',  tipo:'BE', folio:'B-4501', empresa:'Empresa A', contraparte:'Venta mostrador',        rut:'—',           fecha:'03 Jun 2025', neto:84034,   iva:15966,  total:100000,  estado:'pagada',   vence:'—' },
  { id:'5',  tipo:'BE', folio:'B-4502', empresa:'Empresa A', contraparte:'Venta online',           rut:'—',           fecha:'04 Jun 2025', neto:210084,  iva:39916,  total:250000,  estado:'pagada',   vence:'—' },
  { id:'6',  tipo:'FR', folio:'F-3310', empresa:'Empresa A', contraparte:'Proveedor Materiales',   rut:'78.901.234-5', fecha:'03 Jun 2025', neto:521008,  iva:98992,  total:620000,  estado:'pagada',   vence:'03 Jul 2025' },
  { id:'7',  tipo:'FR', folio:'F-8821', empresa:'Empresa A', contraparte:'Arriendo Oficina SpA',   rut:'79.012.345-6', fecha:'01 Jun 2025', neto:378151,  iva:71849,  total:450000,  estado:'pagada',   vence:'01 Jul 2025' },
  { id:'8',  tipo:'FR', folio:'F-0912', empresa:'Empresa A', contraparte:'Servicios Cloud Inc.',   rut:'59.123.456-7', fecha:'02 Jun 2025', neto:226891,  iva:43109,  total:270000,  estado:'pendiente', vence:'15 Jun 2025' },
  { id:'9',  tipo:'RET',folio:'RH-201', empresa:'Empresa A', contraparte:'Consultor Juan Pérez',   rut:'12.345.678-9', fecha:'30 May 2025', neto:500000,  iva:0,      total:500000,  estado:'pagada',   vence:'12 Jun 2025', retencion:57500 },
  { id:'10', tipo:'RET',folio:'RH-202', empresa:'Empresa A', contraparte:'Asesora María González', rut:'9.876.543-2',  fecha:'30 May 2025', neto:350000,  iva:0,      total:350000,  estado:'pendiente', vence:'12 Jun 2025', retencion:40250 },
  { id:'11', tipo:'FE', folio:'F-0552', empresa:'Empresa B', contraparte:'Tech Solutions SA',      rut:'96.111.222-3', fecha:'03 Jun 2025', neto:1470588, iva:279412, total:1750000, estado:'pagada',   vence:'03 Jul 2025' },
  { id:'12', tipo:'FR', folio:'F-7731', empresa:'Empresa B', contraparte:'Proveedor Software',     rut:'76.222.333-4', fecha:'01 Jun 2025', neto:151261,  iva:28739,  total:180000,  estado:'pagada',   vence:'01 Jul 2025' },
  { id:'13', tipo:'FE', folio:'F-0131', empresa:'Empresa C', contraparte:'Arrendatario Local 1',   rut:'15.444.555-6', fecha:'01 Jun 2025', neto:756303,  iva:143697, total:900000,  estado:'pagada',   vence:'01 Jul 2025' },
]

const PILL: Record<TipoDoc,{bg:string;tx:string;label:string}> = {
  FE:  { bg:'#E6F1FB', tx:'#0C447C', label:'Factura emitida'   },
  FR:  { bg:'#FAEEDA', tx:'#633806', label:'Factura recibida'  },
  BE:  { bg:'#E1F5EE', tx:'#085041', label:'Boleta'            },
  RET: { bg:'#EEEDFE', tx:'#3C3489', label:'Retención'         },
}
const ESTADO_STYLE: Record<Estado,{bg:string;tx:string}> = {
  pagada:   { bg:'#E1F5EE', tx:'#085041' },
  pendiente:{ bg:'#FAEEDA', tx:'#633806' },
  vencida:  { bg:'#FCEBEB', tx:'#791F1F' },
}

export default function TributarioPage() {
  const [docs,     setDocs]     = useState<Doc[]>(DOCS_INIT)
  const [tab,      setTab]      = useState<'emitidos'|'recibidos'|'retenciones'|'iva'>('emitidos')
  const [empresa,  setEmpresa]  = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [fTipo,    setFTipo]    = useState<TipoDoc>('FE')
  const [fFolio,   setFFolio]   = useState('')
  const [fEmpresa, setFEmpresa] = useState('Empresa A')
  const [fContra,  setFContra]  = useState('')
  const [fRut,     setFRut]     = useState('')
  const [fTotal,   setFTotal]   = useState('')
  const [fFecha,   setFFecha]   = useState(new Date().toISOString().split('T')[0])
  const [fEstado,  setFEstado]  = useState<Estado>('pendiente')

  const filtered = (tipos: TipoDoc[]) =>
    docs.filter(d => tipos.includes(d.tipo) && (empresa==='all'||d.empresa===empresa))

  const emitidos  = filtered(['FE','BE'])
  const recibidos = filtered(['FR'])
  const retsAll   = filtered(['RET'])
  const todosEmp  = docs.filter(d=>empresa==='all'||d.empresa===empresa)

  const ivaDebito  = emitidos.reduce((a,d)=>a+d.iva,0)
  const ivaCredito = recibidos.reduce((a,d)=>a+d.iva,0)
  const ivaNeto    = ivaDebito - ivaCredito
  const vencidas   = todosEmp.filter(d=>d.estado==='vencida').length

  function cambiarEstado(id: string) {
    const estados: Estado[] = ['pendiente','pagada','vencida']
    setDocs(prev=>prev.map(d=>{
      if(d.id!==id) return d
      return { ...d, estado: estados[(estados.indexOf(d.estado)+1)%estados.length] }
    }))
  }
  function eliminar(id: string) {
    setDocs(prev=>prev.filter(d=>d.id!==id))
  }
  function agregar() {
    const total = parseFloat(fTotal)||0
    const neto  = Math.round(total/1.19)
    const iva   = total - neto
    setDocs(prev=>[...prev,{
      id:Date.now().toString(), tipo:fTipo, folio:fFolio||'—',
      empresa:fEmpresa, contraparte:fContra||'—', rut:fRut||'—',
      fecha:fFecha, neto, iva, total,
      estado:fEstado, vence:'—',
      retencion: fTipo==='RET'?Math.round(total*0.115):undefined,
    }])
    setFFolio(''); setFContra(''); setFRut(''); setFTotal('')
    setShowForm(false)
  }

  function renderDocList(lista: Doc[], permitirNuevo=true) {
    return (
      <>
        {showForm && permitirNuevo && (
          <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20, marginBottom:14 }}>
            <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Registrar documento</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div><label style={lbl}>Tipo</label>
                <select value={fTipo} onChange={e=>setFTipo(e.target.value as TipoDoc)} style={inp}>
                  <option value="FE">Factura emitida</option><option value="FR">Factura recibida</option>
                  <option value="BE">Boleta</option><option value="RET">Retención honorarios</option>
                </select>
              </div>
              <div><label style={lbl}>Folio</label><input value={fFolio} onChange={e=>setFFolio(e.target.value)} placeholder="F-1024" style={inp}/></div>
              <div><label style={lbl}>Empresa</label>
                <select value={fEmpresa} onChange={e=>setFEmpresa(e.target.value)} style={inp}>
                  <option>Empresa A</option><option>Empresa B</option><option>Empresa C</option>
                </select>
              </div>
              <div><label style={lbl}>Contraparte</label><input value={fContra} onChange={e=>setFContra(e.target.value)} placeholder="Cliente o proveedor" style={inp}/></div>
              <div><label style={lbl}>RUT</label><input value={fRut} onChange={e=>setFRut(e.target.value)} placeholder="76.123.456-7" style={inp}/></div>
              <div><label style={lbl}>Monto total (con IVA)</label><input type="number" value={fTotal} onChange={e=>setFTotal(e.target.value)} placeholder="0" style={inp}/></div>
              <div><label style={lbl}>Fecha</label><input type="date" value={fFecha} onChange={e=>setFFecha(e.target.value)} style={inp}/></div>
              <div><label style={lbl}>Estado</label>
                <select value={fEstado} onChange={e=>setFEstado(e.target.value as Estado)} style={inp}>
                  <option value="pendiente">Pendiente</option><option value="pagada">Pagada</option><option value="vencida">Vencida</option>
                </select>
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={agregar} style={{ ...btnP, flex:1, justifyContent:'center' }}>Guardar documento</button>
              <button onClick={()=>setShowForm(false)} style={{ ...btnSec, width:'auto', padding:'8px 16px' }}>Cancelar</button>
            </div>
          </div>
        )}

        {lista.filter(d=>d.estado==='vencida').length>0 && (
          <div style={{ background:'#FCEBEB', border:'1px solid #F09595', borderRadius:10, padding:'8px 12px', fontSize:12, color:'#791F1F', marginBottom:12 }}>
            ⚠️ {lista.filter(d=>d.estado==='vencida').length} documento(s) vencido(s) — requieren acción
          </div>
        )}

        <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:'4px 20px', marginBottom:12 }}>
          {lista.length===0 && <div style={{ textAlign:'center', padding:'2rem', color:'#9ca3af', fontSize:14 }}>Sin documentos en este período</div>}
          {lista.map((d,i)=>{
            const pill  = PILL[d.tipo]
            const estat = ESTADO_STYLE[d.estado]
            return (
              <div key={d.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 0', borderBottom:i<lista.length-1?'1px solid rgba(0,0,0,0.06)':'none', flexWrap:'wrap', gap:8 }}>
                <div style={{ flex:1, minWidth:180 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3, flexWrap:'wrap' }}>
                    <span style={{ fontSize:13, fontWeight:600, color:'#111827' }}>{d.folio}</span>
                    <span style={{ fontSize:10, padding:'1px 7px', borderRadius:999, fontWeight:600, background:pill.bg, color:pill.tx }}>{pill.label}</span>
                  </div>
                  <div style={{ fontSize:12, color:'#6b7280' }}>{d.contraparte} · RUT {d.rut} · {d.fecha}</div>
                  <div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>Neto: {fmtCLP(d.neto)} · IVA: {fmtCLP(d.iva)}</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  <button onClick={()=>cambiarEstado(d.id)} style={{ fontSize:11, padding:'2px 8px', borderRadius:999, fontWeight:500, cursor:'pointer', border:'none', background:estat.bg, color:estat.tx }}>
                    {d.estado}
                  </button>
                  <span style={{ fontSize:13, fontWeight:700, color:'#111827', whiteSpace:'nowrap' as const }}>{fmtCLP(d.total)}</span>
                  <button onClick={()=>eliminar(d.id)} style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:14, color:'#9ca3af', padding:4 }}>🗑️</button>
                </div>
              </div>
            )
          })}
          {lista.length>0 && (
            <div style={{ display:'flex', justifyContent:'flex-end', gap:20, paddingTop:10, fontSize:12, color:'#6b7280' }}>
              <span>IVA total: <strong style={{ color:'#111827' }}>{fmtCLP(lista.reduce((a,d)=>a+d.iva,0))}</strong></span>
              <span>Total: <strong style={{ color:'#111827' }}>{fmtCLP(lista.reduce((a,d)=>a+d.total,0))}</strong></span>
            </div>
          )}
        </div>
        {permitirNuevo && (
          <button onClick={()=>setShowForm(true)} style={{ ...btnP, width:'100%', justifyContent:'center' }}>+ Registrar documento</button>
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
          <div style={{ fontSize:15, fontWeight:600 }}>Documentos tributarios</div>
          <div style={{ display:'flex', gap:8 }}>
            <select value={empresa} onChange={e=>setEmpresa(e.target.value)} style={sel}>
              <option value="all">Todas las empresas</option>
              <option>Empresa A</option><option>Empresa B</option><option>Empresa C</option>
            </select>
          </div>
        </div>

        <div style={{ padding:'24px 28px' }}>
          {/* Métricas */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:12, marginBottom:24 }}>
            {[
              { label:'Docs emitidos',  value:emitidos.length,   sub:fmtM(emitidos.reduce((a,d)=>a+d.total,0)),  color:'#3266ad', bg:'#E6F1FB' },
              { label:'Docs recibidos', value:recibidos.length,  sub:fmtM(recibidos.reduce((a,d)=>a+d.total,0)), color:'#BA7517', bg:'#FAEEDA' },
              { label:'IVA a pagar',    value:fmtM(ivaNeto),     sub:'débito − crédito', color:ivaNeto>0?'#E24B4A':'#1D9E75', bg:ivaNeto>0?'#FCEBEB':'#E1F5EE' },
              { label:'Vencidas',       value:vencidas,           sub:vencidas>0?'requieren acción':'al día', color:vencidas>0?'#E24B4A':'#1D9E75', bg:vencidas>0?'#FCEBEB':'#E1F5EE' },
            ].map(m=>(
              <div key={m.label} style={{ background:m.bg, borderRadius:12, padding:'14px 16px' }}>
                <div style={{ fontSize:11, color:m.color, fontWeight:500, marginBottom:4, opacity:0.8 }}>{m.label}</div>
                <div style={{ fontSize:20, fontWeight:700, color:m.color }}>{m.value}</div>
                <div style={{ fontSize:11, color:m.color, opacity:0.7, marginTop:2 }}>{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap' }}>
            {([
              {key:'emitidos',    label:'📤 Emitidos'},
              {key:'recibidos',   label:'📥 Recibidos'},
              {key:'retenciones', label:'📑 Retenciones'},
              {key:'iva',         label:'🧮 Resumen IVA'},
            ] as const).map(t=>(
              <button key={t.key} onClick={()=>setTab(t.key)} style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer', border:'1px solid rgba(0,0,0,0.1)', background:tab===t.key?'#eff4ff':'#fff', color:tab===t.key?'#3266ad':'#6b7280', fontWeight:tab===t.key?500:400 }}>
                {t.label}
              </button>
            ))}
          </div>

          {tab==='emitidos'    && renderDocList(emitidos)}
          {tab==='recibidos'   && renderDocList(recibidos)}
          {tab==='retenciones' && (
            <>
              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:'4px 20px', marginBottom:12 }}>
                {retsAll.length===0 && <div style={{ textAlign:'center', padding:'2rem', color:'#9ca3af' }}>Sin retenciones en este período</div>}
                {retsAll.map((d,i)=>{
                  const ret = d.retencion||Math.round(d.neto*0.115)
                  const estat = ESTADO_STYLE[d.estado]
                  return (
                    <div key={d.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 0', borderBottom:i<retsAll.length-1?'1px solid rgba(0,0,0,0.06)':'none', flexWrap:'wrap', gap:8 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                          <span style={{ fontSize:13, fontWeight:600, color:'#111827' }}>{d.folio}</span>
                          <span style={{ fontSize:10, padding:'1px 7px', borderRadius:999, fontWeight:600, background:'#EEEDFE', color:'#3C3489' }}>Retención hon.</span>
                        </div>
                        <div style={{ fontSize:12, color:'#6b7280' }}>{d.contraparte} · RUT {d.rut} · {d.fecha}</div>
                        <div style={{ fontSize:11, color:'#9ca3af' }}>Honorario: {fmtCLP(d.neto)} · Ret. 11.5%: {fmtCLP(ret)}</div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <button onClick={()=>cambiarEstado(d.id)} style={{ fontSize:11, padding:'2px 8px', borderRadius:999, fontWeight:500, cursor:'pointer', border:'none', background:estat.bg, color:estat.tx }}>{d.estado}</button>
                        <span style={{ fontSize:13, fontWeight:700, color:'#7F77DD' }}>{fmtCLP(ret)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Resumen retenciones</div>
                <div style={{ fontSize:13, color:'#6b7280' }}>Total retenciones del período: <strong style={{ color:'#7F77DD' }}>{fmtCLP(retsAll.reduce((a,d)=>a+(d.retencion||Math.round(d.neto*0.115)),0))}</strong></div>
                <div style={{ fontSize:13, color:'#6b7280', marginTop:4 }}>Pendientes de pago: <strong style={{ color:'#EF9F27' }}>{fmtCLP(retsAll.filter(d=>d.estado==='pendiente').reduce((a,d)=>a+(d.retencion||Math.round(d.neto*0.115)),0))}</strong></div>
              </div>
            </>
          )}

          {tab==='iva' && (
            <>
              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20, marginBottom:14 }}>
                <div style={{ fontSize:14, fontWeight:600, color:'#111827', marginBottom:16 }}>Detalle IVA mensual</div>
                {[
                  { label:'IVA débito (ventas)',   value:ivaDebito,  color:'#E24B4A' },
                  { label:'IVA crédito (compras)', value:-ivaCredito, color:'#1D9E75' },
                ].map(row=>(
                  <div key={row.label} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid rgba(0,0,0,0.06)' }}>
                    <span style={{ fontSize:13, color:'#374151' }}>{row.label}</span>
                    <span style={{ fontSize:14, fontWeight:700, color:row.color }}>{row.value<0?'-':''}{fmtCLP(Math.abs(row.value))}</span>
                  </div>
                ))}
                <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 0', borderTop:'2px solid rgba(0,0,0,0.1)', marginTop:4 }}>
                  <span style={{ fontSize:14, fontWeight:600, color:'#111827' }}>IVA neto a pagar</span>
                  <span style={{ fontSize:20, fontWeight:700, color:ivaNeto>0?'#E24B4A':'#1D9E75' }}>{fmtCLP(ivaNeto)}</span>
                </div>
                <div style={{ background:'#FAEEDA', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#633806', marginTop:8 }}>
                  📅 Vencimiento declaración F29: <strong>12 de julio 2025</strong>
                </div>
              </div>

              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20 }}>
                <div style={{ fontSize:14, fontWeight:600, color:'#111827', marginBottom:14 }}>Desglose por empresa</div>
                {['Empresa A','Empresa B','Empresa C'].map(emp=>{
                  const eEm = docs.filter(d=>['FE','BE'].includes(d.tipo)&&d.empresa===emp)
                  const eRec= docs.filter(d=>d.tipo==='FR'&&d.empresa===emp)
                  const deb = eEm.reduce((a,d)=>a+d.iva,0)
                  const cred= eRec.reduce((a,d)=>a+d.iva,0)
                  const net = deb - cred
                  return (
                    <div key={emp} style={{ marginBottom:14 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5, flexWrap:'wrap', gap:4 }}>
                        <span style={{ fontSize:13, fontWeight:500, color:'#111827' }}>{emp}</span>
                        <span style={{ fontSize:12, color:'#6b7280' }}>
                          Débito {fmtCLP(deb)} · Crédito {fmtCLP(cred)} · <strong style={{ color:net>0?'#E24B4A':'#1D9E75' }}>Neto {fmtCLP(net)}</strong>
                        </span>
                      </div>
                      <div style={{ height:7, background:'#f1f5f9', borderRadius:4, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${Math.min(100,deb?(net/deb*100):0)}%`, background:net>0?'#E24B4A':'#1D9E75', borderRadius:4 }}/>
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
