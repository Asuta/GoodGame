import { Navigate, NavLink, Route, Routes } from 'react-router-dom'

import { useI18n } from '@/i18n/useI18n'
import { SUPPORTED_LOCALES, type Locale } from '@/i18n/messages'
import CasesPage from '@/pages/CasesPage'
import ContextPage from '@/pages/ContextPage'
import NotFound from '@/pages/NotFound'
import NpcsPage from '@/pages/NpcsPage'
import PlayPage from '@/pages/PlayPage'
import PlayerPage from '@/pages/PlayerPage'
import SettingsPage from '@/pages/SettingsPage'

function Navigation() {
  const { locale, setLocale, t } = useI18n()

  const tabs = [
    { path: '/play', label: t('nav.play') },
    { path: '/context', label: t('nav.context') },
    { path: '/player', label: t('nav.player') },
    { path: '/npcs', label: t('nav.npcs') },
    { path: '/cases', label: t('nav.cases') },
    { path: '/settings', label: t('nav.settings') },
  ]

  return (
    <header className="top-nav">
      <strong>{t('app.title')}</strong>
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
      <label className="language-switch">
        {t('app.language')}
        <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
          {SUPPORTED_LOCALES.map((entry) => (
            <option key={entry.code} value={entry.code}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>
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
