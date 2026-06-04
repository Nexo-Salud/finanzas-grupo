'use client'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import Header  from '@/components/Header'
import MetricCard from '@/components/MetricCard'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun']
const DATA_GRUPO = MESES.map((mes, i) => ({
  mes,
  'Empresa A': [4200,5100,4800,6200,5900,7100][i],
  'Empresa B': [2800,3200,3500,3100,4000,4400][i],
  'Empresa C': [1500,1800,2100,1900,2400,2800][i],
}))

const COLORS = { 'Empresa A': '#3266ad', 'Empresa B': '#1D9E75', 'Empresa C': '#BA7517' }

function fmtM(n: number) {
  if (n >= 1e6) return '$' + (Math.round(n / 1e5) / 10) + 'M'
  if (n >= 1000) return '$' + Math.round(n / 1000) + 'K'
  return '$' + n
}

export default function Dashboard() {
  const [empresa, setEmpresa] = useState('all')

  const metricas = [
    { label: 'Ingresos grupo', value: '$43.5M', delta: '+14% vs 2024', up: true,  color: '#1D9E75' },
    { label: 'Gastos grupo',   value: '$26.8M', delta: '+9% vs 2024',  up: false, color: '#E24B4A' },
    { label: 'Utilidad neta',  value: '$16.7M', delta: 'Margen 38%',   up: true,  color: '#3266ad' },
    { label: 'Caja total',     value: '$10.6M', delta: '3 empresas',   up: true,  color: '#7F77DD' },
  ]

  return (
    <div className="app-shell">
      <Sidebar active="dashboard" />
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '120vh' }}>
        <Header title="Dashboard consolidado" empresa={empresa} onEmpresa={setEmpresa} />
        <main className="main">

          {/* Métricas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 28 }}>
            {metricas.map(m => <MetricCard key={m.label} {...m} />)}
          </div>

          {/* Gráfico principal */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
              Ingresos por empresa — H1 2025
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              {Object.entries(COLORS).map(([k,c]) => (
                <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--color-muted)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: c, display: 'inline-block' }}/>
                  {k}
                </span>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={DATA_GRUPO} barSize={18}>
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fmtM(v*1000)} />
                <Tooltip formatter={(v: number) => fmtM(v*1000)} />
                {Object.entries(COLORS).map(([k,c]) => (
                  <Bar key={k} dataKey={k} fill={c} radius={[3,3,0,0]} stackId="a" />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Ranking empresas */}
          <div className="card">
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
              Ranking por utilidad neta
            </div>
            {[
              { nombre: 'Empresa A', util: '$11M',  margen: '41%', color: '#3266ad' },
              { nombre: 'Empresa B', util: '$3.9M', margen: '35%', color: '#1D9E75' },
              { nombre: 'Empresa C', util: '$1.8M', margen: '34%', color: '#BA7517' },
            ].map((e, i) => (
              <div key={e.nombre} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < 2 ? '1px solid var(--color-border)' : 'none' }}>
                <span style={{ fontSize: 18, fontWeight: 600, width: 24, color: 'var(--color-muted)' }}>{i+1}</span>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: e.color, flexShrink: 0 }}/>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{e.nombre}</span>
                <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>Margen {e.margen}</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#3266ad' }}>{e.util}</span>
              </div>
            ))}
          </div>

        </main>
      </div>
    </div>
  )
}
