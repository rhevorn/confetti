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
