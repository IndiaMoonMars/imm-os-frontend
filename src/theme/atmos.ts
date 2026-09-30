export interface Limit { lo: number; hi: number; margin: number; min: number; max: number; unit: string; label: string; decimals: number }

/** Nominal habitat ranges (analog habitat, sea-level atmosphere). */
export const ATMOS: Record<string, Limit> = {
  o2:          { label: 'Oxygen',      unit: '% O₂',  lo: 19.5, hi: 23.5, margin: 1.5,  min: 15,  max: 25,   decimals: 2 },
  co2:         { label: 'CO₂',         unit: 'ppm',   lo: 300,  hi: 1000, margin: 1500, min: 0,   max: 3000, decimals: 0 },
  temperature: { label: 'Temperature', unit: '°C',    lo: 18,   hi: 27,   margin: 3,    min: 10,  max: 35,   decimals: 1 },
  humidity:    { label: 'Humidity',    unit: '% RH',  lo: 30,   hi: 60,   margin: 10,   min: 0,   max: 100,  decimals: 0 },
  pressure:    { label: 'Pressure',    unit: 'hPa',   lo: 980,  hi: 1040, margin: 20,   min: 940, max: 1080, decimals: 0 },
}
