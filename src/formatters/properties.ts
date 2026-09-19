import { tokenizeProperty } from '../tokenizers/properties.js'
import { endsWithContinuation, joinLines, normalizeLines } from './shared.js'

export function formatProperties(content: string): string {
  const { lines, hasFinalNewline } = normalizeLines(content)
  let continuing = false

  const formatted = lines.map((line) => {
    if (continuing) {
      continuing = endsWithContinuation(line)
      return line
    }

    const trimmed = line.trim()
    // Java ends the logical line at a comment or blank line, so neither can
    // continue into the next one even with a trailing backslash.
    if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('!')) {
      return trimmed
    }

    continuing = endsWithContinuation(line)

    const property = tokenizeProperty(trimmed)
    if (!property) return trimmed
    return `${property.key}=${property.value}`
  })

  return joinLines(formatted, hasFinalNewline)
}
