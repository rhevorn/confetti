import { normalizeLines, splitAssignment } from '../formatters/shared.js'
import { INI_SECTION_FORMATS, isIniSectionHeader } from './folding.js'
import { envRecords } from '../tokenizers/env.js'
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

function iniDiagnostics(content: string, id: string): DiagnosticInfo[] {
  const { lines } = normalizeLines(content)
  const diagnostics: DiagnosticInfo[] = []
  const firstSeen = new Map<string, number>()
  let section = ''
  const python = id === 'pyini' || id === 'setupcfg' || id === 'pip'
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
      id === 'systemd' &&
      !SYSTEMD_SCALARS.has(`${section}.${assignment.key}`)
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

export function computeDiagnostics(
  id: string,
  content: string,
): DiagnosticInfo[] {
  if (id === 'env') return envDiagnostics(content)
  if (id === 'toml') return tomlDiagnostics(content)
  if (INI_SECTION_FORMATS.has(id)) return iniDiagnostics(content, id)
  return []
}
