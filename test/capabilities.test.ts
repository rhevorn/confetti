import { describe, expect, it } from 'vitest'
import { createDefaultRegistry } from '../src/configs/index.js'
import {
  SNIPPET_FORMAT_IDS,
  computeFormatCapabilities,
} from '../src/features/capabilities.js'
import { DIAGNOSTIC_FORMAT_IDS } from '../src/features/diagnostics.js'
import {
  FOLDING_FORMAT_IDS,
  INI_SECTION_FORMATS,
} from '../src/features/folding.js'
import { SYMBOL_FORMAT_IDS } from '../src/features/symbols.js'

const registry = createDefaultRegistry()

describe('format capabilities', () => {
  it('derives folding support from the dispatch table', () => {
    expect([...FOLDING_FORMAT_IDS].sort()).toEqual(
      [
        ...INI_SECTION_FORMATS,
        'nginx',
        'caddy',
        'apache',
        'ssh',
        'toml',
      ].sort(),
    )
  })

  it('derives outline and diagnostic support from the dispatch tables', () => {
    expect([...SYMBOL_FORMAT_IDS].sort()).toEqual(
      [...INI_SECTION_FORMATS, 'nginx', 'caddy', 'ssh', 'toml'].sort(),
    )
    // A literal list on purpose: diagnostics are registered per format because
    // the INI dialects differ, so joining INI_SECTION_FORMATS must not
    // silently grant a new format the generic rule set.
    expect([...DIAGNOSTIC_FORMAT_IDS].sort()).toEqual(
      [
        'env',
        'gitconfig',
        'ini',
        'mysql',
        'pip',
        'properties',
        'pyini',
        'setupcfg',
        'systemd',
        'toml',
      ].sort(),
    )
  })

  it('only reports capabilities for registered formats', () => {
    const ids = new Set(registry.all().map(({ id }) => id))

    for (const set of [
      FOLDING_FORMAT_IDS,
      SYMBOL_FORMAT_IDS,
      DIAGNOSTIC_FORMAT_IDS,
      new Set(SNIPPET_FORMAT_IDS),
    ]) {
      for (const id of set) expect(ids.has(id)).toBe(true)
    }
  })

  it('describes every registered format', () => {
    const capabilities = computeFormatCapabilities(registry.all())

    expect(capabilities).toHaveLength(registry.all().length)
    expect(capabilities.find(({ id }) => id === 'nginx')).toEqual({
      id: 'nginx',
      displayName: 'Nginx',
      formatting: true,
      folding: true,
      symbols: true,
      diagnostics: false,
      snippets: true,
    })
    expect(capabilities.find(({ id }) => id === 'properties')).toEqual({
      id: 'properties',
      displayName: 'Java Properties',
      formatting: true,
      folding: false,
      symbols: false,
      diagnostics: true,
      snippets: false,
    })
    expect(capabilities.find(({ id }) => id === 'yaml')).toEqual({
      id: 'yaml',
      displayName: 'YAML',
      formatting: false,
      folding: false,
      symbols: false,
      diagnostics: false,
      snippets: false,
    })
  })
})
