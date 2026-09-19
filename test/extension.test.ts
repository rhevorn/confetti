import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultRegistry } from '../src/configs/index.js'
import { activate, deactivate } from '../src/extension.js'
import { mockState, resetMockState } from './mocks/vscode.js'

interface TestDocument {
  languageId: string
  fileName: string
  version: number
  uri: { fsPath: string; path: string; scheme: string; toString(): string }
  getText(): string
  positionAt(offset: number): number
}

function document(
  fileName: string,
  text: string,
  languageId = 'plaintext',
  scheme = 'file',
): TestDocument {
  return {
    languageId,
    fileName,
    version: 1,
    uri: {
      fsPath: fileName,
      path: fileName,
      scheme,
      toString: () => `${scheme}:${fileName}`,
    },
    getText: () => text,
    positionAt: (offset) => offset,
  }
}

function editor(
  testDocument: TestDocument,
  editAccepted = true,
  afterEdit?: () => void,
) {
  return {
    document: testDocument,
    async edit(
      callback: (builder: {
        replace(range: unknown, text: string): void
      }) => void,
    ) {
      callback({
        replace(_range, text) {
          testDocument.version += 1
          testDocument.getText = () => text
        },
      })
      afterEdit?.()
      return editAccepted
    },
  }
}

function activateExtension(): void {
  activate({ subscriptions: [] } as never)
}

function command(id: string): (...arguments_: unknown[]) => unknown {
  const handler = mockState.commandHandlers.get(id)
  if (!handler) throw new Error(`Missing command: ${id}`)
  return handler
}

beforeEach(() => {
  resetMockState()
})

