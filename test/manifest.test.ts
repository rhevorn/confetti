import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createDefaultRegistry } from '../src/configs/index.js'

interface LanguageContribution {
  id: string
  filenames?: string[]
  extensions?: string[]
  configuration: string
}

interface GrammarContribution {
  language: string
  scopeName: string
  path: string
}

interface CommandContribution {
  command: string
}

interface ExtensionManifest {
  version: string
  publisher: string
  icon: string
  repository: { type: string; url: string }
  homepage: string
  bugs: { url: string }
  galleryBanner: { color: string; theme: string }
  pricing: string
  main: string
  activationEvents: string[]
  files: string[]
  contributes: {
    commands: CommandContribution[]
    configuration: { properties: Record<string, unknown> }
    languages: LanguageContribution[]
    grammars: GrammarContribution[]
  }
}

const root = process.cwd()
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
) as ExtensionManifest

function contributedPath(relativePath: string): string {
  return path.join(root, relativePath.replace(/^\.\//, ''))
}

describe('VS Code extension manifest', () => {
  it('contains complete Marketplace metadata for the stable release', () => {
    expect(manifest.version).toBe('1.1.0')
    expect(manifest.publisher).toBe('rhevorn')
    expect(manifest.repository).toEqual({
      type: 'git',
      url: 'https://github.com/rhevorn/confetti.git',
    })
    expect(manifest.homepage).toBe('https://github.com/rhevorn/confetti#readme')
    expect(manifest.bugs.url).toBe('https://github.com/rhevorn/confetti/issues')
    expect(manifest.galleryBanner).toEqual({
      color: '#161B4F',
      theme: 'dark',
    })
    expect(manifest.pricing).toBe('Free')
  })

  it('uses a valid 256 px PNG Marketplace icon', () => {
    expect(manifest.icon).toBe('images/icon.png')
    const icon = fs.readFileSync(contributedPath(manifest.icon))

    expect(icon.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
    expect(icon.readUInt32BE(16)).toBe(256)
    expect(icon.readUInt32BE(20)).toBe(256)
  })

  it('declares every command and relies on generated command activation events', () => {
    expect(
      manifest.contributes.commands.map(({ command }) => command).sort(),
    ).toEqual([
      'confetti.detectConfigType',
      'confetti.formatConfig',
      'confetti.showDetectionInfo',
      'confetti.showOutput',
    ])
    expect(manifest.activationEvents).toEqual(['onStartupFinished'])
  })

  it('keeps the public settings intentionally small', () => {
    expect(
      Object.keys(manifest.contributes.configuration.properties).sort(),
    ).toEqual(['confetti.autoDetect', 'confetti.format.enable'])
  })

  it('registers one language and one grammar for every config definition', () => {
    const definitions = createDefaultRegistry().all()
    const languageIds = manifest.contributes.languages.map(({ id }) => id)
    const grammarLanguageIds = manifest.contributes.grammars.map(
      ({ language }) => language,
    )

    expect(new Set(languageIds).size).toBe(languageIds.length)
    expect(new Set(grammarLanguageIds).size).toBe(grammarLanguageIds.length)
    expect(languageIds.sort()).toEqual(
      definitions.map(({ languageId }) => languageId).sort(),
    )
    expect(grammarLanguageIds.sort()).toEqual(languageIds.sort())
  })

  it('keeps highlighting-only formats without Confetti formatters', () => {
    const definitions = createDefaultRegistry().all()

    for (const id of ['yaml', 'ignore', 'versions']) {
      const definition = definitions.find((item) => item.id === id)
      expect(definition?.languageId).toBe(`confetti-${id}`)
      expect(definition?.formatter).toBeUndefined()
    }
  })

  it('keeps canonical YAML, INI, and Properties file associations available', () => {
    for (const id of ['confetti-yaml', 'confetti-ini', 'confetti-properties']) {
      const language = manifest.contributes.languages.find(
        (item) => item.id === id,
      )
      expect(language?.filenames).toBeUndefined()
      expect(language?.extensions).toBeUndefined()
    }
  })

  it('contributes the complete Ignore and tool-version filename families', () => {
    const filenamesFor = (id: string) =>
      manifest.contributes.languages.find((item) => item.id === id)?.filenames

    expect(filenamesFor('confetti-ignore')).toEqual([
      '.gitignore',
      '.dockerignore',
      '.npmignore',
      '.prettierignore',
      '.eslintignore',
      '.stylelintignore',
      '.helmignore',
      '.ignore',
    ])
    expect(filenamesFor('confetti-versions')).toEqual([
      '.nvmrc',
      '.node-version',
      '.python-version',
      '.ruby-version',
      '.tool-versions',
    ])
  })

  it('references valid language configurations and matching grammars', () => {
    for (const language of manifest.contributes.languages) {
      expect(fs.existsSync(contributedPath(language.configuration))).toBe(true)
      expect(() =>
        JSON.parse(
          fs.readFileSync(contributedPath(language.configuration), 'utf8'),
        ),
      ).not.toThrow()
    }

    for (const contribution of manifest.contributes.grammars) {
      const grammar = JSON.parse(
        fs.readFileSync(contributedPath(contribution.path), 'utf8'),
      ) as { scopeName: string }
      expect(grammar.scopeName).toBe(contribution.scopeName)
    }
  })

  it('uses format-specific editor behavior for Nginx and SSH', () => {
    const configurationFor = (languageId: string) => {
      const language = manifest.contributes.languages.find(
        ({ id }) => id === languageId,
      )
      if (!language) throw new Error(`Missing language: ${languageId}`)
      return JSON.parse(
        fs.readFileSync(contributedPath(language.configuration), 'utf8'),
      ) as { brackets?: string[][]; comments?: { lineComment?: string } }
    }

    const nginx = configurationFor('confetti-nginx')
    const ssh = configurationFor('confetti-ssh')
    expect(nginx.comments?.lineComment).toBe('#')
    expect(nginx.brackets).toContainEqual(['{', '}'])
    expect(ssh.comments?.lineComment).toBe('#')
    expect(ssh.brackets).toBeUndefined()
  })

  it('contributes every syntax file exactly once and packages runtime assets', () => {
    const syntaxFiles = fs
      .readdirSync(path.join(root, 'syntaxes'))
      .filter((filename) => filename.endsWith('.tmLanguage.json'))
      .map((filename) => `./syntaxes/${filename}`)
      .sort()
    expect(
      manifest.contributes.grammars
        .map(({ path: grammarPath }) => grammarPath)
        .sort(),
    ).toEqual(syntaxFiles)
    expect(manifest.main).toBe('./dist/extension.js')
    expect(manifest.files).toEqual(
      expect.arrayContaining([
        'dist',
        'syntaxes',
        'language-configurations',
        'CHANGELOG.md',
        'images/icon.png',
      ]),
    )
  })
})
