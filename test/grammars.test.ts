import fs from 'node:fs'
import path from 'node:path'
import { createOnigScanner, createOnigString, loadWASM } from 'vscode-oniguruma'
import { parseRawGrammar, Registry, type IGrammar } from 'vscode-textmate'
import { describe, expect, it } from 'vitest'

const syntaxDirectory = path.join(process.cwd(), 'syntaxes')
const wasmPath = path.join(
  process.cwd(),
  'node_modules/vscode-oniguruma/release/onig.wasm',
)
const wasm = fs.readFileSync(wasmPath)
const onigLib = loadWASM(
  wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength),
).then(() => ({ createOnigScanner, createOnigString }))

async function loadGrammar(filename: string): Promise<IGrammar> {
  const grammarPath = path.join(syntaxDirectory, filename)
  const rawGrammar = parseRawGrammar(
    fs.readFileSync(grammarPath, 'utf8'),
    grammarPath,
  )
  const registry = new Registry({
    onigLib,
    loadGrammar: async (scopeName) =>
      scopeName === rawGrammar.scopeName ? rawGrammar : null,
  })
  const grammar = await registry.loadGrammar(rawGrammar.scopeName)
  if (!grammar) throw new Error(`Could not load ${filename}`)
  return grammar
}

async function scopesForLine(
  filename: string,
  line: string,
): Promise<string[]> {
  const grammar = await loadGrammar(filename)
  return grammar.tokenizeLine(line).tokens.flatMap((token) => token.scopes)
}

