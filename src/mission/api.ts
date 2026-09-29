import { useEffect, useState } from 'react'
import { authFetch } from '../auth'

// ── Mission record (backend /api/mission, services/mission_api.py) ───────
// A sol is exactly 24 h from the mission start (T0). Times are shown in IST.

export interface Mission {
  id: number; name: string; start: number; end: number; sols: number; crew: number | null; notes: string
  ended_at: number | null; created_by: string | null; start_ist: string; end_ist: string
}
export interface MissionClock {
  phase: 'none' | 'pre' | 'active' | 'complete'
  sol?: number; met_s?: number; sol_elapsed_s?: number; sol_left_s?: number; t_minus_s?: number; progress?: number
}
export interface SolCard {
  sol: number; start: number; end: number; state: 'done' | 'live' | 'upcoming'; start_ist: string; end_ist: string
  coverage_pct?: number | null; readings?: number; dose_usv?: number | null; archived?: boolean
}
export interface MissionState { now: number; mission: Mission | null; clock: MissionClock; sols: SolCard[] }

export interface MeasurementStats {
  label: string; unit: string; dp: number; source: string | null
  mean?: number; min?: number; min_t?: number; max?: number; max_t?: number; last?: number; readings?: number
}
export interface MissionEvent { at: number; kind: string; message: string; actor?: string | null; severity?: string }
export interface SolDetail {
  sol: number; start: number; end: number; live: boolean; start_ist: string; end_ist: string
  measurements: Record<string, MeasurementStats>
  coverage: { sensor: string; node_id: string; zone: string; pct: number | null; readings: number }[]
  coverage_pct: number | null; dose_usv: number | null; readings: number
  events: MissionEvent[]; series: Record<string, [number, number][]>
}
export interface Overview { mission: Mission; clock: MissionClock; sols: SolCard[]; dose: Dose; archive_dir: string }
export interface Dose { per_sol: Record<string, number | null>; total_usv: number; points: [number, number][] }
export interface Timeline {
  measurement: string; label: string; unit: string; dp: number; source: string | null
  points: [number, number | null, number, number][]; now_h: number; sols: number
}
export interface Overlay { measurement: string; label: string; unit: string; dp: number; sols: Record<string, [number, number | null][]> }
export interface HealthGrid {
  sols: number; current?: number
  rows: { sensor: string; node_id: string; zone: string; sols: Record<string, number | null> }[]
}

export const MEASUREMENTS: { key: string; label: string }[] = [
  { key: 'co2', label: 'CO₂' }, { key: 'o2', label: 'O₂' }, { key: 'temperature', label: 'Temperature' },
  { key: 'humidity', label: 'Humidity' }, { key: 'pressure', label: 'Pressure' }, { key: 'radiation', label: 'Radiation' },
  { key: 'methane', label: 'Methane' }, { key: 'co', label: 'CO' },
]

export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(url, init)
  if (!res.ok) {
    let detail = String(res.status)
    try { detail = (await res.json()).detail ?? detail } catch { /* not JSON */ }
    throw new Error(detail)
  }
  return res.json() as Promise<T>
}

export const postJson = <T,>(url: string, body: unknown, method = 'POST') =>
  getJson<T>(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

/** Open a download (a link can't carry the login header, so it gets a 2-minute token). */
export async function openDownload(path: string): Promise<void> {
  const { token } = await postJson<{ token: string }>('/api/mission/download-token', {})
  const sep = path.includes('?') ? '&' : '?'
  window.open(`${path}${sep}dl=${encodeURIComponent(token)}`, '_blank', 'noopener')
}

// ── time: IST and mission elapsed time ───────────────────────────────

const pad = (n: number) => String(Math.floor(n)).padStart(2, '0')
const IST_MS = 330 * 60000
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function istParts(ms: number) {
  const d = new Date(ms + IST_MS)
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth(), d: d.getUTCDate(), wd: d.getUTCDay(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() }
}
export function istTime(ms: number, seconds = true): string {
  const p = istParts(ms)
  return seconds ? `${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}` : `${pad(p.h)}:${pad(p.mi)}`
}
export function istDate(ms: number, withYear = true): string {
  const p = istParts(ms)
  return `${DAYS[p.wd]} ${pad(p.d)} ${MONTHS[p.mo]}${withYear ? ` ${p.y}` : ''}`
}
/** "29 Sep 02:48" */
export const istShort = (ms: number) => { const p = istParts(ms); return `${pad(p.d)} ${MONTHS[p.mo]} ${pad(p.h)}:${pad(p.mi)}` }
/** datetime-local value in IST, e.g. 2026-09-29T17:10 */
export function istInput(ms: number): string {
  const p = istParts(ms)
  return `${p.y}-${pad(p.mo + 1)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`
}
export const hms = (s: number) => `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}`
export function dhms(s: number): string {
  const d = Math.floor(s / 86400)
  return d ? `${d}d ${hms(s - d * 86400)}` : hms(s)
}

/** The mission clock at `nowMs`, from the last poll (it ticks locally between polls). */
export function clockAt(state: MissionState | null, nowMs: number): MissionClock {
  const m = state?.mission
  if (!m) return { phase: 'none' }
  const now = nowMs / 1000
  if (now < m.start) return { phase: 'pre', sol: 0, t_minus_s: m.start - now, progress: 0 }
  const end = m.ended_at ? Math.min(m.end, m.ended_at) : m.end
  if (now >= end) return { phase: 'complete', sol: Math.min(Math.floor((end - 1 - m.start) / 86400) + 1, m.sols), met_s: end - m.start, progress: 1 }
  const met = now - m.start
  const sol = Math.floor(met / 86400) + 1
  const into = met - (sol - 1) * 86400
  return { phase: 'active', sol, met_s: met, sol_elapsed_s: into, sol_left_s: 86400 - into, progress: met / (m.sols * 86400) }
}

export function clockLabel(c: MissionClock): { label: string; value: string } {
  switch (c.phase) {
    case 'active': return { label: 'MISSION TIME', value: `SOL ${c.sol} · ${hms(c.sol_elapsed_s ?? 0)}` }
    case 'pre': return { label: 'SOL 1 STARTS IN', value: `T− ${dhms(c.t_minus_s ?? 0)}` }
    case 'complete': return { label: 'MISSION', value: `COMPLETE · ${c.sol} SOL${c.sol === 1 ? '' : 'S'}` }
    default: return { label: 'MISSION', value: 'NOT STARTED' }
  }
}

/** Polls /api/mission (the top bar and the Mission page share it). */
export function useMissionState(intervalMs = 30000): { state: MissionState | null; error: boolean; reload: () => void } {
  const [state, setState] = useState<MissionState | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let alive = true
    const load = async () => {
      try { const s = await getJson<MissionState>('/api/mission'); if (alive) { setState(s); setError(false) } }
      catch { if (alive) setError(true) }
    }
    load()
    const iv = setInterval(load, intervalMs)
    const onChange = () => load()
    window.addEventListener('imm-mission-changed', onChange)
    return () => { alive = false; clearInterval(iv); window.removeEventListener('imm-mission-changed', onChange) }
  }, [intervalMs])
  return { state, error, reload: () => window.dispatchEvent(new Event('imm-mission-changed')) }
}
