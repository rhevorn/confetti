type Handler = (...arguments_: unknown[]) => unknown

interface MockDocument {
  languageId: string
  fileName?: string
  uri?: MockUri
  getText?(): string
}

interface MockUri {
  fsPath: string
  path: string
  query?: string
  scheme: string
  toString(): string
}

interface MockEditor {
  document: MockDocument
}

export const mockState = {
  configuration: new Map<string, unknown>(),
  commandHandlers: new Map<string, Handler>(),
  commandExecutions: [] as Array<{ command: string; arguments: unknown[] }>,
  formattingProvider: undefined as
    { provideDocumentFormattingEdits: Handler } | undefined,
  formattingSelector: undefined as unknown,
  foldingProvider: undefined as
    | {
        provideFoldingRanges: Handler
        onDidChangeFoldingRanges?: (listener: () => void) => { dispose(): void }
      }
    | undefined,
  foldingSelector: undefined as unknown,
  symbolProvider: undefined as { provideDocumentSymbols: Handler } | undefined,
  symbolSelector: undefined as unknown,
  openHandlers: [] as Handler[],
  saveHandlers: [] as Handler[],
  closeHandlers: [] as Handler[],
  changeHandlers: [] as Handler[],
  configurationHandlers: [] as Handler[],
  activeEditorHandlers: [] as Handler[],
  textDocuments: [] as MockDocument[],
  openedDocuments: [] as MockDocument[],
  openedDocumentLanguage: 'plaintext',
  contentProviders: new Map<
    string,
    { provideTextDocumentContent(uri: MockUri): string }
  >(),
  workspaceFolderPath: undefined as string | undefined,
  activeEditor: undefined as MockEditor | undefined,
  informationMessages: [] as string[],
  warningMessages: [] as string[],
  statusMessages: [] as string[],
  outputLines: [] as string[],
  outputShown: false,
  languageChanges: [] as Array<{ document: MockDocument; languageId: string }>,
  diagnostics: undefined as Map<unknown, Diagnostic[]> | undefined,
  statusBarItem: undefined as StatusBarItem | undefined,
  statusBarShown: false,
}

interface StatusBarItem {
  text: string
  command: string | undefined
  show(): void
  hide(): void
  dispose(): void
}

export function resetMockState(): void {
  mockState.configuration.clear()
  mockState.commandHandlers.clear()
  mockState.commandExecutions.length = 0
  mockState.formattingProvider = undefined
  mockState.formattingSelector = undefined
  mockState.foldingProvider = undefined
  mockState.foldingSelector = undefined
  mockState.symbolProvider = undefined
  mockState.symbolSelector = undefined
  mockState.openHandlers.length = 0
  mockState.saveHandlers.length = 0
  mockState.closeHandlers.length = 0
  mockState.changeHandlers.length = 0
  mockState.configurationHandlers.length = 0
  mockState.activeEditorHandlers.length = 0
  mockState.textDocuments.length = 0
  mockState.openedDocuments.length = 0
  mockState.openedDocumentLanguage = 'plaintext'
  mockState.contentProviders.clear()
  mockState.workspaceFolderPath = undefined
  mockState.activeEditor = undefined
  mockState.informationMessages.length = 0
  mockState.warningMessages.length = 0
  mockState.statusMessages.length = 0
  mockState.outputLines.length = 0
  mockState.outputShown = false
  mockState.languageChanges.length = 0
  mockState.diagnostics = undefined
  mockState.statusBarItem = undefined
  mockState.statusBarShown = false
}

function disposable(): { dispose(): void } {
  return { dispose() {} }
}

export class Range {
  constructor(
    public readonly start: unknown,
    public readonly end: unknown,
  ) {}
}

export const TextEdit = {
  replace(range: Range, newText: string) {
    return { range, newText }
  },
}

export class FoldingRange {
  constructor(
    public readonly start: number,
    public readonly end: number,
  ) {}
}

export class EventEmitter<T> {
  private listeners = new Set<(value: T) => void>()
  readonly event = (listener: (value: T) => void) => {
    this.listeners.add(listener)
    return { dispose: () => this.listeners.delete(listener) }
  }
  fire(value: T): void {
    for (const listener of this.listeners) listener(value)
  }
  dispose(): void {
    this.listeners.clear()
  }
}

export class Position {
  constructor(
    public readonly line: number,
    public readonly character: number,
  ) {}
}

export class DocumentSymbol {
  constructor(
    public readonly name: string,
    public readonly detail: string,
    public readonly kind: number,
    public readonly range: Range,
    public readonly selectionRange: Range,
  ) {}
}

export const SymbolKind = {
  Namespace: 3,
  Struct: 22,
}

export const StatusBarAlignment = {
  Left: 1,
  Right: 2,
}

export class Diagnostic {
  constructor(
    public readonly range: Range,
    public readonly message: string,
    public readonly severity?: number,
  ) {}
}

export const DiagnosticSeverity = {
  Error: 0,
  Warning: 1,
  Information: 2,
  Hint: 3,
}

export const Uri = {
  from(parts: { scheme: string; path: string; query?: string }): MockUri {
    return {
      ...parts,
      fsPath: parts.path,
      toString: () =>
        `${parts.scheme}:${parts.path}${parts.query ? `?${parts.query}` : ''}`,
    }
  },
}

