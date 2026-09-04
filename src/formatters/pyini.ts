import { formatSetupCfg } from './setupcfg.js'
import { joinLines, normalizeLines, splitAssignment } from './shared.js'

// tox.ini, .flake8, .coveragerc, and friends use the same indented
// multiline values as setup.cfg (`deps =`, `commands =`, `omit =`), so
// they share the multiline-preserving INI formatting.
export function formatPyini(content: string): string {
  const { lines, hasFinalNewline } = normalizeLines(content)
  let section = ''
  let keyIndent: number | undefined
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const text = line.trim()
    if (text === '' || /^[#;]/.test(text)) continue
    const indent = line.length - line.trimStart().length
    if (keyIndent !== undefined && indent > keyIndent) continue
    keyIndent = undefined
    if (text.startsWith('[') && text.endsWith(']')) {
      section = text.slice(1, -1)
      continue
    }
    if (!splitAssignment(text, ['=', ':'])) continue
    keyIndent = indent
    if (!/^testenv(?::[^\]]+)?$/.test(section) || !/^deps\s*=\s*$/.test(text))
      continue

    // Recover only an evidently malformed deps list: at least one same-level
    // bare requirement must be present. Never reinterpret a valid sibling
    // assignment merely because its name resembles a package requirement.
    const candidates: number[] = []
    let malformed = false
    for (let next = index + 1; next < lines.length; next += 1) {
      const value = lines[next].trim()
      if (value === '' || /^[#;]/.test(value)) continue
      const valueIndent = lines[next].length - lines[next].trimStart().length
      if (valueIndent > indent) continue
      if (
        valueIndent < indent ||
        !/^[A-Za-z0-9][A-Za-z0-9_.-]*(?:\[[A-Za-z0-9_., -]+\])?(?:\s*(?:>=|<=|==|!=|~=|>|<).*)?$/.test(
          value,
        )
      )
        break
      candidates.push(next)
      if (!splitAssignment(value, ['=', ':'])) malformed = true
    }
    if (malformed) {
      for (const next of candidates)
        lines[next] = `${line.slice(0, indent)}    ${lines[next].trimStart()}`
    }
  }
  return formatSetupCfg(joinLines(lines, hasFinalNewline))
}
