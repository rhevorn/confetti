import type { ConfigDefinition } from '../core/types.js'
import { DIAGNOSTIC_FORMAT_IDS } from './diagnostics.js'
import { FOLDING_FORMAT_IDS } from './folding.js'
import { SYMBOL_FORMAT_IDS } from './symbols.js'

/**
 * Formats that ship snippet files. Snippets are declared in package.json, so
 * they have no code-level source of truth; test/manifest.test.ts keeps this
 * list synchronized with the contributed files.
 */
export const SNIPPET_FORMAT_IDS: readonly string[] = ['nginx']

export interface FormatCapabilities {
  id: string
  displayName: string
  formatting: boolean
  folding: boolean
  symbols: boolean
  diagnostics: boolean
  snippets: boolean
}

export function computeFormatCapabilities(
  definitions: readonly ConfigDefinition[],
): FormatCapabilities[] {
  return definitions.map(({ id, displayName, formatter }) => ({
    id,
    displayName,
    formatting: formatter !== undefined,
    folding: FOLDING_FORMAT_IDS.has(id),
    symbols: SYMBOL_FORMAT_IDS.has(id),
    diagnostics: DIAGNOSTIC_FORMAT_IDS.has(id),
    snippets: SNIPPET_FORMAT_IDS.includes(id),
  }))
}
