import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  Registry,
  parseRawGrammar,
  type IGrammar,
  type IRawTheme,
} from 'vscode-textmate'
import { loadWASM, createOnigScanner, createOnigString } from 'vscode-oniguruma'

const bytes = fs.readFileSync('node_modules/vscode-oniguruma/release/onig.wasm')
const onigLib = loadWASM(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
).then(() => ({ createOnigScanner, createOnigString }))
const fixtures = JSON.parse(
  fs.readFileSync('test/fixtures/theme-key-colors.json', 'utf8'),
) as { themes: Record<string, IRawTheme> }

async function grammarFor(id: string, theme?: IRawTheme) {
  const filename = path.resolve(`syntaxes/${id}.tmLanguage.json`)
  const raw = parseRawGrammar(fs.readFileSync(filename, 'utf8'), filename)
  const registry = new Registry({
    onigLib,
    theme,
    loadGrammar: async () => raw,
  })
  const grammar = await registry.loadGrammar(raw.scopeName)
  if (!grammar) throw new Error(id)
  return { registry, grammar }
}

function scopesAt(grammar: IGrammar, line: string, column: number): string[] {
  return grammar
    .tokenizeLine(line)
    .tokens.find(
      (token) => token.startIndex <= column && token.endIndex > column,
    )!.scopes
}

describe('key theme compatibility', () => {
  for (const [themeName, theme] of Object.entries(fixtures.themes)) {
    it(`${themeName}: all assignment-key grammars distinguish keys from values and ordinary variables`, async () => {
      const ids = fs
        .readdirSync('syntaxes')
        .filter((name) =>
          fs
            .readFileSync(`syntaxes/${name}`, 'utf8')
            .includes('support.type.property-name.'),
        )
        .map((name) => name.replace('.tmLanguage.json', ''))
      expect(ids.length).toBeGreaterThanOrEqual(13)
      for (const id of ids) {
        const { registry, grammar } = await grammarFor(id, theme)
        try {
          const line = id === 'yarnrc' ? 'name "value"' : 'name = "value"'
          const tokens = grammar.tokenizeLine2(line).tokens
          function colorAt(column: number): string {
            let metadata = tokens[1]
            for (let index = 0; index < tokens.length; index += 2) {
              if (tokens[index] > column) break
              metadata = tokens[index + 1]
            }
            return registry.getColorMap()[(metadata >>> 15) & 0x1ff]
          }
          const keyColor = colorAt(0)
          expect(scopesAt(grammar, line, 0)).toContain(
            `support.type.property-name.${id}`,
          )
          expect(keyColor, `${themeName}/${id}: key vs value`).not.toBe(
            colorAt(line.indexOf('value')),
          )
          // The last general variable.other rule is what made 2026 keys look
          // like ordinary code. Verify we no longer resolve to that color.
          const ordinary = theme.settings
            .filter((rule) =>
              (Array.isArray(rule.scope) ? rule.scope : [rule.scope]).includes(
                'variable.other',
              ),
            )
            .at(-1)?.settings.foreground
          if (ordinary)
            expect(keyColor.toLowerCase(), `${themeName}/${id}`).not.toBe(
              ordinary.toLowerCase(),
            )
        } finally {
          registry.dispose()
        }
      }
    })
  }
})

describe('key positions rather than whole-line scope presence', () => {
  it('recognizes each key in the reported project table and no keys inside array strings', async () => {
    const { registry, grammar } = await grammarFor('toml')
    try {
      let state
      const lines = [
        '# Tables and scalar values',
        '',
        '[project]',
        'name = "confetti-demo"',
        'version = "0.1.0"',
        'requires-python = ">=3.12"',
        'keywords = ["config", "formatter", "highlighting"]',
        'classifiers = [',
        '"Development Status :: 3 - Alpha",',
        '',
        '',
        '',
        '',
        '"Programming Language :: Python :: 3", # supported runtime',
        ']',
      ]
      for (const [index, line] of lines.entries()) {
        const result = grammar.tokenizeLine(line, state)
        state = result.ruleStack
        const keys = result.tokens
          .filter((token) =>
            token.scopes.includes('support.type.property-name.toml'),
          )
          .map((token) => line.slice(token.startIndex, token.endIndex))
        expect(keys, line).toEqual(
          index >= 3 && index <= 7 ? [line.split(' =')[0]] : [],
        )
      }
    } finally {
      registry.dispose()
    }
  })

  it.each([
    'registry',
    '@scope:registry',
    '//registry.npmjs.org/:_authToken',
    '//host:4873/path/:always-auth',
    'key[]',
    '@scope:key[]',
  ])('recognizes npmrc key %s completely', async (key) => {
    const { registry, grammar } = await grammarFor('npmrc')
    try {
      const line = `${key}=value`
      for (let column = 0; column < key.length; column++)
        expect(scopesAt(grammar, line, column)).toContain(
          'support.type.property-name.npmrc',
        )
      expect(scopesAt(grammar, line, line.length - 1)).not.toContain(
        'support.type.property-name.npmrc',
      )
    } finally {
      registry.dispose()
    }
  })

  it('recognizes nested TOML inline keys, including quoted and dotted keys, without coloring literal text as keys', async () => {
    const { registry, grammar } = await grammarFor('toml')
    try {
      const line =
        'db = { host = "key = not a key", nested = { "quoted.key" = 1, dot.key = true }, rows = [{ port = 80 }] }'
      for (const key of [
        'db',
        'host',
        'nested',
        '"quoted.key"',
        'dot.key',
        'rows',
        'port',
      ])
        expect(scopesAt(grammar, line, line.indexOf(key))).toContain(
          'support.type.property-name.toml',
        )
      expect(scopesAt(grammar, line, line.indexOf('not a key'))).not.toContain(
        'support.type.property-name.toml',
      )
      expect(scopesAt(grammar, '# fake = value', 3)).not.toContain(
        'support.type.property-name.toml',
      )
    } finally {
      registry.dispose()
    }
  })

  it.each([
    '  - name: api',
    '- "quoted key": value',
    '  - - port: 8080',
    '    nested: value',
  ])('recognizes YAML mapping key at its actual position: %s', async (line) => {
    const { registry, grammar } = await grammarFor('yaml')
    try {
      const column = line.search(/name|quoted|port|nested/)
      expect(scopesAt(grammar, line, column)).toContain('entity.name.tag.yaml')
      expect(scopesAt(grammar, line, line.length - 1)).not.toContain(
        'entity.name.tag.yaml',
      )
    } finally {
      registry.dispose()
    }
  })
})
