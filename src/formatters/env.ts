import { joinLines, normalizeLines, splitAssignment } from './shared.js'

export function formatEnv(content: string): string {
  const { lines, hasFinalNewline } = normalizeLines(content)
  const formatted = lines.map((line) => {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) return trimmed

    const assignment = splitAssignment(trimmed, ['='])
    if (!assignment) return trimmed

    return `${assignment.key}=${assignment.value}`
  })
  return joinLines(formatted, hasFinalNewline)
}
