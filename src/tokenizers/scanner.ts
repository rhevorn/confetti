import type { Token, TokenizerOptions } from './types.js'

function startsWithAny(
  input: string,
  index: number,
  candidates: readonly string[],
): string | undefined {
  return candidates.find((candidate) => input.startsWith(candidate, index))
}

function isBoundary(input: string, index: number): boolean {
  return index === 0 || /\s/.test(input[index - 1])
}

export function tokenizeLine(
  input: string,
  options: TokenizerOptions = {},
): Token[] {
  const symbols = [...(options.symbols ?? [])].sort(
    (left, right) => right.length - left.length,
  )
  const comments = [...(options.comments ?? [])].sort(
    (left, right) => right.length - left.length,
  )
  const tokens: Token[] = []

  for (let index = 0; index < input.length;) {
    const character = input[index]

    if (/\s/.test(character)) {
      let end = index + 1
      while (end < input.length && /\s/.test(input[end])) end += 1
      tokens.push({ kind: 'whitespace', value: input.slice(index, end) })
      index = end
      continue
    }

    const comment = startsWithAny(input, index, comments)
    if (
      comment &&
      (!options.commentRequiresBoundary || isBoundary(input, index))
    ) {
      tokens.push({ kind: 'comment', value: input.slice(index) })
      break
    }

    if (character === '"' || character === "'") {
      const quote = character
      let end = index + 1
      while (end < input.length) {
        if (input[end] === '\\' && end + 1 < input.length) {
          end += 2
          continue
        }
        if (input[end] === quote) {
          end += 1
          break
        }
        end += 1
      }
      tokens.push({ kind: 'string', value: input.slice(index, end) })
      index = end
      continue
    }

    if (character === '\\' && index + 1 < input.length) {
      tokens.push({ kind: 'escaped', value: input.slice(index, index + 2) })
      index += 2
      continue
    }

    const symbol = startsWithAny(input, index, symbols)
    if (symbol) {
      tokens.push({ kind: 'symbol', value: symbol })
      index += symbol.length
      continue
    }

    let end = index + 1
    while (end < input.length) {
      if (/\s/.test(input[end])) break
      if (input[end] === '"' || input[end] === "'" || input[end] === '\\') break
      if (startsWithAny(input, end, symbols)) break
      const nextComment = startsWithAny(input, end, comments)
      if (
        nextComment &&
        (!options.commentRequiresBoundary || isBoundary(input, end))
      ) {
        break
      }
      end += 1
    }
    tokens.push({ kind: 'text', value: input.slice(index, end) })
    index = end
  }

  return tokens
}

export function tokenText(tokens: readonly Token[]): string {
  return tokens.map(({ value }) => value).join('')
}

export function collapseTokenWhitespace(tokens: readonly Token[]): string {
  return trimTokenWhitespace(tokens)
    .map((token) => (token.kind === 'whitespace' ? ' ' : token.value))
    .join('')
}

export function trimTokenWhitespace(tokens: readonly Token[]): Token[] {
  let start = 0
  let end = tokens.length
  while (start < end && tokens[start].kind === 'whitespace') start += 1
  while (end > start && tokens[end - 1].kind === 'whitespace') end -= 1
  return tokens.slice(start, end)
}

export function splitOnSymbol(
  tokens: readonly Token[],
  symbols: readonly string[],
): { before: Token[]; symbol: string; after: Token[] } | undefined {
  const index = tokens.findIndex(
    (token) => token.kind === 'symbol' && symbols.includes(token.value),
  )
  if (index === -1) return undefined
  return {
    before: trimTokenWhitespace(tokens.slice(0, index)),
    symbol: tokens[index].value,
    after: trimTokenWhitespace(tokens.slice(index + 1)),
  }
}
