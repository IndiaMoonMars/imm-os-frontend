import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

/** Keeps one failing module from blanking the whole mission console. */
export default class ModuleBoundary extends Component<{ name: string; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`IMM-OS module "${this.props.name}" crashed`, error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="hud-panel module-fault">
        <AlertTriangle size={22} />
        <div>
          <strong>{this.props.name} module fault</strong>
          <p>{this.state.error.message}</p>
          <button className="preset" onClick={() => this.setState({ error: null })}>Restart module</button>
        </div>
      </div>
    )
  }
}
