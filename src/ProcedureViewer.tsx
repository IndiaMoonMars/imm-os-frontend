import { useState, useEffect, useRef } from 'react'

const API = '/schedule'

interface ProcedureStep { title: string; detail: string; caution?: boolean }
interface Procedure { id: number; name: string; category: string; description: string; version: string }
interface RunState {
  run_id: number
  procedure_name: string
  steps: ProcedureStep[]
  current_step: number
  total_steps: number
  progress_pct: number
  status: string
  step_timestamps: Record<string, string>
}

export default function ProcedureViewer() {
  const [procedures, setProcedures]   = useState<Procedure[]>([])
  const [selected,   setSelected]     = useState<number | null>(null)
  const [run,        setRun]          = useState<RunState | null>(null)
  const [status,     setStatus]       = useState('')
  const [fullscreen, setFullscreen]   = useState(false)
  const stepRef = useRef<HTMLDivElement>(null)

  const CREW_ID = 'EV1'

  useEffect(() => {
    fetch(`${API}/api/v1/scheduling/procedures`)
      .then(r => r.ok ? r.json() : [])
      .then(setProcedures)
  }, [])

  useEffect(() => {
    if (run && stepRef.current) {
      stepRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [run?.current_step])

  const startRun = async (pid: number) => {
    const r = await fetch(`${API}/api/v1/scheduling/procedures/run`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ procedure_id: pid, crew_id: CREW_ID })
    })
    if (!r.ok) { setStatus('✗ Failed to start run'); return }
    const { run_id } = await r.json()
    await loadRun(run_id)
    setFullscreen(true)
  }

  const loadRun = async (runId: number) => {
    const r = await fetch(`${API}/api/v1/scheduling/runs/${runId}`)
    if (r.ok) setRun(await r.json())
  }

  const completeStep = async () => {
    if (!run) return
    const r = await fetch(`${API}/api/v1/scheduling/runs/${run.run_id}/step`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crew_id: CREW_ID })
    })
    if (r.ok) {
      const d = await r.json()
      setRun(prev => prev ? { ...prev, current_step: d.current_step, progress_pct: d.progress_pct, status: d.status } : null)
      if (d.status === 'COMPLETE') {
        setStatus('✓ Procedure complete! All steps verified.')
        setFullscreen(false)
      }
    }
  }

  const abortRun = async () => {
    if (!run) return
    await fetch(`${API}/api/v1/scheduling/runs/${run.run_id}/abort`, { method: 'POST' })
    setRun(null)
    setFullscreen(false)
    setStatus('Procedure aborted.')
  }

  const st = {
    wrap: { padding: fullscreen ? '0' : '20px', color: '#e6f0ff', background: fullscreen ? '#000' : '#0d1117', minHeight: '100%', fontFamily: "'Inter', sans-serif" } as React.CSSProperties,
    panel: { background: '#1a2133', border: '1px solid #2a7fff33', borderRadius: '10px', padding: '18px', marginBottom: '18px' } as React.CSSProperties,
  }
  const btn = (c = '#2a7fff'): React.CSSProperties => ({ padding: '10px 22px', background: c, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, marginRight: '8px' })

  // ── Fullscreen step viewer ───────────────────────────────────────
  if (fullscreen && run) {
    const currentStep = run.steps[run.current_step] as ProcedureStep | undefined
    const prevSteps   = run.steps.slice(0, run.current_step)

    return (
      <div style={{
        width: '100vw', minHeight: '100vh', background: '#000', color: '#fff',
        fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column',
        padding: '0'
      }}>
        {/* Header */}
        <div style={{ background: '#0d1b2b', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #2a7fff33' }}>
          <div>
            <div style={{ fontSize: '13px', color: '#2a7fff', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase' }}>PROCEDURE EXECUTION</div>
            <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '2px' }}>{run.procedure_name}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '32px', fontWeight: 900, color: '#2a7fff', fontFamily: 'monospace' }}>
                {run.current_step}/{run.total_steps}
              </div>
              <div style={{ fontSize: '13px', color: '#aaa' }}>STEPS COMPLETE</div>
            </div>
            <button style={btn('#ff5c5c')} onClick={abortRun}>⛔ ABORT</button>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: '6px', background: '#111' }}>
          <div style={{ width: `${run.progress_pct}%`, height: '100%', background: '#2a7fff', transition: 'width 0.5s' }} />
        </div>

        {/* Steps */}
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          {/* Completed steps */}
          {prevSteps.map((step, i) => (
            <div key={i} style={{ padding: '14px 20px', marginBottom: '8px', borderRadius: '8px', background: '#0a1a0a', border: '1px solid #00ff7f33', display: 'flex', alignItems: 'center', gap: '16px', opacity: 0.6 }}>
              <span style={{ fontSize: '24px' }}>✅</span>
              <div>
                <div style={{ fontWeight: 700, color: '#00ff7f', fontSize: '16px' }}>Step {i + 1}: {step.title}</div>
              </div>
            </div>
          ))}

          {/* Current step */}
          {currentStep && (
            <div ref={stepRef} style={{
              padding: '28px', marginBottom: '16px', borderRadius: '12px',
              background: '#0d1b2b', border: '3px solid #2a7fff',
              boxShadow: '0 0 30px #2a7fff44'
            }}>
              <div style={{ color: '#2a7fff', fontSize: '13px', fontWeight: 700, letterSpacing: '2px', marginBottom: '10px' }}>
                ▶ CURRENT STEP {run.current_step + 1} OF {run.total_steps}
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, marginBottom: '16px', lineHeight: 1.3 }}>
                {currentStep.title}
              </div>
              <div style={{ fontSize: '17px', color: '#c0d0f0', lineHeight: 1.7, marginBottom: '20px' }}>
                {currentStep.detail}
              </div>
              {currentStep.caution && (
                <div style={{ background: '#ff5c5c22', border: '1px solid #ff5c5c', borderRadius: '6px', padding: '10px 16px', marginBottom: '20px', color: '#ff5c5c', fontWeight: 700 }}>
                  ⚠️ CAUTION — Read carefully before proceeding.
                </div>
              )}
              <button onClick={completeStep}
                style={{ padding: '18px 48px', background: '#00ff7f', color: '#000', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '20px', fontWeight: 900, letterSpacing: '1px' }}>
                ✓ STEP COMPLETE
              </button>
            </div>
          )}

          {/* Upcoming steps preview */}
          {run.steps.slice(run.current_step + 1, run.current_step + 4).map((step, i) => (
            <div key={i} style={{ padding: '14px 20px', marginBottom: '8px', borderRadius: '8px', background: '#111', border: '1px solid #333', opacity: 0.5 }}>
              <div style={{ color: '#888', fontSize: '14px' }}>Step {run.current_step + 2 + i}: {step.title}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Procedure Library ────────────────────────────────────────────
  return (
    <div style={st.wrap}>
      <h1 style={{ color: '#ff5c5c' }}>📋 Procedure Library</h1>
      {status && <div style={{ ...st.panel, color: 'lime', padding: '10px 16px' }}>{status}</div>}
      {run && run.status === 'IN_PROGRESS' && (
        <div style={{ ...st.panel, border: '2px solid #2a7fff' }}>
          <span style={{ color: '#2a7fff', fontWeight: 700 }}>▶ Active run: {run.procedure_name} — {run.progress_pct}% complete</span>
          <button style={{ ...btn(), marginLeft: '16px' }} onClick={() => setFullscreen(true)}>Resume →</button>
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        {procedures.map(proc => (
          <div key={proc.id} style={{ ...st.panel, minWidth: '280px', maxWidth: '360px' }}>
            <div style={{ color: '#ff5c5c', fontSize: '12px', fontWeight: 700, letterSpacing: '1px', marginBottom: '6px' }}>
              {proc.category || 'GENERAL'}
            </div>
            <div style={{ fontWeight: 700, fontSize: '17px', marginBottom: '6px' }}>{proc.name}</div>
            <div style={{ color: '#888', fontSize: '13px', marginBottom: '14px' }}>{proc.description}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#555', fontSize: '12px' }}>v{proc.version}</span>
              <button style={btn('#ff5c5c')} onClick={() => startRun(proc.id)}>▶ Start</button>
            </div>
          </div>
        ))}
        {procedures.length === 0 && <p style={{ color: '#555' }}>No procedures loaded. The CO₂ calibration procedure seeds on first API startup.</p>}
      </div>
    </div>
  )
}
