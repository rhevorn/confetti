import type { ConfigDefinition } from '../core/types.js'
import { formatGitConfig } from '../formatters/gitconfig.js'

export const gitConfig: ConfigDefinition = {
  id: 'gitconfig',
  displayName: 'Git Config',
  filenames: ['.gitconfig', '.gitmodules'],
  patterns: ['*/.git/config', '*/.config/git/config'],
  detect(filename, content) {
    let score = filename.endsWith('/.git/config') ? 35 : 0
    if (
      /^\s*\[(?:core|user|remote|branch|credential|include)(?:\s+"[^"]+")?\]\s*$/m.test(
        content,
      )
    ) {
      score += 40
    }
    if (
      /^\s*(?:url|email|name|editor|autocrlf|helper)\s*=\s*.+$/m.test(content)
    ) {
      score += 25
    }
    return Math.min(score, 100)
  },
  languageId: 'confetti-gitconfig',
  formatter: formatGitConfig,
}
