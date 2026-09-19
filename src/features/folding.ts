import { normalizeLines } from '../formatters/shared.js'
import { tokenizeLine } from '../tokenizers/scanner.js'
import { caddyBlocks } from './caddy.js'
import { maskNginxStrings } from '../tokenizers/nginx.js'
import { tokenizeToml } from '../tokenizers/toml.js'
import { tomlHeaders } from '../tokenizers/toml-headers.js'

export interface FoldingRangeInfo {
  startLine: number
  endLine: number
}

export type HeaderPredicate = (line: string) => boolean

export const INI_COMMENTS = ['#', ';']
export const HASH_COMMENTS = ['#']

export const INI_SECTION_FORMATS = new Set([
  'ini',
  'gitconfig',
  'mysql',
  'pip',
  'pyini',
  'setupcfg',
  'systemd',
])

export const isIniSectionHeader: HeaderPredicate = (line) =>
  line.startsWith('[') && line.endsWith(']') && line.length > 2

export const isSshBlockHeader: HeaderPredicate = (line) =>
  /^(?:Host|Match)\s+\S/.test(line)

/**
 * Finds the last line at or before `before` that still holds real content,
 * skipping trailing blank and comment lines so folded regions do not
 * swallow the whitespace separating them from the next block.
 *
 * `alwaysContent` names lines the raw-text comment test would misjudge, such
 * as a TOML multiline string whose last line begins with `#`.
 */
function contentEnd(
  lines: readonly string[],
  before: number,
  comments: readonly string[],
  alwaysContent?: ReadonlySet<number>,
): number {
  let end = before
  while (end >= 0) {
    const trimmed = lines[end].trim()
    if (
      alwaysContent?.has(end) === true ||
      (trimmed !== '' &&
        !comments.some((comment) => trimmed.startsWith(comment)))
    ) {
      break
    }
    end -= 1
  }
  return end
}

export interface HeaderBlock {
  name: string
  startLine: number
  startCharacter: number
  headerEndCharacter: number
  endLine: number
  contentEndCharacter: number
}

export function headerBlocks(
  content: string,
  isHeader: HeaderPredicate,
  comments: readonly string[],
): HeaderBlock[] {
  const { lines } = normalizeLines(content)
  const blocks: HeaderBlock[] = []
  let start:
    | { name: string; line: number; character: number; headerEnd: number }
    | undefined

  const close = (before: number): void => {
    if (start === undefined) return
    const endLine = contentEnd(lines, before, comments)
    blocks.push({
      name: start.name,
      startLine: start.line,
      startCharacter: start.character,
      headerEndCharacter: start.headerEnd,
      endLine,
      contentEndCharacter: lines[endLine].length,
    })
    start = undefined
  }

  lines.forEach((line, index) => {
    if (isHeader(line.trim())) {
      close(index - 1)
      start = {
        name: line.trim(),
        line: index,
        character: line.length - line.trimStart().length,
        headerEnd: line.length - line.trimStart().length + line.trim().length,
      }
    }
  })
  close(lines.length - 1)

  return blocks
}

function blockFoldingRanges(
  content: string,
  isHeader: HeaderPredicate,
  comments: readonly string[],
): FoldingRangeInfo[] {
  return headerBlocks(content, isHeader, comments)
    .filter(({ startLine, endLine }) => endLine > startLine)
    .map(({ startLine, endLine }) => ({ startLine, endLine }))
}

function braceFoldingRanges(content: string): FoldingRangeInfo[] {
  const { lines } = normalizeLines(maskNginxStrings(content).masked)
  const ranges: FoldingRangeInfo[] = []
  const stack: number[] = []

  lines.forEach((line, index) => {
    const tokens = tokenizeLine(line, {
      symbols: ['{', '}'],
      comments: HASH_COMMENTS,
    })
    for (const token of tokens) {
      if (token.kind !== 'symbol') continue
      if (token.value === '{') {
        stack.push(index)
      } else {
        const startLine = stack.pop()
        if (startLine !== undefined && index > startLine) {
          ranges.push({ startLine, endLine: index })
        }
      }
    }
  })

  return ranges
}

