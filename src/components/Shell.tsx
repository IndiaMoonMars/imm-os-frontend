import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { LogOut, Menu, Satellite, X } from 'lucide-react'
import ImmLogo from './ImmLogo'
import { TABS, TAB_GROUPS, tabByKey, type TabKey } from '../theme/tabs'
import { currentUser, logout } from '../auth'
import { isSimulated, localMsd, useClock, usePoll, useTelemetry, type DelayConfig } from '../hooks/useMission'
import { TelemetryCtx } from '../hooks/telemetryContext'

const pad = (n: number) => String(n).padStart(2, '0')
const hms = (d: Date, utc: boolean) => utc
  ? `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  : `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`

function istTime(ms: number): string {
  const d = new Date(ms + 330 * 60000)
  return hms(d, true)
}

/** Coordinated Mars Time (HH:MM of the current sol). */
function marsClock(msd: number): string {
  const h = (msd - Math.floor(msd)) * 24
  return `${pad(Math.floor(h))}:${pad(Math.floor((h % 1) * 60))}`
}

function delayLabel(d?: DelayConfig | null): string {
  if (!d || !d.value) return 'NO DELAY'
  if (d.value < 60) return `${d.value.toFixed(2)} s · ${d.mode.toUpperCase()}`
  return `${(d.value / 60).toFixed(1)} min · ${d.mode.toUpperCase()}`
}

export default function Shell({ active, onSelect, children }: {
  active: TabKey; onSelect: (k: TabKey) => void; children: ReactNode
}) {
  const tab = tabByKey(active)
  const now = useClock()
  const telemetry = useTelemetry(5000)
  const delay = usePoll<DelayConfig>('/time/api/v1/time/delay', 30000)
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => { setNavOpen(false); window.scrollTo({ top: 0 }) }, [active])

  const all = telemetry.data ? Object.values(telemetry.data.readings).flatMap(n => Object.values(n)) : []
  const live = all.filter(r => !isSimulated(r)).length
  const link = telemetry.error ? 'LINK LOST' : !telemetry.data ? 'CONNECTING' : live === 0 ? 'SIMULATED' : live === all.length ? 'LIVE' : 'MIXED'
  const msd = localMsd(now)
  const user = currentUser()

  return (
    <TelemetryCtx.Provider value={{ data: telemetry.data, error: telemetry.error }}>
      <div className="shell" style={{ '--accent': tab.accent, '--accent2': tab.accent2 } as CSSProperties}>
        <div className="starfield" aria-hidden="true"><i /><i /><i /></div>

        {/* ── Sidebar ───────────────────────────── */}
        <aside className={`sidebar ${navOpen ? 'open' : ''}`}>
          <div className="brand">
            <ImmLogo size={42} />
            <div className="brand-text">
              <strong>IMM<span>·</span>OS</strong>
              <small>India Moon Mars</small>
            </div>
            <button className="icon-btn nav-close" onClick={() => setNavOpen(false)} aria-label="Close menu"><X size={18} /></button>
          </div>
          <nav>
            {TAB_GROUPS.map(g => (
              <div key={g} className="nav-group">
                <div className="nav-group-label">{g}</div>
                {TABS.filter(t => t.group === g).map(t => {
                  const Icon = t.icon
                  return (
                    <button key={t.key} className={`nav-item ${t.key === active ? 'active' : ''}`}
                      style={{ '--item': t.accent } as CSSProperties} onClick={() => onSelect(t.key)}>
                      <Icon size={18} strokeWidth={1.8} />
                      <span>{t.label}</span>
                      <em>{t.code}</em>
                    </button>
                  )
                })}
              </div>
            ))}
          </nav>
          <div className="sidebar-foot">
            <div className="crew-chip">
              <div className="avatar">{(user[0] ?? '?').toUpperCase()}</div>
              <div><strong>{user || 'crew'}</strong><small>Signed in</small></div>
              <button className="icon-btn" onClick={logout} title="Log out" aria-label="Log out"><LogOut size={16} /></button>
            </div>
          </div>
        </aside>
        {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} />}

        {/* ── Top command bar ───────────────────── */}
        <header className="topbar">
          <button className="icon-btn nav-open" onClick={() => setNavOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="topbar-title">
            <span className="crumb">{tab.group}</span>
            <strong>{tab.label}</strong>
          </div>
          <div className="clocks">
            <div className="clock"><label>UTC</label><span>{hms(new Date(now), true)}</span></div>
            <div className="clock"><label>IST</label><span>{istTime(now)}</span></div>
            <div className="clock mars"><label>MARS · SOL {Math.floor(msd)}</label><span>{marsClock(msd)}</span></div>
            <div className="clock"><label>COMM DELAY</label><span>{delayLabel(delay.data)}</span></div>
          </div>
          <div className={`link-state ${link.replace(' ', '-').toLowerCase()}`}>
            <Satellite size={15} /><span>{link}</span>
          </div>
        </header>

        <main className="stage" key={active}>{children}</main>
      </div>
    </TelemetryCtx.Provider>
  )
}
