import {
  collapseTokenWhitespace,
  tokenizeLine,
  trimTokenWhitespace,
} from '../tokenizers/scanner.js'

export function formatColumnsLine(line: string, inlineComments = true): string {
  const trimmed = line.trim()
  if (trimmed === '' || trimmed.startsWith('#')) return trimmed

  const tokens = trimTokenWhitespace(
    tokenizeLine(line, {
      comments: inlineComments ? ['#'] : [],
      commentRequiresBoundary: true,
    }),
  )
  const commentIndex = tokens.findIndex(({ kind }) => kind === 'comment')
  const bodyTokens =
    commentIndex === -1 ? tokens : tokens.slice(0, commentIndex)
  const body = collapseTokenWhitespace(bodyTokens)
  const comment =
    commentIndex === -1 ? '' : tokens[commentIndex].value.trimEnd()
  return comment ? `${body} ${comment}` : body
}
