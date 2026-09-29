import { useCallback } from 'react'
import { authFetch } from '../auth'
import { usePoll } from './useMission'

// Health monitor (FDIR) API: imm-os-backend services/health_monitor.py, /api/health/*

export type Severity = 'advisory' | 'caution' | 'warning' | 'emergency'
export type Mode = 'NOMINAL' | 'DEGRADED' | 'EMERGENCY'
export type SubStatus = 'GO' | 'DEGRADED' | 'NO_GO'

export interface Alarm {
  id: number; key: string; severity: Severity; category: string; source: string; message: string
  state: 'active' | 'rtn' | 'closed'; acked: boolean; acked_by?: string | null
  raised_at: number; cleared_at?: number | null; unverified: boolean; simulated: boolean; raise_count: number
}
export interface Subsystem { id: string; name: string; category: string; status: SubStatus; reasons: string[] }
export interface CrewLos {
  crew_id: string; armed: boolean; armed_by?: string; state: 'DISARMED' | 'NOMINAL' | 'LOS_WARN' | 'LOS' | 'CONTINGENCY'
  since_contact_s: number | null; vitals_age_s: number | null; position_age_s: number | null
  last_position: { mode?: string; x_m?: number; y_m?: number; lat?: number; lon?: number }
  last_vitals: { hr_bpm?: number; spo2_pct?: number; skin_temp_c?: number }
  search_radius_m: number | null; outages: { duration_s: number; worst: string; backfilled: number }[]
}
export interface HealthSummary {
  mode: Mode; subsystems: Subsystem[]; alarms: Alarm[]; eva: CrewLos[]
  alarms_active: number; alarms_unacked: number; worst_severity: Severity | null; comm_delay_s: number | null
}

export const SEV_RANK: Record<Severity, number> = { advisory: 0, caution: 1, warning: 2, emergency: 3 }
export const SEV_COLOR: Record<Severity, string> = {
  advisory: '#7aa7ff', caution: '#ffd166', warning: '#ffb547', emergency: '#ff5d73',
}
export const MODE_COLOR: Record<Mode, string> = { NOMINAL: '#3ef0a0', DEGRADED: '#ffb547', EMERGENCY: '#ff5d73' }
export const SUB_COLOR: Record<SubStatus, string> = { GO: '#3ef0a0', DEGRADED: '#ffb547', NO_GO: '#ff5d73' }

/** Open alarms, most severe first; unacknowledged before acknowledged; newest first. */
export function sortAlarms(alarms: Alarm[]): Alarm[] {
  return [...alarms].sort((a, b) =>
    SEV_RANK[b.severity] - SEV_RANK[a.severity] || Number(a.acked) - Number(b.acked) || b.raised_at - a.raised_at)
}

export function useHealthSummary(intervalMs = 3000) {
  return usePoll<HealthSummary>('/api/health/summary', intervalMs)
}

export function useHealthActions() {
  const post = useCallback(async (path: string) => {
    const res = await authFetch(`/api/health${path}`, { method: 'POST' })
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
    return res.json()
  }, [])
  return {
    ack: (id: number) => post(`/alarms/${id}/ack`),
    ackAll: () => post('/alarms/ack-all'),
    arm: (crew: string) => post(`/eva/${encodeURIComponent(crew)}/arm`),
    disarm: (crew: string) => post(`/eva/${encodeURIComponent(crew)}/disarm`),
  }
}
