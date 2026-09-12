import type { ConfigDefinition } from '../core/types.js'
import { formatTmux } from '../formatters/tmux.js'

export const tmuxConfig: ConfigDefinition = {
  id: 'tmux',
  displayName: 'tmux Config',
  filenames: ['tmux.conf'],
  patterns: ['**/.tmux.conf', '**/.config/tmux/tmux.conf'],
  detect(_filename, content) {
    let score = 0
    if (/^\s*(?:set|setw|set-option|set-window-option)\s+-g\b/m.test(content)) {
      score += 40
    }
    if (
      /^\s*(?:bind(?:-key)?|unbind(?:-key)?|setenv|set-environment|source(?:-file)?)\s+-?\S/m.test(
        content,
      )
    ) {
      score += 20
    }
    return Math.min(score, 100)
  },
  languageId: 'confetti-tmux',
  formatter: formatTmux,
}