describe('VS Code extension adapter', () => {
  it('registers commands, formatting, event listeners, and output', () => {
    activateExtension()

    expect([...mockState.commandHandlers.keys()].sort()).toEqual([
      'confetti.detectConfigType',
      'confetti.formatConfig',
      'confetti.previewFormatting',
      'confetti.showDetectionInfo',
      'confetti.showOutput',
      'confetti.showSupportedFormats',
    ])
    expect(mockState.formattingProvider).toBeDefined()
    const selector = mockState.formattingSelector as Array<{
      language: string
    }>
    for (const language of [
      'confetti-gitattributes',
      'confetti-browserslist',
      'confetti-hosts',
      'confetti-fstab',
      'confetti-crontab',
    ]) {
      expect(selector.map((item) => item.language)).toContain(language)
    }
    expect(selector.map(({ language }) => language)).not.toContain(
      'confetti-yaml',
    )
    expect(selector.map(({ language }) => language)).not.toContain('yaml')
    expect(selector.map(({ language }) => language)).not.toContain(
      'dockercompose',
    )
    expect(selector.map(({ language }) => language)).not.toContain(
      'confetti-ignore',
    )
    expect(selector.map(({ language }) => language)).not.toContain(
      'confetti-versions',
    )
    expect(mockState.openHandlers).toHaveLength(1)
    expect(mockState.saveHandlers).toHaveLength(1)
    expect(mockState.closeHandlers).toHaveLength(1)
    expect(mockState.changeHandlers).toHaveLength(1)
    expect(mockState.configurationHandlers).toHaveLength(1)
    expect(mockState.activeEditorHandlers).toHaveLength(1)
    expect(mockState.foldingProvider).toBeDefined()
    const foldingSelector = mockState.foldingSelector as Array<{
      language: string
    }>
    expect(foldingSelector.map(({ language }) => language)).toContain(
      'confetti-nginx',
    )
    expect(foldingSelector.map(({ language }) => language)).toContain(
      'confetti-env',
    )
    for (const language of ['ini', 'properties', 'toml', 'dotenv']) {
      expect(foldingSelector.map(({ language }) => language)).toContain(
        language,
      )
    }
    expect(mockState.symbolProvider).toBeDefined()
    const symbolSelector = mockState.symbolSelector as Array<{
      language: string
    }>
    expect(symbolSelector.map(({ language }) => language)).toContain(
      'confetti-nginx',
    )
    expect(symbolSelector.map(({ language }) => language)).toContain(
      'confetti-env',
    )
    for (const language of ['ini', 'properties', 'toml', 'dotenv']) {
      expect(symbolSelector.map(({ language }) => language)).toContain(language)
    }
    expect(mockState.outputLines[0]).toContain('Extension activated')
  })

  it('detects a custom language, applies it, and caches detection info', async () => {
    const testDocument = document('/etc/nginx/nginx.conf', 'events {\n}\n')
    mockState.activeEditor = editor(testDocument) as never
    activateExtension()

    await command('confetti.detectConfigType')()
    command('confetti.showDetectionInfo')()

    expect(testDocument.languageId).toBe('confetti-nginx')
    expect(mockState.languageChanges).toHaveLength(1)
    expect(mockState.informationMessages).toContain('Detected: Nginx (100%)')
    expect(mockState.informationMessages.at(-1)).toBe(
      'Detected: Nginx — Confidence: 100%',
    )
    expect(mockState.outputShown).toBe(true)
    expect(mockState.outputLines.join('\n')).toContain(
      'Filename: nginx.conf (+100)',
    )
    expect(mockState.outputLines.join('\n')).toContain('Content:')
    expect(mockState.outputLines.join('\n')).toContain('Other candidates:')
  })

  it('keeps a canonical YAML language mode active', async () => {
    const testDocument = document('/app/config.yaml', 'name: app\n', 'yaml')
    mockState.activeEditor = editor(testDocument) as never
    activateExtension()

    await command('confetti.detectConfigType')()

    expect(testDocument.languageId).toBe('yaml')
    expect(mockState.languageChanges).toHaveLength(0)
  })

  it('falls back to document.fileName when the URI has no filesystem path', async () => {
    const testDocument = document('/app/.env', 'KEY=value\n')
    testDocument.uri.fsPath = ''
    mockState.activeEditor = editor(testDocument) as never
    activateExtension()

    await command('confetti.detectConfigType')()
    command('confetti.showDetectionInfo')()

    expect(testDocument.languageId).toBe('confetti-env')
    expect(mockState.outputLines.join('\n')).toContain(
      'Detection details | /app/.env',
    )
  })

  it('shows detection details without an alternatives section when none exist', () => {
    const hosts = document('/etc/hosts', '127.0.0.1 localhost\n')
    mockState.activeEditor = editor(hosts) as never
    activateExtension()

    command('confetti.showDetectionInfo')()

    const details = mockState.outputLines.join('\n')
    expect(details).toContain('Detected: Hosts')
    expect(details).not.toContain('Other candidates:')
  })

  it('reports a file that cannot be detected', async () => {
    const testDocument = document('/app/notes.txt', 'plain text\n')
    mockState.activeEditor = editor(testDocument) as never
    activateExtension()

    await command('confetti.detectConfigType')()
    command('confetti.showDetectionInfo')()

    expect(mockState.informationMessages).toEqual([
      'Confetti could not identify this configuration file with enough confidence.',
      'No supported configuration type was detected.',
    ])
  })

  it('formats through the explicit command and records visible feedback', async () => {
    const testDocument = document(
      '/etc/nginx/nginx.conf',
      'server{\nlisten 80 ;\n}\n',
      'confetti-nginx',
    )
    mockState.activeEditor = editor(testDocument) as never
    activateExtension()

    await command('confetti.formatConfig')()

    expect(testDocument.getText()).toBe('server {\n  listen 80;\n}\n')
    expect(mockState.statusMessages.at(-1)).toContain(
      'Confetti formatted Nginx',
    )
    expect(mockState.outputLines.join('\n')).toContain('edit applied')
  })

  it('reports when the editor rejects a formatting edit', async () => {
    const testDocument = document(
      '/etc/nginx/nginx.conf',
      'server{\n}\n',
      'confetti-nginx',
    )
    mockState.activeEditor = editor(testDocument, false) as never
    activateExtension()

    await command('confetti.formatConfig')()

    expect(mockState.warningMessages.at(-1)).toBe(
      'Confetti could not apply the formatting edit.',
    )
    expect(mockState.outputLines.join('\n')).toContain(
      'edit rejected by editor',
    )
  })

  it('falls back to the editor language when detection changes after editing', async () => {
    const testDocument = document(
      '/etc/nginx/nginx.conf',
      'server{\n}\n',
      'confetti-nginx',
    )
    mockState.activeEditor = editor(testDocument, true, () => {
      testDocument.languageId = 'plaintext'
      testDocument.fileName = '/app/notes.txt'
      testDocument.uri.fsPath = '/app/notes.txt'
      testDocument.getText = () => 'plain text\n'
    }) as never
    activateExtension()

    await command('confetti.formatConfig')()

    expect(mockState.statusMessages.at(-1)).toContain(
      'Confetti formatted plaintext',
    )
  })

  it('reports already formatted and unsupported documents', async () => {
    const formatted = document(
      '/etc/nginx/nginx.conf',
      'server {\n  listen 80;\n}\n',
      'confetti-nginx',
    )
    mockState.activeEditor = editor(formatted) as never
    activateExtension()
    await command('confetti.formatConfig')()
    expect(mockState.informationMessages.at(-1)).toBe(
      'Nginx is already formatted.',
    )

    const unsupported = document('/app/notes.txt', 'plain text\n')
    mockState.activeEditor = editor(unsupported) as never
    await command('confetti.formatConfig')()
    expect(mockState.informationMessages.at(-1)).toBe(
      'Confetti could not detect a supported configuration type.',
    )

    const yaml = document(
      '/app/config.yaml',
      'items: [one, two]\n',
      'confetti-yaml',
    )
    mockState.activeEditor = editor(yaml) as never
    await command('confetti.formatConfig')()
    expect(mockState.informationMessages.at(-1)).toBe(
      'Confetti does not provide a formatter for YAML.',
    )
  })

  it('honors disabled formatting for both command and provider', async () => {
    const testDocument = document(
      '/etc/nginx/nginx.conf',
      'server{\n}\n',
      'confetti-nginx',
    )
    mockState.configuration.set('format.enable', false)
    mockState.activeEditor = editor(testDocument) as never
    activateExtension()

    await command('confetti.formatConfig')()
    const edits =
      mockState.formattingProvider?.provideDocumentFormattingEdits(testDocument)

    expect(mockState.warningMessages).toContain(
      'Confetti formatting is disabled by confetti.format.enable.',
    )
    expect(edits).toEqual([])
    expect(testDocument.getText()).toBe('server{\n}\n')
  })

  it('returns a full-document edit from the Format Document provider', () => {
    const testDocument = document(
      '/etc/nginx/nginx.conf',
      'server{\n}\n',
      'confetti-nginx',
    )
    activateExtension()

    const edits = mockState.formattingProvider?.provideDocumentFormattingEdits(
      testDocument,
    ) as Array<{ newText: string }>

    expect(edits).toHaveLength(1)
    expect(edits[0]?.newText).toBe('server {\n}\n')
  })

  it('previews formatting in a native diff without changing the source', async () => {
    const testDocument = document(
      '/etc/nginx/nginx.conf',
      'server{\nlisten 80 ;\n}\n',
      'confetti-nginx',
    )
    mockState.activeEditor = editor(testDocument) as never
    activateExtension()

    await command('confetti.previewFormatting')()

    expect(testDocument.getText()).toBe('server{\nlisten 80 ;\n}\n')
    expect(mockState.openedDocuments[0]?.getText?.()).toBe(
      'server {\n  listen 80;\n}\n',
    )
    expect(mockState.commandExecutions).toEqual([
      {
        command: 'vscode.diff',
        arguments: [
          testDocument.uri,
          mockState.openedDocuments[0]?.uri,
          'Confetti Preview: nginx.conf',
          { preview: true },
        ],
      },
    ])
    expect(mockState.outputLines.join('\n')).toContain(
      'Confetti: Preview Formatting | opened',
    )

    const provider = mockState.contentProviders.get('confetti-preview')
    const preview = mockState.openedDocuments[0]
    mockState.closeHandlers[0]?.(preview)
    expect(provider?.provideTextDocumentContent(preview?.uri as never)).toBe(
      'server {\n  listen 80;\n}\n',
    )
    mockState.closeHandlers[0]?.(testDocument)
    expect(provider?.provideTextDocumentContent(preview?.uri as never)).toBe('')
  })

  it('reuses an already assigned preview language and handles missing preview content', async () => {
    const testDocument = document(
      '/etc/nginx/nginx.conf',
      'server{\n}\n',
      'confetti-nginx',
    )
    mockState.activeEditor = editor(testDocument) as never
    mockState.openedDocumentLanguage = 'confetti-nginx'
    activateExtension()

    const provider = mockState.contentProviders.get('confetti-preview')
    expect(
      provider?.provideTextDocumentContent({
        fsPath: '/missing',
        path: '/missing',
        scheme: 'confetti-preview',
        toString: () => 'confetti-preview:/missing',
      }),
    ).toBe('')

    await command('confetti.previewFormatting')()

    expect(mockState.languageChanges).toHaveLength(0)
  })

  it('reports every preview formatting skip reason', async () => {
    const messy = document(
      '/etc/nginx/nginx.conf',
      'server{\n}\n',
      'confetti-nginx',
    )
    mockState.activeEditor = editor(messy) as never
    mockState.configuration.set('format.enable', false)
    activateExtension()
    await command('confetti.previewFormatting')()
    expect(mockState.warningMessages.at(-1)).toContain('formatting is disabled')

    mockState.configuration.set('format.enable', true)
    mockState.configuration.set('format.formats', ['ssh'])
    await command('confetti.previewFormatting')()
    expect(mockState.warningMessages.at(-1)).toBe(
      'Confetti formatting is not enabled for Nginx.',
    )

    mockState.configuration.set('format.formats', [])
    mockState.activeEditor = editor(
      document('/etc/nginx/nginx.conf', 'server {\n}\n', 'confetti-nginx'),
    ) as never
    await command('confetti.previewFormatting')()
    expect(mockState.informationMessages.at(-1)).toBe(
      'Nginx is already formatted.',
    )

    mockState.activeEditor = editor(
      document('/app/config.yaml', 'name: app\n', 'confetti-yaml'),
    ) as never
    await command('confetti.previewFormatting')()
    expect(mockState.informationMessages.at(-1)).toBe(
      'Confetti does not provide a formatter for YAML.',
    )

    mockState.activeEditor = editor(
      document('/app/notes.txt', 'plain text\n'),
    ) as never
    await command('confetti.previewFormatting')()
    expect(mockState.informationMessages.at(-1)).toBe(
      'Confetti could not detect a supported configuration type.',
    )
  })

  it('provides folding ranges for detected documents and none otherwise', () => {
    activateExtension()

    const supported = document(
      '/etc/nginx/nginx.conf',
      'server {\n  location /api {\n    proxy_pass http://backend;\n  }\n}\n',
      'confetti-nginx',
    )
    mockState.openHandlers[0]?.(supported)
    const supportedRanges = mockState.foldingProvider?.provideFoldingRanges(
      supported,
    ) as Array<{ start: number; end: number }>

    expect(supportedRanges).toEqual([
      { start: 1, end: 3 },
      { start: 0, end: 4 },
    ])

    const unsupported = document('/app/notes.txt', 'plain text\n')
    expect(
      mockState.foldingProvider?.provideFoldingRanges(unsupported),
    ).toEqual([])
  })

  it('provides folding and symbols for canonical builtin language modes', () => {
    activateExtension()

    const canonical = document(
      '/app/settings.ini',
      '[client]\nport=3306\n[mysqld]\ndatadir=/data\n',
      'ini',
    )
    mockState.openHandlers[0]?.(canonical)
    const ranges = mockState.foldingProvider?.provideFoldingRanges(
      canonical,
    ) as Array<{ start: number; end: number }>
    expect(ranges).toEqual([
      { start: 0, end: 1 },
      { start: 2, end: 3 },
    ])

    const symbols = mockState.symbolProvider?.provideDocumentSymbols(
      canonical,
    ) as Array<{ name: string }>
    expect(symbols.map(({ name }) => name)).toEqual(['client', 'mysqld'])
  })

  it('provides document symbols for detected documents and none otherwise', () => {
    activateExtension()

    const supported = document(
      '/etc/nginx/nginx.conf',
      'server {\n  listen 80;\n}\n',
      'confetti-nginx',
    )
    mockState.openHandlers[0]?.(supported)
    const symbols = mockState.symbolProvider?.provideDocumentSymbols(
      supported,
    ) as Array<{
      name: string
      kind: number
      range: { start: unknown; end: unknown }
      selectionRange: { start: unknown; end: unknown }
    }>

    expect(symbols).toHaveLength(1)
    expect(symbols[0]?.name).toBe('server')
    expect(symbols[0]?.kind).toBe(22)

    const unsupported = document('/app/notes.txt', 'plain text\n')
    expect(
      mockState.symbolProvider?.provideDocumentSymbols(unsupported),
    ).toEqual([])
  })

  it('serves structural caches without reading documents during provider requests or edits', async () => {
    const doc = document('/app/settings.ini', '[one]\nx=1\n', 'ini')
    const read = vi.fn(doc.getText)
    doc.getText = read
    mockState.activeEditor = editor(doc) as never
    activateExtension()
    const calls = read.mock.calls.length
    const foldingChanged = vi.fn()
    const subscription =
      mockState.foldingProvider?.onDidChangeFoldingRanges?.(foldingChanged)
    for (let index = 0; index < 20; index += 1) {
      expect(mockState.foldingProvider?.provideFoldingRanges(doc)).toHaveLength(
        1,
      )
      expect(
        mockState.symbolProvider?.provideDocumentSymbols(doc),
      ).toHaveLength(1)
    }
    expect(read).toHaveBeenCalledTimes(calls)
    doc.version += 1
    // Reject stale versions even before VS Code delivers the change event.
    expect(mockState.foldingProvider?.provideFoldingRanges(doc)).toEqual([])
    expect(mockState.symbolProvider?.provideDocumentSymbols(doc)).toEqual([])
    mockState.changeHandlers[0]?.({ document: doc })
    for (let index = 0; index < 20; index += 1) {
      expect(mockState.foldingProvider?.provideFoldingRanges(doc)).toEqual([])
      expect(mockState.symbolProvider?.provideDocumentSymbols(doc)).toEqual([])
    }
    expect(read).toHaveBeenCalledTimes(calls)
    read.mockReturnValue('[two]\nx=1\n[three]\nx=2\n')
    mockState.saveHandlers[0]?.(doc)
    expect(foldingChanged).toHaveBeenCalledTimes(2)
    expect(mockState.symbolProvider?.provideDocumentSymbols(doc)).toHaveLength(
      2,
    )
    mockState.closeHandlers[0]?.(doc)
    expect(mockState.foldingProvider?.provideFoldingRanges(doc)).toEqual([])
    expect(mockState.symbolProvider?.provideDocumentSymbols(doc)).toEqual([])
    await command('confetti.detectConfigType')()
    expect(foldingChanged).toHaveBeenCalledTimes(3)
    expect(mockState.symbolProvider?.provideDocumentSymbols(doc)).toHaveLength(
      2,
    )
    mockState.changeHandlers[0]?.({ document: doc })
    mockState.activeEditorHandlers[0]?.({ document: doc })
    expect(mockState.foldingProvider?.provideFoldingRanges(doc)).toHaveLength(2)
    subscription?.dispose()
  })

  it('honors auto-detect settings and file schemes on editor events', async () => {
    activateExtension()
    const supported = document('/app/.env', 'KEY=value\n')

    mockState.configuration.set('autoDetect', false)
    await mockState.openHandlers[0]?.(supported)
    expect(mockState.languageChanges).toHaveLength(0)

    mockState.configuration.set('autoDetect', true)
    await mockState.saveHandlers[0]?.(
      document('/app/.env', 'KEY=value\n', 'plaintext', 'untitled'),
    )
    expect(mockState.languageChanges).toHaveLength(0)

    await mockState.activeEditorHandlers[0]?.({ document: supported })
    expect(mockState.languageChanges.at(-1)?.languageId).toBe('confetti-env')
  })

  it('releases cached detection when a document is closed', async () => {
    let content = 'events {\n}\n'
    const testDocument = document('/etc/nginx/nginx.conf', content)
    testDocument.getText = () => content
    mockState.activeEditor = editor(testDocument) as never
    activateExtension()

    await command('confetti.detectConfigType')()
    content = 'plain text\n'
    testDocument.fileName = '/app/notes.txt'
    testDocument.uri.fsPath = '/app/notes.txt'
    mockState.closeHandlers[0]?.(testDocument)
    command('confetti.showDetectionInfo')()

    expect(mockState.informationMessages.at(-1)).toBe(
      'No supported configuration type was detected.',
    )
  })

  it('reuses the detection result across events until the document changes', async () => {
    const testDocument = document('/app/notes.txt', 'plain text\n')
    const originalGetText = testDocument.getText
    let scans = 0
    testDocument.getText = () => {
      scans += 1
      return originalGetText()
    }
    activateExtension()

    await mockState.openHandlers[0]?.(testDocument)
    expect(scans).toBe(1)

    await mockState.saveHandlers[0]?.(testDocument)
    await mockState.activeEditorHandlers[0]?.({ document: testDocument })
    command('confetti.showDetectionInfo')()
    expect(scans).toBe(1)

    testDocument.version += 1
    await mockState.saveHandlers[0]?.(testDocument)
    expect(scans).toBe(2)
  })

  it('updates, disables, and clears duplicate-key diagnostics on existing handlers', async () => {
    activateExtension()
    const duplicateDocument = document('/app/.env', 'KEY=1\nKEY=2\n')
    const uri = duplicateDocument.uri

    await mockState.openHandlers[0]?.(duplicateDocument)
    const created = mockState.diagnostics?.get(uri) as Array<{
      message: string
      severity: number
    }>
    expect(created).toHaveLength(1)
    expect(created[0]?.message).toBe(
      'Duplicate key "KEY" (also defined on line 1)',
    )
    expect(created[0]?.severity).toBe(1)

    mockState.configuration.set('diagnostics.enable', false)
    await mockState.saveHandlers[0]?.(duplicateDocument)
    expect(mockState.diagnostics?.has(uri)).toBe(false)

    mockState.configuration.delete('diagnostics.enable')
    await mockState.openHandlers[0]?.(duplicateDocument)
    expect(mockState.diagnostics?.has(uri)).toBe(true)

    mockState.closeHandlers[0]?.(duplicateDocument)
    expect(mockState.diagnostics?.has(uri)).toBe(false)

    const unsupported = document('/app/notes.txt', 'plain text\n')
    await mockState.saveHandlers[0]?.(unsupported)
    expect(mockState.diagnostics?.has(unsupported.uri)).toBe(false)
  })

  it('clears stale diagnostics on edits and recomputes them on save', async () => {
    activateExtension()
    const duplicateDocument = document('/app/.env', 'KEY=1\nKEY=2\n')
    const uri = duplicateDocument.uri

    await mockState.openHandlers[0]?.(duplicateDocument)
    expect(mockState.diagnostics?.get(uri)).toHaveLength(1)

    mockState.changeHandlers[0]?.({ document: duplicateDocument })
    expect(mockState.diagnostics?.has(uri)).toBe(false)

    await mockState.saveHandlers[0]?.(duplicateDocument)
    expect(mockState.diagnostics?.get(uri)).toHaveLength(1)
  })

  it('honors per-format whitelists for auto-detection', async () => {
    mockState.configuration.set('autoDetectFormats', ['nginx'])
    activateExtension()

    const sshDocument = document(
      '/etc/ssh/ssh_config',
      'Host work\n  User deploy\n',
    )
    await mockState.openHandlers[0]?.(sshDocument)
    expect(sshDocument.languageId).toBe('plaintext')
    expect(mockState.languageChanges).toHaveLength(0)
    expect(mockState.statusBarItem?.text).toBe('$(eye) SSH Config 100%')

    const nginxDocument = document('/etc/nginx/nginx.conf', 'events {\n}\n')
    await mockState.openHandlers[0]?.(nginxDocument)
    expect(nginxDocument.languageId).toBe('confetti-nginx')
  })

  it('lets an explicit detection command override the auto-detect whitelist', async () => {
    mockState.configuration.set('autoDetectFormats', ['nginx'])
    const sshDocument = document(
      '/etc/ssh/ssh_config',
      'Host work\n  User deploy\n',
    )
    mockState.activeEditor = editor(sshDocument) as never
    activateExtension()

    await command('confetti.detectConfigType')()

    expect(sshDocument.languageId).toBe('confetti-ssh')
    expect(mockState.languageChanges.at(-1)?.languageId).toBe('confetti-ssh')
  })

  it('applies workspace-relative associations and explains the override', async () => {
    mockState.workspaceFolderPath = '/workspace'
    mockState.configuration.set('associations', {
      'deploy/proxy.conf': 'caddy',
    })
    const associated = document(
      '/workspace/deploy/proxy.conf',
      'server {\n  listen 80;\n}\n',
    )
    mockState.activeEditor = editor(associated) as never
    activateExtension()

    await command('confetti.detectConfigType')()
    command('confetti.showDetectionInfo')()

    expect(associated.languageId).toBe('confetti-caddy')
    expect(mockState.outputLines.join('\n')).toContain(
      'User association: deploy/proxy.conf (+100)',
    )
  })

  it('logs invalid associations and refreshes detection when they change', () => {
    mockState.configuration.set('associations', { '*.cfg': 'missing' })
    const associated = document('/workspace/app.cfg', 'anything\n')
    mockState.activeEditor = editor(associated) as never
    activateExtension()
    expect(mockState.outputLines.join('\n')).toContain(
      'Association ignored | unknown format=missing | pattern=*.cfg',
    )

    mockState.configuration.set('associations', { '*.cfg': 'env' })
    mockState.configurationHandlers[0]?.({
      affectsConfiguration: (section: string) =>
        section === 'confetti' || section === 'confetti.associations',
    })
    expect(associated.languageId).toBe('confetti-env')
    expect(mockState.statusBarItem?.text).toBe(
      '$(eye) Environment Variables 100%',
    )
  })

  it.each([null, 'invalid', [], { '*.cfg': 42 }])(
    'ignores a malformed association setting: %j',
    (associations) => {
      mockState.configuration.set('associations', associations)
      const nginx = document('/etc/nginx/nginx.conf', 'server {\n}\n')
      mockState.activeEditor = editor(nginx) as never

      expect(() => activateExtension()).not.toThrow()
      expect(mockState.statusBarItem?.text).toBe('$(eye) Nginx 100%')
    },
  )

  it('applies Confetti setting changes immediately', async () => {
    const duplicateDocument = document('/app/.env', 'KEY=1\nKEY=2\n')
    mockState.activeEditor = editor(duplicateDocument) as never
    mockState.textDocuments.push(duplicateDocument)
    activateExtension()
    expect(mockState.diagnostics?.get(duplicateDocument.uri)).toHaveLength(1)

    const affectsConfiguration = (section: string) =>
      section === 'confetti' || section === 'confetti.diagnostics.enable'
    mockState.configuration.set('diagnostics.enable', false)
    mockState.configurationHandlers[0]?.({ affectsConfiguration })
    expect(mockState.diagnostics?.has(duplicateDocument.uri)).toBe(false)

    mockState.configuration.set('diagnostics.enable', true)
    mockState.configurationHandlers[0]?.({ affectsConfiguration })
    expect(mockState.diagnostics?.get(duplicateDocument.uri)).toHaveLength(1)

    duplicateDocument.languageId = 'plaintext'
    mockState.configurationHandlers[0]?.({
      affectsConfiguration: (section: string) =>
        section === 'confetti' || section === 'confetti.autoDetect',
    })
    expect(duplicateDocument.languageId).toBe('confetti-env')

    duplicateDocument.languageId = 'plaintext'
    mockState.configurationHandlers[0]?.({
      affectsConfiguration: (section: string) =>
        section === 'confetti' || section === 'confetti.autoDetectFormats',
    })
    expect(duplicateDocument.languageId).toBe('confetti-env')

    mockState.activeEditor = undefined
    mockState.configurationHandlers[0]?.({
      affectsConfiguration: (section: string) => section === 'confetti',
    })

    mockState.configurationHandlers[0]?.({
      affectsConfiguration: () => false,
    })
    expect(mockState.diagnostics?.get(duplicateDocument.uri)).toHaveLength(1)
  })

  it('honors per-format whitelists for formatting', () => {
    mockState.configuration.set('format.formats', ['ssh'])
    activateExtension()

    const nginxEdits =
      mockState.formattingProvider?.provideDocumentFormattingEdits(
        document('/etc/nginx/nginx.conf', 'server{\n}\n', 'confetti-nginx'),
      )
    expect(nginxEdits).toEqual([])
    expect(mockState.outputLines.join('\n')).toContain(
      'formatting not enabled for nginx',
    )

    const sshEdits =
      mockState.formattingProvider?.provideDocumentFormattingEdits(
        document(
          '/etc/ssh/ssh_config',
          'Host work\nHostName example.com\n',
          'confetti-ssh',
        ),
      ) as Array<{ newText: string }>
    expect(sshEdits).toHaveLength(1)
    expect(sshEdits[0]?.newText).toBe('Host work\n  HostName example.com\n')
  })

  it('tracks detection in the status bar across editor events', async () => {
    const nginxDocument = document('/etc/nginx/nginx.conf', 'events {\n}\n')
    mockState.activeEditor = editor(nginxDocument) as never
    activateExtension()

    const item = mockState.statusBarItem
    expect(item?.text).toBe('$(eye) Nginx 100%')
    expect(item?.command).toBe('confetti.showDetectionInfo')
    expect(mockState.statusBarShown).toBe(true)

    await mockState.openHandlers[0]?.(nginxDocument)
    expect(item?.text).toBe('$(eye) Nginx 100%')

    const envDocument = document('/app/.env', 'KEY=value\n')
    await mockState.activeEditorHandlers[0]?.({ document: envDocument })
    expect(item?.text).toBe('$(eye) Environment Variables 100%')

    await mockState.activeEditorHandlers[0]?.(undefined)
    expect(mockState.statusBarShown).toBe(false)

    const unsupported = document('/app/notes.txt', 'plain text\n')
    await mockState.saveHandlers[0]?.(unsupported)
    expect(mockState.statusBarShown).toBe(false)

    await mockState.activeEditorHandlers[0]?.({ document: nginxDocument })
    expect(mockState.statusBarShown).toBe(true)
    expect(item?.text).toBe('$(eye) Nginx 100%')

    mockState.activeEditor = undefined
    mockState.closeHandlers[0]?.(nginxDocument)
    expect(mockState.statusBarShown).toBe(false)
  })

  it('lists every supported format and its capabilities in the output channel', async () => {
    activateExtension()

    const lines = (await command('confetti.showSupportedFormats')()) as string[]

    expect(mockState.outputShown).toBe(true)
    expect(mockState.outputLines.slice(-lines.length)).toEqual(lines)
    expect(lines[0]).toMatch(
      new RegExp(
        `^\\[.+\\] Supported formats \\| ${createDefaultRegistry().all().length} registered$`,
      ),
    )

    const sectionOf = (heading: string): string => {
      const index = lines.indexOf(`  ${heading}`)
      expect(index).toBeGreaterThan(-1)
      return lines[index + 1].trim()
    }

    expect(
      sectionOf(
        'Format ids for confetti.autoDetectFormats and confetti.associations:',
      ),
    ).toContain('yaml')
    expect(sectionOf('Format ids for confetti.format.formats:')).toContain(
      'nginx',
    )
    expect(sectionOf('Format ids for confetti.format.formats:')).not.toContain(
      'yaml',
    )
    expect(sectionOf('Duplicate-key diagnostics:')).toContain('properties')
    expect(sectionOf('Folding ranges:')).toContain('toml')
    expect(sectionOf('Outline symbols:')).toContain('toml')
    expect(sectionOf('Snippets:')).toBe('nginx')
    expect(lines).toContain('    properties: Java Properties')
    expect(lines).toContain('    toml: TOML')
  })

  it('opens formatter output and handles missing active editors', async () => {
    activateExtension()

    await command('confetti.detectConfigType')()
    command('confetti.showDetectionInfo')()
    await command('confetti.formatConfig')()
    await command('confetti.previewFormatting')()
    command('confetti.showOutput')()
    await command('confetti.showSupportedFormats')()
    await mockState.activeEditorHandlers[0]?.(undefined)
    deactivate()

    expect(mockState.outputShown).toBe(true)
    expect(mockState.informationMessages).toHaveLength(0)
  })
})
