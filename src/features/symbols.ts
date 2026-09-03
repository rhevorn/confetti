import { normalizeLines } from '../formatters/shared.js'
import { tokenizeLine } from '../tokenizers/scanner.js'
import {
  HASH_COMMENTS,
  INI_COMMENTS,
  INI_SECTION_FORMATS,
  headerBlocks,
  isIniSectionHeader,
  isSshBlockHeader,
  type HeaderPredicate,
} from './folding.js'

export interface SymbolInfo {
  name: string
  kind: 'section' | 'host' | 'server' | 'table'
  startLine: number
  startCharacter: number
  endLine: number
  endCharacter: number
  headerEndCharacter: number
}

interface OpenBraceBlock {
  name: string
  line: number
  character: number
  headerEnd: number
}

const isTomlTableHeader: HeaderPredicate = (line) =>
  (line.startsWith('[[') && line.endsWith(']]')) ||
  (line.startsWith('[') && line.endsWith(']') && line.length > 2)

function tomlTableName(header: string): string {
  if (header.startsWith('[[')) return header.slice(2, -2)
  return header.slice(1, -1)
}

function braceSymbols(content: string): SymbolInfo[] {
  const { lines } = normalizeLines(content)
  const symbols: SymbolInfo[] = []
  const stack: OpenBraceBlock[] = []

  lines.forEach((line, index) => {
    const tokens = tokenizeLine(line, {
      symbols: ['{', '}'],
      comments: HASH_COMMENTS,
    })
    let offset = 0
    for (const token of tokens) {
      if (token.kind === 'symbol' && token.value === '{') {
        stack.push({
          name: line.slice(0, offset).trim(),
          line: index,
          character: line.length - line.trimStart().length,
          headerEnd: offset + 1,
        })
      } else if (token.kind === 'symbol' && token.value === '}') {
        const open = stack.pop()
        if (open) {
          symbols.push({
            name: open.name,
            kind: 'server',
            startLine: open.line,
            startCharacter: open.character,
            endLine: index,
            endCharacter: offset + 1,
            headerEndCharacter: open.headerEnd,
          })
        }
      }
      offset += token.value.length
    }
  })

  return symbols
}

function headerSymbols(
  content: string,
  isHeader: HeaderPredicate,
  nameOf: (header: string) => string,
  kind: SymbolInfo['kind'],
  comments: readonly string[],
): SymbolInfo[] {
  return headerBlocks(content, isHeader, comments).map((block) => ({
    name: nameOf(block.name),
    kind,
    startLine: block.startLine,
    startCharacter: block.startCharacter,
    endLine: block.endLine,
    endCharacter: block.contentEndCharacter,
    headerEndCharacter: block.headerEndCharacter,
  }))
}

/**
 * Caddyfile blocks open with a brace at the end of a line and close with a
 * line that starts with `}`. Placeholders such as {http.request.host} are
 * balanced inline, so scanning whole lines for leading `}` and trailing `{`
 * ignores them without pushing anything onto the stack.
 */
function caddySymbols(content: string): SymbolInfo[] {
  const { lines } = normalizeLines(content)
  const symbols: SymbolInfo[] = []
  const stack: OpenBraceBlock[] = []

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    const code = trimmed.split('#', 1)[0].trimEnd()
    if (code === '') return

    if (code.startsWith('}')) {
      const open = stack.pop()
      if (open) {
        symbols.push({
          name: open.name,
          kind: 'server',
          startLine: open.line,
          startCharacter: open.character,
          endLine: index,
          endCharacter: line.length,
          headerEndCharacter: open.headerEnd,
        })
      }
      return
    }

    if (!code.endsWith('{')) return
    const name = code.slice(0, -1).trim()
    if (name === '') return
    // The header ends just past the opening brace.
    const character = line.length - line.trimStart().length
    stack.push({
      name,
      line: index,
      character,
      headerEnd: character + code.length,
    })
  })

  return symbols
}

export function computeDocumentSymbols(
  id: string,
  content: string,
): SymbolInfo[] {
  if (id === 'nginx') return braceSymbols(content)
  if (id === 'caddy') return caddySymbols(content)
  if (id === 'ssh') {
    return headerSymbols(
      content,
      isSshBlockHeader,
      (header) => header,
      'host',
      HASH_COMMENTS,
    )
  }
  if (id === 'toml') {
    return headerSymbols(
      content,
      isTomlTableHeader,
      tomlTableName,
      'table',
      HASH_COMMENTS,
    )
  }
  if (INI_SECTION_FORMATS.has(id)) {
    return headerSymbols(
      content,
      isIniSectionHeader,
      (header) => header.slice(1, -1),
      'section',
      INI_COMMENTS,
    )
  }
  return []
}
