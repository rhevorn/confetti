import type { ConfigDefinition } from '../core/types.js'
import { formatInputrc } from '../formatters/inputrc.js'

export const inputrcConfig: ConfigDefinition = {
  id: 'inputrc',
  displayName: 'Readline Config',
  filenames: ['.inputrc'],
  languageId: 'confetti-inputrc',
  formatter: formatInputrc,
}
