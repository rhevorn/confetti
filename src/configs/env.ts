import path from 'node:path'
import type { ConfigDefinition } from '../core/types.js'
import { formatEnv } from '../formatters/env.js'

export const envConfig: ConfigDefinition = {
  id: 'env',
  displayName: 'Environment Variables',
  filenames: ['.env'],
  patterns: ['*/.env.*'],
  detect(filename, content) {
    const basename = path.basename(filename)
    let score = basename.startsWith('.env.') ? 30 : 0
    if (/^\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=/m.test(content)) {
      score += 45
    }
    if (/\$\{[A-Za-z_][A-Za-z0-9_]*(?::?-[^}]*)?\}/.test(content)) score += 15
    return Math.min(score, 100)
  },
  languageId: 'confetti-env',
  formatter: formatEnv,
}
