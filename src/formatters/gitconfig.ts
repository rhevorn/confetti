import { joinLines, normalizeLines, splitAssignment } from './shared.js'

export function formatGitConfig(content: string): string {
  const { lines, hasFinalNewline } = normalizeLines(content)
  let inSection = false
  let continuing = false

  const formatted = lines.map((line) => {
    if (continuing) {
      continuing = line.trimEnd().endsWith('\\')
      return line
    }
    const trimmed = line.trim()
    if (trimmed === '') return ''
    if (trimmed.startsWith('#') || trimmed.startsWith(';')) return trimmed
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      inSection = true
      return trimmed
    }

    const assignment = splitAssignment(trimmed, ['='])
    if (!assignment) return inSection ? `  ${trimmed}` : trimmed
    continuing = assignment.value.endsWith('\\')
    const output = `${assignment.key} = ${assignment.value}`
    return inSection ? `  ${output}` : output
  })

  return joinLines(formatted, hasFinalNewline)
}
