import { tokenizeLine, tokenText, trimTokenWhitespace } from './scanner.js'

/**
 * Splits one Java Properties line into a raw key and value so the formatter can
 * rewrite the separator. Returns undefined for a line it cannot safely rewrite,
 * including bare keys and lines whose scanner-level quoting swallows the
 * separator.
 */
export function tokenizeProperty(
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

const HORIZONTAL_SPACE = new Set([' ', '\t'])

/**
 * Reproduces the key scan in `java.util.Properties.load`: leading whitespace is
 * skipped, the key ends at the first unescaped `=`, `:`, or whitespace, and
 * quotes carry no meaning. Unlike `tokenizeProperty`, which only reports lines
 * the formatter can safely rewrite, this accepts bare keys because Java loads
 * them as real assignments. Returns undefined only for a line with no key.
 */
export function propertiesKeyText(line: string): string | undefined {
  const start = line.length - line.trimStart().length
  if (start === line.length) return undefined

  let index = start
  while (index < line.length) {
    const character = line[index]
    if (character === '\\') {
      index += 2
      continue
    }
    if (
      character === '=' ||
      character === ':' ||
      HORIZONTAL_SPACE.has(character)
    ) {
      break
    }
    index += 1
  }
  return line.slice(start, Math.min(index, line.length))
}

/** The four escapes `java.util.Properties.loadConvert` maps to control characters. */
const CONTROL_ESCAPES = new Map([
  ['t', '\t'],
  ['n', '\n'],
  ['r', '\r'],
  ['f', '\f'],
])

const UNICODE_ESCAPE = /^[0-9a-fA-F]{4}$/

/**
 * Applies Java `Properties` key unescaping: `\uXXXX` becomes one UTF-16 code
 * unit, `\t`, `\n`, `\r`, and `\f` become their control characters, and any
 * other `\X` loses the backslash. Returns undefined for a malformed `\u`
 * escape, which Java rejects outright.
 *
 * Used for identity only. Callers keep reporting the raw key text, because
 * that is what the reader sees in the document.
 */
export function decodePropertiesKey(raw: string): string | undefined {
  let decoded = ''
  let index = 0
  while (index < raw.length) {
    const escape = raw.indexOf('\\', index)
    if (escape < 0) break
    decoded += raw.slice(index, escape)
    // slice rather than indexing: a trailing lone backslash must add nothing.
    const marker = raw.slice(escape + 1, escape + 2)
    if (marker === 'u') {
      const digits = raw.slice(escape + 2, escape + 6)
      if (!UNICODE_ESCAPE.test(digits)) return undefined
      decoded += String.fromCharCode(Number.parseInt(digits, 16))
      index = escape + 6
      continue
    }
    decoded += CONTROL_ESCAPES.get(marker) ?? marker
    index = escape + 2
  }
  return decoded + raw.slice(index)
}
