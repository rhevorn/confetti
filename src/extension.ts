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
const detectionCache = new Map<string, DetectionResult>()
let outputChannel: vscode.OutputChannel | undefined

const SYMBOL_KINDS: Record<SymbolInfo['kind'], vscode.SymbolKind> = {
  section: vscode.SymbolKind.Namespace,
  table: vscode.SymbolKind.Namespace,
  host: vscode.SymbolKind.Struct,
  server: vscode.SymbolKind.Struct,
}

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

function detect(document: vscode.TextDocument): DetectionResult | undefined {
  const result = detectConfig(
    registry,
    document.uri.fsPath || document.fileName,
    document.getText(),
  )

  if (result) detectionCache.set(document.uri.toString(), result)
  else detectionCache.delete(document.uri.toString())
  return result
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
    isEnabled(result.definition.id, 'autoDetect.formats') &&
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
  await detectAndApply(document)
}

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel('Confetti')
  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection('confetti')
  log('Extension activated')

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
    const result =
      detectionCache.get(document.uri.toString()) ?? detect(document)
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
    vscode.commands.registerCommand('confetti.detectConfigType', async () => {
      const document = vscode.window.activeTextEditor?.document
      if (document) await detectAndApply(document, true)
    }),
    vscode.commands.registerCommand('confetti.showDetectionInfo', () => {
      const document = vscode.window.activeTextEditor?.document
      if (!document) return
      const result =
        detectionCache.get(document.uri.toString()) ?? detect(document)
      const message = result
        ? `Detected: ${result.definition.displayName} — Confidence: ${result.confidence}%`
        : 'No supported configuration type was detected.'
      void vscode.window.showInformationMessage(message)
    }),
    vscode.commands.registerCommand('confetti.showOutput', () => {
      outputChannel?.show(true)
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
    vscode.languages.registerFoldingRangeProvider(
      registry.all().map((definition) => ({ language: definition.languageId })),
      {
        provideFoldingRanges(document) {
          const definition = definitionForDocument(document)
          if (!definition) return []
          return computeFoldingRanges(definition.id, document.getText()).map(
            ({ startLine, endLine }) =>
              new vscode.FoldingRange(startLine, endLine),
          )
        },
      },
    ),
    vscode.languages.registerDocumentSymbolProvider(
      registry.all().map((definition) => ({ language: definition.languageId })),
      {
        provideDocumentSymbols(document) {
          const definition = definitionForDocument(document)
          if (!definition) return []
          return computeDocumentSymbols(definition.id, document.getText()).map(
            (symbol) => {
              const selection = new vscode.Range(
                new vscode.Position(symbol.startLine, symbol.startCharacter),
                new vscode.Position(
                  symbol.startLine,
                  symbol.headerEndCharacter,
                ),
              )
              return new vscode.DocumentSymbol(
                symbol.name,
                '',
                SYMBOL_KINDS[symbol.kind],
                new vscode.Range(
                  new vscode.Position(symbol.startLine, symbol.startCharacter),
                  new vscode.Position(symbol.endLine, symbol.endCharacter),
                ),
                selection,
              )
            },
          )
        },
      },
    ),
    vscode.languages.registerDocumentFormattingEditProvider(
      [
        ...registry
          .all()
          .filter((definition) => definition.formatter)
          .map((definition) => ({ language: definition.languageId })),
        ...['ini', 'properties', 'toml', 'dotenv'].map((language) => ({
          language,
        })),
      ],
      {
        provideDocumentFormattingEdits(document) {
          return formattingEdits(document, 'Format Document provider')
        },
      },
    ),
    vscode.workspace.onDidOpenTextDocument((document) => {
      void autoDetect(document)
      updateDiagnostics(document)
      updateStatusBar(document)
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      void autoDetect(document)
      updateDiagnostics(document)
      updateStatusBar(document)
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      detectionCache.delete(document.uri.toString())
      diagnosticCollection.delete(document.uri)
      updateStatusBar(vscode.window.activeTextEditor?.document)
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        void autoDetect(editor.document)
        updateDiagnostics(editor.document)
      }
      updateStatusBar(editor?.document)
    }),
  )

  if (vscode.window.activeTextEditor) {
    void autoDetect(vscode.window.activeTextEditor.document)
    updateDiagnostics(vscode.window.activeTextEditor.document)
    updateStatusBar(vscode.window.activeTextEditor.document)
  }
}

export function deactivate(): void {}
