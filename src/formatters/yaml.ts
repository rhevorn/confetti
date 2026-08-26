function isBlockScalarHeader(line: string): boolean {
  return /(?:^|:\s*)[|>][+-]?[1-9]?\s*(?:#.*)?$/.test(line)
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
