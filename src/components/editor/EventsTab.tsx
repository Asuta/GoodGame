import type { StoryEvent } from '@/lib/gameCore'

import { linesToText, textToLines, type EditorTabProps } from './helpers'
import {
  addEventChoice,
  addEventCondition,
  addEventEffect,
  createEventTemplate,
  removeEventChoice,
  removeEventCondition,
  removeEventEffect,
  removeStoryEvent,
  updateEventChoice,
  updateEventCondition,
  updateEventEffect,
  updateStoryEvent,
} from './mutations'
import { NarrativeChoicePanel } from './NarrativeChoicePanel'
import type { SectionState, SectionStateSetter } from './sectionState'
import { isSectionOpen, toggleSectionState } from './sectionState'
import { CollapsiblePanel, EditorBadge, Field } from './shared'
import { ConditionListEditor } from './ConditionListEditor'
import { EffectListEditor } from './EffectListEditor'

type EventsTabProps = EditorTabProps & {
  openEvents: SectionState
  setOpenEvents: SectionStateSetter
  openEventChoices: SectionState
  setOpenEventChoices: SectionStateSetter
}

export function EventsTab({ config, setConfig, openEvents, setOpenEvents, openEventChoices, setOpenEventChoices }: EventsTabProps) {
  return (
    <div className="space-y-3">
      {config.events.map((event, eventIndex) => (
        <EventPanel
          key={event.id}
          event={event}
          eventIndex={eventIndex}
          config={config}
          setConfig={setConfig}
          openEvents={openEvents}
          setOpenEvents={setOpenEvents}
          openEventChoices={openEventChoices}
          setOpenEventChoices={setOpenEventChoices}
        />
      ))}

      <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white" onClick={() => setConfig((prev) => ({ ...prev, events: [...prev.events, createEventTemplate(prev)] }))} type="button">
        新增事件
      </button>
    </div>
  )
}

type EventPanelProps = EditorTabProps & {
  event: StoryEvent
  eventIndex: number
  openEvents: SectionState
  setOpenEvents: SectionStateSetter
  openEventChoices: SectionState
  setOpenEventChoices: SectionStateSetter
}

