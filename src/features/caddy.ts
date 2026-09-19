import { normalizeLines } from '../formatters/shared.js'
import { scanCaddyLines } from '../tokenizers/caddy.js'
// Type-only on purpose: a value import here would make caddy -> symbols ->
// folding -> caddy a runtime cycle, and the dispatch maps are built at module
// scope.
import type { SymbolInfo } from './symbols.js'

/** Return actual lexical blocks; payload braces never reach this stack. */
export function caddyBlocks(content: string): SymbolInfo[] {
  const { records, unsafe } = scanCaddyLines(normalizeLines(content).lines)
  if (unsafe) return []
  const blocks: SymbolInfo[] = []
  const stack: { name: string; line: number; start: number; end: number }[] = []
  records.forEach(({ source, tokens }, line) => {
    for (const token of tokens) {
      if (!token.bare) continue
      if (token.text === '{') {
        const name = source.slice(0, token.start).trim()
        stack.push({
          name,
          line,
          start: source.length - source.trimStart().length,
          end: token.start + 1,
        })
      } else if (token.text === '}') {
        const open = stack.pop()
        if (open)
          blocks.push({
            name: open.name,
            kind: 'server',
            startLine: open.line,
            startCharacter: open.start,
            headerEndCharacter: open.end,
            endLine: line,
            endCharacter: token.start + 1,
          })
      }
    }
  })
  return blocks
}
