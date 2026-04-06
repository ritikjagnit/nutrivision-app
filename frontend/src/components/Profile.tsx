import { UserCircle } from 'lucide-react'

export default function Profile() {
  return (
    <div className="animate-fade-in" style={{ maxWidth: 560, margin: '0 auto' }}>
      <header style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <UserCircle size={36} color="var(--primary)" />
        <h1 className="gradient-text" style={{ fontSize: '2rem', margin: 0 }}>
          Profile
        </h1>
      </header>
      <div className="glass-panel">
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
          User accounts and goals are modeled in the backend (<code>users</code> table) but not wired in
          the UI yet. Scans default to <code>user_id=1</code>. You can extend this screen to edit age,
          weight, height, and goals when you connect create/update user endpoints.
        </p>
      </div>
    </div>
  )
}
