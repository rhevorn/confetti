import path from 'node:path'
import type { ConfigDefinition } from '../core/types.js'
import { formatProperties } from '../formatters/properties.js'

export const propertiesConfig: ConfigDefinition = {
  id: 'properties',
  displayName: 'Java Properties',
  extensions: ['.properties'],
  detect(filename, content) {
    let score = path.extname(filename).toLowerCase() === '.properties' ? 60 : 0
    if (/^\s*[^#!\s][^\r\n]*?\s*(?:=|:)\s*.*$/m.test(content)) score += 40
    if (/\\u[0-9A-Fa-f]{4}/.test(content)) score += 15
    return Math.min(score, 100)
  },
  languageId: 'confetti-properties',
  formatter: formatProperties,
}
