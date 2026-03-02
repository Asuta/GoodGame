import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import {
  ensureDefaults,
  exportData,
  getSettings,
  importData,
  saveSettings,
} from '@/features/storage/repository'
import type { ApiMode, AppSettings, ExportBundle } from '@/types/game'

export default function SettingsPage() {
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
    setMessage('Settings saved')
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
    setMessage('Exported JSON file')
  }

  async function handleImport(file: File) {
    const content = await file.text()
    const parsed = JSON.parse(content) as ExportBundle
    await importData(parsed, importMode)
    const settings = await getSettings()
    setForm(settings)
    setMessage('Import completed')
  }

  if (!form) {
    return <section className="panel">Loading settings...</section>
  }

  return (
    <section className="panel page-grid">
      <div>
        <h1>Settings</h1>
        <p>Configure direct API access and choose Completions or Responses mode.</p>
        <form onSubmit={handleSave} className="form-grid">
          <label>
            API mode
            <select
              value={form.apiMode}
              onChange={(event) =>
                setForm((prev) => (prev ? { ...prev, apiMode: event.target.value as ApiMode } : prev))
              }
            >
              <option value="responses">Responses</option>
              <option value="completions">Completions</option>
            </select>
          </label>

          <label>
            Base URL
            <input
              value={form.baseUrl}
              onChange={(event) => setForm((prev) => (prev ? { ...prev, baseUrl: event.target.value } : prev))}
            />
          </label>

          <label>
            API Key
            <input
              type="password"
              value={form.apiKey}
              onChange={(event) => setForm((prev) => (prev ? { ...prev, apiKey: event.target.value } : prev))}
            />
          </label>

          <label>
            Model
            <input
              value={form.model}
              onChange={(event) => setForm((prev) => (prev ? { ...prev, model: event.target.value } : prev))}
            />
          </label>

          <label>
            Temperature
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
            Max output tokens
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
            System prompt
            <textarea
              rows={5}
              value={form.systemPrompt}
              onChange={(event) =>
                setForm((prev) => (prev ? { ...prev, systemPrompt: event.target.value } : prev))
              }
            />
          </label>

          <button type="submit">Save settings</button>
        </form>
      </div>

      <aside>
        <h2>Import / Export</h2>
        <p>Export a full local snapshot or import one back to this browser.</p>
        <div className="inline-controls">
          <label>
            Import mode
            <select
              value={importMode}
              onChange={(event) => setImportMode(event.target.value as 'replace' | 'merge')}
            >
              <option value="merge">Merge</option>
              <option value="replace">Replace</option>
            </select>
          </label>
        </div>
        <div className="inline-controls">
          <button type="button" onClick={handleExport}>
            Export JSON
          </button>
          <label className="file-input-label">
            Import JSON
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
