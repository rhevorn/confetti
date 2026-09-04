import { spawnSync } from 'node:child_process'
import { parseEnv } from 'node:util'
import { describe, expect, it } from 'vitest'
import { formatSetupCfg } from '../src/formatters/setupcfg.js'
import { formatPyini } from '../src/formatters/pyini.js'
import { formatPip } from '../src/formatters/pip.js'
import { formatToml } from '../src/formatters/toml.js'
import { formatGitConfig } from '../src/formatters/gitconfig.js'
import { formatEnv } from '../src/formatters/env.js'
import { formatCaddy } from '../src/formatters/caddy.js'
import { createDefaultRegistry } from '../src/configs/index.js'

const pythonAvailable =
  spawnSync('python3', ['-c', 'import configparser,tomllib'], { timeout: 5000 })
    .status === 0
const gitAvailable =
  spawnSync('git', ['--version'], { timeout: 5000 }).status === 0

// Fixed seed: failures reproduce locally and do not depend on test order.
function random(seed: number): () => number {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed
  }
}

function pythonCompare(kind: string, pairs: string[][]): void {
  const result = spawnSync(
    'python3',
    [
      '-c',
      `
import sys,json,configparser,tomllib
kind,pairs=json.load(sys.stdin)
def parse(text):
 if kind == 'toml': return tomllib.loads(text)
 parser=configparser.ConfigParser(interpolation=None)
 parser.read_string(text)
 return {section:dict(parser[section]) for section in parser}
for index,(before,after) in enumerate(pairs):
 assert parse(before) == parse(after), (index,before,after)
print(len(pairs))
`,
    ],
    { input: JSON.stringify([kind, pairs]), encoding: 'utf8', timeout: 10000 },
  )
  expect(result.error, result.stderr).toBeUndefined()
  expect(result.status, result.stderr).toBe(0)
  expect(Number(result.stdout.trim())).toBe(pairs.length)
}

describe('independent native parsers (missing executables are explicitly skipped)', () => {
  it.skipIf(!pythonAvailable)(
    'recovers flake8 integer and select options as separate parsed keys',
    () => {
      const source =
        '[flake8]\nmax-complexity = 12\n    select =    C,E,F,W,B\nexclude =\n    .git,\n    dist\n'
      const expected =
        '[flake8]\nmax-complexity = 12\nselect = C,E,F,W,B\nexclude =\n    .git,\n    dist\n'
      pythonCompare('ini', [[expected, formatPyini(source)]])
    },
  )
  it.skipIf(!pythonAvailable)(
    'parses recovered tox deps as the intended dependency list, not sibling keys',
    () => {
      const source =
        '[testenv]\n    description = run the test suite\n    deps =\n    pytest>=8\n    pytest-cov\n    coverage[toml]\ncommands =\n    pytest {posargs}\n'
      const intended =
        '[testenv]\ndescription = run the test suite\ndeps =\n    pytest>=8\n    pytest-cov\n    coverage[toml]\ncommands =\n    pytest {posargs}\n'
      pythonCompare('ini', [[intended, formatPyini(source)]])
    },
  )
  it.skipIf(!pythonAvailable)(
    'preserves 180 Python configparser documents',
    () => {
      const pairs: string[][] = []
      for (const format of [formatSetupCfg, formatPyini, formatPip]) {
        for (const indent of ['', '  ', '\t']) {
          for (const gap of [
            '',
            '\n',
            '# note\n',
            '; note\n',
            '\n# note\n\n',
          ]) {
            for (const eol of ['\n', '\r\n']) {
              for (const final of ['', eol]) {
                const input =
                  [
                    '[options]',
                    `${indent}requires   =`,
                    `${indent}        requests>=2`,
                    gap + `${indent}\turllib3>=2`,
                    `${indent}  python -c "print('a  b')"  `,
                    `${indent}next   =   value`,
                  ]
                    .join('\n')
                    .replaceAll('\n', eol) + final
                const output = format(input)
                expect(format(output)).toBe(output)
                pairs.push([input, output])
              }
            }
          }
        }
      }
      pythonCompare('ini', pairs)
    },
  )

  it.skipIf(!pythonAvailable)(
    'preserves generated TOML values according to tomllib',
    () => {
      const next = random(0xc0ffee)
      const pairs: string[][] = []
      for (let index = 0; index < 120; index += 1) {
        const ws = ' '.repeat(1 + (next() % 5))
        const value = JSON.stringify(`Unicode 配置 ${next()} # = { } \\ "`)
        const input = `[project]\nname${ws}=${ws}${value}\nvalues = [1, 2, { x = true }] # keep\ntext = """first\n  [not.a.table]\n  A = two  \nlast"""\n[[items]]\n[items.meta]\nid = ${index}\n[[items]]\n[items.meta]\nid = ${index + 1}\n`
        const source =
          index % 2 ? input.replaceAll('\n', '\r\n') : input.slice(0, -1)
        const output = formatToml(source)
        expect(formatToml(output), `seed=c0ffee case=${index}`).toBe(output)
        pairs.push([source, output])
      }
      pythonCompare('toml', pairs)
    },
  )

  it.skipIf(!gitAvailable)(
    'preserves Git keys, repeated values, quoting and continuation semantics',
    () => {
      function parse(input: string): string {
        const result = spawnSync(
          'git',
          ['config', '--no-includes', '--file', '-', '--null', '--list'],
          { input, encoding: 'utf8', timeout: 5000 },
        )
        expect(result.status, result.stderr).toBe(0)
        return result.stdout
      }
      const next = random(0x12345678)
      for (let index = 0; index < 40; index += 1) {
        const input = `[core]\n  editor  =  "editor  --wait"\n  autocrlf = false\n[remote "origin"]\n url = "https://example.test/${next()}#fragment"\n fetch=+refs/heads/*:refs/remotes/origin/*\n fetch=+refs/tags/*:refs/tags/*\n[alias]\n demo = first\\\n    second\n`
        const output = formatGitConfig(input)
        expect(parse(output), `seed=12345678 case=${index}`).toBe(parse(input))
        expect(formatGitConfig(output)).toBe(output)
      }
    },
  )
})

