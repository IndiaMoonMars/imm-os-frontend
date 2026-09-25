import { useState, useEffect, useRef, useCallback } from 'react'
import { authFetch, currentUser } from './auth'

const API = '/inventory'
const CREW_ID = currentUser()

type PhysicalState = 'solid' | 'liquid' | 'gas'
const UNITS: Record<PhysicalState, string[]> = { solid: ['units', 'kg', 'g'], liquid: ['mL', 'L'], gas: ['bar', 'kPa'] }

interface CheckoutInfo { crew_id: string; activity: string; checked_out_at: string }
interface Item {
  id: number; barcode: string; name: string; category: string | null; physical_state: PhysicalState; unit: string
  quantity: number; min_quantity: number; location: string | null; is_tool: boolean; low_stock: boolean
  checked_out: CheckoutInfo | null
}
interface Checkout {
  id: number; item_name: string; barcode: string; crew_id: string; activity: string
  checked_out_at: string; checked_in_at: string | null; duration_seconds: number | null
}
interface Incident {
  id: number; occurred_at: string; zone: string; severity: number; description: string
  immediate_action: string | null; reported_by: string; has_photo: boolean
}
interface RepairPartOut { name: string; barcode: string; quantity: number; unit: string }
interface Repair {
  id: number; item_description: string; repair_minutes: number; technician: string; signature: string
  notes: string | null; created_at: string; parts: RepairPartOut[]
}
interface ApiError { detail?: string | { msg: string }[] }

type Tab = 'stock' | 'scan' | 'tools' | 'incidents' | 'repairs'

const SEVERITY_COLORS = ['', '#2affe0', '#00ff7f', '#ffaa00', '#ff8c42', '#ff5c5c']

async function errorText(r: Response): Promise<string> {
  try {
    const d: ApiError = await r.json()
    if (typeof d.detail === 'string') return d.detail
    if (Array.isArray(d.detail)) return d.detail.map(e => e.msg).join('; ')
  } catch { /* not JSON */ }
  return `HTTP ${r.status}`
}

function minutesSince(iso: string): number {
  return Math.round((Date.now() - new Date(iso).getTime()) / 60000)
}

