import { useEffect, useRef, useState } from 'react'
import { keycloak } from '../auth'

export type LinkState = 'connecting' | 'live' | 'reconnecting'

/** One validated telemetry reading as broadcast by telemetry-ingest's /realtime socket. */
export interface RealtimeFrame {
  sensor: string
  timestamp: number            // Unix seconds, may have milliseconds
  node_id?: string
  zone?: string
  crew_id?: string
  simulated?: boolean
  [metric: string]: unknown
}

/** Unwrap a socket message into a telemetry frame, or null (EVA positions, junk). */
export function parseFrame(raw: string): RealtimeFrame | null {
  try {
    const msg = JSON.parse(raw)
    const data = msg && typeof msg === 'object' && 'data' in msg ? msg.data : msg
    if (!data || typeof data !== 'object' || typeof data.sensor !== 'string') return null
    const ts = Number(data.timestamp)
    return Number.isFinite(ts) ? { ...data, timestamp: ts } : null
  } catch {
    return null
  }
}

/**
 * Follow the realtime telemetry socket (/api/realtime). The first message must be the
 * Keycloak token (browsers can't set WebSocket headers); reconnects with backoff.
 */
export function useRealtime(onFrame: (f: RealtimeFrame) => void): LinkState {
  const [state, setState] = useState<LinkState>('connecting')
  const handler = useRef(onFrame)
  handler.current = onFrame

  useEffect(() => {
    let ws: WebSocket | null = null
    let retry = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let closed = false

    const connect = async () => {
      try { await keycloak.updateToken(30) } catch { /* the socket will be refused; retry later */ }
      if (closed) return
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      ws = new WebSocket(`${proto}://${window.location.host}/api/realtime`)
      ws.onopen = () => {
        ws?.send(JSON.stringify({ type: 'auth', token: keycloak.token }))
        retry = 0
        setState('live')
      }
      ws.onmessage = ev => {
        const f = parseFrame(String(ev.data))
        if (f) handler.current(f)
      }
      ws.onclose = () => {
        if (closed) return
        setState('reconnecting')
        timer = setTimeout(connect, Math.min(15000, 1000 * 2 ** retry++))
      }
      ws.onerror = () => ws?.close()
    }
    connect()
    return () => { closed = true; clearTimeout(timer); ws?.close() }
  }, [])

  return state
}
