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

/**
 * Reports whether a line ends with an odd number of backslashes, which
 * continues the logical line onto the next physical line. Callers decide what
 * to pass: a format that accepts trailing blanks before the backslash must
 * trim first.
 */
export function endsWithContinuation(value: string): boolean {
  let backslashes = 0
  for (let index = value.length - 1; index >= 0; index -= 1) {
    if (value[index] !== '\\') break
    backslashes += 1
  }
  return backslashes % 2 === 1
}

export function splitAssignment(
  line: string,
  separators: readonly string[],
): Assignment | undefined {
  const split = splitOnSymbol(
    tokenizeLine(line, { symbols: separators }),
    separators,
  )
  if (!split) return undefined
  const key = tokenText(split.before)
  if (key === '') return undefined
  return {
    key,
    separator: split.symbol,
    value: tokenText(split.after),
  }
}
import {
  splitOnSymbol,
  tokenizeLine,
  tokenText,
} from '../tokenizers/scanner.js'
