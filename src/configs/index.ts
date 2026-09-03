import { ConfigRegistry } from '../core/registry.js'
import { apacheConfig } from './apache.js'
import { browserslistConfig } from './browserslist.js'
import { caddyConfig } from './caddy.js'
import { crontabConfig } from './crontab.js'
import { envConfig } from './env.js'
import { fstabConfig } from './fstab.js'
import { gitConfig } from './gitconfig.js'
import { gitAttributesConfig } from './gitattributes.js'
import { hostsConfig } from './hosts.js'
import { ignoreConfig } from './ignore.js'
import { iniConfig } from './ini.js'
import { inputrcConfig } from './inputrc.js'
import { mysqlConfig } from './mysql.js'
import { nginxConfig } from './nginx.js'
import { npmrcConfig } from './npmrc.js'
import { pipConfig } from './pip.js'
import { pyiniConfig } from './pyini.js'
import { propertiesConfig } from './properties.js'
import { screenConfig } from './screen.js'
import { setupCfgConfig } from './setupcfg.js'
import { sshConfig } from './ssh.js'
import { systemdConfig } from './systemd.js'
import { tmuxConfig } from './tmux.js'
import { tomlConfig } from './toml.js'
import { versionsConfig } from './versions.js'
import { yarnrcConfig } from './yarnrc.js'
import { yamlConfig } from './yaml.js'

export function createDefaultRegistry(): ConfigRegistry {
  const registry = new ConfigRegistry()
  registry.register(nginxConfig)
  registry.register(apacheConfig)
  registry.register(sshConfig)
  registry.register(systemdConfig)
  registry.register(envConfig)
  registry.register(iniConfig)
  registry.register(mysqlConfig)
  registry.register(pipConfig)
  registry.register(pyiniConfig)
  registry.register(setupCfgConfig)
  registry.register(propertiesConfig)
  registry.register(tomlConfig)
  registry.register(gitConfig)
  registry.register(npmrcConfig)
  registry.register(yarnrcConfig)
  registry.register(yamlConfig)
  registry.register(ignoreConfig)
  registry.register(gitAttributesConfig)
  registry.register(browserslistConfig)
  registry.register(caddyConfig)
  registry.register(versionsConfig)
  registry.register(hostsConfig)
  registry.register(fstabConfig)
  registry.register(crontabConfig)
  registry.register(tmuxConfig)
  registry.register(screenConfig)
  registry.register(inputrcConfig)
  return registry
}
