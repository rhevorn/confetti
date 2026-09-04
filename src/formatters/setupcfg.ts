import { joinLines, normalizeLines, splitAssignment } from './shared.js'

export function formatSetupCfg(content: string): string {
  const { lines, hasFinalNewline } = normalizeLines(content)
  let keyIndent: string | undefined
  let section = ''
  let integerOption = false
  const formatted = lines.map((line) => {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith(';') || trimmed.startsWith('#')) {
      return trimmed
    }

    // ConfigParser strips leading whitespace from continuation values. Keep
    // the payload intact but align each continuation four spaces past its key.
    // Classification uses the original key indentation, not the output line.
    const indent = line.length - line.trimStart().length
    const assignment = splitAssignment(trimmed, ['=', ':'])
    // Flake8 integer options cannot contain multiline values. Recover an
    // accidentally indented assignment after one, without touching list fields.
    const misplacedKey =
      keyIndent !== undefined &&
      indent > keyIndent.length &&
      section === 'flake8' &&
      integerOption &&
      assignment?.separator === '=' &&
      /^[A-Za-z][A-Za-z0-9_-]*$/.test(assignment.key)
    if (keyIndent !== undefined && indent > keyIndent.length) {
      if (!misplacedKey) return `    ${line.trimStart()}`
    }

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      keyIndent = undefined
      section = trimmed.slice(1, -1).toLowerCase()
      integerOption = false
      return trimmed
    }

    keyIndent = assignment
      ? misplacedKey
        ? keyIndent
        : line.slice(0, indent)
      : undefined
    integerOption =
      assignment !== undefined &&
      /^(?:max[-_]line[-_]length|max[-_]complexity|indent[-_]size)$/i.test(
        assignment.key,
      ) &&
      /^\d+$/.test(assignment.value)
    if (!assignment) return trimmed
    const separator = assignment.separator === ':' ? ':' : ' ='
    // Original indentation decides structure; output keys are all flush left.
    return `${assignment.key}${separator}${
      assignment.value === '' ? '' : ` ${assignment.value}`
    }`
  })
  return joinLines(formatted, hasFinalNewline)
}
