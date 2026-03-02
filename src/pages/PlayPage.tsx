import { useEffect, useMemo, useState } from 'react'

import {
  DEFAULT_PLAYER,
  DEFAULT_WORLD,
  ensureDefaults,
  getPlayer,
  getSession,
  getSettings,
  getWorld,
  listCases,
  listNpcs,
  listTurns,
  saveSession,
  upsertPlayer,
  upsertTurn,
  upsertWorld,
  upsertNpc,
  clearTurns,
} from '@/features/storage/repository'
import { buildContextPrompt, getProtocolInstruction } from '@/lib/contextPrompt'
import { rollFromCheck } from '@/lib/dice'
import { parseModelReply } from '@/lib/jsonProtocol'
import { requestModelReply } from '@/lib/llmClient'
import { applyPatch } from '@/lib/patches'
import { makeId, nowIso } from '@/lib/random'
import type { Locale } from '@/i18n/messages'
import { useI18n } from '@/i18n/useI18n'
import type {
  CaseData,
  NpcData,
  PatchProposal,
  PlayerData,
  SessionData,
  StoryOption,
  TurnData,
  WorldData,
} from '@/types/game'

type AppState = {
  session: SessionData
  world: WorldData
  player: PlayerData
  npcs: NpcData[]
  cases: CaseData[]
  turns: TurnData[]
}

async function loadState(): Promise<AppState> {
  await ensureDefaults()
  const session = await getSession()
  const [world, player, allNpcs, allCases, turns] = await Promise.all([
    getWorld(session.worldId),
    getPlayer(session.playerId),
    listNpcs(),
    listCases(),
    listTurns(session.id),
  ])

  const npcs = allNpcs.filter((entry) => session.activeNpcIds.includes(entry.id))
  const cases = allCases.filter((entry) => session.activeCaseIds.includes(entry.id) && entry.enabled)

  const playerValue = player ?? DEFAULT_PLAYER
  const worldValue = world ?? DEFAULT_WORLD

  if (!player) {
    await upsertPlayer(playerValue)
    await saveSession({ playerId: playerValue.id })
  }
  if (!world) {
    await upsertWorld(worldValue)
    await saveSession({ worldId: worldValue.id })
  }

  return {
    session,
    world: worldValue,
    player: playerValue,
    npcs,
    cases,
    turns,
  }
}

function describeChoice(locale: Locale, option: StoryOption, rollSummary?: string): string {
  if (locale === 'zh') {
    if (!rollSummary) {
      return `玩家选择：${option.text}`
    }
    return `玩家选择：${option.text}。掷骰结果：${rollSummary}。`
  }

  if (!rollSummary) {
    return `Player chose: ${option.text}`
  }
  return `Player chose: ${option.text}. Dice result: ${rollSummary}.`
}

function compactRollResult(
  roll: NonNullable<TurnData['roll']>,
  translate: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const modifierText = roll.modifier ? (roll.modifier > 0 ? `+${roll.modifier}` : `${roll.modifier}`) : ''
  const dcText = typeof roll.dc === 'number' ? ` vs DC ${roll.dc}` : ''
  const successText =
    typeof roll.success === 'boolean'
      ? ` (${roll.success ? translate('play.roll.success') : translate('play.roll.failure')})`
      : ''
  return `${roll.expression}: [${roll.rolls.join(', ')}]${modifierText} => ${roll.total}${dcText}${successText}`
}

function startInstruction(locale: Locale): string {
  if (locale === 'zh') {
    return '请用中文开启这次跑团，并给出 3 到 5 个可执行选项。'
  }
  return 'Start the campaign with an opening scene and provide 3 to 5 options.'
}

function languageOutputInstruction(locale: Locale): string {
  if (locale === 'zh') {
    return 'All narration, options, and patch reason fields must be in Chinese.'
  }
  return 'All narration, options, and patch reason fields must be in English.'
}

