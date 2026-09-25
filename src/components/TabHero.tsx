import type { ReactNode } from 'react'
import type { TabDef } from '../theme/tabs'
import HeroArt from './HeroArt'

export default function TabHero({ tab, children }: { tab: TabDef; children?: ReactNode }) {
  const Icon = tab.icon
  return (
    <div className="tab-hero">
      <div className="tab-hero-text">
        <div className="tab-hero-code"><span className="code-dot" />{tab.code} · {tab.group.toUpperCase()}</div>
        <h1><Icon size={30} strokeWidth={1.6} className="tab-hero-icon" /><span className="hero-title">{tab.title}</span></h1>
        <p>{tab.tagline}</p>
        {children && <div className="tab-hero-extra">{children}</div>}
      </div>
      <HeroArt art={tab.art} />
    </div>
  )
}
