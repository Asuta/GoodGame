import { nextId } from '@/lib/gameCore'

import type { EditorTabProps } from './helpers'
import { Field } from './shared'

export function StatsTab({ config, setConfig }: EditorTabProps) {
  return (
    <div className="space-y-3">
      {config.stats.map((stat) => (
        <div key={stat.id} className="grid gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-2">
          <Field label={`属性名 (${stat.id})`}>
            <input
              className="rounded-lg border border-slate-300 px-3 py-2"
              value={stat.name}
              onChange={(e) => setConfig((prev) => ({ ...prev, stats: prev.stats.map((item) => (item.id === stat.id ? { ...item, name: e.target.value } : item)) }))}
            />
          </Field>
          <Field label="默认值">
            <input
              type="number"
              className="rounded-lg border border-slate-300 px-3 py-2"
              value={stat.defaultValue}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, stats: prev.stats.map((item) => (item.id === stat.id ? { ...item, defaultValue: Number(e.target.value) } : item)) }))
              }
            />
          </Field>
          <Field label="最小值">
            <input
              type="number"
              className="rounded-lg border border-slate-300 px-3 py-2"
              value={stat.min}
              onChange={(e) => setConfig((prev) => ({ ...prev, stats: prev.stats.map((item) => (item.id === stat.id ? { ...item, min: Number(e.target.value) } : item)) }))}
            />
          </Field>
          <Field label="最大值">
            <input
              type="number"
              className="rounded-lg border border-slate-300 px-3 py-2"
              value={stat.max}
              onChange={(e) => setConfig((prev) => ({ ...prev, stats: prev.stats.map((item) => (item.id === stat.id ? { ...item, max: Number(e.target.value) } : item)) }))}
            />
          </Field>
          <Field label="说明">
            <input
              className="rounded-lg border border-slate-300 px-3 py-2"
              value={stat.description}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, stats: prev.stats.map((item) => (item.id === stat.id ? { ...item, description: e.target.value } : item)) }))
              }
            />
          </Field>
          <button
            className="h-fit rounded-lg bg-rose-100 px-3 py-2 text-sm text-rose-700"
            onClick={() =>
              setConfig((prev) => ({
                ...prev,
                stats: prev.stats.filter((item) => item.id !== stat.id),
                dailyActions: prev.dailyActions.map((action) => ({
                  ...action,
                  effects: action.effects.filter((effect) => effect.statId !== stat.id),
                  narrative: action.narrative
                    ? {
                        lines: action.narrative.lines,
                        choices: action.narrative.choices
                          .filter((choice) => choice.statId !== stat.id)
                          .map((choice) => ({
                            ...choice,
                            successEffects: choice.successEffects.filter((effect) => effect.statId !== stat.id),
                            failEffects: choice.failEffects.filter((effect) => effect.statId !== stat.id),
                          })),
                      }
                    : undefined,
                })),
                events: prev.events.map((event) => ({
                  ...event,
                  conditions: event.conditions.filter((condition) => condition.statId !== stat.id),
                  effects: event.effects.filter((effect) => effect.statId !== stat.id),
                  narrative: event.narrative
                    ? {
                        lines: event.narrative.lines,
                        choices: event.narrative.choices
                          .filter((choice) => choice.statId !== stat.id)
                          .map((choice) => ({
                            ...choice,
                            successEffects: choice.successEffects.filter((effect) => effect.statId !== stat.id),
                            failEffects: choice.failEffects.filter((effect) => effect.statId !== stat.id),
                          })),
                      }
                    : undefined,
                })),
              }))
            }
          >
            删除属性
          </button>
        </div>
      ))}

      <button
        className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white"
        onClick={() =>
          setConfig((prev) => ({
            ...prev,
            stats: [...prev.stats, { id: nextId('stat'), name: '新属性', min: 0, max: 100, defaultValue: 10, description: '请填写说明' }],
          }))
        }
      >
        新增属性
      </button>
    </div>
  )
}
