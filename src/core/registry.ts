import type { ConfigDefinition } from './types.js'

export class ConfigRegistry {
  readonly #definitions = new Map<string, ConfigDefinition>()

  register(definition: ConfigDefinition): void {
    if (this.#definitions.has(definition.id)) {
      throw new Error(`Config definition already registered: ${definition.id}`)
    }

    this.#definitions.set(definition.id, definition)
  }

  get(id: string): ConfigDefinition | undefined {
    return this.#definitions.get(id)
  }

  getByLanguageId(languageId: string): ConfigDefinition | undefined {
    return this.all().find((item) => item.languageId === languageId)
  }

  all(): ConfigDefinition[] {
    return [...this.#definitions.values()]
  }
}
