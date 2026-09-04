const ESCAPES: Record<string, string> = {
  b: '\b',
  t: '\t',
  n: '\n',
  f: '\f',
  r: '\r',
  '"': '"',
  '\\': '\\',
}

/** Decode a closed TOML basic key string, accepting only Unicode scalars. */
export function decodeTomlKey(value: string): string | undefined {
  const output: string[] = []
  for (let index = 1; index < value.length - 1; index += 1) {
    const character = value[index]
    if (character !== '\\') {
      const code = value.codePointAt(index)!
      if (
        (code < 0x20 && code !== 9) ||
        code === 0x7f ||
        character === '"' ||
        (code >= 0xd800 && code <= 0xdfff)
      )
        return undefined
      output.push(String.fromCodePoint(code))
      if (code > 0xffff) index += 1
      continue
    }
    const escape = value[++index]
    if (Object.hasOwn(ESCAPES, escape)) output.push(ESCAPES[escape])
    else if (escape === 'u' || escape === 'U') {
      const length = escape === 'u' ? 4 : 8
      const digits = value.slice(index + 1, index + 1 + length)
      if (digits.length !== length || !/^[0-9a-f]+$/i.test(digits))
        return undefined
      const code = Number.parseInt(digits, 16)
      if (code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff))
        return undefined
      output.push(String.fromCodePoint(code))
      index += length
    } else return undefined
  }
  return output.join('')
}
