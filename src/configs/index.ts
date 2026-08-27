import { ConfigRegistry } from '../core/registry.js'
import { browserslistConfig } from './browserslist.js'
import { crontabConfig } from './crontab.js'
import { envConfig } from './env.js'
import { fstabConfig } from './fstab.js'
import { gitConfig } from './gitconfig.js'
import { gitAttributesConfig } from './gitattributes.js'
import { hostsConfig } from './hosts.js'
import { ignoreConfig } from './ignore.js'
import { iniConfig } from './ini.js'
import { nginxConfig } from './nginx.js'
import { npmrcConfig } from './npmrc.js'
import { propertiesConfig } from './properties.js'
import { sshConfig } from './ssh.js'
import { tomlConfig } from './toml.js'
import { versionsConfig } from './versions.js'
import { yamlConfig } from './yaml.js'

export function createDefaultRegistry(): ConfigRegistry {
  const registry = new ConfigRegistry()
  registry.register(nginxConfig)
  registry.register(sshConfig)
  registry.register(envConfig)
  registry.register(iniConfig)
  registry.register(propertiesConfig)
  registry.register(tomlConfig)
  registry.register(gitConfig)
  registry.register(npmrcConfig)
  registry.register(yamlConfig)
  registry.register(ignoreConfig)
  registry.register(gitAttributesConfig)
  registry.register(browserslistConfig)
  registry.register(versionsConfig)
  registry.register(hostsConfig)
  registry.register(fstabConfig)
  registry.register(crontabConfig)
  return registry
}
