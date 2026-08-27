import type { ConfigDefinition } from '../core/types.js'

export const versionsConfig: ConfigDefinition = {
  id: 'versions',
  displayName: 'Tool Versions',
  filenames: [
    '.nvmrc',
    '.node-version',
    '.python-version',
    '.ruby-version',
    '.tool-versions',
  ],
  detect(_filename, content) {
    let score = 0
    if (/^\s*(?:nodejs|python|ruby|golang|java)\s+\S+/m.test(content))
      score += 55
    if (/^\s*(?:v?\d+(?:\.\d+){1,3}|lts\/\S+)\s*$/m.test(content)) score += 40
    return Math.min(score, 100)
  },
  languageId: 'confetti-versions',
}