export default function InventoryDashboard() {
  const [tab, setTab] = useState<Tab>('stock')
  const [status, setStatus] = useState('')

  // Stock
  const [items, setItems] = useState<Item[]>([])
  const [search, setSearch] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [itemForm, setItemForm] = useState({
    barcode: '', name: '', category: 'spare', physical_state: 'solid' as PhysicalState, unit: 'units',
    quantity: '0', min_quantity: '0', location: '', is_tool: false,
  })

  // Scan
  const [scanCode, setScanCode] = useState('')
  const [scanned, setScanned] = useState<Item | null>(null)
  const [activity, setActivity] = useState('')
  const scanRef = useRef<HTMLInputElement>(null)

  // Tools / incidents / repairs
  const [checkouts, setCheckouts] = useState<Checkout[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [incidentForm, setIncidentForm] = useState({ zone: 'lab', severity: '3', description: '', immediate_action: '' })
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoUrls, setPhotoUrls] = useState<Record<number, string>>({})
  const [repairs, setRepairs] = useState<Repair[]>([])
  const [repairForm, setRepairForm] = useState({ item_description: '', repair_minutes: '30', signature: '', notes: '' })
  const [parts, setParts] = useState<{ barcode: string; quantity: string }[]>([{ barcode: '', quantity: '1' }])

  const fetchItems = useCallback(async () => {
    const qs = new URLSearchParams()
    if (search) qs.set('q', search)
    if (lowOnly) qs.set('low_stock', 'true')
    const r = await authFetch(`${API}/api/v1/inventory/items?${qs}`)
    if (r.ok) setItems(await r.json())
  }, [search, lowOnly])

  const fetchOthers = useCallback(async () => {
    const [c, i, rp] = await Promise.all([
      authFetch(`${API}/api/v1/inventory/checkouts?limit=50`),
      authFetch(`${API}/api/v1/incidents?limit=50`),
      authFetch(`${API}/api/v1/repairs?limit=50`),
    ])
    if (c.ok) setCheckouts(await c.json())
    if (i.ok) setIncidents(await i.json())
    if (rp.ok) setRepairs(await rp.json())
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])
  useEffect(() => { fetchOthers() }, [fetchOthers])
  useEffect(() => { if (tab === 'scan') scanRef.current?.focus() }, [tab])

  const addItem = async () => {
    const r = await authFetch(`${API}/api/v1/inventory/items`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...itemForm, quantity: +itemForm.quantity, min_quantity: +itemForm.min_quantity,
        location: itemForm.location || null }),
    })
    if (r.ok) {
      setStatus(`✓ Added ${itemForm.name}`)
      setItemForm({ ...itemForm, barcode: '', name: '', quantity: '0' })
      fetchItems()
    } else setStatus(`✗ ${await errorText(r)}`)
  }

  const adjust = async (item: Item, sign: 1 | -1) => {
    const amount = window.prompt(`${sign > 0 ? 'Add' : 'Remove'} how many ${item.unit} of ${item.name}?`, '1')
    if (!amount) return
    const reason = window.prompt('Reason', sign > 0 ? 'restock' : 'used') || (sign > 0 ? 'restock' : 'used')
    const r = await authFetch(`${API}/api/v1/inventory/items/${item.id}/adjust`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta: sign * +amount, reason }),
    })
    setStatus(r.ok ? `✓ ${item.name} updated` : `✗ ${await errorText(r)}`)
    fetchItems()
  }

  const doScan = async (code: string) => {
    if (!code.trim()) return
    const t0 = performance.now()
    const r = await authFetch(`${API}/api/v1/inventory/scan/${encodeURIComponent(code.trim())}`)
    const ms = Math.round(performance.now() - t0)
    if (r.ok) { setScanned(await r.json()); setStatus(`✓ Found in ${ms} ms`) }
    else { setScanned(null); setStatus(`✗ ${await errorText(r)}`) }
    setScanCode('')
  }

  const toolAction = async (action: 'checkout' | 'checkin') => {
    if (!scanned) return
    const body = action === 'checkout' ? { barcode: scanned.barcode, activity } : { barcode: scanned.barcode }
    const r = await authFetch(`${API}/api/v1/inventory/${action}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (r.ok) {
      setStatus(action === 'checkout' ? `✓ ${scanned.name} checked out to ${CREW_ID}` : `✓ ${scanned.name} checked in`)
      doScan(scanned.barcode)
      fetchOthers()
    } else setStatus(`✗ ${await errorText(r)}`)
  }

  const reportIncident = async () => {
    const fd = new FormData()
    Object.entries(incidentForm).forEach(([k, v]) => { if (v) fd.append(k, v) })
    if (photo) fd.append('photo', photo)
    const r = await authFetch(`${API}/api/v1/incidents`, { method: 'POST', body: fd })
    if (r.ok) {
      setStatus('✓ Incident reported')
      setIncidentForm({ ...incidentForm, description: '', immediate_action: '' })
      setPhoto(null)
      fetchOthers()
    } else setStatus(`✗ ${await errorText(r)}`)
  }

  // Photos need the auth header, so fetch them as blobs instead of <img src=...>
  const showPhoto = async (id: number) => {
    const r = await authFetch(`${API}/api/v1/incidents/${id}/photo`)
    if (r.ok) {
      const url = URL.createObjectURL(await r.blob())
      setPhotoUrls(p => ({ ...p, [id]: url }))
    } else setStatus(`✗ ${await errorText(r)}`)
  }

  const logRepair = async () => {
    const usedParts = parts.filter(p => p.barcode.trim()).map(p => ({ barcode: p.barcode.trim(), quantity: +p.quantity }))
    const r = await authFetch(`${API}/api/v1/repairs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...repairForm, repair_minutes: +repairForm.repair_minutes,
        notes: repairForm.notes || null, parts: usedParts }),
    })
    if (r.ok) {
      setStatus('✓ Repair logged; parts deducted from stock')
      setRepairForm({ item_description: '', repair_minutes: '30', signature: '', notes: '' })
      setParts([{ barcode: '', quantity: '1' }])
      fetchOthers(); fetchItems()
    } else setStatus(`✗ ${await errorText(r)}`)
  }

  const st = {
    wrap: { padding: '20px', color: '#e6f0ff', background: '#0d1117', minHeight: '100%', fontFamily: "'Inter', sans-serif" } as React.CSSProperties,
    panel: { background: '#1a2133', border: '1px solid #2a7fff33', borderRadius: '10px', padding: '18px', marginBottom: '18px' } as React.CSSProperties,
    input: { width: '100%', padding: '8px 12px', background: '#0d1117', color: '#e6f0ff', border: '1px solid #2a7fff55', borderRadius: '6px', marginBottom: '8px', boxSizing: 'border-box' as const } as React.CSSProperties,
    row: { display: 'flex', gap: '8px' } as React.CSSProperties,
    td: { padding: '6px 8px', borderBottom: '1px solid #222', fontSize: '13px' } as React.CSSProperties,
  }
  const btn = (c = '#2a7fff'): React.CSSProperties => ({ padding: '8px 18px', background: c, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, marginRight: '8px' })
  const small = (c = '#333'): React.CSSProperties => ({ ...btn(c), padding: '2px 10px', marginRight: '4px' })
  const openCheckouts = checkouts.filter(c => !c.checked_in_at)

  return (
    <div style={st.wrap}>
      <h1 style={{ color: '#ffaa00' }}>📦 Inventory</h1>
      <div style={{ marginBottom: '16px' }}>
        {([['stock', '📋 Stock'], ['scan', '🔎 Scan'], ['tools', `🔧 Tools (${openCheckouts.length} out)`], ['incidents', '⚠️ Incidents'], ['repairs', '🛠 Repairs']] as [Tab, string][]).map(([key, label]) => (
          <button key={key} style={btn(tab === key ? '#ffaa00' : '#333')} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>
      {status && <div style={{ marginBottom: '12px', color: status.startsWith('✗') ? '#ff5c5c' : '#00ff7f' }}>{status}</div>}

      {tab === 'stock' && (
        <>
          <div style={st.panel}>
            <div style={st.row}>
              <input style={st.input} placeholder="Search name or barcode" value={search} onChange={e => setSearch(e.target.value)} />
              <label style={{ whiteSpace: 'nowrap', paddingTop: '8px' }}>
                <input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} /> Low stock only
              </label>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ color: '#888', textAlign: 'left' }}>
                <th style={st.td}>Barcode</th><th style={st.td}>Item</th><th style={st.td}>Stock</th>
                <th style={st.td}>Location</th><th style={st.td}>Status</th><th style={st.td}></th>
              </tr></thead>
              <tbody>
                {items.map(i => (
                  <tr key={i.id}>
                    <td style={{ ...st.td, fontFamily: 'monospace' }}>{i.barcode}</td>
                    <td style={st.td}>{i.name}{i.is_tool && ' 🔧'} <span style={{ color: '#666' }}>{i.category}</span></td>
                    <td style={{ ...st.td, color: i.low_stock ? '#ff5c5c' : '#e6f0ff', fontWeight: 700 }}>{i.quantity} {i.unit}</td>
                    <td style={st.td}>{i.location ?? '—'}</td>
                    <td style={st.td}>
                      {i.low_stock && <span style={{ color: '#ff5c5c' }}>⚠ low </span>}
                      {i.checked_out && <span style={{ color: '#ffaa00' }}>out: {i.checked_out.crew_id}</span>}
                    </td>
                    <td style={st.td}>
                      <button style={small('#00a86b')} onClick={() => adjust(i, 1)}>+</button>
                      <button style={small('#b33')} onClick={() => adjust(i, -1)}>−</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && <p style={{ color: '#555' }}>No items.</p>}
          </div>
          <div style={st.panel}>
            <h3 style={{ marginTop: 0 }}>Add item</h3>
            <div style={st.row}>
              <input style={st.input} placeholder="Barcode (scan or type)" value={itemForm.barcode} onChange={e => setItemForm({ ...itemForm, barcode: e.target.value })} />
              <input style={st.input} placeholder="Name" value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} />
            </div>
            <div style={st.row}>
              <select style={st.input} value={itemForm.physical_state}
                onChange={e => { const s = e.target.value as PhysicalState; setItemForm({ ...itemForm, physical_state: s, unit: UNITS[s][0] }) }}>
                <option value="solid">Solid</option><option value="liquid">Liquid</option><option value="gas">Gas</option>
              </select>
              <select style={st.input} value={itemForm.unit} onChange={e => setItemForm({ ...itemForm, unit: e.target.value })}>
                {UNITS[itemForm.physical_state].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <input style={st.input} type="number" min="0" placeholder="Quantity" value={itemForm.quantity} onChange={e => setItemForm({ ...itemForm, quantity: e.target.value })} />
              <input style={st.input} type="number" min="0" placeholder="Low-stock level" value={itemForm.min_quantity} onChange={e => setItemForm({ ...itemForm, min_quantity: e.target.value })} />
            </div>
            <div style={st.row}>
              <input style={st.input} placeholder="Category (spare, consumable, tool…)" value={itemForm.category} onChange={e => setItemForm({ ...itemForm, category: e.target.value })} />
              <input style={st.input} placeholder="Location" value={itemForm.location} onChange={e => setItemForm({ ...itemForm, location: e.target.value })} />
              <label style={{ whiteSpace: 'nowrap', paddingTop: '8px' }}>
                <input type="checkbox" checked={itemForm.is_tool} onChange={e => setItemForm({ ...itemForm, is_tool: e.target.checked })} /> Tool
              </label>
            </div>
            <button style={btn()} onClick={addItem}>Add item</button>
          </div>
        </>
      )}

      {tab === 'scan' && (
        <div style={st.panel}>
          <p style={{ color: '#aaa', marginTop: 0 }}>Scan a barcode (USB scanners type into this box) or type it and press Enter.</p>
          <input ref={scanRef} style={{ ...st.input, fontSize: '20px', fontFamily: 'monospace' }} placeholder="Barcode…"
            value={scanCode} onChange={e => setScanCode(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') doScan(scanCode) }} />
          {scanned && (
            <div style={{ marginTop: '12px' }}>
              <h2 style={{ margin: '0 0 6px' }}>{scanned.name}</h2>
              <div style={{ fontSize: '28px', fontWeight: 900, color: scanned.low_stock ? '#ff5c5c' : '#00ff7f' }}>
                {scanned.quantity} {scanned.unit}{scanned.low_stock && ' ⚠ low'}
              </div>
              <div style={{ color: '#aaa', margin: '6px 0 12px' }}>{scanned.location ?? 'no location'} · {scanned.physical_state} · {scanned.barcode}</div>
              {scanned.is_tool && (scanned.checked_out ? (
                <>
                  <div style={{ color: '#ffaa00', marginBottom: '8px' }}>
                    Out to {scanned.checked_out.crew_id} for {scanned.checked_out.activity} ({minutesSince(scanned.checked_out.checked_out_at)} min)
                  </div>
                  <button style={btn('#00a86b')} onClick={() => toolAction('checkin')}>Check in</button>
                </>
              ) : (
                <div style={st.row}>
                  <input style={st.input} placeholder="Activity (e.g. EVA-03)" value={activity} onChange={e => setActivity(e.target.value)} />
                  <button style={btn()} disabled={!activity} onClick={() => toolAction('checkout')}>Check out to me</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'tools' && (
        <div style={st.panel}>
          <h3 style={{ marginTop: 0 }}>Checked out now</h3>
          {openCheckouts.length === 0 && <p style={{ color: '#555' }}>All tools are in.</p>}
          {openCheckouts.map(c => (
            <div key={c.id} style={{ padding: '6px 0', borderBottom: '1px solid #222' }}>
              🔧 <b>{c.item_name}</b> → {c.crew_id} · {c.activity} · {minutesSince(c.checked_out_at)} min
            </div>
          ))}
          <h3>Recent returns</h3>
          {checkouts.filter(c => c.checked_in_at).slice(0, 20).map(c => (
            <div key={c.id} style={{ padding: '4px 0', color: '#aaa', fontSize: '13px' }}>
              {c.item_name} · {c.crew_id} · {c.activity} · {((c.duration_seconds ?? 0) / 60).toFixed(1)} min
            </div>
          ))}
        </div>
      )}

      {tab === 'incidents' && (
        <>
          <div style={st.panel}>
            <h3 style={{ marginTop: 0 }}>Report incident</h3>
            <div style={st.row}>
              <input style={st.input} placeholder="Zone" value={incidentForm.zone} onChange={e => setIncidentForm({ ...incidentForm, zone: e.target.value })} />
              <select style={st.input} value={incidentForm.severity} onChange={e => setIncidentForm({ ...incidentForm, severity: e.target.value })}>
                {[1, 2, 3, 4, 5].map(s => <option key={s} value={s}>Severity {s}</option>)}
              </select>
            </div>
            <textarea style={st.input} rows={3} placeholder="What happened?" value={incidentForm.description} onChange={e => setIncidentForm({ ...incidentForm, description: e.target.value })} />
            <textarea style={st.input} rows={2} placeholder="Immediate action taken" value={incidentForm.immediate_action} onChange={e => setIncidentForm({ ...incidentForm, immediate_action: e.target.value })} />
            <input style={st.input} type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setPhoto(e.target.files?.[0] ?? null)} />
            <button style={btn('#ff5c5c')} disabled={!incidentForm.description} onClick={reportIncident}>Report</button>
          </div>
          <div style={st.panel}>
            {incidents.map(i => (
              <div key={i.id} style={{ padding: '8px 0', borderBottom: '1px solid #222' }}>
                <span style={{ color: SEVERITY_COLORS[i.severity], fontWeight: 700 }}>SEV {i.severity}</span> · {i.zone} · {new Date(i.occurred_at).toLocaleString()} · {i.reported_by}
                <div>{i.description}</div>
                {i.immediate_action && <div style={{ color: '#aaa' }}>Action: {i.immediate_action}</div>}
                {i.has_photo && !photoUrls[i.id] && <button style={small()} onClick={() => showPhoto(i.id)}>View photo</button>}
                {photoUrls[i.id] && <img src={photoUrls[i.id]} alt={`Incident ${i.id}`} style={{ maxWidth: '320px', marginTop: '6px', borderRadius: '6px' }} />}
              </div>
            ))}
            {incidents.length === 0 && <p style={{ color: '#555' }}>No incidents reported.</p>}
          </div>
        </>
      )}

      {tab === 'repairs' && (
        <>
          <div style={st.panel}>
            <h3 style={{ marginTop: 0 }}>Log repair</h3>
            <input style={st.input} placeholder="Item repaired" value={repairForm.item_description} onChange={e => setRepairForm({ ...repairForm, item_description: e.target.value })} />
            <div style={{ color: '#aaa', margin: '4px 0' }}>Parts used (deducted from stock)</div>
            {parts.map((p, idx) => (
              <div key={idx} style={st.row}>
                <input style={st.input} placeholder="Part barcode" value={p.barcode}
                  onChange={e => setParts(parts.map((x, j) => j === idx ? { ...x, barcode: e.target.value } : x))} />
                <input style={{ ...st.input, width: '120px' }} type="number" min="0" step="any" value={p.quantity}
                  onChange={e => setParts(parts.map((x, j) => j === idx ? { ...x, quantity: e.target.value } : x))} />
              </div>
            ))}
            <button style={small()} onClick={() => setParts([...parts, { barcode: '', quantity: '1' }])}>+ part</button>
            <div style={{ ...st.row, marginTop: '8px' }}>
              <input style={st.input} type="number" min="0" placeholder="Repair minutes" value={repairForm.repair_minutes} onChange={e => setRepairForm({ ...repairForm, repair_minutes: e.target.value })} />
              <input style={st.input} placeholder={`Signature (type your name, ${CREW_ID})`} value={repairForm.signature} onChange={e => setRepairForm({ ...repairForm, signature: e.target.value })} />
            </div>
            <textarea style={st.input} rows={2} placeholder="Notes" value={repairForm.notes} onChange={e => setRepairForm({ ...repairForm, notes: e.target.value })} />
            <button style={btn()} disabled={!repairForm.item_description || !repairForm.signature} onClick={logRepair}>Log repair</button>
          </div>
          <div style={st.panel}>
            {repairs.map(r => (
              <div key={r.id} style={{ padding: '8px 0', borderBottom: '1px solid #222' }}>
                <b>{r.item_description}</b> · {r.repair_minutes} min · {r.technician} (signed “{r.signature}”) · {new Date(r.created_at).toLocaleString()}
                {r.parts.length > 0 && <div style={{ color: '#aaa', fontSize: '13px' }}>Parts: {r.parts.map(p => `${p.quantity} ${p.unit} ${p.name}`).join(', ')}</div>}
              </div>
            ))}
            {repairs.length === 0 && <p style={{ color: '#555' }}>No repairs logged.</p>}
          </div>
        </>
      )}
    </div>
  )
}
