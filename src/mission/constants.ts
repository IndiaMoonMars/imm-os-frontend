// Series colours: a fixed categorical order, sol 1 = slot 1 … (colour follows the sol, never its rank).
export const SOL_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']

// Alarm limits drawn on the timeline (same as imm-os-backend services/health/rules.py LIMITS)
export const LIMITS: Record<string, { v: number; label: string; tone: 'warn' | 'crit' }[]> = {
  co2: [{ v: 1000, label: 'caution 1000 ppm', tone: 'warn' }, { v: 5000, label: 'warning 5000 ppm', tone: 'crit' }],
  o2: [{ v: 19.5, label: 'warning 19.5 %', tone: 'crit' }, { v: 23.5, label: 'warning 23.5 %', tone: 'crit' }],
  temperature: [{ v: 10, label: 'caution 10 °C', tone: 'warn' }, { v: 35, label: 'caution 35 °C', tone: 'warn' }],
  humidity: [{ v: 15, label: 'caution 15 %', tone: 'warn' }, { v: 75, label: 'caution 75 %', tone: 'warn' }],
  radiation: [{ v: 0.5, label: 'caution 0.5 µSv/h', tone: 'warn' }, { v: 2.5, label: 'warning 2.5 µSv/h', tone: 'crit' }],
  methane: [{ v: 5000, label: 'warning 5000 ppm', tone: 'crit' }],
  co: [{ v: 35, label: 'warning 35 ppm', tone: 'crit' }],
}
