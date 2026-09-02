import { describe, expect, it } from 'vitest'
import { computeDocumentSymbols } from '../src/features/symbols.js'

describe('computeDocumentSymbols', () => {
  it('builds section symbols for INI-family files with header positions', () => {
    const content =
      '[client]\nport = 3306\n\n[mysqld]\ndatadir = /var/lib/mysql\n'

    expect(computeDocumentSymbols('mysql', content)).toEqual([
      {
        name: 'client',
        kind: 'section',
        startLine: 0,
        startCharacter: 0,
        endLine: 1,
        endCharacter: 'port = 3306'.length,
        headerEndCharacter: '[client]'.length,
      },
      {
        name: 'mysqld',
        kind: 'section',
        startLine: 3,
        startCharacter: 0,
        endLine: 4,
        endCharacter: 'datadir = /var/lib/mysql'.length,
        headerEndCharacter: '[mysqld]'.length,
      },
    ])
  })

  it('keeps gitconfig subsection names and indented header positions', () => {
    const symbols = computeDocumentSymbols(
      'gitconfig',
      '  [remote "origin"]\n    url = git@example.com:app.git\n',
    )

    expect(symbols).toHaveLength(1)
    expect(symbols[0]).toMatchObject({
      name: 'remote "origin"',
      kind: 'section',
      startLine: 0,
      startCharacter: 2,
      headerEndCharacter: 2 + '[remote "origin"]'.length,
      endLine: 1,
    })
  })

  it('falls back to the header line for empty sections', () => {
    const symbols = computeDocumentSymbols(
      'ini',
      '[empty]\n# only a comment\n\n[used]\nkey = 1\n',
    )

    expect(symbols).toHaveLength(2)
    expect(symbols[0]).toMatchObject({
      name: 'empty',
      startLine: 0,
      endLine: 0,
      endCharacter: '[empty]'.length,
    })
    expect(symbols[1]).toMatchObject({ name: 'used', endLine: 4 })
  })

  it('collapses headers that start on the first line with no content above', () => {
    const symbols = computeDocumentSymbols('ini', '[a]\n[b]\nkey = 1\n')

    expect(symbols[0]).toMatchObject({
      name: 'a',
      startLine: 0,
      endLine: 0,
      endCharacter: '[a]'.length,
    })
    expect(symbols[1]).toMatchObject({ name: 'b', endLine: 2 })
  })

  it('builds host symbols for ssh Host and Match blocks', () => {
    const symbols = computeDocumentSymbols(
      'ssh',
      'Host work\n  HostName example.com\nMatch host "*.example.com"\n  User deploy\n',
    )

    expect(symbols).toEqual([
      {
        name: 'Host work',
        kind: 'host',
        startLine: 0,
        startCharacter: 0,
        endLine: 1,
        endCharacter: '  HostName example.com'.length,
        headerEndCharacter: 'Host work'.length,
      },
      {
        name: 'Match host "*.example.com"',
        kind: 'host',
        startLine: 2,
        startCharacter: 0,
        endLine: 3,
        endCharacter: '  User deploy'.length,
        headerEndCharacter: 'Match host "*.example.com"'.length,
      },
    ])
  })

  it('builds table symbols for TOML tables and arrays of tables', () => {
    const symbols = computeDocumentSymbols(
      'toml',
      '[project]\nname = "a"\n[[items]]\nid = 1\n',
    )

    expect(symbols.map(({ name, kind }) => ({ name, kind }))).toEqual([
      { name: 'project', kind: 'table' },
      { name: 'items', kind: 'table' },
    ])
  })

  it('builds server symbols for nginx blocks with brace positions', () => {
    const content = [
      'http {',
      '  server {',
      '    location /api {',
      '      proxy_pass http://backend;',
      '    }',
      '  }',
      '}',
      '',
    ].join('\n')

    expect(computeDocumentSymbols('nginx', content)).toEqual([
      {
        name: 'location /api',
        kind: 'server',
        startLine: 2,
        startCharacter: 4,
        endLine: 4,
        endCharacter: 5,
        headerEndCharacter: 4 + 'location /api {'.length,
      },
      {
        name: 'server',
        kind: 'server',
        startLine: 1,
        startCharacter: 2,
        endLine: 5,
        endCharacter: 3,
        headerEndCharacter: 2 + 'server {'.length,
      },
      {
        name: 'http',
        kind: 'server',
        startLine: 0,
        startCharacter: 0,
        endLine: 6,
        endCharacter: 1,
        headerEndCharacter: 'http {'.length,
      },
    ])
  })

  it('handles one-line nginx blocks and ignores unbalanced braces', () => {
    expect(computeDocumentSymbols('nginx', 'server { listen 80; }\n')).toEqual([
      {
        name: 'server',
        kind: 'server',
        startLine: 0,
        startCharacter: 0,
        endLine: 0,
        endCharacter: 'server { listen 80; }'.length,
        headerEndCharacter: 'server {'.length,
      },
    ])
    expect(computeDocumentSymbols('nginx', '}\nserver {\n')).toEqual([])
  })

  it('returns no symbols for formats without symbol strategies', () => {
    for (const id of [
      'apache',
      'tmux',
      'screen',
      'inputrc',
      'env',
      'unknown',
    ]) {
      expect(computeDocumentSymbols(id, 'key = value\n')).toEqual([])
    }
  })
})
