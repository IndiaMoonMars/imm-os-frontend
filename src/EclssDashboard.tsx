import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Lightbulb, Moon, Sparkles, Sun, Sunrise, Wind } from 'lucide-react'
import TabHero from './components/TabHero'
import { Panel, Pill, RingGauge } from './components/Hud'
import { authFetch } from './auth'
import { useSharedTelemetry } from './hooks/telemetryContext'
import { avgOf } from './hooks/useMission'
import { levelOf } from './theme/levels'
import { tabByKey } from './theme/tabs'
import { ATMOS } from './theme/atmos'

interface LightingState { brightness: number; kelvin: number }

const PRESETS: { name: string; icon: typeof Sun; b: number; k: number }[] = [
  { name: 'Wake',     icon: Sunrise,  b: 60,  k: 3500 },
  { name: 'Daylight', icon: Sun,      b: 100, k: 5000 },
  { name: 'Focus',    icon: Sparkles, b: 90,  k: 6500 },
  { name: 'Evening',  icon: Lightbulb, b: 30, k: 2500 },
  { name: 'Night',    icon: Moon,     b: 5,   k: 2000 },
]

/** Approximate RGB of black-body light at a colour temperature (Tanner Helland). */
function kelvinToRgb(k: number): string {
  const t = k / 100
  const r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -0.1332)
  const g = t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.12 * Math.pow(t - 60, -0.0755)
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v)))
  return `rgb(${c(r)}, ${c(g)}, ${c(b)})`
}

export default function EclssDashboard() {
  const { data } = useSharedTelemetry()
  const [lighting, setLighting] = useState<Record<string, LightingState>>({})
  const [status, setStatus] = useState('')
  const pending = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const editing = useRef<Set<string>>(new Set())

  const fetchLighting = async () => {
    try {
      const res = await authFetch('/eclss/api/v1/eclss/lighting')
      if (!res.ok) return
      const fresh = (await res.json()) as Record<string, LightingState>
      // don't overwrite a zone the user is currently dragging
      setLighting(prev => Object.fromEntries(Object.entries(fresh).map(([z, s]) => [z, editing.current.has(z) ? prev[z] ?? s : s])))
    } catch { setStatus('ECLSS API unreachable') }
  }

  useEffect(() => {
    fetchLighting()
    const iv = setInterval(fetchLighting, 5000)
    return () => clearInterval(iv)
  }, [])

  const commit = async (zone: string, s: LightingState) => {
    try {
      const res = await authFetch(`/eclss/api/v1/eclss/lighting/${zone}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s),
      })
      setStatus(res.ok ? `Zone ${zone} → ${s.brightness}% · ${s.kelvin}K` : `Zone ${zone}: update rejected (${res.status})`)
    } catch { setStatus(`Zone ${zone}: update failed`) }
    editing.current.delete(zone)
  }

  // Update the UI immediately; send to the API once the slider settles.
  const change = (zone: string, s: LightingState, delay = 350) => {
    editing.current.add(zone)
    setLighting(prev => ({ ...prev, [zone]: s }))
    clearTimeout(pending.current[zone])
    pending.current[zone] = setTimeout(() => commit(zone, s), delay)
  }

  const zones = Object.entries(lighting)

  return (
    <div className="tab-body">
      <TabHero tab={tabByKey('eclss')}>
        {status && <Pill>{status}</Pill>}
      </TabHero>

      <Panel title="Cabin atmosphere" icon={<Wind size={16} />} right={<Pill>Averaged across habitat nodes</Pill>}>
        <div className="gauge-row">
          {Object.entries(ATMOS).map(([k, l]) => {
            const v = avgOf(data, k)?.value
            return <RingGauge key={k} value={v === undefined ? undefined : Number(v)} min={l.min} max={l.max} label={l.label}
              unit={l.unit} decimals={l.decimals} level={levelOf(v === undefined ? undefined : Number(v), l.lo, l.hi, l.margin)} />
          })}
        </div>
      </Panel>

      <Panel title="Circadian lighting" icon={<Lightbulb size={16} />} right={<Pill>{zones.length} zones</Pill>}>
        {zones.length === 0 && <div className="empty">No lighting zones reported by the ECLSS API yet.</div>}
        <div className="light-grid">
          {zones.map(([zone, s]) => {
            const glow = kelvinToRgb(s.kelvin)
            return (
              <div key={zone} className="light-card" style={{ '--glow': glow, '--lvl-b': s.brightness / 100 } as CSSProperties}>
                <div className="light-orb"><span /></div>
                <div className="light-head">
                  <strong>{zone}</strong>
                  <small>{s.brightness}% · {s.kelvin} K</small>
                </div>
                <label className="slider">
                  <span>Brightness</span>
                  <input type="range" min={0} max={100} value={s.brightness}
                    onChange={e => change(zone, { ...s, brightness: +e.target.value })} />
                </label>
                <label className="slider kelvin">
                  <span>Colour temperature</span>
                  <input type="range" min={2000} max={6500} step={50} value={s.kelvin}
                    onChange={e => change(zone, { ...s, kelvin: +e.target.value })} />
                </label>
                <div className="preset-row">
                  {PRESETS.map(p => {
                    const Icon = p.icon
                    const on = s.brightness === p.b && s.kelvin === p.k
                    return (
                      <button key={p.name} className={`preset ${on ? 'on' : ''}`} title={`${p.name}: ${p.b}% · ${p.k}K`}
                        onClick={() => change(zone, { brightness: p.b, kelvin: p.k }, 0)}>
                        <Icon size={15} /><span>{p.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </Panel>
    </div>
  )
}
