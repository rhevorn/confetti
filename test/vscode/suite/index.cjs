const assert = require('node:assert/strict')
const vscode = require('vscode')

async function waitFor(description, predicate, timeout = 5000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const value = await predicate()
    if (value) return value
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error(`Timed out waiting for ${description}`)
}

async function open(relativePath) {
  const root = vscode.workspace.workspaceFolders[0].uri
  const document = await vscode.workspace.openTextDocument(
    vscode.Uri.joinPath(root, relativePath),
  )
  await vscode.window.showTextDocument(document)
  return document
}

async function setSetting(key, value) {
  await vscode.workspace
    .getConfiguration('confetti')
    .update(key, value, vscode.ConfigurationTarget.Global)
}

module.exports.run = async function run() {
  const extension = vscode.extensions.getExtension('rhevorn.confetti')
  assert.ok(extension, 'Confetti extension is available in the test host')
  await extension.activate()

  try {
    await setSetting('autoDetect', true)
    await setSetting('autoDetectFormats', ['ssh'])
    await setSetting('diagnostics.enable', true)
    await setSetting('format.enable', true)
    await setSetting('format.formats', [])

    let nginx = await open('nginx.conf')
    assert.deepEqual(
      vscode.workspace.getConfiguration('confetti').get('autoDetectFormats'),
      ['ssh'],
    )
    await vscode.languages.setTextDocumentLanguage(nginx, 'plaintext')
    await new Promise((resolve) => setTimeout(resolve, 100))
    assert.equal(
      nginx.languageId,
      'plaintext',
      'automatic detection respects its whitelist',
    )
    await vscode.commands.executeCommand('confetti.detectConfigType')
    assert.equal(
      nginx.languageId,
      'confetti-nginx',
      'the explicit command overrides the automatic-detection whitelist',
    )

    const edits = await vscode.commands.executeCommand(
      'vscode.executeFormatDocumentProvider',
      nginx.uri,
      { insertSpaces: true, tabSize: 2 },
    )
    assert.ok(Array.isArray(edits) && edits.length > 0)
    const workspaceEdit = new vscode.WorkspaceEdit()
    workspaceEdit.set(nginx.uri, edits)
    assert.equal(await vscode.workspace.applyEdit(workspaceEdit), true)
    assert.equal(nginx.getText(), 'server {\n  listen 80;\n}\n')
    await vscode.commands.executeCommand(
      'workbench.action.revertAndCloseActiveEditor',
    )
    nginx = await open('nginx.conf')
    assert.equal(nginx.getText(), 'server{\nlisten 80 ;\n}\n')
    await vscode.commands.executeCommand('confetti.detectConfigType')

    const folding = await waitFor('Nginx folding ranges', async () => {
      const ranges = await vscode.commands.executeCommand(
        'vscode.executeFoldingRangeProvider',
        nginx.uri,
      )
      return Array.isArray(ranges) && ranges.length > 0 ? ranges : undefined
    })
    assert.deepEqual(
      folding.map(({ start, end }) => [start, end]),
      [[0, 2]],
    )

    const symbols = await waitFor('Nginx outline symbols', async () => {
      const items = await vscode.commands.executeCommand(
        'vscode.executeDocumentSymbolProvider',
        nginx.uri,
      )
      return Array.isArray(items) && items.length > 0 ? items : undefined
    })
    assert.equal(symbols[0].name, 'server')

    const sourceBeforePreview = nginx.getText()
    await vscode.commands.executeCommand('confetti.previewFormatting')
    await waitFor('read-only formatting preview', () =>
      vscode.window.visibleTextEditors.some(
        (editor) =>
          editor.document.uri.scheme === 'confetti-preview' &&
          editor.document.getText() === 'server {\n  listen 80;\n}\n',
      ),
    )
    assert.equal(
      nginx.getText(),
      sourceBeforePreview,
      'formatting preview does not edit the source document',
    )
    await new Promise((resolve) => setTimeout(resolve, 100))
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor')

    await setSetting('autoDetectFormats', [])
    await setSetting('associations', { 'deploy/proxy.conf': 'caddy' })
    const associated = await open('deploy/proxy.conf')
    await waitFor(
      'workspace-relative association',
      () => associated.languageId === 'confetti-caddy',
    )
    await vscode.commands.executeCommand('confetti.showDetectionInfo')

    const env = await open('.env')
    await waitFor('dotenv duplicate-key diagnostic', () => {
      const diagnostics = vscode.languages.getDiagnostics(env.uri)
      return diagnostics.some((item) => item.message.includes('Duplicate key'))
    })

    await setSetting('diagnostics.enable', false)
    await waitFor(
      'diagnostics to clear after disabling the setting',
      () => vscode.languages.getDiagnostics(env.uri).length === 0,
    )

    await setSetting('diagnostics.enable', true)
    await waitFor('diagnostics to return after enabling the setting', () =>
      vscode.languages
        .getDiagnostics(env.uri)
        .some((item) => item.message.includes('Duplicate key')),
    )

    console.log('Confetti VS Code integration tests passed')
  } finally {
    await setSetting('autoDetect', undefined)
    await setSetting('autoDetectFormats', undefined)
    await setSetting('associations', undefined)
    await setSetting('diagnostics.enable', undefined)
    await setSetting('format.enable', undefined)
    await setSetting('format.formats', undefined)
    await vscode.commands.executeCommand('workbench.action.closeAllEditors')
  }
}
