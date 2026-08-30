import type { ConfigDefinition } from '../core/types.js'
import { formatYarnrc } from '../formatters/yarnrc.js'

export const yarnrcConfig: ConfigDefinition = {
  id: 'yarnrc',
  displayName: 'Yarn Config',
  filenames: ['.yarnrc'],
  patterns: ['*/.yarnrc'],
  detect(_filename, content) {
    let score = 0
    if (
      /^\s*(?:yarn-offline-mirror|lastUpdateCheck|disable-self-update-check)\b/m.test(
        content,
      )
    ) {
      score += 45
    }
    if (
      /^\s*"--[^"]+"\s+\S+/m.test(content) ||
      /^\s*--[\w.-]+\s+\S+/m.test(content)
    ) {
      score += 30
    }
    if (/^\s*registry\s+(?:=)?["']?https?:\/\//im.test(content)) score += 20
    return Math.min(score, 100)
  },
  languageId: 'confetti-yarnrc',
  formatter: formatYarnrc,
}
