import { useState, useEffect, useRef } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const API = '/medical'
const CREW_ID = 'EV1'

interface Reading { id: number; reading_type: string; value: number; unit: string; device: string; recorded_at: string }
interface FoodEntry { id: number; meal_name: string; meal_type: string; calories: number; protein_g: number; carb_g: number; fat_g: number; logged_at: string }
interface FoodTotals { cal: number; prot: number; carb: number; fat: number }
interface MedItem { id: number; drug_name: string; dose_mg: number; dose_unit: string; frequency: string; stock_count: number; expiry_date: string; days_until_expiry: number; expiry_flag: string; last_taken_at: string }
interface Questionnaire { id: number; name: string; description: string }
interface WorkoutEntry { id: number; exercise_type: string; duration_min: number; intensity: string; avg_hr: number; calories_burned: number; started_at: string }
interface FoodItem { id: number; name: string; calories: number; protein_g: number; carb_g: number; fat_g: number; category: string }

type Tab = 'vitals' | 'food' | 'meds' | 'questionnaire' | 'workout'

const READING_ICONS: Record<string, string> = {
  hr: '❤️', bp_sys: '🩸', bp_dia: '🩸', spo2: '💨', glucose: '🍬', ecg_bpm: '⚡', temp: '🌡️', weight: '⚖️'
}
const MACRO_COLORS = ['#2a7fff','#00ff7f','#ffaa00']

