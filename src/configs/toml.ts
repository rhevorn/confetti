import path from 'node:path'
import type { ConfigDefinition } from '../core/types.js'
import { formatToml } from '../formatters/toml.js'

export const tomlConfig: ConfigDefinition = {
  id: 'toml',
  displayName: 'TOML',
  extensions: ['.toml'],
  detect(filename, content) {
    let score = path.extname(filename).toLowerCase() === '.toml' ? 50 : 0
    if (/^\s*\[\[?[A-Za-z0-9_."'-]+\]\]?\s*(?:#.*)?$/m.test(content))
      score += 20
    if (/^\s*[A-Za-z0-9_."'-]+\s*=\s*.+$/m.test(content)) score += 25
    return Math.min(score, 100)
  },
  languageId: 'confetti-toml',
  formatter: formatToml,
}
