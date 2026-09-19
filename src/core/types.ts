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
  signals: DetectionSignal[]
}

export interface DetectionResult extends DetectionCandidate {
  candidates: DetectionCandidate[]
}

export type DetectionSignalKind =
  'association' | 'filename' | 'pattern' | 'extension' | 'content'

export interface DetectionSignal {
  kind: DetectionSignalKind
  label: string
  score: number
}

export interface DetectionOptions {
  associations?: Readonly<Record<string, string>>
  relativePath?: string
}
