import { useState, useEffect } from 'react'
import './App.css'
import EvaDashboard from './EvaDashboard'
import CommsDashboard from './CommsDashboard'
import JournalDashboard from './JournalDashboard'
import BriefingDashboard from './BriefingDashboard'

interface LightingState {
  brightness: number
  kelvin: number
}

type Tab = 'eclss' | 'eva' | 'comms' | 'journal' | 'briefing'

const TABS: { key: Tab; label: string }[] = [
  { key: 'eclss',    label: '🌿 ECLSS'     },
  { key: 'eva',      label: '⛑ EVA'        },
  { key: 'comms',    label: '📡 Comms'     },
  { key: 'journal',  label: '📓 Journal'   },
  { key: 'briefing', label: '📋 Briefing'  },
]

function App() {
  const [lighting, setLighting] = useState<Record<string, LightingState>>({})
  const [statusMsg, setStatusMsg] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('eclss')

  // Register Web Push service worker for notifications
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js').catch(() => {/* ok in dev */})
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

  const handleUpdate = async (zone: string, newBrightness: number, newKelvin: number) => {
    try {
      setStatusMsg(`Transmitting lighting override to ${zone}...`)
      const res = await fetch(`/eclss/api/v1/eclss/lighting/${zone}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brightness: newBrightness, kelvin: newKelvin })
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
              padding: '14px 24px', background: activeTab === tab.key ? '#0d1117' : 'transparent',
              color: activeTab === tab.key ? '#2a7fff' : '#777', border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: '13px', letterSpacing: '0.5px', whiteSpace: 'nowrap',
              borderBottom: activeTab === tab.key ? '3px solid #2a7fff' : '3px solid transparent',
              transition: 'all 0.15s'
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      {activeTab === 'eclss' && (
        <div style={{ padding: '20px', color: 'white' }}>
          <h1 style={{ borderBottom: '2px solid #555', paddingBottom: '10px' }}>ECLSS Crew Control Dashboard</h1>
          <p style={{ color: 'lime', fontWeight: 'bold' }}>{statusMsg}</p>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {Object.entries(lighting).map(([zone, state]) => (
              <div key={zone} style={{ background: '#222', border: '1px solid #444', padding: '20px', borderRadius: '10px', minWidth: '300px' }}>
                <h2 style={{ textTransform: 'capitalize' }}>Zone: {zone}</h2>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block' }}>Brightness ({state.brightness}%)</label>
                  <input type="range" min="0" max="100" value={state.brightness}
                    onChange={e => handleUpdate(zone, parseInt(e.target.value), state.kelvin)}
                    style={{ width: '100%' }} />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block' }}>Color Temp ({state.kelvin}K)</label>
                  <input type="range" min="2000" max="6500" value={state.kelvin}
                    onChange={e => handleUpdate(zone, state.brightness, parseInt(e.target.value))}
                    style={{ width: '100%' }} />
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
      {activeTab === 'eva'      && <EvaDashboard />}
      {activeTab === 'comms'    && <CommsDashboard />}
      {activeTab === 'journal'  && <JournalDashboard />}
      {activeTab === 'briefing' && <BriefingDashboard />}
    </div>
  )
}

export default App
