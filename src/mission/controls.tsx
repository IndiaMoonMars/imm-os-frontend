import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, History, RotateCcw, Square, TestTube, X } from 'lucide-react'
import { Panel } from '../components/Hud'
import { abortable, getJson, istInput, istShort, postJson, type HistoryItem, type Mission, type MissionClock } from './api'

// Mission control: restart, test runs, end, abort, and the history of every mission.
// Nothing here deletes readings: a mission is a time window, and these only relabel or end it.

const STATUS_TONE: Record<string, string> = {
  running: 'ok', upcoming: 'ok', complete: 'info', 'ended early': 'info', restarted: 'warn', test: 'idle', aborted: 'crit',
}

export function MissionControlMenu({ m, clock, now, onChanged }: {
  m: Mission; clock: MissionClock; now: number; onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [dialog, setDialog] = useState<'restart' | 'abort' | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  const running = clock.phase === 'pre' || clock.phase === 'active'
  const run = async (fn: () => Promise<unknown>) => {
    setErr(null)
    try { await fn(); setOpen(false); onChanged() } catch (x) { setErr((x as Error).message) }
  }
  const end = () => {
    if (!confirm(`End ${m.name} now? The record stops here; finished sols stay archived.`)) return
    run(() => postJson('/api/mission/end', {}))
  }
  const test = () => run(() => postJson('/api/mission/label', { test: m.label !== 'test' }))
  return (
    <div className="mctl" ref={ref}>
      <button className="mbtn warn" onClick={() => setOpen(x => !x)} aria-expanded={open}>Mission control <ChevronDown size={13} /></button>
      {open && (
        <div className="mctl-menu" role="menu">
          <button onClick={() => { setDialog('restart'); setOpen(false) }}>
            <i className="w"><RotateCcw size={15} /></i>
            <span><b>Restart mission</b><small>{running ? 'Ends this one now (kept in History) and' : 'Starts'} a new mission with the same name, sols and crew. Sol 1 again.</small></span>
          </button>
          <button onClick={test}>
            <i><TestTube size={15} /></i>
            <span><b>{m.label === 'test' ? 'Not a test run' : 'Mark as test run'}</b><small>{m.label === 'test' ? 'List it with the real missions again.' : 'A dry run: kept, left out of History’s list by default.'}</small></span>
          </button>
          {running && (
            <button onClick={end}>
              <i className="c"><Square size={14} /></i>
              <span><b>End mission now</b><small>Finishes it early. Sols so far are archived.</small></span>
            </button>
          )}
          {abortable(m, now) && (
            <button onClick={() => { setDialog('abort'); setOpen(false) }}>
              <i className="c"><X size={15} /></i>
              <span><b>Abort (false start)</b><small>Only in the first hour. The mission is marked aborted and leaves this page; its readings stay stored.</small></span>
            </button>
          )}
          {err && <p className="merr">{err}</p>}
        </div>
      )}
      {dialog === 'restart' && <RestartDialog m={m} running={running} onClose={() => setDialog(null)} onDone={() => { setDialog(null); onChanged() }} />}
      {dialog === 'abort' && <AbortDialog m={m} onClose={() => setDialog(null)} onDone={() => { setDialog(null); onChanged() }} />}
    </div>
  )
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])
  // at page level: a glass panel (backdrop-filter) would otherwise trap a fixed overlay inside itself
  return createPortal(
    <div className="mmodal-bg" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="mmodal" role="dialog" aria-modal="true" aria-label={title}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>,
    document.body,
  )
}

function RestartDialog({ m, running, onClose, onDone }: { m: Mission; running: boolean; onClose: () => void; onDone: () => void }) {
  const [keep, setKeep] = useState<'restarted' | 'test'>('restarted')
  const [when, setWhen] = useState<'now' | 'at'>('now')
  const [at, setAt] = useState(istInput(Date.now()))
  const [typed, setTyped] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      await postJson('/api/mission/restart', { confirm: typed, keep_as: keep, start_ist: when === 'at' ? at.replace('T', ' ') : null })
      onDone()
    } catch (x) { setErr((x as Error).message) }
    setBusy(false)
  }
  return (
    <Dialog title={`Restart “${m.name}”?`} onClose={onClose}>
      <form onSubmit={submit}>
        <p className="muted">{running ? 'It ends now. ' : ''}What the current mission becomes (its readings are never deleted):</p>
        <label className={`mopt ${keep === 'restarted' ? 'sel' : ''}`}>
          <input type="radio" checked={keep === 'restarted'} onChange={() => setKeep('restarted')} />
          <span><b>Keep it in History as “restarted”</b><small>Its sols stay viewable and downloadable; the Pi’s SD-card folder for it stays too.</small></span>
        </label>
        <label className={`mopt ${keep === 'test' ? 'sel' : ''}`}>
          <input type="radio" checked={keep === 'test'} onChange={() => setKeep('test')} />
          <span><b>Mark it as a test run</b><small>Hidden from History’s list; still there under “show test runs and aborted”.</small></span>
        </label>
        <div className="mrow">
          <label className="mopt inline"><input type="radio" checked={when === 'now'} onChange={() => setWhen('now')} /> New Sol 1 starts now</label>
          <label className="mopt inline"><input type="radio" checked={when === 'at'} onChange={() => setWhen('at')} /> at (IST)</label>
          {when === 'at' && <input className="minput" type="datetime-local" value={at} onChange={e => setAt(e.target.value)} required />}
        </div>
        <label className="mconfirm">Type the mission name to confirm
          <input className="minput" value={typed} onChange={e => setTyped(e.target.value)} placeholder={m.name} autoFocus />
        </label>
        {err && <p className="merr">{err}</p>}
        <div className="mmodal-actions">
          <button type="button" className="mbtn" onClick={onClose}>Cancel</button>
          <button className="mbtn warn" disabled={busy || typed.trim() !== m.name.trim()}><RotateCcw size={13} /> Restart mission</button>
        </div>
      </form>
    </Dialog>
  )
}

