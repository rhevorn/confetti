import { describe, expect, it } from 'vitest'
import { formatApache } from '../src/formatters/apache.js'
import { formatBrowserslist } from '../src/formatters/browserslist.js'
import { formatCrontab } from '../src/formatters/crontab.js'
import { formatEnv } from '../src/formatters/env.js'
import { formatFstab } from '../src/formatters/fstab.js'
import { formatGitConfig } from '../src/formatters/gitconfig.js'
import { formatGitAttributes } from '../src/formatters/gitattributes.js'
import { formatHosts } from '../src/formatters/hosts.js'
import { formatIni } from '../src/formatters/ini.js'
import { formatNginx } from '../src/formatters/nginx.js'
import { formatNpmrc } from '../src/formatters/npmrc.js'
import { formatProperties } from '../src/formatters/properties.js'
import { formatSsh } from '../src/formatters/ssh.js'
import { formatToml } from '../src/formatters/toml.js'
import { formatYarnrc } from '../src/formatters/yarnrc.js'

const formatters = [
  ['Nginx', formatNginx, 'events {\r\n}\r\n'],
  ['Apache', formatApache, '<Directory />\r\nAllowOverride none\r\n</Directory>\r\n'],
  ['env', formatEnv, 'KEY=value\r\n'],
  ['INI', formatIni, '[section]\r\nkey=value\r\n'],
  ['properties', formatProperties, 'key=value\r\n'],
  ['Git Config', formatGitConfig, '[core]\r\nkey=value\r\n'],
  ['npmrc', formatNpmrc, 'key=value\r\n'],
  ['yarnrc', formatYarnrc, 'registry "https://registry.yarnpkg.com"\r\n'],
  ['SSH', formatSsh, 'Host work\r\nUser deploy\r\n'],
  ['TOML', formatToml, '[table]\r\nkey=value\r\n'],
  ['Git Attributes', formatGitAttributes, '*.ts text\r\n'],
  ['Browserslist', formatBrowserslist, 'defaults\r\n'],
  ['Hosts', formatHosts, '127.0.0.1 localhost\r\n'],
  ['fstab', formatFstab, 'UUID=x / ext4 defaults 0 1\r\n'],
  ['Crontab', formatCrontab, '0 2 * * * /usr/bin/task\r\n'],
] as const

describe('formatter newline and empty-input contract', () => {
  it.each(formatters)(
    '%s converts CRLF and preserves a final newline',
    (_name, formatter, input) => {
      const output = formatter(input)
      expect(output).not.toContain('\r')
      expect(output.endsWith('\n')).toBe(true)
    },
  )

  it.each(formatters)(
    '%s preserves the absence of a final newline',
    (_name, formatter, input) => {
      expect(formatter(input.trimEnd()).endsWith('\n')).toBe(false)
    },
  )

  it.each(formatters)('%s handles empty input', (_name, formatter) => {
    expect(formatter('')).toBe('')
  })
})

describe('formatEnv edge cases', () => {
  it('preserves comments, export, hashes, equals signs, and quoted spacing', () => {
    expect(
      formatEnv(
        '  # comment   \n export TOKEN = "a  b=#value" \n URL=https://x.test?a=b#fragment\n',
      ),
    ).toBe(
      '# comment\nexport TOKEN="a  b=#value"\nURL=https://x.test?a=b#fragment\n',
    )
  })

  it('leaves malformed lines readable and supports empty values', () => {
    expect(formatEnv('  not an assignment  \n EMPTY =   \n')).toBe(
      'not an assignment\nEMPTY=\n',
    )
  })
})

describe('formatIni edge cases', () => {
  it('preserves section and comment text while handling both separators', () => {
    expect(
      formatIni(
        '  ; semicolon   \n # hash   \n [ section ] \npath : "a:b=c"\nempty =\n',
      ),
    ).toBe('; semicolon\n# hash\n[ section ]\npath: "a:b=c"\nempty =\n')
  })

  it('does not reinterpret a separator that only appears inside a string', () => {
    expect(formatIni('  "left=right"  \n')).toBe('"left=right"\n')
  })
})

