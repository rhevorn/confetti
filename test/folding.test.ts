import { describe, expect, it } from 'vitest'
import { computeFoldingRanges } from '../src/features/folding.js'
import { computeDocumentSymbols } from '../src/features/symbols.js'

describe('computeFoldingRanges', () => {
  it('folds nested nginx blocks and ignores braces in strings and comments', () => {
    const content = [
      '# a } comment',
      'server {',
      '  set $message "keep { inside";',
      '  location /api {',
      '    proxy_pass http://backend;',
      '  }',
      '}',
      '',
    ].join('\n')

    expect(computeFoldingRanges('nginx', content)).toEqual([
      { startLine: 3, endLine: 5 },
      { startLine: 1, endLine: 6 },
    ])
  })

  it('skips one-line nginx blocks and unbalanced braces', () => {
    expect(computeFoldingRanges('nginx', 'server { listen 80; }\n')).toEqual([])
    expect(computeFoldingRanges('nginx', '}\nserver {\nlisten 80;\n')).toEqual(
      [],
    )
    expect(computeFoldingRanges('nginx', '')).toEqual([])
  })

  it('folds nested apache sections and ignores stray closing tags', () => {
    const content = [
      '<VirtualHost *:80>',
      '  ServerName example.com',
      '  <Directory "/var/www">',
      '    Require all granted',
      '  </Directory> # end directory',
      '</VirtualHost>',
      '',
    ].join('\n')

    expect(computeFoldingRanges('apache', content)).toEqual([
      { startLine: 2, endLine: 4 },
      { startLine: 0, endLine: 5 },
    ])
    expect(computeFoldingRanges('apache', '</Directory>\n')).toEqual([])
  })

  it('folds INI sections up to the next header and skips trailing comments', () => {
    const content = [
      '[client]',
      'port = 3306',
      '',
      '# trailing comment',
      '[mysqld]',
      'datadir = /var/lib/mysql',
      '',
    ].join('\n')

    expect(computeFoldingRanges('mysql', content)).toEqual([
      { startLine: 0, endLine: 1 },
      { startLine: 4, endLine: 5 },
    ])
  })

  it('folds gitconfig subsection headers and normalizes CRLF input', () => {
    const content =
      '[remote "origin"]\r\n  url = git@example.com:app.git\r\n[core]\r\n  editor = code\r\n'

    expect(computeFoldingRanges('gitconfig', content)).toEqual([
      { startLine: 0, endLine: 1 },
      { startLine: 2, endLine: 3 },
    ])
  })

  it('folds systemd unit sections', () => {
    const content = [
      '[Unit]',
      'Description=Demo',
      '',
      '[Service]',
      'ExecStart=/usr/bin/app',
      '',
      '[Install]',
      'WantedBy=multi-user.target',
    ].join('\n')

    expect(computeFoldingRanges('systemd', content)).toEqual([
      { startLine: 0, endLine: 1 },
      { startLine: 3, endLine: 4 },
      { startLine: 6, endLine: 7 },
    ])
  })

  it('folds Python tooling INI sections', () => {
    const content = [
      '[tox]',
      'envlist = py312',
      '',
      '[testenv]',
      'deps =',
      '    pytest',
    ].join('\n')

    expect(computeFoldingRanges('pyini', content)).toEqual([
      { startLine: 0, endLine: 1 },
      { startLine: 3, endLine: 5 },
    ])
  })

  it('folds Caddyfile blocks while ignoring inline placeholders', () => {
    const content = [
      'example.com {',
      '  handle /api/* {',
      '    reverse_proxy localhost:9000',
      '  }',
      '  respond {http.request.host}',
      '}',
    ].join('\n')

    expect(computeFoldingRanges('caddy', content)).toEqual([
      { startLine: 1, endLine: 3 },
      { startLine: 0, endLine: 5 },
    ])
  })

  it('drops sections that contain only blank and comment lines', () => {
    const content = '[a]\n# only a comment\n\n[b]\nkey = 1\n'

    expect(computeFoldingRanges('ini', content)).toEqual([
      { startLine: 3, endLine: 4 },
    ])
    expect(computeFoldingRanges('ini', '[a]\n')).toEqual([])
  })

  it('folds ssh Host and Match blocks', () => {
    const content = [
      'Host work',
      '  HostName example.com',
      '',
      'Match host "*.example.com"',
      '  User deploy',
      '',
    ].join('\n')

    expect(computeFoldingRanges('ssh', content)).toEqual([
      { startLine: 0, endLine: 1 },
      { startLine: 3, endLine: 4 },
    ])
  })

  it('folds TOML tables', () => {
    expect(computeFoldingRanges('toml', '[a]\nx = 1\n[b]\ny = 2\n')).toEqual([
      { startLine: 0, endLine: 1 },
      { startLine: 2, endLine: 3 },
    ])
    expect(
      computeFoldingRanges(
        'toml',
        '[project.urls]\nhome = "x"\n["quoted"]\nv = 1\n',
      ),
    ).toEqual([
      { startLine: 0, endLine: 1 },
      { startLine: 2, endLine: 3 },
    ])
    expect(
      computeFoldingRanges('toml', '[a]\r\nx = 1\r\n[b]\r\ny = 2\r\n'),
    ).toEqual([
      { startLine: 0, endLine: 1 },
      { startLine: 2, endLine: 3 },
    ])
  })

  it('keeps trailing blank and comment lines out of TOML table ranges', () => {
    const content = '[a]\nx = 1\n\n# trailing\n[b]\ny = 2\n'

    expect(computeFoldingRanges('toml', content)).toEqual([
      { startLine: 0, endLine: 1 },
      { startLine: 4, endLine: 5 },
    ])
  })

  it('drops TOML tables that hold no content and folds arrays of tables', () => {
    expect(computeFoldingRanges('toml', '[a]\n[b]\nx = 1\n')).toEqual([
      { startLine: 1, endLine: 2 },
    ])
    expect(computeFoldingRanges('toml', '[a]\nx = 1\n[b]\n')).toEqual([
      { startLine: 0, endLine: 1 },
    ])
    expect(
      computeFoldingRanges('toml', '[[items]]\nid = 1\n[[items]]\nid = 2\n'),
    ).toEqual([
      { startLine: 0, endLine: 1 },
      { startLine: 2, endLine: 3 },
    ])
  })

  it('ignores table-like text inside TOML multiline strings', () => {
    const content = '[a]\ntext = """\n[not.a.table]\n"""\n[b]\nx = 1\n'

    expect(computeFoldingRanges('toml', content)).toEqual([
      { startLine: 0, endLine: 3 },
      { startLine: 4, endLine: 5 },
    ])
  })

  it('reports the same TOML table extents for folding and outline', () => {
    const content =
      '[a]\nx = 1\n\n# note\n[b]\ny = 2\n\ntext = """\n[not.a.table]\n"""\n'
    const expected = [
      { startLine: 0, endLine: 1 },
      { startLine: 4, endLine: 9 },
    ]

    expect(computeFoldingRanges('toml', content)).toEqual(expected)
    expect(
      computeDocumentSymbols('toml', content).map(({ startLine, endLine }) => ({
        startLine,
        endLine,
      })),
    ).toEqual(expected)
  })

  it('keeps a hash-leading multiline string line inside its TOML table', () => {
    const content = '[a]\nx = """\n#hash"""\n[b]\ny = 1\n'

    expect(computeFoldingRanges('toml', content)).toEqual([
      { startLine: 0, endLine: 2 },
      { startLine: 3, endLine: 4 },
    ])
    expect(
      computeDocumentSymbols('toml', content).map(({ endLine }) => endLine),
    ).toEqual([2, 4])
  })

  it('returns no ranges for formats without folding strategies', () => {
    for (const id of ['tmux', 'screen', 'inputrc', 'env', 'unknown']) {
      expect(computeFoldingRanges(id, 'key = value\n')).toEqual([])
    }
  })

  it('returns no TOML ranges for empty or header-free content', () => {
    expect(computeFoldingRanges('toml', '')).toEqual([])
    expect(computeFoldingRanges('toml', 'x = 1\n')).toEqual([])
  })
})
