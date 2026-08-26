import {
  tokenizeLine,
  tokenText,
  trimTokenWhitespace,
} from '../tokenizers/scanner.js'
import { joinLines, normalizeLines } from './shared.js'

function tokenizeProperty(
  line: string,
): { key: string; value: string } | undefined {
  const tokens = trimTokenWhitespace(
    tokenizeLine(line, { symbols: ['=', ':'] }),
  )
  const separatorIndex = tokens.findIndex(
    ({ kind }) => kind === 'symbol' || kind === 'whitespace',
  )
  if (separatorIndex === -1) return undefined

  const key = tokenText(trimTokenWhitespace(tokens.slice(0, separatorIndex)))
  if (key === '') return undefined

  let valueStart = separatorIndex + 1
  while (tokens[valueStart]?.kind === 'whitespace') valueStart += 1
  if (tokens[valueStart]?.kind === 'symbol') valueStart += 1
  while (tokens[valueStart]?.kind === 'whitespace') valueStart += 1

  return {
    key,
    value: tokenText(trimTokenWhitespace(tokens.slice(valueStart))),
  }
}

function hasContinuation(line: string): boolean {
  let backslashes = 0
  for (
    let index = line.length - 1;
    index >= 0 && line[index] === '\\';
    index--
  ) {
    backslashes += 1
  }
  return backslashes % 2 === 1
}

export function formatProperties(content: string): string {
  const { lines, hasFinalNewline } = normalizeLines(content)
  let continuing = false

  const formatted = lines.map((line) => {
    if (continuing) {
      continuing = hasContinuation(line)
      return line
    }

    const trimmed = line.trim()
    continuing = hasContinuation(line)
    if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('!')) {
      return trimmed
    }

    const property = tokenizeProperty(trimmed)
    if (!property) return trimmed
    return `${property.key}=${property.value}`
  })

  return joinLines(formatted, hasFinalNewline)
}
