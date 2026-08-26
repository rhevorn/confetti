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

describe('formatNginx', () => {
  const messy = `# keep this comment
server {
listen 80;
location /api {
proxy_pass "http://backend/{path}";
}
}
`

  it('formats nested indentation', () => {
    expect(formatNginx(messy)).toBe(`# keep this comment
server {
  listen 80;
  location /api {
    proxy_pass "http://backend/{path}";
  }
}
`)
  })

  it('normalizes horizontal whitespace without changing strings or escapes', () => {
    const input = `location   =   /health{
add_header     Content-Type   text/plain ;
set $message "keep  two   spaces # { }";
set $escaped hello\\ world;
return 200 "ok";# keep   comment
}
`
    expect(formatNginx(input)).toBe(`location = /health {
  add_header Content-Type text/plain;
  set $message "keep  two   spaces # { }";
  set $escaped hello\\ world;
  return 200 "ok"; # keep   comment
}
`)
  })
})

describe('formatEnv', () => {
  it('uses dotenv assignment spacing and preserves the value', () => {
    expect(formatEnv('  export API_URL   =   "https://x.test/a  b"  \n')).toBe(
      'export API_URL="https://x.test/a  b"\n',
    )
  })
})

describe('formatIni', () => {
  it('normalizes INI and EditorConfig assignments', () => {
    expect(
      formatIni(
        '  [*.ts]  \n  insert_final_newline   = true  \nurl: "https://x.test?a=b"\n',
      ),
    ).toBe('[*.ts]\ninsert_final_newline = true\nurl : "https://x.test?a=b"\n')
  })
})

describe('formatSsh', () => {
  it('indents directives under Host and Match blocks', () => {
    expect(
      formatSsh('  Host work\nHostName example.com\n  User deploy\n'),
    ).toBe('Host work\n  HostName example.com\n  User deploy\n')
  })
})

describe('formatProperties', () => {
  it('normalizes assignments and preserves continuation content', () => {
    const input = ['  message = first \\', '    second part', ''].join('\n')
    const expected = ['message=first \\', '    second part', ''].join('\n')
    expect(formatProperties(input)).toBe(expected)
  })
})

describe('formatToml', () => {
  it('normalizes assignments and preserves multiline value indentation', () => {
    const input = '[project]  \n  name   =   "a  b"\nvalues=[\n    1,\n]\n'
    expect(formatToml(input)).toBe(
      '[project]\nname = "a  b"\nvalues = [\n    1,\n]\n',
    )
  })

  it('preserves multiline basic and literal string content exactly', () => {
    const trailingSpaces = '   '
    const input = `message   =   """
  left    =    right
  # this is string content${trailingSpaces}
"""
literal='''
key    =    untouched
'''
next=1
`
    expect(formatToml(input)).toBe(`message = """
  left    =    right
  # this is string content${trailingSpaces}
"""
literal = '''
key    =    untouched
'''
next = 1
`)
  })
})

describe('formatGitConfig', () => {
  it('indents and spaces section assignments', () => {
    expect(
      formatGitConfig(' [core] \neditor=code --wait\nautocrlf = false\n'),
    ).toBe('[core]\n  editor = code --wait\n  autocrlf = false\n')
  })
})

describe('formatNpmrc', () => {
  it('uses npm assignment spacing and preserves environment variables', () => {
    expect(
      formatNpmrc(
        ' registry = https://registry.npmjs.org/ \n_token = ${TOKEN}\n',
      ),
    ).toBe('registry=https://registry.npmjs.org/\n_token=${TOKEN}\n')
  })
})

describe('formatYaml', () => {
  it('formats safe structural whitespace and preserves block scalar content', () => {
    const input =
      'name:    app   \nitems:\n  -    one\ndescription: |  \n  keep me   \nnext: value   \n'
    expect(formatYaml(input)).toBe(
      'name: app\nitems:\n  - one\ndescription: |\n  keep me   \nnext: value\n',
    )
  })

  it('preserves sequence block scalars and both indicator orders', () => {
    const trailingSpaces = '   '
    const input = `scripts:
  -    |2-
    key:    value${trailingSpaces}
    left    =    right
message:    >-2 # folded
  keep:    every space${trailingSpaces}
next:    value${trailingSpaces}
`
    expect(formatYaml(input)).toBe(`scripts:
  - |2-
    key:    value${trailingSpaces}
    left    =    right
message: >-2 # folded
  keep:    every space${trailingSpaces}
next: value
`)
  })

  it('does not mistake a quoted pipe for a block scalar', () => {
    expect(formatYaml('symbol:    "|"\nnext:    value\n')).toBe(
      'symbol: "|"\nnext: value\n',
    )
  })
})

describe('formatter stability', () => {
  it.each([
    ['Nginx', formatNginx, 'server {\nlisten 80;\n}\n'],
    ['env', formatEnv, '  KEY = "a  b"  \n'],
    ['INI', formatIni, '[section]\n  key   = value\n'],
    ['SSH', formatSsh, 'Host work\nHostName example.com\n'],
    ['properties', formatProperties, '  key = value  \n'],
    ['TOML', formatToml, '[section]\n  key=value\n'],
    ['Git Config', formatGitConfig, '[core]\neditor=code\n'],
    ['npmrc', formatNpmrc, ' registry = https://registry.npmjs.org/ \n'],
    ['YAML', formatYaml, 'items:\n  -    one\n'],
  ])('%s is idempotent', (_name, formatter, input) => {
    const once = formatter(input)
    expect(formatter(once)).toBe(once)
  })
})
