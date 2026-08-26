import type { ConfigRegistry } from './registry.js'

export function formatConfig(
  registry: ConfigRegistry,
  languageId: string,
  content: string,
): string {
  const definition = registry.getByLanguageId(languageId)
  if (!definition?.formatter) {
    return content
  }

  return definition.formatter(content)
}
