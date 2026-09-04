import { joinLines, normalizeLines } from './shared.js'
import { scanCaddyLines } from '../tokenizers/caddy.js'

export function formatCaddy(content: string): string {
  const { lines, hasFinalNewline } = normalizeLines(content)
  const { records, unsafe } = scanCaddyLines(lines)
  if (unsafe) return joinLines(lines, hasFinalNewline)
  const output: string[] = []
  let depth = 0
  for (const { source, tokens, verbatim } of records) {
    const leadingClose = tokens[0]?.bare && tokens[0].text === '}'
    if (leadingClose) depth = Math.max(0, depth - 1)
    if (verbatim) output.push(source)
    else if (tokens.length > 0)
      output.push(
        `${'  '.repeat(depth)}${tokens.map((token) => token.text).join(' ')}`,
      )
    else if (output.length > 0 && output.at(-1) !== '') output.push('')
    tokens.forEach((token, index) => {
      if (!token.bare) return
      if (token.text === '{') depth += 1
      else if (token.text === '}' && !(index === 0 && leadingClose))
        depth = Math.max(0, depth - 1)
    })
  }
  return joinLines(output, hasFinalNewline)
}
