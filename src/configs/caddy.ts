import type { ConfigDefinition } from '../core/types.js'
import { formatCaddy } from '../formatters/caddy.js'

export const caddyConfig: ConfigDefinition = {
  id: 'caddy',
  displayName: 'Caddyfile',
  // Exact filename only: Caddy has no extension to claim, and a content
  // detector reaching MIN_CONFIDENCE would hijack unrelated files.
  filenames: ['Caddyfile'],
  languageId: 'confetti-caddy',
  formatter: formatCaddy,
}
