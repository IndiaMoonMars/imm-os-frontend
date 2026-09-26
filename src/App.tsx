import { useEffect, useState, type ComponentType } from 'react'
import './App.css'
import Shell from './components/Shell'
import TabHero from './components/TabHero'
import ModuleBoundary from './components/ModuleBoundary'
import OverviewDashboard from './OverviewDashboard'
import EclssDashboard from './EclssDashboard'
import EvaDashboard from './EvaDashboard'
import CommsDashboard from './CommsDashboard'
import JournalDashboard from './JournalDashboard'
import BriefingDashboard from './BriefingDashboard'
import SchedulingDashboard from './SchedulingDashboard'
import ProcedureViewer from './ProcedureViewer'
import MedicalDashboard from './MedicalDashboard'
import PsychDashboard from './PsychDashboard'
import AiDashboard from './AiDashboard'
import InventoryDashboard from './InventoryDashboard'
import SensorsDashboard from './SensorsDashboard'
import { TABS, tabByKey, type TabKey } from './theme/tabs'

// Existing module dashboards, shown under the tab's hero banner
const MODULES: Partial<Record<TabKey, ComponentType>> = {
  eva: EvaDashboard,
  comms: CommsDashboard,
  journal: JournalDashboard,
  briefing: BriefingDashboard,
  schedule: SchedulingDashboard,
  procedures: ProcedureViewer,
  medical: MedicalDashboard,
  psych: PsychDashboard,
  inventory: InventoryDashboard,
  ai: AiDashboard,
}

const fromHash = (): TabKey => {
  const k = window.location.hash.replace('#', '') as TabKey
  return TABS.some(t => t.key === k) ? k : 'overview'
}

function App() {
  const [active, setActive] = useState<TabKey>(fromHash)

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
    const onHash = () => setActive(fromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const select = (k: TabKey) => { window.location.hash = k; setActive(k) }
  const Module = MODULES[active]

  return (
    <Shell active={active} onSelect={select}>
      {active === 'overview' && <ModuleBoundary name="Overview"><OverviewDashboard onNavigate={select} /></ModuleBoundary>}
      {active === 'sensors' && <ModuleBoundary name="Sensors"><SensorsDashboard /></ModuleBoundary>}
      {active === 'eclss' && <ModuleBoundary name="Life Support"><EclssDashboard /></ModuleBoundary>}
      {Module && (
        <div className="tab-body">
          <TabHero tab={tabByKey(active)} />
          <div className="module-surface">
            <ModuleBoundary name={tabByKey(active).label}><Module /></ModuleBoundary>
          </div>
        </div>
      )}
    </Shell>
  )
}

export default App
