import { useState, useEffect } from 'react'

interface EvaPlan {
  id?: number
  crew_members: string[]
  objectives: string
  duration_minutes: number
  tools_required: string[]
  abort_criteria: string
  checklist: { label: string; done: boolean }[]
  status?: string
}

interface Tool {
  rfid_tag: string
  tool_name: string
  category: string
  is_available: boolean
}

const DEFAULT_CHECKLIST = [
  "Suit pressure check complete",
  "Comms check (MCC + Commander)",
  "Biosensor pack armed and streaming",
  "UWB tag calibrated",
  "Tool manifest reconciled",
  "Emergency beacon tested",
  "Abort criteria acknowledged by crew",
]

export default function EvaDashboard() {
  const [plans, setPlans] = useState<EvaPlan[]>([])
  const [tools, setTools] = useState<Tool[]>([])
  const [activePlan, setActivePlan] = useState<EvaPlan | null>(null)
  const [form, setForm] = useState<EvaPlan>({
    crew_members: ['EV1', 'EV2'],
    objectives: '',
    duration_minutes: 60,
    tools_required: [],
    abort_criteria: 'HR > 160 sustained, SpO₂ < 94%, suit pressure loss',
    checklist: DEFAULT_CHECKLIST.map(label => ({ label, done: false })),
  })
  const [statusMsg, setStatusMsg] = useState('')

  const fetchPlans = async () => {
    try {
      const res = await fetch('/eva/api/v1/eva/plans')
      if (res.ok) setPlans(await res.json())
    } catch { /* offline */ }
  }

  const fetchTools = async () => {
    try {
      const res = await fetch('/eva/api/v1/eva/tools')
      if (res.ok) setTools(await res.json())
    } catch { /* offline */ }
  }

  useEffect(() => {
    fetchPlans()
    fetchTools()
    const iv = setInterval(() => { fetchPlans(); fetchTools() }, 10000)
    return () => clearInterval(iv)
  }, [])

  const submitPlan = async () => {
    setStatusMsg('Submitting EVA plan to Postgres...')
    const res = await fetch('/eva/api/v1/eva/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const data = await res.json()
      setStatusMsg(`✓ EVA Plan #${data.eva_plan_id} filed. CREW GO pending checklist.`)
      fetchPlans()
    } else {
      setStatusMsg('✗ Submission failed.')
    }
  }

  const toggleChecklistItem = async (plan: EvaPlan, idx: number) => {
    if (!plan.id) return
    const updated = plan.checklist.map((item, i) =>
      i === idx ? { ...item, done: !item.done } : item
    )
    await fetch(`/eva/api/v1/eva/plan/${plan.id}/checklist`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checklist: updated }),
    })
    fetchPlans()
  }

  const panelStyle: React.CSSProperties = {
    background: '#1a2133', border: '1px solid #2a7fff33',
    borderRadius: '10px', padding: '20px', marginBottom: '20px'
  }
  const labelStyle: React.CSSProperties = { display: 'block', color: '#aaa', marginBottom: '4px', fontSize: '13px' }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', background: '#0d1117',
    color: '#e6f0ff', border: '1px solid #2a7fff55', borderRadius: '6px',
    marginBottom: '12px', boxSizing: 'border-box', fontSize: '14px'
  }
  const btnStyle = (color = '#2a7fff'): React.CSSProperties => ({
    padding: '10px 22px', background: color, color: '#fff',
    border: 'none', borderRadius: '6px', cursor: 'pointer',
    fontWeight: 'bold', letterSpacing: '0.5px', marginRight: '10px'
  })

  return (
    <div style={{ padding: '24px', background: '#0d1117', minHeight: '100vh', color: '#e6f0ff', fontFamily: "'Inter', sans-serif" }}>
      <h1 style={{ color: '#2a7fff', fontWeight: 700, letterSpacing: '1px' }}>⛑ EVA Mission Control</h1>
      {statusMsg && <div style={{ background: '#162d3a', padding: '10px 16px', borderRadius: '6px', marginBottom: '18px', color: 'lime' }}>{statusMsg}</div>}

      {/* ── EVA Plan Form ───────────────────── */}
      <div style={panelStyle}>
        <h2 style={{ color: '#ffaa00', marginTop: 0 }}>New EVA Plan</h2>
        <label style={labelStyle}>Crew Members (comma-separated)</label>
        <input style={inputStyle} value={form.crew_members.join(', ')}
          onChange={e => setForm({ ...form, crew_members: e.target.value.split(',').map(s => s.trim()) })} />
        <label style={labelStyle}>Mission Objectives</label>
        <textarea rows={3} style={{ ...inputStyle }} value={form.objectives}
          onChange={e => setForm({ ...form, objectives: e.target.value })} />
        <label style={labelStyle}>Duration (minutes)</label>
        <input type="number" style={inputStyle} value={form.duration_minutes}
          onChange={e => setForm({ ...form, duration_minutes: parseInt(e.target.value) })} />
        <label style={labelStyle}>Tools Required (comma-separated)</label>
        <input style={inputStyle} value={form.tools_required.join(', ')}
          onChange={e => setForm({ ...form, tools_required: e.target.value.split(',').map(s => s.trim()) })} />
        <label style={labelStyle}>Abort Criteria</label>
        <input style={inputStyle} value={form.abort_criteria}
          onChange={e => setForm({ ...form, abort_criteria: e.target.value })} />
        <button style={btnStyle()} onClick={submitPlan}>FILE EVA PLAN</button>
      </div>

      {/* ── Filed EVA Plans + Checklist ─────── */}
      <div style={panelStyle}>
        <h2 style={{ color: '#ff5c5c', marginTop: 0 }}>Filed Plans &amp; Checklists</h2>
        {plans.length === 0 && <p style={{ color: '#666' }}>No EVA plans on record.</p>}
        {plans.map(plan => (
          <div key={plan.id} style={{ background: '#111827', borderRadius: '8px', padding: '16px', marginBottom: '16px', border: `1px solid ${plan.status === 'GO' ? '#00ff7f' : '#333'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontWeight: 700, fontSize: '16px' }}>Plan #{plan.id} — {plan.objectives.slice(0, 60)}</span>
              <span style={{
                padding: '3px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
                background: plan.status === 'GO' ? '#00ff7f22' : '#ff5c5c22',
                color: plan.status === 'GO' ? '#00ff7f' : '#ff5c5c',
                border: `1px solid ${plan.status === 'GO' ? '#00ff7f' : '#ff5c5c'}`
              }}>{plan.status}</span>
            </div>
            <div style={{ color: '#aaa', fontSize: '13px', marginBottom: '12px' }}>
              Crew: {plan.crew_members?.join(', ')} | Duration: {plan.duration_minutes} min
            </div>
            <div style={{ color: '#ffaa00', fontWeight: 600, marginBottom: '8px', fontSize: '13px' }}>PRE-EVA CHECKLIST</div>
            {(plan.checklist || []).map((item: any, idx: number) => (
              <div key={idx} onClick={() => toggleChecklistItem(plan, idx)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
                  padding: '6px 10px', borderRadius: '5px', marginBottom: '4px',
                  background: item.done ? '#00ff7f11' : '#111', border: `1px solid ${item.done ? '#00ff7f44' : '#333'}` }}>
                <span style={{ fontSize: '18px' }}>{item.done ? '✅' : '⬜'}</span>
                <span style={{ color: item.done ? '#00ff7f' : '#ccc', textDecoration: item.done ? 'line-through' : 'none', fontSize: '13px' }}>{item.label}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* ── Tool Inventory ─────────────────── */}
      <div style={panelStyle}>
        <h2 style={{ color: '#2affe0', marginTop: 0 }}>Tool Inventory ({tools.length} items)</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {tools.map(t => (
            <div key={t.rfid_tag} style={{
              background: t.is_available ? '#0d2b1a' : '#2b0d0d',
              border: `1px solid ${t.is_available ? '#2affe0' : '#ff5c5c'}`,
              borderRadius: '6px', padding: '8px 14px', fontSize: '12px',
            }}>
              <div style={{ fontWeight: 700, color: t.is_available ? '#2affe0' : '#ff5c5c' }}>{t.tool_name}</div>
              <div style={{ color: '#666' }}>{t.rfid_tag} · {t.category}</div>
              <div style={{ marginTop: '4px', fontWeight: 600, color: t.is_available ? '#00ff7f' : '#ff5c5c' }}>
                {t.is_available ? 'AVAILABLE' : 'CHECKED OUT'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
