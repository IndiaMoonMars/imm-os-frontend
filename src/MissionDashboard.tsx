import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { Activity, CalendarClock, Download, FileText, Flag, ListChecks, Radiation, Rocket, ScrollText, Send } from 'lucide-react'
import { Panel } from './components/Hud'
import { hasRole } from './auth'
import { useClock } from './hooks/useMission'
import type { SnapshotEntry } from './sensors/model'
import { CATALOG } from './sensors/model'
import {
  MEASUREMENTS, clockAt, clockLabel, dhms, getJson, istDate, istInput, istShort, istTime, openDownload, postJson,
  useMissionState, type HealthGrid, type MissionClock, type MissionEvent, type MissionState, type Overlay,
  type Overview, type SolDetail, type Timeline,
} from './mission/api'
import { DoseChart, OverlayChart, Spark, TimelineChart } from './mission/charts'
import { LIMITS, SOL_COLORS } from './mission/constants'
import { readiness, type ReadyItem } from './mission/readiness'

const TILE_KEYS = ['co2', 'o2', 'temperature', 'humidity', 'radiation', 'methane']
const canPlan = () => hasRole('commander') || hasRole('mcc_operator')

function usePolled<T>(url: string | null, everyMs: number, deps: unknown[] = []): { data: T | null; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!url) { setData(null); return }
    let alive = true
    const load = async () => {
      try { const d = await getJson<T>(url); if (alive) { setData(d); setError(null) } }
      catch (e) { if (alive) setError((e as Error).message) }
    }
    load()
    const iv = setInterval(load, everyMs)
    const onChange = () => load()
    window.addEventListener('imm-mission-changed', onChange)
    return () => { alive = false; clearInterval(iv); window.removeEventListener('imm-mission-changed', onChange) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, everyMs, n, ...deps])
  return { data, error, reload: () => setN(x => x + 1) }
}

export default function MissionDashboard() {
  const { state, error, reload } = useMissionState(30000)
  const now = useClock()
  const clock = clockAt(state, now)
  const sensors = usePolled<{ sensors: SnapshotEntry[] }>('/api/telemetry/sensors?minutes=10', 10000)
  const ready = useMemo(() => readiness(sensors.data?.sensors ?? [], now), [sensors.data, now])

  if (!state) {
    return <div className="tab-body mission-page"><Panel title="Mission" icon={<Rocket size={16} />}>
      <div className="empty">{error ? 'The mission service is not answering (backend or database down).' : 'Loading…'}</div>
    </Panel></div>
  }
  if (!state.mission || clock.phase === 'none') {
    return <div className="tab-body mission-page"><StartMission onDone={reload} /><Readiness items={ready} /><Checklist /></div>
  }
  return <MissionView state={state} clock={clock} now={now} ready={ready} reload={reload} />
}