function EventPanel({ event, eventIndex, config, setConfig, openEvents, setOpenEvents, openEventChoices, setOpenEventChoices }: EventPanelProps) {
  const choiceCount = event.narrative?.choices?.length || 0

  return (
    <CollapsiblePanel
      title={event.title || `未命名事件 ${eventIndex + 1}`}
      subtitle={event.description || '展开后编辑触发条件、剧情文本和事件效果。'}
      meta={
        <>
          <EditorBadge>{event.repeatable ? '可重复' : '单次'}</EditorBadge>
          <EditorBadge>{`${event.conditions.length} 条件`}</EditorBadge>
          <EditorBadge>{`${event.effects.length} 效果`}</EditorBadge>
        </>
      }
      open={isSectionOpen(openEvents, event.id, eventIndex === 0)}
      onToggle={() => toggleSectionState(setOpenEvents, event.id, eventIndex === 0)}
    >
      <div className="space-y-3">
        <Field label="事件标题">
          <input className="rounded-lg border border-slate-300 px-3 py-2" value={event.title} onChange={(e) => setConfig((prev) => updateStoryEvent(prev, event.id, (item) => ({ ...item, title: e.target.value })))} />
        </Field>

        <Field label="事件文本">
          <input className="rounded-lg border border-slate-300 px-3 py-2" value={event.description} onChange={(e) => setConfig((prev) => updateStoryEvent(prev, event.id, (item) => ({ ...item, description: e.target.value })))} />
        </Field>

        <div className="grid gap-2 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={event.repeatable} onChange={(e) => setConfig((prev) => updateStoryEvent(prev, event.id, (item) => ({ ...item, repeatable: e.target.checked })))} />
            可重复触发
          </label>

          <Field label="触发后场景">
            <select className="rounded-lg border border-slate-300 px-3 py-2" value={event.sceneId || ''} onChange={(e) => setConfig((prev) => updateStoryEvent(prev, event.id, (item) => ({ ...item, sceneId: e.target.value || undefined })))}>
              <option value="">不改变场景</option>
              {config.scenes.map((scene) => (
                <option key={scene.id} value={scene.id}>
                  {scene.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="事件对话（每行一句，触发后逐条播放）">
          <textarea
            rows={4}
            className="rounded-lg border border-slate-300 px-3 py-2"
            value={linesToText(event.narrative?.lines)}
            onChange={(e) =>
              setConfig((prev) =>
                updateStoryEvent(prev, event.id, (item) => ({
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

        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold tracking-[0.12em] text-slate-500">事件对话分支</p>
            <EditorBadge>{`${choiceCount} 个分支`}</EditorBadge>
          </div>

          {(event.narrative?.choices || []).map((choice, choiceIndex) => (
            <NarrativeChoicePanel
              key={`${event.id}-choice-${choice.id}`}
              choice={choice}
              choiceIndex={choiceIndex}
              ownerId={event.id}
              stats={config.stats}
              titlePrefix="事件分支"
              openState={openEventChoices}
              setOpenState={setOpenEventChoices}
              defaultOpen={choiceIndex === 0}
              onLabelChange={(value) => setConfig((prev) => updateEventChoice(prev, event.id, choiceIndex, (item) => ({ ...item, label: value })))}
              onStatIdChange={(value) => setConfig((prev) => updateEventChoice(prev, event.id, choiceIndex, (item) => ({ ...item, statId: value })))}
              onOperatorChange={(value) => setConfig((prev) => updateEventChoice(prev, event.id, choiceIndex, (item) => ({ ...item, operator: value })))}
              onValueChange={(value) => setConfig((prev) => updateEventChoice(prev, event.id, choiceIndex, (item) => ({ ...item, value })))}
              onSuccessLinesChange={(value) => setConfig((prev) => updateEventChoice(prev, event.id, choiceIndex, (item) => ({ ...item, successLines: value })))}
              onFailLinesChange={(value) => setConfig((prev) => updateEventChoice(prev, event.id, choiceIndex, (item) => ({ ...item, failLines: value })))}
              onRemove={() => setConfig((prev) => removeEventChoice(prev, event.id, choiceIndex))}
            />
          ))}

          <button className="w-fit rounded-lg bg-slate-100 px-2 py-1.5 text-sm" onClick={() => setConfig((prev) => addEventChoice(prev, event.id))} type="button">
            新增事件分支
          </button>
        </div>

        <ConditionListEditor
          conditions={event.conditions}
          stats={config.stats}
          onStatIdChange={(index, value) => setConfig((prev) => updateEventCondition(prev, event.id, index, (condition) => ({ ...condition, statId: value })))}
          onOperatorChange={(index, value) => setConfig((prev) => updateEventCondition(prev, event.id, index, (condition) => ({ ...condition, operator: value })))}
          onValueChange={(index, value) => setConfig((prev) => updateEventCondition(prev, event.id, index, (condition) => ({ ...condition, value })))}
          onRemove={(index) => setConfig((prev) => removeEventCondition(prev, event.id, index))}
          onAdd={() => setConfig((prev) => addEventCondition(prev, event.id))}
        />

        <EffectListEditor
          title="触发效果"
          effects={event.effects}
          stats={config.stats}
          addLabel="新增效果"
          onStatIdChange={(index, value) => setConfig((prev) => updateEventEffect(prev, event.id, index, (effect) => ({ ...effect, statId: value })))}
          onDeltaChange={(index, value) => setConfig((prev) => updateEventEffect(prev, event.id, index, (effect) => ({ ...effect, delta: value })))}
          onRemove={(index) => setConfig((prev) => removeEventEffect(prev, event.id, index))}
          onAdd={() => setConfig((prev) => addEventEffect(prev, event.id))}
        />

        <button className="rounded-lg bg-rose-100 px-2 py-1.5 text-sm text-rose-700" onClick={() => setConfig((prev) => removeStoryEvent(prev, event.id))} type="button">
          删除事件
        </button>
      </div>
    </CollapsiblePanel>
  )
}
