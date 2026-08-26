import { describe, expect, it } from 'vitest'
import { isCompatibleLanguageId } from '../src/language-compatibility.js'

describe('language compatibility', () => {
  it.each([
    ['yaml', 'confetti-yaml', 'yaml'],
    ['yaml', 'confetti-yaml', 'dockercompose'],
    ['ini', 'confetti-ini', 'ini'],
    ['ini', 'confetti-ini', 'properties'],
    ['properties', 'confetti-properties', 'properties'],
  ])('keeps the canonical %s language tooling active', (id, own, current) => {
    expect(isCompatibleLanguageId(id, own, current)).toBe(true)
  })

  it('switches an unrelated language to the detected Confetti language', () => {
    expect(isCompatibleLanguageId('yaml', 'confetti-yaml', 'plaintext')).toBe(
      false,
    )
  })
})
