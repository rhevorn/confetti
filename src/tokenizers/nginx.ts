/** Blank quoted content without moving any line or UTF-16 column offsets. */
export function maskNginxStrings(content: string): {
  masked: string
  multiline: boolean
} {
  const characters = content.split('')
  let quote: string | undefined
  let comment = false
  let multiline = false
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index]
    if (character === '\n') {
      if (quote !== undefined) multiline = true
      comment = false
      continue
    }
    if (comment) continue
    if (character === '\\') {
      characters[index] = ' '
      if (index + 1 < content.length) {
        if (content[index + 1] === '\n') {
          if (quote !== undefined) multiline = true
        } else characters[index + 1] = ' '
        index += 1
      }
      continue
    }
    if (quote !== undefined) {
      characters[index] = ' '
      if (character === quote) quote = undefined
    } else if (character === '"' || character === "'") {
      quote = character
      characters[index] = ' '
    } else if (character === '#') comment = true
  }
  return { masked: characters.join(''), multiline }
}
