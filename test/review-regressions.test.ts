import { performance } from 'node:perf_hooks'
import { describe, expect, it } from 'vitest'
import { envRecords } from '../src/tokenizers/env.js'
import { decodeTomlKey } from '../src/tokenizers/toml-string.js'
import { computeDocumentSymbols } from '../src/features/symbols.js'
import { computeDiagnostics } from '../src/features/diagnostics.js'

describe('dotenv short-line performance regression', () => {
  it('scans a 1 MB quoted value without repeatedly rebuilding its prefix', () => {
    const lines = [
      'KEY="',
      ...Array<string>(116509).fill('12345678'),
      '"',
      'AFTER=ok',
    ]
    envRecords(['KEY="', 'warmup', '"'])
    const start = performance.now()
    const records = envRecords(lines)
    const elapsed = performance.now() - start
    expect(records).toHaveLength(2)
    expect(records[0].text).toBe(lines.slice(0, -1).join('\n'))
    expect(records[1]).toEqual({
      text: 'AFTER=ok',
      line: lines.length - 1,
      multiline: false,
    })
    // Generous ceiling, aimed at the former seconds-long quadratic path,
    // rather than a microbenchmark or a user-facing performance guarantee.
    expect(elapsed).toBeLessThan(1000)
  })

  it('retains escaped quotes and empty physical lines across records', () => {
    const lines = ['KEY="first\\', '', 'a\\"b', 'last"', 'NEXT=1']
    expect(envRecords(lines)).toEqual([
      { text: lines.slice(0, 4).join('\n'), line: 0, multiline: true },
      { text: 'NEXT=1', line: 4, multiline: false },
    ])
  })
})

describe('TOML key decoding', () => {
  it.each([
    ['"\\U00000061"', 'a'],
    ['"\\u0061"', 'a'],
    ['"\\U0001F600"', '😀'],
    ['"😀"', '😀'],
    ['""', ''],
    ['"a\tb"', 'a\tb'],
    ['"\\b\\t\\n\\f\\r\\"\\\\"', '\b\t\n\f\r"\\'],
  ])('decodes %s', (source, expected) => {
    expect(decodeTomlKey(source)).toBe(expected)
  })

  it.each([
    '"\\U00110000"',
    '"\\uD800"',
    '"\\U0000DFFF"',
    '"\\u12"',
    '"\\U0000zzzz"',
    '"\\/"',
    '"\\q"',
    '"a\nb"',
    '"a\u007fb"',
    '"a"b"',
    '"\ud800"',
  ])('rejects invalid key escape or character %s', (source) => {
    expect(decodeTomlKey(source)).toBeUndefined()
  })

  it('includes escaped table names in outlines and detects their equivalent duplicate', () => {
    const source = '["\\U00000061"]\nx=1\n[a]\ny=2\n'
    expect(
      computeDocumentSymbols('toml', source).map((symbol) => symbol.startLine),
    ).toEqual([0, 2])
    expect(computeDiagnostics('toml', source)).toEqual([
      {
        message: 'Duplicate table "a" (also defined on line 1)',
        line: 2,
        startCharacter: 0,
        endCharacter: 3,
      },
    ])
  })

  it('shares decoded names with array-of-table scopes', () => {
    const source =
      '[["\\U00000061"]]\n[a.meta]\nx=1\n[[a]]\n["\\u0061".meta]\nx=2\n'
    expect(computeDiagnostics('toml', source)).toEqual([])
    expect(computeDiagnostics('toml', source + '[a.meta]\n')).toHaveLength(1)
  })
})
