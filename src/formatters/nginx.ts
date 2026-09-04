import { tokenizeLine, trimTokenWhitespace } from '../tokenizers/scanner.js'
import type { Token } from '../tokenizers/types.js'
import { maskNginxStrings } from '../tokenizers/nginx.js'
import { joinLines, normalizeLines } from './shared.js'

function formatSegment(tokens: readonly Token[]): string {
  let output = ''
  let pendingSpace = false

  for (const token of trimTokenWhitespace(tokens)) {
    if (token.kind === 'whitespace') {
      pendingSpace = true
      continue
    }
    if (token.kind === 'symbol' && token.value === '=') {
      output = `${output.trimEnd()} = `
      pendingSpace = false
      continue
    }
    if (pendingSpace && output !== '' && !output.endsWith(' ')) output += ' '
    output += token.value
    pendingSpace = false
  }

  return output.trimEnd()
}

export function formatNginx(content: string): string {
  const { lines, hasFinalNewline } = normalizeLines(content)
  // A line-based layout pass cannot safely reindent a quoted multiline value.
  if (maskNginxStrings(lines.join('\n')).multiline)
    return joinLines(lines, hasFinalNewline)
  const output: string[] = []
  let depth = 0

  const emit = (text: string, indentation = depth): void => {
    output.push(`${'  '.repeat(indentation)}${text}`)
  }

  for (const sourceLine of lines) {
    const lineStart = output.length
    const tokens = trimTokenWhitespace(
      tokenizeLine(sourceLine, {
        symbols: ['{', '}', ';', '='],
        comments: ['#'],
      }),
    )

    if (tokens.length === 0) {
      if (output.length > 0 && output.at(-1) !== '') output.push('')
      continue
    }

    let segment: Token[] = []
    const flush = (suffix = ''): void => {
      const text = formatSegment(segment)
      if (text || suffix) emit(`${text}${suffix}`)
      segment = []
    }

    for (const token of tokens) {
      if (token.kind === 'comment') {
        const text = formatSegment(segment)
        segment = []
        if (text) emit(`${text} ${token.value.trimEnd()}`)
        else if (output.length > lineStart) {
          output[output.length - 1] += ` ${token.value.trimEnd()}`
        } else emit(token.value.trimEnd())
        break
      }

      if (token.kind !== 'symbol' || token.value === '=') {
        segment.push(token)
        continue
      }

      if (token.value === '{') {
        flush(formatSegment(segment) ? ' {' : '{')
        depth += 1
      } else if (token.value === ';') {
        flush(';')
      } else {
        flush()
        depth = Math.max(0, depth - 1)
        emit('}', depth)
      }
    }

    flush()
  }

  return joinLines(output, hasFinalNewline)
}
