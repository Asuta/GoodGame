import { Link } from 'react-router-dom'
import { useState, type Dispatch, type SetStateAction } from 'react'

import { AiTab } from '@/components/editor/AiTab'
import { BaseTab } from '@/components/editor/BaseTab'
import { DataTab } from '@/components/editor/DataTab'
import { linesToText, textToLines } from '@/components/editor/helpers'
import { MediaTab } from '@/components/editor/MediaTab'
import { CollapsiblePanel, EditorBadge, Field } from '@/components/editor/shared'
import { StatsTab } from '@/components/editor/StatsTab'
import { useGameConfig } from '@/hooks/useGameConfig'
import { DEFAULT_CONFIG, nextId, type Operator } from '@/lib/gameCore'

function isSectionOpen(state: Record<string, boolean>, key: string, defaultOpen = false) {
  return state[key] ?? defaultOpen
}

function toggleSectionState(
  setter: Dispatch<SetStateAction<Record<string, boolean>>>,
  key: string,
  defaultOpen = false,
) {
  setter((prev) => ({
    ...prev,
    [key]: !(prev[key] ?? defaultOpen),
  }))
}

export default function Editor() {
  const { config, setConfig, resetConfig } = useGameConfig()
  const [tab, setTab] = useState<'base' | 'ai' | 'media' | 'stats' | 'actions' | 'events' | 'data'>('base')
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')
  const [openActions, setOpenActions] = useState<Record<string, boolean>>({})
  const [openActionChoices, setOpenActionChoices] = useState<Record<string, boolean>>({})
  const [openEvents, setOpenEvents] = useState<Record<string, boolean>>({})
  const [openEventChoices, setOpenEventChoices] = useState<Record<string, boolean>>({})

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1400px] px-3 py-4 md:px-6 md:py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-300/40 bg-white/70 px-4 py-3 backdrop-blur">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Editor Window</p>
          <h1 className="text-xl font-semibold text-slate-800">剧情与养成编辑器</h1>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link className="rounded-lg bg-slate-900 px-3 py-1.5 text-white" to="/">
            回到游戏
          </Link>
          <button className="rounded-lg bg-amber-700 px-3 py-1.5 text-white" onClick={() => setConfig(DEFAULT_CONFIG)}>
            载入模板
          </button>
          <button className="rounded-lg bg-slate-200 px-3 py-1.5 text-slate-800" onClick={resetConfig}>
            重置配置
          </button>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-300/40 bg-white/85 p-4 shadow-xl shadow-slate-300/30 backdrop-blur md:p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            ['base', '基础'],
            ['ai', 'AI 配置'],
            ['media', '图片场景'],
            ['stats', '属性'],
            ['actions', '日常选项'],
            ['events', '事件'],
            ['data', '数据'],
          ].map(([key, label]) => (
            <button
              key={key}
              className={`rounded-full px-3 py-1.5 text-sm ${tab === key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
              onClick={() => setTab(key as typeof tab)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'base' && (
          <BaseTab config={config} setConfig={setConfig} />
        )}

        {tab === 'ai' && (
          <AiTab config={config} setConfig={setConfig} />
        )}

        {tab === 'media' && (
          <MediaTab config={config} setConfig={setConfig} />
        )}

        {tab === 'stats' && (
          <StatsTab config={config} setConfig={setConfig} />
        )}

        {tab === 'actions' && (
          <div className="space-y-3">
            {config.dailyActions.map((action, actionIndex) => {
              const actionOpen = isSectionOpen(openActions, action.id, actionIndex === 0)
              return (
                <CollapsiblePanel
                  key={action.id}
                  title={action.name || `未命名选项 ${actionIndex + 1}`}
                  subtitle={action.description || '展开后编辑文本、时间段、分支和数值效果。'}
                  meta={
                    <>
                      <EditorBadge>{`${action.cost} 次`}</EditorBadge>
                      <EditorBadge>{`${(action.narrative?.choices || []).length} 分支`}</EditorBadge>
                      <EditorBadge>{`${action.effects.length} 影响`}</EditorBadge>
                    </>
                  }
                  open={actionOpen}
                  onToggle={() => toggleSectionState(setOpenActions, action.id, actionIndex === 0)}
                >
                  <div className="space-y-3">
                <Field label="选项名">
                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2"
                    value={action.name}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, dailyActions: prev.dailyActions.map((item) => (item.id === action.id ? { ...item, name: e.target.value } : item)) }))
                    }
                  />
                </Field>
                <Field label="描述">
                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2"
                    value={action.description}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        dailyActions: prev.dailyActions.map((item) => (item.id === action.id ? { ...item, description: e.target.value } : item)),
                      }))
                    }
                  />
                </Field>
                <Field label="反馈文本">
                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2"
                    value={action.flavor}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, dailyActions: prev.dailyActions.map((item) => (item.id === action.id ? { ...item, flavor: e.target.value } : item)) }))
                    }
                  />
                </Field>
                <Field label="对话脚本（每行一句，执行后逐条播放）">
                  <textarea
                    rows={4}
                    className="rounded-lg border border-slate-300 px-3 py-2"
                    value={linesToText(action.narrative?.lines)}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        dailyActions: prev.dailyActions.map((item) =>
                          item.id === action.id
                            ? {
                                ...item,
                                narrative: {
                                  lines: textToLines(e.target.value),
                                  choices: item.narrative?.choices || [],
                                },
                              }
                            : item,
                        ),
                      }))
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
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          dailyActions: prev.dailyActions.map((item) =>
                            item.id === action.id ? { ...item, cost: Math.max(1, Number(e.target.value) || 1) } : item,
                          ),
                        }))
                      }
                    />
                  </Field>
                  <Field label="绑定场景">
                    <select
                      className="rounded-lg border border-slate-300 px-3 py-2"
                      value={action.sceneId || ''}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          dailyActions: prev.dailyActions.map((item) => (item.id === action.id ? { ...item, sceneId: e.target.value || undefined } : item)),
                        }))
                      }
                    >
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
                          <input
                            checked={checked}
                            onChange={(e) =>
                              setConfig((prev) => ({
                                ...prev,
                                dailyActions: prev.dailyActions.map((item) => {
                                  if (item.id !== action.id) return item
                                  const nextIds = new Set(item.availableTimeSlotIds && item.availableTimeSlotIds.length > 0 ? item.availableTimeSlotIds : prev.timeSlots.map((timeSlot) => timeSlot.id))
                                  if (e.target.checked) nextIds.add(slot.id)
                                  else nextIds.delete(slot.id)
                                  return { ...item, availableTimeSlotIds: Array.from(nextIds) }
                                }),
                              }))
                            }
                            type="checkbox"
                          />
                          <span>{slot.label}</span>
                        </label>
                      )
                    })}
                    <button
                      className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          dailyActions: prev.dailyActions.map((item) => (item.id === action.id ? { ...item, availableTimeSlotIds: prev.timeSlots.map((slot) => slot.id) } : item)),
                        }))
                      }
                      type="button"
                    >
                      All
                    </button>
                  </div>
                </Field>


                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold tracking-[0.12em] text-slate-500">对话分支选项</p>
                    <EditorBadge>{`${(action.narrative?.choices || []).length} 个分支`}</EditorBadge>
                  </div>
                {(action.narrative?.choices || []).map((choice, choiceIndex) => (
                  <CollapsiblePanel
                    key={`${action.id}-choice-${choice.id}`}
                    title={choice.label || `分支 ${choiceIndex + 1}`}
                    subtitle={`判定：${config.stats.find((stat) => stat.id === choice.statId)?.name || '未设置'} ${choice.operator} ${choice.value}`}
                    meta={<EditorBadge>{choice.successLines.length + choice.failLines.length} 句回应</EditorBadge>}
                    open={isSectionOpen(openActionChoices, `${action.id}:${choice.id}`, choiceIndex === 0)}
                    onToggle={() => toggleSectionState(setOpenActionChoices, `${action.id}:${choice.id}`, choiceIndex === 0)}
                    nested
                  >
                    <div className="space-y-3">
                    <Field label="选项文本">
                      <input
                        className="rounded-lg border border-slate-300 px-3 py-2"
                        value={choice.label}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            dailyActions: prev.dailyActions.map((item) =>
                              item.id === action.id
                                ? {
                                    ...item,
                                    narrative: {
                                      lines: item.narrative?.lines || [],
                                      choices: (item.narrative?.choices || []).map((option, index) =>
                                        index === choiceIndex ? { ...option, label: e.target.value } : option,
                                      ),
                                    },
                                  }
                                : item,
                            ),
                          }))
                        }
                      />
                    </Field>

                    <div className="grid gap-2 md:grid-cols-3">
                      <Field label="判定属性">
                        <select
                          className="rounded-lg border border-slate-300 px-2 py-2"
                          value={choice.statId}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              dailyActions: prev.dailyActions.map((item) =>
                                item.id === action.id
                                  ? {
                                      ...item,
                                      narrative: {
                                        lines: item.narrative?.lines || [],
                                        choices: (item.narrative?.choices || []).map((option, index) =>
                                          index === choiceIndex ? { ...option, statId: e.target.value } : option,
                                        ),
                                      },
                                    }
                                  : item,
                              ),
                            }))
                          }
                        >
                          {config.stats.map((stat) => (
                            <option key={stat.id} value={stat.id}>
                              {stat.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="判定符号">
                        <select
                          className="rounded-lg border border-slate-300 px-2 py-2"
                          value={choice.operator}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              dailyActions: prev.dailyActions.map((item) =>
                                item.id === action.id
                                  ? {
                                      ...item,
                                      narrative: {
                                        lines: item.narrative?.lines || [],
                                        choices: (item.narrative?.choices || []).map((option, index) =>
                                          index === choiceIndex ? { ...option, operator: e.target.value as Operator } : option,
                                        ),
                                      },
                                    }
                                  : item,
                              ),
                            }))
                          }
                        >
                          {['>=', '<=', '>', '<', '='].map((op) => (
                            <option key={op} value={op}>
                              {op}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="判定值">
                        <input
                          type="number"
                          className="rounded-lg border border-slate-300 px-2 py-2"
                          value={choice.value}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              dailyActions: prev.dailyActions.map((item) =>
                                item.id === action.id
                                  ? {
                                      ...item,
                                      narrative: {
                                        lines: item.narrative?.lines || [],
                                        choices: (item.narrative?.choices || []).map((option, index) =>
                                          index === choiceIndex ? { ...option, value: Number(e.target.value) } : option,
                                        ),
                                      },
                                    }
                                  : item,
                              ),
                            }))
                          }
                        />
                      </Field>
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
                      <Field label="成功回应（每行一句）">
                        <textarea
                          rows={3}
                          className="rounded-lg border border-slate-300 px-3 py-2"
                          value={linesToText(choice.successLines)}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              dailyActions: prev.dailyActions.map((item) =>
                                item.id === action.id
                                  ? {
                                      ...item,
                                      narrative: {
                                        lines: item.narrative?.lines || [],
                                        choices: (item.narrative?.choices || []).map((option, index) =>
                                          index === choiceIndex ? { ...option, successLines: textToLines(e.target.value) } : option,
                                        ),
                                      },
                                    }
                                  : item,
                              ),
                            }))
                          }
                        />
                      </Field>
                      <Field label="失败回应（每行一句）">
                        <textarea
                          rows={3}
                          className="rounded-lg border border-slate-300 px-3 py-2"
                          value={linesToText(choice.failLines)}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              dailyActions: prev.dailyActions.map((item) =>
                                item.id === action.id
                                  ? {
                                      ...item,
                                      narrative: {
                                        lines: item.narrative?.lines || [],
                                        choices: (item.narrative?.choices || []).map((option, index) =>
                                          index === choiceIndex ? { ...option, failLines: textToLines(e.target.value) } : option,
                                        ),
                                      },
                                    }
                                  : item,
                              ),
                            }))
                          }
                        />
                      </Field>
                    </div>

                    <button
                      className="rounded-lg bg-rose-100 px-2 py-1.5 text-sm text-rose-700"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          dailyActions: prev.dailyActions.map((item) =>
                            item.id === action.id
                              ? {
                                  ...item,
                                  narrative: {
                                    lines: item.narrative?.lines || [],
                                    choices: (item.narrative?.choices || []).filter((_, index) => index !== choiceIndex),
                                  },
                                }
                              : item,
                          ),
                        }))
                      }
                    >
                      删除分支
                    </button>
                    </div>
                  </CollapsiblePanel>
                ))}

                <button
                  className="w-fit rounded-lg bg-slate-100 px-2 py-1.5 text-sm"
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      dailyActions: prev.dailyActions.map((item) =>
                        item.id === action.id
                          ? {
                              ...item,
                              narrative: {
                                lines: item.narrative?.lines || [],
                                choices: [
                                  ...(item.narrative?.choices || []),
                                  {
                                    id: nextId('choice'),
                                    label: '对她说点什么',
                                    statId: prev.stats[0]?.id || '',
                                    operator: '>=',
                                    value: 50,
                                    successLines: ['她看起来放松了一些。'],
                                    failLines: ['她没有回应。'],
                                    successEffects: [],
                                    failEffects: [],
                                  },
                                ],
                              },
                            }
                          : item,
                      ),
                    }))
                  }
                >
                  新增对话分支
                </button>
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold tracking-[0.12em] text-slate-500">数值影响</p>
                    <EditorBadge>{`${action.effects.length} 条`}</EditorBadge>
                  </div>
                {action.effects.map((effect, index) => (
                  <div key={`${action.id}-${index}`} className="grid grid-cols-[1fr_auto_auto] gap-2">
                    <select
                      className="rounded-lg border border-slate-300 px-2 py-2"
                      value={effect.statId}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          dailyActions: prev.dailyActions.map((item) =>
                            item.id === action.id
                              ? {
                                  ...item,
                                  effects: item.effects.map((itemEffect, itemIndex) =>
                                    itemIndex === index ? { ...itemEffect, statId: e.target.value } : itemEffect,
                                  ),
                                }
                              : item,
                          ),
                        }))
                      }
                    >
                      {config.stats.map((stat) => (
                        <option key={stat.id} value={stat.id}>
                          {stat.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="rounded-lg border border-slate-300 px-2 py-2"
                      value={effect.delta}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          dailyActions: prev.dailyActions.map((item) =>
                            item.id === action.id
                              ? {
                                  ...item,
                                  effects: item.effects.map((itemEffect, itemIndex) =>
                                    itemIndex === index ? { ...itemEffect, delta: Number(e.target.value) } : itemEffect,
                                  ),
                                }
                              : item,
                          ),
                        }))
                      }
                    />
                    <button
                      className="rounded-lg bg-rose-100 px-2 py-2 text-rose-700"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          dailyActions: prev.dailyActions.map((item) =>
                            item.id === action.id ? { ...item, effects: item.effects.filter((_, idx) => idx !== index) } : item,
                          ),
                        }))
                      }
                  >
                    删除
                  </button>
                  </div>
                ))}

                <div className="flex gap-2">
                  <button
                    className="rounded-lg bg-slate-100 px-2 py-1.5 text-sm"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        dailyActions: prev.dailyActions.map((item) =>
                          item.id === action.id ? { ...item, effects: [...item.effects, { statId: prev.stats[0]?.id || '', delta: 1 }] } : item,
                        ),
                      }))
                    }
                  >
                    新增影响
                  </button>
                  <button
                    className="rounded-lg bg-rose-100 px-2 py-1.5 text-sm text-rose-700"
                    onClick={() => setConfig((prev) => ({ ...prev, dailyActions: prev.dailyActions.filter((item) => item.id !== action.id) }))}
                  >
                    删除选项
                  </button>
                </div>
                </div>
                  </div>
                </CollapsiblePanel>
              )
            })}

            <button
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white"
              onClick={() =>
                setConfig((prev) => ({
                  ...prev,
                  dailyActions: [
                    ...prev.dailyActions,
                    {
                      id: nextId('action'),
                      name: '新日常',
                      description: '请填写描述',
                      cost: 1,
                      flavor: '发生了一些变化。',
                      sceneId: prev.defaultSceneId,
                      effects: [{ statId: prev.stats[0]?.id || '', delta: 1 }],
                      narrative: {
                        lines: ['她看向你，等待你接下来的动作。'],
                        choices: [],
                      },
                      availableTimeSlotIds: prev.timeSlots.map((slot) => slot.id),
                    },
                  ],
                }))
              }
            >
              新增日常选项
            </button>
          </div>
        )}

        {tab === 'events' && (
          <div className="space-y-3">
            {config.events.map((event, eventIndex) => {
              const eventOpen = isSectionOpen(openEvents, event.id, eventIndex === 0)
              return (
                <CollapsiblePanel
                  key={event.id}
                  title={event.title || `未命名事件 ${eventIndex + 1}`}
                  subtitle={event.description || '展开后编辑触发条件、剧情文本和事件效果。'}
                  meta={
                    <>
                      <EditorBadge>{event.repeatable ? '可重复' : '单次'}</EditorBadge>
                      <EditorBadge>{`${event.conditions.length} 条件`}</EditorBadge>
                      <EditorBadge>{`${event.effects.length} 效果`}</EditorBadge>
                    </>
                  }
                  open={eventOpen}
                  onToggle={() => toggleSectionState(setOpenEvents, event.id, eventIndex === 0)}
                >
                  <div className="space-y-3">
                <Field label="事件标题">
                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2"
                    value={event.title}
                    onChange={(e) => setConfig((prev) => ({ ...prev, events: prev.events.map((item) => (item.id === event.id ? { ...item, title: e.target.value } : item)) }))}
                  />
                </Field>
                <Field label="事件文本">
                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2"
                    value={event.description}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, events: prev.events.map((item) => (item.id === event.id ? { ...item, description: e.target.value } : item)) }))
                    }
                  />
                </Field>
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={event.repeatable}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, events: prev.events.map((item) => (item.id === event.id ? { ...item, repeatable: e.target.checked } : item)) }))
                      }
                    />
                    可重复触发
                  </label>
                  <Field label="触发后场景">
                    <select
                      className="rounded-lg border border-slate-300 px-3 py-2"
                      value={event.sceneId || ''}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, events: prev.events.map((item) => (item.id === event.id ? { ...item, sceneId: e.target.value || undefined } : item)) }))
                      }
                    >
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
                      setConfig((prev) => ({
                        ...prev,
                        events: prev.events.map((item) =>
                          item.id === event.id
                            ? {
                                ...item,
                                narrative: {
                                  lines: textToLines(e.target.value),
                                  choices: item.narrative?.choices || [],
                                },
                              }
                            : item,
                        ),
                      }))
                    }
                  />
                </Field>

                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold tracking-[0.12em] text-slate-500">事件对话分支</p>
                    <EditorBadge>{`${(event.narrative?.choices || []).length} 个分支`}</EditorBadge>
                  </div>
                {(event.narrative?.choices || []).map((choice, choiceIndex) => (
                  <CollapsiblePanel
                    key={`${event.id}-narrative-choice-${choice.id}`}
                    title={choice.label || `事件分支 ${choiceIndex + 1}`}
                    subtitle={`判定：${config.stats.find((stat) => stat.id === choice.statId)?.name || '未设置'} ${choice.operator} ${choice.value}`}
                    meta={<EditorBadge>{choice.successLines.length + choice.failLines.length} 句回应</EditorBadge>}
                    open={isSectionOpen(openEventChoices, `${event.id}:${choice.id}`, choiceIndex === 0)}
                    onToggle={() => toggleSectionState(setOpenEventChoices, `${event.id}:${choice.id}`, choiceIndex === 0)}
                    nested
                  >
                    <div className="space-y-3">
                    <Field label="选项文本">
                      <input
                        className="rounded-lg border border-slate-300 px-3 py-2"
                        value={choice.label}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            events: prev.events.map((item) =>
                              item.id === event.id
                                ? {
                                    ...item,
                                    narrative: {
                                      lines: item.narrative?.lines || [],
                                      choices: (item.narrative?.choices || []).map((option, index) =>
                                        index === choiceIndex ? { ...option, label: e.target.value } : option,
                                      ),
                                    },
                                  }
                                : item,
                            ),
                          }))
                        }
                      />
                    </Field>

                    <div className="grid gap-2 md:grid-cols-3">
                      <Field label="判定属性">
                        <select
                          className="rounded-lg border border-slate-300 px-2 py-2"
                          value={choice.statId}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              events: prev.events.map((item) =>
                                item.id === event.id
                                  ? {
                                      ...item,
                                      narrative: {
                                        lines: item.narrative?.lines || [],
                                        choices: (item.narrative?.choices || []).map((option, index) =>
                                          index === choiceIndex ? { ...option, statId: e.target.value } : option,
                                        ),
                                      },
                                    }
                                  : item,
                              ),
                            }))
                          }
                        >
                          {config.stats.map((stat) => (
                            <option key={stat.id} value={stat.id}>
                              {stat.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="判定符号">
                        <select
                          className="rounded-lg border border-slate-300 px-2 py-2"
                          value={choice.operator}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              events: prev.events.map((item) =>
                                item.id === event.id
                                  ? {
                                      ...item,
                                      narrative: {
                                        lines: item.narrative?.lines || [],
                                        choices: (item.narrative?.choices || []).map((option, index) =>
                                          index === choiceIndex ? { ...option, operator: e.target.value as Operator } : option,
                                        ),
                                      },
                                    }
                                  : item,
                              ),
                            }))
                          }
                        >
                          {['>=', '<=', '>', '<', '='].map((op) => (
                            <option key={op} value={op}>
                              {op}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="判定值">
                        <input
                          type="number"
                          className="rounded-lg border border-slate-300 px-2 py-2"
                          value={choice.value}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              events: prev.events.map((item) =>
                                item.id === event.id
                                  ? {
                                      ...item,
                                      narrative: {
                                        lines: item.narrative?.lines || [],
                                        choices: (item.narrative?.choices || []).map((option, index) =>
                                          index === choiceIndex ? { ...option, value: Number(e.target.value) } : option,
                                        ),
                                      },
                                    }
                                  : item,
                              ),
                            }))
                          }
                        />
                      </Field>
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
                      <Field label="成功回应（每行一句）">
                        <textarea
                          rows={3}
                          className="rounded-lg border border-slate-300 px-3 py-2"
                          value={linesToText(choice.successLines)}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              events: prev.events.map((item) =>
                                item.id === event.id
                                  ? {
                                      ...item,
                                      narrative: {
                                        lines: item.narrative?.lines || [],
                                        choices: (item.narrative?.choices || []).map((option, index) =>
                                          index === choiceIndex ? { ...option, successLines: textToLines(e.target.value) } : option,
                                        ),
                                      },
                                    }
                                  : item,
                              ),
                            }))
                          }
                        />
                      </Field>
                      <Field label="失败回应（每行一句）">
                        <textarea
                          rows={3}
                          className="rounded-lg border border-slate-300 px-3 py-2"
                          value={linesToText(choice.failLines)}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              events: prev.events.map((item) =>
                                item.id === event.id
                                  ? {
                                      ...item,
                                      narrative: {
                                        lines: item.narrative?.lines || [],
                                        choices: (item.narrative?.choices || []).map((option, index) =>
                                          index === choiceIndex ? { ...option, failLines: textToLines(e.target.value) } : option,
                                        ),
                                      },
                                    }
                                  : item,
                              ),
                            }))
                          }
                        />
                      </Field>
                    </div>

                    <button
                      className="rounded-lg bg-rose-100 px-2 py-1.5 text-sm text-rose-700"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          events: prev.events.map((item) =>
                            item.id === event.id
                              ? {
                                  ...item,
                                  narrative: {
                                    lines: item.narrative?.lines || [],
                                    choices: (item.narrative?.choices || []).filter((_, index) => index !== choiceIndex),
                                  },
                                }
                              : item,
                          ),
                        }))
                      }
                    >
                      删除分支
                    </button>
                    </div>
                  </CollapsiblePanel>
                ))}

                <button
                  className="w-fit rounded-lg bg-slate-100 px-2 py-1.5 text-sm"
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      events: prev.events.map((item) =>
                        item.id === event.id
                          ? {
                              ...item,
                              narrative: {
                                lines: item.narrative?.lines || [],
                                choices: [
                                  ...(item.narrative?.choices || []),
                                  {
                                    id: nextId('choice'),
                                    label: '回应她',
                                    statId: prev.stats[0]?.id || '',
                                    operator: '>=',
                                    value: 50,
                                    successLines: ['她的反应明显变得柔和。'],
                                    failLines: ['她沉默了片刻。'],
                                    successEffects: [],
                                    failEffects: [],
                                  },
                                ],
                              },
                            }
                          : item,
                      ),
                    }))
                  }
                >
                  新增事件分支
                </button>
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold tracking-[0.12em] text-slate-500">触发条件</p>
                    <EditorBadge>{`${event.conditions.length} 条`}</EditorBadge>
                  </div>
                {event.conditions.map((condition, index) => (
                  <div key={`${event.id}-cond-${index}`} className="grid grid-cols-[1fr_auto_auto_auto] gap-2">
                    <select
                      className="rounded-lg border border-slate-300 px-2 py-2"
                      value={condition.statId}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          events: prev.events.map((item) =>
                            item.id === event.id
                              ? {
                                  ...item,
                                  conditions: item.conditions.map((itemCond, idx) => (idx === index ? { ...itemCond, statId: e.target.value } : itemCond)),
                                }
                              : item,
                          ),
                        }))
                      }
                    >
                      {config.stats.map((stat) => (
                        <option key={stat.id} value={stat.id}>
                          {stat.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="rounded-lg border border-slate-300 px-2 py-2"
                      value={condition.operator}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          events: prev.events.map((item) =>
                            item.id === event.id
                              ? {
                                  ...item,
                                  conditions: item.conditions.map((itemCond, idx) =>
                                    idx === index ? { ...itemCond, operator: e.target.value as Operator } : itemCond,
                                  ),
                                }
                              : item,
                          ),
                        }))
                      }
                    >
                      {['>=', '<=', '>', '<', '='].map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="rounded-lg border border-slate-300 px-2 py-2"
                      value={condition.value}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          events: prev.events.map((item) =>
                            item.id === event.id
                              ? {
                                  ...item,
                                  conditions: item.conditions.map((itemCond, idx) => (idx === index ? { ...itemCond, value: Number(e.target.value) } : itemCond)),
                                }
                              : item,
                          ),
                        }))
                      }
                    />
                    <button
                      className="rounded-lg bg-rose-100 px-2 py-2 text-rose-700"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          events: prev.events.map((item) =>
                            item.id === event.id ? { ...item, conditions: item.conditions.filter((_, idx) => idx !== index) } : item,
                          ),
                        }))
                      }
                    >
                      删除
                    </button>
                  </div>
                ))}

                <button
                  className="rounded-lg bg-slate-100 px-2 py-1.5 text-sm"
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      events: prev.events.map((item) =>
                        item.id === event.id
                          ? { ...item, conditions: [...item.conditions, { statId: prev.stats[0]?.id || '', operator: '>=' as Operator, value: 50 }] }
                          : item,
                      ),
                    }))
                  }
                >
                  新增条件
                </button>
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold tracking-[0.12em] text-slate-500">触发效果</p>
                    <EditorBadge>{`${event.effects.length} 条`}</EditorBadge>
                  </div>
                {event.effects.map((effect, index) => (
                  <div key={`${event.id}-eff-${index}`} className="grid grid-cols-[1fr_auto_auto] gap-2">
                    <select
                      className="rounded-lg border border-slate-300 px-2 py-2"
                      value={effect.statId}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          events: prev.events.map((item) =>
                            item.id === event.id
                              ? {
                                  ...item,
                                  effects: item.effects.map((itemEffect, idx) => (idx === index ? { ...itemEffect, statId: e.target.value } : itemEffect)),
                                }
                              : item,
                          ),
                        }))
                      }
                    >
                      {config.stats.map((stat) => (
                        <option key={stat.id} value={stat.id}>
                          {stat.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="rounded-lg border border-slate-300 px-2 py-2"
                      value={effect.delta}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          events: prev.events.map((item) =>
                            item.id === event.id
                              ? {
                                  ...item,
                                  effects: item.effects.map((itemEffect, idx) => (idx === index ? { ...itemEffect, delta: Number(e.target.value) } : itemEffect)),
                                }
                              : item,
                          ),
                        }))
                      }
                    />
                    <button
                      className="rounded-lg bg-rose-100 px-2 py-2 text-rose-700"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          events: prev.events.map((item) =>
                            item.id === event.id ? { ...item, effects: item.effects.filter((_, idx) => idx !== index) } : item,
                          ),
                        }))
                      }
                    >
                      删除
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <button
                    className="rounded-lg bg-slate-100 px-2 py-1.5 text-sm"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        events: prev.events.map((item) =>
                          item.id === event.id ? { ...item, effects: [...item.effects, { statId: prev.stats[0]?.id || '', delta: 3 }] } : item,
                        ),
                      }))
                    }
                  >
                    新增效果
                  </button>
                  <button
                    className="rounded-lg bg-rose-100 px-2 py-1.5 text-sm text-rose-700"
                    onClick={() => setConfig((prev) => ({ ...prev, events: prev.events.filter((item) => item.id !== event.id) }))}
                  >
                    删除事件
                  </button>
                </div>
                </div>
                  </div>
                </CollapsiblePanel>
              )
            })}

            <button
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white"
              onClick={() =>
                setConfig((prev) => ({
                  ...prev,
                  events: [
                    ...prev.events,
                    {
                      id: nextId('event'),
                      title: '新事件',
                      description: '请填写事件内容',
                      repeatable: false,
                      sceneId: prev.defaultSceneId,
                      conditions: [{ statId: prev.stats[0]?.id || '', operator: '>=' as Operator, value: 45 }],
                      effects: [{ statId: prev.stats[0]?.id || '', delta: 5 }],
                      narrative: {
                        lines: ['一个新的事件发生了。'],
                        choices: [],
                      },
                    },
                  ],
                }))
              }
            >
              新增事件
            </button>
          </div>
        )}

        {tab === 'data' && (
          <DataTab
            configText={JSON.stringify(config, null, 2)}
            importError={importError}
            importText={importText}
            onImportTextChange={setImportText}
            setConfig={setConfig}
            setImportError={setImportError}
          />
        )}
      </section>
    </main>
  )
}
