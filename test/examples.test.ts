import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createDefaultRegistry } from '../src/configs/index.js'
import { detectConfig } from '../src/core/detector.js'
import { formatConfig } from '../src/core/formatter.js'

const registry = createDefaultRegistry()
const examplesDirectory = path.join(process.cwd(), 'examples')

interface ExampleCase {
  relativePath: string
  expectedType?: string
  preservedText?: string
}

const examples: ExampleCase[] = [
  {
    relativePath: 'nginx/nginx.conf',
    expectedType: 'nginx',
    preservedText: 'a # sign and { braces } inside a string',
  },
  {
    relativePath: 'nginx/site.conf',
    expectedType: 'nginx',
    preservedText: 'proxy_pass http://127.0.0.1:8080;',
  },
  {
    relativePath: 'nginx/spacing.conf',
    expectedType: 'nginx',
    preservedText: '"keep  two   spaces # { }"',
  },
  {
    relativePath: '.ssh/config',
    expectedType: 'ssh',
    preservedText: 'exec $SHELL',
  },
  {
    relativePath: 'apache/httpd.conf',
    expectedType: 'apache',
    preservedText: 'keep  two spaces',
  },
  {
    relativePath: 'apache/.htaccess',
    expectedType: 'apache',
    preservedText: '^www\\.example\\.com$',
  },
  {
    relativePath: 'apache/site.conf',
    expectedType: 'apache',
    preservedText: 'webmaster@example.com',
  },
  {
    relativePath: 'ssh/sshd_config',
    expectedType: 'ssh',
    preservedText: '.ssh/authorized_keys2',
  },
  {
    relativePath: 'env/.env.local',
    expectedType: 'env',
    preservedText: '"keep  two  spaces"',
  },
  {
    relativePath: 'ini/settings.ini',
    expectedType: 'ini',
    preservedText: '"keep  internal  spaces"',
  },
  {
    relativePath: 'ini/.editorconfig',
    expectedType: 'ini',
    preservedText: 'insert_final_newline',
  },
  {
    relativePath: 'mysql/my.cnf',
    expectedType: 'mysql',
    preservedText: '/var/run/mysqld/mysqld.sock',
  },
  {
    relativePath: 'pip/pip.conf',
    expectedType: 'pip',
    preservedText: 'https://download.pytorch.org/whl/cpu',
  },
  {
    relativePath: 'python/setup.cfg',
    expectedType: 'setupcfg',
    preservedText: 'Programming Language :: Python :: 3',
  },
  {
    relativePath: 'python/tox.ini',
    expectedType: 'pyini',
    preservedText: '    pytest>=8',
  },
  {
    relativePath: 'python/.flake8',
    expectedType: 'pyini',
    preservedText: 'tests/*: S101',
  },
  {
    relativePath: 'properties/messages.properties',
    expectedType: 'properties',
    preservedText: 'second part keeps its indentation',
  },
  {
    relativePath: 'toml/pyproject.toml',
    expectedType: 'toml',
    preservedText: 'The text may contain # signs and = characters.',
  },
  {
    relativePath: 'git/.gitconfig',
    expectedType: 'gitconfig',
    preservedText: '+refs/heads/*:refs/remotes/origin/*',
  },
  {
    relativePath: 'npm/.npmrc',
    expectedType: 'npmrc',
    preservedText: '${NPM_TOKEN}',
  },
  {
    relativePath: 'yaml/compose.yaml',
    expectedType: 'yaml',
    preservedText: 'block scalar # and = content must stay intact',
  },
  {
    relativePath: 'ignore/.gitignore',
    expectedType: 'ignore',
    preservedText: 'docs/generated\\ files/',
  },
  {
    relativePath: 'ignore/.cursorignore',
    expectedType: 'ignore',
    preservedText: '**/.cache/',
  },
  {
    relativePath: 'ignore/.vscodeignore',
    expectedType: 'ignore',
    preservedText: 'vitest.config.ts',
  },
  {
    relativePath: 'yarn/.yarnrc',
    expectedType: 'yarnrc',
    preservedText: '"./npm-packages-offline-cache"',
  },
  {
    relativePath: 'git/.gitattributes',
    expectedType: 'gitattributes',
    preservedText: 'docs/generated\\ files/**',
  },
  {
    relativePath: 'browserslist/.browserslistrc',
    expectedType: 'browserslist',
    preservedText: 'iOS_saf >= 16.4',
  },
  {
    relativePath: 'versions/.tool-versions',
    expectedType: 'versions',
    preservedText: 'nodejs 22.18.0',
  },
  {
    relativePath: 'versions/.nvmrc',
    expectedType: 'versions',
    preservedText: 'v22.18.0',
  },
  {
    relativePath: 'system/hosts',
    expectedType: 'hosts',
    preservedText: 'api.confetti.test',
  },
  {
    relativePath: 'system/fstab',
    expectedType: 'fstab',
    preservedText: '/mnt/source\\040files',
  },
  {
    relativePath: 'system/crontab',
    expectedType: 'crontab',
    preservedText: '"keep  two spaces"',
  },
  {
    relativePath: 'tmux/tmux.conf',
    expectedType: 'tmux',
    preservedText: '#{?window_zoomed_flag,ZOOM,}',
  },
  {
    relativePath: 'screen/.screenrc',
    expectedType: 'screen',
    preservedText: 'Wuff,  Wuff!!  ',
  },
  {
    relativePath: 'inputrc/.inputrc',
    expectedType: 'inputrc',
    preservedText: 'exchange-point-and-mark',
  },
  {
    relativePath: 'systemd/web.service',
    expectedType: 'systemd',
    preservedText: '"SECOND=2"',
  },
  {
    relativePath: 'systemd/backup.timer',
    expectedType: 'systemd',
    preservedText: 'OnCalendar=*-*-* 02:30:00',
  },
  { relativePath: 'unknown/application.conf' },
]

describe('manual examples', () => {
  it.each(examples)(
    '$relativePath detects as $expectedType and formats safely',
    ({ relativePath, expectedType, preservedText }) => {
      const filename = path.join(examplesDirectory, relativePath)
      const content = fs.readFileSync(filename, 'utf8')
      const detection = detectConfig(registry, filename, content)

      expect(detection?.definition.id).toBe(expectedType)
      if (!detection) return

      const formatted = formatConfig(
        registry,
        detection.definition.languageId,
        content,
      )
      expect(
        formatConfig(registry, detection.definition.languageId, formatted),
      ).toBe(formatted)
      if (preservedText) expect(formatted).toContain(preservedText)
    },
  )
})
