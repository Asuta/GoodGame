import { linesToText, textToLines } from './helpers'
import type { SectionState, SectionStateSetter } from './sectionState'
import { isSectionOpen, toggleSectionState } from './sectionState'
import { CollapsiblePanel, EditorBadge, Field } from './shared'
import type { NarrativeChoice, Operator, StatDef } from '@/lib/gameCore'

type NarrativeChoicePanelProps = {
  choice: NarrativeChoice
  choiceIndex: number
  ownerId: string
  stats: StatDef[]
  titlePrefix: string
  openState: SectionState
  setOpenState: SectionStateSetter
  defaultOpen: boolean
  onLabelChange: (value: string) => void
  onStatIdChange: (value: string) => void
  onOperatorChange: (value: Operator) => void
  onValueChange: (value: number) => void
  onSuccessLinesChange: (value: string[]) => void
  onFailLinesChange: (value: string[]) => void
  onRemove: () => void
}

const OPERATORS: Operator[] = ['>=', '<=', '>', '<', '=']

export function NarrativeChoicePanel({
  choice,
  choiceIndex,
  ownerId,
  stats,
  titlePrefix,
  openState,
  setOpenState,
  defaultOpen,
  onLabelChange,
  onStatIdChange,
  onOperatorChange,
  onValueChange,
  onSuccessLinesChange,
  onFailLinesChange,
  onRemove,
}: NarrativeChoicePanelProps) {
  const panelKey = `${ownerId}:${choice.id}`
  return (
    <CollapsiblePanel
      title={choice.label || `${titlePrefix} ${choiceIndex + 1}`}
      subtitle={`判定：${stats.find((stat) => stat.id === choice.statId)?.name || '未设置'} ${choice.operator} ${choice.value}`}
      meta={<EditorBadge>{choice.successLines.length + choice.failLines.length} 句回应</EditorBadge>}
      open={isSectionOpen(openState, panelKey, defaultOpen)}
      onToggle={() => toggleSectionState(setOpenState, panelKey, defaultOpen)}
      nested
    >
      <div className="space-y-3">
        <Field label="选项文本">
          <input className="rounded-lg border border-slate-300 px-3 py-2" value={choice.label} onChange={(e) => onLabelChange(e.target.value)} />
        </Field>

        <div className="grid gap-2 md:grid-cols-3">
          <Field label="判定属性">
            <select className="rounded-lg border border-slate-300 px-2 py-2" value={choice.statId} onChange={(e) => onStatIdChange(e.target.value)}>
              {stats.map((stat) => (
                <option key={stat.id} value={stat.id}>
                  {stat.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="判定符号">
            <select className="rounded-lg border border-slate-300 px-2 py-2" value={choice.operator} onChange={(e) => onOperatorChange(e.target.value as Operator)}>
              {OPERATORS.map((operator) => (
                <option key={operator} value={operator}>
                  {operator}
                </option>
              ))}
            </select>
          </Field>

          <Field label="判定值">
            <input type="number" className="rounded-lg border border-slate-300 px-2 py-2" value={choice.value} onChange={(e) => onValueChange(Number(e.target.value))} />
          </Field>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <Field label="成功回应（每行一句）">
            <textarea
              rows={3}
              className="rounded-lg border border-slate-300 px-3 py-2"
              value={linesToText(choice.successLines)}
              onChange={(e) => onSuccessLinesChange(textToLines(e.target.value))}
            />
          </Field>

          <Field label="失败回应（每行一句）">
            <textarea
              rows={3}
              className="rounded-lg border border-slate-300 px-3 py-2"
              value={linesToText(choice.failLines)}
              onChange={(e) => onFailLinesChange(textToLines(e.target.value))}
            />
          </Field>
        </div>

        <button className="rounded-lg bg-rose-100 px-2 py-1.5 text-sm text-rose-700" onClick={onRemove} type="button">
          删除分支
        </button>
      </div>
    </CollapsiblePanel>
  )
}
