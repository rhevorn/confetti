import type { ConfigDefinition } from '../core/types.js'
import { formatCrontab } from '../formatters/crontab.js'

export const crontabConfig: ConfigDefinition = {
  id: 'crontab',
  displayName: 'Crontab',
  filenames: ['crontab'],
  patterns: ['**/cron.d/*', '**/crontabs/*', '**/spool/cron/*'],
  detect(_filename, content) {
    let score = 0
    if (
      /^\s*(?:@(?:reboot|yearly|annually|monthly|weekly|daily|hourly)|(?:\S+\s+){4}\S+)\s+\S+/m.test(
        content,
      )
    ) {
      score += 55
    }
    if (/^\s*(?:SHELL|PATH|MAILTO|HOME)\s*=/m.test(content)) score += 20
    return Math.min(score, 100)
  },
  languageId: 'confetti-crontab',
  formatter: formatCrontab,
}
