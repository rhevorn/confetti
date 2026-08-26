import { joinLines, normalizeLines } from './shared.js'

export function formatSsh(content: string): string {
  const { lines, hasFinalNewline } = normalizeLines(content)
  let inConditionalBlock = false

  const formatted = lines.map((line) => {
    const trimmed = line.trim()
    if (trimmed === '') return ''
    if (trimmed.startsWith('#')) {
      return inConditionalBlock ? `  ${trimmed}` : trimmed
    }
    if (/^(?:Host|Match)\s+/i.test(trimmed)) {
      inConditionalBlock = true
      return trimmed
    }
    return inConditionalBlock ? `  ${trimmed}` : trimmed
  })

  return joinLines(formatted, hasFinalNewline)
}
