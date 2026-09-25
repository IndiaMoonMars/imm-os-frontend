import type { CSSProperties, ReactNode } from 'react'
import { LEVEL_COLOR, type Level } from '../theme/levels'

/** Glass panel with HUD corner brackets. */
export function Panel({ title, icon, right, children, className = '', style }: {
  title?: ReactNode; icon?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; style?: CSSProperties
}) {
  return (
    <section className={`hud-panel ${className}`} style={style}>
      <span className="hud-corner tl" /><span className="hud-corner tr" />
      <span className="hud-corner bl" /><span className="hud-corner br" />
      {(title || right) && (
        <header className="hud-panel-head">
          <h3>{icon}{title}</h3>
          {right && <div className="hud-panel-right">{right}</div>}
        </header>
      )}
      {children}
    </section>
  )
}


/** Circular gauge; value mapped between min..max. */
export function RingGauge({ value, min, max, label, unit, level = 'ok', decimals = 1, size = 132 }: {
  value?: number; min: number; max: number; label: string; unit: string; level?: Level; decimals?: number; size?: number
}) {
  const r = 52, c = 2 * Math.PI * r, arc = 0.75 // 270° sweep
  const frac = value === undefined ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)))
  const color = LEVEL_COLOR[level]
  return (
    <div className="ring-gauge" style={{ width: size }}>
      <svg viewBox="0 0 128 128" width={size} height={size}>
        <g transform="rotate(135 64 64)">
          <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(148,163,209,0.12)" strokeWidth="8"
            strokeDasharray={`${c * arc} ${c}`} strokeLinecap="round" />
          <circle cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={`${c * arc * frac} ${c}`} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dasharray .8s ease' }} />
          {/* tick marks */}
          {Array.from({ length: 28 }, (_, i) => {
            const a = (i / 27) * arc * 2 * Math.PI
            const x1 = 64 + Math.cos(a) * 42, y1 = 64 + Math.sin(a) * 42
            const x2 = 64 + Math.cos(a) * (i % 9 === 0 ? 36 : 39), y2 = 64 + Math.sin(a) * (i % 9 === 0 ? 36 : 39)
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(148,163,209,0.25)" strokeWidth="1" />
          })}
        </g>
        <text x="64" y="64" textAnchor="middle" className="ring-value" fill="#eef3ff">
          {value === undefined ? '—' : value.toFixed(decimals)}
        </text>
        <text x="64" y="82" textAnchor="middle" className="ring-unit" fill="#7d8bab">{unit}</text>
      </svg>
      <div className="ring-label">{label}</div>
    </div>
  )
}

/** Minimal SVG sparkline with gradient fill. */
export function Sparkline({ data, color, height = 48, id }: { data: number[]; color: string; height?: number; id: string }) {
  const w = 240
  if (data.length < 2) {
    return <svg viewBox={`0 0 ${w} ${height}`} className="sparkline"><line x1="0" y1={height / 2} x2={w} y2={height / 2}
      stroke={color} strokeOpacity="0.25" strokeDasharray="4 6" /></svg>
  }
  const lo = Math.min(...data), hi = Math.max(...data), span = hi - lo || 1
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, height - 4 - ((v - lo) / span) * (height - 8)])
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('')
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="sparkline" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sp-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line}L${w},${height}L0,${height}Z`} fill={`url(#sp-${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill={color} />
    </svg>
  )
}

/** Big number tile. */
export function StatTile({ label, value, unit, sub, level = 'ok', children }: {
  label: string; value: ReactNode; unit?: string; sub?: ReactNode; level?: Level; children?: ReactNode
}) {
  return (
    <div className="stat-tile" style={{ '--lvl': LEVEL_COLOR[level] } as CSSProperties}>
      <div className="stat-label"><span className="stat-dot" />{label}</div>
      <div className="stat-value">{value}{unit && <small>{unit}</small>}</div>
      {sub && <div className="stat-sub">{sub}</div>}
      {children}
    </div>
  )
}

export function Pill({ children, tone = 'accent' }: { children: ReactNode; tone?: 'accent' | Level }) {
  const color = tone === 'accent' ? 'var(--accent)' : LEVEL_COLOR[tone]
  return <span className="pill" style={{ '--pill': color } as CSSProperties}>{children}</span>
}

/** LIVE / SIM badge from the telemetry `simulated` flag. */
export function SourceBadge({ simulated }: { simulated: boolean }) {
  return simulated
    ? <span className="src-badge sim" title="Simulated data (sensor-sim)">SIM</span>
    : <span className="src-badge live" title="Real sensor data">LIVE</span>
}
