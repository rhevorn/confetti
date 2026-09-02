import type { ConfigDefinition } from '../core/types.js'
import { formatSetupCfg } from '../formatters/setupcfg.js'

export const setupCfgConfig: ConfigDefinition = {
  id: 'setupcfg',
  displayName: 'setup.cfg',
  filenames: ['setup.cfg'],
  languageId: 'confetti-setupcfg',
  formatter: formatSetupCfg,
}