function AbortDialog({ m, onClose, onDone }: { m: Mission; onClose: () => void; onDone: () => void }) {
  const [typed, setTyped] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    try { await postJson('/api/mission/abort', { confirm: typed }); onDone() } catch (x) { setErr((x as Error).message) }
  }
  return (
    <Dialog title={`Abort “${m.name}”?`} onClose={onClose}>
      <form onSubmit={submit}>
        <p className="muted">For a false start. The mission is marked <b>aborted</b> and leaves this page; History keeps it
          (under “show test runs and aborted”) and every reading stays stored, on the MCC and on the Pi.</p>
        <label className="mconfirm">Type the mission name to confirm
          <input className="minput" value={typed} onChange={e => setTyped(e.target.value)} placeholder={m.name} autoFocus />
        </label>
        {err && <p className="merr">{err}</p>}
        <div className="mmodal-actions">
          <button type="button" className="mbtn" onClick={onClose}>Cancel</button>
          <button className="mbtn danger" disabled={typed.trim() !== m.name.trim()}><X size={13} /> Abort mission</button>
        </div>
      </form>
    </Dialog>
  )
}

export function HistoryPanel({ viewing, onOpen, onClose }: { viewing: number | null; onOpen: (id: number | null) => void; onClose: () => void }) {
  const [all, setAll] = useState(false)
  const [items, setItems] = useState<HistoryItem[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    getJson<{ missions: HistoryItem[] }>(`/api/mission/history${all ? '?all=1' : ''}`)
      .then(r => { if (alive) { setItems(r.missions); setErr(null) } })
      .catch(e => { if (alive) setErr((e as Error).message) })
    return () => { alive = false }
  }, [all])
  return (
    <Panel title="MISSION HISTORY" icon={<History size={16} />}
      right={<span className="mhist-tools">
        <label><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} /> show test runs and aborted</label>
        <button className="mbtn" onClick={onClose}>Close</button>
      </span>}>
      <table className="mhist">
        <thead><tr><th>#</th><th>MISSION</th><th>SOL 1 STARTED (IST)</th><th>SOLS</th><th>STATUS</th><th>ARCHIVED</th><th /></tr></thead>
        <tbody>
          {(items ?? []).map(h => {
            const ran = h.phase === 'active' ? `${h.sol} of ${h.sols}` : h.phase === 'complete' ? `${h.sol} of ${h.sols}` : `0 of ${h.sols}`
            const open = h.current ? viewing === null : viewing === h.id
            return (
              <tr key={h.id} className={open ? 'on' : ''}>
                <td>{h.id}</td>
                <td><b>{h.name}</b>{h.created_by ? <small> · {h.created_by}</small> : null}</td>
                <td>{istShort(h.start * 1000)}{h.ended_at ? <small> · ended {istShort(h.ended_at * 1000)}</small> : null}</td>
                <td>{ran}</td>
                <td><span className={`mpill ${STATUS_TONE[h.status] ?? 'idle'}`}>{h.status.toUpperCase()}{h.current && h.phase === 'active' ? ` · SOL ${h.sol}` : ''}</span></td>
                <td>{h.archived_sols ? `${h.archived_sols} sol${h.archived_sols > 1 ? 's' : ''} · ${h.readings.toLocaleString('en-IN')} readings` : '—'}</td>
                <td>{open ? <span className="muted">open</span> : <button className="mbtn" onClick={() => onOpen(h.current ? null : h.id)}>Open</button>}</td>
              </tr>
            )
          })}
          {items && !items.length && <tr><td colSpan={7} className="empty">No missions{all ? '' : ' (tick the box to see test runs and aborted ones)'}.</td></tr>}
        </tbody>
      </table>
      {err && <p className="merr">{err}</p>}
      <p className="muted small">Opening an earlier mission shows its page read-only, with its sol ZIPs, reports and whole-mission CSV. Nothing in History is ever deleted.</p>
    </Panel>
  )
}
