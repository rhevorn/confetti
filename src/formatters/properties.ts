import { joinLines, normalizeLines, splitAssignment } from './shared.js'

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

    const assignment = splitAssignment(trimmed, ['=', ':'])
    if (!assignment) return trimmed
    return `${assignment.key}${assignment.separator}${assignment.value}`
  })

  return joinLines(formatted, hasFinalNewline)
}
