import React, { useCallback, useState } from 'react'
import { Upload, Loader2, Sparkles, ImageIcon } from 'lucide-react'
import { detectFood, type DetectionResult } from '../api'

export default function Scanner() {
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DetectionResult | null>(null)

  const runDetection = useCallback(async (file: File) => {
    setError(null)
    setLoading(true)
    setResult(null)
    try {
      const data = await detectFood(file)
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) void runDetection(f)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f && f.type.startsWith('image/')) void runDetection(f)
    else setError('Please drop an image file (JPEG, PNG, WebP).')
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <header style={{ marginBottom: 28 }}>
        <h1 className="gradient-text" style={{ fontSize: '2rem', marginBottom: 8 }}>
          AI Food Scanner
        </h1>
        <p style={{ color: 'var(--text-muted)', maxWidth: 560 }}>
          Upload a meal photo. NutriVision detects foods, estimates portions from the frame, and
          returns calories and macros with a quick recommendation.
        </p>
      </header>

      <div
        className="glass-panel file-drop-area"
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        style={{
          borderStyle: 'dashed',
          borderWidth: 2,
          borderColor: dragOver ? 'var(--primary)' : 'var(--glass-border)',
          textAlign: 'center',
          padding: '40px 24px',
          marginBottom: 24,
          cursor: 'pointer',
          position: 'relative',
        }}
      >
        <input
          type="file"
          accept="image/*"
          onChange={onFileInput}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
          aria-label="Upload food image"
        />
        <ImageIcon size={40} color="var(--primary)" style={{ marginBottom: 12 }} />
        <p style={{ fontWeight: 600, marginBottom: 8 }}>Drop an image here or tap to browse</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Runs locally against the FastAPI backend (start with{' '}
          <code style={{ color: 'var(--primary)' }}>uvicorn app.main:app --reload</code> from the{' '}
          <code>backend</code> folder).
        </p>
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 12 }}>
          <span className="btn btn-primary" style={{ pointerEvents: 'none' }}>
            <Upload size={18} /> Choose file
          </span>
        </div>
      </div>

      {loading && (
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Loader2 className="animate-spin" size={22} color="var(--primary)" />
          <span>Analyzing image…</span>
        </div>
      )}

      {error && (
        <div
          className="glass-panel"
          style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
        >
          {error}
        </div>
      )}

      {result && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 360px)', gap: 24, alignItems: 'start' }}>
          <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
            {result.image_base64 ? (
              <img
                src={result.image_base64}
                alt="Annotated detection"
                style={{ width: '100%', display: 'block', verticalAlign: 'bottom' }}
              />
            ) : (
              <div style={{ padding: 24, color: 'var(--text-muted)' }}>No preview returned.</div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {result.primary_prediction && (
              <div className="glass-panel">
                <h3 style={{ margin: '0 0 8px 0' }}>Primary prediction</h3>
                <p style={{ fontSize: '1.25rem', fontWeight: 700, textTransform: 'capitalize' }}>
                  {result.primary_prediction.food}
                  <span style={{ fontWeight: 500, color: 'var(--text-muted)', marginLeft: 8, fontSize: '1rem' }}>
                    {(result.primary_prediction.confidence * 100).toFixed(0)}% conf
                  </span>
                </p>
                {result.primary_prediction.alternatives.length > 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 8 }}>
                    Alternatives:{' '}
                    {result.primary_prediction.alternatives.map((a) => (
                      <span key={a} style={{ textTransform: 'capitalize', marginRight: 8 }}>
                        {a}
                      </span>
                    ))}
                  </p>
                )}
                {result.primary_prediction.unknown_reason && (
                  <p style={{ color: 'var(--warning)', fontSize: '0.9rem', marginTop: 8 }}>
                    {result.primary_prediction.unknown_reason}
                  </p>
                )}
                {result.primary_prediction.evidence && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 6 }}>
                    Source: {result.primary_prediction.evidence}
                  </p>
                )}
              </div>
            )}
            <div className="glass-panel">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Sparkles size={20} color="var(--primary)" />
                <h3 style={{ margin: 0 }}>Totals</h3>
              </div>
              <ul style={{ listStyle: 'none', color: 'var(--text-muted)', lineHeight: 1.8 }}>
                <li>
                  <strong style={{ color: 'var(--text-main)' }}>Calories:</strong>{' '}
                  {result.totals.total_calories.toFixed(0)} kcal
                </li>
                <li>
                  <strong style={{ color: 'var(--text-main)' }}>Protein:</strong>{' '}
                  {result.totals.total_protein.toFixed(1)} g
                </li>
                <li>
                  <strong style={{ color: 'var(--text-main)' }}>Carbs:</strong>{' '}
                  {result.totals.total_carbs.toFixed(1)} g
                </li>
                <li>
                  <strong style={{ color: 'var(--text-main)' }}>Fat:</strong>{' '}
                  {result.totals.total_fat.toFixed(1)} g
                </li>
              </ul>
              <p style={{ marginTop: 16, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                {result.recommendation}
              </p>
            </div>

            <div className="glass-panel">
              <h3 style={{ marginBottom: 12 }}>Detected items</h3>
              {result.items.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No foods matched the supported set.</p>
              ) : (
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {result.items.map((item) => (
                    <li
                      key={`${item.food_name}-${item.confidence}-${item.portion_size_grams}`}
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        background: 'var(--bg-color)',
                        border: '1px solid var(--glass-border)',
                      }}
                    >
                      <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                        {item.food_name}
                        <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
                          {(item.confidence * 100).toFixed(0)}% · {item.portion_size_grams}g
                        </span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        {item.calories.toFixed(0)} kcal · P {item.protein.toFixed(1)} · C{' '}
                        {item.carbs.toFixed(1)} · F {item.fat.toFixed(1)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