describe('formatProperties edge cases', () => {
  it('preserves escaped key separators and all continuation lines', () => {
    const input = [
      String.raw`escaped\:key : value`,
      'message=first ' + '\\',
      '  second ' + '\\\\',
      'next = done',
      '',
    ].join('\n')
    const expected = [
      String.raw`escaped\:key=value`,
      'message=first ' + '\\',
      '  second ' + '\\\\',
      'next=done',
      '',
    ].join('\n')

    expect(formatProperties(input)).toBe(expected)
  })

  it('preserves comment kinds and normalizes whitespace-separated properties', () => {
    expect(
      formatProperties('  # hash\n  ! bang\nkey value with spaces\n'),
    ).toBe('# hash\n! bang\nkey=value with spaces\n')
  })

  it('leaves malformed and separator-free lines readable', () => {
    expect(formatProperties('=missing-key\nbare-option\npath:   /tmp\n')).toBe(
      '=missing-key\nbare-option\npath=/tmp\n',
    )
  })
})

describe('formatGitConfig edge cases', () => {
  it('formats root values, subsections, comments, and implicit booleans', () => {
    expect(
      formatGitConfig(
        ' root=value\n [remote "origin"] \n url = ../repo.git\n mirror\n ; keep\n',
      ),
    ).toBe(
      'root = value\n[remote "origin"]\n  url = ../repo.git\n  mirror\n; keep\n',
    )
  })

  it('preserves equals signs inside quoted values', () => {
    expect(formatGitConfig('[alias]\nshow = "log --format=a=b"\n')).toBe(
      '[alias]\n  show = "log --format=a=b"\n',
    )
  })

  it('leaves a root-level line without an assignment unindented', () => {
    expect(formatGitConfig('  bare-option  \n')).toBe('bare-option\n')
  })

  it('preserves every physical line in a continued value', () => {
    const input =
      '[alias]\ngraph = log --graph \\\n    --format=short \\\n      --all\n'
    expect(formatGitConfig(input)).toBe(
      '[alias]\n  graph = log --graph \\\n    --format=short \\\n      --all\n',
    )
  })
})

describe('formatNpmrc edge cases', () => {
  it('preserves both comment kinds, scoped keys, URLs, and interpolation', () => {
    expect(
      formatNpmrc(
        ' # hash\n ; semicolon\n @scope:registry = https://x.test?a=b\n //x.test/:_authToken = ${TOKEN}\n',
      ),
    ).toBe(
      '# hash\n; semicolon\n@scope:registry=https://x.test?a=b\n//x.test/:_authToken=${TOKEN}\n',
    )
  })

  it('leaves a line without an assignment readable', () => {
    expect(formatNpmrc('  malformed option  \n')).toBe('malformed option\n')
  })
})

describe('formatSsh edge cases', () => {
  it('keeps global directives flush left and indents Host/Match bodies', () => {
    expect(
      formatSsh(
        '  Include ~/.ssh/conf.d/*\n # global\n Host *.example\nHostName bastion\n # host\n Match user deploy\nUser deploy\n',
      ),
    ).toBe(
      'Include ~/.ssh/conf.d/*\n# global\nHost *.example\n  HostName bastion\n  # host\nMatch user deploy\n  User deploy\n',
    )
  })

  it('matches Host and Match case-insensitively', () => {
    expect(formatSsh('host work\nuser deploy\n')).toBe(
      'host work\n  user deploy\n',
    )
  })
})

