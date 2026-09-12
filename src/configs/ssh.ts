import type { ConfigDefinition } from '../core/types.js'
import { formatSsh } from '../formatters/ssh.js'

export const sshConfig: ConfigDefinition = {
  id: 'ssh',
  displayName: 'SSH Config',
  filenames: ['ssh_config', 'sshd_config'],
  patterns: ['.ssh/config', '**/.ssh/config', '**/ssh/ssh*_config'],
  detect(filename, content) {
    let score = filename.includes('/.ssh/') ? 45 : 0
    if (/^\s*(?:Host|Match)\s+\S+/m.test(content)) score += 35
    if (/^\s*(?:HostName|User|IdentityFile|ProxyJump)\s+\S+/m.test(content)) {
      score += 35
    }
    if (
      /^\s*(?:PermitRootLogin|PasswordAuthentication|AuthorizedKeysFile)\s+/m.test(
        content,
      )
    ) {
      score += 35
    }
    return Math.min(score, 100)
  },
  languageId: 'confetti-ssh',
  formatter: formatSsh,
}