export default function MedicalDashboard() {
  const [tab, setTab] = useState<Tab>('vitals')
  const [readings, setReadings] = useState<Reading[]>([])
  const [foodLog, setFoodLog] = useState<FoodEntry[]>([])
  const [foodTotals, setFoodTotals] = useState<FoodTotals>({ cal: 0, prot: 0, carb: 0, fat: 0 })
  const [meds, setMeds] = useState<MedItem[]>([])
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([])
  const [activeQuestionnaire, setActiveQuestionnaire] = useState<any>(null)
  const [qResponses, setQResponses] = useState<Record<string, number>>({})
  const [qResult, setQResult] = useState<any>(null)
  const [workouts, setWorkouts] = useState<WorkoutEntry[]>([])
  const [weekReport, setWeekReport] = useState<any>(null)
  const [foodSearch, setFoodSearch] = useState('')
  const [foodItems, setFoodItems] = useState<FoodItem[]>([])
  const [status, setStatus] = useState('')

  // Reading form
  const [readingForm, setReadingForm] = useState({ reading_type: 'hr', value: '', unit: 'bpm', device: 'manual', notes: '' })
  // Food form
  const [foodForm, setFoodForm] = useState({ food_item_id: 0, meal_name: '', meal_type: 'meal', quantity_g: 100 })
  // Workout form
  const [wkForm, setWkForm] = useState({ exercise_type: 'run', duration_min: 30, intensity: 'moderate', avg_hr: '', calories_burned: '' })
  // Medication form
  const [medForm, setMedForm] = useState({ drug_name: '', dose_mg: '', frequency: '', stock_count: 10, expiry_date: '' })

  const fetchAll = async () => {
    const [rd, fl, md, qt, wk, wr] = await Promise.allSettled([
      fetch(`${API}/api/v1/medical/readings/${CREW_ID}?requester_id=${CREW_ID}`).then(r => r.json()),
      fetch(`${API}/api/v1/medical/food-log/${CREW_ID}`).then(r => r.json()),
      fetch(`${API}/api/v1/medical/medications/${CREW_ID}`).then(r => r.json()),
      fetch(`${API}/api/v1/medical/questionnaires`).then(r => r.json()),
      fetch(`${API}/api/v1/medical/workouts/${CREW_ID}`).then(r => r.json()),
      fetch(`${API}/api/v1/medical/week-report/${CREW_ID}`).then(r => r.json()),
    ])
    if (rd.status === 'fulfilled') setReadings(rd.value)
    if (fl.status === 'fulfilled') {
      setFoodLog(fl.value.entries || [])
      const t = fl.value.daily_totals || {}
      setFoodTotals({ cal: +t.cal || 0, prot: +t.prot || 0, carb: +t.carb || 0, fat: +t.fat || 0 })
    }
    if (md.status === 'fulfilled') setMeds(md.value)
    if (qt.status === 'fulfilled') setQuestionnaires(qt.value)
    if (wk.status === 'fulfilled') setWorkouts(wk.value.entries || [])
    if (wr.status === 'fulfilled') setWeekReport(wr.value)
  }

  useEffect(() => { fetchAll(); const iv = setInterval(fetchAll, 20000); return () => clearInterval(iv) }, [])

  useEffect(() => {
    if (!foodSearch) { setFoodItems([]); return }
    fetch(`${API}/api/v1/medical/foods?q=${foodSearch}`).then(r => r.json()).then(setFoodItems)
  }, [foodSearch])

  const submitReading = async () => {
    const r = await fetch(`${API}/api/v1/medical/reading`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crew_id: CREW_ID, ...readingForm, value: parseFloat(readingForm.value) })
    })
    if (r.ok) { setStatus('✓ Reading saved'); fetchAll() } else setStatus('✗ Failed')
  }

  const logFood = async () => {
    const r = await fetch(`${API}/api/v1/medical/food-log`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crew_id: CREW_ID, ...foodForm })
    })
    if (r.ok) { setStatus('✓ Meal logged'); setFoodSearch(''); setFoodItems([]); fetchAll() } else setStatus('✗ Failed')
  }

  const addMed = async () => {
    const r = await fetch(`${API}/api/v1/medical/medication`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crew_id: CREW_ID, ...medForm, dose_mg: parseFloat(medForm.dose_mg as any), stock_count: +medForm.stock_count })
    })
    if (r.ok) { setStatus('✓ Medication added'); fetchAll() } else setStatus('✗ Failed')
  }

  const logWorkout = async () => {
    const r = await fetch(`${API}/api/v1/medical/workout`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crew_id: CREW_ID, ...wkForm, avg_hr: wkForm.avg_hr ? +wkForm.avg_hr : null, calories_burned: wkForm.calories_burned ? +wkForm.calories_burned : null })
    })
    if (r.ok) { setStatus('✓ Workout logged'); fetchAll() } else setStatus('✗ Failed')
  }

  const loadQuestionnaire = async (id: number) => {
    const r = await fetch(`${API}/api/v1/medical/questionnaire/${id}`)
    const data = await r.json()
    const q = { ...data, questions: typeof data.questions === 'string' ? JSON.parse(data.questions) : data.questions }
    setActiveQuestionnaire(q)
    const init: Record<string, number> = {}
    q.questions.forEach((q: any) => { init[q.id] = Math.floor((q.scale_min + q.scale_max) / 2) })
    setQResponses(init)
    setQResult(null)
  }

  const submitQuestionnaire = async () => {
    const r = await fetch(`${API}/api/v1/medical/questionnaire/submit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crew_id: CREW_ID, template_id: activeQuestionnaire.id, responses: qResponses })
    })
    const data = await r.json()
    setQResult(data)
    setActiveQuestionnaire(null)
  }

  const st = {
    wrap: { padding: '20px', color: '#e6f0ff', background: '#0d1117', minHeight: '100%', fontFamily: "'Inter', sans-serif" } as React.CSSProperties,
    panel: { background: '#1a2133', border: '1px solid #2a7fff33', borderRadius: '10px', padding: '18px', marginBottom: '18px' } as React.CSSProperties,
    input: { width: '100%', padding: '8px 12px', background: '#0d1117', color: '#e6f0ff', border: '1px solid #2a7fff55', borderRadius: '6px', marginBottom: '8px', boxSizing: 'border-box' as const } as React.CSSProperties,
  }
  const btn = (c = '#2a7fff'): React.CSSProperties => ({ padding: '8px 18px', background: c, color: c === '#fff' ? '#000' : '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, marginRight: '8px' })

  const hrData = readings.filter(r => r.reading_type === 'hr').slice(0, 20).reverse().map((r, i) => ({ i: i + 1, bpm: r.value }))
  const macroPie = [
    { name: 'Protein', value: foodTotals.prot },
    { name: 'Carbs', value: foodTotals.carb },
    { name: 'Fat', value: foodTotals.fat },
  ]

  return (
    <div style={st.wrap}>
      <h1 style={{ color: '#ff5c5c' }}>🏥 Medical & Health</h1>
      {status && <div style={{ ...st.panel, color: 'lime', padding: '10px 16px' }}>{status}</div>}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {[['vitals','❤️ Vitals'],['food','🍛 Food'],['meds','💊 Meds'],['questionnaire','📋 Questionnaires'],['workout','💪 Workout']] .map(([key, label]) => (
          <button key={key} style={btn(tab === key ? '#ff5c5c' : '#333')} onClick={() => setTab(key as Tab)}>{label}</button>
        ))}
      </div>

      {/* ── VITALS ── */}
      {tab === 'vitals' && (
        <>
          {/* Quick log form */}
          <div style={st.panel}>
            <h3 style={{ marginTop: 0, color: '#ff5c5c' }}>Log Biometric Reading</h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select style={{ ...st.input, width: 'auto', marginBottom: 0 }} value={readingForm.reading_type}
                onChange={e => setReadingForm({ ...readingForm, reading_type: e.target.value, unit: e.target.value === 'hr' ? 'bpm' : e.target.value === 'spo2' ? '%' : e.target.value === 'glucose' ? 'mg/dL' : e.target.value.includes('bp') ? 'mmHg' : e.target.value === 'temp' ? '°C' : e.target.value === 'weight' ? 'kg' : 'bpm' })}>
                {['hr','bp_sys','bp_dia','spo2','glucose','temp','weight'].map(t => <option key={t} value={t}>{READING_ICONS[t]} {t}</option>)}
              </select>
              <input style={{ ...st.input, width: '100px', marginBottom: 0 }} placeholder="Value" value={readingForm.value}
                onChange={e => setReadingForm({ ...readingForm, value: e.target.value })} type="number" />
              <input style={{ ...st.input, width: '80px', marginBottom: 0 }} placeholder="Unit" value={readingForm.unit}
                onChange={e => setReadingForm({ ...readingForm, unit: e.target.value })} />
              <select style={{ ...st.input, width: 'auto', marginBottom: 0 }} value={readingForm.device}
                onChange={e => setReadingForm({ ...readingForm, device: e.target.value })}>
                {['manual','ble_cuff','pulse_ox','glucometer','ecg_patch'].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <button style={btn('#ff5c5c')} onClick={submitReading}>LOG</button>
            </div>
          </div>

          {/* Last readings grid */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
            {['hr','spo2','bp_sys','glucose','temp','weight'].map(type => {
              const last = readings.find(r => r.reading_type === type)
              return (
                <div key={type} style={{ ...st.panel, minWidth: '130px', flex: 1, textAlign: 'center', marginBottom: 0 }}>
                  <div style={{ fontSize: '24px' }}>{READING_ICONS[type]}</div>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: '#ff5c5c' }}>{last ? last.value : '—'}</div>
                  <div style={{ color: '#aaa', fontSize: '12px' }}>{last?.unit || type}</div>
                  <div style={{ color: '#555', fontSize: '10px' }}>{last?.device || ''}</div>
                </div>
              )
            })}
          </div>

          {/* HR trend chart */}
          {hrData.length > 1 && (
            <div style={st.panel}>
              <div style={{ color: '#ff5c5c', fontWeight: 700, marginBottom: '8px' }}>❤️ Heart Rate Trend</div>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={hrData}>
                  <XAxis dataKey="i" hide />
                  <YAxis domain={['auto','auto']} />
                  <Tooltip />
                  <Line type="monotone" dataKey="bpm" stroke="#ff5c5c" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* ── FOOD ── */}
      {tab === 'food' && (
        <>
          <div style={st.panel}>
            <h3 style={{ marginTop: 0, color: '#00ff7f' }}>Log Meal</h3>
            <input style={st.input} placeholder="Search food database…" value={foodSearch}
              onChange={e => setFoodSearch(e.target.value)} />
            {foodItems.length > 0 && (
              <div style={{ background: '#111', borderRadius: '6px', maxHeight: '200px', overflowY: 'auto', marginBottom: '8px' }}>
                {foodItems.map(f => (
                  <div key={f.id} onClick={() => { setFoodForm({ ...foodForm, food_item_id: f.id, meal_name: f.name }); setFoodSearch(f.name); setFoodItems([]) }}
                    style={{ padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{f.name}</span>
                    <span style={{ color: '#aaa', fontSize: '12px' }}>{f.calories}kcal / 100g</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input style={{ ...st.input, width: '80px', marginBottom: 0 }} type="number" placeholder="g" value={foodForm.quantity_g}
                onChange={e => setFoodForm({ ...foodForm, quantity_g: +e.target.value })} />
              <select style={{ ...st.input, width: 'auto', marginBottom: 0 }} value={foodForm.meal_type}
                onChange={e => setFoodForm({ ...foodForm, meal_type: e.target.value })}>
                {['breakfast','lunch','dinner','snack'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <button style={btn('#00ff7f')} onClick={logFood}>LOG MEAL</button>
            </div>
          </div>

          {/* Daily totals + macro pie */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '18px' }}>
            <div style={{ ...st.panel, flex: 1, minWidth: '200px' }}>
              <div style={{ color: '#00ff7f', fontWeight: 700, marginBottom: '10px' }}>Today's Totals</div>
              <div style={{ fontSize: '36px', fontWeight: 900, color: '#2affe0' }}>{Math.round(foodTotals.cal)} <span style={{ fontSize: '16px', color: '#aaa' }}>kcal</span></div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '10px' }}>
                {[['Protein', foodTotals.prot, '#2a7fff'],['Carbs', foodTotals.carb, '#00ff7f'],['Fat', foodTotals.fat, '#ffaa00']].map(([name, val, c]) => (
                  <div key={name as string} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: c as string }}>{Math.round(val as number)}g</div>
                    <div style={{ color: '#aaa', fontSize: '12px' }}>{name}</div>
                  </div>
                ))}
              </div>
            </div>
            {(foodTotals.prot + foodTotals.carb + foodTotals.fat) > 0 && (
              <div style={{ ...st.panel, flex: 1, minWidth: '200px' }}>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={macroPie} dataKey="value" cx="50%" cy="50%" outerRadius={60}>
                      {macroPie.map((_, i) => <Cell key={i} fill={MACRO_COLORS[i]} />)}
                    </Pie>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Food log entries */}
          <div style={st.panel}>
            <div style={{ color: '#aaa', fontWeight: 700, marginBottom: '10px' }}>Today's Food Log</div>
            {foodLog.length === 0 && <p style={{ color: '#555' }}>No meals logged today.</p>}
            {foodLog.map(f => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #222' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{f.meal_name}</div>
                  <div style={{ color: '#555', fontSize: '12px' }}>{f.meal_type}</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '13px' }}>
                  <div style={{ fontWeight: 700, color: '#2affe0' }}>{f.calories} kcal</div>
                  <div style={{ color: '#666' }}>P:{f.protein_g}g C:{f.carb_g}g F:{f.fat_g}g</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── MEDICATIONS ── */}
      {tab === 'meds' && (
        <>
          <div style={st.panel}>
            <h3 style={{ marginTop: 0, color: '#a855f7' }}>Add Medication</h3>
            <input style={st.input} placeholder="Drug name" value={medForm.drug_name} onChange={e => setMedForm({ ...medForm, drug_name: e.target.value })} />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input style={{ ...st.input, flex: 1, marginBottom: 0 }} placeholder="Dose mg" value={medForm.dose_mg} onChange={e => setMedForm({ ...medForm, dose_mg: e.target.value })} type="number" />
              <input style={{ ...st.input, flex: 2, marginBottom: 0 }} placeholder="Frequency (e.g. once daily)" value={medForm.frequency} onChange={e => setMedForm({ ...medForm, frequency: e.target.value })} />
              <input style={{ ...st.input, flex: 1, marginBottom: 0 }} placeholder="Stock count" value={medForm.stock_count} onChange={e => setMedForm({ ...medForm, stock_count: +e.target.value })} type="number" />
              <input type="date" style={{ ...st.input, flex: 1, marginBottom: 0 }} value={medForm.expiry_date} onChange={e => setMedForm({ ...medForm, expiry_date: e.target.value })} />
              <button style={btn('#a855f7')} onClick={addMed}>ADD</button>
            </div>
          </div>
          {meds.map(m => (
            <div key={m.id} style={{ ...st.panel, border: `1px solid ${m.expiry_flag === 'expired' ? '#ff5c5c' : m.expiry_flag === 'warning' ? '#ffaa0066' : '#2a7fff33'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '16px' }}>💊 {m.drug_name}</div>
                  <div style={{ color: '#aaa', fontSize: '13px' }}>{m.dose_mg}{m.dose_unit} · {m.frequency} · Stock: {m.stock_count}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {m.expiry_date && (
                    <div style={{ color: m.expiry_flag === 'expired' ? '#ff5c5c' : m.expiry_flag === 'warning' ? '#ffaa00' : '#00ff7f', fontWeight: 700, fontSize: '13px' }}>
                      {m.expiry_flag === 'expired' ? '❌ EXPIRED' : m.expiry_flag === 'warning' ? `⚠️ ${m.days_until_expiry}d left` : `✓ ${m.days_until_expiry}d`}
                    </div>
                  )}
                  <button style={{ ...btn('#2a7fff'), marginTop: '6px', padding: '4px 12px', fontSize: '12px' }}
                    onClick={async () => { await fetch(`${API}/api/v1/medical/medication/${m.id}/taken`, { method: 'PATCH' }); fetchAll() }}>
                    Take Dose
                  </button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {/* ── QUESTIONNAIRES ── */}
      {tab === 'questionnaire' && (
        <>
          {qResult && (
            <div style={{ ...st.panel, border: '2px solid #00ff7f' }}>
              <h3 style={{ color: '#00ff7f', marginTop: 0 }}>✅ Questionnaire Complete</h3>
              <div style={{ fontSize: '28px', fontWeight: 900 }}>Score: {qResult.total_score}</div>
              {qResult.flagged && <div style={{ color: '#ff5c5c', fontWeight: 700, marginTop: '8px' }}>⚠️ Score above threshold — flagged for flight surgeon review</div>}
              <button style={{ ...btn(), marginTop: '12px' }} onClick={() => setQResult(null)}>Done</button>
            </div>
          )}
          {activeQuestionnaire ? (
            <div style={st.panel}>
              <h2 style={{ color: '#ff5c5c', marginTop: 0 }}>{activeQuestionnaire.name}</h2>
              <p style={{ color: '#aaa' }}>{activeQuestionnaire.description}</p>
              {activeQuestionnaire.questions.map((q: any) => (
                <div key={q.id} style={{ marginBottom: '18px' }}>
                  <div style={{ marginBottom: '6px', fontSize: '14px' }}>{q.text}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#666', fontSize: '12px' }}>{q.scale_min}</span>
                    <input type="range" min={q.scale_min} max={q.scale_max} value={qResponses[q.id] ?? q.scale_min}
                      onChange={e => setQResponses({ ...qResponses, [q.id]: +e.target.value })}
                      style={{ flex: 1, accentColor: '#ff5c5c' }} />
                    <span style={{ color: '#666', fontSize: '12px' }}>{q.scale_max}</span>
                    <span style={{ color: '#ff5c5c', fontWeight: 700, minWidth: '32px', textAlign: 'right' }}>{qResponses[q.id] ?? q.scale_min}</span>
                  </div>
                </div>
              ))}
              <button style={btn('#ff5c5c')} onClick={submitQuestionnaire}>SUBMIT</button>
              <button style={btn('#333')} onClick={() => setActiveQuestionnaire(null)}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              {questionnaires.map(q => (
                <div key={q.id} style={{ ...st.panel, minWidth: '260px', maxWidth: '340px' }}>
                  <div style={{ color: '#ff5c5c', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>QUESTIONNAIRE</div>
                  <div style={{ fontWeight: 700, fontSize: '17px', marginBottom: '6px' }}>{q.name}</div>
                  <div style={{ color: '#888', fontSize: '13px', marginBottom: '14px' }}>{q.description}</div>
                  <button style={btn('#ff5c5c')} onClick={() => loadQuestionnaire(q.id)}>Start</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── WORKOUT ── */}
      {tab === 'workout' && (
        <>
          <div style={st.panel}>
            <h3 style={{ marginTop: 0, color: '#2a7fff' }}>Log Workout</h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select style={{ ...st.input, width: 'auto', marginBottom: 0 }} value={wkForm.exercise_type}
                onChange={e => setWkForm({ ...wkForm, exercise_type: e.target.value })}>
                {['run','walk','cycle','strength','yoga','swim','EVA simulation','treadmill','rowing','HIIT'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input style={{ ...st.input, width: '80px', marginBottom: 0 }} type="number" placeholder="mins" value={wkForm.duration_min}
                onChange={e => setWkForm({ ...wkForm, duration_min: +e.target.value })} />
              <select style={{ ...st.input, width: 'auto', marginBottom: 0 }} value={wkForm.intensity}
                onChange={e => setWkForm({ ...wkForm, intensity: e.target.value })}>
                {['light','moderate','high','max'].map(i => <option key={i} value={i}>{i}</option>)}
              </select>
              <input style={{ ...st.input, width: '80px', marginBottom: 0 }} type="number" placeholder="Avg HR" value={wkForm.avg_hr}
                onChange={e => setWkForm({ ...wkForm, avg_hr: e.target.value })} />
              <input style={{ ...st.input, width: '80px', marginBottom: 0 }} type="number" placeholder="Kcal" value={wkForm.calories_burned}
                onChange={e => setWkForm({ ...wkForm, calories_burned: e.target.value })} />
              <button style={btn('#2a7fff')} onClick={logWorkout}>LOG</button>
            </div>
          </div>

          {weekReport && (
            <div style={st.panel}>
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#aaa', fontSize: '12px' }}>THIS WEEK</div>
                  <div style={{ fontSize: '32px', fontWeight: 900, color: weekReport.compliance_pct >= 60 ? '#00ff7f' : '#ff5c5c' }}>
                    {weekReport.week_workouts}/{weekReport.target}
                  </div>
                  <div style={{ color: '#aaa', fontSize: '12px' }}>sessions</div>
                </div>
                <div style={{ flex: 1, background: '#0d1117', borderRadius: '6px', height: '12px', overflow: 'hidden' }}>
                  <div style={{ width: `${weekReport.compliance_pct}%`, height: '100%', background: weekReport.compliance_pct >= 60 ? '#00ff7f' : '#ff5c5c', transition: 'width 0.5s' }} />
                </div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#2affe0' }}>{weekReport.compliance_pct}%</div>
              </div>
            </div>
          )}

          {workouts.map(w => (
            <div key={w.id} style={{ ...st.panel, marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>🏃 {w.exercise_type}</div>
                <div style={{ color: '#aaa', fontSize: '13px' }}>{w.duration_min}min · {w.intensity}</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '13px' }}>
                {w.avg_hr && <div style={{ color: '#ff5c5c' }}>❤️ {w.avg_hr} bpm</div>}
                {w.calories_burned && <div style={{ color: '#ffaa00' }}>🔥 {w.calories_burned} kcal</div>}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
