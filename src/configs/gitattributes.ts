import type { ConfigDefinition } from '../core/types.js'
import { formatGitAttributes } from '../formatters/gitattributes.js'

export const gitAttributesConfig: ConfigDefinition = {
  id: 'gitattributes',
  displayName: 'Git Attributes',
  filenames: ['.gitattributes'],
  patterns: ['*/.git/info/attributes'],
  detect(_filename, content) {
    let score = 0
    if (
      /^\s*\S*(?:[*?/]|\x5b|\\\s)\S*\s+(?:-?[A-Za-z][\w-]*|[A-Za-z][\w-]*=\S+)/m.test(
        content,
      )
    ) {
      score += 60
    }
    if (
      /\b(?:eol|diff|merge|filter|working-tree-encoding|linguist-language)=\S+/.test(
        content,
      )
    ) {
      score += 20
    }
    return Math.min(score, 100)
  },
  languageId: 'confetti-gitattributes',
  formatter: formatGitAttributes,
}
