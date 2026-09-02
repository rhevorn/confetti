import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createDefaultRegistry } from '../src/configs/index.js'

interface SnippetContribution {
  language: string
  path: string
}

interface Snippet {
  prefix: string
  body: string[]
  description: string
}

interface ExtensionManifest {
  contributes: { snippets: SnippetContribution[] }
}

const root = process.cwd()
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
) as ExtensionManifest

function contributedPath(relativePath: string): string {
  return path.join(root, relativePath.replace(/^\.\//, ''))
}

describe('VS Code snippet contributions', () => {
  const contributions = manifest.contributes.snippets

  it('contributes snippets only for registered languages', () => {
    expect(contributions).toHaveLength(1)
    const languageIds = new Set(
      createDefaultRegistry()
        .all()
        .map(({ languageId }) => languageId),
    )
    for (const { language, path: snippetPath } of contributions) {
      expect(languageIds.has(language)).toBe(true)
      expect(fs.existsSync(contributedPath(snippetPath))).toBe(true)
    }
  })

  it('defines parseable snippets with unique prefixes', () => {
    const snippets = JSON.parse(
      fs.readFileSync(contributedPath(contributions[0]!.path), 'utf8'),
    ) as Record<string, Snippet>

    expect(Object.keys(snippets).length).toBeGreaterThan(0)
    const prefixes = Object.values(snippets).map(({ prefix }) => prefix)
    expect(new Set(prefixes).size).toBe(prefixes.length)

    for (const snippet of Object.values(snippets)) {
      expect(snippet.prefix).toBeTruthy()
      expect(snippet.body.length).toBeGreaterThan(0)
      expect(snippet.description).toBeTruthy()
    }
  })

  it('escapes nginx variables so they are not treated as snippet variables', () => {
    for (const { path: snippetPath } of contributions) {
      const source = fs.readFileSync(contributedPath(snippetPath), 'utf8')
      expect(source).not.toMatch(/[^\\]\$[A-Za-z]/)
    }
  })
})