// ── a mission exists ────────────────────────────────────────────────
function MissionView({ state, clock, now, ready, reload }: {
  state: MissionState; clock: MissionClock; now: number; ready: ReadyItem[]; reload: () => void
}) {
  const m = state.mission!
  const [sel, setSel] = useState<number | null>(null)
  const current = clock.phase === 'active' ? clock.sol! : clock.phase === 'complete' ? clock.sol! : 1
  const solN = sel ?? current
  const started = clock.phase !== 'pre'
  const overview = usePolled<Overview>(started ? '/api/mission/overview' : null, 60000)
  const detail = usePolled<SolDetail>(started ? `/api/mission/sol/${solN}` : null, 60000, [solN])
  const [tlKey, setTlKey] = useState('co2')
  const [ovKey, setOvKey] = useState('temperature')
  const timeline = usePolled<Timeline>(started ? `/api/mission/timeline?measurement=${tlKey}` : null, 60000)
  const overlay = usePolled<Overlay>(started ? `/api/mission/overlay?measurement=${ovKey}` : null, 120000)
  const health = usePolled<HealthGrid>(started ? '/api/mission/health' : null, 120000)
  const [editing, setEditing] = useState(false)
  const [newMission, setNewMission] = useState(false)
  const cards = overview.data?.sols ?? state.sols
  const nodes = new Set((health.data?.rows ?? []).map(r => r.node_id)).size
  const cl = clockLabel(clock)
  const progress = Math.max(0, Math.min(1, clock.progress ?? 0))
  const methaneWarm = ready.find(r => r.key.split('|')[1] === 'mq4' && r.pill.startsWith('WARMING'))

  return (
    <div className="tab-body mission-page">
      <Panel className="mission-banner">
        <div className="mission-hero">
          <div>
            <h2>{m.name.toUpperCase()}</h2>
            <p>Sol 1 {now / 1000 < m.start ? 'starts' : 'started'} <b>{m.start_ist}</b> · ends Sol {m.sols} at {istDate(m.end * 1000, false)} {istTime(m.end * 1000, false)} IST
              {m.crew ? ` · crew ${m.crew}` : ''}{nodes ? ` · ${nodes} node${nodes > 1 ? 's' : ''}` : ''}{m.ended_at ? ` · ended ${istShort(m.ended_at * 1000)} IST` : ''}</p>
          </div>
          <div className="mission-actions">
            {started && <button className="mbtn" onClick={() => openDownload(`/api/mission/download/sol/${solN}`)}><Download size={14} /> Sol {solN} data (ZIP)</button>}
            {started && <button className="mbtn" onClick={() => openDownload(`/api/mission/report/${solN}`)}><FileText size={14} /> Sol {solN} report (PDF)</button>}
            {started && <button className="mbtn pri" onClick={() => openDownload('/api/mission/download/mission')}><Download size={14} /> Whole mission</button>}
            {canPlan() && clock.phase !== 'complete' && <button className="mbtn" onClick={() => setEditing(x => !x)}>Edit</button>}
            {canPlan() && clock.phase === 'complete' && <button className="mbtn" onClick={() => setNewMission(x => !x)}>New mission</button>}
          </div>
        </div>
        {clock.phase === 'pre' && <div className="mission-countdown"><small>SOL 1 STARTS IN</small><b>{dhms(clock.t_minus_s ?? 0)}</b></div>}
        {clock.phase !== 'pre' && (
          <div className="mission-clockline">
            <span className="mc-label">{cl.label}</span><b>{cl.value}</b>
            {clock.phase === 'active' && <span className="mc-left">Sol {clock.sol} ends in {dhms(clock.sol_left_s ?? 0)} · {istTime((m.start + clock.sol! * 86400) * 1000, false)} IST</span>}
          </div>
        )}
        <div className="mission-bar" aria-label={`${(progress * 100).toFixed(0)} % of the mission`}><div style={{ width: `${progress * 100}%` }} /></div>
        <div className="sol-cards" style={{ gridTemplateColumns: `repeat(${Math.min(m.sols, 10)}, minmax(0, 1fr))` }}>
          {cards.map(c => (
            <button key={c.sol} className={`sol-card ${c.state} ${c.sol === solN ? 'sel' : ''}`} disabled={c.state === 'upcoming'}
              onClick={() => setSel(c.sol === current ? null : c.sol)} title={c.archived ? 'archived' : undefined}>
              <b>SOL {c.sol}</b>
              <span className="st">{c.state === 'done' ? `✓ ${c.coverage_pct != null ? c.coverage_pct.toFixed(1) + '%' : ''}` : c.state === 'live' ? `● LIVE${c.coverage_pct != null ? ' ' + c.coverage_pct.toFixed(0) + '%' : ''}` : '○'}</span>
              <small>{istShort(c.start * 1000)} → {istShort(c.end * 1000)} IST</small>
            </button>
          ))}
        </div>
        {editing && <EditMission m={m} onDone={() => { setEditing(false); reload() }} />}
        {newMission && <StartMission onDone={() => { setNewMission(false); reload() }} inline />}
      </Panel>

      {started && (
        <Panel title={<>SOL {solN} {detail.data?.live ? 'SO FAR' : ''} · HABITAT</>} icon={<Activity size={16} />}
          right={<span className="muted">{detail.data ? `min – max since ${istShort(detail.data.start * 1000)} IST · good readings only (warm-up excluded)` : detail.error ?? 'loading…'}</span>}>
          <div className="mtiles">
            {TILE_KEYS.map(k => {
              const s = detail.data?.measurements[k]
              const warm = k === 'methane' && methaneWarm && detail.data?.live
              const big = detail.data?.live ? s?.last : s?.mean
              return (
                <div key={k} className="mtile">
                  <small>{(s?.label ?? MEASUREMENTS.find(x => x.key === k)?.label ?? k).toUpperCase()} {s?.source && !detail.data?.live ? '· MEAN' : ''}</small>
                  <b>{warm ? '—' : big != null ? big.toFixed(s!.dp) : '—'}<u>{s?.unit}</u></b>
                  {warm ? <div className="warmbar"><div style={{ width: `${(methaneWarm!.progress ?? 0) * 100}%` }} /></div>
                    : <Spark data={(detail.data?.series[k] ?? []).map(p => p[1])} />}
                  <p>{warm ? methaneWarm!.pill.toLowerCase() : s?.min != null ? `${s.min.toFixed(s.dp)} – ${s.max!.toFixed(s.dp)}` : 'no readings'}<br />
                    {warm ? 'MQ-4 heater' : s?.max_t ? `peak ${istTime(s.max_t * 1000, false)} IST` : s?.source ? '' : 'sensor not in this mission'}</p>
                </div>
              )
            })}
          </div>
        </Panel>
      )}

      <div className="mission-grid">
        <div className="mission-col">
          {started && (
            <Panel title="7-SOL TIMELINE" icon={<CalendarClock size={16} />} right={<span className="muted">10-min mean · band = min–max · IST on the axis</span>}>
              <Seg value={tlKey} onChange={setTlKey} />
              {timeline.data && <TimelineChart points={timeline.data.points} sols={m.sols} nowH={timeline.data.now_h} start={m.start}
                unit={timeline.data.unit} dp={timeline.data.dp} limits={LIMITS[tlKey]} label={timeline.data.label} />}
              {timeline.error && <div className="empty">{timeline.error}</div>}
            </Panel>
          )}
          {started && (
            <Panel title={`SOL vs SOL · ${(overlay.data?.label ?? '').toUpperCase()}`} icon={<Activity size={16} />} right={<span className="muted">hours into each sol · same hour, different days</span>}>
              <Seg value={ovKey} onChange={setOvKey} />
              {overlay.data && <>
                <div className="mlegend">{Object.keys(overlay.data.sols).map(n => (
                  <span key={n}><i style={{ background: SOL_COLORS[(Number(n) - 1) % SOL_COLORS.length] }} />Sol {n}{Number(n) === current && clock.phase === 'active' ? ' (live)' : ''}</span>
                ))}</div>
                <OverlayChart sols={overlay.data.sols} unit={overlay.data.unit} dp={overlay.data.dp} current={current} label={overlay.data.label} />
              </>}
            </Panel>
          )}
          {started && <HealthTable grid={health.data} current={clock.phase === 'active' ? current : undefined} />}
        </div>
        <div className="mission-col side">
          <Readiness items={ready} />
          {started && <Events sol={solN} events={detail.data?.events ?? []} onAdded={detail.reload} />}
          {started && overview.data && (
            <Panel title="MISSION DOSE" icon={<Radiation size={16} />} right={<span className="muted">external Geiger · cumulative</span>}>
              <div className="dose-big">{overview.data.dose.total_usv.toFixed(1)} <u>µSv</u></div>
              <p className="muted">{Object.entries(overview.data.dose.per_sol).map(([n, v]) => `Sol ${n} · ${v == null ? '–' : v.toFixed(1)}`).join('   ')}
                {clock.phase === 'active' ? ' (so far)' : ''}</p>
              <DoseChart points={overview.data.dose.points} sols={m.sols} />
            </Panel>
          )}
          {started && overview.data && <p className="muted archive-note">Each finished sol is archived 10 min after it ends to <code>{overview.data.archive_dir}</code> (MISSION_ARCHIVE_DIR on the MCC PC) with SHA-256 checksums.</p>}
        </div>
      </div>
      {!started && <Checklist />}
    </div>
  )
}

