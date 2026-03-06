import { Field, type EditorTabProps } from './shared'

export function AiTab({ config, setConfig }: EditorTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Enable AI story">
          <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">
            <input
              checked={config.ai.enabled}
              onChange={(e) => setConfig((prev) => ({ ...prev, ai: { ...prev.ai, enabled: e.target.checked } }))}
              type="checkbox"
            />
            <span>Use the model to continue the scene after each action</span>
          </label>
        </Field>

        <Field label="API format">
          <select
            className="rounded-lg border border-slate-300 px-3 py-2"
            value={config.ai.apiMode}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                ai: { ...prev.ai, apiMode: e.target.value as typeof prev.ai.apiMode },
              }))
            }
          >
            <option value="chat-completions">Chat Completions (legacy)</option>
            <option value="responses">Responses (latest)</option>
          </select>
        </Field>

        <Field label="Base URL">
          <input
            className="rounded-lg border border-slate-300 px-3 py-2"
            placeholder="https://your-api.example.com/v1"
            value={config.ai.apiBaseUrl}
            onChange={(e) => setConfig((prev) => ({ ...prev, ai: { ...prev.ai, apiBaseUrl: e.target.value } }))}
          />
        </Field>

        <Field label="Model name">
          <input
            className="rounded-lg border border-slate-300 px-3 py-2"
            placeholder="gpt-5.4"
            value={config.ai.model}
            onChange={(e) => setConfig((prev) => ({ ...prev, ai: { ...prev.ai, model: e.target.value } }))}
          />
        </Field>


        <Field label="Reasoning effort">
          <select
            className="rounded-lg border border-slate-300 px-3 py-2"
            value={config.ai.reasoningEffort}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                ai: { ...prev.ai, reasoningEffort: e.target.value as typeof prev.ai.reasoningEffort },
              }))
            }
          >
            <option value="default">Model default</option>
            <option value="none">Off / no reasoning</option>
            <option value="minimal">Minimal</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="xhigh">Extra high</option>
          </select>
        </Field>

        <div className="md:col-span-2">
          <Field label="API key">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={config.ai.apiKey}
              onChange={(e) => setConfig((prev) => ({ ...prev, ai: { ...prev.ai, apiKey: e.target.value } }))}
            />
          </Field>
        </div>

        <Field label="Temperature">
          <input
            type="number"
            min={0}
            max={2}
            step={0.1}
            className="rounded-lg border border-slate-300 px-3 py-2"
            value={config.ai.temperature}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                ai: { ...prev.ai, temperature: Math.max(0, Math.min(2, Number(e.target.value) || 0)) },
              }))
            }
          />
        </Field>

        <Field label="Lines per scene">
          <input
            type="number"
            min={1}
            max={8}
            className="rounded-lg border border-slate-300 px-3 py-2"
            value={config.ai.maxLines}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                ai: { ...prev.ai, maxLines: Math.max(1, Math.min(8, Math.round(Number(e.target.value) || 1))) },
              }))
            }
          />
        </Field>

        <Field label="Recent log lines">
          <input
            type="number"
            min={4}
            max={24}
            className="rounded-lg border border-slate-300 px-3 py-2"
            value={config.ai.recentLogLimit}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                ai: { ...prev.ai, recentLogLimit: Math.max(4, Math.min(24, Math.round(Number(e.target.value) || 4))) },
              }))
            }
          />
        </Field>

        <Field label="Girl name">
          <input
            className="rounded-lg border border-slate-300 px-3 py-2"
            value={config.ai.characterName}
            onChange={(e) => setConfig((prev) => ({ ...prev, ai: { ...prev.ai, characterName: e.target.value } }))}
          />
        </Field>
      </div>

      <Field label="Character profile / background">
        <textarea
          rows={5}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
          value={config.ai.characterProfile}
          onChange={(e) => setConfig((prev) => ({ ...prev, ai: { ...prev.ai, characterProfile: e.target.value } }))}
        />
      </Field>

      <Field label="World setting / tone">
        <textarea
          rows={4}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
          value={config.ai.worldSetting}
          onChange={(e) => setConfig((prev) => ({ ...prev, ai: { ...prev.ai, worldSetting: e.target.value } }))}
        />
      </Field>

      <Field label="Extra prompt notes">
        <textarea
          rows={4}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
          value={config.ai.promptNotes}
          onChange={(e) => setConfig((prev) => ({ ...prev, ai: { ...prev.ai, promptNotes: e.target.value } }))}
        />
      </Field>

      <div className="rounded-xl border border-cyan-200 bg-cyan-50/80 px-4 py-3 text-sm text-cyan-950">
        <p className="font-medium">The requested test endpoint is prefilled in the default config</p>
        <p className="mt-1 text-cyan-900/80">You can also adjust GPT-5.4 reasoning effort here, including turning reasoning off entirely.</p>
      </div>
    </div>
  )
}
