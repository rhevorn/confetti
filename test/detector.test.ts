import { describe, expect, it } from 'vitest'
import { createDefaultRegistry } from '../src/configs/index.js'
import { MIN_CONFIDENCE } from '../src/core/constants.js'
import { detectConfig } from '../src/core/detector.js'
import { ConfigRegistry } from '../src/core/registry.js'

const registry = createDefaultRegistry()

describe('detectConfig', () => {
  it('uses a fixed confidence threshold', () => {
    expect(MIN_CONFIDENCE).toBe(70)
  })

  it('prefers an exact filename', () => {
    const result = detectConfig(registry, '/etc/nginx/nginx.conf', 'events {}')
    expect(result?.definition.id).toBe('nginx')
    expect(result?.confidence).toBe(100)
  })

  it('detects an SSH user config from its path and content', () => {
    const result = detectConfig(
      registry,
      '/Users/example/.ssh/config',
      'Host work\n  HostName example.com\n',
    )
    expect(result?.definition.id).toBe('ssh')
  })

  it('normalizes Windows paths before matching filenames and patterns', () => {
    expect(
      detectConfig(
        registry,
        String.raw`C:\Users\example\.ssh\config`,
        'Host work\n',
      )?.definition.id,
    ).toBe('ssh')
    expect(
      detectConfig(
        registry,
        String.raw`C:\project\.git\config`,
        '[core]\nrepositoryformatversion = 0\n',
      )?.definition.id,
    ).toBe('gitconfig')
  })

  it.each([
    ['env', '/app/.env.local', 'DATABASE_URL=postgres://localhost/app\n'],
    ['ini', '/app/settings.ini', '[server]\nport = 8080\n'],
    ['ini', '/app/.editorconfig', '[*.ts]\nindent_size = 2\n'],
    ['properties', '/app/messages.properties', 'welcome.message=Hello\n'],
    ['toml', '/app/pyproject.toml', '[project]\nname = "confetti"\n'],
    ['gitconfig', '/app/.git/config', '[core]\neditor = code\n'],
    ['npmrc', '/app/.npmrc', 'registry=https://registry.npmjs.org/\n'],
    [
      'yarnrc',
      '/app/.yarnrc',
      'registry "https://registry.yarnpkg.com"\nyarn-offline-mirror "./cache"\n',
    ],
    ['yaml', '/app/compose.yaml', 'services:\n  web:\n    image: nginx\n'],
    ['ignore', '/app/.gitignore', 'node_modules/\n!important.log\n'],
    ['gitattributes', '/app/.gitattributes', '*.ts text eol=lf\n'],
    ['browserslist', '/app/.browserslistrc', 'defaults\nnot dead\n'],
    ['versions', '/app/.tool-versions', 'nodejs 22.18.0\n'],
    ['versions', '/app/.nvmrc', 'v22.18.0\n'],
    ['hosts', '/etc/hosts', '127.0.0.1 localhost\n'],
    ['fstab', '/etc/fstab', 'UUID=demo / ext4 defaults 0 1\n'],
    ['crontab', '/etc/crontab', '0 2 * * * /usr/bin/backup\n'],
    ['apache', '/etc/httpd/conf/httpd.conf', 'Listen 80\n'],
    [
      'apache',
      '/srv/app/.htaccess',
      'RewriteEngine On\nRewriteRule ^(.*)$ /index.php [L]\n',
    ],
    [
      'apache',
      '/srv/app/site.conf',
      '<VirtualHost *:80>\nServerName example.com\n</VirtualHost>\n',
    ],
    ['mysql', '/etc/mysql/my.cnf', '[client]\nport = 3306\n'],
    ['mysql', '/home/user/.my.cnf', '[client]\nuser = root\n'],
    [
      'mysql',
      '/etc/mariadb/mariadb.cnf',
      '[mysqld]\ndatadir = /var/lib/mysql\n',
    ],
    [
      'pip',
      '/home/user/.config/pip/pip.conf',
      '[global]\nindex-url = https://pypi.org/simple\n',
    ],
    ['pip', '/home/user/.pip/pip.conf', '[global]\ntimeout = 30\n'],
    ['setupcfg', '/app/setup.cfg', '[metadata]\nname = demo\n'],
    ['tmux', '/home/user/.tmux.conf', 'set -g mouse on\n'],
    [
      'tmux',
      '/home/user/.config/tmux/tmux.conf',
      'set -g base-index 1\nbind r source-file ~/.tmux.conf\n',
    ],
    [
      'screen',
      '/home/user/.screenrc',
      'startup_message off\nhardstatus alwayslastline\n',
    ],
    [
      'inputrc',
      '/home/user/.inputrc',
      'set editing-mode emacs\n"\\C-a": beginning-of-line\n',
    ],
  ])('detects %s configuration', (expected, filename, content) => {
    expect(detectConfig(registry, filename, content)?.definition.id).toBe(
      expected,
    )
  })

  it('detects path-based Git and cron files from content', () => {
    expect(
      detectConfig(
        registry,
        '/repo/.git/info/attributes',
        '*.md diff=markdown\n',
      )?.definition.id,
    ).toBe('gitattributes')
    expect(
      detectConfig(
        registry,
        '/etc/cron.d/confetti',
        'SHELL=/bin/sh\n0 * * * * root /usr/bin/task\n',
      )?.definition.id,
    ).toBe('crontab')
  })

  it.each([
    '.gitignore',
    '.dockerignore',
    '.npmignore',
    '.prettierignore',
    '.eslintignore',
    '.stylelintignore',
    '.helmignore',
    '.ignore',
    '.cursorignore',
    '.cursorindexingignore',
    '.vscodeignore',
    '.vercelignore',
    '.netlifyignore',
    '.gcloudignore',
    '.terraformignore',
  ])('recognizes the %s ignore filename', (filename) => {
    expect(detectConfig(registry, `/app/${filename}`, '')?.definition.id).toBe(
      'ignore',
    )
  })

  it('recognizes classic Yarn config files', () => {
    expect(detectConfig(registry, '/app/.yarnrc', '')?.definition.id).toBe(
      'yarnrc',
    )
    expect(
      detectConfig(
        registry,
        '/app/project/.yarnrc',
        'registry "https://registry.yarnpkg.com"\nyarn-offline-mirror "./cache"\n',
      )?.definition.id,
    ).toBe('yarnrc')
  })

  it('does not treat Yarn Berry YAML configs as classic yarnrc', () => {
    expect(
      detectConfig(registry, '/app/.yarnrc.yml', 'nodeLinker: node-modules\n')
        ?.definition.id,
    ).not.toBe('yarnrc')
  })

  it('recognizes arbitrary .*ignore filenames', () => {
    expect(
      detectConfig(registry, '/app/.customignore', '')?.definition.id,
    ).toBe('ignore')
    expect(
      detectConfig(registry, '/app/project/.buildignore', 'dist/\n')?.definition
        .id,
    ).toBe('ignore')
  })

  it.each([
    '.nvmrc',
    '.node-version',
    '.python-version',
    '.ruby-version',
    '.tool-versions',
  ])('recognizes the %s tool version filename', (filename) => {
    expect(detectConfig(registry, `/app/${filename}`, '')?.definition.id).toBe(
      'versions',
    )
  })

  it('recognizes empty files with unambiguous INI and YAML extensions', () => {
    expect(detectConfig(registry, '/app/settings.ini', '')?.definition.id).toBe(
      'ini',
    )
    expect(detectConfig(registry, '/app/config.yml', '')?.definition.id).toBe(
      'yaml',
    )
    expect(
      detectConfig(registry, '/app/messages.properties', '')?.definition.id,
    ).toBe('properties')
  })

  it('detects alternate CFG and YML extensions with supporting content', () => {
    expect(
      detectConfig(registry, '/app/settings.cfg', '[server]\nport=8080\n')
        ?.definition.id,
    ).toBe('ini')
    expect(
      detectConfig(registry, '/app/config.yml', '---\n- item\n')?.definition.id,
    ).toBe('yaml')
  })

  it('does not force a low-confidence result', () => {
    expect(
      detectConfig(registry, '/srv/application.conf', 'feature.color=blue\n'),
    ).toBeUndefined()
  })

  it('recognizes Apache paths and disambiguates Apache from Nginx content', () => {
    expect(
      detectConfig(registry, '/etc/apache2/apache2.conf', '')?.definition.id,
    ).toBe('apache')
    expect(
      detectConfig(registry, '/etc/apache2/sites-available/example.com', '')
        ?.definition.id,
    ).toBe('apache')
    expect(
      detectConfig(
        registry,
        '/srv/generic.conf',
        '<IfModule mod_ssl.c>\nListen 443\n</IfModule>\n',
      )?.definition.id,
    ).toBe('apache')
    expect(
      detectConfig(
        registry,
        '/srv/generic.conf',
        'server {\nlisten 80;\nlocation / {\nproxy_pass http://app;\n}\n}\n',
      )?.definition.id,
    ).toBe('nginx')
  })

  it('keeps INI-family content detection below the hijacking threshold', () => {
    // A generic INI file with MySQL-ish or pip-ish sections stays INI: the
    // INI definition owns the extension and content-only scores stay < 70.
    expect(
      detectConfig(
        registry,
        '/app/settings.ini',
        '[mysql]\nbasedir=/usr\ndatadir=/var/lib/mysql\n',
      )?.definition.id,
    ).toBe('ini')
    expect(
      detectConfig(
        registry,
        '/app/notes.txt',
        '[client]\nport=3306\nsocket=/var/run/mysqld.sock\n',
      ),
    ).toBeUndefined()
    expect(
      detectConfig(
        registry,
        '/app/notes.txt',
        '[global]\nindex-url=https://pypi.org/simple\n',
      ),
    ).toBeUndefined()
  })

  it('prefers an exact setup.cfg filename over the generic INI extension', () => {
    expect(
      detectConfig(
        registry,
        '/app/setup.cfg',
        '[metadata]\nname = demo\nversion = 1.0.0\n',
      )?.definition.id,
    ).toBe('setupcfg')
    expect(
      detectConfig(
        registry,
        '/app/other.cfg',
        '[metadata]\nname = demo\nversion = 1.0.0\n',
      )?.definition.id,
    ).toBe('ini')
  })

  it('keeps tmux content detection below the hijacking threshold', () => {
    expect(
      detectConfig(registry, '/srv/notes.txt', 'set -g mouse on\n'),
    ).toBeUndefined()
    expect(
      detectConfig(
        registry,
        '/srv/generic.conf',
        'set -g status-interval 5\nbind r source-file ~/.tmux.conf\n',
      ),
    ).toBeUndefined()
  })

  it('does not let weak Apache content alone cross the threshold', () => {
    expect(
      detectConfig(registry, '/srv/notes.txt', 'custom value without a tag\n'),
    ).toBeUndefined()
    expect(
      detectConfig(
        registry,
        '/srv/notes.txt',
        'Require all granted # a single weak signal\n',
      ),
    ).toBeUndefined()
  })

  it('does not treat every file named config as SSH', () => {
    expect(
      detectConfig(registry, '/srv/example/config', 'theme dark\n'),
    ).toBeUndefined()
  })

  it('survives a broken custom detector', () => {
    const brokenRegistry = createDefaultRegistry()
    brokenRegistry.register({
      id: 'broken',
      displayName: 'Broken',
      languageId: 'broken',
      detect: () => {
        throw new Error('broken')
      },
    })
    expect(
      detectConfig(brokenRegistry, '/tmp/unknown', 'unknown'),
    ).toBeUndefined()
  })

  it('accepts exactly the minimum confidence and rejects one point below it', () => {
    const boundaryRegistry = new ConfigRegistry()
    boundaryRegistry.register({
      id: 'accepted',
      displayName: 'Accepted',
      languageId: 'accepted',
      detect: () => MIN_CONFIDENCE,
    })
    boundaryRegistry.register({
      id: 'rejected',
      displayName: 'Rejected',
      languageId: 'rejected',
      detect: () => MIN_CONFIDENCE - 1,
    })

    const result = detectConfig(boundaryRegistry, '/tmp/file', '')
    expect(result?.definition.id).toBe('accepted')
    expect(result?.confidence).toBe(MIN_CONFIDENCE)
    expect(
      result?.candidates.map(({ definition, confidence }) => [
        definition.id,
        confidence,
      ]),
    ).toEqual([
      ['accepted', 70],
      ['rejected', 69],
    ])
  })

  it('sorts equal-confidence candidates deterministically by config ID', () => {
    const tiedRegistry = new ConfigRegistry()
    for (const id of ['zeta', 'alpha']) {
      tiedRegistry.register({
        id,
        displayName: id,
        languageId: id,
        detect: () => 80,
      })
    }

    expect(
      detectConfig(tiedRegistry, '/tmp/file', '')?.candidates.map(
        ({ definition }) => definition.id,
      ),
    ).toEqual(['alpha', 'zeta'])
  })

  it('supports wildcard patterns against full paths and basenames', () => {
    const patternRegistry = new ConfigRegistry()
    patternRegistry.register({
      id: 'full-path',
      displayName: 'Full Path',
      languageId: 'full-path',
      patterns: ['*/config/*.custom'],
    })
    patternRegistry.register({
      id: 'basename',
      displayName: 'Basename',
      languageId: 'basename',
      patterns: ['special.*'],
    })

    expect(
      detectConfig(patternRegistry, '/app/config/value.custom', '')?.definition
        .id,
    ).toBe('full-path')
    expect(
      detectConfig(patternRegistry, '/app/other/SPECIAL.conf', '')?.definition
        .id,
    ).toBe('basename')
  })

  it('clamps detector scores and ignores zero-confidence candidates', () => {
    const scoreRegistry = new ConfigRegistry()
    scoreRegistry.register({
      id: 'high',
      displayName: 'High',
      languageId: 'high',
      detect: () => 500,
    })
    scoreRegistry.register({
      id: 'negative',
      displayName: 'Negative',
      languageId: 'negative',
      detect: () => -500,
    })
    scoreRegistry.register({
      id: 'none',
      displayName: 'None',
      languageId: 'none',
    })

    const result = detectConfig(scoreRegistry, '/tmp/file', '')
    expect(result?.confidence).toBe(100)
    expect(result?.candidates.map(({ definition }) => definition.id)).toEqual([
      'high',
    ])
  })

  it('does not let a detector exception erase an exact filename match', () => {
    const resilientRegistry = new ConfigRegistry()
    resilientRegistry.register({
      id: 'known',
      displayName: 'Known',
      languageId: 'known',
      filenames: ['known.conf'],
      detect: () => {
        throw new Error('bad content')
      },
    })

    expect(
      detectConfig(resilientRegistry, '/tmp/known.conf', '')?.confidence,
    ).toBe(100)
  })

  it('keeps extension-only ambiguity below the confidence threshold', () => {
    const extensionRegistry = new ConfigRegistry()
    extensionRegistry.register({
      id: 'generic-conf',
      displayName: 'Generic Conf',
      languageId: 'generic-conf',
      extensions: ['.conf'],
    })

    expect(
      detectConfig(extensionRegistry, '/tmp/unknown.conf', ''),
    ).toBeUndefined()
  })
})

describe('detector performance baseline', () => {
  it('detects a 1 MB supported config within the product target', () => {
    const content = `${'comment=value\n'.repeat(74_000)}server {\nlisten 80;\n}\n`
    const startedAt = performance.now()
    const result = detectConfig(registry, '/etc/nginx/nginx.conf', content)
    const elapsed = performance.now() - startedAt

    expect(result?.definition.id).toBe('nginx')
    expect(Buffer.byteLength(content)).toBeGreaterThan(1_000_000)
    expect(elapsed).toBeLessThan(100)
  })
})
