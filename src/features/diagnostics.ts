import {
  endsWithContinuation,
  normalizeLines,
  splitAssignment,
} from '../formatters/shared.js'
import { isIniSectionHeader } from './folding.js'
import { envRecords } from '../tokenizers/env.js'
import {
  decodePropertiesKey,
  propertiesKeyText,
} from '../tokenizers/properties.js'
import { tomlHeaders } from '../tokenizers/toml-headers.js'

export interface DiagnosticInfo {
  message: string
  line: number
  startCharacter: number
  endCharacter: number
}

function duplicate(
  subject: string,
  line: number,
  firstLine: number,
  startCharacter: number,
  endCharacter: number,
): DiagnosticInfo {
  return {
    message: `${subject} (also defined on line ${firstLine + 1})`,
    line,
    startCharacter,
    endCharacter,
  }
}

function envDiagnostics(content: string): DiagnosticInfo[] {
  const { lines } = normalizeLines(content)
  const diagnostics: DiagnosticInfo[] = []
  const firstSeen = new Map<string, number>()

  envRecords(lines).forEach(({ text: line, line: index }) => {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) return
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(
      line.trimStart(),
    )
    if (!match) return
    const key = match[1]
    const firstLine = firstSeen.get(key)
    if (firstLine === undefined) {
      firstSeen.set(key, index)
      return
    }
    // The key is the last occurrence inside the match: trimStart keeps the
    // indent, so the offset must skip both the indent and any export prefix.
    const keyOffset =
      line.length - line.trimStart().length + match[0].lastIndexOf(key)
    diagnostics.push(
      duplicate(
        `Duplicate key "${key}"`,
        index,
        firstLine,
        keyOffset,
        keyOffset + key.length,
      ),
    )
  })

  return diagnostics
}

// Only known scalar systemd settings are eligible. Unknown and list-valued
// directives may accumulate or reset values; repetition alone is not an error.
const SYSTEMD_SCALARS = new Set([
  'Unit.Description',
  'Service.Type',
  'Service.Restart',
  'Service.User',
  'Service.Group',
  'Service.WorkingDirectory',
  'Service.UMask',
])

interface IniRules {
  /** Lowercase keys, and treat indented lines as continuation values. */
  python?: boolean
  /** Report only these `Section.Key` scalar settings. */
  scalars?: ReadonlySet<string>
}

function iniDiagnostics(
  content: string,
  rules: IniRules = {},
): DiagnosticInfo[] {
  const { lines } = normalizeLines(content)
  const diagnostics: DiagnosticInfo[] = []
  const firstSeen = new Map<string, number>()
  const python = rules.python === true
  let section = ''
  let keyIndent: number | undefined

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith(';')) {
      return
    }
    const indent = line.length - line.trimStart().length
    if (python && keyIndent !== undefined && indent > keyIndent) return
    keyIndent = undefined
    if (isIniSectionHeader(trimmed)) {
      section = trimmed.slice(1, -1)
      return
    }
    const assignment = splitAssignment(trimmed, ['=', ':'])
    if (!assignment) return
    keyIndent = indent
    if (
      rules.scalars !== undefined &&
      !rules.scalars.has(`${section}.${assignment.key}`)
    )
      return
    const key = python ? assignment.key.toLowerCase() : assignment.key
    const scopedKey = `${section}\u0000${key}`
    const firstLine = firstSeen.get(scopedKey)
    if (firstLine === undefined) {
      firstSeen.set(scopedKey, index)
      return
    }
    diagnostics.push(
      duplicate(
        section
          ? `Duplicate key "${assignment.key}" in section "${section}"`
          : `Duplicate key "${assignment.key}"`,
        index,
        firstLine,
        indent,
        indent + assignment.key.length,
      ),
    )
  })

  return diagnostics
}

function tomlDiagnostics(content: string): DiagnosticInfo[] {
  const diagnostics: DiagnosticInfo[] = []
  const firstSeen = new Map<string, number>()
  const arrays = new Map<string, number>()

  tomlHeaders(content).forEach((header) => {
    const scoped: (string | number)[] = []
    header.path.forEach((part, index) => {
      scoped.push(part)
      const key = JSON.stringify(scoped)
      if (header.array && index === header.path.length - 1)
        arrays.set(key, (arrays.get(key) ?? 0) + 1)
      const instance = arrays.get(key)
      if (instance !== undefined) scoped.push(instance)
    })
    if (header.array) return
    const key = JSON.stringify(scoped)
    const firstLine = firstSeen.get(key)
    if (firstLine === undefined) {
      firstSeen.set(key, header.line)
      return
    }
    diagnostics.push(
      duplicate(
        `Duplicate table "${header.name}"`,
        header.line,
        firstLine,
        header.start,
        header.end,
      ),
    )
  })

  return diagnostics
}

