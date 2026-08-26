import { joinLines, normalizeLines } from './shared.js'
import {
  collapseTokenWhitespace,
  tokenizeLine,
  tokenText,
  trimTokenWhitespace,
} from '../tokenizers/scanner.js'

function formatDirective(line: string): string {
  const tokens = trimTokenWhitespace(
    tokenizeLine(line, { comments: ['#'], commentRequiresBoundary: true }),
  )
  const commentIndex = tokens.findIndex(({ kind }) => kind === 'comment')
  const code = commentIndex === -1 ? tokens : tokens.slice(0, commentIndex)
  const comment =
    commentIndex === -1 ? undefined : tokenText(tokens.slice(commentIndex))
  const formatted = collapseTokenWhitespace(code)
  return comment ? `${formatted} ${comment.trimEnd()}` : formatted
}

export function formatSsh(content: string): string {
  const { lines, hasFinalNewline } = normalizeLines(content)
  let inConditionalBlock = false

  const formatted = lines.map((line) => {
    const trimmed = line.trim()
    if (trimmed === '') return ''
    if (trimmed.startsWith('#')) {
      return inConditionalBlock ? `  ${trimmed}` : trimmed
    }
    const normalized = formatDirective(trimmed)
    const directive = tokenizeLine(normalized)[0]?.value.toLowerCase()
    if (directive === 'host' || directive === 'match') {
      inConditionalBlock = true
      return normalized
    }
    return inConditionalBlock ? `  ${normalized}` : normalized
  })

  return joinLines(formatted, hasFinalNewline)
}
