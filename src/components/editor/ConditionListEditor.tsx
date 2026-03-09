import { EditorBadge } from './shared'
import type { EventCondition, Operator, StatDef } from '@/lib/gameCore'

type ConditionListEditorProps = {
  conditions: EventCondition[]
  stats: StatDef[]
  onStatIdChange: (index: number, value: string) => void
  onOperatorChange: (index: number, value: Operator) => void
  onValueChange: (index: number, value: number) => void
  onRemove: (index: number) => void
  onAdd: () => void
}

const OPERATORS: Operator[] = ['>=', '<=', '>', '<', '=']

export function ConditionListEditor({ conditions, stats, onStatIdChange, onOperatorChange, onValueChange, onRemove, onAdd }: ConditionListEditorProps) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-[0.12em] text-slate-500">触发条件</p>
        <EditorBadge>{`${conditions.length} 条`}</EditorBadge>
      </div>

      {conditions.map((condition, index) => (
        <div key={`${condition.statId}-${index}`} className="grid grid-cols-[1fr_auto_auto_auto] gap-2">
          <select className="rounded-lg border border-slate-300 px-2 py-2" value={condition.statId} onChange={(e) => onStatIdChange(index, e.target.value)}>
            {stats.map((stat) => (
              <option key={stat.id} value={stat.id}>
                {stat.name}
              </option>
            ))}
          </select>

          <select className="rounded-lg border border-slate-300 px-2 py-2" value={condition.operator} onChange={(e) => onOperatorChange(index, e.target.value as Operator)}>
            {OPERATORS.map((operator) => (
              <option key={operator} value={operator}>
                {operator}
              </option>
            ))}
          </select>

          <input type="number" className="rounded-lg border border-slate-300 px-2 py-2" value={condition.value} onChange={(e) => onValueChange(index, Number(e.target.value))} />

          <button className="rounded-lg bg-rose-100 px-2 py-2 text-rose-700" onClick={() => onRemove(index)} type="button">
            删除
          </button>
        </div>
      ))}

      <button className="rounded-lg bg-slate-100 px-2 py-1.5 text-sm" onClick={onAdd} type="button">
        新增条件
      </button>
    </div>
  )
}
