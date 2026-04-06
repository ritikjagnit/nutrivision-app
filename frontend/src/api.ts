export type DetectedItem = {
  food_name: string
  confidence: number
  portion_size_grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
  evidence?: string | null
}

export type MacroTotals = {
  total_calories: number
  total_protein: number
  total_carbs: number
  total_fat: number
}

export type PrimaryPrediction = {
  food: string
  confidence: number
  alternatives: string[]
  unknown_reason?: string | null
  evidence?: string | null
}

export type DetectionResult = {
  message: string
  image_base64: string | null
  items: DetectedItem[]
  totals: MacroTotals
  recommendation: string
  primary_prediction: PrimaryPrediction
  debug_raw_detections?: Record<string, unknown>[] | null
}

export type ScanHistoryRow = {
  id: number
  user_id: number
  timestamp: string
  image_path: string
  total_calories: number
  total_protein: number
  total_carbs: number
  total_fat: number
  items: DetectedItem[]
}

const API_BASE = '/api'

export async function detectFood(file: File): Promise<DetectionResult> {
  const body = new FormData()
  body.append('file', file)
  const res = await fetch(`${API_BASE}/food/detect`, {
    method: 'POST',
    body,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Detection failed (${res.status})`)
  }
  return res.json()
}

export async function fetchScanHistory(): Promise<ScanHistoryRow[]> {
  const res = await fetch(`${API_BASE}/food/history`)
  if (!res.ok) throw new Error('Could not load scan history')
  return res.json()
}

export async function fetchHealth(): Promise<{ status: string; message?: string }> {
  const res = await fetch(`${API_BASE}/health`)
  if (!res.ok) throw new Error('API unreachable')
  return res.json()
}
