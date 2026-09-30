export type Level = 'ok' | 'warn' | 'crit' | 'idle'

export const LEVEL_COLOR: Record<Level, string> = {
  ok: '#3ef0a0', warn: '#ffb547', crit: '#ff5d73', idle: '#5d6a88',
}

/** Classify a value against nominal [lo, hi] and a caution margin beyond it. */
export function levelOf(v: number | undefined, lo: number, hi: number, margin: number): Level {
  if (v === undefined || Number.isNaN(v)) return 'idle'
  if (v < lo - margin || v > hi + margin) return 'crit'
  if (v < lo || v > hi) return 'warn'
  return 'ok'
}
