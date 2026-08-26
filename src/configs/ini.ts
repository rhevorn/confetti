import path from 'node:path'
import type { ConfigDefinition } from '../core/types.js'
import { formatIni } from '../formatters/ini.js'

export const iniConfig: ConfigDefinition = {
  id: 'ini',
  displayName: 'INI / EditorConfig',
  filenames: ['.editorconfig'],
  extensions: ['.ini', '.cfg'],
  detect(filename, content) {
    const extension = path.extname(filename).toLowerCase()
    let score = extension === '.ini' ? 60 : extension === '.cfg' ? 30 : 0
    if (/^\s*\[[^\]\r\n]+\]\s*(?:[;#].*)?$/m.test(content)) score += 35
    if (/^\s*[A-Za-z0-9_.-]+\s*[=:]\s*.*$/m.test(content)) score += 30
    return Math.min(score, 100)
  },
  languageId: 'confetti-ini',
  formatter: formatIni,
}
