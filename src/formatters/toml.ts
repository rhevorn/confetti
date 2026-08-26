import { joinLines, normalizeLines } from './shared.js'
import {
  tokenizeToml,
  tomlTokenText,
  type TomlToken,
} from '../tokenizers/toml.js'

interface TomlChunk {
  tokens: TomlToken[]
  structurallyValid: boolean
}

interface ContainerInfo {
  close: number
  multiline: boolean
  empty: boolean
}

function isWhitespace(token: TomlToken): boolean {
  return token.kind === 'whitespace'
}

function trimWhitespace(tokens: readonly TomlToken[]): TomlToken[] {
  let start = 0
  let end = tokens.length
  while (start < end && isWhitespace(tokens[start])) start += 1
  while (end > start && isWhitespace(tokens[end - 1])) end -= 1
  return tokens.slice(start, end)
}

function splitChunks(tokens: readonly TomlToken[]): TomlChunk[] {
  const chunks: TomlChunk[] = []
  let current: TomlToken[] = []
  const containers: string[] = []
  let structurallyValid = true

  const finish = () => {
    chunks.push({
      tokens: current,
      structurallyValid: structurallyValid && containers.length === 0,
    })
    current = []
    structurallyValid = true
  }

  for (const token of tokens) {
    if (token.closed === false) structurallyValid = false
    if (token.kind === 'symbol') {
      if (token.value === '[' || token.value === '{') {
        containers.push(token.value)
      } else if (token.value === ']' || token.value === '}') {
        const expected = token.value === ']' ? '[' : '{'
        if (containers.at(-1) === expected) containers.pop()
        else structurallyValid = false
      }
    }

    if (token.kind === 'newline' && containers.length === 0) finish()
    else current.push(token)
  }

  if (current.length > 0) finish()
  return chunks
}

function splitTrailingComment(tokens: readonly TomlToken[]): {
  content: TomlToken[]
  comment?: TomlToken
} {
  const index = tokens.findIndex((token) => token.kind === 'comment')
  if (index === -1) return { content: trimWhitespace(tokens) }
  return {
    content: trimWhitespace(tokens.slice(0, index)),
    comment: tokens[index],
  }
}

function isKeyComponent(token: TomlToken): boolean {
  if (token.kind === 'bare') return /^[A-Za-z0-9_-]+$/.test(token.value)
  return token.kind === 'basic-string' || token.kind === 'literal-string'
}

function formatKey(tokens: readonly TomlToken[]): string | undefined {
  const meaningful = tokens.filter((token) => !isWhitespace(token))
  if (meaningful.length === 0) return undefined

  let expectComponent = true
  let output = ''
  for (const token of meaningful) {
    if (expectComponent) {
      if (!isKeyComponent(token) || token.closed === false) return undefined
      output += token.value
    } else {
      if (token.kind !== 'symbol' || token.value !== '.') return undefined
      output += '.'
    }
    expectComponent = !expectComponent
  }

  return expectComponent ? undefined : output
}

function containerMap(
  tokens: readonly TomlToken[],
): Map<number, ContainerInfo> {
  const result = new Map<number, ContainerInfo>()
  const stack: Array<{ index: number; open: string; multiline: boolean }> = []

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token.kind === 'newline') {
      for (const container of stack) container.multiline = true
      continue
    }
    if (token.kind !== 'symbol') continue
    if (token.value === '[' || token.value === '{') {
      stack.push({ index, open: token.value, multiline: false })
      continue
    }
    if (token.value !== ']' && token.value !== '}') continue
    const container = stack.pop()!
    result.set(container.index, {
      close: index,
      multiline: container.multiline,
      empty: tokens
        .slice(container.index + 1, index)
        .every((token) => token.kind === 'whitespace'),
    })
  }

  return result
}

