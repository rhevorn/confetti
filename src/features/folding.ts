import { normalizeLines } from '../formatters/shared.js'
import { tokenizeLine } from '../tokenizers/scanner.js'

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
 */
function contentEnd(
  lines: readonly string[],
  before: number,
  comments: readonly string[],
): number {
  let end = before
  while (end >= 0) {
    const trimmed = lines[end].trim()
    if (
      trimmed !== '' &&
      !comments.some((comment) => trimmed.startsWith(comment))
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
  const { lines } = normalizeLines(content)
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

export function computeFoldingRanges(
  id: string,
  content: string,
): FoldingRangeInfo[] {
  if (id === 'nginx') return braceFoldingRanges(content)
  if (id === 'apache') return tagFoldingRanges(content)
  if (id === 'ssh') {
    return blockFoldingRanges(content, isSshBlockHeader, HASH_COMMENTS)
  }
  if (INI_SECTION_FORMATS.has(id)) {
    return blockFoldingRanges(content, isIniSectionHeader, INI_COMMENTS)
  }
  return []
}
