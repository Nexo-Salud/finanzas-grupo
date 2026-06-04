'use client'

export default function MetricCard({
  label, value, delta, up, color
}: {
  label: string
  value: string
  delta?: string
  up?: boolean
  color?: string
}) {
  return (
    <div className="metric-card">
      <div className="label">{label}</div>
      <div className="value" style={{ color: color || 'var(--color-text)' }}>{value}</div>
      {delta && (
        <div className="delta" style={{ color: up ? 'var(--success)' : 'var(--danger)' }}>
          {up ? '↑' : '↓'} {delta}
        </div>
      )}
    </div>
  )
}
