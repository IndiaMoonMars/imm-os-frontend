import type { CSSProperties } from 'react'

/** Colour the dashboards use for an unselected / secondary button. */
export const IDLE = '#1c2640'

/**
 * Shared button style for the module dashboards: a glowing gradient in the given
 * colour, or a quiet outlined button for IDLE. Same signature as the old per-file btn().
 */
export function btn(c: string = 'var(--accent)'): CSSProperties {
  if (c === IDLE) {
    return {
      padding: '8px 16px', background: 'rgba(28,38,64,0.55)', color: '#b9c4de', border: '1px solid rgba(148,163,209,0.18)',
      borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', marginRight: '8px', letterSpacing: '0.02em',
      transition: 'all .2s ease',
    }
  }
  const glow = c.startsWith('#') ? `${c}55` : 'rgba(255,255,255,0.15)'
  return {
    padding: '8px 18px', background: `linear-gradient(135deg, ${c}, ${c.startsWith('#') ? `${c}bb` : c})`,
    color: '#060a12', border: `1px solid ${c}`, borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '13px',
    marginRight: '8px', letterSpacing: '0.02em', boxShadow: `0 0 18px ${glow}, inset 0 1px 0 rgba(255,255,255,0.25)`,
    transition: 'all .2s ease',
  }
}
