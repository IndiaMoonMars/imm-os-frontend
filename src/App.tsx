import { useState, useEffect } from 'react'
import './App.css'
import EvaDashboard from './EvaDashboard'
import CommsDashboard from './CommsDashboard'
import JournalDashboard from './JournalDashboard'
import BriefingDashboard from './BriefingDashboard'
import SchedulingDashboard from './SchedulingDashboard'
import ProcedureViewer from './ProcedureViewer'
import MedicalDashboard from './MedicalDashboard'
import PsychDashboard from './PsychDashboard'
import AiDashboard from './AiDashboard'

interface LightingState { brightness: number; kelvin: number }

type Tab = 'eclss' | 'eva' | 'comms' | 'journal' | 'briefing' | 'schedule' | 'procedures' | 'medical' | 'psych' | 'ai'

const TABS: { key: Tab; label: string }[] = [
  { key: 'eclss',      label: '🌿 ECLSS'       },
  { key: 'eva',        label: '⛑ EVA'          },
  { key: 'comms',      label: '📡 Comms'       },
  { key: 'journal',    label: '📓 Journal'     },
  { key: 'briefing',   label: '📋 Briefing'    },
  { key: 'schedule',   label: '🗓 Schedule'    },
  { key: 'procedures', label: '📑 Procedures'  },
  { key: 'medical',    label: '🏥 Medical'     },
  { key: 'psych',      label: '🧠 Psychology'  },
  { key: 'ai',         label: '🤖 AI & Autonomy' },
]

function App() {
  const [lighting,   setLighting]   = useState<Record<string, LightingState>>({})
  const [statusMsg,  setStatusMsg]  = useState('')
  const [activeTab,  setActiveTab]  = useState<Tab>('eclss')

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  const fetchEclssState = async () => {
    try {
      const res = await fetch('/eclss/api/v1/eclss/lighting')
      if (res.ok) setLighting(await res.json())
    } catch { setStatusMsg('Network Error: Could not reach ECLSS API') }
  }

  useEffect(() => {
    fetchEclssState()
    const iv = setInterval(fetchEclssState, 5000)
    return () => clearInterval(iv)
  }, [])

  const handleUpdate = async (zone: string, b: number, k: number) => {
    try {
      setStatusMsg(`Updating ${zone}...`)
      const res = await fetch(`/eclss/api/v1/eclss/lighting/${zone}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brightness: b, kelvin: k })
      })
      if (res.ok) { setStatusMsg(`Zone ${zone} updated.`); fetchEclssState() }
    } catch { setStatusMsg(`Failed to update ${zone}.`) }
  }

  return (
    <div style={{ background: '#0d1117', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
      {/* ── Global Tab Bar ── */}
      <div style={{ display: 'flex', background: '#1a1a2e', borderBottom: '2px solid #2a7fff22', overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '13px 20px', background: activeTab === tab.key ? '#0d1117' : 'transparent',
              color: activeTab === tab.key ? '#2a7fff' : '#666', border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: '12px', letterSpacing: '0.4px', whiteSpace: 'nowrap',
              borderBottom: activeTab === tab.key ? '3px solid #2a7fff' : '3px solid transparent',
              transition: 'color 0.15s, border-bottom-color 0.15s'
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'eclss' && (
        <div style={{ padding: '20px', color: 'white' }}>
          <h1 style={{ borderBottom: '2px solid #555', paddingBottom: '10px' }}>ECLSS Crew Control Dashboard</h1>
          <p style={{ color: 'lime', fontWeight: 'bold' }}>{statusMsg}</p>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {(Object.entries(lighting) as [string, LightingState][]).map(([zone, state]) => (
              <div key={zone} style={{ background: '#222', border: '1px solid #444', padding: '20px', borderRadius: '10px', minWidth: '300px' }}>
                <h2 style={{ textTransform: 'capitalize' }}>Zone: {zone}</h2>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block' }}>Brightness ({state.brightness}%)</label>
                  <input type="range" min="0" max="100" value={state.brightness}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdate(zone, +e.target.value, state.kelvin)} style={{ width: '100%' }} />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block' }}>Color Temp ({state.kelvin}K)</label>
                  <input type="range" min="2000" max="6500" value={state.kelvin}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdate(zone, state.brightness, +e.target.value)} style={{ width: '100%' }} />
                </div>
                <div style={{ padding: '10px', background: '#000', textAlign: 'center', borderRadius: '5px' }}>
                  <button onClick={() => handleUpdate(zone, 100, 5000)} style={{ background: '#333', color: '#fff', padding: '10px', margin: '5px', border: 'none', cursor: 'pointer' }}>Daylight</button>
                  <button onClick={() => handleUpdate(zone, 30, 2500)} style={{ background: '#333', color: '#fff', padding: '10px', margin: '5px', border: 'none', cursor: 'pointer' }}>Evening</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {activeTab === 'eva'        && <EvaDashboard />}
      {activeTab === 'comms'      && <CommsDashboard />}
      {activeTab === 'journal'    && <JournalDashboard />}
      {activeTab === 'briefing'   && <BriefingDashboard />}
      {activeTab === 'schedule'   && <SchedulingDashboard />}
      {activeTab === 'procedures' && <ProcedureViewer />}
      {activeTab === 'medical'    && <MedicalDashboard />}
      {activeTab === 'psych'      && <PsychDashboard />}
      {activeTab === 'ai'         && <AiDashboard />}
    </div>
  )
}

export default App
