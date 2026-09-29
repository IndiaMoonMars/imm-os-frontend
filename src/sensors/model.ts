import type { RealtimeFrame } from '../hooks/useRealtime'

// ── What each sensor is and how often it reports (edge drivers) ──────

export interface MetricDef { label: string; unit: string; dp: number; flag?: boolean }   // flag: shown as YES / no
export interface SensorDef {
  label: string; hw: string; every: number
  note?: string                 // shown while the stream is not fresh
  about?: string                // what the sensor can and cannot measure, always shown
  metrics: Record<string, MetricDef>
}

export const m = (label: string, unit: string, dp: number): MetricDef => ({ label, unit, dp })
export const flag = (label: string): MetricDef => ({ label, unit: '', dp: 0, flag: true })

export const CATALOG: Record<string, SensorDef> = {
  bme280: {
    label: 'Climate', hw: 'BME280', every: 1,
    metrics: { temp: m('Temperature', '°C', 1), hum: m('Humidity', '%', 1), pres: m('Pressure', 'hPa', 1), dew_point_c: m('Dew point', '°C', 1) },
  },
  scd40: {
    label: 'CO₂', hw: 'SCD40', every: 5, about: 'Infrared (NDIR) CO₂ sensor: CO₂ only, 400–5000 ppm, plus its own temperature and humidity',
    metrics: { co2_ppm: m('CO₂', 'ppm', 0), temp: m('Temperature', '°C', 1), hum: m('Humidity', '%', 1), dew_point_c: m('Dew point', '°C', 1) },
  },
  o2: { label: 'Oxygen', hw: 'O₂ sensor', every: 2, about: 'Electrochemical cell: oxygen only, 0–25 %', metrics: { o2_pct: m('O₂', '%', 2) } },
  mq4: {
    label: 'Methane', hw: 'MQ-4 · ESP32 board', every: 1, note: 'ppm appears after the 3 min warm-up and CAL_MQ4 in clean air',
    about: 'Heated tin-oxide sensor, 200–10000 ppm: most sensitive to methane, but LPG, hydrogen, alcohol and smoke also raise it, and it cannot tell them apart',
    metrics: {
      ch4_ppm: m('CH₄', 'ppm', 1), rs_r0: m('Rs/R0', '×', 2), rs_rl: m('Rs/RL', '×', 2), vout_mv: m('Sensor output', 'mV', 0),
      warming: flag('Warming up'), calibrated: flag('Calibrated'),
    },
  },
  bno055: {
    label: 'Orientation', hw: 'BNO055 · ESP32 board', every: 1, note: 'rotate the board slowly until calibration reads 3',
    metrics: {
      heading_deg: m('Heading', '°', 1), roll_deg: m('Roll', '°', 1), pitch_deg: m('Pitch', '°', 1),
      lin_acc_ms2: m('Motion', 'm/s²', 2), gyro_dps: m('Rotation rate', '°/s', 1), grav_ms2: m('Gravity', 'm/s²', 2),
      mag_ut: m('Magnetic field', 'µT', 1), temp: m('Chip temperature', '°C', 0),
      imu_calib: m('Calibration: system', '/3', 0), calib_gyro: m('Calibration: gyro', '/3', 0),
      calib_acc: m('Calibration: accel', '/3', 0), calib_mag: m('Calibration: magnetometer', '/3', 0),
    },
  },
  geiger: {
    label: 'Radiation', hw: 'SEN0463 Geiger · external board', every: 1, note: 'dose rate settles after the first minute (60 s counting window)',
    about: 'M4011 Geiger–Müller tube: counts beta and gamma, dose rate as Cs-137-equivalent µSv/h (CPM ÷ 153.8); blind to alpha and neutrons. Background is about 0.1–0.3 µSv/h',
    metrics: { usv_h: m('Dose rate', 'µSv/h', 3), cpm: m('Count rate', 'CPM', 0), counts: m('Counts', '', 0), warming: flag('Warming up') },
  },
  gnss: {
    label: 'Position', hw: 'TEL0157 GNSS · external board', every: 1, note: 'the antenna needs open sky; the first fix can take a few minutes',
    metrics: {
      fix: flag('Fix'), sats: m('Satellites', '', 0), lat: m('Latitude', '°', 6), lon: m('Longitude', '°', 6),
      alt_m: m('Altitude', 'm', 1), sog_kn: m('Speed', 'kn', 2), cog_deg: m('Course', '°', 1),
    },
  },
  mq7: { label: 'Carbon monoxide', hw: 'MQ-7 + STM32', every: 150, note: 'one reading per 150 s heater cycle', metrics: { co_ppm: m('CO', 'ppm', 1) } },
  tsl2561: { label: 'Light', hw: 'TSL2561', every: 1, metrics: { lux: m('Illuminance', 'lux', 0) } },
  ina219: { label: 'Power bus', hw: 'INA219', every: 1, metrics: { voltage_v: m('Voltage', 'V', 2), current_ma: m('Current', 'mA', 0), power_mw: m('Power', 'mW', 0) } },
  max30100: { label: 'Pulse oximeter', hw: 'MAX30100', every: 1, note: 'reports only while a finger is on it', metrics: { hr_bpm: m('Heart rate', 'bpm', 0), spo2_pct: m('SpO₂', '%', 0) } },
  ecg_ad8232: { label: 'ECG', hw: 'AD8232', every: 0.01, metrics: { voltage: m('Lead signal', 'V', 3) } },
  sysmon: {
    label: 'Node health', hw: 'Raspberry Pi', every: 10, metrics: {
      cpu_temp: m('SoC temp', '°C', 1), cpu_load: m('CPU', '%', 0), mem_pct: m('Memory', '%', 0), disk_pct: m('Disk', '%', 0),
      fan_rpm: m('Fan', 'rpm', 0), power_w: m('Board power', 'W', 2), supply_v: m('5 V input', 'V', 2),
      undervolt: flag('Under-voltage'), throttled: flag('Throttled'), undervolt_boot: flag('Under-voltage since boot'),
      mcc_link: flag('MCC link'), mqtt_backlog: m('Readings queued for the MCC', '', 0),
      svc_failed: m('Failed services', '', 0), svc_restarts: m('Service restarts', '', 0),
    },
  },
  board: {
    label: 'ESP32 board', hw: 'board health', every: 10,
    metrics: {
      rssi_dbm: m('Wi-Fi signal', 'dBm', 0), uptime_s: m('Uptime', 's', 0), boot_count: m('Boots', '', 0),
      reset_reason: m('Reset reason', '', 0), i2c_err: m('I²C errors', '', 0),
    },
  },
  bms: { label: 'Battery & solar', hw: 'UPS gauge / INA219', every: 10, metrics: { battery_pct: m('Battery', '%', 0), solar_w: m('Solar', 'W', 1) } },
  eva_biosensor: { label: 'EVA suit vitals', hw: 'Suit biosensors', every: 0.2, metrics: { hr_bpm: m('Heart rate', 'bpm', 0), spo2_pct: m('SpO₂', '%', 0), skin_temp_c: m('Skin temp', '°C', 1), ecg_mv: m('ECG', 'mV', 2) } },
  jetson: { label: 'Jetson', hw: 'Jetson', every: 5, metrics: { cpu_temp: m('CPU temp', '°C', 1), gpu_temp: m('GPU temp', '°C', 1), power_w: m('Power', 'W', 1) } },
}

