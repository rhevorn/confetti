import { joinLines, normalizeLines } from './shared.js'
import { collapseTokenWhitespace, tokenizeLine } from '../tokenizers/scanner.js'

export function formatYarnrc(content: string): string {
  const { lines, hasFinalNewline } = normalizeLines(content)
  const formatted = lines.map((line) => {
    const trimmed = line.trim()
    if (trimmed === '') return ''
    if (trimmed.startsWith('#')) return trimmed
    return collapseTokenWhitespace(
      tokenizeLine(trimmed, {
        comments: ['#'],
        commentRequiresBoundary: true,
      }),
    )
  })
  return joinLines(formatted, hasFinalNewline)
}
