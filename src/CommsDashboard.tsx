import { useState, useEffect, useRef } from 'react'

const API = '/comms'

interface Message {
  id: number
  sender_id: string
  subject: string
  body: string
  deliver_at: string
  delivered: boolean
  mission_day: number
  thread_id: number
}

interface PendingMsg {
  id: number
  subject: string
  remaining_seconds: number
}

export default function CommsDashboard() {
  const [userId] = useState('astro-EV1')
  const [group,  setGroup]  = useState<'astro'|'mcc'>('mcc')
  const [inbox,  setInbox]  = useState<Message[]>([])
  const [pending, setPending] = useState<PendingMsg[]>([])
  const [compose, setCompose] = useState({ subject: '', body: '', recipient_group: 'mcc' })
  const [view, setView] = useState<'inbox'|'compose'>('inbox')
  const [status, setStatus] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchInbox = async () => {
    const r = await fetch(`${API}/api/v1/comms/inbox/${userId}?group=${group}`)
    if (r.ok) setInbox(await r.json())
  }

  const fetchPending = async () => {
    const r = await fetch(`${API}/api/v1/comms/pending/${userId}`)
    if (r.ok) setPending(await r.json())
  }

  useEffect(() => {
    fetchInbox()
    fetchPending()
    timerRef.current = setInterval(() => {
      fetchInbox()
      fetchPending()
    }, 3000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [group])

  const sendMessage = async () => {
    setStatus('Transmitting...')
    const r = await fetch(`${API}/api/v1/comms/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender_id: userId, ...compose })
    })
    if (r.ok) {
      const d = await r.json()
      const delayStr = d.delay_seconds > 0
        ? `⏱ Delay: ${Math.round(d.delay_seconds)}s`
        : '⚡ Zero-delay (crew↔crew)'
      setStatus(`✓ Message filed. ${delayStr}`)
      setCompose({ subject: '', body: '', recipient_group: 'mcc' })
      setView('inbox')
      fetchPending()
    } else {
      setStatus('✗ Transmission failed')
    }
  }

  const st = {
    wrap: { padding: '20px', color: '#e6f0ff', background: '#0d1117', minHeight: '100%', fontFamily: "'Inter', sans-serif" } as React.CSSProperties,
    panel: { background: '#1a2133', border: '1px solid #2a7fff33', borderRadius: '10px', padding: '18px', marginBottom: '18px' } as React.CSSProperties,
    input: { width: '100%', padding: '9px 12px', background: '#0d1117', color: '#e6f0ff', border: '1px solid #2a7fff55', borderRadius: '6px', marginBottom: '10px', boxSizing: 'border-box' as const, fontSize: '14px' } as React.CSSProperties,
  }
  const btn = (c = '#2a7fff'): React.CSSProperties => ({ padding: '9px 20px', background: c, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, marginRight: '8px' })
  const tag = (c: string): React.CSSProperties => ({ padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700, background: c + '22', color: c, border: `1px solid ${c}55` })

  const fmtCountdown = (s: number) => {
    if (s < 60) return `${s.toFixed(0)}s`
    return `${Math.floor(s/60)}m ${Math.round(s%60)}s`
  }

  return (
    <div style={st.wrap}>
      <h1 style={{ color: '#2a7fff' }}>📡 Crew Communications</h1>
      {status && <div style={{ ...st.panel, color: 'lime', padding: '10px 16px' }}>{status}</div>}

      {/* Outbox countdown HUD */}
      {pending.length > 0 && (
        <div style={st.panel}>
          <div style={{ color: '#ffaa00', fontWeight: 700, marginBottom: '8px' }}>⏱ OUTBOUND — COMM DELAY QUEUE</div>
          {pending.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #333' }}>
              <span style={{ color: '#ccc' }}>{p.subject || '(no subject)'}</span>
              <span style={{ color: '#ff5c5c', fontWeight: 700, fontFamily: 'monospace' }}>
                {p.remaining_seconds > 0 ? `🕐 ${fmtCountdown(p.remaining_seconds)} until delivered` : '✓ Delivered'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Tab nav */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
        <button style={btn(view === 'inbox' ? '#2a7fff' : '#333')} onClick={() => setView('inbox')}>📥 Inbox</button>
        <button style={btn(view === 'compose' ? '#2a7fff' : '#333')} onClick={() => setView('compose')}>✏️ Compose</button>
        <select value={group} onChange={e => setGroup(e.target.value as 'astro' | 'mcc')}
          style={{ ...st.input, width: 'auto', marginBottom: 0, marginLeft: 'auto' }}>
          <option value="mcc">MCC Inbox</option>
          <option value="astro">Astro Inbox</option>
        </select>
      </div>

      {view === 'inbox' && (
        <div style={st.panel}>
          <div style={{ color: '#aaa', fontWeight: 600, marginBottom: '12px' }}>
            {inbox.length} message{inbox.length !== 1 ? 's' : ''} delivered
          </div>
          {inbox.length === 0 && <p style={{ color: '#555' }}>No messages in inbox.</p>}
          {inbox.map(m => (
            <div key={m.id} style={{ borderBottom: '1px solid #2a3045', padding: '12px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontWeight: 700 }}>{m.subject || '(no subject)'}</span>
                <span style={tag('#2affe0')}>Mission Day {m.mission_day}</span>
              </div>
              <div style={{ color: '#aaa', fontSize: '13px', marginBottom: '6px' }}>
                From: <span style={{ color: '#5cbcff' }}>{m.sender_id}</span>
              </div>
              <div style={{ color: '#ddd', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.body}</div>
            </div>
          ))}
        </div>
      )}

      {view === 'compose' && (
        <div style={st.panel}>
          <h2 style={{ color: '#ffaa00', marginTop: 0 }}>New Message</h2>
          <label style={{ fontSize: '13px', color: '#aaa' }}>To</label>
          <select style={st.input} value={compose.recipient_group}
            onChange={e => setCompose({ ...compose, recipient_group: e.target.value })}>
            <option value="mcc">Mission Control Centre (MCC)</option>
            <option value="astro">Crew (All Astronauts)</option>
            <option value="all">All (Crew + MCC)</option>
          </select>
          <label style={{ fontSize: '13px', color: '#aaa' }}>Subject</label>
          <input style={st.input} value={compose.subject}
            onChange={e => setCompose({ ...compose, subject: e.target.value })} placeholder="Subject…" />
          <label style={{ fontSize: '13px', color: '#aaa' }}>Message</label>
          <textarea rows={6} style={st.input} value={compose.body}
            onChange={e => setCompose({ ...compose, body: e.target.value })} placeholder="Type your message…" />
          <button style={btn()} onClick={sendMessage}>TRANSMIT</button>
        </div>
      )}
    </div>
  )
}
