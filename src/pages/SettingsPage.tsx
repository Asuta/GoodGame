import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import {
  DEFAULT_SETTINGS,
  ensureDefaults,
  exportData,
  getSettings,
  importData,
  saveSettings,
} from '@/features/storage/repository'
import { useI18n } from '@/i18n/useI18n'
import type { ApiMode, AppSettings, ExportBundle } from '@/types/game'

export default function SettingsPage() {
  const { t } = useI18n()
  const [form, setForm] = useState<AppSettings | null>(null)
  const [message, setMessage] = useState('')
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('merge')

  useEffect(() => {
    void (async () => {
      await ensureDefaults()
      const settings = await getSettings()
      setForm(settings)
    })()
  }, [])

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form) {
      return
    }

    const saved = await saveSettings(form)
    setForm(saved)
    setMessage(t('settings.saved'))
  }

  async function handleExport() {
    const bundle = await exportData()
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `goodgame-export-${Date.now()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setMessage(t('settings.exported'))
  }

  async function handleImport(file: File) {
    const content = await file.text()
    const parsed = JSON.parse(content) as ExportBundle
    await importData(parsed, importMode)
    const settings = await getSettings()
    setForm(settings)
    setMessage(t('settings.imported'))
  }

  function handleApplyDemoPreset() {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            apiMode: DEFAULT_SETTINGS.apiMode,
            baseUrl: DEFAULT_SETTINGS.baseUrl,
            apiKey: DEFAULT_SETTINGS.apiKey,
            model: DEFAULT_SETTINGS.model,
          }
        : prev,
    )
    setMessage(t('settings.demoPresetApplied'))
  }

  if (!form) {
    return (
      <section className="rounded-3xl border border-white/60 bg-white/80 p-5 text-slate-700 shadow-lg shadow-slate-900/5 backdrop-blur">
        {t('settings.loading')}
      </section>
    )
  }

  return (
    <section className="grid gap-4 rounded-3xl border border-white/60 bg-white/80 p-5 shadow-lg shadow-slate-900/5 backdrop-blur animate-[revealUp_620ms_cubic-bezier(0.22,1,0.36,1)] lg:grid-cols-[1.4fr_1fr]">
      <div>
        <h1 className="bg-gradient-to-r from-slate-900 via-indigo-700 to-cyan-600 bg-[length:200%_100%] bg-clip-text text-2xl font-semibold text-transparent animate-[shimmer_8s_linear_infinite]">
          {t('settings.title')}
        </h1>
        <p className="mt-1 text-sm text-slate-600">{t('settings.subtitle')}</p>
        <form onSubmit={handleSave} className="mt-4 grid gap-3">
          <label>
            {t('settings.apiMode')}
            <select
              className="mt-1"
              value={form.apiMode}
              onChange={(event) =>
                setForm((prev) => (prev ? { ...prev, apiMode: event.target.value as ApiMode } : prev))
              }
            >
              <option value="responses">{t('settings.mode.responses')}</option>
              <option value="completions">{t('settings.mode.completions')}</option>
            </select>
          </label>

          <label>
            {t('settings.baseUrl')}
            <input
              className="mt-1"
              value={form.baseUrl}
              onChange={(event) => setForm((prev) => (prev ? { ...prev, baseUrl: event.target.value } : prev))}
            />
          </label>

          <label>
            {t('settings.apiKey')}
            <input
              className="mt-1"
              type="password"
              value={form.apiKey}
              onChange={(event) => setForm((prev) => (prev ? { ...prev, apiKey: event.target.value } : prev))}
            />
          </label>

          <label>
            {t('settings.model')}
            <input
              className="mt-1"
              value={form.model}
              onChange={(event) => setForm((prev) => (prev ? { ...prev, model: event.target.value } : prev))}
            />
          </label>

          <div className="inline-controls">
            <button type="button" onClick={handleApplyDemoPreset}>
              {t('settings.applyDemoPreset')}
            </button>
          </div>

          <label>
            {t('settings.temperature')}
            <input
              className="mt-1"
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={form.temperature}
              onChange={(event) =>
                setForm((prev) => (prev ? { ...prev, temperature: Number(event.target.value) } : prev))
              }
            />
          </label>

          <label>
            {t('settings.maxOutputTokens')}
            <input
              className="mt-1"
              type="number"
              min={1}
              max={4000}
              value={form.maxOutputTokens}
              onChange={(event) =>
                setForm((prev) => (prev ? { ...prev, maxOutputTokens: Number(event.target.value) } : prev))
              }
            />
          </label>

          <label>
            {t('settings.systemPrompt')}
            <textarea
              className="mt-1"
              rows={5}
              value={form.systemPrompt}
              onChange={(event) =>
                setForm((prev) => (prev ? { ...prev, systemPrompt: event.target.value } : prev))
              }
            />
          </label>

          <button
            className="w-fit rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-700 hover:shadow-lg hover:shadow-slate-900/20"
            type="submit"
          >
            {t('settings.save')}
          </button>
        </form>
      </div>

      <aside className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 animate-[revealUp_780ms_cubic-bezier(0.22,1,0.36,1)]">
        <h2 className="text-lg font-semibold text-slate-900">{t('settings.importExport')}</h2>
        <p className="mt-1 text-sm text-slate-600">{t('settings.importExportDesc')}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label>
            {t('settings.importMode')}
            <select
              className="mt-1"
              value={importMode}
              onChange={(event) => setImportMode(event.target.value as 'replace' | 'merge')}
            >
              <option value="merge">{t('settings.merge')}</option>
              <option value="replace">{t('settings.replace')}</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-900 hover:text-white hover:shadow"
            type="button"
            onClick={handleExport}
          >
            {t('settings.export')}
          </button>
          <label className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-900 hover:text-white hover:shadow">
            {t('settings.import')}
            <input
              className="mt-1.5 block"
              type="file"
              accept="application/json"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) {
                  void handleImport(file)
                }
              }}
            />
          </label>
        </div>

        {message ? <p className="mt-3 text-sm font-medium text-emerald-700">{message}</p> : null}
      </aside>
    </section>
  )
}
