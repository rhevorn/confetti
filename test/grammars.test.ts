import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const syntaxDirectory = path.join(process.cwd(), 'syntaxes')

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
})
