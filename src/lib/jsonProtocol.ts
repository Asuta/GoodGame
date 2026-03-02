import { makeId } from '@/lib/random'
import type { ModelReply, PatchOp, PatchProposal, PatchTarget, StoryOption } from '@/types/game'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseTarget(value: unknown): PatchTarget {
  if (value === 'pc' || value === 'npc' || value === 'world') {
    return value
  }
  throw new Error('Patch target is invalid')
}

function parseOp(value: unknown): PatchOp {
  if (value === 'set' || value === 'add' || value === 'remove' || value === 'inc') {
    return value
  }
  throw new Error('Patch operation is invalid')
}

function parseOption(entry: unknown): StoryOption {
  if (!isObject(entry)) {
    throw new Error('Option is invalid')
  }

  const id = typeof entry.id === 'string' && entry.id.trim() ? entry.id : makeId('opt')
  const text = typeof entry.text === 'string' ? entry.text.trim() : ''
  if (!text) {
    throw new Error('Option text is required')
  }

  const checkRaw = entry.check
  let check: StoryOption['check']
  if (isObject(checkRaw)) {
    const expr = typeof checkRaw.expr === 'string' ? checkRaw.expr.trim() : ''
    if (!expr) {
      throw new Error('Check expression is required')
    }

    check = {
      expr,
      dc: typeof checkRaw.dc === 'number' ? checkRaw.dc : undefined,
      skill: typeof checkRaw.skill === 'string' ? checkRaw.skill : undefined,
    }
  }

  return { id, text, check }
}

function parsePatch(entry: unknown): PatchProposal {
  if (!isObject(entry)) {
    throw new Error('Patch is invalid')
  }

  const path = typeof entry.path === 'string' ? entry.path.trim() : ''
  if (!path) {
    throw new Error('Patch path is required')
  }

  const parsed: PatchProposal = {
    id: typeof entry.id === 'string' && entry.id.trim() ? entry.id : makeId('patch'),
    target: parseTarget(entry.target),
    targetId: typeof entry.targetId === 'string' ? entry.targetId : undefined,
    op: parseOp(entry.op),
    path,
    value: entry.value,
    reason: typeof entry.reason === 'string' ? entry.reason : undefined,
  }

  return parsed
}

export function parseModelReply(rawText: string): ModelReply {
  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(rawText)
  } catch {
    throw new Error('Model output is not valid JSON')
  }

  if (!isObject(parsedJson)) {
    throw new Error('Model output must be a JSON object')
  }

  const narration = typeof parsedJson.narration === 'string' ? parsedJson.narration.trim() : ''
  if (!narration) {
    throw new Error('narration is required')
  }

  const optionsRaw = parsedJson.options
  if (!Array.isArray(optionsRaw) || optionsRaw.length === 0) {
    throw new Error('At least one option is required')
  }
  const options = optionsRaw.map(parseOption)

  const proposedPatchesRaw = parsedJson.proposedPatches
  const proposedPatches = Array.isArray(proposedPatchesRaw)
    ? proposedPatchesRaw
        .map((entry) => {
          try {
            return parsePatch(entry)
          } catch {
            return undefined
          }
        })
        .filter((entry): entry is PatchProposal => entry !== undefined)
    : []

  return {
    narration,
    options,
    proposedPatches,
  }
}
