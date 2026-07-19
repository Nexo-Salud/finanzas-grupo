'use client'
import { useState } from 'react'
import Link from 'next/link'

// ── Tipos ──────────────────────────────────────────────────────
type Nivel = 'crit' | 'warn' | 'info' | 'ok'
type Alerta = {
  id: string
  nivel: Nivel
  titulo: string
  desc: string
  empresa: string
  categoria: string
  fecha: string
  leida: boolean
}
type Regla = {
  id: string
  nombre: string
  desc: string
  umbral: number
  tipo: '%' | '$'
  activa: boolean
  nivel: Nivel
}

// ── Datos ──────────────────────────────────────────────────────
const ALERTAS_INIT: Alerta[] = [
  { id:'1', nivel:'crit', titulo:'Remuneraciones sobre presupuesto', desc:'Empresa A · Remuneraciones ejecutó $2.1M vs presupuesto $1.8M — exceso del 17%', empresa:'Empresa A', categoria:'Presupuesto', fecha:'Hoy 09:14', leida:false },
  { id:'2', nivel:'crit', titulo:'Proveedores Empresa B excede límite', desc:'Empresa B · Proveedores alcanzó 112% del presupuesto mensual — $340K sobre el límite', empresa:'Empresa B', categoria:'Presupuesto', fecha:'Hoy 08:50', leida:false },
  { id:'3', nivel:'warn', titulo:'Marketing al 88% del presupuesto', desc:'Empresa A · Marketing consumió $880K de $1M presupuestado — quedan $120K para el mes', empresa:'Empresa A', categoria:'Umbral', fecha:'Ayer 17:22', leida:false },
  { id:'4', nivel:'warn', titulo:'Ingresos Empresa C bajo meta mensual', desc:'Empresa C · Ingresos de junio 18% por debajo de la meta — $2.3M vs $2.8M esperado', empresa:'Empresa C', categoria:'Variación', fecha:'Ayer 12:05', leida:true },
  { id:'5', nivel:'warn', titulo:'Variación inusual en gastos generales', desc:'Empresa B · Gastos generales subieron 34% vs mes anterior sin justificación registrada', empresa:'Empresa B', categoria:'Anomalía', fecha:'01 Jun 11:30', leida:true },
  { id:'6', nivel:'info', titulo:'Ingresos Empresa A superan meta del mes', desc:'Empresa A · Ingresos de junio alcanzaron 108% de la meta — $7.6M vs $7.1M presupuestado', empresa:'Empresa A', categoria:'Logro', fecha:'01 Jun 09:00', leida:true },
  { id:'7', nivel:'info', titulo:'Flujo de caja Empresa C cerca del mínimo', desc:'Empresa C · Caja disponible bajó a $1.2M, cerca del umbral mínimo definido de $1M', empresa:'Empresa C', categoria:'Caja', fecha:'30 May 16:40', leida:true },
  { id:'8', nivel:'ok',   titulo:'Empresa B cerró mayo dentro del presupuesto', desc:'Todos los gastos de mayo dentro del presupuesto — eficiencia del 94%', empresa:'Empresa B', categoria:'Logro', fecha:'31 May 23:59', leida:true },
]

const REGLAS_INIT: Regla[] = [
  { id:'r1', nombre:'Gasto sobre presupuesto',     desc:'Alerta cuando cualquier categoría supera el 100% del presupuesto mensual',         umbral:100, tipo:'%', activa:true,  nivel:'crit' },
  { id:'r2', nombre:'Alerta temprana presupuesto', desc:'Aviso cuando una categoría alcanza el umbral definido del presupuesto',             umbral:85,  tipo:'%', activa:true,  nivel:'warn' },
  { id:'r3', nombre:'Variación inusual de gasto',  desc:'Detecta aumentos de gasto respecto al mes anterior que superen el umbral',         umbral:25,  tipo:'%', activa:true,  nivel:'warn' },
  { id:'r4', nombre:'Ingresos bajo meta',          desc:'Alerta cuando los ingresos del mes están por debajo de la meta en más del umbral',  umbral:15,  tipo:'%', activa:true,  nivel:'warn' },
  { id:'r5', nombre:'Flujo de caja mínimo',        desc:'Notifica cuando la caja disponible baja del umbral definido',                      umbral:1000000, tipo:'$', activa:true, nivel:'crit' },
  { id:'r6', nombre:'Logro de meta de ingresos',   desc:'Informa cuando los ingresos superan la meta mensual',                              umbral:100, tipo:'%', activa:false, nivel:'info' },
  { id:'r7', nombre:'Cierre mensual exitoso',      desc:'Confirmación cuando todos los gastos cierran dentro del presupuesto',              umbral:100, tipo:'%', activa:true,  nivel:'ok'   },
]

