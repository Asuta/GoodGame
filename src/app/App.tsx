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
    <header className="rounded-3xl border border-white/60 bg-white/70 px-5 py-4 shadow-lg shadow-slate-900/5 backdrop-blur animate-[revealUp_500ms_cubic-bezier(0.22,1,0.36,1)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <strong className="bg-gradient-to-r from-slate-900 via-sky-700 to-teal-600 bg-[length:200%_100%] bg-clip-text text-base font-semibold tracking-wide text-transparent animate-[shimmer_7s_linear_infinite]">
          {t('app.title')}
        </strong>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              [
                'rounded-full px-3 py-1.5 text-sm font-medium transition',
                isActive
                  ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20 animate-[pulseGlow_2.8s_ease-in-out_infinite]'
                  : 'bg-white/70 text-slate-700 hover:-translate-y-0.5 hover:bg-white hover:text-slate-900 hover:shadow-md',
              ].join(' ')
            }
          >
            {tab.label}
          </NavLink>
        ))}
        </nav>
        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
          <span>{t('app.language')}</span>
          <select
            className="w-auto min-w-[100px] rounded-xl border border-slate-200 bg-white px-3 py-1.5"
            value={locale}
            onChange={(event) => setLocale(event.target.value as Locale)}
          >
            {SUPPORTED_LOCALES.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  )
}

export default function App() {
  return (
    <div className="relative mx-auto my-4 grid w-[min(1320px,96vw)] gap-3 overflow-hidden">
      <div className="pointer-events-none absolute -left-24 -top-20 h-72 w-72 rounded-full bg-sky-300/30 blur-3xl animate-[floatA_9s_ease-in-out_infinite]" />
      <div className="pointer-events-none absolute right-[-90px] top-16 h-80 w-80 rounded-full bg-emerald-300/25 blur-3xl animate-[floatB_11s_ease-in-out_infinite]" />
      <div className="pointer-events-none absolute bottom-[-120px] left-1/3 h-72 w-72 rounded-full bg-indigo-300/25 blur-3xl animate-[floatC_13s_ease-in-out_infinite]" />
      <Navigation />
      <main className="grid animate-[revealUp_700ms_cubic-bezier(0.22,1,0.36,1)]">
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
