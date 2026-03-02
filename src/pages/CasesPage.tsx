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
    <section className="grid gap-3 rounded-3xl border border-white/60 bg-white/80 p-5 shadow-lg shadow-slate-900/5 backdrop-blur animate-[revealUp_620ms_cubic-bezier(0.22,1,0.36,1)]">
      <h1 className="bg-gradient-to-r from-slate-900 via-violet-700 to-cyan-600 bg-[length:200%_100%] bg-clip-text text-2xl font-semibold text-transparent animate-[shimmer_8s_linear_infinite]">
        {t('cases.title')}
      </h1>
      <p className="text-sm text-slate-600">{t('cases.subtitle')}</p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-900 hover:text-white hover:shadow"
          type="button"
          onClick={handleCreate}
        >
          {t('cases.add')}
        </button>
      </div>

      <form onSubmit={handleSave}>
        <div className="grid gap-3">
          {items.map((entry, index) => (
            <article key={entry.id} className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 transition duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/10">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  className="size-4"
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

              <div className="grid items-start gap-2.5 md:grid-cols-2">
                <label>
                  {t('cases.titleField')}
                  <input
                    className="mt-1"
                    value={entry.title}
                    onChange={(event) => updateItem(index, { ...entry, title: event.target.value })}
                  />
                </label>

                <label>
                  {t('cases.priority')}
                  <input
                    className="mt-1"
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
                    className="mt-1 size-4"
                    type="checkbox"
                    checked={entry.enabled}
                    onChange={(event) => updateItem(index, { ...entry, enabled: event.target.checked })}
                  />
                </label>

                <label>
                  {t('cases.content')}
                  <textarea
                    className="mt-1"
                    rows={6}
                    value={entry.content}
                    onChange={(event) => updateItem(index, { ...entry, content: event.target.value })}
                  />
                </label>
              </div>
            </article>
          ))}
        </div>

        <button
          className="mt-3 w-fit rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-700 hover:shadow-lg hover:shadow-slate-900/20"
          type="submit"
        >
          {t('cases.save')}
        </button>
      </form>

      {message ? <p className="text-sm font-medium text-emerald-700">{message}</p> : null}
    </section>
  )
}
