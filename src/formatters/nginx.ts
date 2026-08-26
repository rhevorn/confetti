function braceDelta(line: string): number {
  let delta = 0
  let quote: string | undefined
  let escaped = false

  for (const character of line) {
    if (escaped) {
      escaped = false
      continue
    }
    if (character === '\\') {
      escaped = true
      continue
    }
    if (quote) {
      if (character === quote) quote = undefined
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      continue
    }
    if (character === '#') break
    if (character === '{') delta += 1
    if (character === '}') delta -= 1
  }

  return delta
}

function normalizeHorizontalWhitespace(line: string): string {
  let output = ''
  let quote: string | undefined
  let pendingSpace = false

  const appendPendingSpace = (): void => {
    if (pendingSpace && output !== '' && !output.endsWith(' ')) output += ' '
    pendingSpace = false
  }

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]

    if (quote) {
      output += character
      if (character === '\\' && index + 1 < line.length) {
        output += line[index + 1]
        index += 1
      } else if (character === quote) {
        quote = undefined
      }
      continue
    }

    if (character === '"' || character === "'") {
      appendPendingSpace()
      quote = character
      output += character
      continue
    }

    if (character === '\\' && index + 1 < line.length) {
      appendPendingSpace()
      output += character + line[index + 1]
      index += 1
      continue
    }

    if (/\s/.test(character)) {
      pendingSpace = true
      continue
    }

    if (character === '#') {
      if (output !== '' && !output.endsWith(' ')) output += ' '
      output += line.slice(index).trimEnd()
      return output
    }

    if (character === ';') {
      output = output.trimEnd() + character
      pendingSpace = false
      continue
    }

    if (character === '{') {
      output = output.trimEnd()
      if (output !== '' && !output.endsWith(' ')) output += ' '
      output += character
      pendingSpace = false
      continue
    }

    appendPendingSpace()
    output += character
  }

  return output.trimEnd()
}

export function formatNginx(content: string): string {
  const hasFinalNewline = content.endsWith('\n')
  const lines = content.replace(/\r\n?/g, '\n').split('\n')
  if (hasFinalNewline) lines.pop()

  let depth = 0
  const formatted = lines.map((line) => {
    const normalized = normalizeHorizontalWhitespace(line.trim())
    if (normalized === '') return ''

    if (normalized.startsWith('}')) depth = Math.max(0, depth - 1)
    const output = `${'  '.repeat(depth)}${normalized}`
    const delta = braceDelta(normalized)
    depth = Math.max(0, depth + delta + (normalized.startsWith('}') ? 1 : 0))
    return output
  })

  const result = formatted.join('\n')
  return hasFinalNewline ? `${result}\n` : result
}
