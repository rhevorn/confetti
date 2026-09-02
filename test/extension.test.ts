import { beforeEach, describe, expect, it } from 'vitest'
import { activate, deactivate } from '../src/extension.js'
import { mockState, resetMockState } from './mocks/vscode.js'

interface TestDocument {
  languageId: string
  fileName: string
  uri: { fsPath: string; scheme: string; toString(): string }
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
    uri: {
      fsPath: fileName,
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
      'confetti.showDetectionInfo',
      'confetti.showOutput',
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

    expect(testDocument.languageId).toBe('confetti-env')
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

  it('provides folding ranges for detected documents and none otherwise', () => {
    activateExtension()

    const supported = document(
      '/etc/nginx/nginx.conf',
      'server {\n  location /api {\n    proxy_pass http://backend;\n  }\n}\n',
      'confetti-nginx',
    )
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

  it('provides document symbols for detected documents and none otherwise', () => {
    activateExtension()

    const supported = document(
      '/etc/nginx/nginx.conf',
      'server {\n  listen 80;\n}\n',
      'confetti-nginx',
    )
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

  it('opens formatter output and handles missing active editors', async () => {
    activateExtension()

    await command('confetti.detectConfigType')()
    command('confetti.showDetectionInfo')()
    await command('confetti.formatConfig')()
    command('confetti.showOutput')()
    await mockState.activeEditorHandlers[0]?.(undefined)
    deactivate()

    expect(mockState.outputShown).toBe(true)
    expect(mockState.informationMessages).toHaveLength(0)
  })
})
