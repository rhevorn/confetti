import path from 'node:path'
import type { ConfigDefinition } from '../core/types.js'
import { formatYaml } from '../formatters/yaml.js'

export const yamlConfig: ConfigDefinition = {
  id: 'yaml',
  displayName: 'YAML',
  extensions: ['.yaml', '.yml'],
  detect(filename, content) {
    const extension = path.extname(filename).toLowerCase()
    let score = extension === '.yaml' || extension === '.yml' ? 60 : 0
    if (/^\s*---\s*(?:#.*)?$/m.test(content)) score += 10
    if (/^\s*[A-Za-z0-9_."'-]+\s*:\s*(?:\S.*)?$/m.test(content)) score += 20
    if (/^\s*-\s+(?:\S.*)?$/m.test(content)) score += 15
    return Math.min(score, 100)
  },
  languageId: 'confetti-yaml',
  formatter: formatYaml,
}
