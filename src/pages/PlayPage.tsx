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

function describeChoice(option: StoryOption, rollSummary?: string): string {
  if (!rollSummary) {
    return `Player chose: ${option.text}`
  }
  return `Player chose: ${option.text}. Dice result: ${rollSummary}.`
}

function compactRollResult(roll: NonNullable<TurnData['roll']>): string {
  const modifierText = roll.modifier ? (roll.modifier > 0 ? `+${roll.modifier}` : `${roll.modifier}`) : ''
  const dcText = typeof roll.dc === 'number' ? ` vs DC ${roll.dc}` : ''
  const successText = typeof roll.success === 'boolean' ? (roll.success ? ' (success)' : ' (failure)') : ''
  return `${roll.expression}: [${roll.rolls.join(', ')}]${modifierText} => ${roll.total}${dcText}${successText}`
}

export default function PlayPage() {
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
    setInfo('Generating story...')

    try {
      const settings = await getSettings()
      if (!settings.apiKey.trim()) {
        throw new Error('API key is missing in Settings')
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
        systemPrompt: `${settings.systemPrompt}\n\n${getProtocolInstruction()}`,
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
      setInfo('Turn generated')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to generate turn')
      setInfo('')
    } finally {
      setBusy(false)
    }
  }

  async function handleStart() {
    await requestNextTurn('Start the campaign with an opening scene and provide 3 to 5 options.')
  }

  async function handlePickOption(option: StoryOption) {
    try {
      let roll: TurnData['roll']
      let rollSummary: string | undefined

      if (option.check) {
        roll = rollFromCheck(option.check)
        rollSummary = compactRollResult(roll)
      }

      await requestNextTurn(describeChoice(option, rollSummary), option.text, roll)
    } catch (rollError) {
      setError(rollError instanceof Error ? rollError.message : 'Dice roll failed')
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
          throw new Error('NPC patch requires targetId')
        }
        const targetNpc = state.npcs.find((entry) => entry.id === targetId)
        if (!targetNpc) {
          throw new Error(`NPC ${targetId} is not active in this session`)
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
      setInfo('Patch applied')
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : 'Patch failed')
    }
  }

  async function handleResetSession() {
    if (!state) {
      return
    }
    await clearTurns(state.session.id)
    setState((prev) => (prev ? { ...prev, turns: [] } : prev))
    setInfo('Session turns cleared')
  }

  if (!state) {
    return <section className="panel">Loading play session...</section>
  }

  return (
    <section className="play-layout">
      <article className="panel story-panel">
        <div className="inline-controls">
          <h1>Play</h1>
          <button type="button" onClick={handleResetSession} disabled={busy}>
            Reset turns
          </button>
        </div>
        <p>Single-player mode. Click options only, no free typing.</p>

        {!latestTurn ? (
          <button type="button" onClick={handleStart} disabled={busy}>
            Start adventure
          </button>
        ) : (
          <>
            <section className="panel sub-panel">
              <h2>Current narration</h2>
              <p>{latestTurn.narration}</p>
            </section>

            <section className="panel sub-panel">
              <h2>Options</h2>
              <div className="options-grid">
                {latestTurn.options.map((option) => (
                  <button key={option.id} type="button" onClick={() => void handlePickOption(option)} disabled={busy}>
                    {option.text}
                    {option.check ? ` (${option.check.expr}${option.check.dc ? ` vs ${option.check.dc}` : ''})` : ''}
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        <section className="panel sub-panel">
          <h2>Recent history</h2>
          <ol className="turn-list">
            {state.turns
              .slice(-6)
              .reverse()
              .map((turn) => (
                <li key={turn.id}>
                  <p>
                    <strong>Turn {turn.index}</strong>: {turn.narration}
                  </p>
                  {turn.selectedOptionText ? <p>Choice: {turn.selectedOptionText}</p> : null}
                  {turn.roll ? <p>Roll: {compactRollResult(turn.roll)}</p> : null}
                </li>
              ))}
          </ol>
        </section>

        {error ? <p className="status-error">{error}</p> : null}
        {info ? <p className="status-message">{info}</p> : null}
      </article>

      <aside className="panel status-panel">
        <h2>Status Panel</h2>
        <section className="panel sub-panel">
          <h3>World</h3>
          <p>{state.world.name}</p>
        </section>

        <section className="panel sub-panel">
          <h3>Player</h3>
          <p>{state.player.name}</p>
          <p>{state.player.status || 'No status'}</p>
        </section>

        <section className="panel sub-panel">
          <h3>Active NPCs</h3>
          {state.npcs.length ? (
            <ul>
              {state.npcs.map((npc) => (
                <li key={npc.id}>
                  {npc.name} (Affinity {npc.affinity})
                </li>
              ))}
            </ul>
          ) : (
            <p>No active NPC.</p>
          )}
        </section>

        <section className="panel sub-panel">
          <h3>Pending Patches</h3>
          {!latestTurn?.proposedPatches.length ? (
            <p>No proposed changes.</p>
          ) : (
            <ul className="patch-list">
              {latestTurn.proposedPatches.map((patch) => {
                const isApplied = latestTurn.appliedPatchIds.includes(patch.id)
                return (
                  <li key={patch.id}>
                    <p>
                      [{patch.target}] {patch.op} {patch.path}
                    </p>
                    {patch.reason ? <p>{patch.reason}</p> : null}
                    <button
                      type="button"
                      onClick={() => void handleApplyPatch(patch)}
                      disabled={busy || isApplied}
                    >
                      {isApplied ? 'Applied' : 'Apply patch'}
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
