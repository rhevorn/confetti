import { joinLines, normalizeLines, splitAssignment } from './shared.js'

export function formatIni(content: string): string {
  const { lines, hasFinalNewline } = normalizeLines(content)
  const formatted = lines.map((line) => {
    const trimmed = line.trim()
    if (
      trimmed === '' ||
      trimmed.startsWith(';') ||
      trimmed.startsWith('#') ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      return trimmed
    }

    const assignment = splitAssignment(trimmed, ['=', ':'])
    if (!assignment) return trimmed
    return `${assignment.key} ${assignment.separator}${
      assignment.value === '' ? '' : ` ${assignment.value}`
    }`
  })
  return joinLines(formatted, hasFinalNewline)
}
