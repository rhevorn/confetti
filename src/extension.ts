import path from 'node:path'
import * as vscode from 'vscode'
import { createDefaultRegistry } from './configs/index.js'
import { detectConfig } from './core/detector.js'
import { formatConfig } from './core/formatter.js'
import type { ConfigDefinition, DetectionResult } from './core/types.js'
import { computeDiagnostics } from './features/diagnostics.js'
import { computeFoldingRanges } from './features/folding.js'
import { computeDocumentSymbols, type SymbolInfo } from './features/symbols.js'
import { isCompatibleLanguageId } from './language-compatibility.js'

const registry = createDefaultRegistry()
let outputChannel: vscode.OutputChannel | undefined

const SYMBOL_KINDS: Record<SymbolInfo['kind'], vscode.SymbolKind> = {
  section: vscode.SymbolKind.Namespace,
  table: vscode.SymbolKind.Namespace,
  host: vscode.SymbolKind.Struct,
  server: vscode.SymbolKind.Struct,
}

interface CachedDetection {
  version: number
  result: DetectionResult | undefined
}

const detectionCache = new Map<string, CachedDetection>()
const FORMATTING_PREVIEW_SCHEME = 'confetti-preview'

const builtinLanguageSelectors = ['ini', 'properties', 'toml', 'dotenv'].map(
  (language) => ({ language }),
)

// Providers cover both Confetti language modes and the canonical ids VS Code
// or other extensions may already have active for supported formats.
const languageSelectors = [
  ...registry.all().map((definition) => ({ language: definition.languageId })),
  ...builtinLanguageSelectors,
]

const formattingSelectors = [
  ...registry
    .all()
    .filter((definition) => definition.formatter)
    .map((definition) => ({ language: definition.languageId })),
  ...builtinLanguageSelectors,
]

function log(message: string): void {
  const timestamp = new Date().toLocaleTimeString()
  outputChannel?.appendLine(`[${timestamp}] ${message}`)
}

function settings(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration('confetti')
}

function isEnabled(id: string, setting: string): boolean {
  const formats = settings().get<string[]>(setting, [])
  return formats.length === 0 || formats.includes(id)
}

function configuredAssociations(): Readonly<Record<string, string>> {
  const value = settings().get<unknown>('associations', {})
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] =>
      entry.every((item) => typeof item === 'string'),
    ),
  )
}

function relativeDocumentPath(
  document: vscode.TextDocument,
): string | undefined {
  const folder = vscode.workspace.getWorkspaceFolder(document.uri)
  if (!folder || !document.uri.fsPath) return undefined
  return path.relative(folder.uri.fsPath, document.uri.fsPath)
}

function formattingPreviewUri(document: vscode.TextDocument): vscode.Uri {
  return vscode.Uri.from({
    scheme: FORMATTING_PREVIEW_SCHEME,
    path: document.uri.path,
    query: encodeURIComponent(document.uri.toString()),
  })
}

function logInvalidAssociations(): void {
  const invalid = Object.entries(configuredAssociations()).filter(
    ([, id]) => !registry.get(id),
  )
  for (const [pattern, id] of invalid) {
    log(`Association ignored | unknown format=${id} | pattern=${pattern}`)
  }
}

function detect(document: vscode.TextDocument): DetectionResult | undefined {
  const cached = detectionCache.get(document.uri.toString())
  if (cached && cached.version === document.version) return cached.result

  const result = detectConfig(
    registry,
    document.uri.fsPath || document.fileName,
    document.getText(),
    {
      associations: configuredAssociations(),
      relativePath: relativeDocumentPath(document),
    },
  )

  detectionCache.set(document.uri.toString(), {
    version: document.version,
    result,
  })
  return result
}

function detectionSignalLabel(
  kind: DetectionResult['signals'][number]['kind'],
) {
  const labels = {
    association: 'User association',
    filename: 'Filename',
    pattern: 'Path pattern',
    extension: 'Extension',
    content: 'Content',
  } as const
  return labels[kind]
}

function showDetectionDetails(
  document: vscode.TextDocument,
  result: DetectionResult | undefined,
): void {
  log(`Detection details | ${document.uri.fsPath || document.fileName}`)
  if (!result) {
    outputChannel?.appendLine('  No supported configuration type detected.')
    outputChannel?.show(true)
    return
  }

  outputChannel?.appendLine(
    `  Detected: ${result.definition.displayName} (${result.confidence}%)`,
  )
  outputChannel?.appendLine('  Evidence:')
  for (const signal of result.signals) {
    outputChannel?.appendLine(
      `    ${detectionSignalLabel(signal.kind)}: ${signal.label} (+${signal.score})`,
    )
  }

  const alternatives = result.candidates.filter(
    ({ definition }) => definition.id !== result.definition.id,
  )
  if (alternatives.length > 0) {
    outputChannel?.appendLine('  Other candidates:')
    for (const candidate of alternatives.slice(0, 5)) {
      outputChannel?.appendLine(
        `    ${candidate.definition.displayName}: ${candidate.confidence}%`,
      )
    }
  }
  outputChannel?.show(true)
}

