import { useState, type CSSProperties } from 'react'
import { Footprints, Radar, Server, ShieldCheck, History } from 'lucide-react'
import TabHero from './components/TabHero'
import { Panel } from './components/Hud'
import { tabByKey } from './theme/tabs'
import { usePoll } from './hooks/useMission'
import {
  MODE_COLOR, SEV_COLOR, SUB_COLOR, useHealthActions, useHealthSummary, type CrewLos, type Severity,
} from './hooks/useHealth'

interface StreamRow {
  key: string; node_id: string; sensor: string; zone: string; crew_id: string | null; simulated: boolean
  status: 'ok' | 'suspect' | 'bad' | 'stale' | 'offline'; reasons: string[]; age_s: number | null
  integrity: { received: number; lost: number; recovered: number; duplicates: number; delayed: number }
}
interface ServiceRow { ok: boolean; critical: boolean; kind?: string; error?: string | null; lag?: number | null }
interface HistoryRow { id: number; alarm_key: string; event: string; severity: Severity; message: string; actor?: string | null; at: number }

const STATUS_COLOR: Record<StreamRow['status'], string> = {
  ok: '#3ef0a0', suspect: '#ffd166', bad: '#ff5d73', stale: '#ffb547', offline: '#ff5d73',
}
const LOS_COLOR: Record<CrewLos['state'], string> = {
  DISARMED: '#5d6a88', NOMINAL: '#3ef0a0', LOS_WARN: '#ffd166', LOS: '#ffb547', CONTINGENCY: '#ff5d73',
}
const secs = (s: number | null | undefined) => s == null ? '–' : s < 90 ? `${s.toFixed(0)} s` : `${(s / 60).toFixed(1)} min`
const when = (t: number) => new Date(t * 1000).toLocaleString()

