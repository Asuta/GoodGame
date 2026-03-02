import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import {
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

  if (!form) {
    return <section className="panel">{t('settings.loading')}</section>
  }

  return (
    <section className="panel page-grid">
      <div>
        <h1>{t('settings.title')}</h1>
        <p>{t('settings.subtitle')}</p>
        <form onSubmit={handleSave} className="form-grid">
          <label>
            {t('settings.apiMode')}
            <select
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
              value={form.baseUrl}
              onChange={(event) => setForm((prev) => (prev ? { ...prev, baseUrl: event.target.value } : prev))}
            />
          </label>

          <label>
            {t('settings.apiKey')}
            <input
              type="password"
              value={form.apiKey}
              onChange={(event) => setForm((prev) => (prev ? { ...prev, apiKey: event.target.value } : prev))}
            />
          </label>

          <label>
            {t('settings.model')}
            <input
              value={form.model}
              onChange={(event) => setForm((prev) => (prev ? { ...prev, model: event.target.value } : prev))}
            />
          </label>

          <label>
            {t('settings.temperature')}
            <input
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
              rows={5}
              value={form.systemPrompt}
              onChange={(event) =>
                setForm((prev) => (prev ? { ...prev, systemPrompt: event.target.value } : prev))
              }
            />
          </label>

          <button type="submit">{t('settings.save')}</button>
        </form>
      </div>

      <aside>
        <h2>{t('settings.importExport')}</h2>
        <p>{t('settings.importExportDesc')}</p>
        <div className="inline-controls">
          <label>
            {t('settings.importMode')}
            <select
              value={importMode}
              onChange={(event) => setImportMode(event.target.value as 'replace' | 'merge')}
            >
              <option value="merge">{t('settings.merge')}</option>
              <option value="replace">{t('settings.replace')}</option>
            </select>
          </label>
        </div>
        <div className="inline-controls">
          <button type="button" onClick={handleExport}>
            {t('settings.export')}
          </button>
          <label className="file-input-label">
            {t('settings.import')}
            <input
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

        {message ? <p className="status-message">{message}</p> : null}
      </aside>
    </section>
  )
}
