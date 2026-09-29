import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { BellRing, Check, CheckCheck, Volume2, VolumeX, X } from 'lucide-react'
import { MODE_COLOR, SEV_COLOR, SEV_RANK, sortAlarms, useHealthActions, useHealthSummary, type Alarm } from '../hooks/useHealth'

const ago = (t: number) => {
  const s = Math.max(0, Date.now() / 1000 - t)
  return s < 60 ? `${s.toFixed(0)} s` : s < 3600 ? `${(s / 60).toFixed(0)} min` : `${(s / 3600).toFixed(1)} h`
}

function readMuted(): boolean {
  try { return localStorage.getItem('imm-annunciator-muted') === '1' } catch { return false }
}

/** Short tone for a new unacknowledged warning (one beep) or emergency (three). */
function tone(count: number) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    for (let i = 0; i < count; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.frequency.value = 880
      g.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.3)
      g.gain.setValueAtTime(0, ctx.currentTime + i * 0.3 + 0.18)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + i * 0.3)
      o.stop(ctx.currentTime + i * 0.3 + 0.2)
    }
  } catch { /* no audio: the banner still flashes */ }
}

/**
 * Caution & warning annunciator for the top bar: mission mode, the number of open alarms,
 * and a panel to read and acknowledge them. Unacknowledged warnings and emergencies flash
 * (and beep, unless muted) until someone acknowledges them.
 */
export default function Annunciator({ onOpenHealth }: { onOpenHealth: () => void }) {
  const { data, error } = useHealthSummary(3000)
  const { ack, ackAll } = useHealthActions()
  const [open, setOpen] = useState(false)
  const [muted, setMuted] = useState(readMuted)
  const [busy, setBusy] = useState<number | 'all' | null>(null)
  const heard = useRef<Set<number>>(new Set())

  const alarms = sortAlarms((data?.alarms ?? []).filter(a => !a.simulated))
  const unacked = alarms.filter(a => !a.acked)
  const loud = unacked.filter(a => SEV_RANK[a.severity] >= SEV_RANK.warning)
  const mode = error ? null : data?.mode

  useEffect(() => {
    const fresh = loud.filter(a => !heard.current.has(a.id))
    fresh.forEach(a => heard.current.add(a.id))
    if (fresh.length && !muted) tone(fresh.some(a => a.severity === 'emergency') ? 3 : 1)
  }, [loud, muted])

  const toggleMute = () => {
    setMuted(m => {
      try { localStorage.setItem('imm-annunciator-muted', m ? '0' : '1') } catch { /* per-browser only */ }
      return !m
    })
  }
  const doAck = async (a: Alarm) => { setBusy(a.id); try { await ack(a.id) } finally { setBusy(null) } }
  const doAckAll = async () => { setBusy('all'); try { await ackAll() } finally { setBusy(null) } }

  const color = mode ? MODE_COLOR[mode] : '#5d6a88'
  return (
    <div className="annunciator">
      <button className={`mode-pill ${loud.length ? 'flash' : ''}`} style={{ '--mode': color } as CSSProperties}
        onClick={() => setOpen(o => !o)} title="Alarms and mission mode">
        <BellRing size={15} />
        <span>{mode ?? 'HEALTH ?'}</span>
        {alarms.length > 0 && <em>{unacked.length ? `${unacked.length} NEW` : alarms.length}</em>}
      </button>
      {open && (
        <div className="alarm-panel" role="dialog" aria-label="Alarms">
          <div className="alarm-panel-head">
            <strong>{alarms.length ? `${alarms.length} open alarm(s)` : 'No open alarms'}</strong>
            <button className="icon-btn" onClick={toggleMute} title={muted ? 'Sound on' : 'Mute'}>
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            {unacked.length > 0 && (
              <button className="alarm-ack-all" onClick={doAckAll} disabled={busy === 'all'}>
                <CheckCheck size={14} /> Acknowledge all
              </button>
            )}
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close"><X size={16} /></button>
          </div>
          {error && <div className="alarm-empty">Health monitor unreachable: alarms unknown</div>}
          <ul className="alarm-list">
            {alarms.map(a => (
              <li key={a.id} className={`alarm ${a.acked ? 'acked' : 'new'} ${a.state}`}
                style={{ '--sev': SEV_COLOR[a.severity] } as CSSProperties}>
                <span className="alarm-sev">{a.severity}</span>
                <div className="alarm-text">
                  <p>{a.message}</p>
                  <small>
                    {a.state === 'rtn' ? 'back to normal, acknowledge to close · ' : ''}
                    raised {ago(a.raised_at)} ago{a.raise_count > 1 ? ` · ${a.raise_count}× ` : ''}
                    {a.unverified ? ' · UNVERIFIED' : ''}{a.acked ? ` · acked by ${a.acked_by}` : ''}
                  </small>
                </div>
                {!a.acked && (
                  <button className="alarm-ack" onClick={() => doAck(a)} disabled={busy === a.id} title="Acknowledge">
                    <Check size={14} /> ACK
                  </button>
                )}
              </li>
            ))}
          </ul>
          <button className="alarm-more" onClick={() => { setOpen(false); onOpenHealth() }}>
            Systems health, EVA and history →
          </button>
        </div>
      )}
    </div>
  )
}
