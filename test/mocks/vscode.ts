type Handler = (...arguments_: unknown[]) => unknown

interface MockDocument {
  languageId: string
}

interface MockEditor {
  document: MockDocument
}

export const mockState = {
  configuration: new Map<string, unknown>(),
  commandHandlers: new Map<string, Handler>(),
  formattingProvider: undefined as
    { provideDocumentFormattingEdits: Handler } | undefined,
  formattingSelector: undefined as unknown,
  foldingProvider: undefined as { provideFoldingRanges: Handler } | undefined,
  foldingSelector: undefined as unknown,
  openHandlers: [] as Handler[],
  saveHandlers: [] as Handler[],
  closeHandlers: [] as Handler[],
  activeEditorHandlers: [] as Handler[],
  activeEditor: undefined as MockEditor | undefined,
  informationMessages: [] as string[],
  warningMessages: [] as string[],
  statusMessages: [] as string[],
  outputLines: [] as string[],
  outputShown: false,
  languageChanges: [] as Array<{ document: MockDocument; languageId: string }>,
}

export function resetMockState(): void {
  mockState.configuration.clear()
  mockState.commandHandlers.clear()
  mockState.formattingProvider = undefined
  mockState.formattingSelector = undefined
  mockState.foldingProvider = undefined
  mockState.foldingSelector = undefined
  mockState.openHandlers.length = 0
  mockState.saveHandlers.length = 0
  mockState.closeHandlers.length = 0
  mockState.activeEditorHandlers.length = 0
  mockState.activeEditor = undefined
  mockState.informationMessages.length = 0
  mockState.warningMessages.length = 0
  mockState.statusMessages.length = 0
  mockState.outputLines.length = 0
  mockState.outputShown = false
  mockState.languageChanges.length = 0
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

export const workspace = {
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
  async setTextDocumentLanguage(
    document: MockDocument,
    languageId: string,
  ): Promise<MockDocument> {
    document.languageId = languageId
    mockState.languageChanges.push({ document, languageId })
    return document
  },
}
