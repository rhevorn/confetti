import { normalizeLines } from '../formatters/shared.js'
import { tokenizeLine } from '../tokenizers/scanner.js'
import { caddyBlocks } from './caddy.js'
import { maskNginxStrings } from '../tokenizers/nginx.js'
import {
  HASH_COMMENTS,
  INI_COMMENTS,
  INI_SECTION_FORMATS,
  headerBlocks,
  isIniSectionHeader,
  isSshBlockHeader,
  tomlTableBlocks,
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
  return tomlTableBlocks(content).map((block) => ({
    name: block.name,
    kind: 'table',
    startLine: block.startLine,
    startCharacter: block.startCharacter,
    headerEndCharacter: block.headerEndCharacter,
    endLine: block.endLine,
    endCharacter: block.endCharacter,
  }))
}

export type SymbolStrategy = (content: string) => SymbolInfo[]

const caddySymbols: SymbolStrategy = (content) =>
  caddyBlocks(content).filter((block) => block.name !== '')

const sshSymbols: SymbolStrategy = (content) =>
  headerSymbols(
    content,
    isSshBlockHeader,
    (header) => header,
    'host',
    HASH_COMMENTS,
  )

const iniSymbols: SymbolStrategy = (content) =>
  headerSymbols(
    content,
    isIniSectionHeader,
    (header) => header.slice(1, -1),
    'section',
    INI_COMMENTS,
  )

// The INI family comes first so that an explicit entry below always wins:
// Map construction is last-write-wins, and the derived id set cannot tell the
// difference.
const SYMBOL_STRATEGIES = new Map<string, SymbolStrategy>([
  ...Array.from(INI_SECTION_FORMATS, (id): [string, SymbolStrategy] => [
    id,
    iniSymbols,
  ]),
  ['nginx', braceSymbols],
  ['caddy', caddySymbols],
  ['ssh', sshSymbols],
  ['toml', tomlSymbols],
])

/** Format ids with outline symbol support, derived from the dispatch table. */
export const SYMBOL_FORMAT_IDS: ReadonlySet<string> = new Set(
  SYMBOL_STRATEGIES.keys(),
)

export function computeDocumentSymbols(
  id: string,
  content: string,
): SymbolInfo[] {
  return SYMBOL_STRATEGIES.get(id)?.(content) ?? []
}
