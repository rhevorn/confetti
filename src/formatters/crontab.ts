import { joinLines, normalizeLines, splitAssignment } from './shared.js'

function formatSchedule(line: string): string {
  const fields: string[] = []
  let index = 0

  while (fields.length < 5) {
    while (index < line.length && /\s/.test(line[index])) index += 1
    if (index >= line.length) return line.trim()
    const start = index
    while (index < line.length && !/\s/.test(line[index])) index += 1
    fields.push(line.slice(start, index))
  }

  while (index < line.length && /\s/.test(line[index])) index += 1
  const remainder = line.slice(index).trimEnd()
  return remainder ? `${fields.join(' ')} ${remainder}` : fields.join(' ')
}

export function formatCrontab(content: string): string {
  const { lines, hasFinalNewline } = normalizeLines(content)
  const formatted = lines.map((line) => {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) return trimmed

    const assignment = splitAssignment(trimmed, ['='])
    if (assignment && /^[A-Za-z_][A-Za-z0-9_]*$/.test(assignment.key)) {
      return `${assignment.key}=${assignment.value}`
    }

    if (trimmed.startsWith('@')) {
      const match = /^(@\S+)\s+([\s\S]*)$/.exec(trimmed)
      return match ? `${match[1]} ${match[2]}` : trimmed
    }

    return formatSchedule(line)
  })
  return joinLines(formatted, hasFinalNewline)
}
