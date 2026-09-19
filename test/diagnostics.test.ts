import { describe, expect, it } from 'vitest'
import { computeDiagnostics } from '../src/features/diagnostics.js'

describe('computeDiagnostics', () => {
  it('flags duplicate dotenv keys and skips comments and blank lines', () => {
    const content = [
      '# API configuration',
      'API_KEY=first',
      '',
      'export API_KEY=second',
      'API_URL=https://x.test',
    ].join('\n')

    expect(computeDiagnostics('env', content)).toEqual([
      {
        message: 'Duplicate key "API_KEY" (also defined on line 2)',
        line: 3,
        startCharacter: 7,
        endCharacter: 7 + 'API_KEY'.length,
      },
    ])
  })

  it('treats differently cased dotenv keys as distinct', () => {
    expect(computeDiagnostics('env', 'KEY=1\nkey=2\n')).toEqual([])
  })

  it('highlights the key itself when it is a substring of export', () => {
    const result = computeDiagnostics('env', 'port=1\nexport port=2\n')

    expect(result).toHaveLength(1)
    expect(result[0]?.startCharacter).toBe('export '.length)
    expect(result[0]?.endCharacter).toBe('export '.length + 'port'.length)
  })

  it('highlights indented duplicate dotenv keys at their column', () => {
    const result = computeDiagnostics('env', 'KEY=1\n  KEY=2\n')

    expect(result).toHaveLength(1)
    expect(result[0]?.startCharacter).toBe(2)
    expect(result[0]?.endCharacter).toBe(5)
  })

  it('flags duplicate keys inside the same INI section only', () => {
    const content = [
      '[client]',
      'port = 3306',
      'port = 3307',
      '[mysqld]',
      'port = 3308',
    ].join('\n')

    expect(computeDiagnostics('mysql', content)).toEqual([
      {
        message:
          'Duplicate key "port" in section "client" (also defined on line 2)',
        line: 2,
        startCharacter: 0,
        endCharacter: 'port'.length,
      },
    ])
  })

  it('flags duplicate keys inside systemd unit sections', () => {
    const content = ['[Service]', 'Restart=always', 'Restart=on-failure'].join(
      '\n',
    )

    expect(computeDiagnostics('systemd', content)).toEqual([
      {
        message:
          'Duplicate key "Restart" in section "Service" (also defined on line 2)',
        line: 2,
        startCharacter: 0,
        endCharacter: 'Restart'.length,
      },
    ])
  })

  it('flags duplicate keys inside Python tooling INI sections', () => {
    const content = '[flake8]\nmax-line-length = 100\nmax-line-length = 120\n'

    expect(computeDiagnostics('pyini', content)).toEqual([
      {
        message:
          'Duplicate key "max-line-length" in section "flake8" (also defined on line 2)',
        line: 2,
        startCharacter: 0,
        endCharacter: 'max-line-length'.length,
      },
    ])
  })

  it('ignores semicolon comments while tracking INI sections', () => {
    const content = '; key = first\n[sec]\nkey = a\n; key = b\nkey = c\n'

    expect(computeDiagnostics('pip', content)).toEqual([
      {
        message:
          'Duplicate key "key" in section "sec" (also defined on line 3)',
        line: 4,
        startCharacter: 0,
        endCharacter: 'key'.length,
      },
    ])
  })

  it('flags duplicate keys before any section header globally', () => {
    const diagnostics = computeDiagnostics(
      'ini',
      'key=a\nkey=b\n[sec]\nkey=c\n',
    )

    expect(diagnostics).toEqual([
      {
        message: 'Duplicate key "key" (also defined on line 1)',
        line: 1,
        startCharacter: 0,
        endCharacter: 'key'.length,
      },
    ])
  })

  it('scopes gitconfig subsections independently', () => {
    const content = [
      '[remote "origin"]',
      '  url = a',
      '[remote "mirror"]',
      '  url = b',
      '[remote "origin"]',
      '  url = c',
    ].join('\n')

    expect(computeDiagnostics('gitconfig', content)).toEqual([
      {
        message:
          'Duplicate key "url" in section "remote "origin"" (also defined on line 2)',
        line: 5,
        startCharacter: 2,
        endCharacter: 2 + 'url'.length,
      },
    ])
  })

  it('flags exact duplicate TOML tables but not arrays of tables', () => {
    const content = [
      '[[items]]',
      'id = 1',
      '[[items]]',
      'id = 2',
      '[project]',
      'name = "a"',
      '[project]',
      'name = "b"',
      '[project.sub]',
      'key = 1',
    ].join('\n')

    expect(computeDiagnostics('toml', content)).toEqual([
      {
        message: 'Duplicate table "project" (also defined on line 5)',
        line: 6,
        startCharacter: 0,
        endCharacter: '[project]'.length,
      },
    ])
  })

  it('does not merge dotted TOML table names', () => {
    expect(computeDiagnostics('toml', '[a]\nx = 1\n[a.b]\ny = 2\n')).toEqual([])
  })

  it('flags duplicate Java Properties keys and skips comments and blanks', () => {
    const content = [
      '# app.name=ignored',
      '! app.name=ignored',
      '',
      'app.name=first',
      'app.name=second',
    ].join('\n')

    expect(computeDiagnostics('properties', content)).toEqual([
      {
        message: 'Duplicate key "app.name" (also defined on line 4)',
        line: 4,
        startCharacter: 0,
        endCharacter: 'app.name'.length,
      },
    ])
  })

  it('treats every Java Properties separator as the same key', () => {
    const result = computeDiagnostics(
      'properties',
      'app.version:1\napp.version 2\napp.version=3\n',
    )

    expect(result).toHaveLength(2)
    expect(result[1]?.line).toBe(2)
  })

  it('does not read a hash inside a Java Properties value as a comment', () => {
    const content = 'hash.value=value#not-a-comment\nhash.value=other\n'

    expect(computeDiagnostics('properties', content)).toHaveLength(1)
  })

  it('highlights indented Java Properties keys at their column', () => {
    const result = computeDiagnostics('properties', '  key=1\n  key=2\n')

    expect(result).toHaveLength(1)
    expect(result[0]?.startCharacter).toBe(2)
    expect(result[0]?.endCharacter).toBe(5)
  })

  it('compares Java Properties keys as Java loads them', () => {
    expect(
      computeDiagnostics(
        'properties',
        'escaped.key=one\nescaped.key\\=part=two\n',
      ),
    ).toEqual([])

    expect(
      computeDiagnostics(
        'properties',
        'escaped.key\\=part=one\nescaped.key\\=part=two\n',
      ),
    ).toEqual([
      {
        message: 'Duplicate key "escaped.key\\=part" (also defined on line 1)',
        line: 1,
        startCharacter: 0,
        endCharacter: 'escaped.key\\=part'.length,
      },
    ])

    expect(computeDiagnostics('properties', 'aA=one\na\\u0041=two\n')).toEqual([
      {
        message: 'Duplicate key "a\\u0041" (also defined on line 1)',
        line: 1,
        startCharacter: 0,
        endCharacter: 'a\\u0041'.length,
      },
    ])
  })

  it('skips Java Properties lines with a malformed unicode escape', () => {
    expect(computeDiagnostics('properties', 'a\\u00=1\na\\u00=2\n')).toEqual([])
  })

  it('joins a Java Properties key that continues onto the next line', () => {
    const content = ['my\\', 'key=one', 'mykey=two'].join('\n')

    expect(computeDiagnostics('properties', content)).toEqual([
      {
        message: 'Duplicate key "mykey" (also defined on line 1)',
        line: 2,
        startCharacter: 0,
        endCharacter: 'mykey'.length,
      },
    ])
    expect(computeDiagnostics('properties', 'my\\\nkey=one\nmy=two\n')).toEqual(
      [],
    )
  })

  it('highlights the first physical line of a continued duplicate key', () => {
    const result = computeDiagnostics(
      'properties',
      'my\\\nkey=one\nmy\\\nkey=two\n',
    )

    expect(result).toEqual([
      {
        message: 'Duplicate key "mykey" (also defined on line 1)',
        line: 2,
        startCharacter: 0,
        endCharacter: 'my\\'.length,
      },
    ])
  })

  it('joins a Java unicode escape that is split across a continuation', () => {
    expect(
      computeDiagnostics('properties', 'a\\u00\\\n41=one\naA=two\n'),
    ).toEqual([
      {
        message: 'Duplicate key "aA" (also defined on line 1)',
        line: 2,
        startCharacter: 0,
        endCharacter: 'aA'.length,
      },
    ])
  })

  it('skips blank physical lines while a Java Properties value is continued', () => {
    expect(computeDiagnostics('properties', 'a=1\\\n\na=2\n')).toEqual([])
    expect(computeDiagnostics('properties', 'a=1\\\n\f\nb=2\n')).toEqual([])
  })

  it('keeps a trailing continuation at EOF on the same Java Properties key', () => {
    expect(computeDiagnostics('properties', 'a=1\na=2\\\n')).toEqual([
      {
        message: 'Duplicate key "a" (also defined on line 1)',
        line: 1,
        startCharacter: 0,
        endCharacter: 1,
      },
    ])
  })

  it('treats Java Properties continuation lines as values, not keys', () => {
    const content = [
      'alpha = one',
      'beta = first \\',
      '  alpha',
      'alpha = two',
    ].join('\n')

    expect(computeDiagnostics('properties', content)).toEqual([
      {
        message: 'Duplicate key "alpha" (also defined on line 1)',
        line: 3,
        startCharacter: 0,
        endCharacter: 'alpha'.length,
      },
    ])
  })

  it('skips every physical line of a Java Properties continuation chain', () => {
    const content = ['a=1', 'b=x \\', '  c \\', '  d', 'b=2'].join('\n')

    expect(computeDiagnostics('properties', content)).toEqual([
      {
        message: 'Duplicate key "b" (also defined on line 2)',
        line: 4,
        startCharacter: 0,
        endCharacter: 'b'.length,
      },
    ])
  })

  it('flags duplicate bare Java Properties keys and ignores empty documents', () => {
    expect(
      computeDiagnostics('properties', 'standalone\nstandalone\n'),
    ).toEqual([
      {
        message: 'Duplicate key "standalone" (also defined on line 1)',
        line: 1,
        startCharacter: 0,
        endCharacter: 'standalone'.length,
      },
    ])
    expect(computeDiagnostics('properties', '')).toEqual([])
  })

  it('keeps Java control-character escapes distinct from their letters', () => {
    expect(computeDiagnostics('properties', 'atb=1\na\\tb=2\n')).toEqual([])

    expect(
      computeDiagnostics('properties', 'a\\tb=1\na\\u0009b=2\n'),
    ).toHaveLength(1)
  })

  it('reads Java Properties keys without honoring quotes', () => {
    expect(computeDiagnostics('properties', 'a"b=1\na"b=2\n')).toHaveLength(1)
  })

  it('does not let a comment ending in a backslash hide the next key', () => {
    expect(computeDiagnostics('properties', '# c \\\na=1\na=2\n')).toHaveLength(
      1,
    )
  })

  it('ignores empty Java Properties keys', () => {
    expect(computeDiagnostics('properties', '=a\n=b\n')).toEqual([])
  })

  it('flags duplicate Java Properties keys in CRLF documents', () => {
    const result = computeDiagnostics('properties', 'a=1\r\na=2\r\n')

    expect(result).toHaveLength(1)
    expect(result[0]?.line).toBe(1)
  })

  it('ignores non-assignment lines and malformed table headers', () => {
    expect(computeDiagnostics('env', 'shell command\n')).toEqual([])
    expect(computeDiagnostics('ini', 'standalone token\n')).toEqual([])
    expect(computeDiagnostics('toml', '[unclosed\n[]\nkey = 1\n')).toEqual([])
  })

  it('returns no diagnostics for formats without checks', () => {
    for (const id of ['nginx', 'apache', 'ssh', 'tmux', 'unknown']) {
      expect(computeDiagnostics(id, 'key = value\nkey = value\n')).toEqual([])
    }
  })
})
