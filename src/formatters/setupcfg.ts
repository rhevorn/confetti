import { joinLines, normalizeLines, splitAssignment } from './shared.js'

export function formatSetupCfg(content: string): string {
  const { lines, hasFinalNewline } = normalizeLines(content)
  let continuation = false
  const formatted = lines.map((line) => {
    const trimmed = line.trim()
    if (
      trimmed === '' ||
      trimmed.startsWith(';') ||
      trimmed.startsWith('#') ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      continuation = false
      return trimmed
    }

    // Indented lines directly after an assignment continue a multiline value
    // such as `classifiers =` or `install_requires =`; configparser strips
    // them on read, so keep them byte-for-byte and only normalize newlines.
    if (continuation && /^\s/.test(line)) return line

    const assignment = splitAssignment(trimmed, ['=', ':'])
    continuation = assignment !== undefined
    if (!assignment) return trimmed
    const separator = assignment.separator === ':' ? ':' : ' ='
    return `${assignment.key}${separator}${
      assignment.value === '' ? '' : ` ${assignment.value}`
    }`
  })
  return joinLines(formatted, hasFinalNewline)
}
