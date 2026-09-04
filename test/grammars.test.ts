import fs from 'node:fs'
import path from 'node:path'
import { createOnigScanner, createOnigString, loadWASM } from 'vscode-oniguruma'
import { parseRawGrammar, Registry, type IGrammar } from 'vscode-textmate'
import { describe, expect, it } from 'vitest'

const syntaxDirectory = path.join(process.cwd(), 'syntaxes')
const wasmPath = path.join(
  process.cwd(),
  'node_modules/vscode-oniguruma/release/onig.wasm',
)
const wasm = fs.readFileSync(wasmPath)
const onigLib = loadWASM(
  wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength),
).then(() => ({ createOnigScanner, createOnigString }))

async function loadGrammar(filename: string): Promise<IGrammar> {
  const grammarPath = path.join(syntaxDirectory, filename)
  const rawGrammar = parseRawGrammar(
    fs.readFileSync(grammarPath, 'utf8'),
    grammarPath,
  )
  const registry = new Registry({
    onigLib,
    loadGrammar: async (scopeName) =>
      scopeName === rawGrammar.scopeName ? rawGrammar : null,
  })
  const grammar = await registry.loadGrammar(rawGrammar.scopeName)
  if (!grammar) throw new Error(`Could not load ${filename}`)
  return grammar
}

async function scopesForLine(
  filename: string,
  line: string,
): Promise<string[]> {
  const grammar = await loadGrammar(filename)
  return grammar.tokenizeLine(line).tokens.flatMap((token) => token.scopes)
}

