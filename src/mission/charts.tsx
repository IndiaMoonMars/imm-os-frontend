import { useState, type MouseEvent } from 'react'
import { istShort, istTime } from './api'
import { SOL_COLORS } from './constants'

// Hand-drawn SVG charts for the Mission page (viewBox scaled to the panel width).
const GRID = 'rgba(148,163,209,0.10)', AXIS = '#7d8bab', MUTED = '#56627f'
const TONE = { warn: '#ffb547', crit: '#ff5d73' }

function niceRange(lo: number, hi: number, ticks = 5): { lo: number; hi: number; step: number } {
  if (!isFinite(lo) || !isFinite(hi)) return { lo: 0, hi: 1, step: 0.2 }
  if (hi - lo < 1e-9) { lo -= Math.abs(lo) * 0.05 || 1; hi += Math.abs(hi) * 0.05 || 1 }
  const raw = (hi - lo) / ticks
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map(k => k * mag).find(s => s >= raw) ?? 10 * mag
  return { lo: Math.floor(lo / step) * step, hi: Math.ceil(hi / step) * step, step }
}
const fmt = (v: number, dp: number) => (Math.abs(v) >= 1000 ? v.toFixed(0) : v.toFixed(dp))
const path = (pts: [number, number][]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('')

/** Split a series where readings are missing for more than `gap` hours (a gap stays a gap). */
function segments<T extends (number | null)[]>(pts: T[], gap: number): T[][] {
  const out: T[][] = []
  let cur: T[] = []
  for (const p of pts) {
    if (cur.length && (p[0] as number) - (cur[cur.length - 1][0] as number) > gap) { out.push(cur); cur = [] }
    cur.push(p)
  }
  if (cur.length) out.push(cur)
  return out
}

// ── the whole mission for one measurement ───────────────────────────
export function TimelineChart({ points, sols, nowH, start, unit, dp, limits = [], label }: {
  points: [number, number | null, number, number][]; sols: number; nowH: number; start: number
  unit: string; dp: number; limits?: { v: number; label: string; tone: 'warn' | 'crit' }[]; label: string
}) {
  const W = 1000, H = 260, L = 52, R = 12, T = 12, B = 44, pw = W - L - R, ph = H - T - B
  const [hover, setHover] = useState<number | null>(null)
  const good = points.filter(p => p[1] !== null)
  const dLo = good.length ? Math.min(...good.map(p => p[2])) : 0
  const dHi = good.length ? Math.max(...good.map(p => p[3])) : 1
  // a limit line is drawn when it is near the data (within half the data's span), not stretching the axis far away
  const near = limits.map(l => l.v).filter(v => v >= dLo - (dHi - dLo || Math.abs(dHi)) * 0.5 && v <= dHi + (dHi - dLo || Math.abs(dHi)) * 0.5)
  const r = niceRange(Math.min(dLo, ...near), Math.max(dHi, ...near))
  const x = (h: number) => L + (h / (sols * 24)) * pw
  const y = (v: number) => T + ph - ((v - r.lo) / (r.hi - r.lo)) * ph
  const ticks: number[] = []
  for (let v = r.lo; v <= r.hi + r.step / 2; v += r.step) ticks.push(v)
  const segs = segments(good, 0.5)
  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const h = (((e.clientX - box.left) / box.width) * W - L) / pw * sols * 24
    if (!good.length || h < 0) { setHover(null); return }
    let best = 0
    good.forEach((p, i) => { if (Math.abs(p[0] - h) < Math.abs(good[best][0] - h)) best = i })
    setHover(Math.abs(good[best][0] - h) < 1 ? best : null)
  }
  const hp = hover !== null ? good[hover] : null
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="mchart" onMouseMove={onMove} onMouseLeave={() => setHover(null)}
      role="img" aria-label={`${label} over the whole mission`}>
      {ticks.map(v => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={GRID} />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" fill={AXIS} fontSize="11">{fmt(v, dp)}</text>
        </g>
      ))}
      {nowH < sols * 24 && <rect x={x(Math.max(nowH, 0))} y={T} width={x(sols * 24) - x(Math.max(nowH, 0))} height={ph} fill="rgba(148,163,209,0.035)" />}
      {Array.from({ length: sols + 1 }, (_, d) => (
        <g key={d}>
          <line x1={x(d * 24)} x2={x(d * 24)} y1={T} y2={T + ph} stroke="rgba(148,163,209,0.22)" strokeDasharray="3 4" />
          {d < sols && (
            <>
              <text x={x(d * 24 + 12)} y={H - 24} textAnchor="middle" fontSize="11.5" fontWeight="700"
                fill={nowH >= d * 24 && nowH < (d + 1) * 24 ? '#ffc26b' : '#b9c4de'}>SOL {d + 1}</text>
              {sols <= 10 && <text x={x(d * 24 + 12)} y={H - 9} textAnchor="middle" fontSize="10" fill={MUTED}>{istShort((start + d * 86400) * 1000)} IST</text>}
            </>
          )}
        </g>
      ))}
      {limits.filter(l => l.v > r.lo && l.v < r.hi).map(l => (
        <g key={l.label}>
          <line x1={L} x2={W - R} y1={y(l.v)} y2={y(l.v)} stroke={TONE[l.tone]} strokeDasharray="6 5" strokeWidth="1.2" />
          <text x={W - R - 4} y={y(l.v) - 5} textAnchor="end" fill={TONE[l.tone]} fontSize="10.5">{l.label}</text>
        </g>
      ))}
      {segs.map((s, i) => (
        <g key={i}>
          <path d={path(s.map(p => [x(p[0]), y(p[3])])) + 'L' + [...s].reverse().map(p => `${x(p[0]).toFixed(1)} ${y(p[2]).toFixed(1)}`).join('L') + 'Z'}
            fill="rgba(57,135,229,0.18)" />
          <path d={path(s.map(p => [x(p[0]), y(p[1] as number)]))} fill="none" stroke="#3987e5" strokeWidth="2" strokeLinejoin="round" />
        </g>
      ))}
      {nowH >= 0 && nowH <= sols * 24 && (
        <g>
          <line x1={x(nowH)} x2={x(nowH)} y1={T} y2={T + ph} stroke="#ffc26b" strokeWidth="1.5" />
          <text x={Math.min(x(nowH) + 6, W - 110)} y={T + 12} fill="#ffc26b" fontSize="11" fontWeight="700">NOW {istTime(Date.now(), false)} IST</text>
        </g>
      )}
      {!good.length && <text x={L + pw / 2} y={T + ph / 2} textAnchor="middle" fill={MUTED} fontSize="13">no {label} readings in this mission yet</text>}
      {hp && (
        <g pointerEvents="none">
          <line x1={x(hp[0])} x2={x(hp[0])} y1={T} y2={T + ph} stroke="rgba(238,243,255,0.35)" />
          <circle cx={x(hp[0])} cy={y(hp[1] as number)} r="4.5" fill="#3987e5" stroke="#0a1122" strokeWidth="2" />
          <g transform={`translate(${Math.min(x(hp[0]) + 10, W - 210)},${T + 22})`}>
            <rect width="200" height="50" rx="8" fill="rgba(8,13,26,0.95)" stroke="rgba(148,163,209,0.28)" />
            <text x="10" y="18" fill="#b9c4de" fontSize="11">{istShort((start + hp[0] * 3600) * 1000)} IST · SOL {Math.floor(hp[0] / 24) + 1}</text>
            <text x="10" y="37" fill="#eef3ff" fontSize="12.5">{fmt(hp[1] as number, dp)} {unit}  ({fmt(hp[2], dp)} – {fmt(hp[3], dp)})</text>
          </g>
        </g>
      )}
    </svg>
  )
}

