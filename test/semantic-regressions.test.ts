import { parseEnv } from 'node:util'
import { describe, expect, it } from 'vitest'
import { formatCaddy } from '../src/formatters/caddy.js'
import { formatEnv } from '../src/formatters/env.js'
import { formatSetupCfg } from '../src/formatters/setupcfg.js'
import { formatPyini } from '../src/formatters/pyini.js'
import { formatPip } from '../src/formatters/pip.js'
import { computeDiagnostics } from '../src/features/diagnostics.js'
import { tomlHeaders } from '../src/tokenizers/toml-headers.js'

describe('Caddy lexical preservation', () => {
  it.each([
    'respond "hello  world"',
    'respond /hash "hello#world"',
    'respond "brace { and }"',
    'respond `raw  # { text }`',
    'respond "escaped \\"quote\\"  # literal"',
    'redir https://example.com/path#fragment',
    'respond {http.request.host}',
    'respond "{"',
    'respond "}"',
    'respond "<<HTML"',
    'respond \\<<HTML',
  ])('preserves token contents: %s', (directive) => {
    const input = `:8080 {\n      ${directive}\n}\n`
    const result = formatCaddy(input)
    expect(result).toBe(`:8080 {\n  ${directive}\n}\n`)
    expect(formatCaddy(result)).toBe(result)
  })

  it.each(['"', '`'])(
    'preserves multiline %s strings and resumes indentation',
    (quote) => {
      const value = `respond ${quote}first\n  # still text\n\n  } {\nlast${quote}`
      const input = `:8080 {\n${value}\n  respond   /health   ok\n}\n`
      const expected = `:8080 {\n${value}\n  respond /health ok\n}\n`
      expect(formatCaddy(input)).toBe(expected)
      expect(formatCaddy(expected)).toBe(expected)
    },
  )

  it('preserves heredoc indentation and accepts arguments after the end marker', () => {
    const input =
      ':8080 {\nrespond <<HTML\n    # literal\n    {  body  }\n    HTML 200\nrespond    ok\n}\n'
    const result = formatCaddy(input)
    expect(result).toBe(
      ':8080 {\n  respond <<HTML\n    # literal\n    {  body  }\n    HTML 200\n  respond ok\n}\n',
    )
    expect(formatCaddy(result)).toBe(result)
  })

  it.each([
    ':8080 {\n respond "unfinished  ',
    ':8080 {\n respond <<HTML\n  body\n',
    ':8080 {\n respond foo \\\n     bar\n}\n',
    ':8080 {\n respond foo \\   \n     bar\n}\n',
  ])('leaves incomplete and continuation-sensitive input intact', (input) => {
    expect(formatCaddy(input)).toBe(input)
    expect(formatCaddy(input.replaceAll('\n', '\r\n'))).toBe(input)
  })

  it('retains comment text and only treats standalone braces as structural', () => {
    expect(
      formatCaddy('\n\n}suffix\n  # a   b\nrespond    hi # a   b\n}\n'),
    ).toBe('}suffix\n# a   b\nrespond hi # a   b\n}\n')
  })
})

describe('dotenv semantic preservation with an independent parser', () => {
  for (const quote of ['"', "'"]) {
    for (const newline of ['\n', '\r\n']) {
      for (const final of ['', newline]) {
        it(`preserves ${quote} multiline values with ${JSON.stringify(newline)} / final=${!!final}`, () => {
          const input =
            [
              'OTHER = value',
              `MESSAGE = ${quote}first`,
              '  A = two  ',
              '# literal',
              '',
              `last${quote}`,
              'LAST = done',
            ].join(newline) + final
          const result = formatEnv(input)
          expect(parseEnv(result)).toEqual(parseEnv(input))
          expect(result).toContain('  A = two  \n# literal\n\n')
          expect(result.endsWith('\n')).toBe(!!final)
          expect(formatEnv(result)).toBe(result)
        })
      }
    }
  }

  it('ignores apparent assignments inside multiline values but reports actual duplicate line numbers', () => {
    const input = 'KEY=first\nMESSAGE="first\nKEY=not-a-key\nlast"\nKEY=last\n'
    expect(computeDiagnostics('env', input)).toEqual([
      {
        message: 'Duplicate key "KEY" (also defined on line 1)',
        line: 4,
        startCharacter: 0,
        endCharacter: 3,
      },
    ])
  })

  it.each([
    'MESSAGE="escaped \\"quote\\"\n  A = two  \nlast"\nAFTER = ok\n',
    'MESSAGE=`first\n  A = two  \nlast`\nAFTER = ok\n',
    'MESSAGE="unfinished\n  A = two  ',
    'MESSAGE="unfinished',
  ])('preserves escaped, raw, and incomplete quoted records', (input) => {
    const result = formatEnv(input)
    expect(result).toBe(input.replace('AFTER = ok', 'AFTER=ok'))
    expect(formatEnv(result)).toBe(result)
  })
})

