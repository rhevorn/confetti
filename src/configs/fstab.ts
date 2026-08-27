import type { ConfigDefinition } from '../core/types.js'
import { formatFstab } from '../formatters/fstab.js'

export const fstabConfig: ConfigDefinition = {
  id: 'fstab',
  displayName: 'Filesystem Table',
  filenames: ['fstab'],
  detect(_filename, content) {
    let score = 0
    if (
      /^\s*(?:UUID=|LABEL=|\/dev\/|\/\S*)\S*\s+\/\S*\s+\S+\s+\S+/m.test(content)
    ) {
      score += 60
    }
    if (/\b(?:defaults|noauto|nofail|bind|ro|rw)(?:,|\s)/m.test(content))
      score += 20
    return Math.min(score, 100)
  },
  languageId: 'confetti-fstab',
  formatter: formatFstab,
}
