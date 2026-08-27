import type { ConfigDefinition } from '../core/types.js'
import { formatHosts } from '../formatters/hosts.js'

export const hostsConfig: ConfigDefinition = {
  id: 'hosts',
  displayName: 'Hosts',
  filenames: ['hosts'],
  detect(_filename, content) {
    let score = 0
    if (/^\s*(?:\d{1,3}(?:\.\d{1,3}){3}|[A-Fa-f0-9:]+)\s+\S+/m.test(content)) {
      score += 55
    }
    if (/\b(?:localhost|ip6-localhost|broadcasthost)\b/i.test(content))
      score += 25
    return Math.min(score, 100)
  },
  languageId: 'confetti-hosts',
  formatter: formatHosts,
}
