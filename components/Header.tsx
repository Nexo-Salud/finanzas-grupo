'use client'

// ── Header ────────────────────────────────────────────────────
export default function Header({
  title, empresa, onEmpresa
}: {
  title: string
  empresa?: string
  onEmpresa?: (v: string) => void
}) {
  return (
    <header className="header">
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {onEmpresa && (
          <select
            value={empresa}
            onChange={e => onEmpresa(e.target.value)}
            style={{ width: 'auto', fontSize: 13 }}
          >
            <option value="all">Grupo completo</option>
            <option value="A">Empresa A</option>
            <option value="B">Empresa B</option>
            <option value="C">Empresa C</option>
          </select>
        )}
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: '#eff4ff', color: 'var(--brand)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 600, cursor: 'pointer'
        }}>CM</div>
      </div>
    </header>
  )
}
