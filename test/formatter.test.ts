import { describe, expect, it } from 'vitest'
import { formatEnv } from '../src/formatters/env.js'
import { formatGitConfig } from '../src/formatters/gitconfig.js'
import { formatIni } from '../src/formatters/ini.js'
import { formatNginx } from '../src/formatters/nginx.js'
import { formatNpmrc } from '../src/formatters/npmrc.js'
import { formatProperties } from '../src/formatters/properties.js'
import { formatSsh } from '../src/formatters/ssh.js'
import { formatToml } from '../src/formatters/toml.js'

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

  it('tokenizes compact blocks and emits one structural statement per line', () => {
    expect(formatNginx('server{listen 80;location /{return 200 "ok";}}\n'))
      .toBe(`server {
  listen 80;
  location / {
    return 200 "ok";
  }
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

  it('normalizes whitespace between export and the key', () => {
    expect(formatEnv('export   API_KEY   =   value\n')).toBe(
      'export API_KEY=value\n',
    )
  })
})

describe('formatIni', () => {
  it('normalizes INI and EditorConfig assignments', () => {
    expect(
      formatIni(
        '  [*.ts]  \n  insert_final_newline   = true  \nurl: "https://x.test?a=b"\n',
      ),
    ).toBe('[*.ts]\ninsert_final_newline = true\nurl: "https://x.test?a=b"\n')
  })
})

describe('formatSsh', () => {
  it('indents directives under Host and Match blocks', () => {
    expect(
      formatSsh('  Host work\nHostName example.com\n  User deploy\n'),
    ).toBe('Host work\n  HostName example.com\n  User deploy\n')
  })

  it('tokenizes directive spacing and inline comments', () => {
    expect(
      formatSsh('Host   work\nHostName    example.com   # primary\n'),
    ).toBe('Host work\n  HostName example.com # primary\n')
  })
})

describe('formatProperties', () => {
  it('normalizes assignments and preserves continuation content', () => {
    const input = ['  message = first \\', '    second part', ''].join('\n')
    const expected = ['message=first \\', '    second part', ''].join('\n')
    expect(formatProperties(input)).toBe(expected)
  })

  it('normalizes whitespace separators to an explicit equals sign', () => {
    expect(formatProperties('host localhost\npath : /tmp\n')).toBe(
      'host=localhost\npath=/tmp\n',
    )
  })
})

describe('formatToml', () => {
  it('normalizes assignments and preserves multiline value indentation', () => {
    const input = '[project]  \n  name   =   "a  b"\nvalues=[\n    1,\n]\n'
    expect(formatToml(input)).toBe(
      '[project]\nname = "a  b"\nvalues = [\n  1,\n]\n',
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

  it('formats array and inline-table tokens', () => {
    expect(
      formatToml('[ section ]\nvalues=[  1,   2 ]\ninline={a=1,  b=2}\n'),
    ).toBe('[section]\nvalues = [1, 2]\ninline = { a = 1, b = 2 }\n')
  })

  it('normalizes dotted and quoted keys without changing key content', () => {
    expect(
      formatToml(
        '  physical . color . "bit depth" = 24\n[ fruit . "physical color" ] # table\n',
      ),
    ).toBe(
      'physical.color."bit depth" = 24\n[fruit."physical color"] # table\n',
    )
  })

  it('formats nested arrays and inline tables structurally', () => {
    expect(
      formatToml(
        'matrix = [\n [1,2],\n [ 3, {x=1,y=[true,false]} ], # row\n]\n',
      ),
    ).toBe(
      'matrix = [\n  [1, 2],\n  [3, { x = 1, y = [true, false] }], # row\n]\n',
    )
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
  ])('%s is idempotent', (_name, formatter, input) => {
    const once = formatter(input)
    expect(formatter(once)).toBe(once)
  })
})