function definitionForDocument(
  document: vscode.TextDocument,
): ConfigDefinition | undefined {
  return (
    registry.getByLanguageId(document.languageId) ??
    detect(document)?.definition
  )
}

function formattingEdits(
  document: vscode.TextDocument,
  trigger: string,
): vscode.TextEdit[] {
  const startedAt = performance.now()
  if (!settings().get('format.enable', true)) {
    log(`${trigger} | skipped: formatting disabled | ${document.uri.fsPath}`)
    return []
  }

  const definition = definitionForDocument(document)
  if (!definition?.formatter) {
    log(
      `${trigger} | skipped: unsupported configuration | language=${document.languageId} | ${document.uri.fsPath}`,
    )
    return []
  }

  if (!isEnabled(definition.id, 'format.formats')) {
    log(
      `${trigger} | skipped: formatting not enabled for ${definition.id} | ${document.uri.fsPath}`,
    )
    return []
  }

  const original = document.getText()
  const formatted = formatConfig(registry, definition.languageId, original)
  const elapsed = (performance.now() - startedAt).toFixed(2)
  if (formatted === original) {
    log(
      `${trigger} | ${definition.displayName} | no changes | ${elapsed}ms | ${document.uri.fsPath}`,
    )
    return []
  }

  log(
    `${trigger} | ${definition.displayName} | edit produced | ${elapsed}ms | ${document.uri.fsPath}`,
  )

  const entireDocument = new vscode.Range(
    document.positionAt(0),
    document.positionAt(original.length),
  )
  return [vscode.TextEdit.replace(entireDocument, formatted)]
}

async function detectAndApply(
  document: vscode.TextDocument,
  showMessage = false,
  respectAutoDetectFormats = false,
): Promise<DetectionResult | undefined> {
  const result = detect(document)
  if (!result) {
    if (showMessage) {
      void vscode.window.showInformationMessage(
        'Confetti could not identify this configuration file with enough confidence.',
      )
    }
    return undefined
  }

  if (
    (!respectAutoDetectFormats ||
      isEnabled(result.definition.id, 'autoDetectFormats')) &&
    !isCompatibleLanguageId(
      result.definition.id,
      result.definition.languageId,
      document.languageId,
    )
  ) {
    await vscode.languages.setTextDocumentLanguage(
      document,
      result.definition.languageId,
    )
  }

  if (showMessage) {
    void vscode.window.showInformationMessage(
      `Detected: ${result.definition.displayName} (${result.confidence}%)`,
    )
  }
  return result
}

async function autoDetect(document: vscode.TextDocument): Promise<void> {
  if (!settings().get('autoDetect', true) || document.uri.scheme !== 'file')
    return
  await detectAndApply(document, false, true)
}

