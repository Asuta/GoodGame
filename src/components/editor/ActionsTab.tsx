import type { DailyAction } from '@/lib/gameCore'

import { linesToText, textToLines, type EditorTabProps } from './helpers'
import {
  addActionChoice,
  addActionEffect,
  createActionTemplate,
  removeActionChoice,
  removeActionEffect,
  removeDailyAction,
  selectAllActionTimeSlots,
  toggleActionTimeSlot,
  updateActionChoice,
  updateActionEffect,
  updateDailyAction,
} from './mutations'
import { NarrativeChoicePanel } from './NarrativeChoicePanel'
import type { SectionState, SectionStateSetter } from './sectionState'
import { isSectionOpen, toggleSectionState } from './sectionState'
import { CollapsiblePanel, EditorBadge, Field } from './shared'
import { EffectListEditor } from './EffectListEditor'

type ActionsTabProps = EditorTabProps & {
  openActions: SectionState
  setOpenActions: SectionStateSetter
  openActionChoices: SectionState
  setOpenActionChoices: SectionStateSetter
}

export function ActionsTab({ config, setConfig, openActions, setOpenActions, openActionChoices, setOpenActionChoices }: ActionsTabProps) {
  return (
    <div className="space-y-3">
      {config.dailyActions.map((action, actionIndex) => (
        <ActionPanel
          key={action.id}
          action={action}
          actionIndex={actionIndex}
          config={config}
          setConfig={setConfig}
          openActions={openActions}
          setOpenActions={setOpenActions}
          openActionChoices={openActionChoices}
          setOpenActionChoices={setOpenActionChoices}
        />
      ))}

      <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white" onClick={() => setConfig((prev) => ({ ...prev, dailyActions: [...prev.dailyActions, createActionTemplate(prev)] }))} type="button">
        新增日常选项
      </button>
    </div>
  )
}

type ActionPanelProps = EditorTabProps & {
  action: DailyAction
  actionIndex: number
  openActions: SectionState
  setOpenActions: SectionStateSetter
  openActionChoices: SectionState
  setOpenActionChoices: SectionStateSetter
}

