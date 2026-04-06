import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { History as HistoryIcon, ChevronDown, ChevronRight } from 'lucide-react'
import { fetchScanHistory, type ScanHistoryRow } from '../api'

export default function History() {
  const [rows, setRows] = useState<ScanHistoryRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchScanHistory()
        if (!cancelled) {
          setRows(data)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="animate-fade-in" style={{ maxWidth: 900, margin: '0 auto' }}>
      <header style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <HistoryIcon size={32} color="var(--primary)" />
        <div>
          <h1 className="gradient-text" style={{ fontSize: '2rem', margin: 0 }}>
            Scan history
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
            Stored in SQLite when you run detection from the scanner.
          </p>
        </div>
      </header>

      {error && (
        <div className="glass-panel" style={{ borderColor: 'var(--danger)', color: 'var(--danger)', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {rows.length === 0 && !error ? (
        <div className="glass-panel">
          <p style={{ color: 'var(--text-muted)', marginBottom: 12 }}>No history yet.</p>
          <Link to="/scanner" className="btn btn-primary">
            Go to scanner
          </Link>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((row) => {
            const expanded = openId === row.id
            return (
              <li key={row.id} className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setOpenId(expanded ? null : row.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '16px 20px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    fontSize: '1rem',
                  }}
                >
                  {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  <span style={{ flex: 1, fontWeight: 600 }}>
                    {new Date(row.timestamp).toLocaleString()}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {Math.round(row.total_calories)} kcal
                  </span>
                </button>
                {expanded && (
                  <div
                    style={{
                      padding: '0 20px 16px 52px',
                      borderTop: '1px solid var(--glass-border)',
                    }}
                  >
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: '12px 0' }}>
                      Image path: <code style={{ fontSize: '0.85rem' }}>{row.image_path}</code>
                    </p>
                    <p style={{ marginBottom: 8 }}>
                      Macros: P {row.total_protein.toFixed(1)} g · C {row.total_carbs.toFixed(1)} g · F{' '}
                      {row.total_fat.toFixed(1)} g
                    </p>
                    {row.items.length > 0 ? (
                      <ul style={{ listStyle: 'disc', paddingLeft: 20, color: 'var(--text-muted)' }}>
                        {row.items.map((it) => (
                          <li key={`${it.food_name}-${it.confidence}`} style={{ textTransform: 'capitalize' }}>
                            {it.food_name} — {it.portion_size_grams}g ({Math.round(it.calories)} kcal)
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ color: 'var(--text-muted)' }}>No line items recorded.</p>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
