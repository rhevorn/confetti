import { joinLines, normalizeLines } from './shared.js'

const INDENT = '  '

/**
 * Splits trailing `#` comments from Caddy code. Caddy has no quoting
 * semantics, so a `#` anywhere on a line starts a comment.
 */
function splitComment(line: string): { code: string; comment: string } {
  const hash = line.indexOf('#')
  if (hash === -1) return { code: line, comment: '' }
  return { code: line.slice(0, hash).trimEnd(), comment: line.slice(hash) }
}

/**
 * A heredoc body (`respond <<HTML`) must stay byte-for-byte: it may hold
 * arbitrary text including braces and comment markers.
 */
function heredocMarker(code: string): string | undefined {
  const match = /(?:^|\s)<<-?([A-Za-z0-9_.-]+)\s*$/.exec(code)
  return match?.[1]
}

export function formatCaddy(content: string): string {
  const { lines, hasFinalNewline } = normalizeLines(content)
  const output: string[] = []
  let depth = 0
  let heredoc: string | undefined

  for (const sourceLine of lines) {
    if (heredoc !== undefined) {
      output.push(sourceLine)
      if (sourceLine.trim() === heredoc) heredoc = undefined
      continue
    }

    const trimmed = sourceLine.trim()
    if (trimmed === '') {
      if (output.length > 0 && output.at(-1) !== '') output.push('')
      continue
    }

    const { code, comment } = splitComment(trimmed)
    if (code === '') {
      // A trimmed non-empty line with no code left is a standalone comment.
      output.push(`${INDENT.repeat(depth)}${comment}`)
      continue
    }

    // A closing brace line belongs to the surrounding block, not its own.
    let text = code
    if (text.startsWith('}')) depth = Math.max(0, depth - 1)
    text = text.replace(/\s+/g, ' ')
    output.push(
      `${INDENT.repeat(depth)}${[text, comment].filter(Boolean).join(' ')}`,
    )

    if (text.endsWith('{')) {
      // Blocks open with a brace at the end of a line. Placeholders such as
      // {http.request.host} are balanced on one line and never end it, so
      // only this line-final brace changes the indentation depth.
      depth += 1
    } else {
      heredoc = heredocMarker(text)
    }
  }

  return joinLines(output, hasFinalNewline)
}