function Seg({ value, onChange }: { value: string; onChange: (k: string) => void }) {
  return (
    <div className="mseg">
      {MEASUREMENTS.map(x => <button key={x.key} className={x.key === value ? 'on' : ''} onClick={() => onChange(x.key)}>{x.label}</button>)}
    </div>
  )
}

// ── data health: % of expected readings, sensor × sol ───────────────
const sensorLabel = (s: string) => {
  if (s === 'board') return 'ESP32 board · health'
  const d = CATALOG[s]
  return d ? `${d.hw.split(' · ')[0]} · ${d.label.toLowerCase()}` : s
}

function HealthTable({ grid, current }: { grid: HealthGrid | null; current?: number }) {
  if (!grid) return null
  const multiNode = new Set(grid.rows.map(r => r.node_id)).size > 1
  const low: string[] = []
  return (
    <Panel title="DATA HEALTH · % OF EXPECTED READINGS" icon={<ListChecks size={16} />} right={<span className="muted">a gap shows where data is missing</span>}>
      <table className="mhealth">
        <thead><tr><th className="l">SENSOR</th>{Array.from({ length: grid.sols }, (_, i) => <th key={i}>SOL {i + 1}</th>)}</tr></thead>
        <tbody>
          {grid.rows.map(r => (
            <tr key={`${r.sensor}|${r.node_id}|${r.zone}`}>
              <td className="l">{sensorLabel(r.sensor)}<small>{multiNode ? `${r.node_id} · ` : ''}{r.zone}</small></td>
              {Array.from({ length: grid.sols }, (_, i) => {
                const p = r.sols[String(i + 1)]
                if (p == null) return <td key={i} className="c none">—</td>
                if (p < 95) low.push(`${sensorLabel(r.sensor)} Sol ${i + 1}: ${p.toFixed(0)} %`)
                const a = 0.08 + 0.5 * Math.max(0, (p - 80) / 20)
                return <td key={i} className={`c ${p < 95 ? 'low' : ''}`} style={{ background: `rgba(25,158,112,${a.toFixed(2)})` } as CSSProperties}
                  title={`${p} % of the expected readings`}>{p.toFixed(0)}%{i + 1 === current ? '*' : ''}</td>
              })}
            </tr>
          ))}
          {!grid.rows.length && <tr><td colSpan={grid.sols + 1} className="empty">No real sensor has reported in this mission yet.</td></tr>}
        </tbody>
      </table>
      <p className="muted small">{current ? `* Sol ${current} so far. ` : ''}{low.length ? `Outlined = below 95 %: ${low.slice(0, 6).join(' · ')}` : 'Every sensor above 95 % in every sol.'}</p>
    </Panel>
  )
}

