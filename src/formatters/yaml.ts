function isBlockScalarHeader(line: string): boolean {
  let quote: '"' | "'" | undefined
  let escaped = false
  let code = line

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (escaped) {
      escaped = false
      continue
    }
    if (quote === '"' && character === '\\') {
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
    if (character === '#') {
      code = line.slice(0, index)
      break
    }
  }

  return /(?:^|:\s*|-\s+)[|>](?:[+-][1-9]?|[1-9][+-]?)?$/.test(code.trimEnd())
}

function indentation(line: string): number {
  return line.match(/^ */)?.[0].length ?? 0
}

function formatStructuralWhitespace(line: string): string {
  const output = line.trimEnd()
  const mapping = /^(\s*)([A-Za-z0-9_.-]+):[ \t]*(.*)$/.exec(output)
  if (mapping) {
    const [, indent, key, value] = mapping
    return `${indent}${key}:${value === '' ? '' : ` ${value}`}`
  }

  const sequence = /^(\s*)-[ \t]+(.*)$/.exec(output)
  if (sequence) {
    const [, indent, value] = sequence
    return `${indent}-${value === '' ? '' : ` ${value}`}`
  }

  return output
}

export function formatYaml(content: string): string {
  const hasFinalNewline = content.endsWith('\n')
  const lines = content.replace(/\r\n?/g, '\n').split('\n')
  if (hasFinalNewline) lines.pop()

  let blockParentIndent: number | undefined
  const formatted = lines.map((line) => {
    if (blockParentIndent !== undefined) {
      if (line.trim() === '' || indentation(line) > blockParentIndent) {
        return line
      }
      blockParentIndent = undefined
    }

    const output = formatStructuralWhitespace(line)
    if (isBlockScalarHeader(output)) {
      blockParentIndent = indentation(output)
    }
    return output
  })

  const result = formatted.join('\n')
  return hasFinalNewline ? `${result}\n` : result
}
