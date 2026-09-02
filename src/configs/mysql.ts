import type { ConfigDefinition } from '../core/types.js'
import { formatMyCnf } from '../formatters/mysql.js'

export const mysqlConfig: ConfigDefinition = {
  id: 'mysql',
  displayName: 'MySQL Config',
  filenames: ['my.cnf', '.my.cnf'],
  patterns: ['*/mysql/*.cnf', '*/mariadb/*.cnf'],
  detect(_filename, content) {
    let score = 0
    if (
      /^\s*\[(?:client|mysqld|mysqldump|mysqld_safe|mysql|server|galera)\]\s*(?:[;#].*)?$/m.test(
        content,
      )
    ) {
      score += 40
    }
    if (
      /^\s*(?:basedir|datadir|port|socket|bind-address|character-set-server|collation-server|max_connections|default-storage-engine|log-error|slow_query_log|tmpdir|user)\s*=/m.test(
        content,
      )
    ) {
      score += 25
    }
    return Math.min(score, 100)
  },
  languageId: 'confetti-mysql',
  formatter: formatMyCnf,
}