function isPropertiesIgnorable(line: string): boolean {
  const trimmed = line.trim()
  return trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('!')
}

function isJavaBlank(line: string): boolean {
  return /^[ \t\f]*$/.test(line)
}

/**
 * Joins physical lines the way `java.util.Properties.load` builds a logical
 * line: a new record cannot start on a comment or blank line, even when that
 * line ends with `\`, but once a record has started, a trailing odd backslash
 * continues it, leading space/tab/form-feed on the next line are dropped, and
 * blank physical lines in between are skipped as whitespace.
 */
function propertiesRecords(
  lines: readonly string[],
): { startLine: number; text: string }[] {
  const records: { startLine: number; text: string }[] = []

  for (let index = 0; index < lines.length;) {
    if (isPropertiesIgnorable(lines[index])) {
      index += 1
      continue
    }

    const startLine = index
    let text = lines[index]
    index += 1

    while (endsWithContinuation(text)) {
      text = text.slice(0, -1)
      while (index < lines.length && isJavaBlank(lines[index])) {
        index += 1
      }
      if (index >= lines.length) break
      text += lines[index].replace(/^[ \t\f]+/, '')
      index += 1
    }

    records.push({ startLine, text })
  }

  return records
}

function propertiesDiagnostics(content: string): DiagnosticInfo[] {
  const { lines } = normalizeLines(content)
  const diagnostics: DiagnosticInfo[] = []
  const firstSeen = new Map<string, number>()

  for (const { startLine, text } of propertiesRecords(lines)) {
    const raw = propertiesKeyText(text)
    if (raw === undefined || raw === '') continue

    // Identity uses the unescaped key, so `a\u0041` and `aA` collide.
    // Malformed escapes are skipped: they can only hide a duplicate, never
    // invent one.
    const key = decodePropertiesKey(raw)
    if (key === undefined) continue

    const firstLine = firstSeen.get(key)
    if (firstLine === undefined) {
      firstSeen.set(key, startLine)
      continue
    }

    const physical = lines[startLine]
    const indent = physical.length - physical.trimStart().length
    diagnostics.push(
      duplicate(
        `Duplicate key "${raw}"`,
        startLine,
        firstLine,
        indent,
        Math.min(indent + raw.length, physical.length),
      ),
    )
  }

  return diagnostics
}

export type DiagnosticStrategy = (content: string) => DiagnosticInfo[]

const pythonIniDiagnostics: DiagnosticStrategy = (content) =>
  iniDiagnostics(content, { python: true })

const systemdDiagnostics: DiagnosticStrategy = (content) =>
  iniDiagnostics(content, { scalars: SYSTEMD_SCALARS })

const DIAGNOSTIC_STRATEGIES = new Map<string, DiagnosticStrategy>([
  ['env', envDiagnostics],
  ['toml', tomlDiagnostics],
  ['properties', propertiesDiagnostics],
  // INI-family formats are listed one by one: the Python tooling and systemd
  // dialects need different rules, so a format added to INI_SECTION_FORMATS
  // must not silently inherit the generic, false-positive-prone rule set.
  ['ini', iniDiagnostics],
  ['gitconfig', iniDiagnostics],
  ['mysql', iniDiagnostics],
  ['pip', pythonIniDiagnostics],
  ['pyini', pythonIniDiagnostics],
  ['setupcfg', pythonIniDiagnostics],
  ['systemd', systemdDiagnostics],
])

/** Format ids with duplicate-key diagnostics, derived from the dispatch table. */
export const DIAGNOSTIC_FORMAT_IDS: ReadonlySet<string> = new Set(
  DIAGNOSTIC_STRATEGIES.keys(),
)

export function computeDiagnostics(
  id: string,
  content: string,
): DiagnosticInfo[] {
  return DIAGNOSTIC_STRATEGIES.get(id)?.(content) ?? []
}
