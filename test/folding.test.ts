import { describe, expect, it } from 'vitest'
import { computeFoldingRanges } from '../src/features/folding.js'

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

  it('returns no ranges for formats without folding strategies', () => {
    for (const id of ['tmux', 'screen', 'inputrc', 'env', 'toml', 'unknown']) {
      expect(computeFoldingRanges(id, 'key = value\n')).toEqual([])
    }
  })
})
