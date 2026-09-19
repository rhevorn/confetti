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

function readSnippets(snippetPath: string): Record<string, Snippet> {
  return JSON.parse(
    fs.readFileSync(contributedPath(snippetPath), 'utf8'),
  ) as Record<string, Snippet>
}

/** Backslashes directly before `index`, which decide whether a `$` is escaped. */
function precedingBackslashes(text: string, index: number): number {
  let count = 0
  for (
    let cursor = index - 1;
    cursor >= 0 && text[cursor] === '\\';
    cursor -= 1
  ) {
    count += 1
  }
  return count
}

describe('VS Code snippet contributions', () => {
  const contributions = manifest.contributes.snippets

  it('contributes snippets only for registered languages', () => {
    expect(contributions).toHaveLength(6)
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

  it('defines parseable snippets with unique prefixes per language', () => {
    // VS Code merges every file that contributes to one language, so a prefix
    // must be unique across those files and not only within a single one.
    const prefixesByLanguage = new Map<string, string[]>()

    for (const { language, path: snippetPath } of contributions) {
      const snippets = readSnippets(snippetPath)
      expect(Object.keys(snippets).length).toBeGreaterThan(0)

      const prefixes = prefixesByLanguage.get(language) ?? []
      for (const snippet of Object.values(snippets)) {
        expect(snippet.prefix).toBeTruthy()
        expect(snippet.body.length).toBeGreaterThan(0)
        expect(snippet.description).toBeTruthy()
        prefixes.push(snippet.prefix)
      }
      prefixesByLanguage.set(language, prefixes)
    }

    for (const prefixes of prefixesByLanguage.values()) {
      expect(new Set(prefixes).size).toBe(prefixes.length)
    }
  })

  it('escapes every literal dollar so VS Code does not expand it', () => {
    // The snippet parser reads the decoded body, so check that rather than the
    // JSON source, where doubled backslashes hide even-length escape runs.
    for (const { path: snippetPath } of contributions) {
      for (const snippet of Object.values(readSnippets(snippetPath))) {
        for (const line of snippet.body) {
          for (const match of line.matchAll(/\$/g)) {
            const index = match.index ?? 0
            const isPlaceholder = /^\{\d+[:}]/.test(line.slice(index + 1))
            expect(
              precedingBackslashes(line, index) % 2 === 1 || isPlaceholder,
              `unescaped dollar in ${snippetPath}: ${line}`,
            ).toBe(true)
          }
        }
      }
    }
  })
})