// ── readiness and warm-up ───────────────────────────────────────────
function Readiness({ items }: { items: ReadyItem[] }) {
  return (
    <Panel title="SENSOR READINESS" icon={<Flag size={16} />} right={<span className="muted">warm-up handled per sensor</span>}>
      <div className="mready">
        {items.map(r => (
          <div key={r.key}>
            <span><b>{r.name}</b><p>{r.detail}</p><small>{r.where}</small></span>
            <span className={`mpill ${r.tone}`}>{r.pill}</span>
            {r.progress !== undefined && <div className="warmbar"><div style={{ width: `${Math.max(0, Math.min(1, r.progress)) * 100}%` }} /></div>}
          </div>
        ))}
        {!items.length && <div className="empty">No real sensor reporting right now.</div>}
      </div>
    </Panel>
  )
}

// ── the sol's events (IST) and notes ────────────────────────────────
function Events({ sol, events, onAdded }: { sol: number; events: MissionEvent[]; onAdded: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    try { await postJson('/api/mission/events', { message: text.trim() }); setText(''); onAdded() } catch { /* shown by the next poll */ }
    setBusy(false)
  }
  const tone = (e: MissionEvent) => e.kind === 'alarm.cleared' || e.kind === 'archive' ? 'o'
    : e.kind.startsWith('alarm') ? (e.severity === 'warning' || e.severity === 'emergency' ? 'c' : 'w') : ''
  return (
    <Panel title={`SOL ${sol} EVENTS`} icon={<ScrollText size={16} />} right={<span className="muted">times in IST</span>}>
      <form className="mnote" onSubmit={add}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Add to the mission log (e.g. crew wake · lights on)" maxLength={500} />
        <button className="mbtn" disabled={busy || !text.trim()}><Send size={13} /></button>
      </form>
      <div className="mevents">
        {events.slice(0, 40).map((e, i) => (
          <div key={i}>
            <span>{istTime(e.at * 1000)}</span>
            <b className={tone(e)}>{e.kind.startsWith('alarm.') ? `${(e.severity ?? '').toUpperCase()} ${e.kind === 'alarm.raised' ? '' : e.kind.slice(6) + ': '}` : ''}{e.message}{e.actor ? ` · ${e.actor}` : ''}</b>
          </div>
        ))}
        {!events.length && <div className="empty">Nothing logged in this sol yet.</div>}
      </div>
    </Panel>
  )
}

