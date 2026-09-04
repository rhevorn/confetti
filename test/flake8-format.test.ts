import { expect, it } from 'vitest'
import { formatPyini } from '../src/formatters/pyini.js'
import { formatSetupCfg } from '../src/formatters/setupcfg.js'

it.each([formatPyini, formatSetupCfg])(
  'recovers the reported indented flake8 select key',
  (format) => {
    const input =
      '[flake8]\nmax-line-length = 100\nmax-complexity = 12\n    select =    C,E,F,W,B\nextend-ignore = E203, W503\nexclude =\n    .git,\n    dist\nper-file-ignores =\n    tests/*: S101\n'
    const expected = input.replace(
      '    select =    C,E,F,W,B',
      'select = C,E,F,W,B',
    )
    expect(format(input)).toBe(expected)
    expect(format(expected)).toBe(expected)
    expect(format(input.replaceAll('\n', '\r\n'))).toBe(expected)
    expect(format(input.slice(0, -1))).toBe(expected.slice(0, -1))
  },
)

it('recovers chained integer assignments, tabs and comments', () => {
  expect(
    formatPyini(
      '[flake8]\nmax_line_length=100\n# keep\n\tmax-complexity=12\n\n\t\tindent-size=4\n\tselect=E,F\n',
    ),
  ).toBe(
    '[flake8]\nmax_line_length = 100\n# keep\nmax-complexity = 12\n\nindent-size = 4\nselect = E,F\n',
  )
})

it('updates the continuation baseline when a real sibling key is less indented', () => {
  expect(
    formatPyini('[flake8]\n    max-complexity = 12\nexclude =\n  folder\n'),
  ).toBe('[flake8]\nmax-complexity = 12\nexclude =\n    folder\n')
})

it.each([
  '[flake8]\nexclude =\n    select = literal-file-name\n',
  '[flake8]\nper-file-ignores =\n    file=name.py: S101\n',
  '[other]\nmax-complexity = 12\n    select = literal value\n',
  '[flake8]\nmax-complexity = not-an-integer\n    select = literal value\n',
  '[flake8]\nmax-complexity = 12\n    path: still value\n',
  '[flake8]\nmax-complexity = 12\n    file.name = still value\n',
])('does not guess a key boundary in ambiguous continuation input', (input) => {
  expect(formatPyini(input)).toBe(input)
})
