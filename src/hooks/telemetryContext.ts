import { createContext, useContext } from 'react'
import type { LatestTelemetry } from './useMission'

/** Telemetry polled once by the Shell and shared with every tab. */
export const TelemetryCtx = createContext<{ data: LatestTelemetry | null; error: boolean }>({ data: null, error: false })
export const useSharedTelemetry = () => useContext(TelemetryCtx)
