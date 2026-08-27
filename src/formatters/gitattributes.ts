import { joinLines, normalizeLines } from './shared.js'
import { formatColumnsLine } from './columns.js'

export function formatGitAttributes(content: string): string {
  const { lines, hasFinalNewline } = normalizeLines(content)
  return joinLines(
    lines.map((line) => formatColumnsLine(line, false)),
    hasFinalNewline,
  )
}
