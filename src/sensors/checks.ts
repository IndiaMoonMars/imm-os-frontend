import type { Level } from '../theme/levels'
import type { Stream } from './model'

// ── Is each real sensor reading right? ──────────────────────────────
// Each value against physics, and the sensors against each other (same air, same dew point;
// O₂ lost ≈ CO₂ gained; gravity 9.81; the Earth's magnetic field). Same rules and limits as
// imm-os-edge tools/verify_esp32.py, which adds hands-on tests on the Pi.

export interface Check { sensor: string; name: string; level: Level; detail: string; hint?: string }

const band = (v: number, ok: [number, number], warn?: [number, number]): Level =>
  v >= ok[0] && v <= ok[1] ? 'ok' : warn && v >= warn[0] && v <= warn[1] ? 'warn' : 'crit'

/** Magnus formula (Sonntag 1990), as the edge computes dew_point_c. */
export function dewPoint(t: number, rh: number): number | null {
  if (!(rh > 0)) return null
  const g = Math.log(Math.min(rh, 100) / 100) + 17.62 * t / (243.12 + t)
  return 243.12 * g / (17.62 - g)
}

/** O₂ % expected from CO₂: breathing turns O₂ into CO₂ about 1.2 : 1. */
export const expectedO2 = (co2: number) => 20.95 - 1.2 * Math.max(0, co2 - 420) / 1e4

export function sensorChecks(streams: Stream[]): Check[] {
  const get = (sensor: string) => streams.find(s => s.sensor === sensor && !s.simulated)?.metrics
  const bme = get('bme280'), scd = get('scd40'), o2 = get('o2'), bno = get('bno055'), mq4 = get('mq4')
  const c: Check[] = []
  const f1 = (v: number) => v.toFixed(1)

  if (bme?.temp !== undefined) c.push({ sensor: 'BME280', name: 'Temperature', level: band(bme.temp, [5, 45]), detail: `${f1(bme.temp)} °C` })
  if (bme?.hum !== undefined) c.push({ sensor: 'BME280', name: 'Humidity', level: band(bme.hum, [5, 95], [1, 99]), detail: `${f1(bme.hum)} %RH`, hint: '0 or 100 % means a damaged humidity element' })
  if (bme?.pres !== undefined) c.push({ sensor: 'BME280', name: 'Pressure', level: band(bme.pres, [950, 1050], [850, 1085]), detail: `${f1(bme.pres)} hPa`, hint: 'near sea level (Mumbai) air pressure is 995–1020 hPa' })

  if (scd?.co2_ppm !== undefined) {
    const v = scd.co2_ppm
    c.push({
      sensor: 'SCD40', name: 'CO₂', level: v < 380 ? 'crit' : band(v, [380, 1000], [1000, 5000]), detail: `${v.toFixed(0)} ppm`,
      hint: v < 380 ? 'below outdoor air (~420 ppm) is impossible: the SCD40 self-corrects within about a week of fresh-air days'
        : v > 1000 ? 'the room needs fresh air (the sensor is fine)' : undefined,
    })
  }
  if (bme?.temp !== undefined && scd?.temp !== undefined) {
    const d = scd.temp - bme.temp
    c.push({ sensor: 'SCD40', name: 'Temperature vs BME280', level: band(Math.abs(d), [0, 2], [0, 5]), detail: `${d >= 0 ? '+' : ''}${f1(d)} °C`, hint: 'the SCD40 warms itself: a few °C more is normal, over 5 °C one of them is wrong' })
    const a = bme.dew_point_c ?? dewPoint(bme.temp, bme.hum), b = scd.dew_point_c ?? dewPoint(scd.temp, scd.hum)
    if (a != null && b != null) {
      c.push({ sensor: 'SCD40', name: 'Dew point vs BME280', level: band(Math.abs(b - a), [0, 1.5], [0, 3]), detail: `${f1(b)} vs ${f1(a)} °C`, hint: 'the same air has the same dew point: a gap means one humidity sensor reads wrong' })
    }
  }

  if (o2?.o2_pct !== undefined) {
    const v = o2.o2_pct, exp = scd?.co2_ppm !== undefined ? expectedO2(scd.co2_ppm) : 20.95
    const level = band(v, [20.4, 21.4], [19.5, 22])
    c.push({
      sensor: 'O₂ sensor', name: 'O₂', level,
      detail: `${v.toFixed(2)} %` + (scd?.co2_ppm !== undefined ? ` · CO₂ says ~${f1(exp)} %` : ''),
      hint: level === 'ok' ? undefined : Math.abs(v - exp) > 0.6
        ? 'the sensor needs calibrating, not the air: 5 min in fresh outdoor air, then CAL_O2'
        : 'O₂ and CO₂ agree: the room air itself is off, ventilate',
    })
  }

  if (bno?.grav_ms2 !== undefined) c.push({ sensor: 'BNO055', name: 'Gravity', level: band(bno.grav_ms2, [9.5, 10.1], [9.0, 10.6]), detail: `${bno.grav_ms2.toFixed(2)} m/s² (Earth 9.81)`, hint: 'accelerometer off: rest the board on each of its 6 sides for a few seconds' })
  if (bno?.mag_ut !== undefined) c.push({ sensor: 'BNO055', name: 'Magnetic field', level: band(bno.mag_ut, [25, 65], [10, 100]), detail: `${f1(bno.mag_ut)} µT (Mumbai ~42)`, hint: 'iron or a magnet nearby (speaker, laptop, steel, the buck converter coil): heading will be off' })
  if (bno?.imu_calib !== undefined) {
    const p = (k: string) => (bno[k] ?? 0).toFixed(0)
    c.push({ sensor: 'BNO055', name: 'Calibration', level: bno.imu_calib === 3 ? 'ok' : 'warn', detail: `system ${p('imu_calib')} · gyro ${p('calib_gyro')} · accel ${p('calib_acc')} · mag ${p('calib_mag')} (of 3)`, hint: 'gyro: keep still; accelerometer: 6 sides; magnetometer: slow figure-8. Forgotten at power-off' })
  }
  if (bno?.temp !== undefined && bme?.temp !== undefined) {
    const d = bno.temp - bme.temp
    c.push({ sensor: 'BNO055', name: 'Chip temp vs BME280', level: band(Math.abs(d), [0, 4], [0, 8]), detail: `${d >= 0 ? '+' : ''}${f1(d)} °C` })
  }

  if (mq4?.vout_mv !== undefined) {
    c.push({ sensor: 'MQ-4', name: 'Signal', level: band(mq4.vout_mv, [100, 4700], [50, 4950]), detail: `${mq4.vout_mv.toFixed(0)} mV of 5000`, hint: 'near 0: module unpowered or AO loose; near 5 V: saturated' })
    if (mq4.warming === 1) c.push({ sensor: 'MQ-4', name: 'Warm-up', level: 'idle', detail: 'heating (3 min after power-on): no ppm yet' })
    if (mq4.calibrated === 0) c.push({ sensor: 'MQ-4', name: 'Calibration', level: 'warn', detail: 'not calibrated: mV and Rs/RL only', hint: 'after 24–48 h powered, in clean air: CAL_MQ4' })
    if (mq4.rs_r0 !== undefined) c.push({ sensor: 'MQ-4', name: 'Clean air', level: band(mq4.rs_r0, [3, 6.5], [2, 8]), detail: `Rs/R0 ${mq4.rs_r0.toFixed(2)} (clean air ~4.4)`, hint: mq4.rs_r0 < 3 ? 'gas present now, or CAL_MQ4 done in air that wasn’t clean' : 'redo CAL_MQ4 in clean air with the heater warm' })
  }
  return c
}