export function activate(context: vscode.ExtensionContext): void {
  detectionCache.clear()
  outputChannel = vscode.window.createOutputChannel('Confetti')
  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection('confetti')
  log('Extension activated')
  logInvalidAssociations()
  const foldingChanged = new vscode.EventEmitter<void>()
  const previewChanged = new vscode.EventEmitter<vscode.Uri>()
  const previewContents = new Map<string, string>()

  const featureCache = new Map<
    string,
    {
      version: number
      folding: vscode.FoldingRange[]
      symbols: vscode.DocumentSymbol[]
    }
  >()
  const updateFeatures = (document: vscode.TextDocument): void => {
    const definition = definitionForDocument(document)
    const text = definition ? document.getText() : ''
    featureCache.set(document.uri.toString(), {
      version: document.version,
      folding: definition
        ? computeFoldingRanges(definition.id, text).map(
            ({ startLine, endLine }) =>
              new vscode.FoldingRange(startLine, endLine),
          )
        : [],
      symbols: definition
        ? computeDocumentSymbols(definition.id, text).map(
            (symbol) =>
              new vscode.DocumentSymbol(
                symbol.name,
                '',
                SYMBOL_KINDS[symbol.kind],
                new vscode.Range(
                  new vscode.Position(symbol.startLine, symbol.startCharacter),
                  new vscode.Position(symbol.endLine, symbol.endCharacter),
                ),
                new vscode.Range(
                  new vscode.Position(symbol.startLine, symbol.startCharacter),
                  new vscode.Position(
                    symbol.startLine,
                    symbol.headerEndCharacter,
                  ),
                ),
              ),
          )
        : [],
    })
    foldingChanged.fire()
  }
  const cachedFeatures = (document: vscode.TextDocument) => {
    const cached = featureCache.get(document.uri.toString())
    return cached?.version === document.version ? cached : undefined
  }

  const updateDiagnostics = (document: vscode.TextDocument): void => {
    const uri = document.uri
    if (!settings().get('diagnostics.enable', true)) {
      diagnosticCollection.delete(uri)
      return
    }

    const definition = definitionForDocument(document)
    if (!definition) {
      diagnosticCollection.delete(uri)
      return
    }

    diagnosticCollection.set(
      uri,
      computeDiagnostics(definition.id, document.getText()).map(
        (diagnostic) =>
          new vscode.Diagnostic(
            new vscode.Range(
              new vscode.Position(diagnostic.line, diagnostic.startCharacter),
              new vscode.Position(diagnostic.line, diagnostic.endCharacter),
            ),
            diagnostic.message,
            vscode.DiagnosticSeverity.Warning,
          ),
      ),
    )
  }

  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  )
  statusBarItem.command = 'confetti.showDetectionInfo'

  const updateStatusBar = (document: vscode.TextDocument | undefined): void => {
    if (!document) {
      statusBarItem.hide()
      return
    }
    const result = detect(document)
    if (!result) {
      statusBarItem.hide()
      return
    }
    const text = `$(eye) ${result.definition.displayName} ${result.confidence}%`
    if (statusBarItem.text !== text) statusBarItem.text = text
    statusBarItem.show()
  }

  context.subscriptions.push(
    outputChannel,
    diagnosticCollection,
    statusBarItem,
    foldingChanged,
    previewChanged,
    vscode.workspace.registerTextDocumentContentProvider(
      FORMATTING_PREVIEW_SCHEME,
      {
        onDidChange: previewChanged.event,
        provideTextDocumentContent(uri) {
          return previewContents.get(uri.toString()) ?? ''
        },
      },
    ),
    vscode.commands.registerCommand('confetti.detectConfigType', async () => {
      const document = vscode.window.activeTextEditor?.document
      if (document) {
        await detectAndApply(document, true)
        updateFeatures(document)
        updateDiagnostics(document)
        updateStatusBar(document)
      }
    }),
    vscode.commands.registerCommand('confetti.showDetectionInfo', () => {
      const document = vscode.window.activeTextEditor?.document
      if (!document) return
      const result = detect(document)
      showDetectionDetails(document, result)
      const message = result
        ? `Detected: ${result.definition.displayName} — Confidence: ${result.confidence}%`
        : 'No supported configuration type was detected.'
      void vscode.window.showInformationMessage(message)
    }),
    vscode.commands.registerCommand('confetti.showOutput', () => {
      outputChannel?.show(true)
    }),
    vscode.commands.registerCommand('confetti.previewFormatting', async () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) return

      if (!settings().get('format.enable', true)) {
        void vscode.window.showWarningMessage(
          'Confetti formatting is disabled by confetti.format.enable.',
        )
        return
      }

      const definition = definitionForDocument(editor.document)
      if (
        definition?.formatter &&
        !isEnabled(definition.id, 'format.formats')
      ) {
        void vscode.window.showWarningMessage(
          `Confetti formatting is not enabled for ${definition.displayName}.`,
        )
        return
      }

      const edits = formattingEdits(
        editor.document,
        'Confetti: Preview Formatting',
      )
      if (edits.length === 0) {
        void vscode.window.showInformationMessage(
          definition?.formatter
            ? `${definition.displayName} is already formatted.`
            : definition
              ? `Confetti does not provide a formatter for ${definition.displayName}.`
              : 'Confetti could not detect a supported configuration type.',
        )
        return
      }

      const previewUri = formattingPreviewUri(editor.document)
      previewContents.set(previewUri.toString(), edits[0].newText)
      previewChanged.fire(previewUri)
      let preview = await vscode.workspace.openTextDocument(previewUri)
      if (preview.languageId !== editor.document.languageId) {
        preview = await vscode.languages.setTextDocumentLanguage(
          preview,
          editor.document.languageId,
        )
      }
      await vscode.commands.executeCommand(
        'vscode.diff',
        editor.document.uri,
        preview.uri,
        `Confetti Preview: ${path.basename(editor.document.fileName)}`,
        { preview: true },
      )
      log(
        `Confetti: Preview Formatting | opened | ${editor.document.uri.fsPath}`,
      )
    }),
    vscode.commands.registerCommand('confetti.formatConfig', async () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) return

      if (!settings().get('format.enable', true)) {
        void vscode.window.showWarningMessage(
          'Confetti formatting is disabled by confetti.format.enable.',
        )
        return
      }

      const edits = formattingEdits(editor.document, 'Confetti: Format Config')
      if (edits.length === 0) {
        const definition = definitionForDocument(editor.document)
        void vscode.window.showInformationMessage(
          definition?.formatter
            ? `${definition.displayName} is already formatted.`
            : definition
              ? `Confetti does not provide a formatter for ${definition.displayName}.`
              : 'Confetti could not detect a supported configuration type.',
        )
        return
      }

      const applied = await editor.edit((builder) => {
        for (const edit of edits) builder.replace(edit.range, edit.newText)
      })
      if (applied) {
        const definition = definitionForDocument(editor.document)
        const displayName =
          definition?.displayName ?? editor.document.languageId
        log(`Confetti: Format Config | ${displayName} | edit applied`)
        vscode.window.setStatusBarMessage(
          `$(check) Confetti formatted ${displayName}`,
          3000,
        )
      } else {
        log('Confetti: Format Config | edit rejected by editor')
        void vscode.window.showWarningMessage(
          'Confetti could not apply the formatting edit.',
        )
      }
    }),
    vscode.languages.registerFoldingRangeProvider(languageSelectors, {
      onDidChangeFoldingRanges: foldingChanged.event,
      provideFoldingRanges(document) {
        return cachedFeatures(document)?.folding ?? []
      },
    }),
    vscode.languages.registerDocumentSymbolProvider(languageSelectors, {
      provideDocumentSymbols(document) {
        return cachedFeatures(document)?.symbols ?? []
      },
    }),
    vscode.languages.registerDocumentFormattingEditProvider(
      formattingSelectors,
      {
        provideDocumentFormattingEdits(document) {
          return formattingEdits(document, 'Format Document provider')
        },
      },
    ),
    vscode.workspace.onDidOpenTextDocument((document) => {
      void autoDetect(document)
      updateFeatures(document)
      updateDiagnostics(document)
      updateStatusBar(document)
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      void autoDetect(document)
      updateFeatures(document)
      updateDiagnostics(document)
      updateStatusBar(document)
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      detectionCache.delete(document.uri.toString())
      featureCache.delete(document.uri.toString())
      diagnosticCollection.delete(document.uri)
      if (document.uri.scheme !== FORMATTING_PREVIEW_SCHEME) {
        previewContents.delete(formattingPreviewUri(document).toString())
      }
      updateStatusBar(vscode.window.activeTextEditor?.document)
    }),
    // Diagnostics do not follow edits, so drop stale ranges immediately. This
    // stays O(1) — no rescan ever runs while typing; fresh diagnostics are
    // computed on the next save or editor switch.
    vscode.workspace.onDidChangeTextDocument((event) => {
      featureCache.delete(event.document.uri.toString())
      diagnosticCollection.delete(event.document.uri)
      foldingChanged.fire()
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration('confetti')) return

      const associationsChanged = event.affectsConfiguration(
        'confetti.associations',
      )
      if (associationsChanged) {
        detectionCache.clear()
        featureCache.clear()
        logInvalidAssociations()
      }

      if (event.affectsConfiguration('confetti.diagnostics.enable')) {
        if (!settings().get('diagnostics.enable', true)) {
          diagnosticCollection.clear()
        } else {
          for (const document of vscode.workspace.textDocuments) {
            updateDiagnostics(document)
          }
        }
      }

      const activeDocument = vscode.window.activeTextEditor?.document
      if (
        activeDocument &&
        (event.affectsConfiguration('confetti.autoDetect') ||
          event.affectsConfiguration('confetti.autoDetectFormats') ||
          associationsChanged)
      ) {
        void autoDetect(activeDocument)
      }
      if (activeDocument && associationsChanged) {
        updateFeatures(activeDocument)
        updateDiagnostics(activeDocument)
      }
      updateStatusBar(activeDocument)
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        void autoDetect(editor.document)
        updateFeatures(editor.document)
        updateDiagnostics(editor.document)
      }
      updateStatusBar(editor?.document)
    }),
  )

  if (vscode.window.activeTextEditor) {
    void autoDetect(vscode.window.activeTextEditor.document)
    updateFeatures(vscode.window.activeTextEditor.document)
    updateDiagnostics(vscode.window.activeTextEditor.document)
    updateStatusBar(vscode.window.activeTextEditor.document)
  }
}

export function deactivate(): void {}
