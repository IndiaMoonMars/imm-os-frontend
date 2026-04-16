import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, Legend } from 'recharts'

const API = '/psych'
const CREW_ID = 'EV1'

interface SleepEntry { id: number; duration_min: number; quality_score: number; source: string; mission_day: number; sleep_onset: string; wake_time: string }
interface MoodEntry { id: number; period: string; score: number; note: string; mission_day: number; checked_at: string }
interface Survey { id: number; name: string; description: string; schedule_days: number }
interface TrendPoint { day: number; score?: number; hours?: number; quality?: number }

type Tab = 'sleep' | 'mood' | 'surveys' | 'sociogram' | 'trends'

const MOOD_EMOJI = ['', '😔', '😟', '😐', '😊', '😄']
const MOOD_LABELS = ['', 'Very Low', 'Low', 'Neutral', 'Good', 'Excellent']
const MOOD_COLORS = ['', '#ff5c5c', '#ff8c42', '#ffaa00', '#2affe0', '#00ff7f']
const CREW_MEMBERS = ['EV1', 'EV2', 'EV3', 'CDR']

export default function PsychDashboard() {
  const [tab, setTab] = useState<Tab>('sleep')
  const [sleepLog, setSleepLog] = useState<SleepEntry[]>([])
  const [sleep7dayAvg, setSleep7dayAvg] = useState(0)
  const [moodLog, setMoodLog] = useState<MoodEntry[]>([])
  const [mood7dayAvg, setMood7dayAvg] = useState(0)
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [activeSurvey, setActiveSurvey] = useState<any>(null)
  const [sResponses, setSResponses] = useState<Record<string, number>>({})
  const [sResult, setSResult] = useState<any>(null)
  const [sociRatings, setSociRatings] = useState<any[]>([])
  const [sociForm, setSociForm] = useState<Record<string, number>>({})
  const [trends, setTrends] = useState<any>(null)
  const [status, setStatus] = useState('')

  // Sleep form
  const [sleepForm, setSleepForm] = useState({ sleep_onset: '', wake_time: '', quality_score: 3, source: 'manual', awakenings: 0 })
  // Mood form
  const [moodForm, setMoodForm] = useState({ period: 'morning', score: 3, note: '' })

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [sl, mo, sv, so, tr] = await Promise.allSettled([
      fetch(`${API}/api/v1/psych/sleep/${CREW_ID}?days=30`).then(r => r.json()),
      fetch(`${API}/api/v1/psych/mood/${CREW_ID}?days=30`).then(r => r.json()),
      fetch(`${API}/api/v1/psych/surveys`).then(r => r.json()),
      fetch(`${API}/api/v1/psych/sociogram/my-ratings/${CREW_ID}`).then(r => r.json()),
      fetch(`${API}/api/v1/psych/trends/${CREW_ID}?requester_id=${CREW_ID}`).then(r => r.json()),
    ])
    if (sl.status === 'fulfilled') { setSleepLog(sl.value.entries || []); setSleep7dayAvg(sl.value['7day_avg_hours'] || 0) }
    if (mo.status === 'fulfilled') { setMoodLog(mo.value.entries || []); setMood7dayAvg(mo.value['7day_avg'] || 0) }
    if (sv.status === 'fulfilled') setSurveys(sv.value)
    if (so.status === 'fulfilled') setSociRatings(so.value)
    if (tr.status === 'fulfilled') setTrends(tr.value)
  }

  const logSleep = async () => {
    const r = await fetch(`${API}/api/v1/psych/sleep`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crew_id: CREW_ID, ...sleepForm })
    })
    if (r.ok) { const d = await r.json(); setStatus(`✓ Sleep logged: ${d.duration_h}h`); fetchAll() } else setStatus('✗ Failed')
  }

  const logMood = async () => {
    const r = await fetch(`${API}/api/v1/psych/mood`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crew_id: CREW_ID, ...moodForm })
    })
    if (r.ok) { setStatus('✓ Mood logged'); fetchAll() } else setStatus('✗ Failed')
  }

  const loadSurvey = async (id: number) => {
    const r = await fetch(`${API}/api/v1/psych/survey/${id}`)
    const data = await r.json()
    const q = { ...data, questions: typeof data.questions === 'string' ? JSON.parse(data.questions) : data.questions }
    setActiveSurvey(q)
    const init: Record<string, number> = {}
    q.questions.forEach((q: any) => { init[q.id] = Math.ceil((q.scale_min + q.scale_max) / 2) })
    setSResponses(init)
    setSResult(null)
  }

  const submitSurvey = async () => {
    const r = await fetch(`${API}/api/v1/psych/survey/submit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crew_id: CREW_ID, template_id: activeSurvey.id, responses: sResponses })
    })
    const d = await r.json()
    setSResult(d)
    setActiveSurvey(null)
  }

  const submitSociogram = async () => {
    let ok = true
    for (const [ratee_id, score] of Object.entries(sociForm)) {
      if (ratee_id === CREW_ID) continue
      const r = await fetch(`${API}/api/v1/psych/sociogram`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rater_id: CREW_ID, ratee_id, comfort_score: score })
      })
      if (!r.ok) ok = false
    }
    if (ok) { setStatus('✓ Sociogram ratings saved (private)'); fetchAll() } else setStatus('✗ Some failed')
  }

  const st = {
    wrap: { padding: '20px', color: '#e6f0ff', background: '#0d1117', minHeight: '100%', fontFamily: "'Inter', sans-serif" } as React.CSSProperties,
    panel: { background: '#1a2133', border: '1px solid #2a7fff33', borderRadius: '10px', padding: '18px', marginBottom: '18px' } as React.CSSProperties,
    input: { width: '100%', padding: '8px 12px', background: '#0d1117', color: '#e6f0ff', border: '1px solid #2a7fff55', borderRadius: '6px', marginBottom: '8px', boxSizing: 'border-box' as const } as React.CSSProperties,
  }
  const btn = (c = '#a855f7'): React.CSSProperties => ({ padding: '8px 18px', background: c, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, marginRight: '8px' })

  const sleepChartData = sleepLog.slice(0, 30).reverse().map(s => ({ day: s.mission_day, hours: +(s.duration_min / 60).toFixed(2), quality: s.quality_score || 0 }))
  const moodChartData = (trends?.mood_trend || []).slice(-30)

  return (
    <div style={st.wrap}>
      <h1 style={{ color: '#a855f7' }}>🧠 Psychology & Wellbeing</h1>
      {status && <div style={{ ...st.panel, color: 'lime', padding: '10px 16px' }}>{status}</div>}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {[['sleep','💤 Sleep'],['mood','😊 Mood'],['surveys','📋 Surveys'],['sociogram','🕸 Sociogram'],['trends','📈 Trends']].map(([key, label]) => (
          <button key={key} style={btn(tab === key ? '#a855f7' : '#333')} onClick={() => setTab(key as Tab)}>{label}</button>
        ))}
      </div>

      {/* ── SLEEP ── */}
      {tab === 'sleep' && (
        <>
          {/* Summary card */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '18px' }}>
            <div style={{ ...st.panel, flex: 1, textAlign: 'center', minWidth: '140px', marginBottom: 0 }}>
              <div style={{ fontSize: '13px', color: '#a855f7' }}>7-DAY AVG</div>
              <div style={{ fontSize: '42px', fontWeight: 900, color: sleep7dayAvg >= 6 ? '#00ff7f' : sleep7dayAvg >= 4 ? '#ffaa00' : '#ff5c5c' }}>{sleep7dayAvg}h</div>
              <div style={{ fontSize: '12px', color: '#aaa' }}>sleep / night</div>
            </div>
            <div style={{ ...st.panel, flex: 3, minWidth: '200px', marginBottom: 0 }}>
              <div style={{ color: '#a855f7', fontWeight: 700, marginBottom: '8px' }}>Log Sleep</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#aaa', fontSize: '12px' }}>Bedtime</label>
                  <input type="datetime-local" style={st.input} value={sleepForm.sleep_onset} onChange={e => setSleepForm({ ...sleepForm, sleep_onset: e.target.value })} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#aaa', fontSize: '12px' }}>Wake time</label>
                  <input type="datetime-local" style={st.input} value={sleepForm.wake_time} onChange={e => setSleepForm({ ...sleepForm, wake_time: e.target.value })} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#aaa', fontSize: '12px' }}>Quality 1–5</label>
                  <input type="range" min={1} max={5} value={sleepForm.quality_score} onChange={e => setSleepForm({ ...sleepForm, quality_score: +e.target.value })}
                    style={{ width: '100%', accentColor: '#a855f7' }} />
                  <div style={{ fontSize: '12px', color: '#aaa', textAlign: 'right' }}>{sleepForm.quality_score}/5</div>
                </div>
              </div>
              <button style={btn()} onClick={logSleep}>LOG SLEEP</button>
            </div>
          </div>

          {/* Sleep chart */}
          {sleepChartData.length > 1 && (
            <div style={st.panel}>
              <div style={{ color: '#a855f7', fontWeight: 700, marginBottom: '10px' }}>💤 Sleep Duration (hours)</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={sleepChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a3045" />
                  <XAxis dataKey="day" tick={{ fill: '#666', fontSize: 11 }} />
                  <YAxis domain={[0, 10]} tick={{ fill: '#666', fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="hours" fill="#a855f7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {/* Deprivation alert */}
              {sleepChartData.slice(-3).every(s => s.hours < 6) && (
                <div style={{ background: '#ff5c5c22', border: '1px solid #ff5c5c', borderRadius: '6px', padding: '10px', marginTop: '12px', color: '#ff5c5c', fontWeight: 700 }}>
                  ⚠️ Sleep deprivation detected: &lt;6h for 3 consecutive nights. Flight surgeon notified.
                </div>
              )}
            </div>
          )}

          {/* Recent records */}
          {sleepLog.slice(0, 5).map(s => (
            <div key={s.id} style={{ ...st.panel, display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div>
                <div style={{ fontWeight: 700 }}>💤 Day {s.mission_day}</div>
                <div style={{ color: '#aaa', fontSize: '12px' }}>{s.source}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: s.duration_min >= 360 ? '#00ff7f' : '#ff5c5c' }}>
                  {(s.duration_min / 60).toFixed(1)}h
                </div>
                {s.quality_score && <div style={{ color: '#a855f7', fontSize: '12px' }}>Quality: {s.quality_score}/5</div>}
              </div>
            </div>
          ))}
        </>
      )}

      {/* ── MOOD ── */}
      {tab === 'mood' && (
        <>
          {/* Check-in widget */}
          <div style={st.panel}>
            <h3 style={{ marginTop: 0, color: '#2affe0' }}>Daily Mood Check-in</h3>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              {[1, 2, 3, 4, 5].map(score => (
                <button key={score} onClick={() => setMoodForm({ ...moodForm, score })}
                  style={{ flex: 1, padding: '16px', background: moodForm.score === score ? MOOD_COLORS[score] + '33' : '#111',
                    border: `2px solid ${moodForm.score === score ? MOOD_COLORS[score] : '#333'}`,
                    borderRadius: '10px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' }}>
                  <div style={{ fontSize: '28px' }}>{MOOD_EMOJI[score]}</div>
                  <div style={{ fontSize: '11px', color: MOOD_COLORS[score], fontWeight: 700, marginTop: '4px' }}>{MOOD_LABELS[score]}</div>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select style={{ ...st.input, width: 'auto', marginBottom: 0 }} value={moodForm.period}
                onChange={e => setMoodForm({ ...moodForm, period: e.target.value })}>
                <option value="morning">🌅 Morning</option>
                <option value="evening">🌙 Evening</option>
              </select>
              <input style={{ ...st.input, flex: 1, marginBottom: 0 }} placeholder="Note (optional)" value={moodForm.note}
                onChange={e => setMoodForm({ ...moodForm, note: e.target.value })} />
              <button style={btn('#2affe0')} onClick={logMood}>CHECK IN</button>
            </div>
          </div>

          {/* 7-day average */}
          <div style={{ ...st.panel, textAlign: 'center' }}>
            <div style={{ color: '#aaa', fontSize: '12px' }}>7-DAY MOOD AVERAGE</div>
            <div style={{ fontSize: '48px' }}>{MOOD_EMOJI[Math.round(mood7dayAvg)] || '😐'}</div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: MOOD_COLORS[Math.round(mood7dayAvg)] || '#aaa' }}>{mood7dayAvg}/5</div>
          </div>

          {/* Mood chart */}
          {moodChartData.length > 1 && (
            <div style={st.panel}>
              <div style={{ color: '#2affe0', fontWeight: 700, marginBottom: '8px' }}>30-Day Mood Trend</div>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={moodChartData}>
                  <XAxis dataKey="day" tick={{ fill: '#666', fontSize: 11 }} />
                  <YAxis domain={[1, 5]} ticks={[1,2,3,4,5]} tick={{ fill: '#666', fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="#2affe0" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Recent check-ins */}
          {moodLog.slice(0, 6).map(m => (
            <div key={m.id} style={{ ...st.panel, display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '28px' }}>{MOOD_EMOJI[m.score]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: MOOD_COLORS[m.score] }}>{MOOD_LABELS[m.score]}</div>
                <div style={{ color: '#555', fontSize: '12px' }}>Day {m.mission_day} · {m.period}</div>
                {m.note && <div style={{ color: '#aaa', fontSize: '13px', marginTop: '4px' }}>{m.note}</div>}
              </div>
            </div>
          ))}
        </>
      )}

      {/* ── SURVEYS ── */}
      {tab === 'surveys' && (
        <>
          {sResult && (
            <div style={{ ...st.panel, border: '2px solid #00ff7f' }}>
              <h3 style={{ color: '#00ff7f', marginTop: 0 }}>✅ Survey Submitted</h3>
              <div style={{ fontSize: '24px', fontWeight: 900 }}>Score: {sResult.total_score}</div>
              {sResult.subscores && Object.keys(sResult.subscores).length > 0 && (
                <div style={{ marginTop: '10px' }}>
                  {Object.entries(sResult.subscores).map(([k, v]) => (
                    <div key={k} style={{ color: '#aaa', fontSize: '13px' }}>{k}: {v as number}</div>
                  ))}
                </div>
              )}
              {sResult.flagged && <div style={{ color: '#ff5c5c', fontWeight: 700, marginTop: '8px' }}>⚠️ Score flagged — flight surgeon will review</div>}
              <button style={{ ...btn(), marginTop: '12px' }} onClick={() => setSResult(null)}>Done</button>
            </div>
          )}

          {activeSurvey ? (
            <div style={st.panel}>
              <h2 style={{ color: '#a855f7', marginTop: 0 }}>{activeSurvey.name}</h2>
              <p style={{ color: '#aaa' }}>{activeSurvey.description}</p>
              {activeSurvey.questions.map((q: any) => (
                <div key={q.id} style={{ marginBottom: '16px' }}>
                  <div style={{ marginBottom: '6px', fontSize: '14px' }}>{q.text}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#555', fontSize: '11px' }}>{q.scale_min}</span>
                    <input type="range" min={q.scale_min} max={q.scale_max} value={sResponses[q.id] ?? q.scale_min}
                      onChange={e => setSResponses({ ...sResponses, [q.id]: +e.target.value })}
                      style={{ flex: 1, accentColor: '#a855f7' }} />
                    <span style={{ color: '#555', fontSize: '11px' }}>{q.scale_max}</span>
                    <span style={{ color: '#a855f7', fontWeight: 700, minWidth: '28px', textAlign: 'right' }}>{sResponses[q.id]}</span>
                  </div>
                </div>
              ))}
              <button style={btn()} onClick={submitSurvey}>SUBMIT</button>
              <button style={btn('#333')} onClick={() => setActiveSurvey(null)}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              {surveys.map(s => (
                <div key={s.id} style={{ ...st.panel, minWidth: '250px', maxWidth: '340px' }}>
                  <div style={{ color: '#a855f7', fontSize: '12px', fontWeight: 700 }}>Every {s.schedule_days} days</div>
                  <div style={{ fontWeight: 700, fontSize: '17px', margin: '6px 0' }}>{s.name}</div>
                  <div style={{ color: '#888', fontSize: '13px', marginBottom: '14px' }}>{s.description}</div>
                  <button style={btn()} onClick={() => loadSurvey(s.id)}>Start Survey</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── SOCIOGRAM ── */}
      {tab === 'sociogram' && (
        <>
          <div style={st.panel}>
            <h3 style={{ marginTop: 0, color: '#ffaa00' }}>🕸 Peer Comfort Ratings</h3>
            <p style={{ color: '#888', fontSize: '13px', margin: '0 0 16px' }}>
              Rate your comfort level with each crew member (1–5). These ratings are <strong style={{ color: '#ffaa00' }}>completely private</strong> — peers can never see how you rated them. Only the flight surgeon sees the aggregate.
            </p>
            {CREW_MEMBERS.filter(id => id !== CREW_ID).map(peer => (
              <div key={peer} style={{ marginBottom: '16px' }}>
                <div style={{ fontWeight: 700, marginBottom: '8px' }}>{peer}</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[1, 2, 3, 4, 5].map(score => (
                    <button key={score} onClick={() => setSociForm({ ...sociForm, [peer]: score })}
                      style={{ padding: '8px 12px', background: sociForm[peer] === score ? '#ffaa0033' : '#111',
                        border: `2px solid ${sociForm[peer] === score ? '#ffaa00' : '#333'}`,
                        borderRadius: '6px', cursor: 'pointer', color: '#fff', fontWeight: 700 }}>
                      {score}
                    </button>
                  ))}
                  <span style={{ color: '#555', lineHeight: '38px', fontSize: '12px', marginLeft: '8px' }}>
                    {sociForm[peer] === 1 ? 'Very uncomfortable' : sociForm[peer] === 2 ? 'Uncomfortable' : sociForm[peer] === 3 ? 'Neutral' : sociForm[peer] === 4 ? 'Comfortable' : sociForm[peer] === 5 ? 'Very comfortable' : 'Not rated'}
                  </span>
                </div>
              </div>
            ))}
            <button style={btn('#ffaa00')} onClick={submitSociogram}>SUBMIT RATINGS</button>
          </div>

          {/* My submitted outgoing ratings */}
          {sociRatings.length > 0 && (
            <div style={st.panel}>
              <div style={{ color: '#ffaa00', fontWeight: 700, marginBottom: '10px' }}>Your Submitted Ratings</div>
              {sociRatings.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #222' }}>
                  <span>{r.ratee_id}</span>
                  <span style={{ color: '#ffaa00', fontWeight: 700 }}>{'★'.repeat(r.comfort_score)}{'☆'.repeat(5 - r.comfort_score)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── TRENDS ── */}
      {tab === 'trends' && (
        <>
          {!trends && <p style={{ color: '#555' }}>No trend data yet. Complete mood check-ins and sleep logs to populate charts.</p>}
          {trends?.mood_trend?.length > 1 && (
            <div style={st.panel}>
              <div style={{ color: '#2affe0', fontWeight: 700, marginBottom: '10px' }}>😊 30-Day Mood Trend</div>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={trends.mood_trend}>
                  <XAxis dataKey="day" tick={{ fill: '#555', fontSize: 11 }} />
                  <YAxis domain={[1, 5]} ticks={[1,2,3,4,5]} tick={{ fill: '#555', fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="#2affe0" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {trends?.sleep_trend?.length > 1 && (
            <div style={st.panel}>
              <div style={{ color: '#a855f7', fontWeight: 700, marginBottom: '10px' }}>💤 30-Day Sleep Trend</div>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={trends.sleep_trend}>
                  <XAxis dataKey="day" tick={{ fill: '#555', fontSize: 11 }} />
                  <YAxis domain={[0, 10]} tick={{ fill: '#555', fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="hours" stroke="#a855f7" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {trends?.workload_trend?.length > 1 && (
            <div style={st.panel}>
              <div style={{ color: '#ffaa00', fontWeight: 700, marginBottom: '10px' }}>📊 Workload Score (NASA TLX)</div>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={trends.workload_trend}>
                  <XAxis dataKey="day" tick={{ fill: '#555', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#555', fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="#ffaa00" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}