// ── each sol against hours into the sol ─────────────────────────────
export function OverlayChart({ sols, unit, dp, current, label }: {
  sols: Record<string, [number, number | null][]>; unit: string; dp: number; current?: number; label: string
}) {
  const W = 1000, H = 230, L = 52, R = 70, T = 10, B = 28, pw = W - L - R, ph = H - T - B
  const [hoverH, setHoverH] = useState<number | null>(null)
  const entries = Object.entries(sols).map(([n, pts]) => [Number(n), pts.filter(p => p[1] !== null) as [number, number][]] as const)
  const vals = entries.flatMap(([, pts]) => pts.map(p => p[1]))
  const r = niceRange(vals.length ? Math.min(...vals) : 0, vals.length ? Math.max(...vals) : 1)
  const x = (h: number) => L + (h / 24) * pw
  const y = (v: number) => T + ph - ((v - r.lo) / (r.hi - r.lo)) * ph
  const ticks: number[] = []
  for (let v = r.lo; v <= r.hi + r.step / 2; v += r.step) ticks.push(v)
  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const h = (((e.clientX - box.left) / box.width) * W - L) / pw * 24
    setHoverH(h >= 0 && h <= 24 ? h : null)
  }
  const near = (pts: [number, number][], h: number) => pts.reduce<[number, number] | null>((b, p) => (!b || Math.abs(p[0] - h) < Math.abs(b[0] - h) ? p : b), null)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="mchart" onMouseMove={onMove} onMouseLeave={() => setHoverH(null)}
      role="img" aria-label={`${label}: each sol by hour`}>
      {ticks.map(v => (
        <g key={v}>
          <line x1={L} x2={L + pw} y1={y(v)} y2={y(v)} stroke={GRID} />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" fill={AXIS} fontSize="11">{fmt(v, dp)}</text>
        </g>
      ))}
      {Array.from({ length: 9 }, (_, i) => i * 3).map(h => (
        <text key={h} x={x(h)} y={H - 8} textAnchor="middle" fill={AXIS} fontSize="11">+{String(h).padStart(2, '0')}h</text>
      ))}
      {entries.map(([n, pts]) => {
        const c = SOL_COLORS[(n - 1) % SOL_COLORS.length]
        const last = pts[pts.length - 1]
        return (
          <g key={n}>
            {segments(pts, 0.5).map((s, i) => <path key={i} d={path(s.map(p => [x(p[0]), y(p[1])]))} fill="none" stroke={c} strokeWidth={n === current ? 2.5 : 2} strokeLinejoin="round" />)}
            {last && <circle cx={x(last[0])} cy={y(last[1])} r="4" fill={c} stroke="#0a1122" strokeWidth="2" />}
            {last && entries.length <= 4 && <text x={x(last[0]) + 8} y={y(last[1]) + 4} fill="#b9c4de" fontSize="11">Sol {n}</text>}
          </g>
        )
      })}
      {!entries.length && <text x={L + pw / 2} y={T + ph / 2} textAnchor="middle" fill={MUTED} fontSize="13">no {label} readings yet</text>}
      {hoverH !== null && entries.length > 0 && (
        <g pointerEvents="none">
          <line x1={x(hoverH)} x2={x(hoverH)} y1={T} y2={T + ph} stroke="rgba(238,243,255,0.35)" />
          <g transform={`translate(${Math.min(x(hoverH) + 10, W - 170)},${T + 6})`}>
            <rect width="160" height={22 + entries.length * 17} rx="8" fill="rgba(8,13,26,0.95)" stroke="rgba(148,163,209,0.28)" />
            <text x="10" y="16" fill="#b9c4de" fontSize="11">+{hoverH.toFixed(1)} h into the sol</text>
            {entries.map(([n, pts], i) => {
              const p = near(pts, hoverH)
              return <text key={n} x="10" y={33 + i * 17} fill="#eef3ff" fontSize="11.5">
                <tspan fill={SOL_COLORS[(n - 1) % SOL_COLORS.length]}>■ </tspan>Sol {n}: {p && Math.abs(p[0] - hoverH) < 0.5 ? `${fmt(p[1], dp)} ${unit}` : '–'}
              </text>
            })}
          </g>
        </g>
      )}
    </svg>
  )
}

