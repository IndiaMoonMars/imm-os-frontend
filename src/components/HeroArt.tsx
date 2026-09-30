import type { HeroArt as Art } from '../theme/tabs'

/*
 * One animated SVG scene per tab, drawn in the tab's accent colours.
 * Colours come from CSS (--accent / --accent2) via the .a1/.a2/.f1/.f2 classes;
 * motion is pure CSS (see art-* keyframes in index.css) and respects reduced motion.
 */
export default function HeroArt({ art }: { art: Art }) {
  return (
    <svg className={`hero-art art-${art}`} viewBox="0 0 320 160" aria-hidden="true">
      {SCENES[art]}
    </svg>
  )
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i)

const SCENES: Record<Art, JSX.Element> = {
  // Mission overview — Moon and Mars on orbits around the habitat
  orbit: (
    <g>
      <ellipse cx="160" cy="80" rx="130" ry="44" className="a2 thin" />
      <ellipse cx="160" cy="80" rx="84" ry="28" className="a1 thin dashed" />
      <circle cx="160" cy="80" r="16" className="f1 glow" />
      <circle cx="160" cy="80" r="24" className="a1 thin pulse-ring" />
      {/* planets follow the elliptical orbits (SMIL motion along the ellipse path) */}
      <circle r="9" className="f-mars">
        <animateMotion dur="24s" repeatCount="indefinite" path="M290 80 A130 44 0 1 1 30 80 A130 44 0 1 1 290 80" />
      </circle>
      <circle r="5" className="f-moon">
        <animateMotion dur="9s" repeatCount="indefinite" path="M76 80 A84 28 0 1 0 244 80 A84 28 0 1 0 76 80" />
      </circle>
    </g>
  ),
  // ECLSS — concentric air-flow rings + leaf
  airflow: (
    <g>
      {range(4).map(i => (
        <circle key={i} cx="160" cy="80" r={22 + i * 16} className={`a${i % 2 ? 2 : 1} thin dashed spin-${i % 2 ? 'rev' : 'slow'}`}
          style={{ transformOrigin: '160px 80px', animationDuration: `${14 + i * 6}s` }} />
      ))}
      <path d="M160 58c16 6 22 22 12 38-10-2-24-10-24-24 0-6 4-11 12-14z" className="f1 glow" />
      <path d="M160 96c-2-12 2-22 8-30" className="a2" />
      {range(6).map(i => <circle key={i} cx={60 + i * 40} cy={30 + (i % 3) * 50} r="2" className="f2 float" style={{ animationDelay: `${i * 0.7}s` }} />)}
    </g>
  ),
  // EVA — planetary horizon with a traverse path and footsteps
  horizon: (
    <g>
      <path d="M0 150 Q160 70 320 150" className="f-ground" />
      <path d="M0 150 Q160 70 320 150" className="a1" />
      <path d="M40 140 Q120 95 200 108 T300 120" className="a2 thin dashed march" />
      {range(7).map(i => <ellipse key={i} cx={60 + i * 34} cy={132 - Math.sin(i / 2) * 18} rx="3" ry="1.6" className="f1 blink" style={{ animationDelay: `${i * 0.35}s` }} />)}
      <circle cx="262" cy="36" r="14" className="f-mars" />
      <circle cx="50" cy="30" r="1.5" className="f2" /><circle cx="120" cy="18" r="1" className="f2" /><circle cx="200" cy="28" r="1.2" className="f2" />
    </g>
  ),
  // Comms — Earth and habitat exchanging delayed signal waves
  signal: (
    <g>
      <circle cx="40" cy="80" r="18" className="f-earth" />
      <circle cx="280" cy="80" r="14" className="f-mars" />
      {range(4).map(i => (
        <path key={i} d={`M${70 + i * 6} ${50 - i * 4} q${20} ${30 + i * 4} 0 ${60 + i * 8}`} className="a1 wave" style={{ animationDelay: `${i * 0.4}s` }} />
      ))}
      <line x1="60" y1="80" x2="262" y2="80" className="a2 thin dashed march" />
      <circle cx="0" cy="80" r="4" className="f1 glow travel" />
    </g>
  ),
  // Journal — constellation being drawn
  constellation: (
    <g>
      <polyline points="40,110 90,60 150,80 190,36 250,70 290,40" className="a1 draw" />
      {[[40, 110], [90, 60], [150, 80], [190, 36], [250, 70], [290, 40]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4" className="f1 glow twinkle" style={{ animationDelay: `${i * 0.3}s` }} />
      ))}
      {range(14).map(i => <circle key={i} cx={(i * 53) % 320} cy={(i * 37) % 150 + 5} r="1" className="f2 twinkle" style={{ animationDelay: `${i * 0.2}s` }} />)}
    </g>
  ),
  // Briefing — radar sweep with contacts
  radar: (
    <g>
      {range(3).map(i => <circle key={i} cx="160" cy="80" r={24 + i * 22} className="a2 thin" />)}
      <line x1="90" y1="80" x2="230" y2="80" className="a2 thin" /><line x1="160" y1="10" x2="160" y2="150" className="a2 thin" />
      <g className="spin-fast" style={{ transformOrigin: '160px 80px', animationDuration: '4s' }}>
        <path d="M160 80 L226 80 A66 66 0 0 0 206 33 Z" className="f-sweep" />
      </g>
      <circle cx="196" cy="52" r="3" className="f1 blink" /><circle cx="128" cy="104" r="3" className="f1 blink" style={{ animationDelay: '1.3s' }} />
    </g>
  ),
  // Schedule — timeline with milestones
  timeline: (
    <g>
      <line x1="20" y1="80" x2="300" y2="80" className="a2" />
      {range(8).map(i => <line key={i} x1={20 + i * 40} y1="72" x2={20 + i * 40} y2="88" className="a2 thin" />)}
      {[[60, 44, 60], [140, 104, 90], [220, 50, 70]].map(([x, y, w], i) => (
        <rect key={i} x={x} y={y} width={w} height="14" rx="4" className={`f${i % 2 ? 2 : 1} grow`} style={{ animationDelay: `${i * 0.5}s` }} />
      ))}
      <polygon points="300,72 312,80 300,88" className="f1" />
      <line x1="0" y1="20" x2="0" y2="140" className="a1 scan-x" />
    </g>
  ),
  // Procedures — checklist ticking itself off
  checklist: (
    <g>
      {range(4).map(i => (
        <g key={i} transform={`translate(90 ${24 + i * 30})`}>
          <rect width="18" height="18" rx="4" className="a2 thin" />
          <path d="M4 9l4 4 7-8" className="a1 tick" style={{ animationDelay: `${i * 0.6}s` }} />
          <rect x="30" y="6" width={110 - i * 14} height="6" rx="3" className="f2 dim" />
        </g>
      ))}
    </g>
  ),
  // Medical — ECG trace
  ecg: (
    <g>
      {range(9).map(i => <line key={i} x1={i * 40} y1="0" x2={i * 40} y2="160" className="a2 grid" />)}
      {range(5).map(i => <line key={i} x1="0" y1={i * 40} x2="320" y2={i * 40} className="a2 grid" />)}
      <path d="M0 90 H70 l8-10 8 10 h10 l6 16 10-72 10 70 6-14 h24 l10-14 10 14 H200 l8-10 8 10 h10 l6 16 10-72 10 70 6-14 h24 l10-14 10 14 H320"
        className="a1 ecg-trace glow" />
    </g>
  ),
  // Psychology — layered brain waves
  brainwave: (
    <g>
      {range(4).map(i => (
        <path key={i} className={`a${i % 2 ? 2 : 1} wave-shift`} style={{ animationDuration: `${6 + i * 2}s`, opacity: 1 - i * 0.18 }}
          d={`M-40 ${80 + (i - 1.5) * 16} ${range(12).map(k => `Q${k * 40 - 20} ${80 + (i - 1.5) * 16 + (k % 2 ? -1 : 1) * (18 - i * 3)} ${k * 40} ${80 + (i - 1.5) * 16}`).join(' ')}`} />
      ))}
    </g>
  ),
  // Inventory — barcode with scanning beam
  barcode: (
    <g>
      {[3, 1, 2, 1, 4, 1, 1, 3, 2, 1, 1, 4, 2, 1, 3, 1, 2, 2, 1, 3, 1, 4, 1, 2].reduce<{ x: number; els: JSX.Element[] }>((acc, w, i) => {
        if (i % 2 === 0) acc.els.push(<rect key={i} x={acc.x} y="36" width={w * 3} height="88" className="f2 dim" />)
        acc.x += w * 3 + 2
        return acc
      }, { x: 92, els: [] }).els}
      <rect x="80" y="30" width="160" height="100" rx="6" className="a2 thin" />
      <line x1="84" y1="0" x2="236" y2="0" className="a1 glow scan-y" />
    </g>
  ),
  // AI — neural network with pulsing activations
  neural: (
    <g>
      {[[60, [40, 80, 120]], [160, [30, 65, 95, 130]], [260, [55, 105]]].flatMap(([x, ys], li, layers) =>
        li < layers.length - 1
          ? (ys as number[]).flatMap(y => (layers[li + 1][1] as number[]).map(y2 => (
            <line key={`${x}-${y}-${y2}`} x1={x as number} y1={y} x2={layers[li + 1][0] as number} y2={y2} className="a2 thin synapse" />
          )))
          : [],
      )}
      {[[60, [40, 80, 120]], [160, [30, 65, 95, 130]], [260, [55, 105]]].flatMap(([x, ys], li) =>
        (ys as number[]).map((y, i) => <circle key={`n${x}-${y}`} cx={x as number} cy={y} r="7" className="f1 glow blink" style={{ animationDelay: `${li * 0.4 + i * 0.2}s` }} />),
      )}
    </g>
  ),
}
