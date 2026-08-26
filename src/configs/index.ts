import { ConfigRegistry } from '../core/registry.js'
import { envConfig } from './env.js'
import { gitConfig } from './gitconfig.js'
import { iniConfig } from './ini.js'
import { nginxConfig } from './nginx.js'
import { npmrcConfig } from './npmrc.js'
import { propertiesConfig } from './properties.js'
import { sshConfig } from './ssh.js'
import { tomlConfig } from './toml.js'
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
  return registry
}
