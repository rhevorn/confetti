/** Physical lines belonging to one dotenv entry. Quoted values may span lines. */
export interface EnvRecord {
  text: string
  line: number
  multiline: boolean
}

export function envRecords(lines: readonly string[]): EnvRecord[] {
  const records: EnvRecord[] = []
  for (let line = 0; line < lines.length; line += 1) {
    const start = line
    const text = lines[line]
    const match = /^\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=\s*(["'`])/.exec(
      text,
    )
    if (match) {
      const quote = match[1]
      let index = match[0].length
      let closed = false
      while (!closed) {
        const current = lines[line]
        for (; index < current.length; index += 1) {
          if (current[index] === '\\' && quote === '"') {
            index += 1
          } else if (current[index] === quote) {
            closed = true
            break
          }
        }
        if (closed || line + 1 === lines.length) break
        line += 1
        index = 0
      }
    }
    records.push({
      text: lines.slice(start, line + 1).join('\n'),
      line: start,
      multiline: line !== start,
    })
  }
  return records
}
