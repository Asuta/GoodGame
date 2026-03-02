import { Link, useLocation } from 'react-router-dom'

import { useI18n } from '@/i18n/useI18n'

export default function NotFound() {
  const location = useLocation()
  const { t } = useI18n()

  return (
    <section className="grid gap-3 rounded-3xl border border-white/60 bg-white/80 p-6 shadow-lg shadow-slate-900/5 backdrop-blur animate-[revealUp_700ms_cubic-bezier(0.22,1,0.36,1)]">
      <h1 className="bg-gradient-to-r from-slate-900 via-rose-700 to-orange-500 bg-[length:200%_100%] bg-clip-text text-3xl font-semibold text-transparent animate-[shimmer_7s_linear_infinite]">
        404
      </h1>
      <p className="text-slate-700">
        {t('notFound.message', { path: location.pathname })}
      </p>
      <p>
        <Link className="font-medium text-teal-700 hover:text-teal-900" to="/play">
          {t('notFound.back')}
        </Link>
      </p>
    </section>
  )
}
