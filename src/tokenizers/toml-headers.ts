import { tokenizeToml, type TomlToken } from './toml.js'
import { decodeTomlKey } from './toml-string.js'

export interface TomlHeader {
  path: string[]
  name: string
  array: boolean
  line: number
  start: number
  end: number
}

/** Extract only complete top-level headers, never text inside a value. */
export function tomlHeaders(content: string): TomlHeader[] {
  const headers: TomlHeader[] = []
  let statement: TomlToken[] = []
  let line = 0
  let startLine = 0
  let depth = 0
  const flush = (): void => {
    const code = statement.filter(
      (token) => token.kind !== 'whitespace' && token.kind !== 'comment',
    )
    const array = code[1]?.value === '['
    const width = array ? 2 : 1
    const opening = code.slice(0, width)
    const closing = code.slice(-width)
    if (
      opening.length === width &&
      opening.every((token) => token.value === '[') &&
      closing.every((token) => token.value === ']')
    ) {
      const keys = code.slice(width, -width)
      const path: string[] = []
      let valid = keys.length > 0 && keys.length % 2 === 1
      keys.forEach((token, index) => {
        if (index % 2 === 1) {
          valid &&= token.value === '.'
          return
        }
        if (token.kind === 'bare' && /^[A-Za-z0-9_-]+$/.test(token.value))
          path.push(token.value)
        else if (token.kind === 'literal-string' && token.closed)
          path.push(token.value.slice(1, -1))
        else if (token.kind === 'basic-string' && token.closed) {
          const key = decodeTomlKey(token.value)
          if (key === undefined) valid = false
          else path.push(key)
        } else valid = false
      })
      if (valid) {
        const raw = statement.map((token) => token.value).join('')
        const start = raw.length - raw.trimStart().length
        const name = keys.map((token) => token.value).join('')
        const comment = statement.findIndex((token) => token.kind === 'comment')
        const codeText = (comment < 0 ? statement : statement.slice(0, comment))
          .map((token) => token.value)
          .join('')
          .trimEnd()
        headers.push({
          path,
          name,
          array,
          line: startLine,
          start,
          end: codeText.length,
        })
      }
    }
    statement = []
  }
  for (const token of tokenizeToml(content.replace(/\r\n?/g, '\n'))) {
    if (token.kind === 'newline') {
      if (depth === 0) flush()
      else statement.push(token)
      line += 1
      if (depth === 0) startLine = line
    } else {
      statement.push(token)
      if (token.kind === 'symbol') {
        if (token.value === '[' || token.value === '{') depth += 1
        if (token.value === ']' || token.value === '}')
          depth = Math.max(0, depth - 1)
      }
      line += token.value.split('\n').length - 1
    }
  }
  flush()
  return headers
}
