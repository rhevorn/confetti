import path from 'node:path'
import { MIN_CONFIDENCE } from './constants.js'
import type {
  ConfigDefinition,
  DetectionCandidate,
  DetectionOptions,
  DetectionResult,
  DetectionSignal,
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
): DetectionCandidate | undefined {
  const normalizedFilename = filename.replace(/\\/g, '/')
  const basename = path.posix.basename(normalizedFilename)
  let structuralScore = 0
  const signals: DetectionSignal[] = []

  const matchedFilename = definition.filenames?.find(
    (item) => item === basename,
  )
  const matchedPattern = definition.patterns?.find(
    (pattern) =>
      matchesPattern(normalizedFilename, pattern) ||
      matchesPattern(basename, pattern),
  )
  const matchedExtension = definition.extensions?.find((extension) =>
    basename.endsWith(extension),
  )

  if (matchedFilename) {
    structuralScore = 100
    signals.push({ kind: 'filename', label: matchedFilename, score: 100 })
  } else if (matchedPattern) {
    structuralScore = 70
    signals.push({ kind: 'pattern', label: matchedPattern, score: 70 })
  } else if (matchedExtension) {
    structuralScore = 10
    signals.push({ kind: 'extension', label: matchedExtension, score: 10 })
  }

  // Content signals only boost structurally matching files. Without this
  // floor, arbitrary files (for example a README with an nginx snippet)
  // would be hijacked by content-only scores that reach MIN_CONFIDENCE.
  if (structuralScore === 0) return undefined

  let contentScore: number
  try {
    contentScore = definition.detect?.(normalizedFilename, content) ?? 0
  } catch {
    contentScore = 0
  }

  if (contentScore !== 0) {
    signals.push({
      kind: 'content',
      label: 'Format-specific content signals',
      score: contentScore,
    })
  }

  return {
    definition,
    confidence: Math.max(0, Math.min(100, structuralScore + contentScore)),
    signals,
  }
}

function associationCandidate(
  registry: ConfigRegistry,
  filename: string,
  options: DetectionOptions,
): DetectionCandidate | undefined {
  const associations = options.associations
  if (!associations) return undefined

  const normalizedFilename = filename.replace(/\\/g, '/')
  const relativePath = options.relativePath?.replace(/\\/g, '/')
  const paths = [
    normalizedFilename,
    relativePath,
    path.posix.basename(normalizedFilename),
  ].filter((item): item is string => item !== undefined)

  const matches = Object.entries(associations)
    .map(([pattern, id]) => {
      const normalizedPattern = pattern.replace(/\\/g, '/')
      return {
        pattern,
        normalizedPattern,
        definition: registry.get(id),
        specificity: normalizedPattern.replaceAll('*', '').length,
      }
    })
    .filter(
      (item): item is typeof item & { definition: ConfigDefinition } =>
        item.definition !== undefined &&
        paths.some((candidate) =>
          matchesPattern(candidate, item.normalizedPattern),
        ),
    )
    .sort(
      (left, right) =>
        right.specificity - left.specificity ||
        left.pattern.localeCompare(right.pattern),
    )

  const match = matches[0]
  if (!match) return undefined
  return {
    definition: match.definition,
    confidence: 100,
    signals: [{ kind: 'association', label: match.pattern, score: 100 }],
  }
}

export function detectConfig(
  registry: ConfigRegistry,
  filename: string,
  content: string,
  options: DetectionOptions = {},
): DetectionResult | undefined {
  const candidates: DetectionCandidate[] = registry
    .all()
    .map((definition) => scoreDefinition(definition, filename, content))
    .filter(
      (candidate): candidate is DetectionCandidate =>
        candidate !== undefined && candidate.confidence > 0,
    )
    .sort(
      (left, right) =>
        right.confidence - left.confidence ||
        left.definition.id.localeCompare(right.definition.id),
    )

  const associated = associationCandidate(registry, filename, options)
  if (associated) {
    const remaining = candidates.filter(
      ({ definition }) => definition.id !== associated.definition.id,
    )
    return { ...associated, candidates: [associated, ...remaining] }
  }

  const best = candidates[0]
  if (!best || best.confidence < MIN_CONFIDENCE) {
    return undefined
  }

  return { ...best, candidates }
}
