import { useState } from 'react'

/**
 * India Moon Mars logo.
 *
 * Drop the official logo at `public/brand/imm-logo.png` (or .svg — set
 * VITE_IMM_LOGO_URL) and it is used everywhere; until then the built-in
 * emblem below is shown.
 */
const LOGO_URL: string = import.meta.env.VITE_IMM_LOGO_URL ?? '/brand/imm-logo.png'

export function ImmEmblem({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="India Moon Mars">
      <defs>
        <radialGradient id="imm-mars" cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#ffb08a" />
          <stop offset="55%" stopColor="#ff5a1f" />
          <stop offset="100%" stopColor="#8a1f06" />
        </radialGradient>
        <radialGradient id="imm-moon" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#9aa6bd" />
        </radialGradient>
        <linearGradient id="imm-orbit" x1="0" x2="1">
          <stop offset="0%" stopColor="#ff9933" />
          <stop offset="50%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#138808" />
        </linearGradient>
      </defs>
      {/* tricolour orbit */}
      <ellipse cx="32" cy="32" rx="29" ry="12" fill="none" stroke="url(#imm-orbit)" strokeWidth="2"
        transform="rotate(-24 32 32)" opacity="0.9" />
      {/* Mars */}
      <circle cx="34" cy="33" r="15" fill="url(#imm-mars)" />
      <path d="M22 30c5 2 9-1 14 1s7 4 11 3" stroke="#6b1703" strokeWidth="1.6" fill="none" opacity="0.5" />
      {/* Moon (crescent) riding the orbit */}
      <circle cx="10" cy="44" r="6" fill="url(#imm-moon)" />
      <circle cx="12.5" cy="42.5" r="5" fill="#070b14" />
      {/* front arc of orbit over the planet */}
      <path d="M8 45 A29 12 -24 0 0 60 22" fill="none" stroke="url(#imm-orbit)" strokeWidth="2" opacity="0.95"
        strokeDasharray="0 20 200" />
    </svg>
  )
}

export default function ImmLogo({ size = 40 }: { size?: number }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <ImmEmblem size={size} />
  return (
    <img src={LOGO_URL} alt="India Moon Mars" width={size} height={size}
      style={{ objectFit: 'contain', display: 'block' }} onError={() => setFailed(true)} />
  )
}
