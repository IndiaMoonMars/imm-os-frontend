import type { SnapshotEntry } from '../sensors/model'
import { istShort } from './api'

// Is each real sensor ready for the mission record? Warm-up is shown as a countdown; readings
// taken while warming are stored but flagged, and left out of the sol statistics.

export type Tone = 'ok' | 'warn' | 'crit' | 'idle'
export interface ReadyItem {
  key: string; name: string; where: string; pill: string; tone: Tone; detail: string
  progress?: number            // 0..1 of the warm-up done
}

const NAMES: Record<string, string> = {
  mq4: 'MQ-4 methane', geiger: 'Geiger SEN0463', scd40: 'SCD40 CO₂', bno055: 'BNO055 orientation', o2: 'O₂ cell',
  gnss: 'GNSS TEL0157', bme280: 'BME280 climate', mq7: 'MQ-7 CO', sysmon: 'Node health (Pi)', tsl2561: 'TSL2561 light',
  ina219: 'INA219 power', bms: 'Battery & solar',
}
const ORDER = ['mq4', 'geiger', 'scd40', 'bno055', 'o2', 'gnss', 'bme280', 'mq7', 'sysmon']
const MQ4_WARMUP_S = 180

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function readiness(entries: SnapshotEntry[], nowMs: number): ReadyItem[] {
  const out: ReadyItem[] = []
  for (const e of entries) {
    if (e.simulated || !e.timestamp || e.sensor === 'board') continue
    const ts = Date.parse(e.timestamp)
    const age = (nowMs - ts) / 1000
    const v = e.metrics
    const base = { key: `${e.node_id}|${e.sensor}|${e.zone}`, name: NAMES[e.sensor] ?? e.sensor, where: `${e.node_id} · ${e.zone}` }
    if (age > 120) {
      out.push({ ...base, pill: 'OFFLINE', tone: 'crit', detail: `no reading since ${istShort(ts)} IST` })
      continue
    }
    switch (e.sensor) {
      case 'mq4': {
        if (v.warming === 1) {
          const left = Math.max(0, (v.warm_left_s ?? MQ4_WARMUP_S) - age)
          out.push({ ...base, pill: `WARMING · ${mmss(left)} LEFT`, tone: 'warn', progress: 1 - left / MQ4_WARMUP_S,
            detail: 'heater warm-up after a power-on · readings flagged, not in sol stats' })
        } else if (v.calibrated === 0) {
          out.push({ ...base, pill: 'NOT CALIBRATED', tone: 'warn', detail: 'send CAL_MQ4 in clean air (after 24–48 h burn-in)' })
        } else out.push({ ...base, pill: 'READY', tone: 'ok', detail: 'heater warm · calibrated' })
        break
      }
      case 'geiger': {
        if (v.warming === 1) {
          const left = Math.max(0, 60 - (v.window_s ?? 0) - age)
          out.push({ ...base, pill: `FILLING · ${Math.ceil(left)} s`, tone: 'warn', progress: 1 - left / 60,
            detail: '60 s counting window filling · provisional CPM shown' })
        } else out.push({ ...base, pill: 'READY', tone: 'ok', detail: '60 s counting window full' })
        break
      }
      case 'scd40': {
        if (v.asc === 0) out.push({ ...base, pill: 'READY', tone: 'ok', detail: 'forced-calibrated · self-calibration off (mission mode)' })
        else if (v.asc === 1) out.push({ ...base, pill: 'SELF-CAL ON', tone: 'warn', detail: 'before Sol 1: 3 min in fresh air, then CAL_CO2' })
        else out.push({ ...base, pill: 'READY', tone: 'ok', detail: v.co2_ppm ? `${v.co2_ppm.toFixed(0)} ppm` : 'measuring every 5 s' })
        break
      }
      case 'bno055': {
        const cal = v.imu_calib ?? 0
        if (cal === 3) out.push({ ...base, pill: '3/3', tone: 'ok', detail: v.cal_restored === 1 ? 'calibration restored from flash at start' : 'fully calibrated (stored for restarts)' })
        else out.push({ ...base, pill: `${cal}/3`, tone: 'warn', detail: v.cal_restored === 1 ? 'restored calibration settling · move it gently' : 'rotate slowly (figure-8) until 3/3' })
        break
      }
      case 'o2': {
        out.push(v.calibrated === 0
          ? { ...base, pill: 'NOT CALIBRATED', tone: 'warn', detail: '5 min in fresh outdoor air, then CAL_O2' }
          : { ...base, pill: 'READY', tone: 'ok', detail: v.o2_pct ? `${v.o2_pct.toFixed(2)} %` : 'calibrated' })
        break
      }
      case 'gnss': {
        const sats = v.sats ?? 0
        out.push(v.fix === 1
          ? { ...base, pill: `FIX · ${sats} SATS`, tone: 'ok', detail: v.lat !== undefined ? `${v.lat.toFixed(5)}, ${v.lon?.toFixed(5)}` : 'position fixed' }
          : { ...base, pill: 'NO FIX YET', tone: 'warn', detail: `acquiring · ${sats} satellite${sats === 1 ? '' : 's'} · needs open sky` })
        break
      }
      case 'sysmon': {
        if (v.undervolt === 1) out.push({ ...base, pill: 'UNDER-VOLTAGE', tone: 'crit', detail: 'the Pi’s supply is too weak' })
        else out.push({ ...base, pill: 'READY', tone: 'ok', detail: `SoC ${v.cpu_temp?.toFixed(0) ?? '–'} °C${v.mqtt_backlog ? ` · ${v.mqtt_backlog} queued for the MCC` : ''}` })
        break
      }
      default:
        out.push({ ...base, pill: 'READY', tone: 'ok', detail: 'no warm-up needed' })
    }
  }
  const rank = (s: string) => { const i = ORDER.indexOf(s.split('|')[1]); return i < 0 ? 99 : i }
  return out.sort((a, b) => rank(a.key) - rank(b.key) || a.key.localeCompare(b.key))
}
