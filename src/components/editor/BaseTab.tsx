import { nextId } from '@/lib/gameCore'

import type { EditorTabProps } from './helpers'
import { Field } from './shared'

export function BaseTab({ config, setConfig }: EditorTabProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="Game title">
        <input
          className="rounded-lg border border-slate-300 px-3 py-2"
          value={config.title}
          onChange={(e) => setConfig((prev) => ({ ...prev, title: e.target.value }))}
        />
      </Field>
      <Field label="Subtitle">
        <input
          className="rounded-lg border border-slate-300 px-3 py-2"
          value={config.subtitle}
          onChange={(e) => setConfig((prev) => ({ ...prev, subtitle: e.target.value }))}
        />
      </Field>
      <Field label="Time slots per day">
        <input type="number" min={1} className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-500" value={config.timeSlots.length} disabled />
      </Field>
      <Field label="Default scene">
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
        <Field label="Time slots">
          <div className="space-y-2 rounded-xl border border-slate-200 p-3">
            {config.timeSlots.map((slot) => (
              <div key={slot.id} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Slot ID"
                  value={slot.id}
                  onChange={(e) => {
                    const value = e.target.value.trim()
                    setConfig((prev) => ({
                      ...prev,
                      timeSlots: prev.timeSlots.map((item) => (item.id === slot.id ? { ...item, id: value || item.id } : item)),
                      dailyActions: prev.dailyActions.map((action) => ({
                        ...action,
                        availableTimeSlotIds: action.availableTimeSlotIds?.map((slotId) => (slotId === slot.id ? value || slot.id : slotId)),
                      })),
                    }))
                  }}
                />
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Label"
                  value={slot.label}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      timeSlots: prev.timeSlots.map((item) => (item.id === slot.id ? { ...item, label: e.target.value } : item)),
                    }))
                  }
                />
                <button
                  className="rounded-lg bg-rose-100 px-3 py-2 text-sm text-rose-700 disabled:opacity-50"
                  disabled={config.timeSlots.length <= 1}
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      timeSlots: prev.timeSlots.filter((item) => item.id !== slot.id),
                      dailyActions: prev.dailyActions.map((action) => ({
                        ...action,
                        availableTimeSlotIds: action.availableTimeSlotIds?.filter((slotId) => slotId !== slot.id),
                      })),
                    }))
                  }
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white"
              onClick={() =>
                setConfig((prev) => ({
                  ...prev,
                  timeSlots: [
                    ...prev.timeSlots,
                    {
                      id: nextId('slot'),
                      label: `Slot ${prev.timeSlots.length + 1}`,
                    },
                  ],
                }))
              }
              type="button"
            >
              Add slot
            </button>
          </div>
        </Field>
      </div>
      <div className="md:col-span-2">
        <Field label="Prologue lines (one per row)">
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