function formatValue(tokens: readonly TomlToken[]): string {
  const source = trimWhitespace(tokens)
  const containers = containerMap(source)
  const stack: Array<{
    open: string
    multiline: boolean
    empty: boolean
  }> = []
  let output = ''
  let pendingSpace = false
  let atLineStart = true

  const trimHorizontalEnd = () => {
    output = output.replace(/[ \t]+$/, '')
  }

  const writeIndent = (depth = stack.length) => {
    if (!atLineStart) return
    output += '  '.repeat(depth)
    atLineStart = false
  }

  for (let index = 0; index < source.length; index += 1) {
    const token = source[index]

    if (token.kind === 'whitespace') {
      if (!atLineStart && !output.endsWith('[') && !output.endsWith('.')) {
        pendingSpace = true
      }
      continue
    }
    if (token.kind === 'newline') {
      trimHorizontalEnd()
      output += '\n'
      pendingSpace = false
      atLineStart = true
      continue
    }
    if (token.kind === 'comment') {
      const wasAtLineStart = atLineStart
      writeIndent()
      if (
        !wasAtLineStart &&
        output !== '' &&
        !output.endsWith(' ') &&
        !output.endsWith('\n')
      ) {
        output += ' '
      }
      output += token.value.trimEnd()
      pendingSpace = false
      continue
    }
    if (token.kind === 'symbol') {
      if (token.value === '[' || token.value === '{') {
        writeIndent()
        if (pendingSpace && output !== '' && !output.endsWith(' '))
          output += ' '
        output += token.value
        const info = containers.get(index)!
        stack.push({
          open: token.value,
          multiline: info.multiline,
          empty: info.empty,
        })
        pendingSpace = token.value === '{' && !info.empty && !info.multiline
        continue
      }
      if (token.value === ']' || token.value === '}') {
        const container = stack.at(-1)!
        trimHorizontalEnd()
        if (atLineStart) writeIndent(Math.max(0, stack.length - 1))
        if (
          token.value === '}' &&
          container.open === '{' &&
          !container.multiline &&
          !container.empty &&
          !output.endsWith(' ')
        ) {
          output += ' '
        }
        output += token.value
        stack.pop()
        pendingSpace = false
        continue
      }
      if (token.value === ',') {
        trimHorizontalEnd()
        output += ','
        pendingSpace = source[index + 1]?.kind !== 'newline'
        continue
      }
      if (token.value === '=') {
        trimHorizontalEnd()
        output += ' = '
        pendingSpace = false
        continue
      }
      trimHorizontalEnd()
      output += '.'
      pendingSpace = false
      continue
    }

    writeIndent()
    if (
      pendingSpace &&
      output !== '' &&
      !output.endsWith(' ') &&
      !output.endsWith('\n')
    ) {
      output += ' '
    }
    output += token.value
    pendingSpace = false
    if (token.value.includes('\n')) atLineStart = token.value.endsWith('\n')
  }

  trimHorizontalEnd()
  return output
}

function formatTableHeader(tokens: readonly TomlToken[]): string | undefined {
  const { content, comment } = splitTrailingComment(tokens)
  const arrayTable =
    content[0]?.value === '[' &&
    content[1]?.value === '[' &&
    content.at(-2)?.value === ']' &&
    content.at(-1)?.value === ']'
  const table =
    !arrayTable && content[0]?.value === '[' && content.at(-1)?.value === ']'
  if (!table && !arrayTable) return undefined

  const openingCount = arrayTable ? 2 : 1
  const key = formatKey(content.slice(openingCount, -openingCount))
  if (!key) return undefined
  const header = arrayTable ? `[[${key}]]` : `[${key}]`
  return comment ? `${header} ${comment.value.trimEnd()}` : header
}

function formatAssignment(tokens: readonly TomlToken[]): string | undefined {
  const equals = tokens.findIndex(
    (token) => token.kind === 'symbol' && token.value === '=',
  )
  if (equals === -1) return undefined

  const key = formatKey(tokens.slice(0, equals))
  if (!key) return undefined
  const valueTokens = trimWhitespace(tokens.slice(equals + 1))
  const hasSpacedDot = valueTokens.some(
    (token, index) =>
      token.kind === 'symbol' &&
      token.value === '.' &&
      (valueTokens[index - 1]?.kind === 'whitespace' ||
        valueTokens[index + 1]?.kind === 'whitespace'),
  )
  if (hasSpacedDot) return undefined
  const hasValue = valueTokens.some(
    (token) => token.kind !== 'whitespace' && token.kind !== 'comment',
  )
  if (!hasValue) return undefined
  return `${key} = ${formatValue(valueTokens)}`
}

function formatChunk(chunk: TomlChunk): string {
  const original = tomlTokenText(chunk.tokens)
  const tokens = trimWhitespace(chunk.tokens)
  if (tokens.length === 0) return ''
  if (!chunk.structurallyValid) return original
  if (tokens[0].kind === 'comment') return tokens[0].value.trimEnd()

  return (
    formatTableHeader(tokens) ?? formatAssignment(tokens) ?? original.trimEnd()
  )
}

export function formatToml(content: string): string {
  const { lines, hasFinalNewline } = normalizeLines(content)
  const normalized = lines.join('\n')
  const chunks = splitChunks(tokenizeToml(normalized))
  return joinLines(chunks.map(formatChunk), hasFinalNewline)
}
