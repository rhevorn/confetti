import { joinLines, normalizeLines, splitAssignment } from './shared.js'

export function formatToml(content: string): string {
  const { lines, hasFinalNewline } = normalizeLines(content)
  const formatted = lines.map((line) => {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) return trimmed
    if (/^\[\[?.+\]\]?$/.test(trimmed)) return trimmed

    const assignment = splitAssignment(trimmed, ['='])
    if (!assignment) return line.trimEnd()
    return `${assignment.key} = ${assignment.value}`
  })
  return joinLines(formatted, hasFinalNewline)
}
