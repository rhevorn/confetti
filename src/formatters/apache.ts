import { formatColumnsLine } from './columns.js'
import { joinLines, normalizeLines } from './shared.js'

export function formatApache(content: string): string {
  const { lines, hasFinalNewline } = normalizeLines(content)
  const output: string[] = []
  let depth = 0

  const emit = (text: string, indentation: number): void => {
    output.push(`${'  '.repeat(indentation)}${text}`)
  }

  for (const sourceLine of lines) {
    const trimmed = sourceLine.trim()
    if (trimmed === '') {
      if (output.length > 0 && output.at(-1) !== '') output.push('')
      continue
    }

    if (trimmed.startsWith('</')) {
      depth = Math.max(0, depth - 1)
      emit(formatColumnsLine(sourceLine), depth)
      continue
    }

    emit(formatColumnsLine(sourceLine), depth)
    if (trimmed.startsWith('<')) depth += 1
  }

  return joinLines(output, hasFinalNewline)
}
