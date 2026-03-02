import type {
  CaseData,
  NpcData,
  PlayerData,
  SessionData,
  TurnData,
  WorldData,
} from '@/types/game'

type BuildPromptInput = {
  world?: WorldData
  player?: PlayerData
  npcs: NpcData[]
  cases: CaseData[]
  session: SessionData
  turns: TurnData[]
}

export function getProtocolInstruction(): string {
  return [
    'You are the dungeon master of a solo tabletop RPG session.',
    'Output strictly valid JSON only.',
    'The JSON object must include: narration (string), options (array), proposedPatches (array).',
    'Each option must have id and text. Optional check uses expr and optional dc.',
    'If check is present, expr must be a dice expression only, like 1d20+3 or 2d6-1.',
    'Never put skill names or natural language inside check.expr.',
    'Do not assume state patches are auto-applied; they are proposals for player approval.',
    'Keep options actionable and concise. Usually generate 3 to 5 options.',
  ].join('\n')
}

function formatTurns(turns: TurnData[], count: number): string {
  const recent = turns.slice(-count)
  if (!recent.length) {
    return 'No previous turns.'
  }

  return recent
    .map((turn) => {
      const picked = turn.selectedOptionText ? ` | player: ${turn.selectedOptionText}` : ''
      const rolled = turn.roll ? ` | roll: ${turn.roll.expression} => ${turn.roll.total}` : ''
      return `Turn ${turn.index}: ${turn.narration}${picked}${rolled}`
    })
    .join('\n')
}

export function buildContextPrompt(input: BuildPromptInput): string {
  const worldText = input.world?.content?.trim() || 'No world lore yet.'
  const playerText = input.player
    ? [
        `Name: ${input.player.name}`,
        `Attributes: ${input.player.attributes || 'N/A'}`,
        `Skills: ${input.player.skills || 'N/A'}`,
        `Status: ${input.player.status || 'N/A'}`,
        `Equipment: ${input.player.equipment || 'N/A'}`,
        `Items: ${input.player.items || 'N/A'}`,
      ].join('\n')
    : 'No player sheet configured.'

  const npcText = input.npcs.length
    ? input.npcs
        .map((npc) => {
          return [
            `NPC ${npc.name} (${npc.id})`,
            `Affinity: ${npc.affinity}`,
            `History: ${npc.history || 'N/A'}`,
            `Attributes: ${npc.attributes || 'N/A'}`,
            `Skills: ${npc.skills || 'N/A'}`,
            `Status: ${npc.status || 'N/A'}`,
            `Items: ${npc.items || 'N/A'}`,
          ].join('\n')
        })
        .join('\n\n')
    : 'No active NPCs.'

  const caseText = input.cases.length
    ? input.cases
        .sort((a, b) => a.priority - b.priority)
        .map((entry) => `[${entry.priority}] ${entry.title}\n${entry.content}`)
        .join('\n\n')
    : 'No reference cases enabled.'

  return [
    '# Session',
    `Session Name: ${input.session.name}`,
    '',
    '# World Lore',
    worldText,
    '',
    '# Player',
    playerText,
    '',
    '# NPCs',
    npcText,
    '',
    '# Reference Cases',
    caseText,
    '',
    '# Recent Turns',
    formatTurns(input.turns, input.session.recentTurns),
  ].join('\n')
}