const HISTORIAL = [
  { nivel:'crit' as Nivel, titulo:'Remuneraciones Empresa A sobre presupuesto', fecha:'Hoy 09:14',     empresa:'Empresa A' },
  { nivel:'crit' as Nivel, titulo:'Proveedores Empresa B excede límite',        fecha:'Hoy 08:50',     empresa:'Empresa B' },
  { nivel:'warn' as Nivel, titulo:'Marketing Empresa A al 88%',                 fecha:'Ayer 17:22',    empresa:'Empresa A' },
  { nivel:'warn' as Nivel, titulo:'Ingresos Empresa C bajo meta',               fecha:'Ayer 12:05',    empresa:'Empresa C' },
  { nivel:'warn' as Nivel, titulo:'Gastos generales Empresa B +34%',            fecha:'01 Jun 11:30',  empresa:'Empresa B' },
  { nivel:'info' as Nivel, titulo:'Ingresos Empresa A superan meta',            fecha:'01 Jun 09:00',  empresa:'Empresa A' },
  { nivel:'info' as Nivel, titulo:'Caja Empresa C cerca del mínimo',            fecha:'30 May 16:40',  empresa:'Empresa C' },
  { nivel:'ok'   as Nivel, titulo:'Empresa B cerró mayo en presupuesto',        fecha:'31 May 23:59',  empresa:'Empresa B' },
  { nivel:'crit' as Nivel, titulo:'Arriendo Empresa C pagado con retraso',      fecha:'28 May 10:15',  empresa:'Empresa C' },
  { nivel:'warn' as Nivel, titulo:'Servicios básicos Empresa A +22%',           fecha:'25 May 14:30',  empresa:'Empresa A' },
]

// ── Helpers ────────────────────────────────────────────────────
const NIV_COLOR  = { crit:'#E24B4A', warn:'#EF9F27', info:'#378ADD', ok:'#1D9E75' }
const NIV_BG     = { crit:'#FCEBEB', warn:'#FAEEDA', info:'#E6F1FB', ok:'#EAF3DE' }
const NIV_BORDER = { crit:'#E24B4A', warn:'#EF9F27', info:'#378ADD', ok:'#1D9E75' }
const NIV_LABEL  = { crit:'Crítico', warn:'Aviso', info:'Info', ok:'OK' }
const NIV_TEXT   = { crit:'#A32D2D', warn:'#633806', info:'#0C447C', ok:'#27500A' }
const NIV_BADGE_BG = { crit:'#F09595', warn:'#FAC775', info:'#B5D4F4', ok:'#C0DD97' }
const NIV_BADGE_TX = { crit:'#501313', warn:'#412402', info:'#042C53', ok:'#173404' }

