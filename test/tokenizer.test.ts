import { describe, expect, it } from 'vitest'
import {
  collapseTokenWhitespace,
  splitOnSymbol,
  tokenizeLine,
  tokenText,
  trimTokenWhitespace,
} from '../src/tokenizers/scanner.js'
import { tokenizeToml, tomlTokenText } from '../src/tokenizers/toml.js'
import {
  decodePropertiesKey,
  propertiesKeyText,
} from '../src/tokenizers/properties.js'

describe('shared tokenizer', () => {
  it('separates whitespace, strings, escapes, symbols, and comments', () => {
    const tokens = tokenizeLine('  key\\=part = "a \\"b" # keep', {
      symbols: ['=', '=='],
      comments: ['#'],
      commentRequiresBoundary: true,
    })

    expect(tokens.map(({ kind }) => kind)).toEqual([
      'whitespace',
      'text',
      'escaped',
      'text',
      'whitespace',
      'symbol',
      'whitespace',
      'string',
      'whitespace',
      'comment',
    ])
    expect(tokenText(tokens)).toBe('  key\\=part = "a \\"b" # keep')
  })

  it('requires a boundary for comments when requested', () => {
    expect(
      tokenizeLine('# full line', {
        comments: ['//', '#'],
        commentRequiresBoundary: true,
      }).at(0),
    ).toEqual({ kind: 'comment', value: '# full line' })
    expect(
      tokenizeLine('URL=https://example.test/a#fragment', {
        comments: ['#'],
        commentRequiresBoundary: true,
      }).some(({ kind }) => kind === 'comment'),
    ).toBe(false)
    expect(tokenizeLine('value#comment', { comments: ['#'] }).at(-1)).toEqual({
      kind: 'comment',
      value: '#comment',
    })
  })

  it('handles unterminated strings and a trailing backslash as text safely', () => {
    expect(tokenizeLine('"unterminated').at(0)).toEqual({
      kind: 'string',
      value: '"unterminated',
    })
    expect(tokenizeLine('value\\').at(-1)).toEqual({
      kind: 'text',
      value: '\\',
    })
  })

  it('trims, collapses, and splits token streams', () => {
    const tokens = tokenizeLine('  export   KEY = value  ', { symbols: ['='] })
    expect(collapseTokenWhitespace(tokens.slice(0, 5))).toBe('export KEY')

    const split = splitOnSymbol(tokens, ['='])
    expect(tokenText(split?.before ?? [])).toBe('export   KEY')
    expect(tokenText(split?.after ?? [])).toBe('value')
    expect(split?.symbol).toBe('=')
    expect(splitOnSymbol(tokenizeLine('plain'), ['='])).toBeUndefined()
    expect(trimTokenWhitespace([])).toEqual([])
  })
})

describe('Java Properties keys', () => {
  it('scans keys the way java.util.Properties does', () => {
    expect(propertiesKeyText('key=value')).toBe('key')
    expect(propertiesKeyText('key:value')).toBe('key')
    expect(propertiesKeyText('key value')).toBe('key')
    expect(propertiesKeyText('   key = value')).toBe('key')
    expect(propertiesKeyText('escaped\\:key=value')).toBe('escaped\\:key')
    expect(propertiesKeyText('escaped\\ key=value')).toBe('escaped\\ key')
    expect(propertiesKeyText('standalone')).toBe('standalone')
    expect(propertiesKeyText('a"b=1')).toBe('a"b')
    expect(propertiesKeyText('=value')).toBe('')
    expect(propertiesKeyText('   ')).toBeUndefined()
    expect(propertiesKeyText('')).toBeUndefined()
  })

  it('unescapes keys the way java.util.Properties does', () => {
    expect(decodePropertiesKey('plain')).toBe('plain')
    expect(decodePropertiesKey('a\\u0041')).toBe('aA')
    expect(decodePropertiesKey('a\\tb')).toBe('a\tb')
    expect(decodePropertiesKey('a\\nb')).toBe('a\nb')
    expect(decodePropertiesKey('a\\rb')).toBe('a\rb')
    expect(decodePropertiesKey('a\\fb')).toBe('a\fb')
    expect(decodePropertiesKey('escaped\\:key')).toBe('escaped:key')
    expect(decodePropertiesKey('trailing\\')).toBe('trailing')
    expect(decodePropertiesKey('a\\u00=1')).toBeUndefined()
  })
})

describe('TOML tokenizer', () => {
  it('distinguishes TOML strings, comments, punctuation, and newlines', () => {
    const input = `key = "value # text" # comment\npath = 'C:\\temp'\n`
    const tokens = tokenizeToml(input)

    expect(tomlTokenText(tokens)).toBe(input)
    expect(tokens.map(({ kind }) => kind)).toContain('basic-string')
    expect(tokens.map(({ kind }) => kind)).toContain('literal-string')
    expect(tokens.filter(({ kind }) => kind === 'comment')).toHaveLength(1)
    expect(tokens.filter(({ kind }) => kind === 'newline')).toHaveLength(2)
  })

  it('keeps multiline string bodies in one lossless token', () => {
    const input = String.raw`value = """
# not a comment
escaped \""" is content
""" # comment`
    const tokens = tokenizeToml(input)
    const multiline = tokens.find(
      ({ kind }) => kind === 'multiline-basic-string',
    )

    expect(tomlTokenText(tokens)).toBe(input)
    expect(multiline?.closed).toBe(true)
    expect(tokens.filter(({ kind }) => kind === 'comment')).toHaveLength(1)
  })

  it('marks unterminated strings so the formatter can skip unsafe edits', () => {
    expect(
      tokenizeToml("value = '''unterminated").find(
        ({ closed }) => closed === false,
      ),
    ).toBeDefined()
  })

  it('handles quote runs and unterminated single-line literal strings', () => {
    const input = `single = 'unterminated\nmultiline = '''one ' and '' stay\nclosed'''`
    const tokens = tokenizeToml(input)

    expect(tomlTokenText(tokens)).toBe(input)
    expect(tokens.find(({ kind }) => kind === 'literal-string')?.closed).toBe(
      false,
    )
    expect(
      tokens.find(({ kind }) => kind === 'multiline-literal-string')?.closed,
    ).toBe(true)
  })

  it('handles short quote runs and a trailing escape in basic strings', () => {
    const quoted = `value = """one " and "" stay\nclosed"""`
    const escaped = 'value = "trailing\\'

    expect(tomlTokenText(tokenizeToml(quoted))).toBe(quoted)
    expect(tokenizeToml(escaped).at(-1)?.closed).toBe(false)
  })
})
