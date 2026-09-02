import { formatColumnsLine } from './columns.js'
import { joinLines, normalizeLines } from './shared.js'

export function formatInputrc(content: string): string {
  const { lines, hasFinalNewline } = normalizeLines(content)
  return joinLines(
    lines.map((line) => formatColumnsLine(line)),
    hasFinalNewline,
  )
}
