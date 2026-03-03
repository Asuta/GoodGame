export interface DiceResult {
  expression: string
  detail: string
  total: number
}

interface ParsedDice {
  count: number
  sides: number
  modifier: number
}

const DICE_PATTERN = /^\s*(\d*)d(\d+)([+-]\d+)?\s*$/i

function parseDice(expression: string): ParsedDice | null {
  const match = expression.match(DICE_PATTERN)
  if (!match) {
    return null
  }

  const count = match[1] ? Number(match[1]) : 1
  const sides = Number(match[2])
  const modifier = match[3] ? Number(match[3]) : 0

  if (!Number.isInteger(count) || !Number.isInteger(sides) || !Number.isInteger(modifier)) {
    return null
  }

  if (count < 1 || count > 100 || sides < 2 || sides > 1000) {
    return null
  }

  return { count, sides, modifier }
}

export function rollDice(expression: string): DiceResult | null {
  const parsed = parseDice(expression)
  if (!parsed) {
    return null
  }

  const rolls: number[] = []

  for (let index = 0; index < parsed.count; index += 1) {
    rolls.push(Math.floor(Math.random() * parsed.sides) + 1)
  }

  const rollsSum = rolls.reduce((sum, value) => sum + value, 0)
  const total = rollsSum + parsed.modifier
  const modifierText = parsed.modifier === 0 ? '' : parsed.modifier > 0 ? ` + ${parsed.modifier}` : ` - ${Math.abs(parsed.modifier)}`
  const detail = `${rolls.join(' + ')}${modifierText}`

  return {
    expression: expression.trim(),
    detail,
    total,
  }
}