// ── start / edit ────────────────────────────────────────────────────
function StartMission({ onDone, inline = false }: { onDone: () => void; inline?: boolean }) {
  const [name, setName] = useState('')
  const [start, setStart] = useState(istInput(Date.now()))
  const [sols, setSols] = useState(7)
  const [crew, setCrew] = useState<number | ''>('')
  const [err, setErr] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    try {
      await postJson('/api/mission/start', { name, start_ist: start.replace('T', ' '), sols, crew: crew === '' ? null : crew })
      onDone()
    } catch (x) { setErr((x as Error).message) }
  }
  const body = (
    <form className="mform" onSubmit={submit}>
      <label>Mission name<input value={name} onChange={e => setName(e.target.value)} placeholder="Analog Mission Alpha" required maxLength={80} /></label>
      <label>Sol 1 starts (IST)<input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} required /></label>
      <label>Sols<input type="number" min={1} max={60} value={sols} onChange={e => setSols(Number(e.target.value))} /></label>
      <label>Crew<input type="number" min={0} max={50} value={crew} onChange={e => setCrew(e.target.value === '' ? '' : Number(e.target.value))} /></label>
      <button className="mbtn pri" disabled={!canPlan()} title={canPlan() ? '' : 'commander or MCC operator role needed'}><Rocket size={14} /> Start mission</button>
      {!canPlan() && <p className="muted small">Only a commander or MCC operator can start the mission.</p>}
      {err && <p className="merr">{err}</p>}
      <p className="muted small">Sols are 24 h each from this moment. Readings before it are pre-mission checkout (Sol 0) and don't count.</p>
    </form>
  )
  return inline ? body : <Panel title="START THE MISSION" icon={<Rocket size={16} />}>{body}</Panel>
}

function EditMission({ m, onDone }: { m: NonNullable<MissionState['mission']>; onDone: () => void }) {
  const [name, setName] = useState(m.name)
  const [start, setStart] = useState(istInput(m.start * 1000))
  const [sols, setSols] = useState(m.sols)
  const [err, setErr] = useState<string | null>(null)
  const save = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    try {
      const body: Record<string, unknown> = {}
      if (name !== m.name) body.name = name
      if (start !== istInput(m.start * 1000)) body.start_ist = start.replace('T', ' ')
      if (sols !== m.sols) body.sols = sols
      if (Object.keys(body).length) await postJson('/api/mission', body, 'PATCH')
      onDone()
    } catch (x) { setErr((x as Error).message) }
  }, [name, start, sols, m, onDone])
  const end = async () => {
    if (!confirm(`End ${m.name} now? The record stops here; finished sols stay archived.`)) return
    try { await postJson('/api/mission/end', {}); onDone() } catch (x) { setErr((x as Error).message) }
  }
  return (
    <form className="mform" onSubmit={save}>
      <label>Mission name<input value={name} onChange={e => setName(e.target.value)} maxLength={80} /></label>
      <label>Sol 1 starts (IST)<input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></label>
      <label>Sols<input type="number" min={1} max={60} value={sols} onChange={e => setSols(Number(e.target.value))} /></label>
      <button className="mbtn pri">Save</button>
      <button type="button" className="mbtn danger" onClick={end}>End mission now</button>
      {err && <p className="merr">{err}</p>}
      <p className="muted small">Changing the start moves every sol boundary; stored readings are not rewritten.</p>
    </form>
  )
}

function Checklist() {
  return (
    <Panel title="BEFORE SOL 1" icon={<ListChecks size={16} />}>
      <ol className="mcheck">
        <li><b>T−48 h</b> Power everything on and leave it on: MQ-4 / MQ-7 burn-in, GNSS almanac, stable temperatures.</li>
        <li><b>T−2 h</b> Calibrate in fresh outdoor air: <code>CAL_O2</code>, <code>CAL_CO2</code> (after 3 min outside; turns SCD40 self-calibration off), <code>CAL_MQ4</code>. Rotate the BNO055 until 3/3; it is then restored at every restart.</li>
        <li><b>T−1 h</b> On the Pi: <code>tools/bringup.py all</code>. On the MCC: <code>scripts/mission-readiness.ps1 --quick</code> must say GO.</li>
        <li><b>T−10 min</b> Every sensor on this page READY, Health page GO, archive folder on the external drive (MISSION_ARCHIVE_DIR).</li>
        <li><b>T0</b> Start the mission. Sol 1 begins; every sol is 24 h and archived 10 min after it ends.</li>
      </ol>
    </Panel>
  )
}
