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

describe('formatApache', () => {
  it('indents sections and normalizes directive spacing', () => {
    const messy = `# keep this comment
<VirtualHost   *:80>
ServerName   example.com
<Directory   "/var/www/html">
Options   FollowSymLinks
Require   all   granted
</Directory>
</VirtualHost>
`
    expect(formatApache(messy)).toBe(`# keep this comment
<VirtualHost *:80>
  ServerName example.com
  <Directory "/var/www/html">
    Options FollowSymLinks
    Require all granted
  </Directory>
</VirtualHost>
`)
  })

  it('keeps strings, comments, and untagged directives intact', () => {
    expect(
      formatApache(
        '  RewriteEngine   On   \n  # keep   comment  \nErrorLog   "logs/error   log"  \n',
      ),
    ).toBe('RewriteEngine On\n# keep   comment\nErrorLog "logs/error   log"\n')
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

describe('line-oriented formatters', () => {
  it('formats Git Attributes without changing escaped spaces', () => {
    expect(
      formatGitAttributes(
        '# keep\n*.ts    text    eol=lf\ndocs/generated\\ files/**   linguist-generated=true\n',
      ),
    ).toBe(
      '# keep\n*.ts text eol=lf\ndocs/generated\\ files/** linguist-generated=true\n',
    )
  })

  it('formats Browserslist queries', () => {
    expect(formatBrowserslist('defaults\nlast    2   versions\n')).toBe(
      'defaults\nlast 2 versions\n',
    )
  })

  it('formats hosts and fstab columns plus inline comments', () => {
    expect(formatHosts('127.0.0.1    localhost   alias # local\n')).toBe(
      '127.0.0.1 localhost alias # local\n',
    )
    expect(formatFstab('UUID=x   /mnt/a\\040b  ext4  defaults  0  2\n')).toBe(
      'UUID=x /mnt/a\\040b ext4 defaults 0 2\n',
    )
  })

  it('formats only the structural portion of crontab entries', () => {
    expect(
      formatCrontab(
        'SHELL = /bin/bash\n*/5   * *  * *    echo "keep  two spaces"\n@daily     run --name "daily  job"\n',
      ),
    ).toBe(
      'SHELL=/bin/bash\n*/5 * * * * echo "keep  two spaces"\n@daily run --name "daily  job"\n',
    )
  })
  it('formats classic Yarn space-separated keys and values', () => {
    expect(
      formatYarnrc(
        '  registry   "https://registry.yarnpkg.com"  \nyarn-offline-mirror    "./cache"\n"--install.ignore-engines"    true  # keep\n',
      ),
    ).toBe(
      'registry "https://registry.yarnpkg.com"\nyarn-offline-mirror "./cache"\n"--install.ignore-engines" true # keep\n',
    )
  })
})

describe('formatter stability', () => {
  it.each([
    ['Nginx', formatNginx, 'server {\nlisten 80;\n}\n'],
    ['Apache', formatApache, '<Directory />\nAllowOverride none\n</Directory>\n'],
    ['env', formatEnv, '  KEY = "a  b"  \n'],
    ['INI', formatIni, '[section]\n  key   = value\n'],
    ['SSH', formatSsh, 'Host work\nHostName example.com\n'],
    ['properties', formatProperties, '  key = value  \n'],
    ['TOML', formatToml, '[section]\n  key=value\n'],
    ['Git Config', formatGitConfig, '[core]\neditor=code\n'],
    ['npmrc', formatNpmrc, ' registry = https://registry.npmjs.org/ \n'],
    ['yarnrc', formatYarnrc, ' registry   "https://registry.yarnpkg.com" \n'],
    ['Git Attributes', formatGitAttributes, '*.ts   text  eol=lf\n'],
    ['Browserslist', formatBrowserslist, 'last   2 versions\n'],
    ['Hosts', formatHosts, '127.0.0.1   localhost\n'],
    ['fstab', formatFstab, 'UUID=x   / ext4 defaults 0 1\n'],
    ['Crontab', formatCrontab, '0  2 * * *  /usr/bin/task\n'],
  ])('%s is idempotent', (_name, formatter, input) => {
    const once = formatter(input)
    expect(formatter(once)).toBe(once)
  })
})
