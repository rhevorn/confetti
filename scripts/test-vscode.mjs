import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { runTests } from '@vscode/test-electron'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function localExecutable() {
  const configured = process.env.CONFETTI_VSCODE_EXECUTABLE
  if (configured) return path.resolve(configured)

  const candidates =
    process.platform === 'darwin'
      ? ['/Applications/Visual Studio Code.app/Contents/MacOS/Code']
      : process.platform === 'win32'
        ? [
            path.join(
              process.env.LOCALAPPDATA ?? '',
              'Programs',
              'Microsoft VS Code',
              'Code.exe',
            ),
          ]
        : ['/usr/bin/code', '/usr/share/code/code', '/snap/bin/code']

  return candidates.find((candidate) => fs.existsSync(candidate))
}

const version = process.env.CONFETTI_VSCODE_VERSION
const executable = version ? undefined : localExecutable()

await runTests({
  ...(executable ? { vscodeExecutablePath: executable } : {}),
  ...(version ? { version } : {}),
  extensionDevelopmentPath: root,
  extensionTestsPath: path.join(root, 'test/vscode/suite/index.cjs'),
  launchArgs: [
    path.join(root, 'test/vscode/workspace'),
    '--disable-extensions',
  ],
})
