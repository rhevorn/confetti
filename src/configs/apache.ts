import type { ConfigDefinition } from '../core/types.js'
import { formatApache } from '../formatters/apache.js'

export const apacheConfig: ConfigDefinition = {
  id: 'apache',
  displayName: 'Apache Config',
  filenames: ['.htaccess', 'httpd.conf', 'apache2.conf'],
  extensions: ['.conf'],
  patterns: [
    '*/apache2/*.conf',
    '*/httpd/*.conf',
    '*/apache2/sites-available/*',
    '*/apache2/sites-enabled/*',
  ],
  detect(_filename, content) {
    let score = 0
    if (
      /<(?:VirtualHost|Directory|DirectoryMatch|Files|FilesMatch|Location|LocationMatch|IfModule|IfDefine|If|Proxy|Limit)\b/.test(
        content,
      )
    ) {
      score += 40
    }
    if (
      /^\s*(?:ServerName|ServerAdmin|ServerRoot|DocumentRoot|Listen|LoadModule|DirectoryIndex|CustomLog|ErrorLog|LogFormat|AllowOverride)\s+\S+/m.test(
        content,
      )
    ) {
      score += 30
    }
    if (/^\s*(?:Options|Require|Order|Allow|Deny)\s/m.test(content)) {
      score += 15
    }
    return Math.min(score, 100)
  },
  languageId: 'confetti-apache',
  formatter: formatApache,
}
