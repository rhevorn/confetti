import type { ConfigDefinition } from '../core/types.js'
import { formatPip } from '../formatters/pip.js'

export const pipConfig: ConfigDefinition = {
  id: 'pip',
  displayName: 'pip Config',
  filenames: ['pip.conf'],
  patterns: ['*/.pip/pip.conf', '*/.config/pip/pip.conf'],
  detect(_filename, content) {
    let score = 0
    if (
      /^\s*\[(?:global|install|uninstall|search|wheel)\]\s*(?:[;#].*)?$/m.test(
        content,
      )
    ) {
      score += 40
    }
    if (
      /^\s*(?:index-url|extra-index-url|find-links|trusted-host|no-cache-dir|require-virtualenv|disable-pip-version-check|no-python-version-warning|cert|client-cert|timeout|retries)\s*=/m.test(
        content,
      )
    ) {
      score += 25
    }
    return Math.min(score, 100)
  },
  languageId: 'confetti-pip',
  formatter: formatPip,
}
