import path from 'node:path'
import { MIN_CONFIDENCE } from './constants.js'
import type {
  ConfigDefinition,
  DetectionCandidate,
  DetectionResult,
} from './types.js'
import type { ConfigRegistry } from './registry.js'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchesPattern(filename: string, pattern: string): boolean {
  let expression = ''

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index]
    if (character !== '*') {
      expression += escapeRegExp(character)
      continue
    }

    if (pattern[index + 1] !== '*') {
      expression += '[^/]*'
      continue
    }

    index += 1
    if (pattern[index + 1] === '/') {
      index += 1
      expression += '(?:.*/)?'
    } else {
      expression += '.*'
    }
  }

  return new RegExp(`^${expression}$`, 'i').test(filename)
}

function scoreDefinition(
  definition: ConfigDefinition,
  filename: string,
  content: string,
): number {
  const normalizedFilename = filename.replace(/\\/g, '/')
  const basename = path.posix.basename(normalizedFilename)
  let structuralScore = 0

  if (definition.filenames?.some((item) => item === basename)) {
    structuralScore = 100
  } else if (
    definition.patterns?.some(
      (pattern) =>
        matchesPattern(normalizedFilename, pattern) ||
        matchesPattern(basename, pattern),
    )
  ) {
    structuralScore = 70
  } else if (
    definition.extensions?.some((extension) => basename.endsWith(extension))
  ) {
    structuralScore = 10
  }

  // Content signals only boost structurally matching files. Without this
  // floor, arbitrary files (for example a README with an nginx snippet)
  // would be hijacked by content-only scores that reach MIN_CONFIDENCE.
  if (structuralScore === 0) return 0

  let contentScore: number
  try {
    contentScore = definition.detect?.(normalizedFilename, content) ?? 0
  } catch {
    contentScore = 0
  }

  return Math.max(0, Math.min(100, structuralScore + contentScore))
}

export function detectConfig(
  registry: ConfigRegistry,
  filename: string,
  content: string,
): DetectionResult | undefined {
  const candidates: DetectionCandidate[] = registry
    .all()
    .map((definition) => ({
      definition,
      confidence: scoreDefinition(definition, filename, content),
    }))
    .filter((candidate) => candidate.confidence > 0)
    .sort(
      (left, right) =>
        right.confidence - left.confidence ||
        left.definition.id.localeCompare(right.definition.id),
    )

  const best = candidates[0]
  if (!best || best.confidence < MIN_CONFIDENCE) {
    return undefined
  }

  return { ...best, candidates }
}
