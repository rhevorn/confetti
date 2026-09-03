import { joinLines, normalizeLines, splitAssignment } from './shared.js'

function endsWithContinuation(value: string): boolean {
  let backslashes = 0
  for (let index = value.length - 1; index >= 0; index -= 1) {
    if (value[index] !== '\\') break
    backslashes += 1
  }
  return backslashes % 2 === 1
}

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
