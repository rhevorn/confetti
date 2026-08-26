import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      vscode: fileURLToPath(new URL('./test/mocks/vscode.ts', import.meta.url)),
    },
  },
  test: {
    coverage: {
      provider: 'v8',
      include: [
        'src/configs/**/*.ts',
        'src/core/**/*.ts',
        'src/formatters/**/*.ts',
        'src/tokenizers/**/*.ts',
        'src/extension.ts',
        'src/language-compatibility.ts',
      ],
      exclude: ['src/core/types.ts'],
      reporter: ['text', 'json-summary'],
      all: true,
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
})
