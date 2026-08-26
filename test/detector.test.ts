import { describe, expect, it } from 'vitest'
import { createDefaultRegistry } from '../src/configs/index.js'
import { MIN_CONFIDENCE } from '../src/core/constants.js'
import { detectConfig } from '../src/core/detector.js'

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
    ['yaml', '/app/compose.yaml', 'services:\n  web:\n    image: nginx\n'],
  ])('detects %s configuration', (expected, filename, content) => {
    expect(detectConfig(registry, filename, content)?.definition.id).toBe(
      expected,
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

  it('does not force a low-confidence result', () => {
    expect(
      detectConfig(registry, '/srv/application.conf', 'feature.color=blue\n'),
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
})