// ── Componente ─────────────────────────────────────────────────
export default function AlertasPage() {
  const [alertas,  setAlertas]  = useState<Alerta[]>(ALERTAS_INIT)
  const [reglas,   setReglas]   = useState<Regla[]>(REGLAS_INIT)
  const [tab,      setTab]      = useState<'activas'|'reglas'|'historial'>('activas')
  const [showForm, setShowForm] = useState(false)
  const [fNombre,  setFNombre]  = useState('')
  const [fDesc,    setFDesc]    = useState('')
  const [fNivel,   setFNivel]   = useState<Nivel>('warn')
  const [fUmbral,  setFUmbral]  = useState('')
  const [fTipo,    setFTipo]    = useState<'%'|'$'>('%')

  const noLeidas = alertas.filter(a => !a.leida)
  const leidas   = alertas.filter(a => a.leida)
  const criticas = alertas.filter(a => a.nivel === 'crit' && !a.leida).length
  const avisos   = alertas.filter(a => a.nivel === 'warn' && !a.leida).length

  function marcarLeida(id: string) {
    setAlertas(prev => prev.map(a => a.id === id ? { ...a, leida: true } : a))
  }
  function marcarTodasLeidas() {
    setAlertas(prev => prev.map(a => ({ ...a, leida: true })))
  }
  function toggleRegla(id: string) {
    setReglas(prev => prev.map(r => r.id === id ? { ...r, activa: !r.activa } : r))
  }
  function updateUmbral(id: string, val: number) {
    setReglas(prev => prev.map(r => r.id === id ? { ...r, umbral: val } : r))
  }
  function agregarRegla() {
    if (!fNombre) return
    setReglas(prev => [...prev, {
      id: Date.now().toString(), nombre: fNombre, desc: fDesc,
      umbral: parseFloat(fUmbral) || 80, tipo: fTipo,
      activa: true, nivel: fNivel,
    }])
    setFNombre(''); setFDesc(''); setFUmbral(''); setShowForm(false)
  }
  function eliminarRegla(id: string) {
    setReglas(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div style={{ minHeight:'100vh', background:'#f8f9fb', fontFamily:'DM Sans, sans-serif' }}>

      {/* Sidebar */}
      <div style={{ position:'fixed', top:0, left:0, width:220, height:'100vh', background:'#fff', borderRight:'1px solid rgba(0,0,0,0.08)', display:'flex', flexDirection:'column', padding:'0 12px 16px', zIndex:100, overflowY:'auto' }}>
        <div style={{ height:56, display:'flex', alignItems:'center', borderBottom:'1px solid rgba(0,0,0,0.08)', marginBottom:12, marginLeft:-12, marginRight:-12, paddingLeft:20, fontSize:15, fontWeight:600, color:'#3266ad' }}>
          📊 Finanzas Grupo
        </div>
        {[
          { href:'/',             label:'Dashboard',    icon:'▦'  },
          { href:'/movimientos',  label:'Movimientos',  icon:'↕'  },
          { href:'/presupuesto',  label:'Presupuesto',  icon:'🎯' },
          { href:'/alertas',      label:'Alertas',      icon:'🔔', active:true },
          { href:'/reportes',     label:'Reportes',     icon:'📄' },
          { href:'/estados',      label:'Est. Financ.', icon:'📑' },
          { href:'/bancos',       label:'Bancos',       icon:'🏦' },
          { href:'/tributario',   label:'Documentos',   icon:'🧾' },
          { href:'/proyecciones', label:'Proyecciones', icon:'📈' },
          { href:'/usuarios',     label:'Usuarios',     icon:'👥' },
          { href:'/kpis',         label:'KPIs',         icon:'📊' },
          { href:'/ia',           label:'Análisis IA',  icon:'🧠' },
        ].map(item => (
          <Link key={item.href} href={item.href} style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px', borderRadius:8, fontSize:13.5, color:(item as any).active?'#3266ad':'#6b7280', background:(item as any).active?'#eff4ff':'transparent', fontWeight:(item as any).active?500:400, textDecoration:'none', marginBottom:2 }}>
            <span style={{ fontSize:15 }}>{item.icon}</span>{item.label}
            {item.href==='/alertas' && noLeidas.length > 0 && (
              <span style={{ marginLeft:'auto', background:'#E24B4A', color:'#fff', borderRadius:999, fontSize:10, fontWeight:600, padding:'1px 6px' }}>{noLeidas.length}</span>
            )}
          </Link>
        ))}
      </div>

      {/* Contenido */}
      <div style={{ marginLeft:220 }}>

        {/* Header */}
        <div style={{ height:56, background:'#fff', borderBottom:'1px solid rgba(0,0,0,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 28px', position:'sticky', top:0, zIndex:50 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:15, fontWeight:600 }}>Alertas automáticas</div>
            {noLeidas.length > 0 && (
              <span style={{ background:'#FCEBEB', color:'#A32D2D', borderRadius:999, fontSize:11, fontWeight:600, padding:'2px 8px' }}>
                {noLeidas.length} sin leer
              </span>
            )}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'#6b7280' }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:'#1D9E75' }}/>
              Monitoreo activo
            </div>
            {noLeidas.length > 0 && (
              <button onClick={marcarTodasLeidas} style={btnSec}>✓ Marcar todas como leídas</button>
            )}
          </div>
        </div>

        <div style={{ padding:'24px 28px' }}>

          {/* Métricas */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:12, marginBottom:24 }}>
            {[
              { label:'Críticas',       value:criticas, color:'#E24B4A', bg:'#FCEBEB' },
              { label:'Avisos',         value:avisos,   color:'#EF9F27', bg:'#FAEEDA' },
              { label:'Sin leer',       value:noLeidas.length, color:'#111827', bg:'#f1f5f9' },
              { label:'Reglas activas', value:reglas.filter(r=>r.activa).length, color:'#1D9E75', bg:'#E1F5EE' },
            ].map(m => (
              <div key={m.label} style={{ background:m.bg, borderRadius:12, padding:'14px 16px' }}>
                <div style={{ fontSize:11, color:m.color, fontWeight:500, marginBottom:4, opacity:0.8 }}>{m.label}</div>
                <div style={{ fontSize:26, fontWeight:700, color:m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:6, marginBottom:20 }}>
            {([
              { key:'activas',   label:'🔔 Alertas activas' },
              { key:'reglas',    label:'⚙️ Reglas' },
              { key:'historial', label:'📋 Historial' },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer', border:'1px solid rgba(0,0,0,0.1)', background:tab===t.key?'#eff4ff':'#fff', color:tab===t.key?'#3266ad':'#6b7280', fontWeight:tab===t.key?500:400 }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Tab: Alertas activas ── */}
          {tab === 'activas' && (
            <>
              {noLeidas.length > 0 && (
                <>
                  <div style={{ fontSize:12, fontWeight:600, color:'#374151', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>
                    Sin leer ({noLeidas.length})
                  </div>
                  {noLeidas.map(a => <AlertaCard key={a.id} alerta={a} onLeer={marcarLeida} />)}
                </>
              )}
              {leidas.length > 0 && (
                <>
                  <div style={{ fontSize:12, fontWeight:600, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10, marginTop: noLeidas.length ? 20 : 0 }}>
                    Leídas ({leidas.length})
                  </div>
                  {leidas.map(a => <AlertaCard key={a.id} alerta={a} onLeer={marcarLeida} dim />)}
                </>
              )}
              {alertas.length === 0 && (
                <div style={{ textAlign:'center', padding:'4rem', color:'#9ca3af' }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
                  <div style={{ fontSize:15, fontWeight:500 }}>Sin alertas activas</div>
                  <div style={{ fontSize:13, marginTop:4 }}>Todo está bajo control</div>
                </div>
              )}
            </>
          )}

          {/* ── Tab: Reglas ── */}
          {tab === 'reglas' && (
            <>
              {/* Formulario nueva regla */}
              {showForm && (
                <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:20, marginBottom:16 }}>
                  <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Nueva regla de alerta</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                    <div><label style={lbl}>Nombre</label><input value={fNombre} onChange={e=>setFNombre(e.target.value)} placeholder="Nombre de la regla" style={inp}/></div>
                    <div><label style={lbl}>Nivel</label>
                      <select value={fNivel} onChange={e=>setFNivel(e.target.value as Nivel)} style={inp}>
                        <option value="crit">Crítico</option>
                        <option value="warn">Aviso</option>
                        <option value="info">Info</option>
                        <option value="ok">OK</option>
                      </select>
                    </div>
                    <div><label style={lbl}>Umbral</label><input type="number" value={fUmbral} onChange={e=>setFUmbral(e.target.value)} placeholder="80" style={inp}/></div>
                    <div><label style={lbl}>Tipo de umbral</label>
                      <select value={fTipo} onChange={e=>setFTipo(e.target.value as '%'|'$')} style={inp}>
                        <option value="%">Porcentaje (%)</option>
                        <option value="$">Monto ($)</option>
                      </select>
                    </div>
                    <div style={{ gridColumn:'span 2' }}><label style={lbl}>Descripción</label><input value={fDesc} onChange={e=>setFDesc(e.target.value)} placeholder="¿Qué monitorea esta regla?" style={inp}/></div>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={agregarRegla} style={{ ...btnP, flex:1 }}>Guardar regla</button>
                    <button onClick={()=>setShowForm(false)} style={{ ...btnSec, width:'auto', padding:'8px 16px' }}>Cancelar</button>
                  </div>
                </div>
              )}

              {/* Lista de reglas */}
              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:'4px 20px' }}>
                {reglas.map((r, i) => (
                  <div key={r.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 0', borderBottom: i < reglas.length-1 ? '1px solid rgba(0,0,0,0.06)' : 'none', flexWrap:'wrap', gap:10 }}>
                    <div style={{ flex:1, minWidth:200 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                        <span style={{ fontSize:13, fontWeight:500, color:'#111827' }}>{r.nombre}</span>
                        <span style={{ fontSize:10, padding:'1px 7px', borderRadius:999, fontWeight:600, background:NIV_BADGE_BG[r.nivel], color:NIV_BADGE_TX[r.nivel] }}>
                          {NIV_LABEL[r.nivel]}
                        </span>
                        {!r.activa && <span style={{ fontSize:10, padding:'1px 7px', borderRadius:999, background:'#f1f5f9', color:'#9ca3af' }}>Inactiva</span>}
                      </div>
                      <div style={{ fontSize:12, color:'#6b7280' }}>{r.desc}</div>
                      <div style={{ fontSize:12, color:'#374151', marginTop:3 }}>
                        Umbral: <strong>{r.tipo === '$' ? '$' + r.umbral.toLocaleString('es-CL') : r.umbral + '%'}</strong>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <input type="number" value={r.umbral} onChange={e=>updateUmbral(r.id, parseFloat(e.target.value)||0)}
                        style={{ width:70, fontSize:13, textAlign:'center', padding:'5px 8px', border:'1px solid rgba(0,0,0,0.12)', borderRadius:7, background:'#fff' }}/>
                      {/* Toggle */}
                      <div onClick={()=>toggleRegla(r.id)} style={{ width:36, height:20, borderRadius:10, background:r.activa?'#1D9E75':'#d1d5db', cursor:'pointer', position:'relative', transition:'background 0.2s', flexShrink:0 }}>
                        <div style={{ width:16, height:16, borderRadius:'50%', background:'#fff', position:'absolute', top:2, left:r.activa?18:2, transition:'left 0.2s' }}/>
                      </div>
                      <button onClick={()=>eliminarRegla(r.id)} style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:16, color:'#9ca3af', padding:4 }}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={()=>setShowForm(true)} style={{ ...btnP, marginTop:12, width:'100%', justifyContent:'center' }}>
                + Nueva regla personalizada
              </button>
            </>
          )}

          {/* ── Tab: Historial ── */}
          {tab === 'historial' && (
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:'4px 20px' }}>
              {HISTORIAL.map((h, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 0', borderBottom: i < HISTORIAL.length-1 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>
                  <div style={{ width:9, height:9, borderRadius:'50%', background:NIV_COLOR[h.nivel], flexShrink:0 }}/>
                  <div style={{ flex:1 }}>
                    <span style={{ fontSize:13, fontWeight:500, color:'#111827' }}>{h.titulo}</span>
                    <span style={{ fontSize:12, color:'#9ca3af', marginLeft:8 }}>{h.empresa}</span>
                  </div>
                  <span style={{ fontSize:10, padding:'1px 7px', borderRadius:999, fontWeight:600, background:NIV_BADGE_BG[h.nivel], color:NIV_BADGE_TX[h.nivel] }}>{NIV_LABEL[h.nivel]}</span>
                  <span style={{ fontSize:11, color:'#9ca3af', whiteSpace:'nowrap', flexShrink:0 }}>{h.fecha}</span>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Subcomponente AlertaCard ───────────────────────────────────
function AlertaCard({ alerta: a, onLeer, dim }: { alerta: Alerta; onLeer: (id:string)=>void; dim?: boolean }) {
  return (
    <div style={{ background:NIV_BG[a.nivel], borderLeft:`3px solid ${NIV_BORDER[a.nivel]}`, borderRadius:12, padding:'14px 16px', marginBottom:10, opacity: dim ? 0.55 : 1 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:6, marginBottom:6 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:13, fontWeight:600, color:NIV_TEXT[a.nivel] }}>{a.titulo}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:10, padding:'2px 8px', borderRadius:999, fontWeight:600, background:NIV_BADGE_BG[a.nivel], color:NIV_BADGE_TX[a.nivel] }}>{NIV_LABEL[a.nivel]}</span>
          <span style={{ fontSize:11, color:NIV_TEXT[a.nivel], opacity:0.7 }}>{a.fecha}</span>
          {!a.leida && (
            <button onClick={()=>onLeer(a.id)} style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:16, color:NIV_TEXT[a.nivel], opacity:0.6, padding:'2px 4px' }} title="Marcar como leída">✕</button>
          )}
        </div>
      </div>
      <div style={{ fontSize:13, color:NIV_TEXT[a.nivel], lineHeight:1.5 }}>{a.desc}</div>
      <div style={{ marginTop:6, fontSize:11, color:NIV_TEXT[a.nivel], opacity:0.7 }}>
        {a.empresa} · {a.categoria}
      </div>
    </div>
  )
}

// ── Estilos ────────────────────────────────────────────────────
const btnP: React.CSSProperties   = { display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, border:'none', background:'#3266ad', color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer' }
const btnSec: React.CSSProperties = { display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'7px 14px', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', border:'1px solid rgba(0,0,0,0.12)', background:'#fff', color:'#374151', width:'100%' }
const lbl: React.CSSProperties    = { display:'block', fontSize:12, fontWeight:500, color:'#6b7280', marginBottom:4 }
const inp: React.CSSProperties    = { width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid rgba(0,0,0,0.14)', borderRadius:8, background:'#fff', color:'#111827', fontFamily:'DM Sans, sans-serif' }
