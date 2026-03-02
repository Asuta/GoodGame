import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import {
  createCase,
  ensureDefaults,
  getSession,
  listCases,
  saveSession,
  upsertCase,
} from '@/features/storage/repository'
import { useI18n } from '@/i18n/useI18n'
import type { CaseData } from '@/types/game'

export default function CasesPage() {
  const { t } = useI18n()
  const [items, setItems] = useState<CaseData[]>([])
  const [message, setMessage] = useState('')
  const [activeCaseIds, setActiveCaseIds] = useState<string[]>([])

  async function reload() {
    const [entries, session] = await Promise.all([listCases(), getSession()])
    setItems(entries)
    setActiveCaseIds(session.activeCaseIds)
  }

  useEffect(() => {
    void (async () => {
      await ensureDefaults()
      await reload()
    })()
  }, [])

  async function handleCreate() {
    await createCase()
    await reload()
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    await Promise.all(items.map((entry) => upsertCase(entry)))
    await saveSession({ activeCaseIds })
    setMessage(t('cases.saved'))
  }

  function updateItem(index: number, next: CaseData) {
    setItems((prev) => prev.map((entry, itemIndex) => (itemIndex === index ? next : entry)))
  }

  return (
    <section className="panel">
      <h1>{t('cases.title')}</h1>
      <p>{t('cases.subtitle')}</p>

      <div className="inline-controls">
        <button type="button" onClick={handleCreate}>
          {t('cases.add')}
        </button>
      </div>

      <form onSubmit={handleSave}>
        <div className="stacked-list">
          {items.map((entry, index) => (
            <article key={entry.id} className="panel sub-panel">
              <label className="checkbox-line">
                <input
                  type="checkbox"
                  checked={activeCaseIds.includes(entry.id)}
                  onChange={(event) => {
                    const checked = event.target.checked
                    setActiveCaseIds((prev) =>
                      checked
                        ? [...new Set([...prev, entry.id])]
                        : prev.filter((candidate) => candidate !== entry.id),
                    )
                  }}
                />
                {t('cases.active')}
              </label>

              <div className="form-grid compact-grid">
                <label>
                  {t('cases.titleField')}
                  <input
                    value={entry.title}
                    onChange={(event) => updateItem(index, { ...entry, title: event.target.value })}
                  />
                </label>

                <label>
                  {t('cases.priority')}
                  <input
                    type="number"
                    value={entry.priority}
                    onChange={(event) =>
                      updateItem(index, { ...entry, priority: Number(event.target.value) })
                    }
                  />
                </label>

                <label>
                  {t('cases.enabled')}
                  <input
                    type="checkbox"
                    checked={entry.enabled}
                    onChange={(event) => updateItem(index, { ...entry, enabled: event.target.checked })}
                  />
                </label>

                <label>
                  {t('cases.content')}
                  <textarea
                    rows={6}
                    value={entry.content}
                    onChange={(event) => updateItem(index, { ...entry, content: event.target.value })}
                  />
                </label>
              </div>
            </article>
          ))}
        </div>

        <button type="submit">{t('cases.save')}</button>
      </form>

      {message ? <p className="status-message">{message}</p> : null}
    </section>
  )
}