// ── cumulative dose ──────────────────────────────────────────────────
export function DoseChart({ points, sols }: { points: [number, number][]; sols: number }) {
  const W = 380, H = 80, L = 6, R = 6, T = 8, B = 8
  const top = Math.max(1, ...points.map(p => p[1])) * 1.1
  const x = (h: number) => L + (h / (sols * 24)) * (W - L - R)
  const y = (v: number) => H - B - (v / top) * (H - T - B)
  const pts = points.map(p => [x(p[0]), y(p[1])] as [number, number])
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="mchart" role="img" aria-label="cumulative dose">
      <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="rgba(148,163,209,0.2)" />
      {Array.from({ length: sols - 1 }, (_, d) => (
        <line key={d} x1={x((d + 1) * 24)} x2={x((d + 1) * 24)} y1={T} y2={H - B} stroke="rgba(148,163,209,0.18)" strokeDasharray="3 4" />
      ))}
      {pts.length > 1 && <path d={path(pts) + `L${pts[pts.length - 1][0]} ${H - B}L${pts[0][0]} ${H - B}Z`} fill="rgba(62,240,160,0.12)" />}
      {pts.length > 1 && <path d={path(pts)} fill="none" stroke="#3ef0a0" strokeWidth="2" />}
    </svg>
  )
}

/** Tiny trend line for a tile. */
export function Spark({ data, color = '#3ef0a0' }: { data: number[]; color?: string }) {
  if (data.length < 2) return <svg viewBox="0 0 200 34" width="100%" className="mspark" />
  const lo = Math.min(...data), hi = Math.max(...data)
  const pts = data.map((v, i) => [2 + (i / (data.length - 1)) * 196, 31 - ((v - lo) / (hi - lo || 1)) * 27] as [number, number])
  return <svg viewBox="0 0 200 34" width="100%" className="mspark"><path d={path(pts)} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" /></svg>
}
