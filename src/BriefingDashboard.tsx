import { useState, useEffect } from 'react'

const API = '/comms'
const CREW_ID = 'EV1'

interface Assignment { crew_id: string; task: string }
interface BriefingAck { crew_id: string; item_index: number }

interface Briefing {
  id: number
  mission_day: number
  created_by: string
  objectives: string
  eclss_snapshot: any
  eva_summary: string
  assignments: Assignment[]
  acks: BriefingAck[]
}

export default function BriefingDashboard() {
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [status, setStatus] = useState('')
  const [form, setForm] = useState({
    objectives: '',
    eva_summary: '',
    assignments: [{ crew_id: 'EV1', task: '' }, { crew_id: 'EV2', task: '' }]
  })
  const [view, setView] = useState<'today'|'create'>('today')

  const fetchToday = async () => {
    const r = await fetch(`${API}/api/v1/briefing/latest/today`)
    if (r.ok) {
      const b = await r.json()
      // Hydrate acks
      const r2 = await fetch(`${API}/api/v1/briefing/${b.id}`)
      if (r2.ok) setBriefing(await r2.json())
    } else {
      setBriefing(null)
    }
  }

  useEffect(() => { fetchToday(); const iv = setInterval(fetchToday, 10000); return () => clearInterval(iv) }, [])

  const createBriefing = async () => {
    setStatus("Creating today's briefing…")
    const r = await fetch(`${API}/api/v1/briefing/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ created_by: CREW_ID, ...form })
    })
    if (r.ok) {
      const d = await r.json()
      setStatus(`✓ Briefing created. ECLSS auto-populated. Mission Day ${d.mission_day}`)
      fetchToday()
      setView('today')
    } else {
      setStatus('✗ Failed to create briefing')
    }
  }

  const ackItem = async (idx: number) => {
    if (!briefing) return
    const r = await fetch(`${API}/api/v1/briefing/${briefing.id}/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crew_id: CREW_ID, item_index: idx })
    })
    if (r.ok) {
      const d = await r.json()
      setStatus(`Acknowledged item ${idx + 1} — ${d.acked}/${d.total} (${d.pct}%)`)
      fetchToday()
    }
  }

  const s: Record<string, React.CSSProperties> = {
    wrap: { padding: '20px', color: '#e6f0ff', background: '#0d1117', minHeight: '100%', fontFamily: "'Inter', sans-serif" },
    panel: { background: '#1a2133', border: '1px solid #2a7fff33', borderRadius: '10px', padding: '18px', marginBottom: '18px' },
    input: { width: '100%', padding: '9px 12px', background: '#0d1117', color: '#e6f0ff', border: '1px solid #2a7fff55', borderRadius: '6px', marginBottom: '10px', boxSizing: 'border-box' as const },
    btn: (c = '#2a7fff'): React.CSSProperties => ({ padding: '9px 20px', background: c, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, marginRight: '8px' }),
  }

  const isAcked = (idx: number) => briefing?.acks?.some(a => a.crew_id === CREW_ID && a.item_index === idx)

  return (
    <div style={s.wrap}>
      <h1 style={{ color: '#ffaa00' }}>📋 Daily Mission Briefing</h1>
      {status && <div style={{ ...s.panel, color: 'lime', padding: '10px 16px' }}>{status}</div>}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
        <button style={s.btn(view === 'today' ? '#ffaa00' : '#333')} onClick={() => setView('today')}>📅 Today's Briefing</button>
        <button style={s.btn(view === 'create' ? '#ffaa00' : '#333')} onClick={() => setView('create')}>➕ Create Briefing</button>
      </div>

      {view === 'today' && !briefing && (
        <div style={s.panel}>
          <p style={{ color: '#555' }}>No briefing filed for today. Commander should create one.</p>
        </div>
      )}

      {view === 'today' && briefing && (() => {
        const assignments: Assignment[] = typeof briefing.assignments === 'string'
          ? JSON.parse(briefing.assignments) : briefing.assignments || []
        const acks = briefing.acks || []
        const total = assignments.length
        const ackedCount = new Set(acks.map(a => a.item_index)).size
        const pct = total > 0 ? Math.round(100 * ackedCount / total) : 0

        // ECLSS snapshot (could be nested)
        const eclss = typeof briefing.eclss_snapshot === 'string'
          ? JSON.parse(briefing.eclss_snapshot) : briefing.eclss_snapshot

        return (
          <>
            <div style={s.panel}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h2 style={{ margin: 0, color: '#ffaa00' }}>Mission Day {briefing.mission_day} Briefing</h2>
                <span style={{ color: pct === 100 ? '#00ff7f' : '#ff5c5c', fontWeight: 700 }}>
                  ACKs: {ackedCount}/{total} ({pct}%)
                </span>
              </div>
              <div style={{ background: '#0d1117', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
                <div style={{ color: '#aaa', fontSize: '13px', marginBottom: '4px' }}>OBJECTIVES</div>
                <p style={{ margin: 0, lineHeight: 1.6 }}>{briefing.objectives}</p>
              </div>
              {briefing.eva_summary && (
                <div style={{ background: '#0d1117', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
                  <div style={{ color: '#aaa', fontSize: '13px', marginBottom: '4px' }}>EVA ACTIVITY</div>
                  <p style={{ margin: 0 }}>{briefing.eva_summary}</p>
                </div>
              )}
            </div>

            {/* ECLSS Snapshot */}
            {eclss && (
              <div style={s.panel}>
                <div style={{ color: '#2affe0', fontWeight: 700, marginBottom: '10px' }}>🌿 ECLSS STATUS (Auto-pulled at briefing time)</div>
                <pre style={{ color: '#aaa', fontSize: '12px', overflow: 'auto', margin: 0 }}>
                  {JSON.stringify(eclss, null, 2)}
                </pre>
              </div>
            )}

            {/* Assignment Checklist */}
            <div style={s.panel}>
              <div style={{ color: '#a855f7', fontWeight: 700, marginBottom: '12px' }}>📌 CREW ASSIGNMENTS — TAP TO ACKNOWLEDGE</div>
              {assignments.map((a, idx) => (
                <div key={idx} onClick={() => ackItem(idx)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', borderRadius: '6px',
                    cursor: 'pointer', marginBottom: '6px',
                    background: isAcked(idx) ? '#00ff7f11' : '#111',
                    border: `1px solid ${isAcked(idx) ? '#00ff7f44' : '#333'}` }}>
                  <span style={{ fontSize: '20px' }}>{isAcked(idx) ? '✅' : '⬜'}</span>
                  <div>
                    <div style={{ fontWeight: 700, color: isAcked(idx) ? '#00ff7f' : '#fff' }}>
                      {a.crew_id}
                    </div>
                    <div style={{ color: '#aaa', fontSize: '13px', textDecoration: isAcked(idx) ? 'line-through' : 'none' }}>
                      {a.task}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )
      })()}

      {view === 'create' && (
        <div style={s.panel}>
          <h2 style={{ color: '#ffaa00', marginTop: 0 }}>New Briefing</h2>
          <label style={{ fontSize: '13px', color: '#aaa' }}>Mission Objectives</label>
          <textarea rows={4} style={s.input} value={form.objectives}
            onChange={e => setForm({ ...form, objectives: e.target.value })}
            placeholder="Today's mission goals and priorities…" />
          <label style={{ fontSize: '13px', color: '#aaa' }}>EVA Activity Summary</label>
          <input style={s.input} value={form.eva_summary}
            onChange={e => setForm({ ...form, eva_summary: e.target.value })}
            placeholder="EVA plan reference or description…" />
          <label style={{ fontSize: '13px', color: '#aaa', display: 'block', marginBottom: '6px' }}>Crew Assignments</label>
          {form.assignments.map((a, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input style={{ ...s.input, width: '120px', marginBottom: 0 }} value={a.crew_id}
                onChange={e => { const as = [...form.assignments]; as[idx].crew_id = e.target.value; setForm({ ...form, assignments: as }) }}
                placeholder="Crew ID" />
              <input style={{ ...s.input, flex: 1, marginBottom: 0 }} value={a.task}
                onChange={e => { const as = [...form.assignments]; as[idx].task = e.target.value; setForm({ ...form, assignments: as }) }}
                placeholder="Task description…" />
            </div>
          ))}
          <button style={{ ...s.btn('#333'), marginBottom: '16px' }}
            onClick={() => setForm({ ...form, assignments: [...form.assignments, { crew_id: '', task: '' }] })}>
            + Add Crew Member
          </button>
          <br />
          <button style={s.btn('#ffaa00')} onClick={createBriefing}>CREATE BRIEFING</button>
          <div style={{ color: '#aaa', fontSize: '12px', marginTop: '10px' }}>
            ECLSS status will be automatically pulled from live sensors at time of creation.
          </div>
        </div>
      )}
    </div>
  )
}
