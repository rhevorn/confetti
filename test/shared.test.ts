import { describe, expect, it } from 'vitest'
import {
  endsWithContinuation,
  joinLines,
  normalizeLines,
  splitAssignment,
} from '../src/formatters/shared.js'

describe('line normalization', () => {
  it.each([
    ['LF with final newline', 'a\nb\n', ['a', 'b'], true],
    ['CRLF with final newline', 'a\r\nb\r\n', ['a', 'b'], true],
    ['standalone CR', 'a\rb', ['a', 'b'], false],
    ['no final newline', 'a\nb', ['a', 'b'], false],
    ['empty content', '', [''], false],
  ])('%s', (_name, input, lines, hasFinalNewline) => {
    expect(normalizeLines(input)).toEqual({ lines, hasFinalNewline })
  })

  it('joins lines while preserving the requested final newline policy', () => {
    expect(joinLines(['a', 'b'], true)).toBe('a\nb\n')
    expect(joinLines(['a', 'b'], false)).toBe('a\nb')
    expect(joinLines([], true)).toBe('\n')
  })
})

describe('endsWithContinuation', () => {
  it('is true only for an odd number of trailing backslashes', () => {
    expect(endsWithContinuation('')).toBe(false)
    expect(endsWithContinuation('value')).toBe(false)
    expect(endsWithContinuation('value\\')).toBe(true)
    expect(endsWithContinuation('value\\\\')).toBe(false)
    expect(endsWithContinuation('value\\\\\\')).toBe(true)
    expect(endsWithContinuation('\\')).toBe(true)
  })
})

describe('splitAssignment', () => {
  it.each([
    ['plain equals', 'key = value', ['='], 'key', '=', 'value'],
    ['colon', 'url: value', ['=', ':'], 'url', ':', 'value'],
    [
      'separator in double quotes',
      'url = "https://example.test?a=b"',
      ['='],
      'url',
      '=',
      '"https://example.test?a=b"',
    ],
    [
      'separator in single quotes',
      "value = 'left=right'",
      ['='],
      'value',
      '=',
      "'left=right'",
    ],
    [
      'escaped separator in key',
      String.raw`escaped\=key=value`,
      ['='],
      String.raw`escaped\=key`,
      '=',
      'value',
    ],
    ['empty value', 'key=', ['='], 'key', '=', ''],
  ])('%s', (_name, line, separators, key, separator, value) => {
    expect(splitAssignment(line, separators)).toEqual({ key, separator, value })
  })

  it.each([
    ['no separator', 'key value'],
    ['empty key', '=value'],
    ['separator only inside quotes', '"key=value"'],
  ])('returns undefined for %s', (_name, line) => {
    expect(splitAssignment(line, ['='])).toBeUndefined()
  })
})
