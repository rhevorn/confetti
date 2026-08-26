export type TomlTokenKind =
  | 'whitespace'
  | 'newline'
  | 'comment'
  | 'bare'
  | 'basic-string'
  | 'literal-string'
  | 'multiline-basic-string'
  | 'multiline-literal-string'
  | 'symbol'

export interface TomlToken {
  kind: TomlTokenKind
  value: string
  closed?: boolean
}

const SYMBOLS = new Set(['[', ']', '{', '}', '=', ',', '.'])

function quoteRun(input: string, index: number, quote: string): number {
  let end = index
  while (end < input.length && input[end] === quote) end += 1
  return end - index
}

function readBasicString(
  input: string,
  start: number,
  multiline: boolean,
): { end: number; closed: boolean } {
  let index = start + (multiline ? 3 : 1)

  while (index < input.length) {
    if (!multiline && input[index] === '\n') {
      return { end: index, closed: false }
    }
    if (input[index] === '\\') {
      index = Math.min(index + 2, input.length)
      continue
    }
    if (input[index] === '"') {
      const run = quoteRun(input, index, '"')
      if (!multiline || run >= 3) {
        return { end: index + run, closed: true }
      }
      index += run
      continue
    }
    index += 1
  }

  return { end: input.length, closed: false }
}

function readLiteralString(
  input: string,
  start: number,
  multiline: boolean,
): { end: number; closed: boolean } {
  let index = start + (multiline ? 3 : 1)

  while (index < input.length) {
    if (!multiline && input[index] === '\n') {
      return { end: index, closed: false }
    }
    if (input[index] === "'") {
      const run = quoteRun(input, index, "'")
      if (!multiline || run >= 3) {
        return { end: index + run, closed: true }
      }
      index += run
      continue
    }
    index += 1
  }

  return { end: input.length, closed: false }
}

export function tokenizeToml(input: string): TomlToken[] {
  const tokens: TomlToken[] = []

  for (let index = 0; index < input.length;) {
    const character = input[index]

    if (character === ' ' || character === '\t') {
      let end = index + 1
      while (input[end] === ' ' || input[end] === '\t') end += 1
      tokens.push({ kind: 'whitespace', value: input.slice(index, end) })
      index = end
      continue
    }
    if (character === '\n') {
      tokens.push({ kind: 'newline', value: '\n' })
      index += 1
      continue
    }
    if (character === '#') {
      let end = input.indexOf('\n', index)
      if (end === -1) end = input.length
      tokens.push({ kind: 'comment', value: input.slice(index, end) })
      index = end
      continue
    }
    if (character === '"') {
      const multiline = input.startsWith('"""', index)
      const { end, closed } = readBasicString(input, index, multiline)
      tokens.push({
        kind: multiline ? 'multiline-basic-string' : 'basic-string',
        value: input.slice(index, end),
        closed,
      })
      index = end
      continue
    }
    if (character === "'") {
      const multiline = input.startsWith("'''", index)
      const { end, closed } = readLiteralString(input, index, multiline)
      tokens.push({
        kind: multiline ? 'multiline-literal-string' : 'literal-string',
        value: input.slice(index, end),
        closed,
      })
      index = end
      continue
    }
    if (SYMBOLS.has(character)) {
      tokens.push({ kind: 'symbol', value: character })
      index += 1
      continue
    }

    let end = index + 1
    while (end < input.length) {
      const next = input[end]
      if (
        next === ' ' ||
        next === '\t' ||
        next === '\n' ||
        next === '#' ||
        next === '"' ||
        next === "'" ||
        SYMBOLS.has(next)
      ) {
        break
      }
      end += 1
    }
    tokens.push({ kind: 'bare', value: input.slice(index, end) })
    index = end
  }

  return tokens
}

export function tomlTokenText(tokens: readonly TomlToken[]): string {
  return tokens.map(({ value }) => value).join('')
}