// not measurements: identity, integrity (seq/run) and quality flags
const META = new Set(['sensor', 'timestamp', 'node_id', 'zone', 'crew_id', 'simulated', 'sig', 'seq', 'run', 'q', 'qf', 'delayed'])

// ── Live state ──────────────────────────────────────────────────────

export interface Stream {
  key: string; node: string; sensor: string; zone: string; crew?: string
  simulated: boolean; ts: number; metrics: Record<string, number>; hist: Record<string, number[]>; arrivals: number[]
  /** data quality of the latest reading (the validator's q / qf): good, suspect or bad, and why */
  q?: string; qf?: string[]
}

export type Freshness = 'fresh' | 'stale' | 'offline'

export function freshness(sensor: string, ageS: number): Freshness {
  const every = CATALOG[sensor]?.every ?? 10
  if (ageS <= Math.max(15, every * 3)) return 'fresh'
  if (ageS <= Math.max(120, every * 6)) return 'stale'
  return 'offline'
}

const histLen = (sensor: string) => (sensor === 'ecg_ad8232' ? 300 : 60)   // ECG: last 3 s

export function applyFrame(streams: Map<string, Stream>, f: RealtimeFrame, receivedMs = Date.now()): void {
  const node = f.node_id || 'unknown', zone = f.zone || 'unknown'
  // Real and simulated readings of one sensor are separate streams, so a node whose simulator
  // is still on next to its real sensor shows two cards instead of one mixing both.
  const key = `${node}|${f.sensor}|${zone}|${f.crew_id ?? ''}|${f.simulated ? 'sim' : 'live'}`
  let s = streams.get(key)
  if (!s) {
    s = { key, node, sensor: f.sensor, zone, crew: f.crew_id, simulated: !!f.simulated, ts: 0, metrics: {}, hist: {}, arrivals: [] }
    streams.set(key, s)
  }
  const ts = f.timestamp * 1000
  if (ts < s.ts) return                                   // late duplicate
  s.ts = ts
  if (typeof f.q === 'string') { s.q = f.q; s.qf = Array.isArray(f.qf) ? (f.qf as string[]) : [] }
  for (const [k, v] of Object.entries(f)) {
    if (META.has(k) || typeof v !== 'number') continue
    s.metrics[k] = v
    const h = s.hist[k] ?? (s.hist[k] = [])
    h.push(v)
    if (h.length > histLen(f.sensor)) h.splice(0, h.length - histLen(f.sensor))
  }
  s.arrivals.push(receivedMs)
  if (s.arrivals.length > 50) s.arrivals.splice(0, s.arrivals.length - 50)
}