describe('TextMate grammars', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9])(
    'honors explicit YAML scalar indentation %i rather than consuming a shallower sibling',
    async (indent) => {
      const grammar = await loadGrammar('yaml.tmLanguage.json')
      const header = grammar.tokenizeLine(`  script: |${indent}-`)
      const body = grammar.tokenizeLine(
        ' '.repeat(2 + indent) + '# literal',
        header.ruleStack,
      )
      expect(body.tokens.flatMap((token) => token.scopes)).toContain(
        'string.unquoted.block.yaml',
      )
      expect(body.tokens.flatMap((token) => token.scopes)).not.toContain(
        'comment.line.number-sign.yaml',
      )
      const sibling = grammar.tokenizeLine('  next: ok', body.ruleStack)
      expect(sibling.tokens.flatMap((token) => token.scopes)).not.toContain(
        'string.unquoted.block.yaml',
      )
      expect(sibling.tokens.flatMap((token) => token.scopes)).toContain(
        'entity.name.tag.yaml',
      )
    },
  )

  it.each(['|', '>', '|-', '>+', '|2', '|2-', '|+2', '>2+', '>-2'])(
    'keeps YAML %s scalar bodies literal and recovers at a sibling key',
    async (indicator) => {
      const grammar = await loadGrammar('yaml.tmLanguage.json')
      let state = grammar.tokenizeLine(
        `script: ${indicator} # header comment`,
      ).ruleStack
      for (const line of [
        '  - name: literal text',
        '  # literal comment',
        '',
        '  {key: value}',
      ]) {
        const result = grammar.tokenizeLine(line, state)
        state = result.ruleStack
        for (const token of result.tokens) {
          expect(token.scopes).toContain('string.unquoted.block.yaml')
          expect(token.scopes).not.toContain('entity.name.tag.yaml')
          expect(token.scopes).not.toContain('comment.line.number-sign.yaml')
        }
      }
      const resumed = grammar.tokenizeLine('next: ok', state)
      expect(resumed.tokens.flatMap((token) => token.scopes)).toContain(
        'entity.name.tag.yaml',
      )
      expect(resumed.tokens.flatMap((token) => token.scopes)).not.toContain(
        'string.unquoted.block.yaml',
      )
    },
  )

  it.each([
    ['  script: |', '    # literal', '  next: ok'],
    ['- script: >', '    - name: literal', '  next: ok'],
    ['  - script: |2-', '      # literal', '    next: ok'],
    ['- |2', '  # literal', '- next: ok'],
    ['  - >-2', '    # literal', '  - next: ok'],
  ])('tracks YAML scalar indentation for %s', async (header, body, next) => {
    const grammar = await loadGrammar('yaml.tmLanguage.json')
    const opening = grammar.tokenizeLine(header)
    const content = grammar.tokenizeLine(body, opening.ruleStack)
    expect(content.tokens.flatMap((token) => token.scopes)).toContain(
      'string.unquoted.block.yaml',
    )
    expect(content.tokens.flatMap((token) => token.scopes)).not.toContain(
      'comment.line.number-sign.yaml',
    )
    const resumed = grammar.tokenizeLine(next, content.ruleStack)
    expect(resumed.tokens.flatMap((token) => token.scopes)).not.toContain(
      'string.unquoted.block.yaml',
    )
    expect(resumed.tokens.flatMap((token) => token.scopes)).toContain(
      'entity.name.tag.yaml',
    )
  })

  it.each([
    [
      'env',
      'KEY="first',
      '# literal { KEY=not-a-key',
      'last"',
      'AFTER=ok',
      'string.quoted.double.env',
      'support.type.property-name.env',
    ],
    [
      'toml',
      'value = """first',
      '[fake] # literal',
      'last"""',
      '[real]',
      'string.quoted',
      'entity.name.section',
    ],
    [
      'caddy',
      ':8080 {\nrespond "first',
      '# literal { }',
      'last"',
      'respond ok',
      'string.quoted.double.caddy',
      'keyword.other.directive.caddy',
    ],
    [
      'caddy',
      ':8080 {\nrespond `first',
      '# literal { }',
      'last`',
      'respond ok',
      'string.quoted.raw.caddy',
      'keyword.other.directive.caddy',
    ],
    [
      'caddy',
      ':8080 {\nrespond <<HTML',
      '# literal { }',
      'HTML 200',
      'respond ok',
      'string.unquoted.heredoc.caddy',
      'keyword.other.directive.caddy',
    ],
  ])(
    'retains %s multiline state and recovers after its closing delimiter (%s)',
    async (id, opening, body, closing, after, stringScope, nextScope) => {
      const grammar = await loadGrammar(`${id}.tmLanguage.json`)
      let state
      for (const line of opening.split('\n'))
        state = grammar.tokenizeLine(line, state).ruleStack
      const inside = grammar.tokenizeLine(body, state)
      expect(
        inside.tokens.every((token) =>
          token.scopes.some((scope) => scope.startsWith(stringScope)),
        ),
      ).toBe(true)
      expect(
        inside.tokens
          .flatMap((token) => token.scopes)
          .some((scope) => scope.startsWith('comment.')),
      ).toBe(false)
      const end = grammar.tokenizeLine(closing, inside.ruleStack)
      const resumed = grammar.tokenizeLine(after, end.ruleStack)
      expect(
        resumed.tokens
          .flatMap((token) => token.scopes)
          .some((scope) => scope.startsWith(nextScope)),
      ).toBe(true)
      expect(resumed.tokens.flatMap((token) => token.scopes)).not.toContain(
        stringScope,
      )
    },
  )

  for (const filename of fs.readdirSync(syntaxDirectory)) {
    if (!filename.endsWith('.tmLanguage.json')) continue

    it(`${filename} is self-contained valid JSON`, () => {
      const grammar = JSON.parse(
        fs.readFileSync(path.join(syntaxDirectory, filename), 'utf8'),
      ) as { scopeName?: string; patterns?: unknown[]; $schema?: string }

      expect(grammar.scopeName).toMatch(/^source\.confetti\./)
      expect(grammar.patterns?.length).toBeGreaterThan(0)
      expect(grammar.$schema).toBeUndefined()
    })
  }

  it('gives dotenv keys, operators, and values distinct scopes', () => {
    const grammar = JSON.parse(
      fs.readFileSync(
        path.join(syntaxDirectory, 'env.tmLanguage.json'),
        'utf8',
      ),
    ) as {
      patterns: Array<{
        beginCaptures?: Record<string, { name: string }>
        contentName?: string
      }>
    }
    const assignment = grammar.patterns.find(
      (pattern) => pattern.contentName === 'string.unquoted.env',
    )

    expect(assignment?.beginCaptures?.['2']?.name).toBe(
      'support.type.property-name.env',
    )
    expect(assignment?.beginCaptures?.['3']?.name).toBe(
      'keyword.operator.assignment.env',
    )
    expect(assignment?.contentName).toBe('string.unquoted.env')
  })

  it('gives Git Config subsections a structural scope', () => {
    const grammar = fs.readFileSync(
      path.join(syntaxDirectory, 'gitconfig.tmLanguage.json'),
      'utf8',
    )
    expect(grammar).toContain('entity.name.section.subsection.gitconfig')
  })

  it('gives properties keys and values distinct scopes', () => {
    const grammar = fs.readFileSync(
      path.join(syntaxDirectory, 'properties.tmLanguage.json'),
      'utf8',
    )
    expect(grammar).toContain('support.type.property-name.properties')
    expect(grammar).toContain('string.unquoted.properties')
    expect(grammar).toContain('string.unquoted.continuation.properties')
  })

  it('tokenizes dotenv keys, operators, values, and variables', async () => {
    const scopes = await scopesForLine(
      'env.tmLanguage.json',
      'API_URL="https://${HOST}/v1"',
    )
    expect(scopes).toContain('support.type.property-name.env')
    expect(scopes).toContain('keyword.operator.assignment.env')
    expect(scopes).toContain('string.quoted.double.env')
    expect(scopes).toContain('variable.other.braced.env')
  })

  it('tokenizes properties keys and values with distinct scopes', async () => {
    const scopes = await scopesForLine(
      'properties.tmLanguage.json',
      'server.port=8080',
    )
    expect(scopes).toContain('support.type.property-name.properties')
    expect(scopes).toContain('keyword.operator.assignment.properties')
    expect(scopes).toContain('string.unquoted.properties')
    expect(scopes).toContain('constant.numeric.properties')
  })

  it('tokenizes Git Config sections and subsections', async () => {
    const scopes = await scopesForLine(
      'gitconfig.tmLanguage.json',
      '[remote "origin"]',
    )
    expect(scopes).toContain('entity.name.section.gitconfig')
    expect(scopes).toContain('entity.name.section.subsection.gitconfig')
  })

  it('tokenizes Nginx directives, variables, numbers, and blocks', async () => {
    const directiveScopes = await scopesForLine(
      'nginx.tmLanguage.json',
      'set $target 8080;',
    )
    const blockScopes = await scopesForLine(
      'nginx.tmLanguage.json',
      'location /api {',
    )
    expect(directiveScopes).toContain('keyword.other.directive.nginx')
    expect(directiveScopes).toContain('variable.other.nginx')
    expect(directiveScopes).toContain('constant.numeric.nginx')
    expect(blockScopes).toContain('keyword.control.nginx')
  })

  it('tokenizes Apache tags, directives, variables, and booleans', async () => {
    const tagScopes = await scopesForLine(
      'apache.tmLanguage.json',
      '<VirtualHost *:80>',
    )
    const directiveScopes = await scopesForLine(
      'apache.tmLanguage.json',
      'RewriteCond %{HTTP_HOST} ^www On',
    )
    expect(tagScopes).toContain('entity.name.tag.apache')
    expect(tagScopes).toContain('punctuation.definition.tag.apache')
    expect(directiveScopes).toContain('keyword.other.directive.apache')
    expect(directiveScopes).toContain('variable.other.apache')
    expect(directiveScopes).toContain('constant.language.boolean.apache')
  })

  it('tokenizes MySQL, pip, and setup.cfg sections, keys, and values', async () => {
    const mysqlSectionScopes = await scopesForLine(
      'mysql.tmLanguage.json',
      '[mysqld]',
    )
    const mysqlScopes = await scopesForLine(
      'mysql.tmLanguage.json',
      'datadir = /var/lib/mysql',
    )
    const pipSectionScopes = await scopesForLine(
      'pip.tmLanguage.json',
      '[global]',
    )
    const pipScopes = await scopesForLine(
      'pip.tmLanguage.json',
      'index-url = https://pypi.org/simple',
    )
    const setupCfgSectionScopes = await scopesForLine(
      'setupcfg.tmLanguage.json',
      '[metadata]',
    )
    const setupCfgScopes = await scopesForLine(
      'setupcfg.tmLanguage.json',
      'name = confetti-demo',
    )
    expect(mysqlSectionScopes).toContain('entity.name.section.mysql')
    expect(mysqlScopes).toContain('support.type.property-name.mysql')
    expect(mysqlScopes).toContain('string.unquoted.path.mysql')
    expect(pipSectionScopes).toContain('entity.name.section.pip')
    expect(pipScopes).toContain('string.unquoted.url.pip')
    expect(setupCfgSectionScopes).toContain('entity.name.section.setupcfg')
    expect(setupCfgScopes).toContain('support.type.property-name.setupcfg')
  })

  it('tokenizes systemd sections, assignments, paths, and specifiers', async () => {
    const sectionScopes = await scopesForLine(
      'systemd.tmLanguage.json',
      '[Service]',
    )
    const assignmentScopes = await scopesForLine(
      'systemd.tmLanguage.json',
      'ExecStart=/usr/bin/node server.js --port 8080',
    )
    const specifierScopes = await scopesForLine(
      'systemd.tmLanguage.json',
      'ExecStart=/usr/bin/app --instance %i --literal %%',
    )
    expect(sectionScopes).toContain('entity.name.section.systemd')
    expect(assignmentScopes).toContain('support.type.property-name.systemd')
    expect(assignmentScopes).toContain('string.unquoted.path.systemd')
    expect(specifierScopes).toContain('variable.language.specifier.systemd')
  })

  it('tokenizes Caddyfile sections, directives, matchers, and placeholders', async () => {
    const sectionScopes = await scopesForLine(
      'caddy.tmLanguage.json',
      'example.com, www.example.com {',
    )
    const directiveScopes = await scopesForLine(
      'caddy.tmLanguage.json',
      'reverse_proxy localhost:9000',
    )
    const matcherScopes = await scopesForLine(
      'caddy.tmLanguage.json',
      '@static path *.css',
    )
    const placeholderScopes = await scopesForLine(
      'caddy.tmLanguage.json',
      'respond "Hello {http.request.host}"',
    )
    expect(sectionScopes).toContain('entity.name.section.caddy')
    expect(directiveScopes).toContain('keyword.other.directive.caddy')
    expect(matcherScopes).toContain('variable.other.matcher.caddy')
    expect(placeholderScopes).toContain('variable.other.caddy')
  })

  it('distinguishes Caddy hash fragments, quoted braces, escaped quotes and real comments', async () => {
    const grammar = await loadGrammar('caddy.tmLanguage.json')
    for (const line of [
      'redir https://example.test/#fragment',
      'respond "text # literal {"',
      'respond `text # literal {`',
      'respond "escaped \\"quote # literal"',
    ]) {
      const scopes = grammar
        .tokenizeLine(line)
        .tokens.flatMap((token) => token.scopes)
      expect(scopes).not.toContain('comment.line.number-sign.caddy')
      expect(scopes).not.toContain('meta.section.caddy')
    }
    const scopes = grammar
      .tokenizeLine('example.test { # real comment')
      .tokens.flatMap((token) => token.scopes)
    expect(scopes).toContain('comment.line.number-sign.caddy')
    expect(scopes).toContain('entity.name.section.caddy')
  })

  it('tokenizes Python tooling INI sections and assignments', async () => {
    const sectionScopes = await scopesForLine(
      'pyini.tmLanguage.json',
      '[testenv:lint]',
    )
    const assignmentScopes = await scopesForLine(
      'pyini.tmLanguage.json',
      'max-line-length = 100',
    )
    expect(sectionScopes).toContain('entity.name.section.pyini')
    expect(assignmentScopes).toContain('support.type.property-name.pyini')
    expect(assignmentScopes).toContain('constant.numeric.pyini')
  })

  it('tokenizes tmux commands, options, and format variables', async () => {
    const commandScopes = await scopesForLine(
      'tmux.tmLanguage.json',
      'set -g status-left #S',
    )
    const formatScopes = await scopesForLine(
      'tmux.tmLanguage.json',
      'display-message session: #{session_name}',
    )
    const bindScopes = await scopesForLine(
      'tmux.tmLanguage.json',
      'bind r source-file ~/.tmux.conf',
    )
    expect(commandScopes).toContain('keyword.other.command.tmux')
    expect(commandScopes).toContain('constant.language.option.tmux')
    expect(formatScopes).toContain('variable.other.tmux')
    expect(bindScopes).toContain('string.unquoted.path.tmux')
  })

  it('tokenizes screen directives and status strings', async () => {
    const directiveScopes = await scopesForLine(
      'screen.tmLanguage.json',
      'hardstatus string "%H %{= kw}%-w%{= BW}%n %t"',
    )
    expect(directiveScopes).toContain('keyword.other.directive.screen')
    expect(directiveScopes).toContain('string.quoted.double.screen')
  })

  it('tokenizes readline options, key sequences, and functions', async () => {
    const setScopes = await scopesForLine(
      'inputrc.tmLanguage.json',
      'set editing-mode emacs',
    )
    const keyScopes = await scopesForLine(
      'inputrc.tmLanguage.json',
      '"\\M-[1;5D": backward-word',
    )
    const conditionalScopes = await scopesForLine(
      'inputrc.tmLanguage.json',
      '$if mode=emacs',
    )
    expect(setScopes).toContain('keyword.other.set.inputrc')
    expect(setScopes).toContain('variable.other.option.inputrc')
    expect(keyScopes).toContain('string.quoted.keyseq.inputrc')
    expect(keyScopes).toContain('entity.name.function.inputrc')
    expect(conditionalScopes).toContain('keyword.control.inputrc')
  })

  it('tokenizes SSH blocks, directives, paths, and placeholders', async () => {
    const hostScopes = await scopesForLine('ssh.tmLanguage.json', 'Host work')
    const directiveScopes = await scopesForLine(
      'ssh.tmLanguage.json',
      'User %r',
    )
    const pathScopes = await scopesForLine(
      'ssh.tmLanguage.json',
      'IdentityFile ~/.ssh/id_ed25519',
    )
    expect(hostScopes).toContain('keyword.control.ssh-config')
    expect(hostScopes).toContain('entity.name.section.ssh-config')
    expect(directiveScopes).toContain('keyword.other.directive.ssh-config')
    expect(directiveScopes).toContain('variable.other.ssh-config')
    expect(pathScopes).toContain('string.unquoted.path.ssh-config')
  })

  it('tokenizes INI sections, keys, operators, booleans, and numbers', async () => {
    const sectionScopes = await scopesForLine('ini.tmLanguage.json', '[server]')
    const valueScopes = await scopesForLine(
      'ini.tmLanguage.json',
      'enabled = true 8080',
    )
    expect(sectionScopes).toContain('entity.name.section.ini')
    expect(valueScopes).toContain('support.type.property-name.ini')
    expect(valueScopes).toContain('keyword.operator.assignment.ini')
    expect(valueScopes).toContain('constant.language.boolean.ini')
    expect(valueScopes).toContain('constant.numeric.ini')
  })

  it('tokenizes npmrc scoped keys, URLs, and environment variables', async () => {
    const keyScopes = await scopesForLine(
      'npmrc.tmLanguage.json',
      '@scope:registry=https://registry.example.test/',
    )
    const variableScopes = await scopesForLine(
      'npmrc.tmLanguage.json',
      '_authToken=${NPM_TOKEN}',
    )
    expect(keyScopes).toContain('support.type.property-name.npmrc')
    expect(keyScopes).toContain('keyword.operator.assignment.npmrc')
    expect(keyScopes).toContain('string.unquoted.url.npmrc')
    expect(variableScopes).toContain('variable.other.npmrc')
  })

  it('tokenizes classic yarnrc keys, quoted values, URLs, and booleans', async () => {
    const quotedScopes = await scopesForLine(
      'yarnrc.tmLanguage.json',
      'registry "https://registry.yarnpkg.com"',
    )
    const urlScopes = await scopesForLine(
      'yarnrc.tmLanguage.json',
      'registry https://registry.yarnpkg.com',
    )
    const flagScopes = await scopesForLine(
      'yarnrc.tmLanguage.json',
      '"--install.ignore-engines" true',
    )
    expect(quotedScopes).toContain('support.type.property-name.yarnrc')
    expect(quotedScopes).toContain('string.quoted.double.yarnrc')
    expect(urlScopes).toContain('string.unquoted.url.yarnrc')
    expect(flagScopes).toContain('constant.language.boolean.yarnrc')
  })

  it('tokenizes TOML tables, keys, strings, dates, booleans, and numbers', async () => {
    const tableScopes = await scopesForLine(
      'toml.tmLanguage.json',
      '[[products]]',
    )
    const valueScopes = await scopesForLine(
      'toml.tmLanguage.json',
      'released = 2026-08-26T12:30:00Z',
    )
    const mixedScopes = await scopesForLine(
      'toml.tmLanguage.json',
      'enabled = true # 42',
    )
    expect(tableScopes).toContain('entity.name.section.toml')
    expect(valueScopes).toContain('support.type.property-name.toml')
    expect(valueScopes).toContain('keyword.operator.assignment.toml')
    expect(valueScopes).toContain('constant.numeric.datetime.toml')
    expect(mixedScopes).toContain('constant.language.boolean.toml')
    expect(mixedScopes).toContain('comment.line.number-sign.toml')
  })

  it('tokenizes YAML keys, sequences, block indicators, anchors, and aliases', async () => {
    const mappingScopes = await scopesForLine(
      'yaml.tmLanguage.json',
      'enabled: true',
    )
    const sequenceScopes = await scopesForLine(
      'yaml.tmLanguage.json',
      '- &default value',
    )
    const aliasScopes = await scopesForLine(
      'yaml.tmLanguage.json',
      'copy: *default',
    )
    const blockScopes = await scopesForLine(
      'yaml.tmLanguage.json',
      'description: |2-',
    )
    expect(mappingScopes).toContain('entity.name.tag.yaml')
    expect(mappingScopes).toContain('punctuation.separator.key-value.yaml')
    expect(mappingScopes).toContain('constant.language.boolean.yaml')
    expect(sequenceScopes).toContain(
      'punctuation.definition.sequence.item.yaml',
    )
    expect(sequenceScopes).toContain('entity.name.type.anchor.yaml')
    expect(aliasScopes).toContain('variable.other.alias.yaml')
    expect(blockScopes).toContain('keyword.control.block-scalar.yaml')
  })

  it('tokenizes ignore patterns, negation, wildcards, and paths', async () => {
    const scopes = await scopesForLine(
      'ignore.tmLanguage.json',
      '!docs/**/generated?.log',
    )
    expect(scopes).toContain('keyword.operator.negation.ignore')
    expect(scopes).toContain('string.unquoted.pattern.ignore')
    expect(scopes).toContain('keyword.operator.wildcard.ignore')
    expect(scopes).toContain('punctuation.separator.path.ignore')
  })

  it('tokenizes Git Attributes patterns, attributes, operators, and values', async () => {
    const scopes = await scopesForLine(
      'gitattributes.tmLanguage.json',
      '*.ts text eol=lf',
    )
    expect(scopes).toContain('string.unquoted.pattern.gitattributes')
    expect(scopes).toContain('variable.other.attribute.gitattributes')
    expect(scopes).toContain('keyword.operator.assignment.gitattributes')
    expect(scopes).toContain('string.unquoted.value.gitattributes')
  })

  it('tokenizes Browserslist browsers, queries, comparisons, and versions', async () => {
    const scopes = await scopesForLine(
      'browserslist.tmLanguage.json',
      'last 2 Chrome versions and Firefox >= 120',
    )
    expect(scopes).toContain('keyword.control.query.browserslist')
    expect(scopes).toContain('entity.name.browser.browserslist')
    expect(scopes).toContain('keyword.operator.logical.browserslist')
    expect(scopes).toContain('keyword.operator.comparison.browserslist')
    expect(scopes).toContain('constant.numeric.version.browserslist')
  })

  it('tokenizes tool names, versions, aliases, and comments', async () => {
    const versionScopes = await scopesForLine(
      'versions.tmLanguage.json',
      'nodejs 22.18.0 # runtime',
    )
    const aliasScopes = await scopesForLine(
      'versions.tmLanguage.json',
      'nodejs lts/jod',
    )
    expect(versionScopes).toContain('entity.name.tool.versions')
    expect(versionScopes).toContain('constant.numeric.version.versions')
    expect(versionScopes).toContain('comment.line.number-sign.versions')
    expect(aliasScopes).toContain('constant.language.version-alias.versions')
  })

  it('tokenizes hosts addresses, names, and comments', async () => {
    const scopes = await scopesForLine(
      'hosts.tmLanguage.json',
      '127.0.0.1 localhost alias # local',
    )
    expect(scopes).toContain('constant.numeric.address.ip.hosts')
    expect(scopes).toContain('entity.name.host.hosts')
    expect(scopes).toContain('comment.line.number-sign.hosts')
  })

  it('tokenizes fstab devices, mounts, types, options, and pass values', async () => {
    const scopes = await scopesForLine(
      'fstab.tmLanguage.json',
      'UUID=x / ext4 defaults 0 1',
    )
    expect(scopes).toContain('string.unquoted.device.fstab')
    expect(scopes).toContain('string.unquoted.path.fstab')
    expect(scopes).toContain('entity.name.type.filesystem.fstab')
    expect(scopes).toContain('variable.other.options.fstab')
    expect(scopes).toContain('constant.numeric.pass.fstab')
  })

  it('tokenizes crontab variables, schedules, ranges, and quoted strings', async () => {
    const assignmentScopes = await scopesForLine(
      'crontab.tmLanguage.json',
      'SHELL=/bin/bash',
    )
    const scheduleScopes = await scopesForLine(
      'crontab.tmLanguage.json',
      '@daily echo "hello"',
    )
    const rangeScopes = await scopesForLine(
      'crontab.tmLanguage.json',
      '0 2 * * mon-fri /usr/bin/task',
    )
    expect(assignmentScopes).toContain('support.type.property-name.crontab')
    expect(assignmentScopes).toContain('keyword.operator.assignment.crontab')
    expect(scheduleScopes).toContain('keyword.control.schedule.crontab')
    expect(scheduleScopes).toContain('string.quoted.double.crontab')
    expect(rangeScopes).toContain('constant.language.weekday.crontab')
    expect(rangeScopes).toContain('punctuation.separator.range.crontab')
    expect(rangeScopes).toContain('string.unquoted.path.crontab')
  })
})
