import type { ConfigSetter } from './helpers'
import { updateConfigText } from './helpers'
import { Field } from './shared'

type DataTabProps = {
  configText: string
  importError: string
  importText: string
  onImportTextChange: (value: string) => void
  setConfig: ConfigSetter
  setImportError: (value: string) => void
}

export function DataTab({ configText, importError, importText, onImportTextChange, setConfig, setImportError }: DataTabProps) {
  return (
    <div className="space-y-3">
      <Field label="导出 JSON">
        <textarea readOnly rows={10} className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2" value={configText} />
      </Field>

      <Field label="导入 JSON">
        <textarea rows={8} className="w-full rounded-lg border border-slate-300 px-3 py-2" value={importText} onChange={(e) => onImportTextChange(e.target.value)} />
      </Field>
      <button className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm text-white" onClick={() => updateConfigText(importText, setConfig, setImportError)}>
        应用导入
      </button>
      {importError && <p className="text-sm text-rose-700">{importError}</p>}
    </div>
  )
}
