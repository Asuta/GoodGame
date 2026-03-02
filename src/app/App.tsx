import { Navigate, NavLink, Route, Routes } from 'react-router-dom'

import CasesPage from '@/pages/CasesPage'
import ContextPage from '@/pages/ContextPage'
import NotFound from '@/pages/NotFound'
import NpcsPage from '@/pages/NpcsPage'
import PlayPage from '@/pages/PlayPage'
import PlayerPage from '@/pages/PlayerPage'
import SettingsPage from '@/pages/SettingsPage'

function Navigation() {
  const tabs = [
    { path: '/play', label: 'Play' },
    { path: '/context', label: 'Context' },
    { path: '/player', label: 'Player' },
    { path: '/npcs', label: 'NPCs' },
    { path: '/cases', label: 'Cases' },
    { path: '/settings', label: 'Settings' },
  ]

  return (
    <header className="top-nav">
      <strong>GoodGame Demo</strong>
      <nav>
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}

export default function App() {
  return (
    <div className="app-shell">
      <Navigation />
      <main className="page-body">
        <Routes>
          <Route path="/" element={<Navigate to="/play" replace />} />
          <Route path="/play" element={<PlayPage />} />
          <Route path="/context" element={<ContextPage />} />
          <Route path="/player" element={<PlayerPage />} />
          <Route path="/npcs" element={<NpcsPage />} />
          <Route path="/cases" element={<CasesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  )
}