export default function HealthDashboard() {
  const { data: sum, error } = useHealthSummary(3000)
  const eva = usePoll<{ crews: CrewLos[]; thresholds: Record<string, number> }>('/api/health/eva', 2000)
  const streams = usePoll<{ streams: StreamRow[] }>('/api/health/streams', 10000)
  const services = usePoll<{ services: Record<string, ServiceRow> }>('/api/health/services', 10000)
  const history = usePoll<{ events: HistoryRow[] }>('/api/health/alarms/history?limit=60', 15000)
  const { arm, disarm } = useHealthActions()
  const [crewInput, setCrewInput] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [showSim, setShowSim] = useState(false)

  const act = async (f: () => Promise<unknown>, ok: string) => {
    try { await f(); setMsg(ok) } catch (e) { setMsg(`Refused: ${String(e).slice(0, 120)}`) }
  }
  const mode = sum?.mode
  const shownStreams = (streams.data?.streams ?? []).filter(s => showSim || !s.simulated)
  const problems = shownStreams.filter(s => s.status !== 'ok' || s.integrity.lost > 0)

  return (
    <div className="tab-body">
      <TabHero tab={tabByKey('health')} />
      <div className="health-grid">
        <Panel title="Mission mode" icon={<ShieldCheck size={16} />}>
          {error && <p className="health-note bad">Health monitor unreachable: the state below may be old.</p>}
          <div className="mode-banner" style={{ '--mode': mode ? MODE_COLOR[mode] : '#5d6a88' } as CSSProperties}>
            <strong>{mode ?? '…'}</strong>
            <span>{sum ? `${sum.alarms_active} active alarm(s), ${sum.alarms_unacked} unacknowledged` : ''}
              {sum?.comm_delay_s ? ` · comm delay ${secs(sum.comm_delay_s)}` : ''}</span>
          </div>
          <div className="subsys-grid">
            {(sum?.subsystems ?? []).map(s => (
              <div key={s.id} className="subsys" style={{ '--sub': SUB_COLOR[s.status] } as CSSProperties}>
                <div><strong>{s.name}</strong><em>{s.status.replace('_', '-')}</em></div>
                {s.reasons.slice(0, 4).map(r => <small key={r}>{r}</small>)}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="EVA loss of signal" icon={<Footprints size={16} />}>
          <p className="health-note">
            LOS warning after {secs(eva.data?.thresholds.warn_s)}, LOS after {secs(eva.data?.thresholds.los_s)},
            contingency after {secs(eva.data?.thresholds.contingency_s)} without suit telemetry.
          </p>
          <div className="crew-list">
            {(eva.data?.crews ?? []).filter(c => c.armed).map(c => (
              <div key={c.crew_id} className={`crew-los ${c.state.toLowerCase()}`} style={{ '--los': LOS_COLOR[c.state] } as CSSProperties}>
                <div className="crew-los-head"><strong>{c.crew_id}</strong><em>{c.state.replace('_', ' ')}</em>
                  <button className="mini-btn" onClick={() => act(() => disarm(c.crew_id), `${c.crew_id}: EVA monitoring off`)}>
                    EVA ended</button></div>
                <small>last contact {secs(c.since_contact_s)} ago · vitals {secs(c.vitals_age_s)} · position {secs(c.position_age_s)}</small>
                {c.last_vitals?.hr_bpm != null && (
                  <small>HR {c.last_vitals.hr_bpm?.toFixed(0)} bpm · SpO₂ {c.last_vitals.spo2_pct?.toFixed(0)} %
                    {c.last_vitals.skin_temp_c != null ? ` · skin ${c.last_vitals.skin_temp_c.toFixed(1)} °C` : ''}</small>
                )}
                {c.last_position?.mode && (
                  <small>last position {c.last_position.mode === 'uwb'
                    ? `${c.last_position.x_m?.toFixed(1)}, ${c.last_position.y_m?.toFixed(1)} m (UWB)`
                    : `${c.last_position.lat?.toFixed(5)}, ${c.last_position.lon?.toFixed(5)} (GPS)`}
                    {c.search_radius_m != null ? ` · search radius ${c.search_radius_m.toFixed(0)} m` : ''}</small>
                )}
                {c.outages.length > 0 && (
                  <small>last outage {secs(c.outages[c.outages.length - 1].duration_s)}
                    , {c.outages[c.outages.length - 1].backfilled} reading(s) filled in from the suit</small>
                )}
              </div>
            ))}
            {!(eva.data?.crews ?? []).some(c => c.armed) && <p className="health-note">No crew member on EVA.</p>}
          </div>
          <form className="crew-arm" onSubmit={e => { e.preventDefault(); const c = crewInput.trim(); if (c) act(() => arm(c), `${c}: EVA monitoring on`); setCrewInput('') }}>
            <input value={crewInput} onChange={e => setCrewInput(e.target.value)} placeholder="crew id (e.g. ev1)" />
            <button className="mini-btn" type="submit">Start EVA monitoring</button>
          </form>
          {msg && <p className="health-note">{msg}</p>}
        </Panel>

        <Panel title="MCC services" icon={<Server size={16} />}>
          <ul className="svc-list">
            {Object.entries(services.data?.services ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([name, s]) => (
              <li key={name} style={{ '--svc': s.ok ? '#3ef0a0' : s.critical ? '#ff5d73' : '#ffb547' } as CSSProperties}>
                <span className="svc-dot" /><strong>{name}</strong>
                <small>{s.ok ? (s.lag != null ? `backlog ${s.lag}` : 'ok') : s.error ?? 'down'}</small>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={`Sensor streams (${problems.length} need attention)`} icon={<Radar size={16} />}>
          <label className="health-note"><input type="checkbox" checked={showSim} onChange={e => setShowSim(e.target.checked)} /> include simulator</label>
          <table className="stream-table">
            <thead><tr><th>Node</th><th>Sensor</th><th>Zone</th><th>Status</th><th>Age</th><th>Lost / filled</th></tr></thead>
            <tbody>
              {[...problems, ...shownStreams.filter(s => !problems.includes(s))].map(s => (
                <tr key={s.key} style={{ '--st': STATUS_COLOR[s.status] } as CSSProperties}>
                  <td>{s.node_id}</td><td>{s.sensor}</td><td>{s.crew_id ?? s.zone}</td>
                  <td><span className="st">{s.status}</span>{s.reasons.length ? <small> {s.reasons.join(', ').replace(/_/g, ' ')}</small> : null}</td>
                  <td>{secs(s.age_s)}</td>
                  <td>{s.integrity.lost} / {s.integrity.recovered}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Alarm history" icon={<History size={16} />}>
          <ul className="history-list">
            {(history.data?.events ?? []).map(h => (
              <li key={h.id} style={{ '--sev': SEV_COLOR[h.severity] ?? '#5d6a88' } as CSSProperties}>
                <time>{when(h.at)}</time><em>{h.event}</em><span>{h.message}</span>{h.actor ? <small> · {h.actor}</small> : null}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  )
}
