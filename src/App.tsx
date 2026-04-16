import { useState, useEffect } from 'react'
import './App.css'
import EvaDashboard from './EvaDashboard'

interface LightingState {
  brightness: number;
  kelvin: number;
}

function App() {
  const [lighting, setLighting] = useState<Record<string, LightingState>>({});
  const [statusMsg, setStatusMsg] = useState("");
  const [activeTab, setActiveTab] = useState<'eclss' | 'eva'>('eclss');

  const fetchEclssState = async () => {
    try {
      const res = await fetch('/eclss/api/v1/eclss/lighting');
      if(res.ok) {
        const data = await res.json();
        setLighting(data);
      }
    } catch (e) {
      console.error(e);
      setStatusMsg("Network Error: Could not reach ECLSS API");
    }
  }

  useEffect(() => {
    fetchEclssState();
    const interval = setInterval(fetchEclssState, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdate = async (zone: string, newBrightness: number, newKelvin: number) => {
    try {
      setStatusMsg(`Transmitting lighting override to ${zone}...`);
      const res = await fetch(`/eclss/api/v1/eclss/lighting/${zone}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brightness: newBrightness, kelvin: newKelvin })
      });
      if(res.ok) {
        setStatusMsg(`Zone ${zone} updated successfully.`);
        fetchEclssState();
      }
    } catch(e) {
      setStatusMsg(`Failed to update ${zone}.`);
    }
  };

  const tabBar = (
    <div style={{ display: 'flex', background: '#1a1a2e', borderBottom: '2px solid #2a7fff33' }}>
      {(['eclss', 'eva'] as const).map(tab => (
        <button key={tab} onClick={() => setActiveTab(tab)}
          style={{
            padding: '14px 30px', background: activeTab === tab ? '#0d1117' : 'transparent',
            color: activeTab === tab ? '#2a7fff' : '#aaa', border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: '14px', letterSpacing: '1px', textTransform: 'uppercase',
            borderBottom: activeTab === tab ? '3px solid #2a7fff' : '3px solid transparent'
          }}>
          {tab === 'eclss' ? '🌿 ECLSS' : '⛑ EVA'}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ background: '#121212', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      {tabBar}

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
                    onChange={(e) => handleUpdate(zone, parseInt(e.target.value), state.kelvin)}
                    style={{ width: '100%' }} />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block' }}>Color Temp ({state.kelvin}K)</label>
                  <input type="range" min="2000" max="6500" value={state.kelvin}
                    onChange={(e) => handleUpdate(zone, state.brightness, parseInt(e.target.value))}
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

      {activeTab === 'eva' && <EvaDashboard />}
    </div>
  )
}

export default App
