import type { ConfigDefinition } from '../core/types.js'
import { formatSystemd } from '../formatters/systemd.js'

export const systemdConfig: ConfigDefinition = {
  id: 'systemd',
  displayName: 'systemd Unit',
  extensions: ['.service', '.socket', '.timer', '.path', '.mount', '.target'],
  patterns: ['**/systemd/system/**', '**/systemd/user/**'],
  detect(_filename, content) {
    let score = 0
    if (
      /^\s*\[(?:Unit|Install|Service|Socket|Timer|Path|Mount|Slice|Scope)\]\s*(?:[#;].*)?$/m.test(
        content,
      )
    ) {
      score += 40
    }
    if (
      /^\s*(?:ExecStart|ExecStartPre|ExecStartPost|ExecStop|ExecStopPost|ExecReload|Description|Documentation|After|Before|Wants|Requires|Requisite|BindsTo|PartOf|Conflicts|WantedBy|RequiredBy|UpheldBy|Alias|DefaultInstance|Type|RemainAfterExit|Restart|RestartSec|TimeoutStartSec|TimeoutStopSec|User|Group|SupplementaryGroups|WorkingDirectory|Environment|EnvironmentFile|StandardInput|StandardOutput|StandardError|SyslogIdentifier|OnCalendar|OnBootSec|OnStartupSec|OnUnitActiveSec|OnUnitInactiveSec|Persistent|AccuracySec|RandomizedDelaySec|ListenStream|ListenDatagram|ListenFIFO|RuntimeDirectory|StateDirectory|CacheDirectory|LogsDirectory|ConfigurationDirectory|ProtectSystem|ProtectHome|ProtectKernelTunables|ProtectKernelModules|ProtectControlGroups|NoNewPrivileges|PrivateTmp|PrivateDevices|PrivateNetwork|RestrictAddressFamilies|CapabilityBoundingSet|AmbientCapabilities|LimitNOFILE|TasksMax|MemoryMax|CPUQuota|KillMode|KillSignal|SendSIGKILL|SuccessExitStatus)\s*=/m.test(
        content,
      )
    ) {
      score += 35
    }
    return Math.min(score, 100)
  },
  languageId: 'confetti-systemd',
  formatter: formatSystemd,
}
