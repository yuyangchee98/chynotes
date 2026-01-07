import Fuse from 'fuse.js'
import { getTagsWithCounts, TagWithCount, initDatabase } from './database'

/**
 * A suggestion for wrapping a term with [[tag]] brackets
 */
export interface TagSuggestion {
  term: string           // The original text to wrap (e.g., "Sarah")
  tag: string            // The normalized tag name (e.g., "sarah")
  startIndex: number     // Start position in the input text
  endIndex: number       // End position in the input text
  confidence: number     // 0-1, higher = more confident
  reason: 'exact' | 'fuzzy' | 'frequency' | 'semantic'
}

/**
 * Cache for tag list to avoid repeated DB queries
 */
let tagCache: TagWithCount[] | null = null
let tagCacheTime = 0
const TAG_CACHE_TTL = 5000 // 5 seconds

/**
 * Get cached tags or refresh from database
 */
function getCachedTags(): TagWithCount[] {
  const now = Date.now()
  if (!tagCache || now - tagCacheTime > TAG_CACHE_TTL) {
    initDatabase()
    tagCache = getTagsWithCounts()
    tagCacheTime = now
  }
  return tagCache
}

/**
 * Invalidate the tag cache (call after indexing)
 */
export function invalidateTagCache(): void {
  tagCache = null
}

/**
 * Tokenize text into words with their positions
 */
interface Token {
  word: string
  start: number
  end: number
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  // Match words (alphanumeric sequences, including unicode letters)
  const regex = /[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu
  let match

  while ((match = regex.exec(text)) !== null) {
    tokens.push({
      word: match[0],
      start: match.index,
      end: match.index + match[0].length
    })
  }

  return tokens
}

/**
 * Check if a position is already inside a [[tag]]
 */
function isInsideExistingTag(text: string, start: number, end: number): boolean {
  // Find all existing [[...]] patterns
  const tagPattern = /\[\[[\w\-\/]+\]\]/g
  let match

  while ((match = tagPattern.exec(text)) !== null) {
    const tagStart = match.index
    const tagEnd = match.index + match[0].length

    // Check if our range overlaps with this tag
    if (start < tagEnd && end > tagStart) {
      return true
    }
  }

  return false
}

/**
 * Get tag suggestions for a block of text
 *
 * Strategy:
 * 1. Tokenize the text into words
 * 2. For each word, check for fuzzy matches against existing tags
 * 3. Filter out words that are already inside [[tags]]
 * 4. Return suggestions sorted by confidence and position
 */
export function getSuggestionsForBlock(text: string): TagSuggestion[] {
  const tags = getCachedTags()

  if (tags.length === 0) {
    return []
  }

  const tokens = tokenize(text)
  const suggestions: TagSuggestion[] = []

  // Build Fuse.js index for fuzzy matching
  const fuse = new Fuse(tags, {
    keys: ['name'],
    threshold: 0.3,      // Lower = stricter matching
    distance: 50,        // Allow some character distance
    includeScore: true,
    minMatchCharLength: 2
  })

  for (const token of tokens) {
    // Skip very short words
    if (token.word.length < 3) continue

    // Skip if already inside a tag
    if (isInsideExistingTag(text, token.start, token.end)) continue

    const lowerWord = token.word.toLowerCase()

    // Check for exact match first
    const exactMatch = tags.find(t => t.name === lowerWord)
    if (exactMatch) {
      suggestions.push({
        term: token.word,
        tag: exactMatch.name,
        startIndex: token.start,
        endIndex: token.end,
        confidence: 1.0,
        reason: 'exact'
      })
      continue
    }

    // Check for fuzzy matches
    const fuzzyResults = fuse.search(lowerWord)

    if (fuzzyResults.length > 0) {
      const best = fuzzyResults[0]
      // Fuse score is 0 = perfect, 1 = worst
      // Convert to confidence: 1 - score
      const confidence = 1 - (best.score ?? 0.5)

      // Only suggest if confidence is high enough
      if (confidence > 0.6) {
        suggestions.push({
          term: token.word,
          tag: best.item.name,
          startIndex: token.start,
          endIndex: token.end,
          confidence,
          reason: 'fuzzy'
        })
      }
    }
  }

  // Also check for multi-word matches (e.g., "New York" -> [[new-york]])
  // Look for capitalized sequences that might be proper nouns
  const properNounPattern = /[A-Z][\p{L}]+(?:\s+[A-Z][\p{L}]+)*/gu
  let match

  while ((match = properNounPattern.exec(text)) !== null) {
    const phrase = match[0]
    const start = match.index
    const end = start + phrase.length

    // Skip if already inside a tag or already suggested
    if (isInsideExistingTag(text, start, end)) continue
    if (suggestions.some(s => s.startIndex === start)) continue

    // Convert to potential tag name (lowercase, spaces to hyphens)
    const potentialTag = phrase.toLowerCase().replace(/\s+/g, '-')

    // Check if this exact tag exists
    const exactMatch = tags.find(t => t.name === potentialTag)
    if (exactMatch) {
      suggestions.push({
        term: phrase,
        tag: exactMatch.name,
        startIndex: start,
        endIndex: end,
        confidence: 0.95,
        reason: 'exact'
      })
    }
  }

  // Sort by position (leftmost first), then by confidence
  suggestions.sort((a, b) => {
    if (a.startIndex !== b.startIndex) {
      return a.startIndex - b.startIndex
    }
    return b.confidence - a.confidence
  })

  // Remove duplicates (same position)
  const seen = new Set<number>()
  return suggestions.filter(s => {
    if (seen.has(s.startIndex)) return false
    seen.add(s.startIndex)
    return true
  })
}

/**
 * Check if a word looks like a proper noun (capitalized, not at sentence start)
 */
export function looksLikeProperNoun(word: string, positionInLine: number): boolean {
  if (word.length < 2) return false

  // First character uppercase, rest has lowercase
  const firstUpper = word[0] === word[0].toUpperCase()
  const hasLower = /[a-z]/.test(word)

  // If at start of line, we can't tell if it's capitalized for grammar or name
  // Still suggest if it's a known tag
  if (positionInLine === 0) return false

  return firstUpper && hasLower
}
