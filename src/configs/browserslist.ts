import type { ConfigDefinition } from '../core/types.js'
import { formatBrowserslist } from '../formatters/browserslist.js'

export const browserslistConfig: ConfigDefinition = {
  id: 'browserslist',
  displayName: 'Browserslist',
  filenames: ['.browserslistrc', 'browserslist'],
  detect(_filename, content) {
    let score = 0
    if (
      /^\s*(?:defaults|last\s+\d+\s+versions|not\s+dead)\s*$/im.test(content)
    ) {
      score += 50
    }
    if (
      /^\s*(?:chrome|firefox|safari|edge|ios|node)\s*(?:[><=]+|\d)/im.test(
        content,
      )
    ) {
      score += 35
    }
    return Math.min(score, 100)
  },
  languageId: 'confetti-browserslist',
  formatter: formatBrowserslist,
}