function ActionPanel({ action, actionIndex, config, setConfig, openActions, setOpenActions, openActionChoices, setOpenActionChoices }: ActionPanelProps) {
  const choiceCount = action.narrative?.choices?.length || 0

  return (
    <CollapsiblePanel
      title={action.name || `未命名选项 ${actionIndex + 1}`}
      subtitle={action.description || '展开后编辑文本、时间段、分支和数值效果。'}
      meta={
        <>
          <EditorBadge>{`${action.cost} 次`}</EditorBadge>
          <EditorBadge>{`${choiceCount} 分支`}</EditorBadge>
          <EditorBadge>{`${action.effects.length} 影响`}</EditorBadge>
        </>
      }
      open={isSectionOpen(openActions, action.id, actionIndex === 0)}
      onToggle={() => toggleSectionState(setOpenActions, action.id, actionIndex === 0)}
    >
      <div className="space-y-3">
        <Field label="选项名">
          <input className="rounded-lg border border-slate-300 px-3 py-2" value={action.name} onChange={(e) => setConfig((prev) => updateDailyAction(prev, action.id, (item) => ({ ...item, name: e.target.value })))} />
        </Field>

        <Field label="描述">
          <input className="rounded-lg border border-slate-300 px-3 py-2" value={action.description} onChange={(e) => setConfig((prev) => updateDailyAction(prev, action.id, (item) => ({ ...item, description: e.target.value })))} />
        </Field>

        <Field label="反馈文本">
          <input className="rounded-lg border border-slate-300 px-3 py-2" value={action.flavor} onChange={(e) => setConfig((prev) => updateDailyAction(prev, action.id, (item) => ({ ...item, flavor: e.target.value })))} />
        </Field>

        <Field label="对话脚本（每行一句，执行后逐条播放）">
          <textarea
            rows={4}
            className="rounded-lg border border-slate-300 px-3 py-2"
            value={linesToText(action.narrative?.lines)}
            onChange={(e) =>
              setConfig((prev) =>
                updateDailyAction(prev, action.id, (item) => ({
                  ...item,
                  narrative: {
                    lines: textToLines(e.target.value),
                    choices: item.narrative?.choices || [],
                  },
                })),
              )
            }
          />
        </Field>

        <div className="grid gap-2 md:grid-cols-2">
          <Field label="行动消耗">
            <input
              type="number"
              min={1}
              className="rounded-lg border border-slate-300 px-3 py-2"
              value={action.cost}
              onChange={(e) => setConfig((prev) => updateDailyAction(prev, action.id, (item) => ({ ...item, cost: Math.max(1, Number(e.target.value) || 1) })))}
            />
          </Field>

          <Field label="绑定场景">
            <select className="rounded-lg border border-slate-300 px-3 py-2" value={action.sceneId || ''} onChange={(e) => setConfig((prev) => updateDailyAction(prev, action.id, (item) => ({ ...item, sceneId: e.target.value || undefined })))}>
              <option value="">不改变场景</option>
              {config.scenes.map((scene) => (
                <option key={scene.id} value={scene.id}>
                  {scene.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Time slots">
          <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
            {config.timeSlots.map((slot) => {
              const checked = action.availableTimeSlotIds?.includes(slot.id) ?? false
              return (
                <label key={slot.id} className="flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700">
                  <input checked={checked} onChange={(e) => setConfig((prev) => toggleActionTimeSlot(prev, action.id, slot.id, e.target.checked))} type="checkbox" />
                  <span>{slot.label}</span>
                </label>
              )
            })}

            <button className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm" onClick={() => setConfig((prev) => selectAllActionTimeSlots(prev, action.id))} type="button">
              All
            </button>
          </div>
        </Field>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold tracking-[0.12em] text-slate-500">对话分支选项</p>
            <EditorBadge>{`${choiceCount} 个分支`}</EditorBadge>
          </div>

          {(action.narrative?.choices || []).map((choice, choiceIndex) => (
            <NarrativeChoicePanel
              key={`${action.id}-choice-${choice.id}`}
              choice={choice}
              choiceIndex={choiceIndex}
              ownerId={action.id}
              stats={config.stats}
              titlePrefix="分支"
              openState={openActionChoices}
              setOpenState={setOpenActionChoices}
              defaultOpen={choiceIndex === 0}
              onLabelChange={(value) => setConfig((prev) => updateActionChoice(prev, action.id, choiceIndex, (item) => ({ ...item, label: value })))}
              onStatIdChange={(value) => setConfig((prev) => updateActionChoice(prev, action.id, choiceIndex, (item) => ({ ...item, statId: value })))}
              onOperatorChange={(value) => setConfig((prev) => updateActionChoice(prev, action.id, choiceIndex, (item) => ({ ...item, operator: value })))}
              onValueChange={(value) => setConfig((prev) => updateActionChoice(prev, action.id, choiceIndex, (item) => ({ ...item, value })))}
              onSuccessLinesChange={(value) => setConfig((prev) => updateActionChoice(prev, action.id, choiceIndex, (item) => ({ ...item, successLines: value })))}
              onFailLinesChange={(value) => setConfig((prev) => updateActionChoice(prev, action.id, choiceIndex, (item) => ({ ...item, failLines: value })))}
              onRemove={() => setConfig((prev) => removeActionChoice(prev, action.id, choiceIndex))}
            />
          ))}

          <button className="w-fit rounded-lg bg-slate-100 px-2 py-1.5 text-sm" onClick={() => setConfig((prev) => addActionChoice(prev, action.id))} type="button">
            新增对话分支
          </button>
        </div>

        <EffectListEditor
          title="数值影响"
          effects={action.effects}
          stats={config.stats}
          addLabel="新增影响"
          onStatIdChange={(index, value) => setConfig((prev) => updateActionEffect(prev, action.id, index, (effect) => ({ ...effect, statId: value })))}
          onDeltaChange={(index, value) => setConfig((prev) => updateActionEffect(prev, action.id, index, (effect) => ({ ...effect, delta: value })))}
          onRemove={(index) => setConfig((prev) => removeActionEffect(prev, action.id, index))}
          onAdd={() => setConfig((prev) => addActionEffect(prev, action.id))}
        />

        <button className="rounded-lg bg-rose-100 px-2 py-1.5 text-sm text-rose-700" onClick={() => setConfig((prev) => removeDailyAction(prev, action.id))} type="button">
          删除选项
        </button>
      </div>
    </CollapsiblePanel>
  )
}