describe('formatApache edge cases', () => {
  it('never creates negative indentation for unbalanced closing tags', () => {
    expect(formatApache('</Directory>\n<Directory />\n')).toBe(
      '</Directory>\n<Directory />\n',
    )
  })

  it('leaves a malformed opening bracket readable without inventing a block', () => {
    expect(formatApache('  <  not a real tag  \n')).toBe('< not a real tag\n')
  })

  it('collapses repeated blank lines without losing separation', () => {
    expect(formatApache('<IfModule x>\n\n\n</IfModule>\n')).toBe(
      '<IfModule x>\n\n</IfModule>\n',
    )
  })

  it('keeps hash characters without a boundary inside values', () => {
    expect(formatApache('Redirect 301 /a /b#anchor\n')).toBe(
      'Redirect 301 /a /b#anchor\n',
    )
  })
})

describe('formatNginx edge cases', () => {
  it('handles closing and opening braces on the same line', () => {
    expect(
      formatNginx('http{\nserver{\nlisten 80 ;\n} server{\nlisten 81;\n}\n}\n'),
    ).toBe(
      'http {\n  server {\n    listen 80;\n  }\n  server {\n    listen 81;\n  }\n}\n',
    )
  })

  it('ignores braces and comments inside strings and escaped tokens', () => {
    expect(
      formatNginx(
        'server {\nset $value "{ # keep  spaces }";\nset $escaped hello\\ world; # { comment\n}\n',
      ),
    ).toBe(
      'server {\n  set $value "{ # keep  spaces }";\n  set $escaped hello\\ world; # { comment\n}\n',
    )
  })

  it('keeps a comment attached to an unterminated directive line', () => {
    expect(formatNginx('log_format main $request # keep\n')).toBe(
      'log_format main $request # keep\n',
    )
  })

  it('preserves escaped quotes inside quoted strings', () => {
    expect(formatNginx('set $message "say \\"hello\\"";\n')).toBe(
      'set $message "say \\"hello\\"";\n',
    )
  })

  it('never creates negative indentation for malformed closing braces', () => {
    expect(formatNginx('}\nserver{\n}\n')).toBe('}\nserver {\n}\n')
  })

  it('handles an anonymous opening brace without adding leading space', () => {
    expect(formatNginx('{\n}\n')).toBe('{\n}\n')
  })

  it('collapses repeated blank lines without losing separation', () => {
    expect(formatNginx('http {\n\n\n}\n')).toBe('http {\n\n}\n')
  })
})

describe('new line-oriented formatter edge cases', () => {
  it('preserves blank lines, comment text, and literal hashes', () => {
    expect(formatGitAttributes('  # keep   \n\nfile#name   text\n')).toBe(
      '# keep\n\nfile#name text\n',
    )
    expect(formatBrowserslist('  # keep   \nChrome   >= 120\n')).toBe(
      '# keep\nChrome >= 120\n',
    )
  })

  it('preserves escaped host and mount fields', () => {
    expect(formatHosts('192.0.2.1 host\\ name    alias\n')).toBe(
      '192.0.2.1 host\\ name alias\n',
    )
    expect(
      formatFstab('/srv/a\\040b   /mnt/a\\040b none bind 0 0 # keep\n'),
    ).toBe('/srv/a\\040b /mnt/a\\040b none bind 0 0 # keep\n')
  })

  it('handles comments, short, macro-only, and system crontab lines safely', () => {
    expect(
      formatCrontab(
        '  # keep   \n\nBROKEN-NAME=value\n@daily\n0 2 * * 1-5 root   /usr/bin/task --arg "a  b"\n',
      ),
    ).toBe(
      '# keep\n\nBROKEN-NAME=value\n@daily\n0 2 * * 1-5 root   /usr/bin/task --arg "a  b"\n',
    )
  })

  it('handles a schedule with no command without crashing', () => {
    expect(formatCrontab('0 2 * * *\n')).toBe('0 2 * * *\n')
  })
})