describe('Python INI continuations', () => {
  it.each([formatPyini, formatSetupCfg, formatPip])(
    'aligns messy continuation indentation while preserving payload whitespace',
    (format) => {
      const input =
        '[testenv]\ndeps =\n    pytest>=8\n    pytest-cov\n        coverage[toml]\ncommands =\n        pytest {posargs}\n    coverage report\n\n# keep comment\n\t python -c "print(\'a  b\')"  \n'
      const expected =
        '[testenv]\ndeps =\n    pytest>=8\n    pytest-cov\n    coverage[toml]\ncommands =\n    pytest {posargs}\n    coverage report\n\n# keep comment\n    python -c "print(\'a  b\')"  \n'
      expect(format(input)).toBe(expected)
      expect(format(expected)).toBe(expected)
      expect(format(input.replaceAll('\n', '\r\n'))).toBe(expected)
      expect(format(input.slice(0, -1))).toBe(expected.slice(0, -1))
    },
  )

  for (const format of [formatSetupCfg, formatPyini, formatPip]) {
    for (const indent of ['', '  ', '\t']) {
      for (const gap of ['', '\n', '# note\n', '; note\n', '\n# note\n\n']) {
        for (const eol of ['\n', '\r\n']) {
          it(`${format.name}: indent=${JSON.stringify(indent)}, gap=${JSON.stringify(gap)}, eol=${JSON.stringify(eol)}`, () => {
            for (const final of ['', eol]) {
              const lines = [
                '[options]',
                `${indent}requires   =`,
                `${indent}    requests>=2`,
                gap + `${indent}    urllib3>=2`,
                `${indent}next   =   value`,
              ]
              const input = lines.join('\n').replaceAll('\n', eol) + final
              // Golden output changes only separators of actual keys. No
              // inferred assignments in the continuation payload may change.
              const expected =
                lines
                  .join('\n')
                  .replace(`${indent}requires   =`, 'requires =')
                  .replace(`${indent}next   =   value`, 'next = value')
                  .replace(`${indent}    requests>=2`, '    requests>=2')
                  .replace(`${indent}    urllib3>=2`, '    urllib3>=2') +
                (final ? '\n' : '')
              expect(format(input)).toBe(expected)
              expect(format(expected)).toBe(expected)
            }
          })
        }
      }
    }
  }

  it.each([formatSetupCfg, formatPyini, formatPip])(
    'retains indented value lines through blanks and comments',
    (format) => {
      const input =
        '[options]\ninstall_requires   =\n    requests>=2\n\n# note\n; note\n    urllib3>=2\n    [not-a-section]\nname   =   demo\n'
      const expected = input
        .replace('install_requires   =', 'install_requires =')
        .replace('name   =   demo', 'name = demo')
      expect(format(input)).toBe(expected)
      expect(format(expected)).toBe(expected)
    },
  )

  it('distinguishes indented siblings from deeper continuation lines', () => {
    const input =
      '[options]\n  first   = one\n    still first\n  second   = two\n    still second\n[other]\nkey = three\n'
    const expected = input
      .replace('  first   =', 'first =')
      .replace('  second   =', 'second =')
    expect(formatSetupCfg(input)).toBe(expected)
    expect(formatSetupCfg(expected)).toBe(expected)
  })
})

