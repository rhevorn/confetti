import type { ConfigDefinition } from '../core/types.js'

export const ignoreConfig: ConfigDefinition = {
  id: 'ignore',
  displayName: 'Ignore File',
  filenames: [
    '.gitignore',
    '.dockerignore',
    '.npmignore',
    '.prettierignore',
    '.eslintignore',
    '.stylelintignore',
    '.helmignore',
    '.ignore',
    '.cursorignore',
    '.cursorindexingignore',
    '.vscodeignore',
    '.vercelignore',
    '.netlifyignore',
    '.gcloudignore',
    '.terraformignore',
  ],
  patterns: ['.*ignore', '*.gitignore', '**/.git/info/exclude'],
  detect(_filename, content) {
    let score = 0
    if (/^\s*!?\*{1,2}\//m.test(content)) score += 35
    if (/^\s*!?(?:[^#\r\n]*\/)+[^\r\n]*$/m.test(content)) score += 25
    if (/^\s*![^\r\n]+$/m.test(content)) score += 20
    return Math.min(score, 100)
  },
  languageId: 'confetti-ignore',
}