describe('formatToml edge cases', () => {
  it('preserves arrays, inline tables, comments, and equals in strings', () => {
    expect(
      formatToml(
        ' # comment\n [[products]] \nname="a=b"\nvalues = [\n  1,\n  2,\n]\ninline={ key = "value" }\n',
      ),
    ).toBe(
      '# comment\n[[products]]\nname = "a=b"\nvalues = [\n  1,\n  2,\n]\ninline = { key = "value" }\n',
    )
  })

  it('handles inline and escaped triple quote delimiters safely', () => {
    const input = String.raw`inline = """one line"""
message = """
escaped \""" remains content
closing
"""
next=2
`
    expect(formatToml(input)).toBe(String.raw`inline = """one line"""
message = """
escaped \""" remains content
closing
"""
next = 2
`)
  })

  it('preserves an unterminated multiline string without corrupting it', () => {
    expect(formatToml('message="""\nkey    =    text\n')).toBe(
      'message="""\nkey    =    text\n',
    )
  })

  it('formats container values before an inline comment', () => {
    expect(formatToml('values=[ 1,  2 ]   # keep\n')).toBe(
      'values = [1, 2] # keep\n',
    )
  })

  it('preserves a comment-only value on malformed input', () => {
    expect(formatToml('key = # keep\n')).toBe('key = # keep\n')
  })

  it('handles empty and unmatched container symbols without crashing', () => {
    expect(formatToml('empty={}\nmalformed=}\n')).toBe(
      'empty = {}\nmalformed=}\n',
    )
  })

  it('preserves comments and blank lines inside multiline arrays', () => {
    expect(
      formatToml(
        'items=[\n # first group\n "a" , # trailing\n\n   # second group\n {name="b",meta={enabled=true}},\n]\n',
      ),
    ).toBe(
      'items = [\n  # first group\n  "a", # trailing\n\n  # second group\n  { name = "b", meta = { enabled = true } },\n]\n',
    )
  })

  it('preserves all TOML string forms and hashes inside strings', () => {
    const input = String.raw`basic = "a # b = c"
literal = 'C:\Users\name # literal'
multiline = """
keep    spacing # and = signs
"""
multiline_literal = '''
backslashes \\ stay literal
'''
`
    expect(formatToml(input)).toBe(input)
  })

  it('preserves a space-delimited date-time value', () => {
    expect(formatToml('updated=1979-05-27   07:32:00Z\n')).toBe(
      'updated = 1979-05-27 07:32:00Z\n',
    )
  })

  it('leaves malformed keys and unterminated single-line strings untouched', () => {
    expect(formatToml('bad key=1\nvalue = "unterminated\nnext=2\n')).toBe(
      'bad key=1\nvalue = "unterminated\nnext = 2\n',
    )
  })

  it('leaves empty, invalid dotted, and separator-free keys untouched', () => {
    expect(formatToml('=1\nkey..child=2\nkey.=3\n[]\nbare value\n')).toBe(
      '=1\nkey..child=2\nkey.=3\n[]\nbare value\n',
    )
  })

  it('formats decimal dots, empty containers, and multiline inline tables', () => {
    expect(
      formatToml(
        'number=1.25\nempty_array = [ ]\nempty_table = { }\nrecord={\nname="demo",\nnested = {enabled=true}\n}\n',
      ),
    ).toBe(
      'number = 1.25\nempty_array = []\nempty_table = {}\nrecord = {\n  name = "demo",\n  nested = { enabled = true }\n}\n',
    )
  })

  it('does not repair an invalid spaced decimal into a different value', () => {
    expect(formatToml('number = 1 . 25\n')).toBe('number = 1 . 25\n')
  })

  it('keeps formatting stable for a representative nested document', () => {
    const input = `[[products]]
name="Hammer"
sku=738594937
colors = [
  "red",
  "blue", # popular
]
dimensions={width=10.5,height=5,metadata={unit="cm"}}
`
    const once = formatToml(input)
    expect(formatToml(once)).toBe(once)
  })
})
