import { joinLines, normalizeLines, splitAssignment } from './shared.js'

type MultilineDelimiter = '"""' | "'''"

function delimiterCount(line: string, delimiter: MultilineDelimiter): number {
  let count = 0
  let offset = 0

  while (offset <= line.length - delimiter.length) {
    const index = line.indexOf(delimiter, offset)
    if (index === -1) break

    if (delimiter === '"""') {
      let backslashes = 0
      for (
        let cursor = index - 1;
        cursor >= 0 && line[cursor] === '\\';
        cursor -= 1
      ) {
        backslashes += 1
      }
      if (backslashes % 2 === 1) {
        offset = index + delimiter.length
        continue
      }
    }

    count += 1
    offset = index + delimiter.length
  }

  return count
}

function openingDelimiter(line: string): MultilineDelimiter | undefined {
  for (const delimiter of ['"""', "'''"] as const) {
    if (delimiterCount(line, delimiter) % 2 === 1) return delimiter
  }
  return undefined
}

export function formatToml(content: string): string {
  const { lines, hasFinalNewline } = normalizeLines(content)
  let multiline: MultilineDelimiter | undefined
  const formatted = lines.map((line) => {
    if (multiline) {
      if (delimiterCount(line, multiline) % 2 === 1) multiline = undefined
      return line
    }

    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) return trimmed
    if (/^\[\[?.+\]\]?$/.test(trimmed)) return trimmed

    const assignment = splitAssignment(trimmed, ['='])
    if (!assignment) return line.trimEnd()
    const output = `${assignment.key} = ${assignment.value}`
    multiline = openingDelimiter(assignment.value)
    return output
  })
  return joinLines(formatted, hasFinalNewline)
}
