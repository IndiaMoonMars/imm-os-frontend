import { useState, useEffect } from 'react'
import './App.css'

interface LightingState {
  brightness: number;
  kelvin: number;
}

function App() {
  const [lighting, setLighting] = useState<Record<string, LightingState>>({});
  const [statusMsg, setStatusMsg] = useState("");

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
      setStatusMsg(`Transmitting lighting override to {zone}...`);
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

  return (
    <div className="container" style={{ padding: '20px', color: 'white', background: '#121212', minHeight: '100vh', fontFamily: 'sans-serif' }}>
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
  )
}

export default App