export const workspace = {
  get textDocuments(): MockDocument[] {
    return mockState.textDocuments
  },
  getConfiguration() {
    return {
      get<T>(key: string, defaultValue: T): T {
        return (
          mockState.configuration.has(key)
            ? mockState.configuration.get(key)
            : defaultValue
        ) as T
      },
    }
  },
  getWorkspaceFolder() {
    return mockState.workspaceFolderPath
      ? { uri: { fsPath: mockState.workspaceFolderPath } }
      : undefined
  },
  async openTextDocument(
    options: MockUri | { content: string; language: string },
  ) {
    const index = mockState.openedDocuments.length + 1
    if ('scheme' in options) {
      const content =
        mockState.contentProviders
          .get(options.scheme)
          ?.provideTextDocumentContent(options) ?? ''
      const preview: MockDocument = {
        languageId: mockState.openedDocumentLanguage,
        fileName: options.path,
        uri: options,
        getText: () => content,
      }
      mockState.openedDocuments.push(preview)
      return preview
    }
    const preview: MockDocument = {
      languageId: options.language,
      fileName: `Untitled-${index}`,
      uri: {
        fsPath: '',
        path: `Untitled-${index}`,
        scheme: 'untitled',
        toString: () => `untitled:Untitled-${index}`,
      },
      getText: () => options.content,
    }
    mockState.openedDocuments.push(preview)
    return preview
  },
  registerTextDocumentContentProvider(
    scheme: string,
    provider: { provideTextDocumentContent(uri: MockUri): string },
  ) {
    mockState.contentProviders.set(scheme, provider)
    return disposable()
  },
  onDidOpenTextDocument(handler: Handler) {
    mockState.openHandlers.push(handler)
    return disposable()
  },
  onDidSaveTextDocument(handler: Handler) {
    mockState.saveHandlers.push(handler)
    return disposable()
  },
  onDidCloseTextDocument(handler: Handler) {
    mockState.closeHandlers.push(handler)
    return disposable()
  },
  onDidChangeTextDocument(handler: Handler) {
    mockState.changeHandlers.push(handler)
    return disposable()
  },
  onDidChangeConfiguration(handler: Handler) {
    mockState.configurationHandlers.push(handler)
    return disposable()
  },
}

export const window = {
  get activeTextEditor(): MockEditor | undefined {
    return mockState.activeEditor
  },
  createOutputChannel() {
    return {
      appendLine(message: string) {
        mockState.outputLines.push(message)
      },
      show() {
        mockState.outputShown = true
      },
      dispose() {},
    }
  },
  showInformationMessage(message: string) {
    mockState.informationMessages.push(message)
    return Promise.resolve(message)
  },
  showWarningMessage(message: string) {
    mockState.warningMessages.push(message)
    return Promise.resolve(message)
  },
  setStatusBarMessage(message: string) {
    mockState.statusMessages.push(message)
    return disposable()
  },
  createStatusBarItem(): StatusBarItem {
    const item: StatusBarItem = {
      text: '',
      command: undefined,
      show() {
        mockState.statusBarShown = true
      },
      hide() {
        mockState.statusBarShown = false
      },
      dispose() {},
    }
    mockState.statusBarItem = item
    return item
  },
  onDidChangeActiveTextEditor(handler: Handler) {
    mockState.activeEditorHandlers.push(handler)
    return disposable()
  },
}

export const commands = {
  registerCommand(command: string, handler: Handler) {
    mockState.commandHandlers.set(command, handler)
    return disposable()
  },
  executeCommand(command: string, ...arguments_: unknown[]) {
    mockState.commandExecutions.push({ command, arguments: arguments_ })
    return Promise.resolve(undefined)
  },
}

export const languages = {
  registerDocumentFormattingEditProvider(
    selector: unknown,
    provider: { provideDocumentFormattingEdits: Handler },
  ) {
    mockState.formattingSelector = selector
    mockState.formattingProvider = provider
    return disposable()
  },
  registerFoldingRangeProvider(
    selector: unknown,
    provider: { provideFoldingRanges: Handler },
  ) {
    mockState.foldingSelector = selector
    mockState.foldingProvider = provider
    return disposable()
  },
  registerDocumentSymbolProvider(
    selector: unknown,
    provider: { provideDocumentSymbols: Handler },
  ) {
    mockState.symbolSelector = selector
    mockState.symbolProvider = provider
    return disposable()
  },
  createDiagnosticCollection() {
    const entries = new Map<unknown, Diagnostic[]>()
    mockState.diagnostics = entries
    return {
      set(uri: unknown, diagnostics: Diagnostic[]) {
        entries.set(uri, diagnostics)
      },
      delete(uri: unknown) {
        entries.delete(uri)
      },
      clear() {
        entries.clear()
      },
      dispose() {},
    }
  },
  async setTextDocumentLanguage(
    document: MockDocument,
    languageId: string,
  ): Promise<MockDocument> {
    document.languageId = languageId
    mockState.languageChanges.push({ document, languageId })
    return document
  },
}
