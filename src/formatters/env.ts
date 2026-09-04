import { joinLines, normalizeLines, splitAssignment } from './shared.js'
import { collapseTokenWhitespace, tokenizeLine } from '../tokenizers/scanner.js'
import { envRecords } from '../tokenizers/env.js'

export function formatEnv(content: string): string {
  const { lines, hasFinalNewline } = normalizeLines(content)
  const formatted = envRecords(lines).map(({ text: line, multiline }) => {
    if (multiline) return line
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) return trimmed

    const assignment = splitAssignment(trimmed, ['='])
    if (!assignment) return trimmed

    const key = collapseTokenWhitespace(tokenizeLine(assignment.key))
    return `${key}=${assignment.value}`
  })
  return joinLines(formatted, hasFinalNewline)
}
