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

  it('keeps canonical YAML, INI, and Properties file associations available', () => {
    for (const id of ['confetti-yaml', 'confetti-ini', 'confetti-properties']) {
      const language = manifest.contributes.languages.find(
        (item) => item.id === id,
      )
      expect(language?.filenames).toBeUndefined()
      expect(language?.extensions).toBeUndefined()
    }
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
      expect.arrayContaining(['dist', 'syntaxes', 'language-configurations']),
    )
  })
})
