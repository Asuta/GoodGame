import type { PatchProposal } from '@/types/game'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function splitPath(path: string): string[] {
  return path.split('.').map((part) => part.trim()).filter(Boolean)
}

export function applyPatch<T>(source: T, patch: PatchProposal): T {
  const clone = structuredClone(source) as unknown
  if (!isRecord(clone)) {
    throw new Error('Patch target must be an object')
  }

  const parts = splitPath(patch.path)
  if (!parts.length) {
    throw new Error('Patch path is empty')
  }

  let cursor: Record<string, unknown> = clone
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i]
    const next = cursor[key]
    if (!isRecord(next)) {
      cursor[key] = {}
    }
    cursor = cursor[key] as Record<string, unknown>
  }

  const leaf = parts[parts.length - 1]
  if (patch.op === 'set') {
    cursor[leaf] = patch.value
    return clone as T
  }

  if (patch.op === 'remove') {
    delete cursor[leaf]
    return clone as T
  }

  if (patch.op === 'inc') {
    const current = cursor[leaf]
    const increment = Number(patch.value)
    if (Number.isNaN(increment)) {
      throw new Error('inc patch requires numeric value')
    }
    const base = typeof current === 'number' ? current : 0
    cursor[leaf] = base + increment
    return clone as T
  }

  const current = cursor[leaf]
  if (!Array.isArray(current)) {
    cursor[leaf] = [patch.value]
    return clone as T
  }
  current.push(patch.value)
  return clone as T
}
