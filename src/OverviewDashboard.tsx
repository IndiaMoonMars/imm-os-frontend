import type { CSSProperties } from 'react'
import { Cpu, Radio as Antenna, Server, Sun, Wind, Zap } from 'lucide-react'
import TabHero from './components/TabHero'
import { Panel, Pill, RingGauge, SourceBadge, Sparkline, StatTile } from './components/Hud'
import { useSharedTelemetry } from './hooks/telemetryContext'
import { avgOf, isSimulated, useRolling, type Reading } from './hooks/useMission'
import { LEVEL_COLOR, levelOf, type Level } from './theme/levels'
import { TABS, tabByKey, type TabKey } from './theme/tabs'
import { ATMOS } from './theme/atmos'

const NODE_META: Record<string, { zone: string; hw: string }> = {
  'node-rpi-01': { zone: 'Habitat Zone A', hw: 'Raspberry Pi' },
  'node-rpi-02': { zone: 'Habitat Zone B', hw: 'Raspberry Pi' },
  'node-jetson': { zone: 'Compute / Power', hw: 'Jetson Orin' },
}

const num = (r?: Reading) => (r ? Number(r.value) : undefined)

function ageLabel(ts?: string): string {
  if (!ts) return '—'
  const s = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 1000))
  return s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`
}

export default function OverviewDashboard({ onNavigate }: { onNavigate: (k: TabKey) => void }) {
  const { data, error } = useSharedTelemetry()
  const jet = data?.readings['node-jetson'] ?? {}
  const atm = Object.fromEntries(Object.keys(ATMOS).map(k => [k, avgOf(data, k)])) as Record<string, Reading | undefined>

  const levels: Level[] = Object.entries(ATMOS).map(([k, l]) => levelOf(num(atm[k]), l.lo, l.hi, l.margin))
  const cautions = levels.filter(l => l === 'warn').length
  const warnings = levels.filter(l => l === 'crit').length
  const overall: Level = !data ? 'idle' : warnings ? 'crit' : cautions ? 'warn' : 'ok'

  const trend = useRolling({
    temperature: num(atm.temperature), co2: num(atm.co2), o2: num(atm.o2),
    power: num(jet.power_draw), solar: num(jet.solar_input),
  })

  const battery = num(jet.battery_level)
  const allReadings = data ? Object.values(data.readings).flatMap(n => Object.values(n)) : []
  const simulated = allReadings.length === 0 || allReadings.some(r => isSimulated(r))

  return (
    <div className="tab-body">
      <TabHero tab={tabByKey('overview')}>
        <div className="status-banner" style={{ '--lvl': LEVEL_COLOR[overall] } as CSSProperties}>
          <span className="status-orb" />
          <div>
            <strong>{error ? 'TELEMETRY LINK LOST' : !data ? 'ACQUIRING TELEMETRY…'
              : overall === 'ok' ? 'HABITAT NOMINAL' : overall === 'warn' ? `${cautions} CAUTION${cautions > 1 ? 'S' : ''}` : `${warnings} WARNING${warnings > 1 ? 'S' : ''}`}</strong>
            <small>{Object.keys(data?.readings ?? {}).length} nodes reporting · {data?._meta?.source === 'mock' ? 'backend mock feed' : 'InfluxDB feed'}</small>
          </div>
          <SourceBadge simulated={simulated} />
        </div>
      </TabHero>

      <Panel title="Atmosphere" icon={<Wind size={16} />} right={<Pill>Crew habitable volume</Pill>}>
        <div className="gauge-row">
          {Object.entries(ATMOS).map(([k, l]) => (
            <RingGauge key={k} value={num(atm[k])} min={l.min} max={l.max} label={l.label} unit={l.unit}
              decimals={l.decimals} level={levelOf(num(atm[k]), l.lo, l.hi, l.margin)} />
          ))}
        </div>
      </Panel>

      <div className="grid-2">
        <Panel title="Power" icon={<Zap size={16} />}>
          <div className="power-row">
            <RingGauge value={battery} min={0} max={100} label="Battery" unit="% SoC" decimals={0}
              level={levelOf(battery, 30, 100, 15)} />
            <div className="tile-stack">
              <StatTile label="Solar input" value={num(jet.solar_input)?.toFixed(1) ?? '—'} unit="W" level="ok">
                <Sparkline id="solar" data={trend.solar ?? []} color="#ffc26b" />
              </StatTile>
              <StatTile label="Load" value={num(jet.power_draw)?.toFixed(1) ?? '—'} unit="W"
                level={levelOf(num(jet.power_draw), 0, 25, 10)}>
                <Sparkline id="power" data={trend.power ?? []} color="#ff7a3d" />
              </StatTile>
            </div>
          </div>
        </Panel>
        <Panel title="Trends · this session" icon={<Sun size={16} />}>
          <div className="trend-list">
            {([['temperature', 'Temperature', '°C', '#ff7a3d'], ['co2', 'CO₂', 'ppm', '#ffc26b'], ['o2', 'Oxygen', '%', '#3ef0a0']] as const).map(([k, label, unit, c]) => (
              <div key={k} className="trend-item">
                <div><span>{label}</span><strong>{num(atm[k])?.toFixed(k === 'co2' ? 0 : 1) ?? '—'} <small>{unit}</small></strong></div>
                <Sparkline id={`t-${k}`} data={trend[k] ?? []} color={c} />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid-2">
        <Panel title="Edge nodes" icon={<Server size={16} />}>
          <div className="node-list">
            {Object.entries(NODE_META).map(([id, meta]) => {
              const r = data?.readings[id]
              const vals = r ? Object.values(r) : []
              const newest = vals.map(v => v.timestamp).filter(Boolean).sort().pop()
              const online = vals.length > 0
              return (
                <div key={id} className={`node-card ${online ? 'online' : 'offline'}`}>
                  <div className="node-led" />
                  <div className="node-main">
                    <strong>{id}</strong>
                    <small>{meta.hw} · {meta.zone}</small>
                  </div>
                  <div className="node-side">
                    <span>{online ? `${vals.length} channels` : 'no data'}</span>
                    <small>{ageLabel(newest)}</small>
                  </div>
                  {online && <SourceBadge simulated={vals.some(v => isSimulated(v))} />}
                </div>
              )
            })}
          </div>
        </Panel>
        <Panel title="Compute" icon={<Cpu size={16} />}>
          <div className="gauge-row compact">
            <RingGauge value={num(jet.cpu_temp)} min={20} max={100} label="CPU" unit="°C" size={116}
              level={levelOf(num(jet.cpu_temp), 20, 70, 15)} />
            <RingGauge value={num(jet.gpu_temp)} min={20} max={100} label="GPU" unit="°C" size={116}
              level={levelOf(num(jet.gpu_temp), 20, 75, 15)} />
          </div>
        </Panel>
      </div>

      <Panel title="Modules" icon={<Antenna size={16} />}>
        <div className="module-grid">
          {TABS.filter(t => t.key !== 'overview').map(t => {
            const Icon = t.icon
            return (
              <button key={t.key} className="module-card" style={{ '--m': t.accent } as CSSProperties} onClick={() => onNavigate(t.key)}>
                <Icon size={22} strokeWidth={1.6} />
                <strong>{t.label}</strong>
                <small>{t.tagline}</small>
                <em>{t.code}</em>
              </button>
            )
          })}
        </div>
      </Panel>
    </div>
  )
}
