import { describe, expect, it } from 'vitest'
import { ConfigRegistry } from '../src/core/registry.js'
import type { ConfigDefinition } from '../src/core/types.js'

function definition(
  id: string,
  languageId = `confetti-${id}`,
): ConfigDefinition {
  return { id, displayName: id.toUpperCase(), languageId }
}

describe('ConfigRegistry', () => {
  it('registers definitions in insertion order and finds them by both IDs', () => {
    const registry = new ConfigRegistry()
    const first = definition('first')
    const second = definition('second', 'custom-language')

    registry.register(first)
    registry.register(second)

    expect(registry.all()).toEqual([first, second])
    expect(registry.get('first')).toBe(first)
    expect(registry.getByLanguageId('custom-language')).toBe(second)
    expect(registry.get('missing')).toBeUndefined()
    expect(registry.getByLanguageId('missing')).toBeUndefined()
  })

  it('rejects duplicate config IDs even when language IDs differ', () => {
    const registry = new ConfigRegistry()
    registry.register(definition('same'))

    expect(() => registry.register(definition('same', 'another'))).toThrow(
      'Config definition already registered: same',
    )
  })

  it('returns a snapshot that cannot mutate registry membership', () => {
    const registry = new ConfigRegistry()
    registry.register(definition('kept'))

    registry.all().length = 0

    expect(registry.all()).toHaveLength(1)
  })
})
