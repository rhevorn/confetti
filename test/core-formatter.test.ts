import { describe, expect, it, vi } from 'vitest'
import { formatConfig } from '../src/core/formatter.js'
import { ConfigRegistry } from '../src/core/registry.js'

describe('formatConfig', () => {
  it('routes content to the formatter registered for a language ID', () => {
    const registry = new ConfigRegistry()
    const formatter = vi.fn((content: string) => content.toUpperCase())
    registry.register({
      id: 'custom',
      displayName: 'Custom',
      languageId: 'confetti-custom',
      formatter,
    })

    expect(formatConfig(registry, 'confetti-custom', 'value')).toBe('VALUE')
    expect(formatter).toHaveBeenCalledOnce()
    expect(formatter).toHaveBeenCalledWith('value')
  })

  it('returns content unchanged for unknown and non-formattable languages', () => {
    const registry = new ConfigRegistry()
    registry.register({
      id: 'read-only',
      displayName: 'Read Only',
      languageId: 'confetti-read-only',
    })

    expect(formatConfig(registry, 'missing', 'keep')).toBe('keep')
    expect(formatConfig(registry, 'confetti-read-only', 'keep')).toBe('keep')
  })

  it('propagates formatter failures instead of silently changing content', () => {
    const registry = new ConfigRegistry()
    registry.register({
      id: 'broken',
      displayName: 'Broken',
      languageId: 'confetti-broken',
      formatter: () => {
        throw new Error('invalid formatter state')
      },
    })

    expect(() => formatConfig(registry, 'confetti-broken', 'value')).toThrow(
      'invalid formatter state',
    )
  })
})