describe('TextMate grammars', () => {
  for (const filename of fs.readdirSync(syntaxDirectory)) {
    if (!filename.endsWith('.tmLanguage.json')) continue

    it(`${filename} is self-contained valid JSON`, () => {
      const grammar = JSON.parse(
        fs.readFileSync(path.join(syntaxDirectory, filename), 'utf8'),
      ) as { scopeName?: string; patterns?: unknown[]; $schema?: string }

      expect(grammar.scopeName).toMatch(/^source\.confetti\./)
      expect(grammar.patterns?.length).toBeGreaterThan(0)
      expect(grammar.$schema).toBeUndefined()
    })
  }

  it('gives dotenv keys, operators, and values distinct scopes', () => {
    const grammar = JSON.parse(
      fs.readFileSync(
        path.join(syntaxDirectory, 'env.tmLanguage.json'),
        'utf8',
      ),
    ) as {
      patterns: Array<{
        beginCaptures?: Record<string, { name: string }>
        contentName?: string
      }>
    }
    const assignment = grammar.patterns.find(
      (pattern) => pattern.contentName === 'string.unquoted.env',
    )

    expect(assignment?.beginCaptures?.['2']?.name).toBe(
      'variable.other.assignment.env',
    )
    expect(assignment?.beginCaptures?.['3']?.name).toBe(
      'keyword.operator.assignment.env',
    )
    expect(assignment?.contentName).toBe('string.unquoted.env')
  })

  it('gives Git Config subsections a structural scope', () => {
    const grammar = fs.readFileSync(
      path.join(syntaxDirectory, 'gitconfig.tmLanguage.json'),
      'utf8',
    )
    expect(grammar).toContain('entity.name.section.subsection.gitconfig')
  })

  it('gives properties keys and values distinct scopes', () => {
    const grammar = fs.readFileSync(
      path.join(syntaxDirectory, 'properties.tmLanguage.json'),
      'utf8',
    )
    expect(grammar).toContain('variable.other.assignment.properties')
    expect(grammar).toContain('string.unquoted.properties')
    expect(grammar).toContain('string.unquoted.continuation.properties')
  })

  it('tokenizes dotenv keys, operators, values, and variables', async () => {
    const scopes = await scopesForLine(
      'env.tmLanguage.json',
      'API_URL="https://${HOST}/v1"',
    )
    expect(scopes).toContain('variable.other.assignment.env')
    expect(scopes).toContain('keyword.operator.assignment.env')
    expect(scopes).toContain('string.quoted.double.env')
    expect(scopes).toContain('variable.other.braced.env')
  })

  it('tokenizes properties keys and values with distinct scopes', async () => {
    const scopes = await scopesForLine(
      'properties.tmLanguage.json',
      'server.port=8080',
    )
    expect(scopes).toContain('variable.other.assignment.properties')
    expect(scopes).toContain('keyword.operator.assignment.properties')
    expect(scopes).toContain('string.unquoted.properties')
    expect(scopes).toContain('constant.numeric.properties')
  })

  it('tokenizes Git Config sections and subsections', async () => {
    const scopes = await scopesForLine(
      'gitconfig.tmLanguage.json',
      '[remote "origin"]',
    )
    expect(scopes).toContain('entity.name.section.gitconfig')
    expect(scopes).toContain('entity.name.section.subsection.gitconfig')
  })

  it('tokenizes Nginx directives, variables, numbers, and blocks', async () => {
    const directiveScopes = await scopesForLine(
      'nginx.tmLanguage.json',
      'set $target 8080;',
    )
    const blockScopes = await scopesForLine(
      'nginx.tmLanguage.json',
      'location /api {',
    )
    expect(directiveScopes).toContain('keyword.other.directive.nginx')
    expect(directiveScopes).toContain('variable.other.nginx')
    expect(directiveScopes).toContain('constant.numeric.nginx')
    expect(blockScopes).toContain('keyword.control.nginx')
  })

  it('tokenizes SSH blocks, directives, paths, and placeholders', async () => {
    const hostScopes = await scopesForLine('ssh.tmLanguage.json', 'Host work')
    const directiveScopes = await scopesForLine(
      'ssh.tmLanguage.json',
      'User %r',
    )
    const pathScopes = await scopesForLine(
      'ssh.tmLanguage.json',
      'IdentityFile ~/.ssh/id_ed25519',
    )
    expect(hostScopes).toContain('keyword.control.ssh-config')
    expect(hostScopes).toContain('entity.name.section.ssh-config')
    expect(directiveScopes).toContain('keyword.other.directive.ssh-config')
    expect(directiveScopes).toContain('variable.other.ssh-config')
    expect(pathScopes).toContain('string.unquoted.path.ssh-config')
  })

  it('tokenizes INI sections, keys, operators, booleans, and numbers', async () => {
    const sectionScopes = await scopesForLine('ini.tmLanguage.json', '[server]')
    const valueScopes = await scopesForLine(
      'ini.tmLanguage.json',
      'enabled = true 8080',
    )
    expect(sectionScopes).toContain('entity.name.section.ini')
    expect(valueScopes).toContain('variable.other.assignment.ini')
    expect(valueScopes).toContain('keyword.operator.assignment.ini')
    expect(valueScopes).toContain('constant.language.boolean.ini')
    expect(valueScopes).toContain('constant.numeric.ini')
  })

  it('tokenizes npmrc scoped keys, URLs, and environment variables', async () => {
    const keyScopes = await scopesForLine(
      'npmrc.tmLanguage.json',
      '@scope:registry=https://registry.example.test/',
    )
    const variableScopes = await scopesForLine(
      'npmrc.tmLanguage.json',
      '_authToken=${NPM_TOKEN}',
    )
    expect(keyScopes).toContain('variable.other.assignment.npmrc')
    expect(keyScopes).toContain('keyword.operator.assignment.npmrc')
    expect(keyScopes).toContain('string.unquoted.url.npmrc')
    expect(variableScopes).toContain('variable.other.npmrc')
  })

  it('tokenizes TOML tables, keys, strings, dates, booleans, and numbers', async () => {
    const tableScopes = await scopesForLine(
      'toml.tmLanguage.json',
      '[[products]]',
    )
    const valueScopes = await scopesForLine(
      'toml.tmLanguage.json',
      'released = 2026-08-26T12:30:00Z',
    )
    const mixedScopes = await scopesForLine(
      'toml.tmLanguage.json',
      'enabled = true # 42',
    )
    expect(tableScopes).toContain('entity.name.section.toml')
    expect(valueScopes).toContain('variable.other.assignment.toml')
    expect(valueScopes).toContain('keyword.operator.assignment.toml')
    expect(valueScopes).toContain('constant.numeric.datetime.toml')
    expect(mixedScopes).toContain('constant.language.boolean.toml')
    expect(mixedScopes).toContain('comment.line.number-sign.toml')
  })

  it('tokenizes YAML keys, sequences, block indicators, anchors, and aliases', async () => {
    const mappingScopes = await scopesForLine(
      'yaml.tmLanguage.json',
      'enabled: true',
    )
    const sequenceScopes = await scopesForLine(
      'yaml.tmLanguage.json',
      '- &default value',
    )
    const aliasScopes = await scopesForLine(
      'yaml.tmLanguage.json',
      'copy: *default',
    )
    const blockScopes = await scopesForLine(
      'yaml.tmLanguage.json',
      'description: |2-',
    )
    expect(mappingScopes).toContain('entity.name.tag.yaml')
    expect(mappingScopes).toContain('punctuation.separator.key-value.yaml')
    expect(mappingScopes).toContain('constant.language.boolean.yaml')
    expect(sequenceScopes).toContain(
      'punctuation.definition.sequence.item.yaml',
    )
    expect(sequenceScopes).toContain('entity.name.type.anchor.yaml')
    expect(aliasScopes).toContain('variable.other.alias.yaml')
    expect(blockScopes).toContain('keyword.control.block-scalar.yaml')
  })
})