export default function PlayPage() {
  const { t, locale } = useI18n()
  const [state, setState] = useState<AppState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  useEffect(() => {
    void (async () => {
      const nextState = await loadState()
      setState(nextState)
    })()
  }, [])

  const latestTurn = useMemo(() => {
    if (!state?.turns.length) {
      return undefined
    }
    return state.turns[state.turns.length - 1]
  }, [state])

  async function requestNextTurn(userInstruction: string, selectedOptionText?: string, roll?: TurnData['roll']) {
    if (!state) {
      return
    }

    setBusy(true)
    setError('')
    setInfo(t('play.generating'))

    try {
      const settings = await getSettings()
      if (!settings.apiKey.trim()) {
        throw new Error(t('play.error.apiKeyMissing'))
      }

      const contextPrompt = buildContextPrompt({
        world: state.world,
        player: state.player,
        npcs: state.npcs,
        cases: state.cases,
        session: state.session,
        turns: state.turns,
      })

      const rawReply = await requestModelReply({
        apiMode: settings.apiMode,
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        model: settings.model,
        temperature: settings.temperature,
        maxOutputTokens: settings.maxOutputTokens,
        systemPrompt: `${settings.systemPrompt}\n\n${getProtocolInstruction()}\n${languageOutputInstruction(locale)}`,
        contextPrompt,
        userInstruction,
      })

      const parsed = parseModelReply(rawReply)
      const turn: TurnData = {
        id: makeId('turn'),
        sessionId: state.session.id,
        index: state.turns.length + 1,
        createdAt: nowIso(),
        selectedOptionText,
        roll,
        narration: parsed.narration,
        options: parsed.options,
        proposedPatches: parsed.proposedPatches,
        appliedPatchIds: [],
        rawResponse: rawReply,
      }

      await upsertTurn(turn)

      setState((prev) =>
        prev
          ? {
              ...prev,
              turns: [...prev.turns, turn],
            }
          : prev,
      )
      setInfo(t('play.turnGenerated'))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('play.error.generateFailed'))
      setInfo('')
    } finally {
      setBusy(false)
    }
  }

  async function handleStart() {
    await requestNextTurn(startInstruction(locale))
  }

  async function handlePickOption(option: StoryOption) {
    try {
      let roll: TurnData['roll']
      let rollSummary: string | undefined

      if (option.check) {
        roll = rollFromCheck(option.check)
        rollSummary = compactRollResult(roll, t)
      }

      await requestNextTurn(describeChoice(locale, option, rollSummary), option.text, roll)
    } catch (rollError) {
      setError(rollError instanceof Error ? rollError.message : t('play.error.diceFailed'))
      setInfo('')
    }
  }

  async function handleApplyPatch(patch: PatchProposal) {
    if (!state || !latestTurn || latestTurn.appliedPatchIds.includes(patch.id)) {
      return
    }

    try {
      if (patch.target === 'pc') {
        const updated = applyPatch(state.player, patch)
        await upsertPlayer(updated)
        setState((prev) => (prev ? { ...prev, player: updated } : prev))
      } else if (patch.target === 'world') {
        const updated = applyPatch(state.world, patch)
        await upsertWorld(updated)
        setState((prev) => (prev ? { ...prev, world: updated } : prev))
      } else {
        const targetId = patch.targetId
        if (!targetId) {
          throw new Error(t('play.error.npcPatchNeedId'))
        }
        const targetNpc = state.npcs.find((entry) => entry.id === targetId)
        if (!targetNpc) {
          throw new Error(t('play.error.npcNotActive', { id: targetId }))
        }
        const updatedNpc = applyPatch(targetNpc, patch)
        await upsertNpc(updatedNpc)
        setState((prev) =>
          prev
            ? {
                ...prev,
                npcs: prev.npcs.map((entry) => (entry.id === targetId ? updatedNpc : entry)),
              }
            : prev,
        )
      }

      const updatedTurn: TurnData = {
        ...latestTurn,
        appliedPatchIds: [...latestTurn.appliedPatchIds, patch.id],
      }
      await upsertTurn(updatedTurn)
      setState((prev) =>
        prev
          ? {
              ...prev,
              turns: prev.turns.map((entry) => (entry.id === latestTurn.id ? updatedTurn : entry)),
            }
          : prev,
      )
      setInfo(t('play.patchApplied'))
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : t('play.error.patchFailed'))
    }
  }

  async function handleResetSession() {
    if (!state) {
      return
    }
    await clearTurns(state.session.id)
    setState((prev) => (prev ? { ...prev, turns: [] } : prev))
    setInfo(t('play.turnsCleared'))
  }

  if (!state) {
    return (
      <section className="rounded-3xl border border-white/60 bg-white/80 p-5 text-slate-700 shadow-lg shadow-slate-900/5 backdrop-blur">
        {t('play.loading')}
      </section>
    )
  }

  return (
    <section className="grid gap-3 lg:grid-cols-[1.65fr_1fr]">
      <article className="grid content-start gap-3 rounded-3xl border border-white/60 bg-white/80 p-5 shadow-lg shadow-slate-900/5 backdrop-blur animate-[revealUp_620ms_cubic-bezier(0.22,1,0.36,1)]">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="bg-gradient-to-r from-slate-900 via-sky-700 to-cyan-600 bg-[length:200%_100%] bg-clip-text text-2xl font-semibold text-transparent animate-[shimmer_8s_linear_infinite]">
            {t('play.title')}
          </h1>
          <button
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-900 hover:text-white hover:shadow-md"
            type="button"
            onClick={handleResetSession}
            disabled={busy}
          >
            {t('play.reset')}
          </button>
        </div>
        <p className="text-sm text-slate-600">{t('play.subtitle')}</p>

        {!latestTurn ? (
          <button
            className="w-fit rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-700 hover:shadow-lg hover:shadow-slate-900/25"
            type="button"
            onClick={handleStart}
            disabled={busy}
          >
            {t('play.start')}
          </button>
        ) : (
          <>
            <section className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 animate-[revealUp_550ms_cubic-bezier(0.22,1,0.36,1)]">
              <h2 className="text-lg font-semibold text-slate-900">{t('play.currentNarration')}</h2>
              <p className="leading-7 text-slate-700">{latestTurn.narration}</p>
            </section>

            <section className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 animate-[revealUp_650ms_cubic-bezier(0.22,1,0.36,1)]">
              <h2 className="text-lg font-semibold text-slate-900">{t('play.options')}</h2>
              <div className="grid gap-2.5">
                {latestTurn.options.map((option) => (
                  <button
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-slate-700 transition duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg hover:shadow-sky-900/10"
                    key={option.id}
                    type="button"
                    onClick={() => void handlePickOption(option)}
                    disabled={busy}
                  >
                    {option.text}
                    {option.check ? ` (${option.check.expr}${option.check.dc ? ` vs ${option.check.dc}` : ''})` : ''}
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        <section className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 animate-[revealUp_750ms_cubic-bezier(0.22,1,0.36,1)]">
          <h2 className="text-lg font-semibold text-slate-900">{t('play.recentHistory')}</h2>
          <ol className="m-0 grid list-decimal gap-2 pl-5">
            {state.turns
              .slice(-6)
              .reverse()
              .map((turn) => (
                <li key={turn.id}>
                  <p className="text-sm text-slate-700">
                    <strong>{t('play.turn', { index: turn.index })}</strong>: {turn.narration}
                  </p>
                  {turn.selectedOptionText ? (
                    <p className="mt-1 text-xs text-slate-500">{t('play.choice', { text: turn.selectedOptionText })}</p>
                  ) : null}
                  {turn.roll ? (
                    <p className="mt-1 text-xs text-slate-500">{t('play.roll', { text: compactRollResult(turn.roll, t) })}</p>
                  ) : null}
                </li>
              ))}
          </ol>
        </section>

        {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
        {info ? <p className="text-sm font-medium text-emerald-700">{info}</p> : null}
      </article>

      <aside className="grid content-start gap-3 rounded-3xl border border-white/60 bg-white/80 p-5 shadow-lg shadow-slate-900/5 backdrop-blur animate-[revealUp_820ms_cubic-bezier(0.22,1,0.36,1)] lg:max-h-[calc(100vh-5rem)] lg:overflow-auto">
        <h2 className="text-lg font-semibold text-slate-900">{t('play.statusPanel')}</h2>
        <section className="grid gap-2 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t('play.world')}</h3>
          <p className="text-slate-700">{state.world.name}</p>
        </section>

        <section className="grid gap-2 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t('play.player')}</h3>
          <p className="text-slate-700">{state.player.name}</p>
          <p className="text-sm text-slate-500">{state.player.status || t('play.noStatus')}</p>
        </section>

        <section className="grid gap-2 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t('play.activeNpcs')}</h3>
          {state.npcs.length ? (
            <ul className="m-0 grid list-disc gap-1.5 pl-5 text-sm text-slate-700">
              {state.npcs.map((npc) => (
                <li key={npc.id}>
                  {npc.name} ({t('play.affinity')} {npc.affinity})
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">{t('play.noActiveNpc')}</p>
          )}
        </section>

        <section className="grid gap-2 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t('play.pendingPatches')}</h3>
          {!latestTurn?.proposedPatches.length ? (
            <p className="text-sm text-slate-500">{t('play.noPatches')}</p>
          ) : (
            <ul className="m-0 grid list-disc gap-2 pl-5">
              {latestTurn.proposedPatches.map((patch) => {
                const isApplied = latestTurn.appliedPatchIds.includes(patch.id)
                return (
                  <li key={patch.id}>
                    <p className="text-sm text-slate-700">
                      [{patch.target}] {patch.op} {patch.path}
                    </p>
                    {patch.reason ? <p className="mt-1 text-xs text-slate-500">{patch.reason}</p> : null}
                    <button
                      className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-900 hover:text-white hover:shadow"
                      type="button"
                      onClick={() => void handleApplyPatch(patch)}
                      disabled={busy || isApplied}
                    >
                      {isApplied ? t('play.applied') : t('play.applyPatch')}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </aside>
    </section>
  )
}
