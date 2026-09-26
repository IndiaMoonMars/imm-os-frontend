import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Activity, RadioTower, Server } from 'lucide-react'
import TabHero from './components/TabHero'
import { Panel, Pill, SourceBadge, Sparkline } from './components/Hud'
import { authFetch } from './auth'
import { useRealtime } from './hooks/useRealtime'
import {
  CATALOG, FRESH_COLOR, ageLabel, applyFrame, applySnapshot, freshness, m, rateHz,
  type SnapshotEntry, type Stream,
} from './sensors/model'
import { tabByKey } from './theme/tabs'

// ── View ────────────────────────────────────────────────────────────

export default function SensorsDashboard() {
  const streams = useRef(new Map<string, Stream>())
  const frames = useRef(0)
  const [, setTick] = useState(0)
  const [hideSim, setHideSim] = useState(false)
  const [snapshotError, setSnapshotError] = useState(false)

  const link = useRealtime(f => { frames.current++; applyFrame(streams.current, f) })

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const res = await authFetch('/api/telemetry/sensors?minutes=30')
        if (!res.ok) throw new Error(String(res.status))
        const body = await res.json() as { sensors: SnapshotEntry[] }
        if (alive) { applySnapshot(streams.current, body.sensors ?? []); setSnapshotError(false) }
      } catch {
        if (alive) setSnapshotError(true)
      }
    }
    load()
    const iv = setInterval(load, 60000)
    return () => { alive = false; clearInterval(iv) }
  }, [])

  // render at most 4×/s however fast frames arrive (ECG is 100/s)
  const lastFrames = useRef({ n: 0, t: Date.now(), rate: 0 })
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now(), lf = lastFrames.current
      if (now - lf.t >= 2000) { lf.rate = (frames.current - lf.n) / ((now - lf.t) / 1000); lf.n = frames.current; lf.t = now }
      setTick(x => x + 1)
    }, 250)
    return () => clearInterval(iv)
  }, [])

  const now = Date.now()
  const all = [...streams.current.values()].filter(s => !(hideSim && s.simulated))
  const byNode = new Map<string, Stream[]>()
  for (const s of all.sort((a, b) => a.sensor.localeCompare(b.sensor) || a.zone.localeCompare(b.zone))) {
    byNode.set(s.node, [...(byNode.get(s.node) ?? []), s])
  }
  const live = all.filter(s => !s.simulated && freshness(s.sensor, (now - s.ts) / 1000) === 'fresh').length
  const stale = all.filter(s => freshness(s.sensor, (now - s.ts) / 1000) !== 'fresh').length

  return (
    <div className="tab-body">
      <TabHero tab={tabByKey('sensors')}>
        <div className="sensor-stats">
          <div className={`link-state ${link}`}><span className="status-orb" />
            <strong>{link === 'live' ? 'REALTIME LINK' : link === 'connecting' ? 'CONNECTING…' : 'RECONNECTING…'}</strong>
            <small>{lastFrames.current.rate.toFixed(0)} readings/s</small></div>
          <div><strong>{byNode.size}</strong><small>nodes</small></div>
          <div><strong>{all.length}</strong><small>sensor streams</small></div>
          <div><strong className="ok">{live}</strong><small>live (real)</small></div>
          <div><strong className={stale ? 'warn' : ''}>{stale}</strong><small>stale / offline</small></div>
        </div>
      </TabHero>

      <div className="sensor-toolbar">
        <label><input type="checkbox" checked={hideSim} onChange={e => setHideSim(e.target.checked)} /> Real sensors only</label>
        {snapshotError && <Pill tone="warn">history unavailable: showing realtime only</Pill>}
      </div>

      {byNode.size === 0 && (
        <Panel title="Waiting for telemetry" icon={<RadioTower size={16} />}>
          <div className="empty">No readings yet. Start a node's drivers, or the simulator, and they appear here as they arrive.</div>
        </Panel>
      )}

      {[...byNode.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([node, list]) => (
        <Panel key={node} title={node} icon={<Server size={16} />}
          right={<Pill>{list.length} stream{list.length > 1 ? 's' : ''}</Pill>}>
          <div className="sensor-grid">
            {list.map(s => <SensorCard key={s.key} s={s} now={now} />)}
          </div>
        </Panel>
      ))}
    </div>
  )
}

function SensorCard({ s, now }: { s: Stream; now: number }) {
  const def = CATALOG[s.sensor]
  const age = Math.max(0, (now - s.ts) / 1000)
  const fr = freshness(s.sensor, age)
  const hz = rateHz(s.arrivals, now)
  const metricKeys = def ? Object.keys(def.metrics).filter(k => k in s.metrics) : Object.keys(s.metrics)
  const extra = Object.keys(s.metrics).filter(k => !metricKeys.includes(k))
  const warnFlag = s.sensor === 'sysmon' && (s.metrics.undervolt === 1 || s.metrics.throttled === 1)
  return (
    <div className={`sensor-card ${fr}`} style={{ '--fresh': FRESH_COLOR[fr] } as CSSProperties}>
      <div className="sensor-head">
        <span className="fresh-dot" />
        <div className="sensor-name">
          <strong>{def?.label ?? s.sensor}</strong>
          <small>{def?.hw ?? s.sensor} · {s.crew ? `crew ${s.crew}` : s.zone}</small>
        </div>
        <SourceBadge simulated={s.simulated} />
      </div>
      {warnFlag && <Pill tone="crit">{s.metrics.undervolt === 1 ? 'UNDER-VOLTAGE' : 'THROTTLED'}</Pill>}
      <div className="sensor-metrics">
        {[...metricKeys, ...extra].map(k => {
          const md = def?.metrics[k] ?? m(k, '', 2)
          const v = s.metrics[k]
          const showSpark = (s.hist[k]?.length ?? 0) > 1 && md.unit !== ''
          return (
            <div key={k} className="sensor-metric">
              <span>{md.label}</span>
              <strong>{md.unit === '' ? (v ? 'YES' : 'no') : v.toFixed(md.dp)} <small>{md.unit}</small></strong>
              {showSpark && <Sparkline id={`${s.key}-${k}`} data={s.hist[k]} color={s.simulated ? '#ffb547' : '#3ef0a0'} height={s.sensor === 'ecg_ad8232' ? 56 : 28} />}
            </div>
          )
        })}
      </div>
      <div className="sensor-foot">
        <span><Activity size={12} /> {hz ? (hz >= 1 ? `${hz.toFixed(0)} Hz` : `every ${(1 / hz).toFixed(0)} s`) : '—'}</span>
        <span>{fr === 'offline' ? 'no data ' : ''}{ageLabel(age)}</span>
      </div>
      {def?.note && fr !== 'fresh' && <small className="sensor-note">{def.note}</small>}
    </div>
  )
}
