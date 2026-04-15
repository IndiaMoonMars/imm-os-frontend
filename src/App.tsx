import { useState, useEffect, useCallback } from 'react'
import './index.css'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Measurement {
  value: number
  unit: string
  timestamp?: string
  simulated?: boolean
}

interface NodeReadings {
  [measurement: string]: Measurement
}

interface TelemetryData {
  readings: {
    [nodeId: string]: NodeReadings
  }
  _meta?: { source: string; reason?: string }
}

interface Node {
  id: string
  type: string
  zone: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE = '/api'
const REFRESH_INTERVAL_MS = 5000

const MEASUREMENT_LABELS: Record<string, string> = {
  temperature: 'Temperature',
  humidity: 'Humidity',
  pressure: 'Pressure',
  co2: 'CO₂',
  o2: 'O₂',
  cpu_temp: 'CPU Temp',
  gpu_temp: 'GPU Temp',
  power_draw: 'Power Draw',
  battery_level: 'Battery',
  solar_input: 'Solar Input',
}

// ── Clock ─────────────────────────────────────────────────────────────────────

function useClock() {
  const [time, setTime] = useState(() => new Date().toUTCString().slice(17, 25))
  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toUTCString().slice(17, 25)), 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

// ── MetricItem ────────────────────────────────────────────────────────────────

function MetricItem({ name, data }: { name: string; data: Measurement }) {
  const label = MEASUREMENT_LABELS[name] ?? name
  const display = typeof data.value === 'number' ? data.value.toFixed(1) : '—'
  return (
    <div className="metric-item">
      <span className="metric-name">{label}</span>
      <div className="metric-value">
        <span className="metric-number">{display}</span>
        <span className="metric-unit">{data.unit}</span>
      </div>
    </div>
  )
}

// ── NodeCard ──────────────────────────────────────────────────────────────────

function NodeCard({ node, readings }: { node: Node; readings: NodeReadings | undefined }) {
  const isSimulated = readings
    ? Object.values(readings).some((r) => r.simulated)
    : true

  const hasData = readings && Object.keys(readings).length > 0

  return (
    <div className="card">
      <div className="node-card-header">
        <div>
          <div className="node-id">{node.id}</div>
          <div className="node-zone">{node.zone}</div>
        </div>
        <div className={`node-status-badge ${isSimulated ? 'simulated' : ''}`}>
          <span>{isSimulated ? '◉' : '●'}</span>
          {isSimulated ? 'Simulated' : 'Live'}
        </div>
      </div>

      {hasData ? (
        <div className="metric-list">
          {Object.entries(readings!).map(([name, data]) => (
            <MetricItem key={name} name={name} data={data} />
          ))}
        </div>
      ) : (
        <div className="state-center" style={{ minHeight: '120px' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No data yet</span>
        </div>
      )}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function Dashboard() {
  const [nodes, setNodes] = useState<Node[]>([])
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>('')

  const fetchTelemetry = useCallback(async () => {
    try {
      const [nodesRes, telRes] = await Promise.all([
        fetch(`${API_BASE}/telemetry/nodes`),
        fetch(`${API_BASE}/telemetry/latest`),
      ])
      if (!nodesRes.ok || !telRes.ok) throw new Error(`API error ${nodesRes.status}`)
      const [nodesData, telData] = await Promise.all([nodesRes.json(), telRes.json()])
      setNodes(nodesData.nodes)
      setTelemetry(telData)
      setLastUpdated(new Date().toLocaleTimeString())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch telemetry')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTelemetry()
    const id = setInterval(fetchTelemetry, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [fetchTelemetry])

  const totalReadings = telemetry
    ? Object.values(telemetry.readings).reduce((sum, node) => sum + Object.keys(node).length, 0)
    : 0

  const isSimulated = telemetry?._meta?.source === 'mock' ||
    (telemetry ? Object.values(telemetry.readings).some(node =>
      Object.values(node).some(r => r.simulated)
    ) : false)

  return (
    <main className="main-content">
      {/* Mission stats bar */}
      <div className="stats-bar">
        <div className="stat-item">
          <div className="stat-label">Active Nodes</div>
          <div className="stat-value">{nodes.length}</div>
          <div className="stat-sub">{isSimulated ? 'Simulated' : 'Live hardware'}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Data Points</div>
          <div className="stat-value">{totalReadings}</div>
          <div className="stat-sub">per cycle · 5s interval</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">MQTT Broker</div>
          <div className="stat-value" style={{ fontSize: 14 }}>:1883</div>
          <div className="stat-sub">imm/habitat/#</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Data Store</div>
          <div className="stat-value" style={{ fontSize: 14 }}>InfluxDB</div>
          <div className="stat-sub">bucket: telemetry</div>
        </div>
      </div>

      {/* Nodes section */}
      <div className="section-header">
        <span className="section-title">Habitat &amp; Compute Nodes</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastUpdated && (
            <span className="last-updated">Updated {lastUpdated}</span>
          )}
          <button className="btn-refresh" onClick={fetchTelemetry}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="state-center">
          <div className="spinner" />
          <span>Connecting to telemetry stream...</span>
        </div>
      ) : error ? (
        <div className="error-box">
          <strong>⚠ Connection error:</strong> {error}
          <br />
          <small>Ensure the IMM-OS backend is running: <code>docker compose up -d</code></small>
        </div>
      ) : (
        <div className="node-grid">
          {nodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              readings={telemetry?.readings[node.id]}
            />
          ))}
        </div>
      )}
    </main>
  )
}

// ── App Shell ─────────────────────────────────────────────────────────────────

function App() {
  const utcTime = useClock()

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <span>🛰 IMM-OS</span>
          <span className="mission-tag">Mission Control</span>
        </div>
        <div className="topbar-right">
          <div className="clock">UTC {utcTime}</div>
          <div className="status-dot" title="Stack online" />
        </div>
      </header>
      <Dashboard />
    </div>
  )
}

export default App