export interface SnapshotEntry {
  node_id: string; sensor: string; zone: string; crew_id?: string | null; simulated: boolean; timestamp: string | null
  metrics: Record<string, number>; quality?: Record<string, string>
}

const Q_RANK: Record<string, number> = { good: 0, suspect: 1, bad: 2 }

/** The worst quality of an entry's metrics (undefined when none was recorded). */
export function worstQuality(q?: Record<string, string>): string | undefined {
  const vals = Object.values(q ?? {})
  return vals.length ? vals.reduce((a, b) => ((Q_RANK[b] ?? 0) > (Q_RANK[a] ?? 0) ? b : a)) : undefined
}

export function applySnapshot(streams: Map<string, Stream>, entries: SnapshotEntry[]) {
  for (const e of entries) {
    if (!e.timestamp) continue
    applyFrame(streams, {
      sensor: e.sensor, node_id: e.node_id, zone: e.zone, crew_id: e.crew_id ?? undefined,
      simulated: e.simulated, timestamp: Date.parse(e.timestamp) / 1000, ...e.metrics, q: worstQuality(e.quality),
    }, 0)
  }
}

export function rateHz(arrivals: number[], now: number): number | null {
  const recent = arrivals.filter(t => t > 0 && now - t < 10000)
  if (recent.length < 2) return null
  return (recent.length - 1) / ((recent[recent.length - 1] - recent[0]) / 1000 || 1)
}

export function ageLabel(s: number) {
  if (s < 1) return 'now'
  if (s < 60) return `${s.toFixed(0)} s ago`
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  return `${Math.floor(s / 3600)} h ago`
}

export const FRESH_COLOR: Record<Freshness, string> = { fresh: 'var(--ok)', stale: 'var(--warn)', offline: 'var(--crit)' }
