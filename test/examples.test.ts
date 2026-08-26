import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createDefaultRegistry } from '../src/configs/index.js'
import { detectConfig } from '../src/core/detector.js'
import { formatConfig } from '../src/core/formatter.js'

const registry = createDefaultRegistry()
const examplesDirectory = path.join(process.cwd(), 'examples')

interface ExampleCase {
  relativePath: string
  expectedType?: string
  preservedText?: string
}

const examples: ExampleCase[] = [
  {
    relativePath: 'nginx/nginx.conf',
    expectedType: 'nginx',
    preservedText: 'a # sign and { braces } inside a string',
  },
  {
    relativePath: 'nginx/site.conf',
    expectedType: 'nginx',
    preservedText: 'proxy_pass http://127.0.0.1:8080;',
  },
  {
    relativePath: 'nginx/spacing.conf',
    expectedType: 'nginx',
    preservedText: '"keep  two   spaces # { }"',
  },
  {
    relativePath: '.ssh/config',
    expectedType: 'ssh',
    preservedText: 'exec $SHELL',
  },
  {
    relativePath: 'ssh/sshd_config',
    expectedType: 'ssh',
    preservedText: '.ssh/authorized_keys2',
  },
  {
    relativePath: 'env/.env.local',
    expectedType: 'env',
    preservedText: '"keep  two  spaces"',
  },
  {
    relativePath: 'ini/settings.ini',
    expectedType: 'ini',
    preservedText: '"keep  internal  spaces"',
  },
  {
    relativePath: 'ini/.editorconfig',
    expectedType: 'ini',
    preservedText: 'insert_final_newline',
  },
  {
    relativePath: 'properties/messages.properties',
    expectedType: 'properties',
    preservedText: 'second part keeps its indentation',
  },
  {
    relativePath: 'toml/pyproject.toml',
    expectedType: 'toml',
    preservedText: 'The text may contain # signs and = characters.',
  },
  {
    relativePath: 'git/.gitconfig',
    expectedType: 'gitconfig',
    preservedText: '+refs/heads/*:refs/remotes/origin/*',
  },
  {
    relativePath: 'npm/.npmrc',
    expectedType: 'npmrc',
    preservedText: '${NPM_TOKEN}',
  },
  {
    relativePath: 'yaml/compose.yaml',
    expectedType: 'yaml',
    preservedText: 'block scalar # and = content must stay intact',
  },
  { relativePath: 'unknown/application.conf' },
]

describe('manual examples', () => {
  it.each(examples)(
    '$relativePath detects as $expectedType and formats safely',
    ({ relativePath, expectedType, preservedText }) => {
      const filename = path.join(examplesDirectory, relativePath)
      const content = fs.readFileSync(filename, 'utf8')
      const detection = detectConfig(registry, filename, content)

      expect(detection?.definition.id).toBe(expectedType)
      if (!detection) return

      const formatted = formatConfig(
        registry,
        detection.definition.languageId,
        content,
      )
      expect(
        formatConfig(registry, detection.definition.languageId, formatted),
      ).toBe(formatted)
      if (preservedText) expect(formatted).toContain(preservedText)
    },
  )
})
