import { useEffect, useRef, useState } from 'react'
import { authFetch } from '../auth'

/** Poll a JSON endpoint; keeps the last good value when a request fails. */
export function usePoll<T>(url: string, intervalMs: number): { data: T | null; error: boolean; updated: number } {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState(false)
  const [updated, setUpdated] = useState(0)
  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const res = await authFetch(url)
        if (!res.ok) throw new Error(String(res.status))
        const json = (await res.json()) as T
        if (alive) { setData(json); setError(false); setUpdated(Date.now()) }
      } catch {
        if (alive) setError(true)
      }
    }
    tick()
    const iv = setInterval(tick, intervalMs)
    return () => { alive = false; clearInterval(iv) }
  }, [url, intervalMs])
  return { data, error, updated }
}

// ── Telemetry (backend /api/telemetry) ────────────────────────────

export interface Reading { value: number; unit: string; timestamp?: string; simulated?: boolean | string; sensor?: string; zone?: string }
export type NodeReadings = Record<string, Reading>
export interface LatestTelemetry { readings: Record<string, NodeReadings>; _meta?: { source: string } }

export const isSimulated = (r?: Reading) => r ? r.simulated === true || r.simulated === 'true' || r.simulated === 'True' : true

export function useTelemetry(intervalMs = 5000) {
  const poll = usePoll<LatestTelemetry>('/api/telemetry/latest', intervalMs)
  // tolerate a malformed payload rather than crashing every consumer
  const data = poll.data && typeof poll.data.readings === 'object' && poll.data.readings !== null ? poll.data : null
  return { ...poll, data, error: poll.error || (poll.data !== null && data === null) }
}

/** Average of a measurement across all nodes that report it. */
export function avgOf(t: LatestTelemetry | null, measurement: string): Reading | undefined {
  if (!t) return undefined
  const rs = Object.values(t.readings).map(n => n[measurement]).filter(Boolean) as Reading[]
  if (!rs.length) return undefined
  return { ...rs[0], value: rs.reduce((s, r) => s + Number(r.value), 0) / rs.length }
}

/** Keeps a rolling window of values per key, fed from successive polls. */
export function useRolling(values: Record<string, number | undefined>, size = 40): Record<string, number[]> {
  const ref = useRef<Record<string, number[]>>({})
  const key = JSON.stringify(values)
  const [, force] = useState(0)
  useEffect(() => {
    let changed = false
    for (const [k, v] of Object.entries(values)) {
      if (v === undefined || Number.isNaN(v)) continue
      const arr = ref.current[k] ?? []
      ref.current[k] = [...arr, v].slice(-size)
      changed = true
    }
    if (changed) force(x => x + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, size])
  return ref.current
}

// ── Mission time (time-service) ───────────────────────────────────

export interface MissionTime { utc: string; ist: string; lst: string; msd: number; cmt: string }

/** Mars Sol Date computed locally (same formula family as time-service), used between polls. */
export function localMsd(ms = Date.now()): number {
  const jdUt = ms / 86400000 + 2440587.5
  const jdTt = jdUt + 69.184 / 86400
  return (jdTt - 2405522.0028779) / 1.0274912517
}

export function useClock(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(iv)
  }, [intervalMs])
  return now
}

export interface DelayConfig { mode: string; value: number }
