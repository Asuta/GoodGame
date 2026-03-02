import { Link, useLocation } from 'react-router-dom'

import { useI18n } from '@/i18n/useI18n'

export default function NotFound() {
  const location = useLocation()
  const { t } = useI18n()

  return (
    <section className="panel">
      <h1>404</h1>
      <p>
        {t('notFound.message', { path: location.pathname })}
      </p>
      <p>
        <Link to="/play">{t('notFound.back')}</Link>
      </p>
    </section>
  )
}
