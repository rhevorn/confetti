import { describe, expect, it } from 'vitest'
import { formatEnv } from '../src/formatters/env.js'
import { formatGitConfig } from '../src/formatters/gitconfig.js'
import { formatIni } from '../src/formatters/ini.js'
import { formatNginx } from '../src/formatters/nginx.js'
import { formatNpmrc } from '../src/formatters/npmrc.js'
import { formatProperties } from '../src/formatters/properties.js'
import { formatSsh } from '../src/formatters/ssh.js'
import { formatToml } from '../src/formatters/toml.js'
import { formatYaml } from '../src/formatters/yaml.js'

const formatters = [
  ['Nginx', formatNginx, 'events {\r\n}\r\n'],
  ['env', formatEnv, 'KEY=value\r\n'],
  ['INI', formatIni, '[section]\r\nkey=value\r\n'],
  ['properties', formatProperties, 'key=value\r\n'],
  ['Git Config', formatGitConfig, '[core]\r\nkey=value\r\n'],
  ['npmrc', formatNpmrc, 'key=value\r\n'],
  ['SSH', formatSsh, 'Host work\r\nUser deploy\r\n'],
  ['TOML', formatToml, '[table]\r\nkey=value\r\n'],
  ['YAML', formatYaml, 'key: value\r\n'],
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
    ).toBe('; semicolon\n# hash\n[ section ]\npath : "a:b=c"\nempty =\n')
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
      String.raw`escaped\:key:value`,
      'message=first ' + '\\',
      '  second ' + '\\\\',
      'next=done',
      '',
    ].join('\n')

    expect(formatProperties(input)).toBe(expected)
  })

  it('preserves comment kinds and whitespace-separated properties', () => {
    expect(
      formatProperties('  # hash\n  ! bang\nkey value with spaces\n'),
    ).toBe('# hash\n! bang\nkey value with spaces\n')
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

describe('formatNginx edge cases', () => {
  it('handles closing and opening braces on the same line', () => {
    expect(
      formatNginx('http{\nserver{\nlisten 80 ;\n} server{\nlisten 81;\n}\n}\n'),
    ).toBe(
      'http {\n  server {\n    listen 80;\n  } server {\n    listen 81;\n  }\n}\n',
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
      'message = """\nkey    =    text\n',
    )
  })
})

describe('formatYaml edge cases', () => {
  it('formats safe mappings and sequences without changing flow values', () => {
    expect(
      formatYaml(
        'enabled:    true\nitems:\n  -    one\nflow:    { left:  1, right: [2, 3] }\n"quoted key":    value\n',
      ),
    ).toBe(
      'enabled: true\nitems:\n  - one\nflow: { left:  1, right: [2, 3] }\n"quoted key":    value\n',
    )
  })

  it('preserves blank lines, comments, hashes, and quotes inside block scalars', () => {
    const trailingSpaces = '  '
    const input = `text:    |+ # header
  first:    value${trailingSpaces}

  "# not comment"
# outside   
next:    done
`
    expect(formatYaml(input)).toBe(`text: |+ # header
  first:    value${trailingSpaces}

  "# not comment"
# outside
next: done
`)
  })

  it('supports all valid block scalar indicator combinations', () => {
    for (const indicator of [
      '|',
      '|-',
      '|+',
      '|2',
      '|2-',
      '|2+',
      '|-2',
      '|+2',
    ]) {
      const input = `value: ${indicator}\n  key:    untouched\nnext:    done\n`
      expect(formatYaml(input)).toBe(
        `value: ${indicator}\n  key:    untouched\nnext: done\n`,
      )
    }
  })

  it('scans escaped double quotes and closed single quotes safely', () => {
    expect(
      formatYaml(
        'double:    "escaped \\" |"\nsingle:    \'closed |\'\nnext:    done\n',
      ),
    ).toBe('double: "escaped \\" |"\nsingle: \'closed |\'\nnext: done\n')
  })
})
