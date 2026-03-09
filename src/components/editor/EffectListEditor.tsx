import { EditorBadge } from './shared'
import type { Effect, StatDef } from '@/lib/gameCore'

type EffectListEditorProps = {
  title: string
  effects: Effect[]
  stats: StatDef[]
  addLabel: string
  onStatIdChange: (index: number, value: string) => void
  onDeltaChange: (index: number, value: number) => void
  onRemove: (index: number) => void
  onAdd: () => void
}

export function EffectListEditor({ title, effects, stats, addLabel, onStatIdChange, onDeltaChange, onRemove, onAdd }: EffectListEditorProps) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-[0.12em] text-slate-500">{title}</p>
        <EditorBadge>{`${effects.length} 条`}</EditorBadge>
      </div>

      {effects.map((effect, index) => (
        <div key={`${effect.statId}-${index}`} className="grid grid-cols-[1fr_auto_auto] gap-2">
          <select className="rounded-lg border border-slate-300 px-2 py-2" value={effect.statId} onChange={(e) => onStatIdChange(index, e.target.value)}>
            {stats.map((stat) => (
              <option key={stat.id} value={stat.id}>
                {stat.name}
              </option>
            ))}
          </select>

          <input type="number" className="rounded-lg border border-slate-300 px-2 py-2" value={effect.delta} onChange={(e) => onDeltaChange(index, Number(e.target.value))} />

          <button className="rounded-lg bg-rose-100 px-2 py-2 text-rose-700" onClick={() => onRemove(index)} type="button">
            删除
          </button>
        </div>
      ))}

      <button className="rounded-lg bg-slate-100 px-2 py-1.5 text-sm" onClick={onAdd} type="button">
        {addLabel}
      </button>
    </div>
  )
}