function tagFoldingRanges(content: string): FoldingRangeInfo[] {
  const { lines } = normalizeLines(content)
  const ranges: FoldingRangeInfo[] = []
  const stack: number[] = []

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (/^<\/[\w:.-]+>\s*(?:#.*)?$/.test(trimmed)) {
      const startLine = stack.pop()
      if (startLine !== undefined && index > startLine) {
        ranges.push({ startLine, endLine: index })
      }
    } else if (/^<[\w:.-][^>]*>\s*(?:#.*)?$/.test(trimmed)) {
      stack.push(index)
    }
  })

  return ranges
}

export interface TomlTableBlock {
  name: string
  startLine: number
  startCharacter: number
  headerEndCharacter: number
  endLine: number
  endCharacter: number
}

/**
 * Lines covered by a multiline string. `tomlHeaders` already ignores
 * table-like text inside them; the end walk needs the same awareness, or a
 * table whose last content line starts with `#` inside a string ends a line
 * early.
 */
function multilineStringLines(content: string): ReadonlySet<number> {
  const lines = new Set<number>()
  let line = 0

  for (const token of tokenizeToml(content.replace(/\r\n?/g, '\n'))) {
    const span = token.value.split('\n').length - 1
    if (
      token.kind === 'multiline-basic-string' ||
      token.kind === 'multiline-literal-string'
    ) {
      for (let offset = 0; offset <= span; offset += 1) lines.add(line + offset)
    }
    line += span
  }

  return lines
}

/**
 * Table extents shared by folding ranges and outline symbols, so the two can
 * never disagree about where a table ends.
 */
export function tomlTableBlocks(content: string): TomlTableBlock[] {
  const { lines } = normalizeLines(content)
  const headers = tomlHeaders(content)
  const alwaysContent = multilineStringLines(content)

  return headers.map((header, index) => {
    const endLine = contentEnd(
      lines,
      (headers[index + 1]?.line ?? lines.length) - 1,
      HASH_COMMENTS,
      alwaysContent,
    )
    return {
      name: header.name,
      startLine: header.line,
      startCharacter: header.start,
      headerEndCharacter: header.end,
      endLine,
      endCharacter: lines[endLine].length,
    }
  })
}

function tomlFoldingRanges(content: string): FoldingRangeInfo[] {
  return tomlTableBlocks(content)
    .filter(({ startLine, endLine }) => endLine > startLine)
    .map(({ startLine, endLine }) => ({ startLine, endLine }))
}

export type FoldingStrategy = (content: string) => FoldingRangeInfo[]

const caddyFolding: FoldingStrategy = (content) =>
  caddyBlocks(content)
    .filter((block) => block.endLine > block.startLine)
    .map(({ startLine, endLine }) => ({ startLine, endLine }))

const sshFolding: FoldingStrategy = (content) =>
  blockFoldingRanges(content, isSshBlockHeader, HASH_COMMENTS)

const iniFolding: FoldingStrategy = (content) =>
  blockFoldingRanges(content, isIniSectionHeader, INI_COMMENTS)

// The INI family comes first so that an explicit entry below always wins:
// Map construction is last-write-wins, and the derived id set cannot tell the
// difference.
const FOLDING_STRATEGIES = new Map<string, FoldingStrategy>([
  ...Array.from(INI_SECTION_FORMATS, (id): [string, FoldingStrategy] => [
    id,
    iniFolding,
  ]),
  ['nginx', braceFoldingRanges],
  ['caddy', caddyFolding],
  ['apache', tagFoldingRanges],
  ['ssh', sshFolding],
  ['toml', tomlFoldingRanges],
])

/** Format ids with folding support, derived from the dispatch table. */
export const FOLDING_FORMAT_IDS: ReadonlySet<string> = new Set(
  FOLDING_STRATEGIES.keys(),
)

export function computeFoldingRanges(
  id: string,
  content: string,
): FoldingRangeInfo[] {
  return FOLDING_STRATEGIES.get(id)?.(content) ?? []
}
