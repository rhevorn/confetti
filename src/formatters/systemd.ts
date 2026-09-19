import {
  endsWithContinuation,
  joinLines,
  normalizeLines,
  splitAssignment,
} from './shared.js'

export function formatSystemd(content: string): string {
  const { lines, hasFinalNewline } = normalizeLines(content)
  let continuing = false

  const formatted = lines.map((line) => {
    if (continuing) {
      continuing = endsWithContinuation(line.trimEnd())
      return line
    }
    const trimmed = line.trim()
    if (
      trimmed === '' ||
      trimmed.startsWith('#') ||
      trimmed.startsWith(';') ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      return trimmed
    }

    const assignment = splitAssignment(trimmed, ['='])
    if (!assignment) return trimmed
    continuing = endsWithContinuation(assignment.value)
    return `${assignment.key}=${assignment.value}`
  })

  return joinLines(formatted, hasFinalNewline)
}
