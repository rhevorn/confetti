import { normalizeLines } from '../formatters/shared.js'
import { tokenizeLine } from '../tokenizers/scanner.js'
import { tomlHeaders } from '../tokenizers/toml-headers.js'
import { caddyBlocks } from './caddy.js'
import { maskNginxStrings } from '../tokenizers/nginx.js'
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

function braceSymbols(content: string): SymbolInfo[] {
  const { lines } = normalizeLines(content)
  const maskedLines = normalizeLines(maskNginxStrings(content).masked).lines
  const symbols: SymbolInfo[] = []
  const stack: OpenBraceBlock[] = []

  lines.forEach((line, index) => {
    const tokens = tokenizeLine(maskedLines[index], {
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

function tomlSymbols(content: string): SymbolInfo[] {
  const { lines } = normalizeLines(content)
  const headers = tomlHeaders(content)
  return headers.map((header, index) => {
    let endLine = (headers[index + 1]?.line ?? lines.length) - 1
    while (
      endLine > header.line &&
      (lines[endLine].trim() === '' ||
        lines[endLine].trimStart().startsWith('#'))
    )
      endLine -= 1
    return {
      name: header.name,
      kind: 'table',
      startLine: header.line,
      startCharacter: header.start,
      headerEndCharacter: header.end,
      endLine,
      endCharacter: lines[endLine].length,
    }
  })
}

export function computeDocumentSymbols(
  id: string,
  content: string,
): SymbolInfo[] {
  if (id === 'nginx') return braceSymbols(content)
  if (id === 'caddy')
    return caddyBlocks(content).filter((block) => block.name !== '')
  if (id === 'ssh') {
    return headerSymbols(
      content,
      isSshBlockHeader,
      (header) => header,
      'host',
      HASH_COMMENTS,
    )
  }
  if (id === 'toml') return tomlSymbols(content)
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
