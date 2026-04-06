import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Camera, Flame, Beef, Wheat, Droplets, Server } from 'lucide-react'
import { fetchHealth, fetchScanHistory } from '../api'

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export default function Dashboard() {
  const [apiOk, setApiOk] = useState<boolean | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [history, setHistory] = useState<Awaited<ReturnType<typeof fetchScanHistory>>>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const h = await fetchHealth()
        if (!cancelled) setApiOk(h.status === 'ok')
      } catch {
        if (!cancelled) setApiOk(false)
      }
      try {
        const scans = await fetchScanHistory()
        if (!cancelled) {
          setHistory(scans)
          setHistoryError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setHistory([])
          setHistoryError(e instanceof Error ? e.message : 'History unavailable')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const todayStats = useMemo(() => {
    const start = startOfDay(new Date()).getTime()
    const today = history.filter((s) => new Date(s.timestamp).getTime() >= start)
    const totals = today.reduce(
      (acc, s) => ({
        cal: acc.cal + s.total_calories,
        p: acc.p + s.total_protein,
        c: acc.c + s.total_carbs,
        f: acc.f + s.total_fat,
      }),
      { cal: 0, p: 0, c: 0, f: 0 },
    )
    return { scans: today.length, ...totals }
  }, [history])

  const recent = history.slice(0, 5)

  const statCard = (
    icon: React.ReactNode,
    label: string,
    value: string,
    sub?: string,
  ) => (
    <div className="glass-panel" style={{ minHeight: 120 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        {icon}
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.75rem', fontFamily: 'Outfit, sans-serif', fontWeight: 700 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>
      )}
    </div>
  )

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <header style={{ marginBottom: 28, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 className="gradient-text" style={{ fontSize: '2rem', marginBottom: 8 }}>
            Dashboard
          </h1>
          <p style={{ color: 'var(--text-muted)', maxWidth: 520 }}>
            Today&apos;s scans and macros from your saved history. Open the scanner to log a new meal.
          </p>
        </div>
        <Link to="/scanner" className="btn btn-primary">
          <Camera size={18} /> New scan
        </Link>
      </header>

      <div
        className="glass-panel"
        style={{
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 20px',
        }}
      >
        <Server size={22} color={apiOk ? 'var(--success)' : apiOk === false ? 'var(--danger)' : 'var(--text-muted)'} />
        <div>
          <div style={{ fontWeight: 600 }}>API status</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {apiOk === null && 'Checking…'}
            {apiOk === true && 'Backend reachable — detection and history are available.'}
            {apiOk === false && 'Backend not reachable. Start the FastAPI server on port 8000.'}
          </div>
        </div>
      </div>

      {historyError && (
        <p style={{ color: 'var(--warning)', marginBottom: 16, fontSize: '0.9rem' }}>{historyError}</p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 28,
        }}
      >
        {statCard(
          <Flame size={20} color="var(--primary)" />,
          'Scans today',
          String(todayStats.scans),
        )}
        {statCard(
          <Activity size={20} color="var(--secondary)" />,
          'Calories (today)',
          `${Math.round(todayStats.cal)} kcal`,
        )}
        {statCard(
          <Beef size={20} color="var(--success)" />,
          'Protein (today)',
          `${todayStats.p.toFixed(0)} g`,
        )}
        {statCard(
          <Wheat size={20} color="var(--warning)" />,
          'Carbs (today)',
          `${todayStats.c.toFixed(0)} g`,
        )}
        {statCard(
          <Droplets size={20} color="var(--primary)" />,
          'Fat (today)',
          `${todayStats.f.toFixed(0)} g`,
        )}
      </div>

      <div className="glass-panel">
        <h2 style={{ marginBottom: 16, fontSize: '1.25rem' }}>Recent scans</h2>
        {recent.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>
            No scans yet.{' '}
            <Link to="/scanner" style={{ color: 'var(--primary)' }}>
              Run your first scan
            </Link>
            .
          </p>
        ) : (
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recent.map((s) => (
              <li
                key={s.id}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  border: '1px solid var(--glass-border)',
                  background: 'var(--bg-color)',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>
                    {new Date(s.timestamp).toLocaleString()}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {Math.round(s.total_calories)} kcal · P {s.total_protein.toFixed(0)} · C{' '}
                    {s.total_carbs.toFixed(0)} · F {s.total_fat.toFixed(0)}
                  </span>
                </div>
                {s.items.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    {s.items.map((i) => i.food_name).join(', ')}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
