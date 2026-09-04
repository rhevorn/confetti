export interface CaddyToken {
  text: string
  bare: boolean
  start: number
}

export interface CaddyLine {
  source: string
  tokens: CaddyToken[]
  verbatim: boolean
}

/** Quotes, comments and heredoc openers only start at token boundaries. */
export function scanCaddyLines(lines: readonly string[]): {
  records: CaddyLine[]
  unsafe: boolean
} {
  const records: CaddyLine[] = []
  let heredoc: string | undefined
  let quote: string | undefined
  let unsafe = false
  for (const source of lines) {
    const tokens: CaddyToken[] = []
    if (heredoc !== undefined) {
      records.push({ source, tokens, verbatim: true })
      if (source.trimStart().split(/\s/, 1)[0] === heredoc) heredoc = undefined
      continue
    }
    const protectedLine = quote !== undefined
    let index = 0
    while (index < source.length) {
      if (!quote && /\s/.test(source[index])) {
        index += 1
        continue
      }
      const start = index
      if (!quote && source[index] === '#') {
        tokens.push({ text: source.slice(index), bare: false, start })
        break
      }
      const quoted =
        quote !== undefined || source[index] === '"' || source[index] === '`'
      if (quote === undefined && quoted) quote = source[index++]
      if (quote !== undefined) {
        while (index < source.length) {
          const character = source[index++]
          if (character === '\\' && quote === '"') index += 1
          else if (character === quote) {
            quote = undefined
            break
          }
        }
      } else {
        while (index < source.length && !/\s/.test(source[index])) index += 1
      }
      tokens.push({ text: source.slice(start, index), bare: !quoted, start })
    }
    if (tokens.some((token) => token.bare && token.text.endsWith('\\')))
      unsafe = true
    records.push({
      source,
      tokens,
      verbatim: protectedLine || quote !== undefined,
    })
    const last = tokens.at(-1)
    if (last?.bare) heredoc = /^<<([A-Za-z0-9_.-]+)$/.exec(last.text)?.[1]
  }
  return {
    records,
    unsafe: unsafe || quote !== undefined || heredoc !== undefined,
  }
}
