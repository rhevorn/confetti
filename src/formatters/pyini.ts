import { formatSetupCfg } from './setupcfg.js'

// tox.ini, .flake8, .coveragerc, and friends use the same indented
// multiline values as setup.cfg (`deps =`, `commands =`, `omit =`), so
// they share the multiline-preserving INI formatting.
export function formatPyini(content: string): string {
  return formatSetupCfg(content)
}
