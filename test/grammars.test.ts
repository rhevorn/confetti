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
})
