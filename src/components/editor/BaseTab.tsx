import { Field, type EditorTabProps } from './shared'

export function BaseTab({ config, setConfig }: EditorTabProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="游戏标题">
        <input
          className="rounded-lg border border-slate-300 px-3 py-2"
          value={config.title}
          onChange={(e) => setConfig((prev) => ({ ...prev, title: e.target.value }))}
        />
      </Field>
      <Field label="副标题">
        <input
          className="rounded-lg border border-slate-300 px-3 py-2"
          value={config.subtitle}
          onChange={(e) => setConfig((prev) => ({ ...prev, subtitle: e.target.value }))}
        />
      </Field>
      <Field label="每日行动力">
        <input
          type="number"
          min={1}
          className="rounded-lg border border-slate-300 px-3 py-2"
          value={config.maxEnergy}
          onChange={(e) => setConfig((prev) => ({ ...prev, maxEnergy: Math.max(1, Number(e.target.value) || 1) }))}
        />
      </Field>
      <Field label="默认场景">
        <select
          className="rounded-lg border border-slate-300 px-3 py-2"
          value={config.defaultSceneId}
          onChange={(e) => setConfig((prev) => ({ ...prev, defaultSceneId: e.target.value }))}
        >
          {config.scenes.map((scene) => (
            <option key={scene.id} value={scene.id}>
              {scene.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="md:col-span-2">
        <Field label="序章文本（每行一段）">
          <textarea
            rows={8}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            value={config.prologue.join('\n')}
            onChange={(e) => setConfig((prev) => ({ ...prev, prologue: e.target.value.split('\n').filter(Boolean) }))}
          />
        </Field>
      </div>
    </div>
  )
}
