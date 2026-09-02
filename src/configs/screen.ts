import type { ConfigDefinition } from '../core/types.js'
import { formatScreen } from '../formatters/screen.js'

export const screenConfig: ConfigDefinition = {
  id: 'screen',
  displayName: 'screen Config',
  filenames: ['.screenrc', 'screenrc'],
  languageId: 'confetti-screen',
  formatter: formatScreen,
}
