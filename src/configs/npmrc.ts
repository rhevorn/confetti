import type { ConfigDefinition } from '../core/types.js'
import { formatNpmrc } from '../formatters/npmrc.js'

export const npmrcConfig: ConfigDefinition = {
  id: 'npmrc',
  displayName: 'npm Config',
  filenames: ['.npmrc'],
  patterns: ['**/.npmrc'],
  detect(_filename, content) {
    let score = 0
    if (
      /^\s*(?:registry|prefix|cache|save-exact|strict-ssl)\s*=\s*.+$/m.test(
        content,
      )
    ) {
      score += 45
    }
    if (/^\s*@[^:\s]+:registry\s*=\s*.+$/m.test(content)) score += 30
    if (/\$\{[A-Za-z_][A-Za-z0-9_]*\}/.test(content)) score += 15
    return Math.min(score, 100)
  },
  languageId: 'confetti-npmrc',
  formatter: formatNpmrc,
}
