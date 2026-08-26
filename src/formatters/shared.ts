export interface NormalizedLines {
  lines: string[]
  hasFinalNewline: boolean
}

export interface Assignment {
  key: string
  separator: string
  value: string
}

export function normalizeLines(content: string): NormalizedLines {
  const hasFinalNewline = content.endsWith('\n')
  const lines = content.replace(/\r\n?/g, '\n').split('\n')
  if (hasFinalNewline) lines.pop()
  return { lines, hasFinalNewline }
}

export function joinLines(lines: string[], hasFinalNewline: boolean): string {
  const result = lines.join('\n')
  return hasFinalNewline ? `${result}\n` : result
}

export function splitAssignment(
  line: string,
  separators: readonly string[],
): Assignment | undefined {
  let quote: string | undefined
  let escaped = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (escaped) {
      escaped = false
      continue
    }
    if (character === '\\') {
      escaped = true
      continue
    }
    if (quote) {
      if (character === quote) quote = undefined
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      continue
    }
    if (separators.includes(character)) {
      const key = line.slice(0, index).trim()
      if (key === '') return undefined
      return {
        key,
        separator: character,
        value: line.slice(index + 1).trim(),
      }
    }
  }

  return undefined
}
