import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Activity, Camera, LayoutDashboard, History, UserCircle, Sun, Moon } from 'lucide-react';
import Scanner from './components/Scanner';
import Dashboard from './components/Dashboard';
import HistoryPage from './components/History';
import Profile from './components/Profile';
import './index.css';

const Sidebar = ({ toggleTheme, isDark }: { toggleTheme: () => void, isDark: boolean }) => {
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
    { name: 'AI Scanner', path: '/scanner', icon: <Camera size={20} /> },
    { name: 'History', path: '/history', icon: <History size={20} /> },
    { name: 'Profile', path: '/profile', icon: <UserCircle size={20} /> },
  ];

  return (
    <nav className="sidebar">
      <div className="logo-container" style={{ marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))', padding: '8px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Activity color="#fff" size={24} />
        </div>
        <h2 className="gradient-text" style={{ fontSize: '1.5rem', margin: 0 }}>NutriVision</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flexGrow: 1 }}>
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: '12px',
              textDecoration: 'none',
              color: location.pathname === item.path ? '#fff' : 'var(--text-muted)',
              background: location.pathname === item.path ? 'var(--glass-border)' : 'transparent',
              transition: 'all 0.2s',
              fontWeight: 500
            }}
          >
            {item.icon}
            {item.name}
          </Link>
        ))}
      </div>

      <button className="btn btn-secondary" onClick={toggleTheme} style={{ marginTop: 'auto', width: '100%', justifyContent: 'center' }}>
        {isDark ? <><Sun size={18} /> Light Mode</> : <><Moon size={18} /> Dark Mode</>}
      </button>
    </nav>
  );
};

function App() {
  const [isDark, setIsDark] = React.useState(true);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  return (
    <Router>
      <div className="app-container">
        <div className="bg-blob-1"></div>
        <div className="bg-blob-2"></div>
        
        <Sidebar toggleTheme={() => setIsDark(!isDark)} isDark={isDark} />
        
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/scanner" element={<Scanner />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
