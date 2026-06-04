'use client'
import Link from 'next/link'

const NAV = [
  { section: 'Principal' },
  { href: '/',              icon: '▦',  label: 'Dashboard' },
  { href: '/empresas',      icon: '🏢', label: 'Empresas' },
  { section: 'Fase 1' },
  { href: '/movimientos',   icon: '↕',  label: 'Movimientos' },
  { href: '/presupuesto',   icon: '🎯', label: 'Presupuesto' },
  { section: 'Fase 2' },
  { href: '/reportes',      icon: '📄', label: 'Reportes PDF' },
  { href: '/alertas',       icon: '🔔', label: 'Alertas' },
  { section: 'Fase 3' },
  { href: '/bancos',        icon: '🏦', label: 'Cuentas bancarias' },
  { href: '/tributario',    icon: '🧾', label: 'Documentos' },
  { href: '/proyecciones',  icon: '📈', label: 'Proyecciones' },
  { href: '/usuarios',      icon: '👥', label: 'Usuarios' },
  { section: 'Fase 4' },
  { href: '/kpis',          icon: '📊', label: 'KPIs ejecutivos' },
  { href: '/ia',            icon: '🧠', label: 'Análisis IA' },
  { href: '/integraciones', icon: '🔌', label: 'Integraciones' },
]

export default function Sidebar({ active }: { active: string }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <path d="M8 21h8M12 17v4"/>
        </svg>
        Finanzas Grupo
      </div>

      {NAV.map((item, i) => {
        if ('section' in item) {
          return <div key={i} className="nav-label">{item.section}</div>
        }
        const isActive = active === item.href?.replace('/', '') || (active === 'dashboard' && item.href === '/')
        return (
          <Link key={i} href={item.href!} className={`nav-item ${isActive ? 'active' : ''}`}>
            <span style={{ fontSize: 15 }}>{item.icon}</span>
            {item.label}
          </Link>
        )
      })}

      <div style={{ marginTop: 'auto', padding: '16px 8px 0', borderTop: '1px solid var(--color-border)' }}>
        <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>Carlos Mendoza</div>
        <div style={{ fontSize: 11, color: 'var(--color-hint)' }}>Administrador</div>
      </div>
    </aside>
  )
}
