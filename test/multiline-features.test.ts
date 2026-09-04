import { expect, it } from 'vitest'
import { computeFoldingRanges } from '../src/features/folding.js'
import { computeDocumentSymbols } from '../src/features/symbols.js'
import { formatNginx } from '../src/formatters/nginx.js'
import { formatCaddy } from '../src/formatters/caddy.js'
import { maskNginxStrings } from '../src/tokenizers/nginx.js'

it('handles incomplete Caddy blocks, anonymous blocks and inline closing braces', () => {
  for (const input of [
    'respond "unfinished\n',
    'respond <<EOF\nbody\n',
    'respond foo \\\nbar\n',
  ]) {
    expect(computeFoldingRanges('caddy', input)).toEqual([])
    expect(computeDocumentSymbols('caddy', input)).toEqual([])
  }
  expect(computeDocumentSymbols('caddy', '}\n')).toEqual([])
  expect(computeFoldingRanges('caddy', '{\nadmin off\n}\n')).toEqual([
    { startLine: 0, endLine: 2 },
  ])
  expect(computeFoldingRanges('caddy', 'site { respond ok }\n')).toEqual([])
  expect(formatCaddy('site { respond ok }\nnext {\nrespond ok\n}\n')).toBe(
    'site { respond ok }\nnext {\n  respond ok\n}\n',
  )
})

it('keeps Nginx escapes and quotes in comments from affecting string state', () => {
  const input =
    '# "not a string\nserver {\nset $x "escaped\\\nquote\\" # still string";\n}\n'
  expect(maskNginxStrings(input).multiline).toBe(true)
  expect(maskNginxStrings('set $x foo\\\nbar;\n').multiline).toBe(false)
  expect(maskNginxStrings('dangling\\')).toEqual({
    masked: 'dangling ',
    multiline: false,
  })
  expect(computeFoldingRanges('nginx', input)).toEqual([
    { startLine: 1, endLine: 4 },
  ])
})

it('trims trailing comments from TOML outline ranges without swallowing the next header', () => {
  const content = '[first]\nx=1\n# trailing\n\n[empty]\n# trailing\n'
  expect(
    computeDocumentSymbols('toml', content).map(({ name, endLine }) => ({
      name,
      endLine,
    })),
  ).toEqual([
    { name: 'first', endLine: 1 },
    { name: 'empty', endLine: 4 },
  ])
})

it.each(['"', "'"])(
  'preserves Nginx multiline %s strings in formatting and structure',
  (quote) => {
    const content = `server {\n  return 200 ${quote}first\n}\nfake {\n  literal # =  value\nlast${quote};\n}\n`
    expect(formatNginx(content)).toBe(content)
    expect(computeFoldingRanges('nginx', content)).toEqual([
      { startLine: 0, endLine: 6 },
    ])
    expect(
      computeDocumentSymbols('nginx', content).map((symbol) => symbol.name),
    ).toEqual(['server'])
  },
)

it.each(['"', '`', 'heredoc'])(
  'ignores Caddy braces inside %s multiline payloads',
  (quote) => {
    const opener = quote === 'heredoc' ? '<<HTML' : quote
    const closer = quote === 'heredoc' ? 'HTML 200' : quote
    const content = [
      ':8080 {',
      `  respond ${opener}`,
      '}',
      'fake {',
      '# literal',
      closer,
      '  handle /api {',
      '    respond ok',
      '  }',
      '}',
    ].join('\n')
    expect(computeFoldingRanges('caddy', content)).toEqual([
      { startLine: 6, endLine: 8 },
      { startLine: 0, endLine: 9 },
    ])
    expect(
      computeDocumentSymbols('caddy', content).map(
        ({ name, startLine, endLine }) => ({ name, startLine, endLine }),
      ),
    ).toEqual([
      { name: 'handle /api', startLine: 6, endLine: 8 },
      { name: ':8080', startLine: 0, endLine: 9 },
    ])
  },
)

it('does not create TOML outline entries from multiline strings and recognizes commented headers', () => {
  const content =
    '[real] # comment\nvalue="""\n[fake]\n[fake]\n"""\n[next]\nx=1\n'
  expect(
    computeDocumentSymbols('toml', content).map((symbol) => symbol.name),
  ).toEqual(['real', 'next'])
})
