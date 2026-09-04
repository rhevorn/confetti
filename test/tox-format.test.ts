import { describe, expect, it } from 'vitest'
import { formatPyini } from '../src/formatters/pyini.js'
import { formatSetupCfg } from '../src/formatters/setupcfg.js'

describe('tox deps indentation recovery', () => {
  const input =
    '[testenv]\n    description = run the test suite\n    deps =\n    pytest>=8\n    pytest-cov\n    coverage[toml]\ncommands =\n    pytest {posargs}\n'
  const expected =
    '[testenv]\ndescription = run the test suite\ndeps =\n    pytest>=8\n    pytest-cov\n    coverage[toml]\ncommands =\n    pytest {posargs}\n'

  it('formats the exact reported input and is stable on a second pass', () => {
    expect(formatPyini(input)).toBe(expected)
    expect(formatPyini(expected)).toBe(expected)
    expect(formatPyini(input.replaceAll('\n', '\r\n'))).toBe(expected)
    expect(formatPyini(input.slice(0, -1))).toBe(expected.slice(0, -1))
  })

  it('keeps comments and blank lines, accepts extras and stops at the next key', () => {
    const source =
      '[testenv:lint]\ndeps =\n# keep\nruff~=0.8\n\npytest[testing]>=8\n    already-indented\npytest-cov\n; keep too\nskip_install = true\ncommands =\n  ruff check src\n'
    expect(formatPyini(source)).toBe(
      '[testenv:lint]\ndeps =\n# keep\n    ruff~=0.8\n\n    pytest[testing]>=8\n    already-indented\n    pytest-cov\n; keep too\nskip_install = true\ncommands =\n    ruff check src\n',
    )
  })

  it('does not reinterpret valid sibling assignments or other sections', () => {
    for (const source of [
      '[testenv]\ndeps =\npytest>=8\ncommands=echo\n',
      '[other]\ndeps =\npackage\n',
      '[testenv]\ndescription =\n    [testenv:fake]\n    deps =\n    not-a-key\n',
    ]) {
      expect(formatPyini(source)).toBe(formatSetupCfg(source))
    }
  })

  it('stops recovery at less-indented text, unknown syntax and section boundaries', () => {
    for (const suffix of ['next-key', '[other]', '    invalid ?? syntax']) {
      const source = `[testenv]\n    deps =\n    pytest\n${suffix}\n`
      const result = formatPyini(source)
      expect(result).toContain('deps =\n    pytest\n')
      expect(result).toContain(suffix.trim())
    }
  })
})