describe('seeded formatter properties', () => {
  it('preserves generated Caddy quoted tokens with exact golden layouts', () => {
    const next = random(0xcadd)
    for (let index = 0; index < 160; index += 1) {
      const text = `配置 ${next()} # { }   = path/value`
      const literal =
        index % 2 ? JSON.stringify(text + ' "quoted" \\') : '`' + text + '`'
      const indent = ' '.repeat(next() % 9)
      const input = `:8080 {\n${indent}respond    ${literal}\n}\n`
      const output = formatCaddy(input)
      expect(output, `seed=cadd case=${index}`).toBe(
        `:8080 {\n  respond ${literal}\n}\n`,
      )
      expect(formatCaddy(output)).toBe(output)
    }
  })

  it('preserves generated dotenv values using Node parseEnv as the oracle', () => {
    const next = random(0x5eed)
    for (let index = 0; index < 300; index += 1) {
      const quote = next() % 2 ? '"' : "'"
      const padding = ' '.repeat(next() % 8)
      const input = `# keep comment\nKEY${padding}=${padding}${quote}配置 ${next()} # literal\n  INNER = value  \n{} []\nlast${quote}\nOTHER = done${index % 2 ? '\n' : ''}`
      const output = formatEnv(input)
      expect(parseEnv(output), `seed=5eed case=${index}`).toEqual(
        parseEnv(input),
      )
      expect(formatEnv(output)).toBe(output)
      expect(output.endsWith('\n')).toBe(input.endsWith('\n'))
    }
  })

  it('does not crash on reproducible truncated and mixed-syntax input across all formatters', () => {
    const next = random(0xbadc0de)
    const fragments = [
      '{',
      '}',
      '[',
      ']',
      '"',
      "'",
      '`',
      '\\',
      '# comment',
      ';',
      '=',
      'key',
      '配置',
      '\n',
      '\r\n',
      '  ',
      '<<EOF',
      '$VAR',
    ]
    for (const definition of createDefaultRegistry().all()) {
      if (!definition.formatter) continue
      for (let index = 0; index < 80; index += 1) {
        let input = ''
        for (let token = 0; token < 24; token += 1)
          input += fragments[next() % fragments.length]
        expect(
          () => definition.formatter!(input),
          `${definition.id}: seed=badc0de case=${index} input=${JSON.stringify(input)}`,
        ).not.toThrow()
      }
    }
  })
})
