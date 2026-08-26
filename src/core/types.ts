export interface ConfigDefinition {
  id: string
  displayName: string
  filenames?: string[]
  extensions?: string[]
  patterns?: string[]
  detect?: (filename: string, content: string) => number
  languageId: string
  formatter?: (content: string) => string
}

export interface DetectionCandidate {
  definition: ConfigDefinition
  confidence: number
}

export interface DetectionResult extends DetectionCandidate {
  candidates: DetectionCandidate[]
}
