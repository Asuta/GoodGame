export function makeId(prefix: string): string {
  const entropy = crypto.getRandomValues(new Uint32Array(2))
  return `${prefix}_${entropy[0].toString(16)}${entropy[1].toString(16)}`
}

export function nowIso(): string {
  return new Date().toISOString()
}
