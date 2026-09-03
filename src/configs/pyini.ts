import type { ConfigDefinition } from '../core/types.js'
import { formatPyini } from '../formatters/pyini.js'

// Exact filenames only: a content detector reaching MIN_CONFIDENCE would
// hijack generic .ini/.cfg files the way setup.cfg is intentionally guarded
// against. The generic INI definition owns the extension.
export const pyiniConfig: ConfigDefinition = {
  id: 'pyini',
  displayName: 'Python Tooling INI',
  filenames: [
    'tox.ini',
    '.flake8',
    '.mypy.ini',
    'mypy.ini',
    '.coveragerc',
    'pytest.ini',
    '.isort.cfg',
    'isort.cfg',
  ],
  languageId: 'confetti-pyini',
  formatter: formatPyini,
}
