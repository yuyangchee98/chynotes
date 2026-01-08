import Fuse from 'fuse.js'
import pluralize from 'pluralize'
import { getTagsWithCounts, TagWithCount, initDatabase, findSimilarBlocksKNN, getBlockTags } from './database'
import { queryTermFrequency } from './frequency-index'
import { generateEmbedding } from './embeddings'

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
  otherNotes?: string[]  // For frequency suggestions: other notes containing this term (excluding current)
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
 *
 * @param text The text to analyze
 * @param currentNoteDate Optional note date (YYYY-MM-DD) to exclude from otherNotes
 */
export function getSuggestionsForBlock(text: string, currentNoteDate?: string): TagSuggestion[] {
  console.log('[TagSuggester] getSuggestionsForBlock called with:', { text: text.substring(0, 50), currentNoteDate })
  const tags = getCachedTags()
  console.log('[TagSuggester] Cached tags count:', tags.length)

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
        continue
      }
    }

    // =========================================================================
    // Pass 2: Frequency Analysis
    // =========================================================================

    // Pass 2a: Check frequency index for repeated proper nouns/phrases
    const termFreq = queryTermFrequency(lowerWord)
    console.log('[TagSuggester] Frequency check for', lowerWord, ':', termFreq)
    if (termFreq && termFreq.noteCount >= 2) {
      // Filter out current note from otherNotes
      const otherNotes = currentNoteDate
        ? termFreq.notes.filter(n => n !== currentNoteDate)
        : termFreq.notes
      suggestions.push({
        term: token.word,
        tag: termFreq.term,
        startIndex: token.start,
        endIndex: token.end,
        confidence: 0.7,
        reason: 'frequency',
        otherNotes: otherNotes.length > 0 ? otherNotes : undefined
      })
      continue
    }

    // Pass 2b: Check for plural/singular variants of existing tags
    const pluralMatch = findPluralSingularMatch(token.word, tags)
    if (pluralMatch) {
      suggestions.push({
        term: token.word,
        tag: pluralMatch,
        startIndex: token.start,
        endIndex: token.end,
        confidence: 0.9,
        reason: 'fuzzy'  // variant match shown as fuzzy
      })
      continue
    }

    // Pass 2c: Check for typos of existing tags
    const typoMatch = findTypoMatch(token.word, tags)
    if (typoMatch) {
      suggestions.push({
        term: token.word,
        tag: typoMatch,
        startIndex: token.start,
        endIndex: token.end,
        confidence: 0.85,
        reason: 'fuzzy'  // typo correction shown as fuzzy
      })
      continue
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
      continue
    }

    // Pass 2a: Check frequency index for multi-word phrases
    const phraseFreq = queryTermFrequency(potentialTag)
    if (phraseFreq && phraseFreq.noteCount >= 2) {
      // Filter out current note from otherNotes
      const otherNotes = currentNoteDate
        ? phraseFreq.notes.filter(n => n !== currentNoteDate)
        : phraseFreq.notes
      suggestions.push({
        term: phrase,
        tag: phraseFreq.term,
        startIndex: start,
        endIndex: end,
        confidence: 0.7,
        reason: 'frequency',
        otherNotes: otherNotes.length > 0 ? otherNotes : undefined
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

// ============================================================================
// Phase 2: Frequency Analysis Helpers
// ============================================================================

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Get maximum allowed Levenshtein distance based on word length
 * - 3-7 char words: max 1 edit
 * - 8+ char words: max 2 edits
 */
function getMaxTypoDistance(wordLength: number): number {
  if (wordLength < 3) return 0
  if (wordLength < 8) return 1
  return 2
}

/**
 * Check if a word is a typo of a tag
 * Returns the matching tag name or null
 */
function findTypoMatch(word: string, tags: TagWithCount[]): string | null {
  const lowerWord = word.toLowerCase()
  const maxDistance = getMaxTypoDistance(lowerWord.length)

  if (maxDistance === 0) return null

  for (const tag of tags) {
    const distance = levenshteinDistance(lowerWord, tag.name)

    if (distance > 0 && distance <= maxDistance) {
      // Bonus check: prefer matches where first letter is the same
      // (most typos preserve the first letter)
      if (lowerWord[0] === tag.name[0]) {
        return tag.name
      }
      // Still accept if distance is just 1
      if (distance === 1) {
        return tag.name
      }
    }
  }

  return null
}

/**
 * Find plural/singular variant match
 * Returns the matching tag name or null
 */
function findPluralSingularMatch(word: string, tags: TagWithCount[]): string | null {
  const lowerWord = word.toLowerCase()

  // Get singular and plural forms
  const singularForm = pluralize.singular(lowerWord)
  const pluralForm = pluralize.plural(lowerWord)

  // Check if any existing tag matches these forms
  for (const tag of tags) {
    if (tag.name === singularForm || tag.name === pluralForm) {
      // Don't suggest if the word is already the exact tag
      if (tag.name !== lowerWord) {
        return tag.name
      }
    }
  }

  return null
}

// ============================================================================
// Phase 3: Semantic Suggestions
// ============================================================================

/**
 * Minimum number of similar blocks that must share a tag to suggest it
 */
const SEMANTIC_MIN_TAG_COUNT = 2

/**
 * Number of similar blocks to search
 */
const SEMANTIC_KNN_LIMIT = 10

/**
 * Minimum text length to run semantic suggestions
 * (Short lines don't have enough context for meaningful embeddings)
 */
const SEMANTIC_MIN_TEXT_LENGTH = 20

/**
 * Get semantic tag suggestions for a line of text
 *
 * This is async because it requires calling Ollama to generate embeddings.
 * Returns suggestions for tags that appear frequently in semantically similar blocks.
 */
async function getSemanticSuggestions(text: string, lineLength: number): Promise<TagSuggestion[]> {
  // Skip if text is too short
  if (text.length < SEMANTIC_MIN_TEXT_LENGTH) {
    return []
  }

  // Skip if text already has tags (to avoid suggesting what's already there)
  const existingTags = new Set<string>()
  const tagPattern = /\[\[([\w\-\/]+)\]\]/g
  let match
  while ((match = tagPattern.exec(text)) !== null) {
    existingTags.add(match[1].toLowerCase())
  }

  try {
    // Generate embedding for the current line
    const embedding = await generateEmbedding(text)

    // Find similar blocks
    const similar = findSimilarBlocksKNN(embedding, SEMANTIC_KNN_LIMIT)

    if (similar.length === 0) {
      return []
    }

    // Count tags from similar blocks
    const tagCounts = new Map<string, number>()
    for (const block of similar) {
      const blockTags = getBlockTags(block.block_id)
      for (const tag of blockTags) {
        // Skip if this tag is already in the current line
        if (existingTags.has(tag)) continue
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      }
    }

    // Convert to suggestions, filtering by minimum count
    const suggestions: TagSuggestion[] = []
    for (const [tag, count] of tagCounts.entries()) {
      if (count >= SEMANTIC_MIN_TAG_COUNT) {
        suggestions.push({
          term: '',  // No specific term for semantic suggestions
          tag,
          startIndex: lineLength,  // End of line
          endIndex: lineLength,    // End of line (insert, not replace)
          confidence: count / SEMANTIC_KNN_LIMIT,  // e.g., 3/10 = 0.3
          reason: 'semantic'
        })
      }
    }

    // Sort by confidence (most common tag first)
    suggestions.sort((a, b) => b.confidence - a.confidence)

    // Return top 3 semantic suggestions max
    return suggestions.slice(0, 3)
  } catch (err) {
    // Ollama might not be running - silently fail
    console.log('[TagSuggester] Semantic suggestions failed:', (err as Error).message)
    return []
  }
}

/**
 * Get all tag suggestions for a block (sync Phase 1/2 + async Phase 3)
 *
 * @param text The text to analyze
 * @param currentNoteDate Optional note date (YYYY-MM-DD) to exclude from otherNotes
 */
export async function getSuggestionsForBlockAsync(text: string, currentNoteDate?: string): Promise<TagSuggestion[]> {
  // Get sync suggestions (Phase 1/2)
  const syncSuggestions = getSuggestionsForBlock(text, currentNoteDate)

  // Get async semantic suggestions (Phase 3)
  const semanticSuggestions = await getSemanticSuggestions(text, text.length)

  // Combine, with sync suggestions first (they're position-based)
  // Semantic suggestions go at the end since they're end-of-line
  return [...syncSuggestions, ...semanticSuggestions]
}
