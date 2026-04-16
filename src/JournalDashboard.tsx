import { useState, useEffect, useRef } from 'react'

const API = '/comms'
const CREW_ID = 'EV1'

interface JournalEntry {
  id: number
  title: string
  body: string
  media_type: string
  mission_day: number
  tags: string[]
  created_at: string
  media_path?: string
}

export default function JournalDashboard() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [form, setForm] = useState({ title: '', body: '', tags: '', media_type: 'text' })
  const [view, setView] = useState<'timeline'|'write'|'voice'>('timeline')
  const [status, setStatus] = useState('')
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const fetchEntries = async () => {
    const r = await fetch(`${API}/api/v1/journal/entries/${CREW_ID}?requester_role=author`)
    if (r.ok) setEntries(await r.json())
  }

  useEffect(() => { fetchEntries() }, [])

  const submitJournal = async () => {
    setStatus('Saving entry...')
    const r = await fetch(`${API}/api/v1/journal/entry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author_id: CREW_ID,
        title: form.title,
        body: form.body,
        media_type: form.media_type,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean)
      })
    })
    if (r.ok) {
      setStatus('✓ Journal entry saved.')
      setForm({ title: '', body: '', tags: '', media_type: 'text' })
      fetchEntries()
      setView('timeline')
    } else {
      setStatus('✗ Failed to save entry')
    }
  }

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mr = new MediaRecorder(stream)
    chunksRef.current = []
    mr.ondataavailable = e => chunksRef.current.push(e.data)
    mr.onstop = () => setAudioBlob(new Blob(chunksRef.current, { type: 'audio/webm' }))
    mr.start()
    mediaRef.current = mr
    setRecording(true)
    setStatus('🔴 Recording...')
  }

  const stopRecording = () => {
    mediaRef.current?.stop()
    setRecording(false)
    setStatus('Recording stopped. Ready to upload.')
  }

  const uploadAudio = async () => {
    if (!audioBlob) return
    setStatus('Saving voice memo...')
    // First create the journal entry
    const r = await fetch(`${API}/api/v1/journal/entry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author_id: CREW_ID, title: form.title || 'Voice Memo', media_type: 'voice', tags: [] })
    })
    if (!r.ok) { setStatus('✗ Failed'); return }
    const { journal_id } = await r.json()
    // Upload media
    const fd = new FormData()
    fd.append('file', audioBlob, 'voice_memo.webm')
    const r2 = await fetch(`${API}/api/v1/journal/upload/${journal_id}`, { method: 'POST', body: fd })
    if (r2.ok) {
      setStatus('✓ Voice memo saved.')
      setAudioBlob(null)
      fetchEntries()
      setView('timeline')
    }
  }

  const s: Record<string, React.CSSProperties> = {
    wrap: { padding: '20px', color: '#e6f0ff', background: '#0d1117', minHeight: '100%', fontFamily: "'Inter', sans-serif" },
    panel: { background: '#1a2133', border: '1px solid #2a7fff33', borderRadius: '10px', padding: '18px', marginBottom: '18px' },
    input: { width: '100%', padding: '9px 12px', background: '#0d1117', color: '#e6f0ff', border: '1px solid #2a7fff55', borderRadius: '6px', marginBottom: '10px', boxSizing: 'border-box' as const },
    btn: (c = '#2a7fff'): React.CSSProperties => ({ padding: '9px 20px', background: c, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, marginRight: '8px' }),
  }

  const mediaIcon: Record<string, string> = { text: '📝', voice: '🎙', video: '📹' }

  return (
    <div style={s.wrap}>
      <h1 style={{ color: '#a855f7' }}>📓 Mission Journal</h1>
      {status && <div style={{ ...s.panel, color: 'lime', padding: '10px 16px' }}>{status}</div>}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
        <button style={s.btn(view === 'timeline' ? '#a855f7' : '#333')} onClick={() => setView('timeline')}>📅 Timeline</button>
        <button style={s.btn(view === 'write' ? '#a855f7' : '#333')} onClick={() => setView('write')}>📝 Write</button>
        <button style={s.btn(view === 'voice' ? '#a855f7' : '#333')} onClick={() => setView('voice')}>🎙 Voice</button>
      </div>

      {view === 'timeline' && (
        <div>
          {entries.length === 0 && <p style={{ color: '#555' }}>No journal entries yet.</p>}
          {entries.map(e => (
            <div key={e.id} style={s.panel}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '16px' }}>{mediaIcon[e.media_type] || '📄'} {e.title || 'Untitled'}</span>
                <span style={{ color: '#a855f7', fontSize: '13px' }}>Mission Day {e.mission_day}</span>
              </div>
              {e.body && e.body !== '[PRIVATE]' && (
                <p style={{ color: '#ccc', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{e.body}</p>
              )}
              {e.body === '[PRIVATE]' && <p style={{ color: '#555', fontStyle: 'italic' }}>[Private — flight surgeon access only]</p>}
              {e.tags?.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {e.tags.map(t => <span key={t} style={{ padding: '2px 10px', background: '#a855f722', color: '#a855f7', border: '1px solid #a855f755', borderRadius: '12px', fontSize: '12px' }}>{t}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {view === 'write' && (
        <div style={s.panel}>
          <h2 style={{ color: '#a855f7', marginTop: 0 }}>New Journal Entry</h2>
          <input style={s.input} placeholder="Title (optional)" value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })} />
          <textarea rows={8} style={s.input} placeholder="Write your mission log…" value={form.body}
            onChange={e => setForm({ ...form, body: e.target.value })} />
          <input style={s.input} placeholder="Tags (comma-separated)" value={form.tags}
            onChange={e => setForm({ ...form, tags: e.target.value })} />
          <button style={s.btn('#a855f7')} onClick={submitJournal}>SAVE ENTRY</button>
        </div>
      )}

      {view === 'voice' && (
        <div style={s.panel}>
          <h2 style={{ color: '#a855f7', marginTop: 0 }}>Voice Memo</h2>
          <input style={s.input} placeholder="Memo title (optional)" value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })} />
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            {!recording && !audioBlob && (
              <button style={s.btn('#ff5c5c')} onClick={startRecording}>🔴 Start Recording</button>
            )}
            {recording && (
              <button style={s.btn('#ffaa00')} onClick={stopRecording}>⏹ Stop Recording</button>
            )}
            {audioBlob && !recording && (
              <>
                <audio controls src={URL.createObjectURL(audioBlob)} style={{ flex: 1 }} />
                <button style={s.btn('#a855f7')} onClick={uploadAudio}>💾 Save</button>
                <button style={s.btn('#333')} onClick={() => setAudioBlob(null)}>🗑 Discard</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
