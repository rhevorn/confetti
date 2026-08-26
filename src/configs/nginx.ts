import type { ConfigDefinition } from '../core/types.js'
import { formatNginx } from '../formatters/nginx.js'

export const nginxConfig: ConfigDefinition = {
  id: 'nginx',
  displayName: 'Nginx',
  filenames: ['nginx.conf'],
  extensions: ['.conf'],
  patterns: ['*/nginx/*.conf', '*/nginx/conf.d/*.conf'],
  detect(_filename, content) {
    let score = 0
    if (/\b(?:http|events|server|upstream)\s*\{/.test(content)) score += 45
    if (/\blocation\s+(?:[=~^* ]|\/)/.test(content)) score += 25
    if (/\b(?:listen|proxy_pass|server_name)\s+[^;]+;/.test(content))
      score += 25
    return Math.min(score, 100)
  },
  languageId: 'confetti-nginx',
  formatter: formatNginx,
}
