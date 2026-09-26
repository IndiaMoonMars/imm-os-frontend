import type { LucideIcon } from 'lucide-react'
import {
  Activity, Bot, BookOpen, Boxes, Brain, CalendarRange, ClipboardCheck, Footprints,
  Gauge, Leaf, Radio, RadioTower, ScrollText,
} from 'lucide-react'

export type TabKey =
  | 'overview' | 'sensors' | 'eclss' | 'eva' | 'comms' | 'journal' | 'briefing' | 'schedule'
  | 'procedures' | 'medical' | 'psych' | 'inventory' | 'ai'

export type HeroArt =
  | 'orbit' | 'airflow' | 'horizon' | 'signal' | 'constellation' | 'radar' | 'timeline'
  | 'checklist' | 'ecg' | 'brainwave' | 'barcode' | 'neural'

export interface TabDef {
  key: TabKey
  label: string
  title: string
  tagline: string
  group: 'Mission' | 'Habitat' | 'Crew' | 'Intelligence'
  icon: LucideIcon
  /** primary accent (hex) — drives the whole tab's look */
  accent: string
  /** secondary accent for gradients */
  accent2: string
  art: HeroArt
  code: string
}

export const TABS: TabDef[] = [
  { key: 'overview',   label: 'Overview',      title: 'Mission Overview',        tagline: 'Habitat vitals, power and node health at a glance',
    group: 'Mission', icon: Gauge, accent: '#ff7a3d', accent2: '#ffc26b', art: 'orbit', code: 'MSN-00' },
  { key: 'briefing',   label: 'Briefing',      title: 'Daily Mission Briefing',  tagline: 'Plan of the day, objectives and crew acknowledgements',
    group: 'Mission', icon: ScrollText, accent: '#60a5fa', accent2: '#a5d8ff', art: 'radar', code: 'MSN-01' },
  { key: 'schedule',   label: 'Schedule',      title: 'Scheduling & Roadmap',    tagline: 'Gantt, task board and milestone roadmap',
    group: 'Mission', icon: CalendarRange, accent: '#2dd4bf', accent2: '#99f6e4', art: 'timeline', code: 'MSN-02' },
  { key: 'procedures', label: 'Procedures',    title: 'Procedure Library',       tagline: 'Step-by-step runs with sign-off and abort paths',
    group: 'Mission', icon: ClipboardCheck, accent: '#a3e635', accent2: '#d9f99d', art: 'checklist', code: 'MSN-03' },

  { key: 'sensors',    label: 'Sensors',       title: 'Live Sensor Feed',        tagline: 'Every sensor on every node, in real time',
    group: 'Habitat', icon: RadioTower, accent: '#38bdf8', accent2: '#bae6fd', art: 'signal', code: 'HAB-00' },
  { key: 'eclss',      label: 'Life Support',  title: 'ECLSS · Life Support',    tagline: 'Atmosphere, climate and circadian lighting control',
    group: 'Habitat', icon: Leaf, accent: '#34d399', accent2: '#a7f3d0', art: 'airflow', code: 'HAB-01' },
  { key: 'inventory',  label: 'Inventory',     title: 'Inventory & Logistics',   tagline: 'Stock, barcode scanning, tools, incidents and repairs',
    group: 'Habitat', icon: Boxes, accent: '#fb923c', accent2: '#fed7aa', art: 'barcode', code: 'HAB-02' },
  { key: 'eva',        label: 'EVA',           title: 'EVA Mission Control',     tagline: 'Extravehicular activity planning, tools and go/no-go',
    group: 'Habitat', icon: Footprints, accent: '#fbbf24', accent2: '#fde68a', art: 'horizon', code: 'HAB-03' },

  { key: 'medical',    label: 'Medical',       title: 'Medical & Health',        tagline: 'Vitals, nutrition, medication and fitness',
    group: 'Crew', icon: Activity, accent: '#fb7185', accent2: '#fecdd3', art: 'ecg', code: 'CRW-01' },
  { key: 'psych',      label: 'Psychology',    title: 'Psychology & Wellbeing',  tagline: 'Sleep, mood, surveys and crew cohesion',
    group: 'Crew', icon: Brain, accent: '#a78bfa', accent2: '#ddd6fe', art: 'brainwave', code: 'CRW-02' },
  { key: 'journal',    label: 'Journal',       title: 'Mission Journal',         tagline: 'Written and voice logs for the mission record',
    group: 'Crew', icon: BookOpen, accent: '#e879f9', accent2: '#f5d0fe', art: 'constellation', code: 'CRW-03' },
  { key: 'comms',      label: 'Comms',         title: 'Crew Communications',     tagline: 'Earth ↔ habitat messaging with realistic signal delay',
    group: 'Crew', icon: Radio, accent: '#22d3ee', accent2: '#a5f3fc', art: 'signal', code: 'CRW-04' },

  { key: 'ai',         label: 'AI & Autonomy', title: 'ASTRA · AI & Autonomy',   tagline: 'Mission assistant, anomaly insights and autonomous actions',
    group: 'Intelligence', icon: Bot, accent: '#818cf8', accent2: '#c7d2fe', art: 'neural', code: 'INT-01' },
]

export const TAB_GROUPS: TabDef['group'][] = ['Mission', 'Habitat', 'Crew', 'Intelligence']

export const tabByKey = (k: TabKey): TabDef => TABS.find(t => t.key === k) ?? TABS[0]
