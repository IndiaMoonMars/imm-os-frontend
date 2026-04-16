import { useState, useEffect, useRef } from 'react'

const API = '/schedule'

interface Project { id: number; name: string; status: string; owner_id: string; start_date: string; end_date: string }
interface Task {
  id: number; project_id: number; project_name: string; title: string
  assignee_id: string; status: string; priority: string
  deadline: string | null; mission_day: number; parent_task_id: number | null
}
interface Milestone { id: number; project_id: number; project_name: string; name: string; target_date: string; reached: boolean }

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#ffaa00', IN_PROGRESS: '#2a7fff', BLOCKED: '#ff5c5c',
  COMPLETE: '#00ff7f', CANCELLED: '#555'
}
const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#555', NORMAL: '#aaa', HIGH: '#ffaa00', CRITICAL: '#ff5c5c'
}

type View = 'gantt' | 'tasks' | 'roadmap'

export default function SchedulingDashboard() {
  const [projects,   setProjects]   = useState<Project[]>([])
  const [tasks,      setTasks]      = useState<Task[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [activeView, setActiveView] = useState<View>('gantt')
  const [filterAssignee, setFilterAssignee] = useState('')
  const [filterProject,  setFilterProject]  = useState<number | null>(null)
  const [status, setStatus] = useState('')

  // New-task form
  const [taskForm, setTaskForm] = useState({
    project_id: 0, title: '', assignee_id: '', priority: 'NORMAL',
    deadline: '', description: ''
  })
  // New-project form
  const [projForm, setProjForm] = useState({ name: '', owner_id: 'EV1', start_date: '', end_date: '' })
  const [showCreate, setShowCreate] = useState<'task' | 'project' | null>(null)

  const fetchAll = async () => {
    const [pr, ta, mi] = await Promise.all([
      fetch(`${API}/api/v1/scheduling/projects`).then(r => r.ok ? r.json() : []),
      fetch(`${API}/api/v1/scheduling/tasks`).then(r => r.ok ? r.json() : []),
      fetch(`${API}/api/v1/scheduling/milestones`).then(r => r.ok ? r.json() : []),
    ])
    setProjects(pr); setTasks(ta); setMilestones(mi)
  }

  useEffect(() => { fetchAll(); const iv = setInterval(fetchAll, 15000); return () => clearInterval(iv) }, [])

  const createProject = async () => {
    const r = await fetch(`${API}/api/v1/scheduling/projects`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projForm)
    })
    if (r.ok) { setStatus('✓ Project created'); fetchAll(); setShowCreate(null) }
    else setStatus('✗ Failed')
  }

  const createTask = async () => {
    if (!taskForm.project_id) { setStatus('Select a project first'); return }
    const payload = {
      ...taskForm,
      deadline: taskForm.deadline ? new Date(taskForm.deadline).toISOString() : null
    }
    const r = await fetch(`${API}/api/v1/scheduling/tasks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (r.ok) { setStatus('✓ Task created'); fetchAll(); setShowCreate(null) }
    else setStatus('✗ Failed')
  }

  const updateStatus = async (tid: number, status: string) => {
    await fetch(`${API}/api/v1/scheduling/tasks/${tid}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
    fetchAll()
  }

  const reachMilestone = async (mid: number) => {
    await fetch(`${API}/api/v1/scheduling/milestones/${mid}/reach`, { method: 'PATCH' })
    fetchAll()
  }

  const st = {
    wrap: { padding: '20px', color: '#e6f0ff', background: '#0d1117', minHeight: '100%', fontFamily: "'Inter', sans-serif" } as React.CSSProperties,
    panel: { background: '#1a2133', border: '1px solid #2a7fff33', borderRadius: '10px', padding: '18px', marginBottom: '18px' } as React.CSSProperties,
    input: { width: '100%', padding: '8px 12px', background: '#0d1117', color: '#e6f0ff', border: '1px solid #2a7fff55', borderRadius: '6px', marginBottom: '8px', boxSizing: 'border-box' as const } as React.CSSProperties,
  }
  const btn = (c = '#2a7fff'): React.CSSProperties => ({ padding: '8px 18px', background: c, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, marginRight: '8px' })

  const filteredTasks = tasks.filter(t => {
    if (filterAssignee && t.assignee_id !== filterAssignee) return false
    if (filterProject && t.project_id !== filterProject) return false
    return true
  })

  // ── Gantt helpers ────────────────────────────────────────────────
  const NOW = new Date()
  const tasksWithDeadline = filteredTasks.filter(t => t.deadline)
  const allDates = tasksWithDeadline.map(t => new Date(t.deadline!))
  const minDate = allDates.length ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date()
  const maxDate = allDates.length ? new Date(Math.max(...allDates.map(d => d.getTime()))) : new Date(Date.now() + 7*86400000)
  minDate.setDate(minDate.getDate() - 2); maxDate.setDate(maxDate.getDate() + 2)
  const span = maxDate.getTime() - minDate.getTime()

  const pct = (d: Date) => Math.max(0, Math.min(100, 100 * (d.getTime() - minDate.getTime()) / span))
  const nowPct = pct(NOW)

  // assignees list
  const assignees = [...new Set(tasks.map(t => t.assignee_id).filter(Boolean))]

  return (
    <div style={st.wrap}>
      <h1 style={{ color: '#2affe0' }}>🗓 Work Scheduling &amp; Roadmap</h1>
      {status && <div style={{ ...st.panel, color: 'lime', padding: '10px 16px' }}>{status}</div>}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        {(['gantt', 'tasks', 'roadmap'] as View[]).map(v => (
          <button key={v} style={btn(activeView === v ? '#2affe0' : '#333')}
            onClick={() => setActiveView(v)}>{v === 'gantt' ? '📊 Gantt' : v === 'tasks' ? '☑ Tasks' : '🗺 Roadmap'}</button>
        ))}
        <select style={{ ...st.input, width: 'auto', marginBottom: 0 }}
          onChange={e => setFilterAssignee(e.target.value)}>
          <option value="">All Crew</option>
          {assignees.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select style={{ ...st.input, width: 'auto', marginBottom: 0 }}
          onChange={e => setFilterProject(e.target.value ? +e.target.value : null)}>
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button style={btn('#ff5c5c')} onClick={() => setShowCreate('project')}>＋ Project</button>
          <button style={btn('#2a7fff')} onClick={() => setShowCreate('task')}>＋ Task</button>
        </div>
      </div>

      {showCreate === 'project' && (
        <div style={st.panel}>
          <h3 style={{ color: '#2affe0', marginTop: 0 }}>New Project</h3>
          <input style={st.input} placeholder="Project name" value={projForm.name}
            onChange={e => setProjForm({ ...projForm, name: e.target.value })} />
          <input style={st.input} placeholder="Owner ID" value={projForm.owner_id}
            onChange={e => setProjForm({ ...projForm, owner_id: e.target.value })} />
          <input type="date" style={st.input} value={projForm.start_date}
            onChange={e => setProjForm({ ...projForm, start_date: e.target.value })} />
          <input type="date" style={st.input} value={projForm.end_date}
            onChange={e => setProjForm({ ...projForm, end_date: e.target.value })} />
          <button style={btn('#2affe0')} onClick={createProject}>CREATE</button>
          <button style={btn('#333')} onClick={() => setShowCreate(null)}>Cancel</button>
        </div>
      )}

      {showCreate === 'task' && (
        <div style={st.panel}>
          <h3 style={{ color: '#2a7fff', marginTop: 0 }}>New Task</h3>
          <select style={st.input} value={taskForm.project_id}
            onChange={e => setTaskForm({ ...taskForm, project_id: +e.target.value })}>
            <option value={0}>— Select Project —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input style={st.input} placeholder="Title" value={taskForm.title}
            onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} />
          <input style={st.input} placeholder="Assignee ID (e.g. EV1)" value={taskForm.assignee_id}
            onChange={e => setTaskForm({ ...taskForm, assignee_id: e.target.value })} />
          <select style={st.input} value={taskForm.priority}
            onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}>
            {['LOW','NORMAL','HIGH','CRITICAL'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <input type="datetime-local" style={st.input} value={taskForm.deadline}
            onChange={e => setTaskForm({ ...taskForm, deadline: e.target.value })} />
          <textarea rows={2} style={st.input} placeholder="Description (optional)" value={taskForm.description}
            onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} />
          <button style={btn()} onClick={createTask}>CREATE</button>
          <button style={btn('#333')} onClick={() => setShowCreate(null)}>Cancel</button>
        </div>
      )}

      {activeView === 'gantt' && (
        <div style={st.panel}>
          <h2 style={{ color: '#2affe0', marginTop: 0 }}>Gantt Timeline</h2>
          {tasksWithDeadline.length === 0 && <p style={{ color: '#555' }}>No tasks with deadlines assigned yet.</p>}
          <div style={{ position: 'relative', height: '28px', marginBottom: '8px', borderBottom: '1px solid #333' }}>
            {[0, 25, 50, 75, 100].map(p => {
              const d = new Date(minDate.getTime() + (p / 100) * span)
              return <span key={p} style={{ position: 'absolute', left: `${p}%`, color: '#555', fontSize: '11px', transform: 'translateX(-50%)' }}>
                {d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
              </span>
            })}
          </div>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: `${nowPct}%`, top: 0, bottom: 0, width: '2px', background: '#ff5c5c', zIndex: 10 }}>
              <span style={{ position: 'absolute', top: '-18px', left: '-16px', color: '#ff5c5c', fontSize: '10px', fontWeight: 700 }}>NOW</span>
            </div>
            {tasksWithDeadline.map(t => {
              const deadlinePct = pct(new Date(t.deadline!))
              const barWidth = Math.max(1, deadlinePct)
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', gap: '10px' }}>
                  <div style={{ width: '160px', fontSize: '12px', color: '#ccc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.title}
                  </div>
                  <div style={{ flex: 1, height: '22px', background: '#111', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', left: 0, width: `${barWidth}%`, height: '100%',
                      background: STATUS_COLORS[t.status] || '#2a7fff',
                      borderRadius: '4px', opacity: 0.85, transition: 'width 0.4s' }} />
                    <span style={{ position: 'absolute', left: '6px', lineHeight: '22px', fontSize: '11px', color: '#fff', zIndex: 2 }}>
                      {t.assignee_id} — {t.status}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: PRIORITY_COLORS[t.priority], width: '60px' }}>{t.priority}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeView === 'tasks' && (
        <div style={st.panel}>
          <h2 style={{ color: '#2affe0', marginTop: 0 }}>Task Board ({filteredTasks.length})</h2>
          {filteredTasks.length === 0 && <p style={{ color: '#555' }}>No tasks found.</p>}
          {filteredTasks.map(t => (
            <div key={t.id} style={{ borderBottom: '1px solid #2a3045', padding: '12px 0', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700,
                background: (STATUS_COLORS[t.status] || '#333') + '22',
                color: STATUS_COLORS[t.status] || '#aaa',
                border: `1px solid ${(STATUS_COLORS[t.status] || '#333')}55` }}>{t.status}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{t.title}</div>
                <div style={{ color: '#666', fontSize: '12px' }}>{t.project_name} · {t.assignee_id} · Day {t.mission_day}</div>
              </div>
              <span style={{ fontSize: '12px', color: PRIORITY_COLORS[t.priority], fontWeight: 700 }}>{t.priority}</span>
              {t.deadline && <span style={{ fontSize: '11px', color: '#aaa' }}>{new Date(t.deadline).toLocaleDateString('en-IN')}</span>}
              {t.status === 'PENDING' && <button style={btn('#2a7fff')} onClick={() => updateStatus(t.id, 'IN_PROGRESS')}>▶ Start</button>}
              {t.status === 'IN_PROGRESS' && <button style={btn('#00ff7f')} onClick={() => updateStatus(t.id, 'COMPLETE')}>✓ Done</button>}
              {t.status === 'IN_PROGRESS' && <button style={btn('#ff5c5c')} onClick={() => updateStatus(t.id, 'BLOCKED')}>⛔ Block</button>}
            </div>
          ))}
        </div>
      )}

      {activeView === 'roadmap' && (
        <div style={st.panel}>
          <h2 style={{ color: '#2affe0', marginTop: 0 }}>Project Roadmap</h2>
          {milestones.length === 0 && <p style={{ color: '#555' }}>No milestones defined. Use the API to add milestones.</p>}
          {projects.map(proj => {
            const pMilestones = milestones.filter(m => m.project_id === proj.id)
            return (
              <div key={proj.id} style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                  <span style={{ fontWeight: 700, fontSize: '16px' }}>{proj.name}</span>
                  <span style={{ padding: '2px 10px', borderRadius: '12px', fontSize: '12px',
                    background: '#2affe022', color: '#2affe0', border: '1px solid #2affe055' }}>{proj.status}</span>
                </div>
                {pMilestones.length === 0 && <p style={{ color: '#444', fontSize: '13px', marginLeft: '12px' }}>No milestones.</p>}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginLeft: '12px' }}>
                  {pMilestones.map(m => (
                    <div key={m.id} onClick={() => !m.reached && reachMilestone(m.id)}
                      style={{ padding: '10px 16px', background: m.reached ? '#00ff7f11' : '#1a2133',
                        border: `1px solid ${m.reached ? '#00ff7f' : '#2a7fff55'}`,
                        borderRadius: '8px', cursor: m.reached ? 'default' : 'pointer', minWidth: '160px' }}>
                      <div style={{ fontWeight: 700, color: m.reached ? '#00ff7f' : '#fff', fontSize: '13px' }}>
                        {m.reached ? '✅' : '🏁'} {m.name}
                      </div>
                      <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
                        {new Date(m.target_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