describe('format-aware diagnostic boundaries', () => {
  it.each(['pip', 'setupcfg', 'pyini'])(
    'does not diagnose %s continuation text as keys',
    (id) => {
      const input =
        '[options]\nrequires=\n    NAME=first\n\n# a comment\n    NAME=second\n    [not-a-section]\nreal=first\nREAL=second\n'
      const diagnostics = computeDiagnostics(id, input)
      expect(diagnostics).toHaveLength(1)
      expect(diagnostics[0].line).toBe(8)
      expect(diagnostics[0].message).toContain('"REAL" in section "options"')
    },
  )

  it('does not diagnose a same-named TOML table in a different array instance', () => {
    expect(
      computeDiagnostics(
        'toml',
        '[[items]]\n[items.options]\n[[items]]\n[items.options]\n',
      ),
    ).toEqual([])
    expect(
      computeDiagnostics('toml', '[a] # first\r\n[a] # repeat\r\n')[0],
    ).toMatchObject({ line: 1, startCharacter: 0, endCharacter: 3 })
  })

  it('permits systemd repeated list directives, resets, and oneshot commands', () => {
    const input =
      '[Service]\nType=oneshot\n' +
      [
        'Environment=A=1',
        'Environment=',
        'Environment=B=2',
        'EnvironmentFile=/first',
        'EnvironmentFile=/second',
        'ExecStart=/first',
        'ExecStart=/second',
        'ExecStartPre=/first',
        'ExecStartPre=/second',
        'UnknownDirective=one',
        'UnknownDirective=two',
      ].join('\n')
    expect(computeDiagnostics('systemd', input)).toEqual([])
  })

  it('scopes TOML subtables to the current array element, including nested arrays', () => {
    const input = [
      '[[fruits]]',
      '[fruits.physical]',
      'color="red"',
      '[[fruits.varieties]]',
      '[fruits.varieties.details]',
      '[[fruits.varieties]]',
      '[fruits.varieties.details]',
      '[[fruits]]',
      '[fruits.physical]',
      'color="green"',
      '[[fruits.varieties]]',
      '[fruits.varieties.details]',
    ].join('\n')
    expect(computeDiagnostics('toml', input)).toEqual([])
    expect(
      computeDiagnostics('toml', input + '\n[fruits.varieties.details]'),
    ).toHaveLength(1)
  })

  it('ignores header-like text inside TOML strings and nested values', () => {
    const input =
      'text="""\n[fake]\n[fake]\n"""\nother=\'\'\'\n[fake]\n[fake]\n\'\'\'\nvalues=[\n[1],\n[2]\n]\ninline={key=1}\n[real] # first\n  [real] # duplicate\n'
    expect(computeDiagnostics('toml', input)).toEqual([
      {
        message: 'Duplicate table "real" (also defined on line 14)',
        line: 14,
        startCharacter: 2,
        endCharacter: 8,
      },
    ])
  })

  it('normalizes equivalent quoted keys but does not conflate dotted literal keys', () => {
    expect(
      computeDiagnostics('toml', '[a.b]\n["a".\'b\']\n["a.b"]\n'),
    ).toHaveLength(1)
    expect(computeDiagnostics('toml', '["\\u0061"]\n[a]\n')).toHaveLength(1)
    expect(
      computeDiagnostics('toml', '[[a]]\n[a.b]\n[[ab]]\n[a.b]\n'),
    ).toHaveLength(1)
  })

  it.each([
    '[]',
    '[a..b]',
    '[a b c]',
    '["\\q"]',
    '["""a"""]',
    '[a?]',
    '[a',
    '[a.]',
    '[a\n]',
    '[a] suffix',
    '[[a]',
    '["unclosed\n]',
  ])('ignores malformed TOML headers: %s', (input) => {
    expect(tomlHeaders(input)).toEqual([])
  })
})
