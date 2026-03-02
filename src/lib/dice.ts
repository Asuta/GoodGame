import type { DiceCheck, RollResult } from '@/types/game'

type ParsedDice = {
  count: number
  sides: number
  modifier: number
}

const DICE_REGEX = /^\s*(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?\s*$/i

export function parseDiceExpression(expression: string): ParsedDice {
  const match = expression.match(DICE_REGEX)

  if (!match) {
    throw new Error(`Invalid dice expression: ${expression}`)
  }

  const count = Number(match[1])
  const sides = Number(match[2])
  const sign = match[3]
  const modValue = match[4] ? Number(match[4]) : 0
  const modifier = sign === '-' ? -modValue : modValue

  if (count <= 0 || count > 100) {
    throw new Error('Dice count must be between 1 and 100')
  }
  if (sides <= 1 || sides > 1000) {
    throw new Error('Dice sides must be between 2 and 1000')
  }

  return { count, sides, modifier }
}

function randomIntInclusive(min: number, max: number): number {
  const range = max - min + 1
  const maxUnbiased = Math.floor(0x100000000 / range) * range
  const bytes = new Uint32Array(1)

  while (true) {
    crypto.getRandomValues(bytes)
    if (bytes[0] < maxUnbiased) {
      return min + (bytes[0] % range)
    }
  }
}

export function rollExpression(expression: string, dc?: number): RollResult {
  const parsed = parseDiceExpression(expression)
  const rolls = Array.from({ length: parsed.count }, () => randomIntInclusive(1, parsed.sides))
  const total = rolls.reduce((sum, value) => sum + value, 0) + parsed.modifier

  return {
    expression,
    rolls,
    modifier: parsed.modifier,
    total,
    dc,
    success: typeof dc === 'number' ? total >= dc : undefined,
  }
}

export function rollFromCheck(check: DiceCheck): RollResult {
  return rollExpression(check.expr, check.dc)
}
